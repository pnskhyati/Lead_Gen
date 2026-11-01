/**
 * Email channel — SMTP outbound + inbound webhook → CRM + lead agent (same lifecycle as WA/IG).
 */
const leadsCrm = require('./leadsCrm');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_FROM || '';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Tecavy';
const EMAIL_WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET || '';
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || process.env.PUBLIC_BASE_URL || '';

let transporterPromise = null;

function isConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && EMAIL_FROM);
}

function getStatus() {
  return {
    configured: isConfigured(),
    from: EMAIL_FROM || null,
    inboundWebhookPath: '/api/email/inbound',
    publicInboundUrl: PUBLIC_API_BASE ? `${PUBLIC_API_BASE.replace(/\/$/, '')}/api/email/inbound` : null,
  };
}

async function getTransporter() {
  if (!isConfigured()) {
    throw new Error('Email SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM)');
  }
  if (!transporterPromise) {
    const nodemailer = require('nodemailer');
    transporterPromise = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporterPromise;
}

function parseFromHeader(from) {
  const raw = String(from || '').trim();
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].replace(/^["']|["']$/g, '').trim(), email: match[2].trim().toLowerCase() };
  }
  if (raw.includes('@')) return { name: raw.split('@')[0], email: raw.toLowerCase() };
  return { name: 'Email lead', email: raw.toLowerCase() };
}

function brandName() {
  try {
    const ck = require('./companyKnowledge');
    return ck.getProfile().companyName || EMAIL_FROM_NAME;
  } catch {
    return EMAIL_FROM_NAME;
  }
}

function replySubject(lead, fallback) {
  const base = lead.lastEmailSubject || fallback || `Message from ${brandName()}`;
  return /^re:/i.test(base) ? base : `Re: ${base}`;
}

async function sendEmail(to, subject, text, { html, inReplyTo, references } = {}) {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to,
    subject,
    text,
    html: html || undefined,
    inReplyTo,
    references,
  });
  return { messageId: info.messageId, accepted: info.accepted };
}

function verifyWebhook(req) {
  if (!EMAIL_WEBHOOK_SECRET) return true;
  const header = req.headers['x-email-webhook-secret'] || req.query.secret;
  return String(header || '') === EMAIL_WEBHOOK_SECRET;
}

function normalizeInboundBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.from && (body.text || body.html || body.subject)) {
    return {
      from: body.from,
      subject: body.subject || '(no subject)',
      text: body.text || stripHtml(body.html || '') || body.subject || '',
      messageId: body.messageId || body['Message-Id'] || null,
    };
  }
  // SendGrid Inbound Parse
  if (body.from && body.envelope) {
    return {
      from: body.from,
      subject: body.subject || '(no subject)',
      text: body.text || stripHtml(body.html || '') || '',
      messageId: body.headers?.['Message-ID'] || null,
    };
  }
  // Mailgun
  if (body.sender && body['body-plain']) {
    return {
      from: body.sender,
      subject: body.subject || '(no subject)',
      text: body['body-plain'] || body['stripped-text'] || '',
      messageId: body['Message-Id'] || null,
    };
  }
  return null;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scoreAndReply(vertex, leadAgent, { from, subject, text, messageId }) {
  const parsed = parseFromHeader(from);
  if (!parsed.email || !parsed.email.includes('@')) {
    throw new Error('Invalid from email');
  }

  let ck;
  try {
    ck = require('./companyKnowledge');
  } catch {
    ck = null;
  }

  const displayName = parsed.name || parsed.email;
  const externalId = `email:${parsed.email}`;

  const lead = await leadsCrm.upsertLead({
    channel: 'email',
    platform: 'Email',
    externalId,
    author: displayName,
    email: parsed.email,
    customerComment: text,
    lastEmailSubject: subject,
    lastMessageAt: new Date().toISOString(),
    lifecycleStage: 'captured',
  });

  await leadsCrm.addMessage({
    leadId: lead.id,
    role: 'customer',
    text: subject ? `[${subject}]\n${text}` : text,
    channelMessageId: messageId,
  });

  if (ck && !ck.isChannelAutoReplyEnabled('email')) {
    return { lead, skipped: true, reason: 'auto_reply_disabled' };
  }

  if (lead.autoReplyPaused || lead.status === 'handed_off') {
    return { lead, skipped: true, reason: 'handoff' };
  }

  const botName = ck?.getBotName?.() || 'Alex';
  const historyMsgs = await leadsCrm.getMessages(lead.id);
  const history = historyMsgs
    .slice(-12)
    .map((m) => ({
      role: m.role === 'customer' ? 'user' : 'model',
      text: m.text,
    }));

  const agentResult = await leadAgent.chat(vertex, {
    message: text,
    history: history.slice(0, -1),
    visitorName: displayName,
    previousScore: lead.score ?? 0,
  });

  let replyText = agentResult.reply;
  if (historyMsgs.filter((m) => m.role === 'customer').length <= 1 && !new RegExp(botName, 'i').test(replyText)) {
    replyText = `Hi — I'm ${botName} from ${brandName()}. ${replyText}`;
  }

  const updated = await leadsCrm.upsertLead({
    id: lead.id,
    channel: 'email',
    platform: 'Email',
    externalId,
    author: displayName,
    email: parsed.email,
    customerComment: text,
    lastEmailSubject: subject,
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

  await leadsCrm.addMessage({ leadId: lead.id, role: 'agent', text: replyText });

  if (isConfigured()) {
    try {
      const subj = replySubject(updated, subject);
      await sendEmail(parsed.email, subj, replyText, {
        inReplyTo: messageId || undefined,
        references: messageId || undefined,
      });
      console.log(`[Email] Auto-replied → ${parsed.email}`);
    } catch (err) {
      console.error('[Email] SMTP send failed:', err.message);
    }
  } else {
    console.warn('[Email] Inbound captured; SMTP not configured — reply stored on lead only.');
  }

  return { lead: updated, agentResult: { ...agentResult, reply: replyText } };
}

function mountRoutes(app, { vertex, leadAgent, requireAuth }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();

  app.get('/api/email/status', guard, (_req, res) => {
    res.json({ success: true, data: getStatus() });
  });

  app.post('/api/email/inbound', async (req, res) => {
    if (!verifyWebhook(req)) {
      return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    }
    try {
      const payload = normalizeInboundBody(req.body);
      if (!payload) {
        return res.status(400).json({ success: false, error: 'Unrecognized inbound payload' });
      }
      const result = await scoreAndReply(vertex, leadAgent, payload);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[Email] inbound', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/email/send', guard, async (req, res) => {
    try {
      const { to, subject, text, leadId } = req.body || {};
      if (!to || !text) {
        return res.status(400).json({ success: false, error: 'to and text required' });
      }
      const subj = subject || `Message from ${brandName()}`;
      const data = await sendEmail(to, subj, text);
      if (leadId) {
        await leadsCrm.addMessage({ leadId, role: 'human', text });
        await leadsCrm.updateLead(leadId, {
          status: 'contacted',
          lastMessageAt: new Date(),
          email: to,
          channel: 'email',
          lifecycleStage: 'engaged',
        });
      }
      res.json({ success: true, data });
    } catch (err) {
      console.error('[Email] send', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /** Dev / demo: simulate an inbound email without SMTP forwarding */
  app.post('/api/email/simulate-inbound', guard, async (req, res) => {
    try {
      const { from, subject, text } = req.body || {};
      if (!from || !text) {
        return res.status(400).json({ success: false, error: 'from and text required' });
      }
      const result = await scoreAndReply(vertex, leadAgent, {
        from,
        subject: subject || 'Inbound inquiry',
        text,
        messageId: `sim-${Date.now()}`,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  mountRoutes,
  sendEmail,
  isConfigured,
  getStatus,
  scoreAndReply,
  replySubject,
};
