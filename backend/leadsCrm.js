/**
 * Unified Leads CRM — Mongo when available, file store fallback.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'leads-crm.json');

const LeadSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    channel: {
      type: String,
      enum: ['web', 'instagram', 'whatsapp', 'facebook', 'email', 'google_ads', 'manual'],
      default: 'manual',
    },
    attribution: { type: mongoose.Schema.Types.Mixed, default: {} },
    platform: { type: String, default: 'Web' },
    externalId: { type: String, index: true },
    author: String,
    customerComment: { type: String, default: '' },
    temperature: { type: String, enum: ['hot', 'warm', 'cold'], default: 'warm' },
    score: { type: Number, default: 50 },
    intentSummary: { type: String, default: '' },
    intent: String,
    intentConfidence: Number,
    scoreBand: { type: String, enum: ['cold', 'warm', 'hot', 'very_hot'], default: 'warm' },
    nextBestAction: String,
    scoreExplanation: String,
    scoringVersion: String,
    conversationState: {
      type: String,
      enum: ['AI_ACTIVE', 'AI_WAITING', 'HUMAN_REQUIRED', 'HUMAN_ACTIVE', 'AI_PAUSED', 'CLOSED'],
      default: 'AI_ACTIVE',
    },
    recommendedProduct: String,
    suggestedReply: String,
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'closed', 'handed_off'],
      default: 'new',
    },
    handoffReason: String,
    handoffEmail: String,
    mediaPermalink: String,
    phone: String,
    email: String,
    lastEmailSubject: String,
    igScopedId: String,
    autoReplyPaused: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    followUps: { type: Array, default: [] },
    nextFollowUpAt: Date,
    lifecycleStage: {
      type: String,
      enum: ['captured', 'engaged', 'qualified', 'dormant', 'reactivated'],
      default: 'captured',
    },
    reactivationEligible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

let lifecycle;
try {
  lifecycle = require('./leadLifecycle');
} catch {
  lifecycle = null;
}

const LeadMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    leadId: { type: String, required: true, index: true },
    role: { type: String, enum: ['customer', 'agent', 'human'], required: true },
    text: { type: String, required: true },
    channelMessageId: String,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

let Lead;
let LeadMessage;
try {
  Lead = mongoose.models.CrmLead || mongoose.model('CrmLead', LeadSchema);
  LeadMessage = mongoose.models.CrmLeadMessage || mongoose.model('CrmLeadMessage', LeadMessageSchema);
} catch {
  Lead = mongoose.model('CrmLead', LeadSchema);
  LeadMessage = mongoose.model('CrmLeadMessage', LeadMessageSchema);
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ leads: [], messages: [] }, null, 2));
  }
}

function readFile() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { leads: [], messages: [] };
  }
}

function writeFile(data) {
  ensureFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function toClientLead(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: o.id,
    channel: o.channel || 'manual',
    platform: o.platform || 'Web',
    externalId: o.externalId,
    author: o.author,
    customerComment: o.customerComment || '',
    temperature: o.temperature || 'warm',
    score: o.score ?? 50,
    intentSummary: o.intentSummary || '',
    intent: o.intent || null,
    intentConfidence: o.intentConfidence ?? null,
    scoreBand: o.scoreBand || null,
    nextBestAction: o.nextBestAction || null,
    scoreExplanation: o.scoreExplanation || null,
    scoringVersion: o.scoringVersion || null,
    conversationState: o.conversationState || 'AI_ACTIVE',
    recommendedProduct: o.recommendedProduct,
    suggestedReply: o.suggestedReply,
    status: o.status || 'new',
    handoffReason: o.handoffReason,
    handoffEmail: o.handoffEmail,
    mediaPermalink: o.mediaPermalink,
    phone: o.phone,
    email: o.email || null,
    lastEmailSubject: o.lastEmailSubject || null,
    igScopedId: o.igScopedId,
    autoReplyPaused: Boolean(o.autoReplyPaused),
    lastMessageAt: o.lastMessageAt
      ? new Date(o.lastMessageAt).toISOString()
      : new Date(o.createdAt || Date.now()).toISOString(),
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
    source: o.channel || o.source || 'manual',
    followUps: Array.isArray(o.followUps) ? o.followUps : [],
    nextFollowUpAt: o.nextFollowUpAt ? new Date(o.nextFollowUpAt).toISOString() : null,
    lifecycleStage: o.lifecycleStage || 'captured',
    reactivationEligible: Boolean(o.reactivationEligible),
    attribution: o.attribution && typeof o.attribution === 'object' ? o.attribution : {},
  };
}

function mergeAttribution(existing, incoming) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return base;
  for (const [key, val] of Object.entries(incoming)) {
    if (val !== undefined && val !== null && val !== '') base[key] = val;
  }
  return base;
}

async function notifySheetsLead(client, isNew) {
  if (!isNew || !client?.id) return;
  try {
    const sheets = require('./googleSheets');
    if (sheets.isConfigured()) {
      await sheets.appendLeadRow(client);
    }
  } catch (err) {
    console.warn('[Sheets] append lead', err.message);
  }
}

function toClientMessage(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: o.id,
    leadId: o.leadId,
    role: o.role,
    text: o.text,
    channelMessageId: o.channelMessageId,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
  };
}

async function listLeads({ temperature, status, channel, limit = 100 } = {}) {
  if (mongoReady()) {
    const q = {};
    if (temperature) q.temperature = temperature;
    if (status) q.status = status;
    if (channel) q.channel = channel;
    const rows = await Lead.find(q).sort({ lastMessageAt: -1 }).limit(limit);
    return rows.map(toClientLead);
  }
  let { leads } = readFile();
  if (temperature) leads = leads.filter((l) => l.temperature === temperature);
  if (status) leads = leads.filter((l) => l.status === status);
  if (channel) leads = leads.filter((l) => l.channel === channel);
  return leads
    .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
    .slice(0, limit)
    .map(toClientLead);
}

async function getLead(id) {
  if (mongoReady()) {
    const row = await Lead.findOne({ id });
    return toClientLead(row);
  }
  const { leads } = readFile();
  return toClientLead(leads.find((l) => l.id === id));
}

async function getMessages(leadId) {
  if (mongoReady()) {
    const rows = await LeadMessage.find({ leadId }).sort({ createdAt: 1 });
    return rows.map(toClientMessage);
  }
  const { messages } = readFile();
  return messages
    .filter((m) => m.leadId === leadId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(toClientMessage);
}

async function upsertLead(payload) {
  const now = new Date();
  const id = payload.id || `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (mongoReady()) {
    let existing = null;
    if (payload.externalId) {
      existing = await Lead.findOne({
        externalId: payload.externalId,
        channel: payload.channel || 'manual',
      });
    }
    if (!existing && payload.id) existing = await Lead.findOne({ id: payload.id });

    const data = {
      id: existing?.id || id,
      channel: payload.channel || existing?.channel || 'manual',
      platform: payload.platform || existing?.platform || 'Web',
      externalId: payload.externalId ?? existing?.externalId,
      author: payload.author ?? existing?.author,
      customerComment: payload.customerComment ?? existing?.customerComment ?? '',
      temperature: payload.temperature || existing?.temperature || 'warm',
      score: payload.score ?? existing?.score ?? 50,
      intentSummary: payload.intentSummary ?? existing?.intentSummary ?? '',
      intent: payload.intent ?? existing?.intent,
      intentConfidence: payload.intentConfidence ?? existing?.intentConfidence,
      scoreBand: payload.scoreBand ?? existing?.scoreBand,
      nextBestAction: payload.nextBestAction ?? existing?.nextBestAction,
      scoreExplanation: payload.scoreExplanation ?? existing?.scoreExplanation,
      scoringVersion: payload.scoringVersion ?? existing?.scoringVersion,
      conversationState: payload.conversationState ?? existing?.conversationState ?? 'AI_ACTIVE',
      recommendedProduct: payload.recommendedProduct ?? existing?.recommendedProduct,
      suggestedReply: payload.suggestedReply ?? existing?.suggestedReply,
      status: payload.status || existing?.status || 'new',
      handoffReason: payload.handoffReason ?? existing?.handoffReason,
      handoffEmail: payload.handoffEmail ?? existing?.handoffEmail,
      mediaPermalink: payload.mediaPermalink ?? existing?.mediaPermalink,
      phone: payload.phone ?? existing?.phone,
      email: payload.email ?? existing?.email,
      lastEmailSubject: payload.lastEmailSubject ?? existing?.lastEmailSubject,
      igScopedId: payload.igScopedId ?? existing?.igScopedId,
      autoReplyPaused:
        payload.autoReplyPaused != null ? payload.autoReplyPaused : existing?.autoReplyPaused || false,
      lastMessageAt: payload.lastMessageAt ? new Date(payload.lastMessageAt) : now,
      createdAt: existing?.createdAt || now,
      followUps: payload.followUps ?? existing?.followUps ?? [],
      nextFollowUpAt: payload.nextFollowUpAt ?? existing?.nextFollowUpAt,
      lifecycleStage: payload.lifecycleStage ?? existing?.lifecycleStage ?? 'captured',
      reactivationEligible:
        payload.reactivationEligible != null
          ? payload.reactivationEligible
          : existing?.reactivationEligible || false,
      attribution: mergeAttribution(existing?.attribution, payload.attribution),
    };

    const isNew = !existing;
    const saved = await Lead.findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true });
    let client = toClientLead(saved);
    if (lifecycle?.onLeadUpdated) {
      try {
        client = (await lifecycle.onLeadUpdated(exports, client, { reason: 'upsert' })) || client;
      } catch (e) {
        console.warn('[Leads] lifecycle upsert', e.message);
      }
    }
    await notifySheetsLead(client, isNew);
    return client;
  }

  const store = readFile();
  let existing = null;
  if (payload.externalId) {
    existing = store.leads.find(
      (l) => l.externalId === payload.externalId && l.channel === (payload.channel || 'manual')
    );
  }
  if (!existing && payload.id) existing = store.leads.find((l) => l.id === payload.id);

  const lead = {
    ...(existing || {}),
    id: existing?.id || id,
    channel: payload.channel || existing?.channel || 'manual',
    platform: payload.platform || existing?.platform || 'Web',
    externalId: payload.externalId ?? existing?.externalId,
    author: payload.author ?? existing?.author,
    customerComment: payload.customerComment ?? existing?.customerComment ?? '',
    temperature: payload.temperature || existing?.temperature || 'warm',
    score: payload.score ?? existing?.score ?? 50,
    intentSummary: payload.intentSummary ?? existing?.intentSummary ?? '',
    intent: payload.intent ?? existing?.intent,
    intentConfidence: payload.intentConfidence ?? existing?.intentConfidence,
    scoreBand: payload.scoreBand ?? existing?.scoreBand,
    nextBestAction: payload.nextBestAction ?? existing?.nextBestAction,
    scoreExplanation: payload.scoreExplanation ?? existing?.scoreExplanation,
    scoringVersion: payload.scoringVersion ?? existing?.scoringVersion,
    conversationState: payload.conversationState ?? existing?.conversationState ?? 'AI_ACTIVE',
    recommendedProduct: payload.recommendedProduct ?? existing?.recommendedProduct,
    suggestedReply: payload.suggestedReply ?? existing?.suggestedReply,
    status: payload.status || existing?.status || 'new',
    handoffReason: payload.handoffReason ?? existing?.handoffReason,
    handoffEmail: payload.handoffEmail ?? existing?.handoffEmail,
    mediaPermalink: payload.mediaPermalink ?? existing?.mediaPermalink,
    phone: payload.phone ?? existing?.phone,
    email: payload.email ?? existing?.email,
    lastEmailSubject: payload.lastEmailSubject ?? existing?.lastEmailSubject,
    igScopedId: payload.igScopedId ?? existing?.igScopedId,
    autoReplyPaused:
      payload.autoReplyPaused != null ? payload.autoReplyPaused : existing?.autoReplyPaused || false,
    lastMessageAt: (payload.lastMessageAt && new Date(payload.lastMessageAt).toISOString()) || now.toISOString(),
    createdAt: existing?.createdAt || now.toISOString(),
    followUps: payload.followUps ?? existing?.followUps ?? [],
    nextFollowUpAt: payload.nextFollowUpAt ?? existing?.nextFollowUpAt,
    lifecycleStage: payload.lifecycleStage ?? existing?.lifecycleStage ?? 'captured',
    reactivationEligible:
      payload.reactivationEligible != null
        ? payload.reactivationEligible
        : existing?.reactivationEligible || false,
    attribution: mergeAttribution(existing?.attribution, payload.attribution),
  };

  const isNew = !existing;
  store.leads = [lead, ...store.leads.filter((l) => l.id !== lead.id)].slice(0, 500);
  writeFile(store);
  let client = toClientLead(lead);
  if (lifecycle?.onLeadUpdated) {
    try {
      client = (await lifecycle.onLeadUpdated(exports, client, { reason: 'upsert' })) || client;
    } catch (e) {
      console.warn('[Leads] lifecycle upsert', e.message);
    }
  }
  await notifySheetsLead(client, isNew);
  return client;
}

async function updateLead(id, patch) {
  if (mongoReady()) {
    const saved = await Lead.findOneAndUpdate({ id }, { $set: patch }, { new: true });
    return toClientLead(saved);
  }
  const store = readFile();
  const idx = store.leads.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  store.leads[idx] = { ...store.leads[idx], ...patch };
  writeFile(store);
  return toClientLead(store.leads[idx]);
}

async function addMessage({ leadId, role, text, channelMessageId }) {
  const msg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    leadId,
    role,
    text,
    channelMessageId,
    createdAt: new Date().toISOString(),
  };

  if (mongoReady()) {
    await LeadMessage.create({ ...msg, createdAt: new Date(msg.createdAt) });
    await Lead.findOneAndUpdate({ id: leadId }, { lastMessageAt: new Date() });
    return toClientMessage(msg);
  }

  const store = readFile();
  store.messages = [...(store.messages || []), msg].slice(-5000);
  const lead = store.leads.find((l) => l.id === leadId);
  if (lead) lead.lastMessageAt = msg.createdAt;
  writeFile(store);
  return toClientMessage(msg);
}

async function getCounts() {
  const leads = await listLeads({ limit: 500 });
  return {
    hot: leads.filter((l) => l.temperature === 'hot').length,
    warm: leads.filter((l) => l.temperature === 'warm').length,
    cold: leads.filter((l) => l.temperature === 'cold').length,
    total: leads.length,
    handed_off: leads.filter((l) => l.status === 'handed_off').length,
  };
}

function buildHandoffPackage(lead, messages) {
  const transcript = (messages || [])
    .map((m) => {
      const who = m.role === 'customer' ? 'Customer' : m.role === 'human' ? 'Human' : 'Agent';
      return `${who}: ${m.text}`;
    })
    .join('\n');

  let brand = 'Tecavy';
  try {
    const ck = require('./companyKnowledge');
    brand = ck.getProfile().companyName || brand;
  } catch {
    /* ignore */
  }
  const email = lead.handoffEmail || process.env.LEAD_HANDOFF_EMAIL || 'specialists@tecavy.example';
  const subject = `${brand} lead handoff — ${lead.temperature?.toUpperCase() || 'LEAD'} · ${lead.author || lead.platform}`;
  const waLink = lead.phone
    ? `https://wa.me/${String(lead.phone).replace(/\D/g, '')}`
    : null;
  const igLink =
    lead.mediaPermalink ||
    (lead.igScopedId ? `https://www.instagram.com/direct/t/${lead.igScopedId}/` : null);

  const body = [
    `Hi ${brand} specialist,`,
    '',
    'Please continue this conversation so the customer does not repeat themselves.',
    '',
    `Channel: ${lead.channel} / ${lead.platform}`,
    `Author: ${lead.author || 'n/a'}`,
    `Temperature: ${lead.temperature} (${lead.score}${lead.scoreBand ? ` · ${lead.scoreBand}` : ''})`,
    `Status: ${lead.status}`,
    `Intent: ${lead.intent || 'n/a'} (${lead.intentSummary || 'n/a'})`,
    lead.nextBestAction ? `Next best action: ${lead.nextBestAction}` : null,
    lead.conversationState ? `Conversation state: ${lead.conversationState}` : null,
    `Product interest: ${lead.recommendedProduct || 'n/a'}`,
    `Handoff reason: ${lead.handoffReason || 'Needs human'}`,
    waLink ? `WhatsApp: ${waLink}` : null,
    igLink ? `Instagram: ${igLink}` : null,
    '',
    '—— Conversation ——',
    transcript || lead.customerComment || '(empty)',
    '—— End ——',
  ]
    .filter(Boolean)
    .join('\n');

  return { email, subject, body, waLink, igLink, transcript };
}

async function sendChannelReply(lead, text, { asHuman = true } = {}) {
  let channelResult = null;
  if (lead.channel === 'whatsapp' && lead.phone && replyDeps.whatsapp) {
    channelResult = await replyDeps.whatsapp.sendWhatsAppText(lead.phone, text);
  } else if (lead.channel === 'instagram' && lead.igScopedId && replyDeps.instagram) {
    channelResult = await replyDeps.instagram.sendInstagramDm(lead.igScopedId, text);
  } else if (lead.channel === 'email' && lead.email && replyDeps.email) {
    const subject = replyDeps.email.replySubject
      ? replyDeps.email.replySubject(lead)
      : `Re: ${lead.lastEmailSubject || 'Your inquiry'}`;
    channelResult = await replyDeps.email.sendEmail(lead.email, subject, text);
  }
  const role = asHuman ? 'human' : 'agent';
  const msg = await addMessage({ leadId: lead.id, role, text });
  const updated = await updateLead(lead.id, {
    status: asHuman ? 'contacted' : lead.status,
    lastMessageAt: new Date(),
    suggestedReply: text,
    lifecycleStage: 'engaged',
  });
  return { message: msg, lead: updated, channelResult, delivered: Boolean(channelResult) };
}

function mountRoutes(app, { requireAuth } = {}) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();

  if (lifecycle?.mountRoutes) {
    lifecycle.mountRoutes(app, exports, guard);
  }

  app.get('/api/leads', guard, async (req, res) => {
    try {
      const leads = await listLeads({
        temperature: req.query.temperature,
        status: req.query.status,
        channel: req.query.channel,
        limit: Number(req.query.limit) || 100,
      });
      const counts = await getCounts();
      res.json({ success: true, data: { leads, counts } });
    } catch (err) {
      console.error('[Leads] list', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/leads/counts', guard, async (_req, res) => {
    try {
      res.json({ success: true, data: await getCounts() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/leads/:id', guard, async (req, res) => {
    try {
      const lead = await getLead(req.params.id);
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      const messages = await getMessages(lead.id);
      res.json({ success: true, data: { lead, messages, handoff: buildHandoffPackage(lead, messages) } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/leads/:id/messages', guard, async (req, res) => {
    try {
      res.json({ success: true, data: await getMessages(req.params.id) });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leads', guard, async (req, res) => {
    try {
      const lead = await upsertLead(req.body || {});
      if (req.body?.initialMessage) {
        await addMessage({
          leadId: lead.id,
          role: 'customer',
          text: req.body.initialMessage,
        });
      }
      if (req.body?.agentMessage) {
        await addMessage({
          leadId: lead.id,
          role: 'agent',
          text: req.body.agentMessage,
        });
      }
      res.json({ success: true, data: lead });
    } catch (err) {
      console.error('[Leads] create', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/leads/:id', guard, async (req, res) => {
    try {
      const lead = await updateLead(req.params.id, req.body || {});
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      res.json({ success: true, data: lead });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leads/:id/messages', guard, async (req, res) => {
    try {
      const { role, text, channelMessageId } = req.body || {};
      if (!text || !role) {
        return res.status(400).json({ success: false, error: 'role and text required' });
      }
      const msg = await addMessage({
        leadId: req.params.id,
        role,
        text,
        channelMessageId,
      });
      res.json({ success: true, data: msg });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/leads/:id/handoff', guard, async (req, res) => {
    try {
      const lead = await getLead(req.params.id);
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      const messages = await getMessages(lead.id);
      res.json({ success: true, data: buildHandoffPackage(lead, messages) });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /** Pause auto-replies and return handoff package (email + deep links). */
  /** Return conversation to AI after human takeover (spec: release). */
  app.post('/api/leads/:id/release', guard, async (req, res) => {
    try {
      const lead = await updateLead(req.params.id, {
        autoReplyPaused: false,
        conversationState: 'AI_ACTIVE',
        status: req.body?.status || 'contacted',
      });
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      res.json({ success: true, data: { lead } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leads/:id/handoff', guard, async (req, res) => {
    try {
      const reason = req.body?.reason || 'Human closer requested';
      let lead = await updateLead(req.params.id, {
        status: 'handed_off',
        autoReplyPaused: true,
        conversationState: 'HUMAN_REQUIRED',
        handoffReason: reason,
      });
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      const messages = await getMessages(lead.id);
      const pack = buildHandoffPackage(lead, messages);
      res.json({ success: true, data: { lead, handoff: pack } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Reply on the lead's channel (WhatsApp / Instagram DM) or note-only for web/manual.
   * deps: { whatsapp, instagram } injected via setReplyDeps after modules load.
   */
  app.post('/api/leads/:id/reply', guard, async (req, res) => {
    try {
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ success: false, error: 'text required' });

      const lead = await getLead(req.params.id);
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

      const asHuman = req.body?.asHuman !== false;
      const result = await sendChannelReply(lead, text, { asHuman });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error('[Leads] reply', err.response?.data || err.message);
      res.status(500).json({
        success: false,
        error: err.response?.data?.error?.message || err.message,
      });
    }
  });
}

const replyDeps = { whatsapp: null, instagram: null, email: null };

function setReplyDeps(deps) {
  if (deps.whatsapp) replyDeps.whatsapp = deps.whatsapp;
  if (deps.instagram) replyDeps.instagram = deps.instagram;
  if (deps.email) replyDeps.email = deps.email;
}

module.exports = {
  mountRoutes,
  setReplyDeps,
  listLeads,
  getLead,
  getMessages,
  upsertLead,
  updateLead,
  addMessage,
  getCounts,
  buildHandoffPackage,
  mongoReady,
  sendChannelReply,
};
