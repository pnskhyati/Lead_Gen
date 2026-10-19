/**
 * WhatsApp Cloud API — inbound webhook + outbound send + lead upsert.
 */
const axios = require('axios');
const leadsCrm = require('./leadsCrm');

const GRAPH = 'https://graph.facebook.com/v21.0';
const WA_TOKEN = process.env.WHATSAPP_TOKEN || process.env.META_WA_TOKEN || '';
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WA_VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'nexora_ig_verify';
const WA_BUSINESS_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

function isConfigured() {
  return Boolean(WA_TOKEN && WA_PHONE_ID);
}

function getStatus() {
  return {
    configured: isConfigured(),
    phoneNumberId: WA_PHONE_ID ? `${WA_PHONE_ID.slice(0, 4)}…` : null,
    businessAccountId: WA_BUSINESS_ID || null,
  };
}

async function sendWhatsAppText(toPhone, text) {
  if (!isConfigured()) throw new Error('WhatsApp is not configured (WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID)');
  const to = String(toPhone).replace(/\D/g, '');
  const { data } = await axios.post(
    `${GRAPH}/${WA_PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return data;
}

async function scoreAndReply(vertex, leadAgent, { from, text, messageId }) {
  let ck;
  try {
    ck = require('./companyKnowledge');
  } catch {
    ck = null;
  }

  const lead = await leadsCrm.upsertLead({
    channel: 'whatsapp',
    platform: 'WhatsApp',
    externalId: `wa:${from}`,
    author: from,
    phone: from,
    customerComment: text,
    lastMessageAt: new Date().toISOString(),
  });

  await leadsCrm.addMessage({
    leadId: lead.id,
    role: 'customer',
    text,
    channelMessageId: messageId,
  });

  if (ck && !ck.isChannelAutoReplyEnabled('whatsapp')) {
    return { lead, skipped: true, reason: 'auto_reply_disabled' };
  }

  if (lead.autoReplyPaused || lead.status === 'handed_off') {
    return { lead, skipped: true };
  }

  const botName = ck?.getBotName?.() || 'Alex';
  const historyMsgs = await leadsCrm.getMessages(lead.id);
  const history = historyMsgs
    .filter((m) => m.id !== messageId)
    .slice(-12)
    .map((m) => ({
      role: m.role === 'customer' ? 'user' : 'model',
      text: m.text,
    }));

  const agentResult = await leadAgent.chat(vertex, {
    message: text,
    history,
    visitorName: from,
  });

  let replyText = agentResult.reply;
  if (historyMsgs.filter((m) => m.role === 'customer').length <= 1 && !new RegExp(botName, 'i').test(replyText)) {
    replyText = `Hey — I'm ${botName}. ${replyText}`;
  }

  const updated = await leadsCrm.upsertLead({
    id: lead.id,
    channel: 'whatsapp',
    platform: 'WhatsApp',
    externalId: `wa:${from}`,
    author: from,
    phone: from,
    customerComment: text,
    temperature: agentResult.leadTemperature,
    score: agentResult.leadScore,
    intentSummary: agentResult.intentSummary,
    suggestedReply: replyText,
    handoffReason: agentResult.handoffReason,
    handoffEmail: agentResult.handoffEmail,
    status: agentResult.needsHandoff ? 'handed_off' : lead.status,
    autoReplyPaused: agentResult.needsHandoff,
  });

  await leadsCrm.addMessage({
    leadId: lead.id,
    role: 'agent',
    text: replyText,
  });

  try {
    await sendWhatsAppText(from, replyText);
    console.log(`[WhatsApp] Auto-replied as ${botName} → ${from}`);
  } catch (err) {
    console.error('[WhatsApp] send failed:', err.response?.data || err.message);
  }

  return { lead: updated, agentResult: { ...agentResult, reply: replyText } };
}

function mountRoutes(app, { vertex, leadAgent, requireAuth }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();

  app.get('/api/whatsapp/status', guard, (_req, res) => {
    res.json(getStatus());
  });

  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === WA_VERIFY) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  app.post('/api/whatsapp/webhook', async (req, res) => {
    res.sendStatus(200);
    try {
      const entries = req.body?.entry || [];
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          const messages = value.messages || [];
          for (const msg of messages) {
            if (msg.type !== 'text' || !msg.text?.body) continue;
            const from = msg.from;
            const text = msg.text.body;
            await scoreAndReply(vertex, leadAgent, {
              from,
              text,
              messageId: msg.id,
            });
          }
        }
      }
    } catch (err) {
      console.error('[WhatsApp] webhook error:', err.message);
    }
  });

  app.post('/api/whatsapp/send', guard, async (req, res) => {
    try {
      const { to, text, leadId } = req.body || {};
      if (!to || !text) return res.status(400).json({ success: false, error: 'to and text required' });
      const data = await sendWhatsAppText(to, text);
      if (leadId) {
        await leadsCrm.addMessage({ leadId, role: 'human', text });
        await leadsCrm.updateLead(leadId, { status: 'contacted', lastMessageAt: new Date() });
      }
      res.json({ success: true, data });
    } catch (err) {
      console.error('[WhatsApp] send', err.response?.data || err.message);
      res.status(500).json({
        success: false,
        error: err.response?.data?.error?.message || err.message,
      });
    }
  });
}

module.exports = {
  mountRoutes,
  sendWhatsAppText,
  isConfigured,
  getStatus,
  scoreAndReply,
};
