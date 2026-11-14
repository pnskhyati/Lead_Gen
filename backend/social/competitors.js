/**
 * Owner-managed competitor list plus the insights learned from studying them.
 * The list is entered once; insights are refreshed weekly (and on demand) and feed every content plan.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const wsData = require('../workspaceData');
const workspaceContext = require('../workspaceContext');

const FILE = (ws) => wsData.companyPath('social-competitors.json', ws);
const MAX_COMPETITORS = 8;
const REFRESH_DAYS = Number(process.env.COMPETITOR_REFRESH_DAYS || 7);

const queues = new Map();
function serialized(ws, fn) {
  const prev = queues.get(ws) || Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(ws, next.catch(() => undefined));
  return next;
}

function read(ws) {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE(ws), 'utf8'));
    return { competitors: raw.competitors || [], insights: raw.insights || null };
  } catch {
    return { competitors: [], insights: null };
  }
}

function write(ws, data) {
  const file = FILE(ws);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/** Accepts @handles, profile URLs or plain names; keeps only short, printable text. */
function sanitizeCompetitor(c) {
  const name = clip(c?.name, 80);
  if (!name) return null;
  return {
    id: clip(c.id, 40) || `cmp-${crypto.randomBytes(4).toString('hex')}`,
    name,
    website: clip(c.website, 200),
    instagram: clip(c.instagram, 120),
    linkedin: clip(c.linkedin, 200),
    facebook: clip(c.facebook, 200),
    x: clip(c.x, 120),
  };
}

function getCompetitors(ws) {
  return read(workspaceContext.resolve(ws)).competitors;
}

function getInsights(ws) {
  return read(workspaceContext.resolve(ws)).insights;
}

/** Replace the whole list (the UI edits it as one form). Changing it marks insights as outdated. */
function setCompetitors(list, ws) {
  const workspace = workspaceContext.resolve(ws);
  return serialized(workspace, async () => {
    if (!Array.isArray(list)) throw new Error('competitors must be a list');
    const clean = list.map(sanitizeCompetitor).filter(Boolean).slice(0, MAX_COMPETITORS);
    const seen = new Set();
    const unique = clean.filter((c) => (seen.has(c.name.toLowerCase()) ? false : seen.add(c.name.toLowerCase())));
    const data = read(workspace);
    const before = JSON.stringify(data.competitors.map((c) => [c.name, c.instagram, c.linkedin, c.x, c.facebook, c.website]));
    data.competitors = unique;
    if (data.insights && before !== JSON.stringify(unique.map((c) => [c.name, c.instagram, c.linkedin, c.x, c.facebook, c.website]))) {
      data.insights.outdated = true;
    }
    write(workspace, data);
    return unique;
  });
}

const asList = (v, max) => (Array.isArray(v) ? v.map((x) => clip(x, 300)).filter(Boolean).slice(0, max) : []);

/**
 * Study the listed competitors (live web research) and store a compact, generation-ready summary.
 * @param {{ analyzeCompetitors: Function }} agent injectable for tests (defaults to the competitor agent)
 */
function analyze(vertex, ws, agent) {
  const workspace = workspaceContext.resolve(ws);
  return serialized(workspace, async () => {
    const data = read(workspace);
    if (!data.competitors.length) throw new Error('Add at least one competitor first');
    const run = agent?.analyzeCompetitors || require('../competitorAgent').analyzeCompetitors;
    const result = await run(vertex, {
      knownCompetitors: data.competitors.map((c) => c.name),
      socialProfiles: data.competitors.map((c) => ({ name: c.name, website: c.website, instagram: c.instagram, linkedin: c.linkedin, facebook: c.facebook, x: c.x })),
    });
    data.insights = {
      analyzedAt: new Date().toISOString(),
      outdated: false,
      confidence: result.dataConfidence || 'low',
      usedSearch: Boolean(result.usedSearch),
      summary: clip(result.summary, 1200),
      winningPatterns: (result.winningPatterns || []).slice(0, 8).map((p) => ({
        pattern: clip(p.pattern, 200),
        platforms: asList(p.platforms, 4),
        why: clip(p.whyAudienceLikesIt, 300),
        adapt: clip(p.howWeAdapt, 300),
      })),
      contentPillars: asList(result.contentPillars, 8),
      marketGaps: asList(result.marketGaps, 6),
      brandingRecommendations: asList(result.brandingRecommendations, 6),
      competitorsAnalyzed: data.competitors.map((c) => c.name),
    };
    write(workspace, data);
    return data.insights;
  });
}

/** Insights as a compact text block for generation prompts, or '' when there are none. */
function briefForPrompt(ws) {
  const i = getInsights(ws);
  if (!i) return '';
  const lines = [
    `COMPETITOR INSIGHTS (confidence: ${i.confidence}; studied: ${i.competitorsAnalyzed.join(', ')}):`,
    i.summary,
    i.winningPatterns.length ? `What works for them (adapt, never copy): ${i.winningPatterns.map((p) => `${p.pattern} (${p.why})`).join(' | ')}` : '',
    i.marketGaps.length ? `Gaps we can own: ${i.marketGaps.join('; ')}` : '',
    i.contentPillars.length ? `Content pillars in this market: ${i.contentPillars.join('; ')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** True when there is a list but no insights yet, or they are older than the refresh window / outdated. */
function needsRefresh(ws, now = Date.now()) {
  const { competitors, insights } = read(workspaceContext.resolve(ws));
  if (!competitors.length) return false;
  if (!insights || insights.outdated) return true;
  return now - new Date(insights.analyzedAt).getTime() > REFRESH_DAYS * 86_400_000;
}

module.exports = { MAX_COMPETITORS, getCompetitors, setCompetitors, getInsights, analyze, briefForPrompt, needsRefresh };
