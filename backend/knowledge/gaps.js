/**
 * Knowledge-gap tracking: every customer question the assistant could not answer from approved knowledge
 * (or could not answer safely because sources disagree) is recorded, grouped with similar questions,
 * and surfaced so the owner can turn the most-asked ones into FAQ answers.
 *
 * Stored per workspace. Customer text is redacted (emails, phone numbers, links) before it is saved.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const wsData = require('../workspaceData');
const workspaceContext = require('../workspaceContext');
const { tokenize } = require('../rag');

const FILE = (ws) => wsData.companyPath('knowledge-gaps.json', ws);
const MAX_CLUSTERS = 500;
const MAX_VARIANTS = 5;
const RESOLVED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const JACCARD_MATCH = 0.5;
// Measured on paraphrase groups vs unrelated questions (SEMANTIC_SIMILARITY task type): 0.70 merges 83% of
// true paraphrases and wrongly merges ~0.4% of unrelated pairs. Paraphrases of one ask typically score only
// 0.6-0.8, so embeddings alone under-merge; the model pass below finishes the job.
const SEMANTIC_MATCH = 0.7;
const SEMANTIC_CANDIDATES = 15;
const EMBED_CACHE_MAX = 300;
const CONSOLIDATE_DELAY_MS = 8000;
const CONSOLIDATE_MIN_CLUSTERS = 3;
const CONSOLIDATE_MAX_CLUSTERS = 40;

const GREETING_OR_CLOSER = /^(hi|hello|hey|hii+|thanks?|thank you|ok(ay)?|cool|great|nice|bye|good (morning|evening|afternoon)|yes|no|sure)\b[\s!.?]*$/i;

// Per-workspace write queue: read-modify-write on one JSON file must never interleave.
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
    return { clusters: Array.isArray(raw.clusters) ? raw.clusters : [], totalAsked: raw.totalAsked || 0 };
  } catch {
    return { clusters: [], totalAsked: 0 };
  }
}

function write(ws, data) {
  const file = FILE(ws);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/** Remove personal data a customer may have typed into a question before it is stored. */
function redact(text) {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/(\+?\d[\s().-]?){7,}/g, '[phone]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** Worth tracking? Skip greetings, thanks and one-word replies. */
function isTrackable(text) {
  const t = String(text || '').trim();
  if (!t || GREETING_OR_CLOSER.test(t)) return false;
  return t.includes('?') || tokenize(t).length >= 2;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

const embedCache = new Map();
async function embedForClustering(text) {
  const key = text.toLowerCase();
  if (embedCache.has(key)) return embedCache.get(key);
  const [v] = await require('./embeddings').embedTexts([text], 'SEMANTIC_SIMILARITY');
  embedCache.set(key, v);
  if (embedCache.size > EMBED_CACHE_MAX) embedCache.delete(embedCache.keys().next().value);
  return v;
}

async function findSemanticMatch(question, clusters) {
  try {
    const embeddings = require('./embeddings');
    if (!embeddings.isAvailable()) return null;
    const qv = await embedForClustering(question);
    let best = null;
    for (const c of clusters.slice(0, SEMANTIC_CANDIDATES)) {
      const sim = embeddings.cosine(qv, await embedForClustering(c.question));
      if (sim >= SEMANTIC_MATCH && (!best || sim > best.sim)) best = { c, sim };
    }
    return best ? best.c : null;
  } catch {
    return null; // semantic grouping is best-effort
  }
}

// --- Model pass: merge groups that are really the same question --------------------------------------

const consolidationTimers = new Map();

/** Merge `others` into `primary` (counts, channels, wording variants, timestamps). */
function mergeClusters(primary, others) {
  for (const o of others) {
    primary.count += o.count;
    for (const [ch, n] of Object.entries(o.channels)) primary.channels[ch] = (primary.channels[ch] || 0) + n;
    for (const v of [o.question, ...o.variants]) {
      if (v !== primary.question && !primary.variants.includes(v) && primary.variants.length < MAX_VARIANTS) primary.variants.push(v);
    }
    if (new Date(o.firstSeen) < new Date(primary.firstSeen)) primary.firstSeen = o.firstSeen;
    if (new Date(o.lastSeen) > new Date(primary.lastSeen)) primary.lastSeen = o.lastSeen;
  }
}

/**
 * Ask the model which open groups are the same underlying question (so one FAQ answer resolves all of them),
 * and merge them. Conservative by design: only clearly identical needs are merged.
 * @param {{ generateJson: Function }} [vertex] defaults to the shared Vertex client
 */
function consolidateGaps(vertex, ws) {
  const workspace = workspaceContext.resolve(ws);
  return serialized(workspace, async () => {
    const model = vertex || require('../vertexAi');
    const data = read(workspace);
    const open = sortOpen(data.clusters.filter((c) => c.status === 'open' && c.kind === 'missing')).slice(0, CONSOLIDATE_MAX_CLUSTERS);
    if (open.length < 2) return { merged: 0 };

    const { Type } = require('@google/genai');
    const schema = {
      type: Type.OBJECT,
      properties: { groups: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.INTEGER } } } },
      required: ['groups'],
    };
    const list = open.map((c, i) => `[${i}] ${c.question}${c.variants.length ? ` (also: ${c.variants.slice(0, 2).join(' / ')})` : ''}`).join('\n');
    const prompt = `These are customer questions a business could not answer. Group the ones that ask for THE SAME THING, meaning one single written answer would fully resolve every question in the group (different wording, same need).

Do NOT group questions that merely share a topic but need different answers (for example "do you accept Apple Pay" and "do you offer EMI" are different answers).

Return only groups with 2 or more members, as lists of the numbers. Each number may appear in at most one group. If nothing should be merged, return an empty list.

${list}`;
    let groups = [];
    try {
      const out = await require('./embeddings').withRetry(() => model.generateJson(prompt, schema, 'You group duplicate customer questions conservatively.', { thinkingLevel: 'MINIMAL' }));
      groups = Array.isArray(out?.groups) ? out.groups : [];
    } catch (err) {
      console.warn('[Gaps] consolidation failed:', err.message);
      return { merged: 0, error: err.message };
    }

    const used = new Set();
    let merged = 0;
    for (const group of groups) {
      const idxs = [...new Set(group)].filter((i) => Number.isInteger(i) && open[i] && !used.has(i));
      if (idxs.length < 2) continue;
      idxs.forEach((i) => used.add(i));
      const members = idxs.map((i) => open[i]).sort((a, b) => b.count - a.count);
      const [primary, ...rest] = members;
      mergeClusters(primary, rest);
      const gone = new Set(rest.map((r) => r.id));
      data.clusters = data.clusters.filter((c) => !gone.has(c.id));
      merged += rest.length;
    }
    if (merged) write(workspace, data);
    return { merged };
  });
}

/** Debounced: after a burst of new questions settles, run the model pass once. */
function scheduleConsolidation(workspace) {
  if (process.env.GAPS_CONSOLIDATE === 'off') return;
  clearTimeout(consolidationTimers.get(workspace));
  const timer = setTimeout(() => {
    consolidationTimers.delete(workspace);
    consolidateGaps(null, workspace).catch(() => undefined);
  }, CONSOLIDATE_DELAY_MS);
  timer.unref?.();
  consolidationTimers.set(workspace, timer);
}

/**
 * Record one unanswered question. Fire-and-forget safe: never throws.
 * @param {{ question: string, channel?: string, kind?: 'missing'|'conflict', detail?: string }} gap
 */
function recordGap({ question, channel = 'chat', kind = 'missing', detail = '' }, ws) {
  const workspace = workspaceContext.resolve(ws);
  const clean = redact(question);
  if (!isTrackable(clean)) return Promise.resolve(null);

  return serialized(workspace, async () => {
    const data = read(workspace);
    const now = new Date().toISOString();
    const tokens = new Set(tokenize(clean));

    const open = data.clusters.filter((c) => c.status === 'open' && c.kind === kind);
    let cluster = open.find((c) => jaccard(tokens, new Set(tokenize(c.question))) >= JACCARD_MATCH);
    if (!cluster) cluster = await findSemanticMatch(clean, open.sort((a, b) => b.count - a.count));

    if (cluster) {
      cluster.count += 1;
      cluster.lastSeen = now;
      cluster.channels[channel] = (cluster.channels[channel] || 0) + 1;
      if (!cluster.variants.includes(clean) && cluster.variants.length < MAX_VARIANTS && clean !== cluster.question) {
        cluster.variants.push(clean);
      }
      if (detail && !cluster.detail) cluster.detail = detail.slice(0, 300);
    } else {
      cluster = {
        id: `gap-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        kind,
        question: clean,
        variants: [],
        detail: detail.slice(0, 300),
        count: 1,
        firstSeen: now,
        lastSeen: now,
        channels: { [channel]: 1 },
        status: 'open',
      };
      data.clusters.unshift(cluster);
      if (kind === 'missing' && data.clusters.filter((c) => c.status === 'open' && c.kind === 'missing').length >= CONSOLIDATE_MIN_CLUSTERS) {
        scheduleConsolidation(workspace);
      }
    }
    data.totalAsked += 1;

    // Retention: drop old resolved/dismissed clusters, cap the list.
    const cutoff = Date.now() - RESOLVED_RETENTION_MS;
    data.clusters = data.clusters
      .filter((c) => c.status === 'open' || new Date(c.resolvedAt || c.lastSeen).getTime() > cutoff)
      .slice(0, MAX_CLUSTERS);
    write(workspace, data);
    return cluster.id;
  }).catch((err) => {
    console.warn('[Gaps] record failed:', err.message);
    return null;
  });
}

function sortOpen(clusters) {
  return clusters.sort((a, b) => b.count - a.count || new Date(b.lastSeen) - new Date(a.lastSeen));
}

function listGaps({ status = 'open', limit = 50 } = {}, ws) {
  const data = read(workspaceContext.resolve(ws));
  const rows = data.clusters.filter((c) => (status === 'all' ? true : c.status === status));
  return sortOpen(rows).slice(0, limit);
}

function getGap(id, ws) {
  return read(workspaceContext.resolve(ws)).clusters.find((c) => c.id === id) || null;
}

function summary(ws) {
  const data = read(workspaceContext.resolve(ws));
  const open = sortOpen(data.clusters.filter((c) => c.status === 'open'));
  return {
    open: open.length,
    openQuestions: open.reduce((n, c) => n + c.count, 0),
    resolved: data.clusters.filter((c) => c.status === 'resolved').length,
    totalAsked: data.totalAsked,
    top: open[0] ? { id: open[0].id, question: open[0].question, count: open[0].count } : null,
  };
}

function setStatus(id, status, resolution, ws) {
  const workspace = workspaceContext.resolve(ws);
  return serialized(workspace, async () => {
    const data = read(workspace);
    const cluster = data.clusters.find((c) => c.id === id);
    if (!cluster) return null;
    cluster.status = status;
    cluster.resolvedAt = new Date().toISOString();
    if (resolution) cluster.resolution = resolution;
    write(workspace, data);
    return cluster;
  });
}

const markResolved = (id, resolution, ws) => setStatus(id, 'resolved', resolution, ws);
const dismiss = (id, ws) => setStatus(id, 'dismissed', null, ws);

module.exports = { recordGap, consolidateGaps, listGaps, getGap, summary, markResolved, dismiss, redact, isTrackable };
