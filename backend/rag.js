const fs = require('fs');
const path = require('path');

const DEFAULT_KB = path.join(__dirname, 'data', 'knowledge', 'nexora-lead-rag.json');

let cache = null;

function loadBaseChunks() {
  const file = process.env.LEAD_RAG_PATH
    ? path.resolve(process.env.LEAD_RAG_PATH)
    : DEFAULT_KB;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('[RAG] Failed to load base knowledge:', err.message);
    return [];
  }
}

function loadCompanyChunks() {
  try {
    return require('./companyKnowledge').getCompanyChunks();
  } catch {
    return [];
  }
}

function loadChunks() {
  if (cache) return cache;
  const base = loadBaseChunks();
  const company = loadCompanyChunks();
  // Company docs first so brand content wins ties in ranking boost
  cache = [...company, ...base];
  return cache;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s#&']/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Simple lexical RAG retrieve — no vector DB required */
function retrieve(query, { topK = 4 } = {}) {
  const chunks = loadChunks();
  const qTokens = new Set(tokenize(query));
  if (!qTokens.size) return chunks.slice(0, topK);

  const scored = chunks.map((chunk) => {
    const hay = tokenize(`${chunk.title} ${chunk.text} ${(chunk.tags || []).join(' ')}`);
    let score = 0;
    for (const t of hay) {
      if (qTokens.has(t)) score += 1;
    }
    for (const tag of chunk.tags || []) {
      const tagTokens = tokenize(tag);
      if (tagTokens.some((t) => qTokens.has(t))) score += 2;
    }
    // Prefer company-uploaded knowledge slightly
    if ((chunk.tags || []).includes('company') || chunk.sourceDocId) score += 0.5;
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}

/** Always return something useful — fall back to general docs when keywords miss */
function retrieveWithFallback(query, { topK = 4 } = {}) {
  const hits = retrieve(query, { topK });
  if (hits.length) return hits;
  const chunks = loadChunks();
  const companyFirst = chunks.filter((c) => (c.tags || []).includes('company'));
  if (companyFirst.length) return companyFirst.slice(0, topK);
  const preferred = ['occasions', 'johnnie-walker', 'brand-overview', 'support-scope', 'where-to-buy'];
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const fallback = preferred.map((id) => byId.get(id)).filter(Boolean);
  return (fallback.length ? fallback : chunks).slice(0, topK);
}

function formatContext(chunks) {
  if (!chunks.length) return 'No matching knowledge documents were retrieved.';
  return chunks
    .map((c, i) => `[Doc ${i + 1} | id=${c.id}] ${c.title}\n${c.text}`)
    .join('\n\n');
}

function listKnowledge() {
  return loadChunks().map(({ id, title, tags }) => ({ id, title, tags }));
}

function reload() {
  cache = null;
  return loadChunks().length;
}

module.exports = {
  retrieve,
  retrieveWithFallback,
  formatContext,
  listKnowledge,
  reload,
  loadChunks,
};
