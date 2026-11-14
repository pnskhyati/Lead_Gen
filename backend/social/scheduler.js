/**
 * Publishes approved posts when they are due.
 *
 * Reliability rules:
 *  - A post is claimed (leased) before publishing, so two workers or two ticks can never both send it.
 *  - Retry ONLY when the platform provably did not accept the post (rate limit, connection never made).
 *    Ambiguous failures (timeouts, 5xx after sending) are not retried: the post may have gone out, and a
 *    duplicate public post is worse than asking the owner to check. They are marked failed with that message.
 *  - A crash mid-publish is recovered the same way (see postStore.recoverStale).
 *  - Posts overdue beyond the grace window are marked missed, never published stale.
 */
const store = require('./postStore');
const competitors = require('./competitors');
const workspaceContext = require('../workspaceContext');
const wsData = require('../workspaceData');

const TICK_MS = Number(process.env.SOCIAL_TICK_MS || 30_000);
const PUBLISH_TIMEOUT_MS = 90_000;
const SAFE_TO_RETRY_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']);

/**
 * @returns {{ kind: 'transient'|'permanent'|'unknown', message: string }}
 *  transient  - safe to retry (the platform did not accept it)
 *  permanent  - needs the owner (bad token, rejected media, not connected)
 *  unknown    - may or may not have been published; do not retry automatically
 */
function classifyError(err) {
  const status = err?.response?.status;
  const apiMessage = err?.response?.data?.error?.message || err?.response?.data?.message || err?.response?.data?.detail;
  const message = String(apiMessage || err?.message || 'Unknown error').slice(0, 400);
  if (err?.timedOut) return { kind: 'unknown', message };
  if (status === 429 || status === 503) return { kind: 'transient', message };
  if (status >= 500) return { kind: 'unknown', message };
  if (status >= 400) return { kind: 'permanent', message };
  if (SAFE_TO_RETRY_CODES.has(err?.code)) return { kind: 'transient', message };
  if (err?.code || /timeout|timed out|socket hang up|ECONNRESET/i.test(message)) return { kind: 'unknown', message };
  return { kind: 'permanent', message };
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Publishing timed out; the platform may or may not have accepted the post'), { timedOut: true })), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * @param {object} deps
 * @param {(platform: string, post: object, opts: { userUrn?: string }) => Promise<{ id: string }>} deps.publish
 * @param {(ws: string) => string|null} deps.linkedinUrn LinkedIn identity linked to the workspace
 * @param {{ generateJson: Function }} [deps.vertex] for the weekly competitor refresh
 */
function createWorker({ publish, linkedinUrn = () => null, vertex = null, publishTimeoutMs = PUBLISH_TIMEOUT_MS }) {
  let running = false;

  async function publishOne(post, ws) {
    try {
      const userUrn = post.platform === 'linkedin' ? linkedinUrn(ws) : undefined;
      if (post.platform === 'linkedin' && !userUrn) {
        throw Object.assign(new Error('LinkedIn is not connected for this workspace. Connect it in Channels, then retry.'), { response: { status: 401 } });
      }
      const legacy = {
        id: post.id,
        headline: '',
        content: post.text,
        hashtags: post.hashtags,
        imageUrl: post.image ? store.imageDataUrl(post.image, ws) || undefined : undefined,
      };
      if (post.image && !legacy.imageUrl) {
        throw Object.assign(new Error('The image file for this post is missing. Upload or generate the image again.'), { response: { status: 400 } });
      }
      const result = await withTimeout(publish(post.platform, legacy, { userUrn }), publishTimeoutMs);
      await store.markPublished(post.id, result?.id, ws, { url: result?.url });
      return { id: post.id, ok: true };
    } catch (err) {
      const { kind, message } = classifyError(err);
      await store.markFailed(post.id, { message, kind }, ws);
      console.warn(`[Social] ${post.platform} post ${post.id} failed (${kind}): ${message}`);
      return { id: post.id, ok: false, kind };
    }
  }

  /** One pass over every workspace that has approved posts. Overlapping passes are skipped. */
  async function tick({ now = Date.now() } = {}) {
    if (running) return { skipped: true };
    running = true;
    const results = [];
    try {
      for (const ws of store.workspacesWithApprovedPosts()) {
        try {
          await workspaceContext.run(ws, async () => {
            await store.recoverStale({ now }, ws);
            const claimed = await store.claimDuePosts({ now, limit: 5 }, ws);
            for (const post of claimed) results.push({ ws, ...(await publishOne(post, ws)) });
          });
        } catch (err) {
          console.warn(`[Social] workspace ${ws}:`, err.message);
        }
      }
    } finally {
      running = false;
    }
    return { results };
  }

  /** Publish one specific post right now (owner clicked "Publish now" or "Retry"). Never touches other posts. */
  async function publishNow(postId, ws) {
    return workspaceContext.run(ws, async () => {
      const post = store.getPost(postId, ws);
      if (!post) throw new Error('Post not found');
      if (['failed', 'missed'].includes(post.status)) {
        await store.setStatus(postId, 'approved', { lastError: null, errorKind: null, attempts: 0, nextAttemptAt: null }, ws);
      }
      const claimed = await store.claimSpecific(postId, {}, ws);
      if (!claimed) throw new Error('This post is not ready to publish. It must be approved first.');
      return publishOne(claimed, ws);
    });
  }

  async function refreshCompetitors() {
    if (!vertex) return;
    await wsData.forEachWorkspace(async (ws) => {
      if (competitors.needsRefresh(ws)) await competitors.analyze(vertex, ws);
    });
  }

  let timer = null;
  let competitorTimer = null;
  function start() {
    if (timer || process.env.SOCIAL_SCHEDULER === 'off') return;
    timer = setInterval(() => void tick().catch((e) => console.warn('[Social] tick', e.message)), TICK_MS);
    timer.unref?.();
    competitorTimer = setInterval(() => void refreshCompetitors().catch((e) => console.warn('[Social] competitors', e.message)), 6 * 3_600_000);
    competitorTimer.unref?.();
    console.log('[Social] scheduler active');
  }
  function stop() {
    clearInterval(timer);
    clearInterval(competitorTimer);
    timer = null;
    competitorTimer = null;
  }

  return { tick, publishNow, start, stop, refreshCompetitors };
}

module.exports = { createWorker, classifyError };
