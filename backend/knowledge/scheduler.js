/**
 * Keeps website knowledge fresh: every day, re-read the sites of workspaces whose snapshot is older than a week,
 * replace it, and check the new content for contradictions. Set KNOWLEDGE_REFRESH=off to disable.
 */
const cron = require('node-cron');
const wsData = require('../workspaceData');

const MAX_AGE_DAYS = Number(process.env.KNOWLEDGE_REFRESH_DAYS || 7);
const DAY_MS = 24 * 60 * 60 * 1000;
let started = false;

/** Refresh every workspace whose website snapshot is missing or older than maxAgeDays. Returns per-workspace results. */
async function refreshStaleWebsites(vertex, { maxAgeDays = MAX_AGE_DAYS } = {}) {
  const ck = require('../companyKnowledge');
  return wsData.forEachWorkspace(async (ws) => {
    const profile = ck.getProfile(ws);
    if (!profile.websiteUrl) return { skipped: 'no website' };
    const doc = ck.listDocuments(ws).find((d) => d.source === 'website' && d.status === 'active');
    const ageDays = doc ? (Date.now() - new Date(doc.uploadedAt).getTime()) / DAY_MS : Infinity;
    if (ageDays < maxAgeDays) return { skipped: 'fresh' };
    const result = await ck.analyzeBusiness(vertex, { websiteUrl: profile.websiteUrl, refreshOnly: true, uploadedBy: 'scheduler' }, ws);
    if (result.docId && !result.unchanged) ck.reindexThenCheckConflicts(vertex, result.docId, ws);
    return { refreshed: true, unchanged: Boolean(result.unchanged), pages: result.sources.pages.length };
  });
}

function start({ vertex } = {}) {
  if (started || process.env.KNOWLEDGE_REFRESH === 'off') return;
  started = true;
  const expr = process.env.KNOWLEDGE_REFRESH_CRON || '30 3 * * *';
  if (!cron.validate(expr)) {
    console.warn('[Knowledge] invalid KNOWLEDGE_REFRESH_CRON, scheduler not started');
    return;
  }
  cron.schedule(expr, () => {
    refreshStaleWebsites(vertex).catch((err) => console.warn('[Knowledge] website refresh', err.message));
  });
  console.log('[Knowledge] website refresh scheduler active');
}

module.exports = { start, refreshStaleWebsites };
