/**
 * Per-workspace store for campaigns and scheduled posts, with an explicit state machine.
 *
 *   draft ──approve──▶ approved ──claim──▶ publishing ──▶ published
 *     ▲                   │                    │  ├──▶ approved (transient failure, retry later)
 *     └──── edit ─────────┘                    │  └──▶ failed
 *                         └── overdue ──▶ missed
 *
 * Stored as JSON under the workspace folder; all writes go through one queue per workspace and an atomic
 * rename, so a crash cannot leave a half-written file. (A multi-instance deployment needs a database.)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const wsData = require('../workspaceData');
const workspaceContext = require('../workspaceContext');

const FILE = (ws) => wsData.companyPath('social-planner.json', ws);
const MEDIA_DIR = (ws) => wsData.companyPath('social-media', ws);
const MAX_POSTS = 3000;
const MAX_CAMPAIGNS = 200;
const HISTORY_DAYS = 180;
const LEASE_MS = 10 * 60_000;

const STATUSES = ['draft', 'approved', 'publishing', 'published', 'failed', 'missed', 'cancelled'];
const TRANSITIONS = {
  draft: ['approved', 'cancelled'],
  approved: ['draft', 'publishing', 'missed', 'cancelled'],
  publishing: ['published', 'approved', 'failed'],
  failed: ['approved', 'draft', 'cancelled'],
  missed: ['approved', 'draft', 'cancelled'],
  published: [],
  cancelled: [],
};

const queues = new Map();
function serialized(ws, fn) {
  const prev = queues.get(ws) || Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(ws, next.catch(() => undefined));
  return next;
}

const empty = () => ({ campaigns: [], posts: [], settings: {} });

function read(ws) {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE(ws), 'utf8'));
    return { campaigns: raw.campaigns || [], posts: raw.posts || [], settings: raw.settings || {} };
  } catch {
    return empty();
  }
}

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Write via a temp file and rename so a crash never leaves a half-written file. On Windows the rename can
 * fail transiently (EPERM/EBUSY) while antivirus or the search indexer touches the target, so retry briefly,
 * and as a last resort write in place rather than lose the update.
 */
function write(ws, data) {
  const file = FILE(ws);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const content = JSON.stringify(data);
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, content);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      sleepSync(15 * (attempt + 1));
    }
  }
  fs.writeFileSync(file, content);
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* temp file already gone */
  }
}

/** Read-modify-write under the workspace queue. `fn(data)` mutates and may return a value. */
function mutate(ws, fn) {
  const workspace = workspaceContext.resolve(ws);
  return serialized(workspace, async () => {
    const data = read(workspace);
    const result = await fn(data);
    prune(data);
    write(workspace, data);
    return result;
  });
}

function prune(data) {
  const cutoff = Date.now() - HISTORY_DAYS * 86_400_000;
  data.posts = data.posts
    .filter((p) => !['published', 'cancelled', 'failed', 'missed'].includes(p.status) || new Date(p.scheduledAt).getTime() > cutoff)
    .slice(-MAX_POSTS);
  data.campaigns = data.campaigns.slice(-MAX_CAMPAIGNS);
  const live = new Set(data.posts.map((p) => p.campaignId));
  data.campaigns = data.campaigns.filter((c) => live.has(c.id) || c.status === 'generating' || Date.now() - new Date(c.createdAt).getTime() < cutoff);
}

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

function canTransition(from, to) {
  return from === to || (TRANSITIONS[from] || []).includes(to);
}

// ---------------------------------------------------------------------------------------------- reads

function getCampaign(id, ws) {
  return read(workspaceContext.resolve(ws)).campaigns.find((c) => c.id === id) || null;
}

function listCampaigns(ws) {
  const data = read(workspaceContext.resolve(ws));
  return data.campaigns
    .map((c) => ({ ...c, counts: countBy(data.posts.filter((p) => p.campaignId === c.id)) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function countBy(posts) {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const p of posts) out[p.status] = (out[p.status] || 0) + 1;
  out.total = posts.length;
  return out;
}

function getPost(id, ws) {
  return read(workspaceContext.resolve(ws)).posts.find((p) => p.id === id) || null;
}

function listPosts({ campaignId, from, to, status, platform } = {}, ws) {
  return read(workspaceContext.resolve(ws))
    .posts.filter((p) => (!campaignId || p.campaignId === campaignId) && (!status || p.status === status) && (!platform || p.platform === platform))
    .filter((p) => (!from || p.scheduledAt >= from) && (!to || p.scheduledAt <= to))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.platform.localeCompare(b.platform));
}

function getSettings(ws) {
  return read(workspaceContext.resolve(ws)).settings;
}

// ---------------------------------------------------------------------------------------------- writes

function createCampaign(fields, ws) {
  return mutate(ws, (data) => {
    const campaign = { id: newId('cmp'), status: 'generating', createdAt: new Date().toISOString(), ...fields };
    data.campaigns.push(campaign);
    return campaign;
  });
}

function updateCampaign(id, patch, ws) {
  return mutate(ws, (data) => {
    const c = data.campaigns.find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, patch);
    return c;
  });
}

function addPosts(campaignId, posts, ws) {
  return mutate(ws, (data) => {
    const now = new Date().toISOString();
    const created = posts.map((p) => ({
      id: newId('post'),
      campaignId,
      status: 'draft',
      source: 'ai',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      ...p,
    }));
    data.posts.push(...created);
    return created;
  });
}

/**
 * Edit a post. Any change to content or timing on an approved post sends it back to draft, because
 * the owner approved something specific; the new version needs a fresh look.
 */
function updatePost(id, patch, ws) {
  return mutate(ws, (data) => {
    const post = data.posts.find((p) => p.id === id);
    if (!post) return null;
    if (['publishing', 'published'].includes(post.status)) throw new Error(`A ${post.status} post cannot be edited`);
    const EDITABLE = ['text', 'hashtags', 'scheduledAt', 'dayKey', 'image', 'imagePrompt', 'topic', 'pillar', 'promo', 'imageText', 'imageStatus', 'imageError', 'imageRetryable', 'rationale'];
    let contentChanged = false;
    for (const key of EDITABLE) {
      if (patch[key] === undefined) continue;
      if (['text', 'hashtags', 'scheduledAt', 'image'].includes(key) && JSON.stringify(post[key]) !== JSON.stringify(patch[key])) contentChanged = true;
      post[key] = patch[key];
    }
    if (patch.userEdited) post.source = 'edited';
    if (contentChanged && post.status === 'approved') {
      post.status = 'draft';
      post.approvedAt = null;
    }
    if (contentChanged && ['failed', 'missed'].includes(post.status)) {
      post.status = 'draft';
      post.lastError = null;
    }
    post.updatedAt = new Date().toISOString();
    return post;
  });
}

function setStatus(id, to, extra, ws) {
  return mutate(ws, (data) => {
    const post = data.posts.find((p) => p.id === id);
    if (!post) return null;
    if (!canTransition(post.status, to)) throw new Error(`Cannot move a ${post.status} post to ${to}`);
    post.status = to;
    Object.assign(post, extra || {});
    post.updatedAt = new Date().toISOString();
    return post;
  });
}

function deletePost(id, ws) {
  return mutate(ws, (data) => {
    const post = data.posts.find((p) => p.id === id);
    if (!post) return false;
    if (['publishing', 'published'].includes(post.status)) throw new Error(`A ${post.status} post cannot be deleted`);
    data.posts = data.posts.filter((p) => p.id !== id);
    return true;
  });
}

/** Approve many posts at once; the caller has already validated them. */
function approvePosts(ids, ws) {
  return mutate(ws, (data) => {
    const now = new Date().toISOString();
    const approved = [];
    for (const post of data.posts) {
      if (!ids.includes(post.id) || post.status === 'approved') continue;
      if (!canTransition(post.status, 'approved')) continue;
      post.status = 'approved';
      post.approvedAt = now;
      post.lastError = null;
      post.attempts = 0;
      post.updatedAt = now;
      approved.push(post.id);
    }
    const campaignIds = new Set(data.posts.filter((p) => ids.includes(p.id)).map((p) => p.campaignId));
    for (const c of data.campaigns) {
      if (campaignIds.has(c.id) && data.posts.filter((p) => p.campaignId === c.id).every((p) => p.status !== 'draft')) {
        c.status = 'approved';
        c.approvedAt = c.approvedAt || now;
      }
    }
    return approved;
  });
}

function saveSettings(patch, ws) {
  return mutate(ws, (data) => {
    data.settings = { ...data.settings, ...patch };
    return data.settings;
  });
}

// ---------------------------------------------------------------------------------------------- publishing

/**
 * Take ownership of posts that are due. Posts overdue by more than `graceMs` are marked missed instead of
 * being published late. Everything claimed gets a lease so a crashed worker cannot hold a post forever.
 */
function claimDuePosts({ now = Date.now(), limit = 5, graceMs = 3 * 3_600_000 } = {}, ws) {
  return mutate(ws, (data) => {
    const claimed = [];
    for (const post of data.posts) {
      if (post.status !== 'approved') continue;
      if (new Date(post.scheduledAt).getTime() > now) continue;
      if (post.nextAttemptAt && new Date(post.nextAttemptAt).getTime() > now) continue;
      if (now - new Date(post.scheduledAt).getTime() > graceMs) {
        post.status = 'missed';
        post.lastError = 'The server was unable to publish this in time, and it is now too late to post it automatically.';
        post.updatedAt = new Date(now).toISOString();
        continue;
      }
      if (claimed.length >= limit) continue;
      post.status = 'publishing';
      post.attempts = (post.attempts || 0) + 1;
      post.leaseUntil = new Date(now + LEASE_MS).toISOString();
      post.updatedAt = new Date(now).toISOString();
      claimed.push({ ...post });
    }
    return claimed;
  });
}

/** Claim exactly one approved post for immediate publishing (owner clicked "Publish now" / "Retry"). */
function claimSpecific(id, { now = Date.now() } = {}, ws) {
  return mutate(ws, (data) => {
    const post = data.posts.find((p) => p.id === id);
    if (!post || post.status !== 'approved') return null;
    post.status = 'publishing';
    post.attempts = (post.attempts || 0) + 1;
    post.leaseUntil = new Date(now + LEASE_MS).toISOString();
    post.nextAttemptAt = null;
    post.updatedAt = new Date(now).toISOString();
    return { ...post };
  });
}

function markPublished(id, platformPostId, ws, extra = {}) {
  return setStatus(id, 'published', { platformPostId: platformPostId || null, publishedUrl: extra.url || null, publishedAt: new Date().toISOString(), leaseUntil: null, lastError: null, errorKind: null }, ws);
}

/** Save the latest performance numbers read from the platform for a published post. */
function setMetrics(id, metrics, ws) {
  return mutate(ws, (data) => {
    const post = data.posts.find((p) => p.id === id);
    if (!post) return null;
    post.metrics = metrics;
    return post;
  });
}

/**
 * Record a failed attempt. Transient errors go back to approved with a backoff until attempts run out;
 * permanent ones (expired token, rejected media) fail immediately so the owner can fix them.
 */
function markFailed(id, { message, kind = 'permanent', maxAttempts = 3, backoffMs = [2 * 60_000, 10 * 60_000, 30 * 60_000] }, ws) {
  return mutate(ws, (data) => {
    const post = data.posts.find((p) => p.id === id);
    if (!post || post.status !== 'publishing') return post || null;
    const retry = kind === 'transient' && post.attempts < maxAttempts;
    post.status = retry ? 'approved' : 'failed';
    post.lastError = String(message || 'Unknown error').slice(0, 500);
    post.errorKind = kind;
    post.leaseUntil = null;
    post.nextAttemptAt = retry ? new Date(Date.now() + (backoffMs[post.attempts - 1] || backoffMs[backoffMs.length - 1])).toISOString() : null;
    post.updatedAt = new Date().toISOString();
    return post;
  });
}

/**
 * A worker that died mid-publish leaves a post in `publishing`. We cannot know whether the platform
 * accepted it, so we do NOT retry (that could double-post); we fail it with an explicit explanation.
 */
function recoverStale({ now = Date.now() } = {}, ws) {
  return mutate(ws, (data) => {
    const recovered = [];
    for (const post of data.posts) {
      if (post.status === 'publishing' && post.leaseUntil && new Date(post.leaseUntil).getTime() < now) {
        post.status = 'failed';
        post.errorKind = 'unknown';
        post.lastError = 'The server stopped while publishing, so it is unclear whether this went out. Check the platform before retrying.';
        post.leaseUntil = null;
        post.updatedAt = new Date(now).toISOString();
        recovered.push(post.id);
      }
    }
    return recovered;
  });
}

/** Workspaces that have approved posts waiting; keeps the scheduler from opening every tenant's file. */
function workspacesWithApprovedPosts() {
  return wsData.listWorkspaceIds().filter((ws) => {
    try {
      return read(ws).posts.some((p) => p.status === 'approved' || p.status === 'publishing');
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------------------------- media

function mediaDir(ws) {
  const dir = MEDIA_DIR(ws);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Save image bytes for the current workspace; returns the descriptor stored on the post. */
function saveImage({ buffer, mime, source }, ws) {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const file = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(mediaDir(ws), file), buffer);
  return { source, file, mime, bytes: buffer.length };
}

function readImage(image, ws) {
  if (!image?.file || !/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(image.file)) return null;
  try {
    return fs.readFileSync(path.join(MEDIA_DIR(ws), image.file));
  } catch {
    return null;
  }
}

function imagePath(file, ws) {
  if (!/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(String(file))) return null;
  const p = path.join(MEDIA_DIR(ws), file);
  return fs.existsSync(p) ? p : null;
}

function imageDataUrl(image, ws) {
  const buf = readImage(image, ws);
  return buf ? `data:${image.mime};base64,${buf.toString('base64')}` : null;
}

module.exports = {
  STATUSES, TRANSITIONS, canTransition, LEASE_MS,
  createCampaign, updateCampaign, getCampaign, listCampaigns,
  addPosts, getPost, listPosts, updatePost, setStatus, deletePost, approvePosts,
  getSettings, saveSettings,
  claimDuePosts, claimSpecific, markPublished, setMetrics, markFailed, recoverStale, workspacesWithApprovedPosts,
  saveImage, readImage, imagePath, imageDataUrl,
};
