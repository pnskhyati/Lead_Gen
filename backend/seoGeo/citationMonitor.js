const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROMPTS_PATH = path.join(__dirname, '..', 'data', 'company', 'seo-geo-geo-prompts.json');
const RUNS_PATH = path.join(__dirname, '..', 'data', 'company', 'seo-geo-citation-runs.json');

function ensureDir() {
  const dir = path.dirname(PROMPTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readPrompts() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8')).prompts || [];
  } catch {
    return [];
  }
}

function writePrompts(prompts) {
  ensureDir();
  fs.writeFileSync(PROMPTS_PATH, JSON.stringify({ prompts, updatedAt: new Date().toISOString() }, null, 2));
}

function readRuns() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(RUNS_PATH, 'utf8')).runs || [];
  } catch {
    return [];
  }
}

function appendRuns(newRuns) {
  const runs = [...newRuns, ...readRuns()].slice(0, 2000);
  ensureDir();
  fs.writeFileSync(RUNS_PATH, JSON.stringify({ runs, updatedAt: new Date().toISOString() }, null, 2));
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

  let text;
  try {
    text = await ai.runGeoCitationSample(promptRow.prompt, { companyName: company, domain });
  } catch (err) {
    const formatted = ai.formatVertexError ? ai.formatVertexError(err) : err.message;
    throw new Error(formatted);
  }

  const citedUrls = extractUrls(text);
  const domainCited = domain ? citedUrls.some((u) => u.includes(domain)) : false;
  const brandMentioned = company.length > 2 && new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

  return {
    id: `cr-${Date.now()}-${promptRow.id}`,
    promptId: promptRow.id,
    prompt: promptRow.prompt,
    runAt: new Date().toISOString(),
    answerExcerpt: String(text).slice(0, 1200),
    citedUrls,
    domainCited,
    brandMentioned,
    sampledObservation: true,
    disclaimer: 'Sampled AI response — answers vary by model, time, and platform.',
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

  let totalRuns = 0;
  let citingRuns = 0;
  const citedPages = new Set();

  for (const r of runs) {
    if (r.error) continue;
    totalRuns += 1;
    if (r.domainCited) citingRuns += 1;
    for (const u of r.citedUrls || []) {
      const profile = require('../companyKnowledge').getProfile();
      const domain = domainFromWebsite(profile.websiteUrl || '');
      if (domain && u.includes(domain)) citedPages.add(u);
    }
  }

  return {
    promptsTested: prompts.length,
    totalRuns,
    promptsCitingSite: citingRuns,
    citationRate: totalRuns ? Math.round((citingRuns / totalRuns) * 1000) / 10 : 0,
    uniqueCitedPages: citedPages.size,
    disclaimer: 'Illustrative sampled observations — not universal AI visibility.',
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
