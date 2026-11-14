/**
 * Text embeddings for semantic retrieval (Vertex AI / Gemini API via the shared client).
 * Everything here degrades gracefully: when embeddings are unavailable the retriever uses BM25 only.
 */
const EMBEDDING_MODEL = process.env.VERTEX_EMBEDDING_MODEL || 'text-embedding-005';
const BATCH_SIZE = 16;
const MAX_INPUT_CHARS = 6000;

// Circuit breaker: a single transient error (rate limit, blip) must not switch semantic search off.
// After FAILURES_TO_TRIP consecutive failures we pause for COOLDOWN_MS so a broken project adds no latency.
const FAILURES_TO_TRIP = 3;
const COOLDOWN_MS = 60_000;
const QUERY_CACHE_MAX = 300;

let unavailableUntil = 0;
let consecutiveFailures = 0;
let lastError = null;
const queryCache = new Map();

const RETRY_DELAYS_MS = [1500, 4000, 10000];
const isTransient = (err) => /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|fetch failed/i.test(String(err?.message || err));

/** Retry a model call on rate limits and transient outages (exponential-ish backoff). */
async function withRetry(fn, delays = RETRY_DELAYS_MS) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= delays.length || !isTransient(err)) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

function recordFailure(err) {
  lastError = err.message;
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURES_TO_TRIP) unavailableUntil = Date.now() + COOLDOWN_MS;
}

function recordSuccess() {
  consecutiveFailures = 0;
  lastError = null;
}

function isAvailable() {
  if (process.env.RAG_DISABLE_EMBEDDINGS === 'true') return false;
  return Date.now() >= unavailableUntil;
}

function getLastError() {
  return lastError;
}

/** @param {string[]} texts @param {'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'} taskType */
async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!texts.length) return [];
  if (!isAvailable()) throw new Error(lastError || 'Embeddings temporarily unavailable');

  let client;
  try {
    client = require('../vertexAi').getClient();
  } catch (err) {
    // Not configured at all: no point retrying soon.
    lastError = err.message;
    unavailableUntil = Date.now() + 5 * 60_000;
    throw err;
  }

  const out = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => String(t).slice(0, MAX_INPUT_CHARS));
    try {
      const res = await withRetry(() =>
        client.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: batch,
          config: { taskType },
        })
      );
      const vectors = (res.embeddings || []).map((e) => e.values);
      if (vectors.length !== batch.length) throw new Error('Embedding response size mismatch');
      out.push(...vectors);
    } catch (err) {
      recordFailure(err);
      throw err;
    }
  }
  recordSuccess();
  return out;
}

/** Embed one search query, remembering recent answers (customers repeat the same questions). */
async function embedQuery(text) {
  const key = String(text).trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit) {
    queryCache.delete(key);
    queryCache.set(key, hit); // refresh recency
    return hit;
  }
  const [vector] = await embedTexts([text], 'RETRIEVAL_QUERY');
  queryCache.set(key, vector);
  if (queryCache.size > QUERY_CACHE_MAX) queryCache.delete(queryCache.keys().next().value);
  return vector;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

module.exports = { EMBEDDING_MODEL, embedTexts, embedQuery, cosine, isAvailable, getLastError, withRetry };
