/**
 * Conflicting-knowledge handling.
 *
 * When two sources state different facts about the same thing (an old and a new price list, a document and
 * an FAQ that disagree), the assistant must not quote either. Conflicts are detected after ingestion,
 * shown to the owner, and resolved by suppressing the wrong passage (or by confirming both are fine).
 *
 *   - Owner-written FAQs outrank documents automatically ("faq_wins"): they are the owner's explicit answer.
 *   - Everything else stays OPEN until a human decides; while open, retrieval flags the conflict so the
 *     agent hands off instead of guessing.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const wsData = require('../workspaceData');
const workspaceContext = require('../workspaceContext');

const FILE = (ws) => wsData.companyPath('knowledge-conflicts.json', ws);
const MAX_PAIRS_PER_CHECK = 15;
const MAX_NEW_CHUNKS_CHECKED = 40;
const MAX_CONFLICTS = 200;
const EXCERPT_CHARS = 320;

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
    return {
      conflicts: Array.isArray(raw.conflicts) ? raw.conflicts : [],
      suppressedChunkIds: Array.isArray(raw.suppressedChunkIds) ? raw.suppressedChunkIds : [],
    };
  } catch {
    return { conflicts: [], suppressedChunkIds: [] };
  }
}

function write(ws, data) {
  const file = FILE(ws);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const pairKey = (a, b) => [a, b].sort().join('||');
const isFaq = (chunk) => (chunk.tags || []).includes('faq');

/** Chunk ids the owner chose to drop (the losing side of a resolved conflict). */
function suppressedChunkIds(ws) {
  return new Set(read(workspaceContext.resolve(ws)).suppressedChunkIds);
}

function listConflicts({ status = 'open' } = {}, ws) {
  const rows = read(workspaceContext.resolve(ws)).conflicts;
  return rows.filter((c) => (status === 'all' ? true : c.status === status));
}

/** Open conflicts that involve any of these chunk ids (used at answer time to avoid quoting contested facts). */
function openForChunks(chunkIds, ws) {
  const ids = new Set(chunkIds);
  return read(workspaceContext.resolve(ws)).conflicts.filter(
    (c) => c.status === 'open' && (ids.has(c.a.chunkId) || ids.has(c.b.chunkId))
  );
}

function summary(ws) {
  const open = listConflicts({ status: 'open' }, ws);
  return { open: open.length, topics: open.slice(0, 3).map((c) => c.topic) };
}

function describe(chunk, docs) {
  const doc = chunk.sourceDocId ? docs.get(chunk.sourceDocId) : null;
  return {
    chunkId: chunk.id,
    docId: chunk.sourceDocId || null,
    source: isFaq(chunk) ? 'faq' : doc?.source === 'website' ? 'website' : 'document',
    title: isFaq(chunk) ? `FAQ: ${chunk.title}` : doc?.title || chunk.title,
    uploadedAt: doc?.uploadedAt || null,
    excerpt: chunk.text.replace(/\s+/g, ' ').slice(0, EXCERPT_CHARS),
  };
}

async function judgePairs(vertex, pairs) {
  const { Type } = require('@google/genai');
  const schema = {
    type: Type.OBJECT,
    properties: {
      conflicts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pair: { type: Type.INTEGER },
            topic: { type: Type.STRING },
            statementA: { type: Type.STRING },
            statementB: { type: Type.STRING },
            confidence: { type: Type.STRING },
          },
          required: ['pair', 'topic', 'statementA', 'statementB', 'confidence'],
        },
      },
    },
    required: ['conflicts'],
  };
  const body = pairs
    .map((p, i) => `### Pair ${i}\nSource A (${p.a.title}):\n${p.a.text}\n\nSource B (${p.b.title}):\n${p.b.text}`)
    .join('\n\n');
  const prompt = `Each pair below has two passages from one business's approved knowledge. Decide, per pair, whether they CONTRADICT each other.

A contradiction means: the same specific thing (a price, a duration, opening hours, a policy, availability, a phone number, an address) is stated with DIFFERENT values in the two passages, so a customer could be told two different answers.

NOT a contradiction: different wording of the same fact; one passage having more detail; passages about different things; a price range that contains the other price; information that is merely missing from one side.

Return only real contradictions with confidence "high". If unsure, leave the pair out.

${body}`;
  const out = await vertex.generateJson(prompt, schema, 'You are a strict fact-checker. Only flag clear contradictions.');
  return (out.conflicts || []).filter((c) => c.confidence === 'high' && Number.isInteger(c.pair) && pairs[c.pair]);
}

/**
 * Compare a newly added document against everything else and record contradictions.
 * @returns {Promise<{ checked: number, found: number }>}
 */
function detectConflicts(vertex, { docId }, ws) {
  const workspace = workspaceContext.resolve(ws);
  return serialized(workspace, async () => {
    const ck = require('../companyKnowledge');
    const rag = require('../rag');
    if (!vertex?.generateJson) return { checked: 0, found: 0 };

    const chunks = ck.getCompanyChunks(workspace);
    const docs = new Map(ck.listDocuments(workspace).map((d) => [d.id, d]));
    const byId = new Map(chunks.map((c) => [c.id, c]));
    const data = read(workspace);
    const known = new Set(data.conflicts.map((c) => pairKey(c.a.chunkId, c.b.chunkId)));

    const fresh = chunks.filter((c) => c.sourceDocId === docId).slice(0, MAX_NEW_CHUNKS_CHECKED);
    const pairs = [];
    const seen = new Set();
    for (const chunk of fresh) {
      const similar = rag.similarChunks(chunk, { ws: workspace, exclude: (c) => c.sourceDocId === docId, k: 3 });
      for (const hit of similar) {
        const other = byId.get(hit.chunk.id);
        if (!other) continue;
        const key = pairKey(chunk.id, other.id);
        if (seen.has(key) || known.has(key)) continue;
        seen.add(key);
        pairs.push({ a: chunk, b: other, strength: hit.cosine ?? hit.score });
      }
    }
    pairs.sort((x, y) => y.strength - x.strength);
    const candidates = pairs.slice(0, MAX_PAIRS_PER_CHECK).map((p) => ({
      a: { ...p.a, title: isFaq(p.a) ? `FAQ: ${p.a.title}` : docs.get(p.a.sourceDocId)?.title || p.a.title },
      b: { ...p.b, title: isFaq(p.b) ? `FAQ: ${p.b.title}` : docs.get(p.b.sourceDocId)?.title || p.b.title },
    }));
    if (!candidates.length) return { checked: 0, found: 0 };

    let verdicts = [];
    try {
      verdicts = await judgePairs(vertex, candidates);
    } catch (err) {
      console.warn('[Conflicts] judge failed:', err.message);
      return { checked: candidates.length, found: 0, error: err.message };
    }

    const now = new Date().toISOString();
    const created = [];
    for (const v of verdicts) {
      const { a, b } = candidates[v.pair];
      const da = describe(a, docs);
      const db = describe(b, docs);
      // The owner's own FAQ is authoritative over a document: no human decision needed.
      const faqWins = (da.source === 'faq') !== (db.source === 'faq');
      created.push({
        id: `cf-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        topic: String(v.topic || 'Conflicting information').slice(0, 120),
        statementA: String(v.statementA || '').slice(0, 200),
        statementB: String(v.statementB || '').slice(0, 200),
        a: da,
        b: db,
        status: faqWins ? 'resolved' : 'open',
        resolution: faqWins ? 'faq_wins' : null,
        detectedAt: now,
        resolvedAt: faqWins ? now : null,
      });
    }
    if (created.length) {
      const next = read(workspace);
      next.conflicts = [...created, ...next.conflicts].slice(0, MAX_CONFLICTS);
      write(workspace, next);
    }
    return { checked: candidates.length, found: created.filter((c) => c.status === 'open').length };
  });
}

/** keep: 'a' | 'b' (drop the other side's passage) | 'both' (both are valid, stop flagging). */
function resolveConflict(id, keep, ws) {
  const workspace = workspaceContext.resolve(ws);
  return serialized(workspace, async () => {
    if (!['a', 'b', 'both'].includes(keep)) throw new Error('keep must be "a", "b" or "both"');
    const data = read(workspace);
    const conflict = data.conflicts.find((c) => c.id === id);
    if (!conflict) return null;
    if (keep !== 'both') {
      const losing = keep === 'a' ? conflict.b.chunkId : conflict.a.chunkId;
      if (!data.suppressedChunkIds.includes(losing)) data.suppressedChunkIds.push(losing);
    }
    conflict.status = 'resolved';
    conflict.resolution = keep === 'both' ? 'both_valid' : `kept_${keep}`;
    conflict.resolvedAt = new Date().toISOString();
    write(workspace, data);
    return conflict;
  });
}

/** Restore a passage that was suppressed by mistake. */
function unsuppress(chunkId, ws) {
  const workspace = workspaceContext.resolve(ws);
  return serialized(workspace, async () => {
    const data = read(workspace);
    data.suppressedChunkIds = data.suppressedChunkIds.filter((c) => c !== chunkId);
    write(workspace, data);
  });
}

module.exports = {
  detectConflicts,
  resolveConflict,
  unsuppress,
  listConflicts,
  openForChunks,
  suppressedChunkIds,
  summary,
};
