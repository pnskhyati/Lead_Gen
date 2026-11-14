/**
 * Wires the growth features to the real app (leads, replies, SEO, competitors) and exposes them under /api/growth.
 */
const { Type } = require('@google/genai');
const workspaceContext = require('../workspaceContext');
const actions = require('./actions');
const appointments = require('./appointments');
const competitors = require('./competitors');
const autopilot = require('./autopilot');
const { computePerformance } = require('./performance');
const { computeSignals } = require('./signals');
const { store } = require('./store');

const DAY = 86_400_000;
const DRAFT_SCHEMA = { type: Type.OBJECT, properties: { text: { type: Type.STRING } }, required: ['text'] };

function createGrowth({ vertex, leadsCrm, getReplyItems, citationMonitor, pageWriter, suggestions, companyKnowledge, now = () => Date.now() }) {
  const profile = () => companyKnowledge.getProfile();

  async function draftFollowUp(lead) {
    if (!vertex?.generateJson) return '';
    const p = profile();
    const out = await vertex.generateJson(
      `Write a short, warm follow-up message (under 55 words) to a possible customer.\nBusiness: ${p.companyName || ''}. ${p.productsFocus || ''}\nPerson: ${lead.author || 'a visitor'} on ${lead.platform || lead.channel}.\nWhat they said: "${String(lead.customerComment || '').slice(0, 300)}"\nWhat we understood: ${lead.intentSummary || 'not clear'}\nRules: use only facts above, no prices, no promises, no links. Reference what they asked about, then invite a short call and ask which day suits them. Plain friendly words. Sign off with no name.`,
      DRAFT_SCHEMA,
      'You write concise, honest sales follow-ups for a small business. Never invent facts.',
      { thinkingLevel: 'LOW' }
    );
    return String(out?.text || '').trim();
  }

  async function radarSuggest() {
    const existing = (citationMonitor.readPrompts() || []).map((x) => x.prompt);
    const { suggestions: list } = await suggestions.suggest(vertex, { kind: 'questions', profile: profile(), existing });
    return list.filter((s) => s.intent === 'buy' || s.intent === 'compare').slice(0, 5).map((s) => s.text);
  }

  const gather = async (ws) => {
    const leads = await leadsCrm.listLeads({ limit: 500 });
    const followUps = leads.flatMap((l) => (l.followUps || []).map((f) => ({ ...f, leadId: l.id })));
    return { leads, followUps, replies: getReplyItems(ws), prompts: citationMonitor.getCitationDashboard().prompts };
  };

  async function cycleDeps(ws) {
    return {
      vertex,
      now,
      profile: profile(),
      draftFollowUp,
      radarSuggest,
      scanCompetitors: () => competitors.scan({ vertex }, ws),
      leads: async () => (await gather(ws)).leads,
      followUps: async () => (await gather(ws)).followUps,
      replies: async () => getReplyItems(ws),
      prompts: async () => citationMonitor.getCitationDashboard().prompts,
    };
  }

  const actionDeps = {
    sendLeadReply: async (leadId, text) => {
      const lead = await leadsCrm.getLead(leadId);
      if (!lead) throw new Error('That lead no longer exists.');
      return leadsCrm.sendChannelReply(lead, text, { asHuman: true });
    },
    addPrompt: (p) => citationMonitor.addPrompt(p),
    writePage: (topic, kind) => pageWriter.write(vertex, { topic, kind, profile: profile() }),
  };

  async function runForWorkspace(ws) {
    return workspaceContext.run(ws, async () => autopilot.runCycle(await cycleDeps(ws), ws));
  }

  async function tick() {
    for (const ws of autopilot.workspaceIds()) {
      if (!autopilot.isDue(autopilot.getSettings(ws), now())) continue;
      try {
        await runForWorkspace(ws);
      } catch (err) {
        console.warn(`[Autopilot:${ws}]`, err.message);
      }
    }
  }

  let timer = null;
  function start(everyMs = 15 * 60_000) {
    if (process.env.AUTOPILOT === 'off' || timer) return;
    timer = setInterval(() => void tick(), everyMs);
    timer.unref?.();
  }

  function mountRoutes(app, { requireAuth, requireAdmin }) {
    const guard = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();
    const admin = typeof requireAdmin === 'function' ? requireAdmin : (_r, _s, n) => n();
    const ws = (req) => req.appUser?.workspaceId;
    const ok = (res, data) => res.json({ success: true, data });
    const fail = (res, err, code = 400) => res.status(code).json({ success: false, error: err.message || String(err) });
    const wrap = (fn) => async (req, res) => {
      try {
        ok(res, await fn(req));
      } catch (err) {
        fail(res, err);
      }
    };

    app.get('/api/growth/signals', guard, wrap(async (req) => {
      const g = await gather(ws(req));
      const s = store.read(ws(req));
      const month = computePerformance({ leads: g.leads, requests: s.appointments.requests, since: now() - 30 * DAY });
      return computeSignals({ ...g, requests: s.appointments.requests, visibilityPrompts: g.prompts, competitorChanges: s.competitors.changes, performance: month, now: now() });
    }));

    app.get('/api/growth/performance', guard, wrap(async (req) => {
      const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
      const leads = await leadsCrm.listLeads({ limit: 500 });
      return { days, ...computePerformance({ leads, requests: store.read(ws(req)).appointments.requests, since: now() - days * DAY }) };
    }));

    app.get('/api/growth/actions', guard, wrap(async (req) => actions.list(ws(req), req.query.status)));
    app.post('/api/growth/actions/refresh', guard, admin, wrap(async (req) => {
      const w = ws(req);
      const leads = await leadsCrm.listLeads({ limit: 500 });
      const s = store.read(w);
      const proposals = await actions.recommend({ leads, competitorChanges: s.competitors.changes, performance: computePerformance({ leads, requests: s.appointments.requests, since: now() - 30 * DAY }), profile: profile(), draftFollowUp });
      return { added: proposals.map((p) => actions.add(p, w, now())).filter(Boolean).length };
    }));
    app.post('/api/growth/actions/:id/approve', guard, admin, wrap(async (req) => actions.approve(req.params.id, { text: typeof req.body?.text === 'string' ? req.body.text : undefined }, actionDeps, ws(req))));
    app.post('/api/growth/actions/:id/dismiss', guard, admin, wrap(async (req) => actions.dismiss(req.params.id, ws(req))));

    app.get('/api/growth/appointments', guard, wrap(async (req) => {
      const settings = appointments.getSettings(ws(req));
      const requests = appointments.listRequests(ws(req));
      const slots = appointments.getSlots({ settings, requests, now: now() }).map((iso) => ({ iso, label: appointments.formatSlot(iso, settings.utcOffsetMinutes) }));
      return { settings, requests, slots };
    }));
    app.put('/api/growth/appointments/settings', guard, admin, wrap(async (req) => appointments.saveSettings(req.body || {}, ws(req))));
    app.post('/api/growth/appointments/:id/confirm', guard, admin, wrap(async (req) => {
      const result = appointments.confirm(req.params.id, req.body?.slot, { now: now(), companyName: profile().companyName || 'us' }, ws(req));
      let delivered = false;
      if (result.request.leadId) {
        try {
          const r = await actionDeps.sendLeadReply(result.request.leadId, result.message);
          delivered = Boolean(r?.delivered);
        } catch {
          delivered = false;
        }
      }
      return { ...result, delivered };
    }));
    app.post('/api/growth/appointments/:id/decline', guard, admin, wrap(async (req) => appointments.decline(req.params.id, ws(req))));

    app.get('/api/growth/competitors', guard, wrap(async (req) => ({ list: competitors.list(ws(req)), changes: competitors.changes(ws(req)) })));
    app.post('/api/growth/competitors', guard, admin, wrap(async (req) => competitors.add({ url: req.body?.url, label: req.body?.label }, ws(req))));
    app.delete('/api/growth/competitors/:id', guard, admin, wrap(async (req) => { competitors.remove(req.params.id, ws(req)); return { removed: true }; }));
    app.post('/api/growth/competitors/scan', guard, admin, wrap(async (req) => ({ changes: await competitors.scan({ vertex }, ws(req)) })));
    app.post('/api/growth/competitors/changes/:id/seen', guard, wrap(async (req) => { competitors.markSeen(req.params.id, ws(req)); return { seen: true }; }));

    app.get('/api/growth/autopilot', guard, wrap(async (req) => autopilot.getSettings(ws(req))));
    app.put('/api/growth/autopilot', guard, admin, wrap(async (req) => autopilot.saveSettings(req.body || {}, ws(req))));
    app.post('/api/growth/autopilot/run', guard, admin, wrap(async (req) => {
      const r = await runForWorkspace(ws(req));
      return { brief: r.brief, added: r.added.length };
    }));
  }

  return { mountRoutes, start, tick, runForWorkspace, draftFollowUp };
}

module.exports = { createGrowth };
