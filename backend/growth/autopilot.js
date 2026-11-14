/**
 * Marketing autopilot: given a goal, it works through a cycle on a schedule: reads the market and the leads, notices what
 * needs attention, proposes actions, and writes a short brief. It only PROPOSES. Every action waits for approval.
 */
const { store } = require('./store');
const actions = require('./actions');
const { computePerformance } = require('./performance');
const { computeSignals } = require('./signals');

const HOUR = 3_600_000;
const DAY = 86_400_000;
const RADAR_EVERY_MS = 7 * DAY;

function getSettings(ws) {
  return store.read(ws).autopilot;
}

function saveSettings(patch, ws) {
  store.update((s) => {
    const a = s.autopilot;
    if (patch.enabled !== undefined) a.enabled = Boolean(patch.enabled);
    if (patch.goal !== undefined) a.goal = String(patch.goal).trim().slice(0, 300);
    if (patch.targetQualified !== undefined) a.targetQualified = Math.max(0, Math.min(100000, Math.round(Number(patch.targetQualified) || 0)));
    if (patch.cadenceHours !== undefined) a.cadenceHours = Math.max(1, Math.min(168, Math.round(Number(patch.cadenceHours) || 24)));
  }, ws);
  return getSettings(ws);
}

function workspaceIds() {
  return store.entries().filter(([, s]) => s.autopilot?.enabled).map(([id]) => id);
}

function isDue(settings, now) {
  if (!settings.enabled) return false;
  return !settings.lastRunAt || now - new Date(settings.lastRunAt).getTime() >= settings.cadenceHours * HOUR;
}

/**
 * One pass. `deps`: vertex, leads(), followUps(), replies(), prompts() (citation dashboard prompts), profile, now,
 * scanCompetitors(), radarSuggest(existing), draftFollowUp(lead).
 */
async function runCycle(deps, ws) {
  const now = deps.now ? deps.now() : Date.now();
  const settings = getSettings(ws);
  const notes = [];

  let newChanges = [];
  try {
    newChanges = await deps.scanCompetitors();
  } catch (err) {
    notes.push(`Competitor check skipped: ${err.message}`);
  }

  // Demand radar: once a week, look for questions buyers may ask AI about this kind of business.
  let radar = null;
  if (!settings.lastRadarAt || now - new Date(settings.lastRadarAt).getTime() >= RADAR_EVERY_MS) {
    try {
      const phrases = await deps.radarSuggest();
      if (phrases.length) radar = { phrases };
      store.update((s) => {
        s.autopilot.lastRadarAt = new Date(now).toISOString();
      }, ws);
    } catch (err) {
      notes.push(`Demand radar skipped: ${err.message}`);
    }
  }

  const [leads, followUps, replies, prompts] = await Promise.all([deps.leads(), deps.followUps(), deps.replies(), deps.prompts()]);
  const requests = store.read(ws).appointments.requests;
  const month = computePerformance({ leads, requests, since: now - 30 * DAY });
  const competitorChanges = store.read(ws).competitors.changes;
  const signals = computeSignals({ leads, followUps, replies, requests, visibilityPrompts: prompts, competitorChanges, performance: month, now });

  const proposals = await actions.recommend({ leads, competitorChanges, radar, performance: month, profile: deps.profile, draftFollowUp: deps.draftFollowUp });
  const added = proposals.map((p) => actions.add(p, ws, now)).filter(Boolean);

  const lines = [];
  if (!leads.length) lines.push('No leads yet. Connect a channel and share your posts to start collecting them.');
  else lines.push(`${month.total} new leads in the last 30 days, ${month.qualified} qualified${month.booked ? `, ${month.booked} booked` : ''}${month.won ? `, ${month.won} won` : ''}.`);
  for (const s of signals.slice(0, 5)) lines.push(s.text + '.');
  if (newChanges.length) lines.push(`${newChanges.length} competitor page${newChanges.length === 1 ? '' : 's'} changed since the last check.`);
  if (added.length) lines.push(`${added.length} new suggested action${added.length === 1 ? '' : 's'} are waiting for your approval.`);
  else lines.push('No new actions this time. Everything suggested earlier is already waiting or was handled.');

  let goalProgress = null;
  if (settings.targetQualified > 0) {
    const pct = Math.round((month.qualified / settings.targetQualified) * 100);
    goalProgress = { target: settings.targetQualified, qualified: month.qualified, percent: pct, text: `${month.qualified} of ${settings.targetQualified} qualified leads in the last 30 days (${pct}%).` };
  }

  const brief = { generatedAt: new Date(now).toISOString(), goal: settings.goal || null, goalProgress, lines, notes, actionsAdded: added.length };
  store.update((s) => {
    s.autopilot.lastRunAt = new Date(now).toISOString();
    s.autopilot.brief = brief;
  }, ws);
  return { brief, signals, performance: month, added };
}

module.exports = { getSettings, saveSettings, runCycle, workspaceIds, isDue };
