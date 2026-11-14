const fs = require('fs');
const path = require('path');
const wsData = require('../workspaceData');
const crypto = require('crypto');

const PROMPTS_PATH = () => wsData.companyPath('seo-geo-geo-prompts.json');
const RUNS_PATH = () => wsData.companyPath('seo-geo-citation-runs.json');

function ensureDir() {
  const dir = path.dirname(PROMPTS_PATH());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readPrompts() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(PROMPTS_PATH(), 'utf8')).prompts || [];
  } catch {
    return [];
  }
}

function writePrompts(prompts) {
  ensureDir();
  fs.writeFileSync(PROMPTS_PATH(), JSON.stringify({ prompts, updatedAt: new Date().toISOString() }, null, 2));
}

function readRuns() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(RUNS_PATH(), 'utf8')).runs || [];
  } catch {
    return [];
  }
}

function appendRuns(newRuns) {
  const runs = [...newRuns, ...readRuns()].slice(0, 2000);
  ensureDir();
  fs.writeFileSync(RUNS_PATH(), JSON.stringify({ runs, updatedAt: new Date().toISOString() }, null, 2));
  return runs;
}

function addPrompt(text) {
  const prompts = readPrompts();
  const p = {
    id: `gp-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    prompt: String(text || '').trim(),
    createdAt: new Date().toISOString(),
  };
  if (!p.prompt) throw new Error('Prompt text required');
  prompts.push(p);
  writePrompts(prompts);
  return p;
}

function deletePrompt(id) {
  writePrompts(readPrompts().filter((p) => p.id !== id));
}

function extractUrls(text) {
  const re = /https?:\/\/[^\s)\]"'<>]+/gi;
  return [...new Set((String(text || '').match(re) || []).map((u) => u.replace(/[.,;]+$/, '')))];
}

function domainFromWebsite(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function runPromptTest(vertex, promptRow) {
  const ai = vertex?.runGeoCitationSample ? vertex : require('../vertexAi');
  if (!ai?.runGeoCitationSample) {
    throw new Error('Vertex AI not configured — set VERTEX_PROJECT_ID and use gcloud application-default login (same as other Nexora AI).');
  }
  const profile = require('../companyKnowledge').getProfile();
  const domain = domainFromWebsite(profile.websiteUrl || '');
  const company = profile.companyName || 'the business';

  let sample;
  try {
    sample = await ai.runGeoCitationSample(promptRow.prompt);
  } catch (err) {
    const formatted = ai.formatVertexError ? ai.formatVertexError(err) : err.message;
    throw new Error(formatted);
  }
  const { text, sources, queries, searched } = sample;

  // The search sources are redirect links whose title is the site's domain, so check both fields.
  const hostOf = (s) => String(s.title || '').toLowerCase().replace(/^www\./, '');
  const sourceHit = domain ? sources.some((s) => hostOf(s) === domain || hostOf(s).endsWith(`.${domain}`) || s.uri.includes(domain)) : false;
  const citedUrls = extractUrls(text);
  const domainCited = domain ? sourceHit || citedUrls.some((u) => u.includes(domain)) : false;
  const brandMentioned = company.length > 2 && new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

  return {
    id: `cr-${Date.now()}-${promptRow.id}`,
    promptId: promptRow.id,
    prompt: promptRow.prompt,
    runAt: new Date().toISOString(),
    answerExcerpt: String(text).slice(0, 1200),
    sources: sources.slice(0, 12).map((s) => ({ site: s.title || null })),
    searchQueries: queries.slice(0, 5),
    searched,
    citedUrls,
    domainCited,
    brandMentioned,
    sampledObservation: true,
    disclaimer: 'One live answer from Gemini with Google Search. Other AI tools and other days can differ.',
  };
}

async function runAllCitationTests(vertex) {
  const prompts = readPrompts();
  const results = [];
  for (const p of prompts) {
    try {
      results.push(await runPromptTest(vertex, p));
    } catch (err) {
      results.push({
        id: `cr-err-${Date.now()}`,
        promptId: p.id,
        prompt: p.prompt,
        runAt: new Date().toISOString(),
        error: err.message,
        sampledObservation: true,
      });
    }
  }
  appendRuns(results);
  return results;
}

function getCitationDashboard() {
  const prompts = readPrompts();
  const runs = readRuns();
  const byPrompt = {};
  for (const r of runs) {
    if (!byPrompt[r.promptId]) byPrompt[r.promptId] = [];
    byPrompt[r.promptId].push(r);
  }

  // Headline numbers use only the newest answer for each question, so old runs do not blur the current picture.
  let totalRuns = 0;
  let mentioned = 0;
  let linked = 0;
  const ownDomain = domainFromWebsite(require('../companyKnowledge').getProfile().websiteUrl || '');
  const siteCounts = new Map();
  for (const p of prompts) {
    const latest = (byPrompt[p.id] || []).find((r) => !r.error);
    if (!latest) continue;
    totalRuns += 1;
    if (latest.brandMentioned || latest.domainCited) mentioned += 1;
    if (latest.domainCited) linked += 1;
    for (const site of new Set((latest.sources || []).map((s) => String(s.site || '').toLowerCase().replace(/^www\./, '')).filter(Boolean))) {
      if (ownDomain && (site === ownDomain || site.endsWith(`.${ownDomain}`))) continue;
      siteCounts.set(site, (siteCounts.get(site) || 0) + 1);
    }
  }
  const topSources = [...siteCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([site, questions]) => ({ site, questions }));

  return {
    promptsTested: prompts.length,
    totalRuns,
    promptsMentioned: mentioned,
    promptsCitingSite: linked,
    mentionRate: totalRuns ? Math.round((mentioned / totalRuns) * 100) : 0,
    citationRate: totalRuns ? Math.round((linked / totalRuns) * 100) : 0,
    topSources,
    disclaimer: 'One live answer per question from Gemini with Google Search. Other AI tools and other days can differ.',
    prompts: prompts.map((p) => ({
      prompt: p,
      recentRuns: (byPrompt[p.id] || []).slice(0, 5),
    })),
  };
}

module.exports = {
  readPrompts,
  addPrompt,
  deletePrompt,
  runAllCitationTests,
  getCitationDashboard,
};
