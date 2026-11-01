/**
 * Lead lifecycle: qualify → schedule follow-up → reactivate dormant leads.
 * Persists followUps[] on each CRM lead (Mongo + file store via leadsCrm.updateLead).
 */
const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

const FOLLOWUP_HOURS = { hot: 24, warm: 48, cold: 72, very_hot: 12 };
const DORMANT_DAYS = 7;
const REACTIVATION_DAYS = 14;

function brandName() {
  try {
    const ck = require('./companyKnowledge');
    return ck.getProfile?.().companyName || 'our team';
  } catch {
    return 'our team';
  }
}

function newFollowUpId() {
  return `fu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function channelLabel(lead) {
  const ch = lead.channel || lead.source || 'manual';
  if (ch === 'whatsapp') return 'WhatsApp';
  if (ch === 'instagram') return 'Instagram';
  if (ch === 'facebook') return 'Facebook';
  if (ch === 'email') return 'Email';
  if (ch === 'web') return 'Website';
  return 'Manual';
}

function buildFollowUpDraft(lead, taskTitle) {
  const name = (lead.author || 'there').split(' ')[0];
  const nba = lead.nextBestAction ? ` ${lead.nextBestAction}.` : '';
  return `Hi ${name}, following up from ${brandName()}.${nba} Would you like to continue the conversation?`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function bucketForDue(dueIso) {
  const due = new Date(dueIso);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  if (due < todayStart) return 'overdue';
  if (due <= todayEnd) return 'today';
  return 'upcoming';
}

function badgeForBucket(bucket, dueIso) {
  if (bucket === 'overdue') {
    const days = Math.max(1, Math.floor((startOfDay(new Date()) - startOfDay(new Date(dueIso))) / MS_DAY));
    return `⏰ ${days} day${days === 1 ? '' : 's'} overdue`;
  }
  if (bucket === 'today') return '📅 Due today';
  const days = Math.max(1, Math.ceil((new Date(dueIso) - new Date()) / MS_DAY));
  return `🗓 Upcoming (in ${days} day${days === 1 ? '' : 's'})`;
}

function normalizeFollowUps(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f) => f && f.id);
}

function hasPendingType(followUps, type) {
  return followUps.some((f) => f.status === 'pending' && f.type === type);
}

function hoursUntilFollowUp(lead) {
  const band = lead.scoreBand || lead.temperature || 'warm';
  if (band === 'very_hot' || lead.temperature === 'hot') return FOLLOWUP_HOURS.hot;
  if (lead.temperature === 'cold') return FOLLOWUP_HOURS.cold;
  return FOLLOWUP_HOURS.warm;
}

/**
 * After capture / engage / qualify — ensure a pending follow-up exists.
 */
async function onLeadUpdated(leadsCrm, lead, { reason } = {}) {
  if (!lead || lead.status === 'closed') return lead;

  let followUps = normalizeFollowUps(lead.followUps);
  const patch = { lifecycleStage: lead.lifecycleStage || 'captured' };

  const score = lead.score ?? 0;
  if (score >= 70 || lead.status === 'qualified') patch.lifecycleStage = 'qualified';
  else if (lead.suggestedReply || lead.lastMessageAt) patch.lifecycleStage = 'engaged';

  if (!lead.autoReplyPaused && lead.status !== 'handed_off' && !hasPendingType(followUps, 'follow_up')) {
    const title = lead.nextBestAction || 'Follow up on conversation';
    const dueAt = new Date(Date.now() + hoursUntilFollowUp(lead) * MS_HOUR).toISOString();
    followUps = [
      {
        id: newFollowUpId(),
        type: 'follow_up',
        status: 'pending',
        title,
        draft: buildFollowUpDraft(lead, title),
        dueAt,
        channel: lead.channel || 'manual',
        owner: lead.autoReplyPaused ? 'human' : 'ai',
        createdAt: new Date().toISOString(),
        reason: reason || 'auto_after_engagement',
      },
      ...followUps,
    ].slice(0, 20);
    patch.followUps = followUps;
    patch.nextFollowUpAt = dueAt;
  }

  const lastAt = lead.lastMessageAt ? new Date(lead.lastMessageAt).getTime() : 0;
  const dormantMs = DORMANT_DAYS * MS_DAY;
  if (
    lastAt &&
    Date.now() - lastAt > dormantMs &&
    lead.status !== 'closed' &&
    !hasPendingType(followUps, 'reactivation')
  ) {
    const title = 'Re-engage dormant lead';
    const dueAt = new Date().toISOString();
    const reactivation = {
      id: newFollowUpId(),
      type: 'reactivation',
      status: 'pending',
      title,
      draft: `Hi ${(lead.author || 'there').split(' ')[0]}, we noticed it has been a while since we connected. Still interested in learning more from ${brandName()}?`,
      dueAt,
      channel: lead.channel || 'manual',
      owner: 'ai',
      createdAt: new Date().toISOString(),
      reason: 'dormant_detected',
    };
    followUps = [reactivation, ...followUps].slice(0, 20);
    patch.followUps = followUps;
    patch.reactivationEligible = true;
    patch.nextFollowUpAt = patch.nextFollowUpAt || dueAt;
    patch.lifecycleStage = 'dormant';
  }

  if (Object.keys(patch).length <= 1 && !patch.followUps) return lead;
  return leadsCrm.updateLead(lead.id, patch);
}

function flattenQueue(leads) {
  const rows = [];
  for (const lead of leads) {
    const followUps = normalizeFollowUps(lead.followUps);
    for (const fu of followUps) {
      if (fu.status !== 'pending' && fu.status !== 'done') continue;
      const bucket = fu.status === 'done' ? 'done' : bucketForDue(fu.dueAt);
      rows.push({
        id: fu.id,
        leadId: lead.id,
        status: bucket,
        badge: fu.status === 'done' ? '✓ Completed' : badgeForBucket(bucket, fu.dueAt),
        company: lead.platform || lead.channel || 'Inbound',
        contactName: lead.author || lead.phone || 'Lead',
        channel: channelLabel(lead),
        owner: fu.owner === 'ai' ? '🤖 AI' : '👤 You',
        task: fu.title,
        draft: fu.draft || '',
        dueAt: fu.dueAt,
        type: fu.type,
        temperature: lead.temperature,
        score: lead.score,
      });
    }
  }
  const order = { overdue: 0, today: 1, upcoming: 2, done: 3 };
  rows.sort((a, b) => {
    const o = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    if (o !== 0) return o;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
  return rows;
}

async function getFollowUpQueue(leadsCrm) {
  const leads = await leadsCrm.listLeads({ limit: 500 });
  return flattenQueue(leads);
}

async function addFollowUp(leadsCrm, leadId, body) {
  const lead = await leadsCrm.getLead(leadId);
  if (!lead) return null;
  const followUps = normalizeFollowUps(lead.followUps);
  const dueAt = body.dueAt || new Date(Date.now() + 24 * MS_HOUR).toISOString();
  const fu = {
    id: newFollowUpId(),
    type: body.type || 'follow_up',
    status: 'pending',
    title: body.title || 'Follow up',
    draft: body.draft || buildFollowUpDraft(lead, body.title || 'Follow up'),
    dueAt,
    channel: lead.channel || 'manual',
    owner: body.owner || 'human',
    createdAt: new Date().toISOString(),
  };
  followUps.unshift(fu);
  return leadsCrm.updateLead(leadId, { followUps, nextFollowUpAt: dueAt });
}

async function patchFollowUp(leadsCrm, leadId, fuId, patch) {
  const lead = await leadsCrm.getLead(leadId);
  if (!lead) return null;
  const followUps = normalizeFollowUps(lead.followUps).map((f) =>
    f.id === fuId ? { ...f, ...patch, updatedAt: new Date().toISOString() } : f
  );
  const nextPending = followUps
    .filter((f) => f.status === 'pending')
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0];
  return leadsCrm.updateLead(leadId, {
    followUps,
    nextFollowUpAt: nextPending?.dueAt || null,
    ...(patch.status === 'done' && patch.type === 'reactivation' ? { lifecycleStage: 'reactivated' } : {}),
  });
}

async function executeFollowUp(leadsCrm, leadId, fuId, { send = true, text } = {}) {
  const lead = await leadsCrm.getLead(leadId);
  if (!lead) return { error: 'Lead not found' };
  const fu = normalizeFollowUps(lead.followUps).find((f) => f.id === fuId);
  if (!fu) return { error: 'Follow-up not found' };

  const message = String(text || fu.draft || '').trim();
  if (!message) return { error: 'Empty message' };

  let delivery = null;
  if (send && !lead.autoReplyPaused && lead.status !== 'handed_off') {
    delivery = await leadsCrm.sendChannelReply(lead, message, { asHuman: fu.owner !== 'ai' });
  } else {
    await leadsCrm.addMessage({ leadId, role: fu.owner === 'ai' ? 'agent' : 'human', text: message });
    await leadsCrm.updateLead(leadId, { lastMessageAt: new Date(), status: 'contacted' });
  }

  await patchFollowUp(leadsCrm, leadId, fuId, {
    status: 'done',
    completedAt: new Date().toISOString(),
    sentText: message,
  });

  const updated = await leadsCrm.getLead(leadId);
  return { lead: updated, followUpId: fuId, delivery };
}

async function scanAllLeads(leadsCrm) {
  const leads = await leadsCrm.listLeads({ limit: 500 });
  let updated = 0;
  for (const lead of leads) {
    const next = await onLeadUpdated(leadsCrm, lead, { reason: 'lifecycle_scan' });
    if (next && next.id) updated += 1;
  }
  return { scanned: leads.length, touched: updated };
}

async function processDueFollowUps(leadsCrm) {
  const leads = await leadsCrm.listLeads({ limit: 500 });
  const now = Date.now();
  const results = [];
  for (const lead of leads) {
    if (lead.autoReplyPaused || lead.status === 'handed_off' || lead.status === 'closed') continue;
    const pending = normalizeFollowUps(lead.followUps).filter(
      (f) => f.status === 'pending' && f.owner === 'ai' && new Date(f.dueAt).getTime() <= now
    );
    for (const fu of pending.slice(0, 2)) {
      try {
        const out = await executeFollowUp(leadsCrm, lead.id, fu.id, { send: true });
        results.push({ leadId: lead.id, followUpId: fu.id, ok: !out.error, type: fu.type });
      } catch (err) {
        results.push({ leadId: lead.id, followUpId: fu.id, ok: false, error: err.message });
      }
    }
  }
  return results;
}

function pipelineSummary(leads) {
  const channels = { whatsapp: 0, instagram: 0, facebook: 0, email: 0, web: 0, manual: 0 };
  const stages = { captured: 0, engaged: 0, qualified: 0, dormant: 0, reactivated: 0 };
  for (const l of leads) {
    const ch = l.channel || 'manual';
    if (channels[ch] != null) channels[ch] += 1;
    else channels.manual += 1;
    const stage = l.lifecycleStage || 'captured';
    if (stages[stage] != null) stages[stage] += 1;
    else stages.captured += 1;
  }
  const queue = flattenQueue(leads);
  return {
    channels,
    stages,
    pendingFollowUps: queue.filter((q) => q.status !== 'done').length,
    overdueFollowUps: queue.filter((q) => q.status === 'overdue').length,
    reactivationPending: queue.filter((q) => q.type === 'reactivation' && q.status !== 'done').length,
  };
}

function mountRoutes(app, leadsCrm, guard) {
  app.get('/api/leads/follow-ups/queue', guard, async (_req, res) => {
    try {
      const queue = await getFollowUpQueue(leadsCrm);
      const leads = await leadsCrm.listLeads({ limit: 500 });
      res.json({ success: true, data: { queue, summary: pipelineSummary(leads) } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/leads/lifecycle/summary', guard, async (_req, res) => {
    try {
      const leads = await leadsCrm.listLeads({ limit: 500 });
      res.json({ success: true, data: pipelineSummary(leads) });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leads/lifecycle/scan', guard, async (_req, res) => {
    try {
      const data = await scanAllLeads(leadsCrm);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leads/lifecycle/process-due', guard, async (_req, res) => {
    try {
      const results = await processDueFollowUps(leadsCrm);
      res.json({ success: true, data: { results } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leads/:id/follow-ups', guard, async (req, res) => {
    try {
      const lead = await addFollowUp(leadsCrm, req.params.id, req.body || {});
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      res.json({ success: true, data: lead });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/leads/:id/follow-ups/:fuId', guard, async (req, res) => {
    try {
      const lead = await patchFollowUp(leadsCrm, req.params.id, req.params.fuId, req.body || {});
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      res.json({ success: true, data: lead });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leads/:id/follow-ups/:fuId/execute', guard, async (req, res) => {
    try {
      const out = await executeFollowUp(leadsCrm, req.params.id, req.params.fuId, req.body || {});
      if (out.error) return res.status(400).json({ success: false, error: out.error });
      res.json({ success: true, data: out });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  onLeadUpdated,
  getFollowUpQueue,
  processDueFollowUps,
  scanAllLeads,
  pipelineSummary,
  mountRoutes,
  DORMANT_DAYS,
  REACTIVATION_DAYS,
};
