/**
 * Email channel — SMTP outbound + inbound webhook → CRM + lead agent (same lifecycle as WA/IG).
 */
const crypto = require('crypto');
const leadsCrm = require('./leadsCrm');
const workspaceContext = require('./workspaceContext');
const accounts = require('./email/accounts');
const mailbox = require('./email/mailbox');
const providers = require('./email/providers');
const oauth = require('./email/oauth');
const tokens = require('./email/tokens');
const oauthState = require('./oauthState');

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

/** True when this workspace has its own mailbox connected, or the server-wide SMTP settings exist. */
function canSend() {
  const own = accounts.get();
  return Boolean((own && !own.needsReconnect) || isConfigured());
}

function getStatus() {
  const ws = workspaceContext.current();
  // The default workspace keeps the legacy shared-secret endpoint; every other workspace gets its own tokenised URL.
  const path = ws === workspaceContext.DEFAULT_WORKSPACE ? '/api/email/inbound' : `/api/email/inbound/${ws}?token=${inboundToken(ws)}`;
  const account = accounts.publicView();
  return {
    configured: account.connected || isConfigured(),
    account,
    from: account.connected ? account.email : EMAIL_FROM || null,
    inboundWebhookPath: path,
    publicInboundUrl: PUBLIC_API_BASE ? `${PUBLIC_API_BASE.replace(/\/$/, '')}${path}` : null,
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
  // The workspace's own mailbox wins: the agent writes from the address the owner connected.
  const own = accounts.get();
  if (own && !own.needsReconnect) {
    const result = await mailbox.sendFrom(await tokens.getUsable(workspaceContext.current()), { to, subject, text, inReplyTo, references });
    accounts.recordSent(to, workspaceContext.current());
    return result;
  }
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

/**
 * Per-workspace inbound URL token. Each workspace points its mail provider at its own
 * /api/email/inbound/<workspace>?token=<token>; a token only works for its own workspace.
 */
function inboundToken(ws) {
  const key = process.env.EMAIL_WEBHOOK_SECRET || process.env.JWT_SECRET || 'nexora-dev-only-change-me';
  return crypto.createHmac('sha256', key).update(`email-inbound:${ws}`).digest('hex').slice(0, 32);
}

function verifyInboundToken(ws, token) {
  const a = Buffer.from(inboundToken(ws));
  const b = Buffer.from(String(token || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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

async function scoreAndReply(vertex, leadAgent, { from, subject, text, messageId, references, replyAllowed = true, replyBlockedReason }) {
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

  // Captured as a lead, but not answered (reply limits protect the owner's mailbox and sender reputation).
  if (!replyAllowed) {
    return { lead, skipped: true, reason: replyBlockedReason || 'reply_limit' };
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
    channel: 'email',
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

  if (canSend()) {
    try {
      const subj = replySubject(updated, subject);
      await sendEmail(parsed.email, subj, replyText, {
        inReplyTo: messageId || undefined,
        references: [references, messageId].filter(Boolean).join(' ') || undefined,
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

  app.get('/api/email/inbound-url', guard, (req, res) => {
    const ws = req.appUser.workspaceId;
    const base = (PUBLIC_API_BASE || '').replace(/\/$/, '');
    res.json({ success: true, data: { path: `/api/email/inbound/${ws}`, token: inboundToken(ws), url: base ? `${base}/api/email/inbound/${ws}?token=${inboundToken(ws)}` : null } });
  });

  app.post('/api/email/inbound/:workspaceId', async (req, res) => {
    let ws;
    try {
      ws = workspaceContext.assertValid(req.params.workspaceId);
    } catch {
      return res.status(404).json({ success: false, error: 'Unknown workspace' });
    }
    if (!verifyInboundToken(ws, req.query.token)) {
      return res.status(401).json({ success: false, error: 'Invalid inbound token' });
    }
    try {
      const payload = normalizeInboundBody(req.body);
      if (!payload) {
        return res.status(400).json({ success: false, error: 'Unrecognized inbound payload' });
      }
      const result = await workspaceContext.run(ws, () => scoreAndReply(vertex, leadAgent, payload));
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[Email] inbound', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Legacy single-tenant endpoint (shared secret): delivers to the default workspace only.
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

  // ------------------------------------------------------------------ the workspace's own mailbox
  const requireAdmin = require('./companyKnowledge').requireAdmin;
  const attempts = new Map(); // workspace -> connect attempt times (checking logins against arbitrary servers must be rate limited)
  const attemptAllowed = (ws) => {
    const now = Date.now();
    const recent = (attempts.get(ws) || []).filter((t) => now - t < 3_600_000);
    if (recent.length >= 8) return false;
    attempts.set(ws, [...recent, now]);
    return true;
  };
  const view = () => ({ ...accounts.publicView(), autoReply: require('./companyKnowledge').isChannelAutoReplyEnabled('email') });
  const text = (v, max) => String(v ?? '').trim().slice(0, max);

  app.get('/api/email/providers', guard, (_req, res) => res.json({ success: true, data: { presets: providers.publicPresets(), signIn: oauth.status() } }));

  // ---- sign in with Google / Microsoft (no password to type; works where app passwords are blocked)
  const FRONTEND = oauth.frontendUrl();
  const returnPage = (payload) => {
    const message = JSON.stringify(payload.success ? { type: 'EMAIL_AUTH_SUCCESS' } : { type: 'EMAIL_AUTH_ERROR', error: String(payload.error || 'sign_in_failed').slice(0, 300) });
    return `<!DOCTYPE html><html><body><p>Returning to Nexora…</p><script>
      var msg = ${message};
      if (window.opener && !window.opener.closed) { window.opener.postMessage(msg, ${JSON.stringify(FRONTEND)}); window.close(); }
      else { window.location.replace(${JSON.stringify(`${FRONTEND}/?email=${payload.success ? 'connected' : 'error'}`)}); }
    </script></body></html>`;
  };

  app.get('/auth/email/callback', guard, async (req, res) => {
    const { code, state, error, error_description: description } = req.query;
    let flow;
    try {
      flow = oauthState.verify(state, 'email', req.appUser);
    } catch (err) {
      return res.send(returnPage({ success: false, error: err.message === 'oauth_user_mismatch' ? 'Sign in to Nexora first, then connect your email.' : 'The sign-in expired. Try again.' }));
    }
    if (error) return res.send(returnPage({ success: false, error: description || error }));
    if (!code) return res.send(returnPage({ success: false, error: 'The provider did not return a sign-in code.' }));
    const name = flow.extra?.provider;
    try {
      if (!oauth.PROVIDERS[name]) throw new Error('Unknown sign-in provider.');
      const t = await oauth.exchangeCode(name, code);
      const who = oauth.identityFromIdToken(t.idToken);
      const candidate = {
        email: who.email,
        provider: name === 'microsoft' ? 'outlook' : 'gmail',
        authType: 'oauth',
        user: who.email,
        fromName: who.name,
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        accessExpiresAt: t.accessExpiresAt,
        ...oauth.mailServers(name),
      };
      const position = await mailbox.verifyAccount(candidate);
      accounts.connect({ ...candidate, ...position }, flow.workspaceId);
      console.log(`[Email:${flow.workspaceId}] mailbox connected via ${name} sign-in: ${who.email}`);
      res.send(returnPage({ success: true }));
    } catch (err) {
      console.warn('[Email] sign-in failed:', err.message);
      res.send(returnPage({ success: false, error: err.message }));
    }
  });

  app.get('/auth/email/:provider', guard, requireAdmin, (req, res) => {
    try {
      if (!oauth.PROVIDERS[req.params.provider]) throw new Error('Unknown sign-in provider.');
      if (!attemptAllowed(workspaceContext.current())) throw new Error('Too many attempts. Try again in an hour.');
      res.redirect(oauth.authorizeUrl(req.params.provider, oauthState.create({ channel: 'email', appUser: req.appUser, extra: { provider: req.params.provider } })));
    } catch (err) {
      res.status(400).send(returnPage({ success: false, error: err.message }));
    }
  });

  app.get('/api/email/account', guard, (_req, res) => res.json({ success: true, data: view() }));

  app.put('/api/email/account', guard, requireAdmin, async (req, res) => {
    const ws = workspaceContext.current();
    if (!attemptAllowed(ws)) return res.status(429).json({ success: false, error: 'Too many attempts. Try again in an hour.' });
    try {
      const b = req.body || {};
      const provider = text(b.provider, 20);
      const email = text(b.email, 200).toLowerCase();
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(email)) throw new Error('Enter a valid email address.');
      let password = String(b.password ?? '');
      if (provider === 'gmail') password = password.replace(/\s+/g, ''); // Google shows app passwords in groups of four
      if (!password || password.length > 200) throw new Error('Enter the email password or app password.');
      const servers = providers.resolveServers(provider, b);
      const candidate = { email, provider, user: text(b.username, 200) || email, password, fromName: text(b.fromName, 80), ...servers };
      const position = await mailbox.verifyAccount(candidate);
      accounts.connect({ ...candidate, ...position }, ws);
      console.log(`[Email:${ws}] mailbox connected: ${email}`);
      res.json({ success: true, data: view() });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/email/account', guard, requireAdmin, (_req, res) => {
    accounts.disconnect(workspaceContext.current());
    res.json({ success: true, data: view() });
  });

  app.put('/api/email/auto-reply', guard, requireAdmin, (req, res) => {
    require('./companyKnowledge').saveProfile({ emailAutoReply: Boolean(req.body?.enabled) }, workspaceContext.current());
    res.json({ success: true, data: view() });
  });

  // Sends only to the connected address itself, so this cannot be used to mail strangers.
  app.post('/api/email/account/test', guard, requireAdmin, async (_req, res) => {
    try {
      const own = accounts.get();
      if (!own || own.needsReconnect) throw new Error('Connect a mailbox first.');
      await sendEmail(own.email, `Test from ${brandName()}`, `This is a test message. Your ${brandName()} assistant can now send email from ${own.email}.`);
      res.json({ success: true, data: { sentTo: own.email } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
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

/** The mailbox checker for every connected workspace; started once by the server. */
function createInboundPoller(vertex, leadAgent, opts = {}) {
  const { createEmailPoller } = require('./email/poller');
  return createEmailPoller({
    handle: (payload, ws) => workspaceContext.run(ws, () => scoreAndReply(vertex, leadAgent, payload)),
    ...opts,
  });
}

module.exports = {
  mountRoutes,
  createInboundPoller,
  canSend,
  sendEmail,
  isConfigured,
  getStatus,
  scoreAndReply,
  replySubject,
};
