/**
 * Company knowledge retrieval — per-workspace hybrid search.
 *
 *  - BM25 over title/tags/text (stopwords + light stemming) always works, no external service.
 *  - When embeddings are available (Vertex), semantic rank is fused with BM25 via reciprocal rank fusion,
 *    so "braces" can find a chunk about "orthodontics".
 *  - search() reports `grounded`: whether the knowledge base actually covers the question.
 *    Agents use it to hand off instead of guessing.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const embeddings = require('./knowledge/embeddings');
const workspaceContext = require('./workspaceContext');

const DEFAULT_WORKSPACE = workspaceContext.DEFAULT_WORKSPACE;
const DEFAULT_KB = path.join(__dirname, 'data', 'knowledge', 'nexora-lead-rag.json');
// Calibrated with knowledge/eval.js on 100 labelled questions from two unrelated businesses (a dental clinic
// and a yoga studio, text-embedding-005). Scoring each dataset with thresholds tuned on the other one:
//   passage similarity + keyword coverage only ........ 78% precision / 88% recall (14 wrong "I can answer")
//   + generated customer questions + model check ...... 95% precision / 96% recall (3 wrong)
// Pooled defaults below: 0 wrong answers and 2 misses in 100. Precision is favoured on purpose: a confident
// wrong answer costs more than a handoff. The keyword-coverage shortcut is OFF in hybrid mode because it
// was the source of every remaining false answer ("price of a 6 month plan" shares all its words with a
// price list that has no 6-month plan). Keyword-only mode (no embeddings) still uses coverage >= 0.30.
// Re-run `npm run eval:rag --prefix backend` on your own documents before changing these.
const MIN_SIMILARITY = Number(process.env.RAG_MIN_SIMILARITY || 0.66);
const MIN_COVERAGE_HYBRID = Number(process.env.RAG_MIN_COVERAGE || 1.01);
const MIN_COVERAGE_KEYWORD = 0.3;

// Recall helpers (see knowledge/eval.js for how these were chosen):
//  - generated customer questions per passage, matched like-for-like against the incoming question
//  - an LLM answerability check, used only for borderline retrievals
const QUESTION_EXPANSION = process.env.RAG_QUESTION_EXPANSION !== 'off';
const VERIFY_ENABLED = process.env.RAG_VERIFY !== 'off';
const MIN_QUESTION_SIMILARITY = Number(process.env.RAG_MIN_QUESTION_SIMILARITY || 0.78);
const GRAY_SIMILARITY = 0.5;
const GRAY_QUESTION_SIMILARITY = 0.65;
const GRAY_COVERAGE = 0.15;
const VERIFY_TIMEOUT_MS = 8000;
const VERIFY_CACHE_MAX = 300;
const QUESTION_BATCH = 8;
const NO_QUESTION_TAGS = new Set(['voice', 'handoff']);
const verdictCache = new Map();
const QUERY_EMBED_TIMEOUT_MS = 4000;
const BM25_K1 = 1.5;
const BM25_B = 0.75;
const RRF_K = 60;

const STOPWORDS = new Set(
  (
    'a an and are as at be but by can could do does for from had has have how i if in into is it its just may me my no not of on or our ' +
    'please should so than that the their them then there these they this to up us was we were what when where which who why will with would you your ' +
    'tell know want need get got hi hello hey thanks thank ok okay yes about also any some very much'
  ).split(' ')
);

const indexCache = new Map();
const embeddingJobs = new Map();

function wsId(ws) {
  const id = String(ws || workspaceContext.current()).trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid workspace');
  return id;
}

function wsDataDir(ws) {
  const id = wsId(ws);
  const base = path.join(__dirname, 'data', 'company');
  return id === DEFAULT_WORKSPACE ? base : path.join(base, 'workspaces', id);
}

function vectorsPath(ws) {
  return path.join(wsDataDir(ws), 'embeddings.json');
}

function stem(t) {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s₹$]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

function hashText(text) {
  return crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 16);
}

function embedInput(chunk) {
  return `${chunk.title}\n${chunk.text}`;
}

function loadBaseChunks() {
  const file = process.env.LEAD_RAG_PATH ? path.resolve(process.env.LEAD_RAG_PATH) : DEFAULT_KB;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('[RAG] Failed to load base knowledge:', err.message);
    return [];
  }
}

function loadChunks(ws) {
  const id = wsId(ws);
  let company = [];
  try {
    company = require('./companyKnowledge').getCompanyChunks(id);
  } catch (err) {
    console.warn('[RAG] Failed to load company chunks:', err.message);
  }
  // The bundled demo knowledge (a spirits brand) must never leak into a real company's answers.
  const includeBase = id === DEFAULT_WORKSPACE && process.env.RAG_INCLUDE_BASE === 'true';
  return includeBase ? [...company, ...loadBaseChunks()] : company;
}

function readVectors(ws) {
  try {
    const raw = JSON.parse(fs.readFileSync(vectorsPath(ws), 'utf8'));
    if (raw.model === embeddings.EMBEDDING_MODEL && raw.vectors) return raw.vectors;
  } catch {
    /* none yet */
  }
  return {};
}

function buildIndex(ws) {
  const chunks = loadChunks(ws);
  const tf = [];
  const lengths = [];
  const df = new Map();
  for (const c of chunks) {
    const tokens = tokenize(`${c.title} ${c.title} ${(c.tags || []).join(' ')} ${c.text}`);
    const counts = new Map();
    for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
    tf.push(counts);
    lengths.push(tokens.length);
    for (const t of counts.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  const avgdl = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1) || 1;

  const stored = readVectors(ws);
  const vectors = chunks.map((c) => {
    const entry = stored[c.id];
    return entry && entry.h === hashText(embedInput(c)) ? entry.v : null;
  });
  // Customer-style questions generated for each passage (empty until the background indexing has made them).
  const questionVectors = chunks.map((c) => {
    const entry = stored[c.id];
    return entry && entry.h === hashText(embedInput(c)) && Array.isArray(entry.qs) ? entry.qs : [];
  });
  return {
    chunks, tf, lengths, df, avgdl, vectors, questionVectors,
    embeddedCount: vectors.filter(Boolean).length,
    questionCount: questionVectors.reduce((n, q) => n + q.length, 0),
  };
}

function getIndex(ws) {
  const id = wsId(ws);
  let idx = indexCache.get(id);
  if (!idx) {
    idx = buildIndex(id);
    indexCache.set(id, idx);
  }
  return idx;
}

function bm25(idx, qTokens) {
  const N = idx.chunks.length;
  const idf = (n) => Math.log(1 + (N - n + 0.5) / (n + 0.5));
  // Coverage is weighted by term rarity: a question word the knowledge base has never seen
  // (e.g. "teledentistry") counts as a strong miss, while generic words ("provide") barely count.
  const weights = qTokens.map((q) => idf(idx.df.get(q) || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const scores = [];
  for (let i = 0; i < N; i += 1) {
    let score = 0;
    let matchedWeight = 0;
    qTokens.forEach((q, qi) => {
      const f = idx.tf[i].get(q);
      if (!f) return;
      matchedWeight += weights[qi];
      const n = idx.df.get(q);
      score += (idf(n) * f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + (BM25_B * idx.lengths[i]) / idx.avgdl));
    });
    if (score > 0) {
      const tags = idx.chunks[i].tags || [];
      // Owner-authored FAQs are the most trusted answers.
      if (tags.includes('faq')) score *= 1.15;
      scores.push({ i, score, coverage: matchedWeight / totalWeight });
    }
  }
  return scores.sort((a, b) => b.score - a.score);
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('embedding timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function baselineChunk(idx) {
  return idx.chunks.find((c) => c.id === 'company-facts') || idx.chunks.find((c) => c.id === 'company-voice-profile') || null;
}

/**
 * Compute the raw retrieval signals for a question (no thresholds applied).
 * Exposed so evaluation can study the signals; search() turns them into a grounded / not-grounded decision.
 */
async function analyzeQuery(query, { ws, useQuestions = QUESTION_EXPANSION } = {}) {
  const idx = getIndex(ws);
  const qTokens = [...new Set(tokenize(query))];
  const lexical = qTokens.length && idx.chunks.length ? bm25(idx, qTokens) : [];

  let semantic = null;
  let topSimilarity = null;
  let topQuestionSimilarity = null;
  const semanticReady = idx.embeddedCount > 0 && idx.embeddedCount >= idx.chunks.length * 0.5;
  if (semanticReady && qTokens.length && embeddings.isAvailable()) {
    try {
      const qv = await withTimeout(embeddings.embedQuery(String(query).slice(0, 1000)), QUERY_EMBED_TIMEOUT_MS);
      semantic = [];
      idx.vectors.forEach((v, i) => {
        if (!v) return;
        const sim = embeddings.cosine(qv, v);
        let qsim = null;
        if (useQuestions) {
          for (const q of idx.questionVectors[i] || []) {
            const c = embeddings.cosine(qv, q.v);
            if (qsim === null || c > qsim) qsim = c;
          }
        }
        semantic.push({ i, sim, qsim });
        if (topSimilarity === null || sim > topSimilarity) topSimilarity = sim;
        if (qsim !== null && (topQuestionSimilarity === null || qsim > topQuestionSimilarity)) topQuestionSimilarity = qsim;
      });
      // Rank by the stronger of the two signals: passage similarity or a matching generated question.
      semantic.sort((a, b) => Math.max(b.sim, b.qsim ?? 0) - Math.max(a.sim, a.qsim ?? 0));
    } catch {
      semantic = null; // fall back to keyword-only for this query
      topSimilarity = null;
      topQuestionSimilarity = null;
    }
  }

  let ranked;
  if (semantic) {
    const fused = new Map();
    lexical.slice(0, 20).forEach((r, rank) => fused.set(r.i, (fused.get(r.i) || 0) + 1 / (RRF_K + rank + 1)));
    semantic.slice(0, 20).forEach((r, rank) => fused.set(r.i, (fused.get(r.i) || 0) + 1 / (RRF_K + rank + 1)));
    ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]).map(([i, score]) => ({ i, score }));
  } else {
    ranked = lexical;
  }

  return {
    idx,
    ranked,
    hybrid: Boolean(semantic),
    topSimilarity,
    topQuestionSimilarity,
    topCoverage: lexical[0]?.coverage ?? 0,
  };
}

/**
 * Ask the model whether the retrieved passages directly contain what the customer asked for.
 * Only called for borderline retrievals; fails closed (false) on any error or timeout.
 */
async function verifyAnswerable(query, chunks) {
  const key = hashText(`${query.toLowerCase()}|${chunks.map((c) => c.id).join(',')}`);
  if (verdictCache.has(key)) return verdictCache.get(key);
  let verdict = false;
  try {
    const { Type } = require('@google/genai');
    const schema = {
      type: Type.OBJECT,
      properties: { answerable: { type: Type.BOOLEAN }, passage: { type: Type.INTEGER } },
      required: ['answerable'],
    };
    const passages = chunks.map((c, i) => `[${i}] ${c.title}\n${c.text.slice(0, 900)}`).join('\n\n');
    const prompt = `Customer question: "${String(query).slice(0, 300)}"

Approved passages:
${passages}

Does one of the passages DIRECTLY state the information needed to answer this question? A passage that only mentions the same topic, or from which the answer would have to be guessed, does NOT count. If it says the thing is not offered, that counts as answering.`;
    const out = await withTimeout(
      require('./vertexAi').generateJson(prompt, schema, 'You are a strict checker. Say answerable only when the passages explicitly contain the answer.', { thinkingLevel: 'MINIMAL' }),
      VERIFY_TIMEOUT_MS
    );
    verdict = out?.answerable === true;
  } catch {
    verdict = false;
  }
  verdictCache.set(key, verdict);
  if (verdictCache.size > VERIFY_CACHE_MAX) verdictCache.delete(verdictCache.keys().next().value);
  return verdict;
}

/**
 * Hybrid search with a grounding signal.
 * @returns {Promise<{chunks: object[], grounded: boolean, verified: boolean, confidence: 'high'|'medium'|'low', mode: 'hybrid'|'keyword', topSimilarity: number|null, topQuestionSimilarity: number|null, topCoverage: number, conflict: boolean, conflicts: {id: string, topic: string}[]}>}
 */
async function search(
  query,
  {
    topK = 5,
    ws,
    minSimilarity = MIN_SIMILARITY,
    minQuestionSimilarity = MIN_QUESTION_SIMILARITY,
    useQuestions = QUESTION_EXPANSION,
    verify = VERIFY_ENABLED,
    verifier = verifyAnswerable,
  } = {}
) {
  const a = await analyzeQuery(query, { ws, useQuestions });
  const { idx } = a;
  const empty = { chunks: [], grounded: false, verified: false, confidence: 'low', mode: 'keyword', topSimilarity: null, topQuestionSimilarity: null, topCoverage: 0, conflict: false, conflicts: [] };
  if (!idx.chunks.length) return empty;

  const sim = a.topSimilarity ?? 0;
  const qsim = a.topQuestionSimilarity;
  const confidentlyGrounded = a.hybrid
    ? sim >= minSimilarity || (qsim !== null && qsim >= minQuestionSimilarity) || a.topCoverage >= MIN_COVERAGE_HYBRID
    : a.topCoverage >= MIN_COVERAGE_KEYWORD;

  // Borderline: related content was found but not convincingly. Ask the model whether it actually answers.
  const borderline =
    !confidentlyGrounded &&
    ((a.hybrid && (sim >= GRAY_SIMILARITY || (qsim !== null && qsim >= GRAY_QUESTION_SIMILARITY))) || a.topCoverage >= GRAY_COVERAGE);
  let verified = false;
  if (borderline && verify) {
    const candidates = a.ranked.slice(0, 4).map((r) => idx.chunks[r.i]);
    try {
      verified = (await verifier(query, candidates)) === true;
    } catch {
      verified = false; // fail closed: an unavailable checker can only make the assistant more cautious
    }
  }

  const grounded = confidentlyGrounded || verified;
  const confidence = !grounded
    ? 'low'
    : verified
      ? 'medium'
      : (a.hybrid && sim >= 0.65) || a.topCoverage >= 0.7
        ? 'high'
        : 'medium';

  const picked = a.ranked.slice(0, topK).map((r) => ({ ...idx.chunks[r.i], score: Number(r.score.toFixed(4)) }));
  // Owner-written FAQ answers come first: when sources disagree they are the owner's explicit answer.
  picked.sort((x, y) => Number((y.tags || []).includes('faq')) - Number((x.tags || []).includes('faq')));
  const base = baselineChunk(idx);
  if (base && !picked.some((c) => c.id === base.id)) picked.push({ ...base, score: 0 });

  // If a retrieved passage is part of an unresolved contradiction, the agent must not quote it as fact.
  let conflicts = [];
  if (grounded) {
    try {
      conflicts = require('./knowledge/conflicts')
        .openForChunks(picked.map((c) => c.id), ws)
        .map((c) => ({ id: c.id, topic: c.topic }));
    } catch {
      conflicts = [];
    }
  }

  return {
    chunks: grounded ? picked : base ? [{ ...base, score: 0 }] : [],
    grounded,
    verified,
    confidence,
    mode: a.hybrid ? 'hybrid' : 'keyword',
    topSimilarity: a.topSimilarity === null ? null : Number(a.topSimilarity.toFixed(3)),
    topQuestionSimilarity: qsim === null || qsim === undefined ? null : Number(qsim.toFixed(3)),
    topCoverage: Number(a.topCoverage.toFixed(3)),
    conflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Passages that overlap strongly with `chunk` (same topic), e.g. to compare a new document with existing ones.
 * Uses the rarest words of the passage for a keyword match, plus embedding similarity when vectors exist.
 */
function similarChunks(chunk, { ws, exclude = () => false, k = 3, minCosine = 0.8, minCoverage = 0.35 } = {}) {
  const idx = getIndex(ws);
  const self = idx.chunks.findIndex((c) => c.id === chunk.id);
  const N = idx.chunks.length;
  const idf = (t) => Math.log(1 + (N - (idx.df.get(t) || 0) + 0.5) / ((idx.df.get(t) || 0) + 0.5));
  const rare = [...new Set(tokenize(chunk.text))].sort((a, b) => idf(b) - idf(a)).slice(0, 40);

  // Words (not numbers) a passage is about. Numbers are excluded on purpose: two passages that
  // disagree on a price share everything except the price.
  const topical = (text) => new Set(tokenize(text).filter((t) => !/^\d+$/.test(t)));
  const mine = topical(chunk.text);
  const containment = (other) => {
    const theirs = topical(other.text);
    let inter = 0;
    for (const t of mine) if (theirs.has(t)) inter += 1;
    return { inter, ratio: inter / (Math.min(mine.size, theirs.size) || 1) };
  };

  const found = new Map();
  if (rare.length) {
    for (const r of bm25(idx, rare).slice(0, 8)) {
      if (r.i === self || exclude(idx.chunks[r.i])) continue;
      const { inter, ratio } = containment(idx.chunks[r.i]);
      // Same topic if they share many rare words (long passages) or one passage is largely contained in the other (short FAQ vs long text).
      if (r.coverage < minCoverage && !(inter >= 3 && ratio >= 0.6)) continue;
      found.set(r.i, { chunk: idx.chunks[r.i], score: r.score, cosine: null });
    }
  }
  const selfVec = self >= 0 ? idx.vectors[self] : null;
  if (selfVec) {
    idx.vectors.forEach((v, i) => {
      if (!v || i === self || exclude(idx.chunks[i])) return;
      const cosine = embeddings.cosine(selfVec, v);
      if (cosine >= minCosine) found.set(i, { ...(found.get(i) || { chunk: idx.chunks[i], score: 0 }), cosine });
    });
  }
  return [...found.values()]
    .sort((a, b) => (b.cosine ?? 0) - (a.cosine ?? 0) || b.score - a.score)
    .slice(0, k);
}

/** Synchronous keyword-only retrieval (kept for callers that cannot await). */
function retrieve(query, { topK = 4, ws } = {}) {
  const idx = getIndex(ws);
  const qTokens = [...new Set(tokenize(query))];
  if (!qTokens.length) return [];
  return bm25(idx, qTokens)
    .slice(0, topK)
    .map((r) => idx.chunks[r.i]);
}

function retrieveWithFallback(query, { topK = 4, ws } = {}) {
  const hits = retrieve(query, { topK, ws });
  if (hits.length) return hits;
  const idx = getIndex(ws);
  const base = baselineChunk(idx);
  return base ? [base] : idx.chunks.slice(0, topK);
}

function formatContext(chunks) {
  if (!chunks.length) return 'No matching knowledge documents were retrieved.';
  return chunks.map((c, i) => `[Doc ${i + 1} | id=${c.id}] ${c.title}\n${c.text}`).join('\n\n');
}

function listKnowledge(ws) {
  return getIndex(ws).chunks.map(({ id, title, tags }) => ({ id, title, tags }));
}

function getStats(ws) {
  const idx = getIndex(ws);
  return {
    chunks: idx.chunks.length,
    embedded: idx.embeddedCount,
    generatedQuestions: idx.questionCount,
    semanticSearch: idx.embeddedCount > 0 && idx.embeddedCount >= idx.chunks.length * 0.5,
    embeddingModel: embeddings.EMBEDDING_MODEL,
    embeddingError: embeddings.getLastError(),
    indexing: embeddingJobs.has(wsId(ws)),
  };
}

/** Drop the cached index (one workspace, or all). Returns the chunk count for a single workspace. */
function reload(ws) {
  if (ws === undefined) {
    indexCache.clear();
    return 0;
  }
  const id = wsId(ws);
  indexCache.delete(id);
  return getIndex(id).chunks.length;
}

/**
 * Embed any chunks that are new or changed, persist the vectors, and refresh the index.
 * Safe to call repeatedly; concurrent calls for a workspace share one job.
 */
/** Ask the model for realistic customer questions each passage answers (batched, best-effort). */
async function generateQuestions(chunks) {
  const out = new Map();
  if (!chunks.length || process.env.RAG_QUESTION_EXPANSION === 'off') return out;
  let vertex;
  try {
    vertex = require('./vertexAi');
  } catch {
    return out;
  }
  const { Type } = require('@google/genai');
  const schema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { index: { type: Type.INTEGER }, questions: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ['index', 'questions'],
        },
      },
    },
    required: ['items'],
  };
  for (let i = 0; i < chunks.length; i += QUESTION_BATCH) {
    const batch = chunks.slice(i, i + QUESTION_BATCH);
    const prompt = `For each passage below, write 4 to 6 short questions that a customer might type and that THIS PASSAGE ANSWERS DIRECTLY.
Use everyday, varied wording: synonyms, casual phrasing and different ways of asking (for example "pay with UPI" / "accept cards", "weekend" / "Saturday and Sunday", "kids" / "children", "how much" / "what does it cost").
Only ask about facts the passage actually states.

${batch.map((c, j) => `### Passage ${j}\n${c.title}\n${c.text.slice(0, 1200)}`).join('\n\n')}`;
    try {
      const res = await embeddings.withRetry(() => vertex.generateJson(prompt, schema, 'You write realistic customer questions.', { thinkingLevel: 'MINIMAL' }));
      for (const item of res.items || []) {
        const c = batch[item.index];
        if (c) out.set(c.id, (item.questions || []).map((q) => String(q).trim()).filter((q) => q.length > 5 && q.length < 200).slice(0, 6));
      }
    } catch (err) {
      console.warn('[RAG] question generation failed:', err.message);
    }
  }
  return out;
}

function indexEmbeddings(ws) {
  const id = wsId(ws);
  if (embeddingJobs.has(id)) return embeddingJobs.get(id);

  const job = (async () => {
    const chunks = loadChunks(id);
    const stored = readVectors(id);
    const next = {};
    const todo = [];
    for (const c of chunks) {
      const h = hashText(embedInput(c));
      if (stored[c.id] && stored[c.id].h === h) next[c.id] = stored[c.id];
      else todo.push({ c, h });
    }
    let failed = 0;
    if (todo.length) {
      try {
        const vectors = await embeddings.embedTexts(todo.map((t) => embedInput(t.c)), 'RETRIEVAL_DOCUMENT');
        todo.forEach((t, i) => {
          next[t.c.id] = { h: t.h, v: vectors[i].map((x) => Number(x.toFixed(5))) };
        });
      } catch (err) {
        failed = todo.length;
        console.warn(`[RAG] Embedding failed for workspace ${id}: ${err.message} — using keyword search`);
      }
    }
    // Customer-style questions per passage, embedded like queries, so paraphrases match like-for-like.
    const needQuestions = chunks.filter((c) => next[c.id] && next[c.id].qs === undefined && !(c.tags || []).some((t) => NO_QUESTION_TAGS.has(t)));
    if (needQuestions.length && embeddings.isAvailable()) {
      try {
        const generated = await generateQuestions(needQuestions);
        const flat = [];
        for (const [cid, qs] of generated) for (const q of qs) flat.push({ cid, q });
        const grouped = new Map();
        if (flat.length) {
          const vecs = await embeddings.embedTexts(flat.map((f) => f.q), 'RETRIEVAL_QUERY');
          flat.forEach((f, i) => {
            if (!grouped.has(f.cid)) grouped.set(f.cid, []);
            grouped.get(f.cid).push({ t: f.q, v: vecs[i].map((x) => Number(x.toFixed(5))) });
          });
        }
        // Passages the model returned nothing for are marked done so they are not retried on every index.
        for (const c of needQuestions) if (generated.has(c.id)) next[c.id].qs = grouped.get(c.id) || [];
      } catch (err) {
        console.warn(`[RAG] question embedding failed for workspace ${id}: ${err.message}`);
      }
    }
    const dir = wsDataDir(id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(vectorsPath(id), JSON.stringify({ model: embeddings.EMBEDDING_MODEL, vectors: next }));
    indexCache.delete(id);
    return { total: chunks.length, embedded: Object.keys(next).length, failed };
  })().finally(() => embeddingJobs.delete(id));

  embeddingJobs.set(id, job);
  return job;
}

module.exports = {
  tokenize,
  search,
  analyzeQuery,
  verifyAnswerable,
  retrieve,
  retrieveWithFallback,
  similarChunks,
  formatContext,
  listKnowledge,
  getStats,
  reload,
  indexEmbeddings,
  loadChunks,
};
