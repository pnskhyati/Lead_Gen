/**
 * WhatsApp Cloud API — inbound webhook + outbound send + lead upsert.
 */
const axios = require('axios');
const path = require('path');
const leadsCrm = require('./leadsCrm');
const workspaceContext = require('./workspaceContext');
const { createWorkspaceStore } = require('./wsStore');
const { verifyMetaSignature } = require('./metaWebhook');

const GRAPH = 'https://graph.facebook.com/v21.0';
const ENV_TOKEN = process.env.WHATSAPP_TOKEN || process.env.META_WA_TOKEN || '';
const ENV_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WA_VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'nexora_ig_verify';
const ENV_BUSINESS_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

const configStore = createWorkspaceStore(path.join(__dirname, 'data', 'whatsapp.json'), {
  token: '',
  phoneNumberId: '',
  businessAccountId: '',
  displayPhoneNumber: '',
  connectedAt: null,
});

/**
 * WhatsApp credentials for the current workspace. The platform-level env credentials
 * belong to the default workspace only; every other workspace connects its own number.
 */
function getConfig(ws) {
  const id = workspaceContext.resolve(ws);
  const stored = configStore.read(id);
  if (stored.token && stored.phoneNumberId) return stored;
  if (id === workspaceContext.DEFAULT_WORKSPACE && ENV_TOKEN && ENV_PHONE_ID) {
    return { token: ENV_TOKEN, phoneNumberId: ENV_PHONE_ID, businessAccountId: ENV_BUSINESS_ID, displayPhoneNumber: '' };
  }
  return { token: '', phoneNumberId: '', businessAccountId: '', displayPhoneNumber: '' };
}

/** Which workspace owns the WhatsApp number that received a webhook event. */
function findWorkspaceByPhoneNumberId(phoneNumberId) {
  const target = String(phoneNumberId || '');
  if (!target) return null;
  for (const [ws, cfg] of configStore.entries()) {
    if (cfg.phoneNumberId && String(cfg.phoneNumberId) === target) return ws;
  }
  if (ENV_PHONE_ID && ENV_PHONE_ID === target) return workspaceContext.DEFAULT_WORKSPACE;
  return null;
}

function isConfigured() {
  const cfg = getConfig();
  return Boolean(cfg.token && cfg.phoneNumberId);
}

function getStatus() {
  const cfg = getConfig();
  return {
    configured: Boolean(cfg.token && cfg.phoneNumberId),
    phoneNumberId: cfg.phoneNumberId ? `${cfg.phoneNumberId.slice(0, 4)}…` : null,
    displayPhoneNumber: cfg.displayPhoneNumber || null,
    businessAccountId: cfg.businessAccountId || null,
  };
}

async function sendWhatsAppText(toPhone, text) {
  const cfg = getConfig();
  if (!cfg.token || !cfg.phoneNumberId) {
    throw new Error('WhatsApp is not connected for this workspace');
  }
  const to = String(toPhone).replace(/\D/g, '');
  const { data } = await axios.post(
    `${GRAPH}/${cfg.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
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
    channel: 'whatsapp',
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
    scoreBand: agentResult.scoreBand,
    intent: agentResult.intent,
    intentConfidence: agentResult.intentConfidence,
    intentSummary: agentResult.intentSummary,
    nextBestAction: agentResult.nextBestAction,
    scoreExplanation: agentResult.scoreExplanation,
    conversationState: agentResult.conversationState,
    suggestedReply: replyText,
    handoffReason: agentResult.handoffReason,
    handoffEmail: agentResult.handoffEmail,
    status: agentResult.needsHandoff
      ? 'handed_off'
      : agentResult.captureLead || agentResult.leadScore >= 70
        ? 'qualified'
        : 'contacted',
    autoReplyPaused: agentResult.needsHandoff,
    lifecycleStage: 'engaged',
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

  // Connect this workspace's own WhatsApp Business number (token is validated before it is stored).
  app.put('/api/whatsapp/config', guard, async (req, res) => {
    try {
      if (req.appUser?.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }
      const token = String(req.body?.token || '').trim();
      const phoneNumberId = String(req.body?.phoneNumberId || '').trim();
      const businessAccountId = String(req.body?.businessAccountId || '').trim();
      if (!token || !/^\d{5,30}$/.test(phoneNumberId)) {
        return res.status(400).json({ success: false, error: 'A valid access token and phone number ID are required' });
      }
      const owner = findWorkspaceByPhoneNumberId(phoneNumberId);
      if (owner && owner !== workspaceContext.current()) {
        return res.status(409).json({ success: false, error: 'This WhatsApp number is already connected to another workspace' });
      }
      const { data } = await axios.get(`${GRAPH}/${phoneNumberId}`, {
        params: { fields: 'display_phone_number,verified_name' },
        headers: { Authorization: `Bearer ${token}` },
      });
      configStore.update((c) => ({
        ...c,
        token,
        phoneNumberId,
        businessAccountId,
        displayPhoneNumber: data.display_phone_number || '',
        connectedAt: new Date().toISOString(),
      }));
      res.json({ success: true, data: getStatus() });
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message;
      res.status(400).json({ success: false, error: `Could not verify WhatsApp credentials: ${message}` });
    }
  });

  app.delete('/api/whatsapp/config', guard, (req, res) => {
    if (req.appUser?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    configStore.update((c) => ({ ...c, token: '', phoneNumberId: '', businessAccountId: '', displayPhoneNumber: '', connectedAt: null }));
    res.json({ success: true, data: getStatus() });
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
    if (!verifyMetaSignature(req)) return res.sendStatus(401);
    res.sendStatus(200);
    try {
      const entries = req.body?.entry || [];
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          // The receiving number decides the workspace; unknown numbers are ignored, never defaulted.
          const ws = findWorkspaceByPhoneNumberId(value.metadata?.phone_number_id);
          if (!ws) {
            console.warn(`[WhatsApp] webhook for unknown phone number ${value.metadata?.phone_number_id} — ignored`);
            continue;
          }
          const messages = value.messages || [];
          for (const msg of messages) {
            if (msg.type !== 'text' || !msg.text?.body) continue;
            const from = msg.from;
            const text = msg.text.body;
            await workspaceContext.run(ws, () =>
              scoreAndReply(vertex, leadAgent, {
                from,
                text,
                messageId: msg.id,
              })
            );
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
  getConfig,
  findWorkspaceByPhoneNumberId,
  sendWhatsAppText,
  isConfigured,
  getStatus,
  scoreAndReply,
};
