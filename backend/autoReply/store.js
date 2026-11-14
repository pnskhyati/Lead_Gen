/**
 * Auto-reply state per workspace: which channels are on and in what mode, what has already been seen,
 * and every reply drafted or sent (so the owner can review and audit them).
 */
const path = require('path');
const { createWorkspaceStore } = require('../wsStore');

/** The channels we can read from and reply on without a public webhook address. */
const CHANNELS = {
  instagram_comments: { label: 'Instagram comments', platform: 'instagram', kind: 'comment', modes: ['off', 'review', 'auto'], defaultMode: 'review' },
  instagram_dms: { label: 'Instagram messages', platform: 'instagram', kind: 'dm', modes: ['off', 'auto'], defaultMode: 'auto' },
  facebook_comments: { label: 'Facebook comments', platform: 'facebook', kind: 'comment', modes: ['off', 'review', 'auto'], defaultMode: 'review' },
  linkedin_comments: { label: 'LinkedIn comments', platform: 'linkedin', kind: 'comment', modes: ['off', 'review', 'auto'], defaultMode: 'review' },
  facebook_messenger: { label: 'Facebook Messenger', platform: 'facebook', kind: 'dm', modes: ['off', 'auto'], defaultMode: 'auto' },
  x_mentions: { label: 'X mentions', platform: 'x', kind: 'comment', modes: ['off', 'review', 'auto'], defaultMode: 'review' },
};

const MAX_ITEMS = 400;
const MAX_SEEN = 1000;
const DEFAULT_DAILY_CAP = 40;

const store = createWorkspaceStore(path.join(__dirname, '..', 'data', 'auto-reply.json'), {
  settings: { dailyCap: DEFAULT_DAILY_CAP, channels: {} },
  items: [],
  seen: {},
  lastRun: {},
});

const read = (ws) => store.read(ws);
const update = (fn, ws) => store.update(fn, ws);

function modeOf(state, id) {
  const def = CHANNELS[id];
  const m = state.settings?.channels?.[id]?.mode;
  return def.modes.includes(m) ? m : def.defaultMode;
}

/** Changing a channel from off to on starts a fresh clock, so old comments are never answered. */
function setSettings({ channels, dailyCap }, ws, now = Date.now()) {
  return update((s) => {
    s.settings = s.settings || { dailyCap: DEFAULT_DAILY_CAP, channels: {} };
    s.settings.channels = s.settings.channels || {};
    for (const [id, patch] of Object.entries(channels || {})) {
      const def = CHANNELS[id];
      if (!def || !def.modes.includes(patch?.mode)) continue;
      const before = modeOf(s, id);
      const entry = s.settings.channels[id] || {};
      entry.mode = patch.mode;
      if (before === 'off' && patch.mode !== 'off') entry.since = new Date(now).toISOString();
      s.settings.channels[id] = entry;
    }
    if (dailyCap !== undefined) {
      const n = Math.round(Number(dailyCap));
      if (Number.isFinite(n)) s.settings.dailyCap = Math.max(1, Math.min(500, n));
    }
    return s;
  }, ws);
}

const sinceOf = (state, id) => state.settings?.channels?.[id]?.since || null;

function ensureSince(id, ws, now = Date.now()) {
  let since = null;
  update((s) => {
    s.settings = s.settings || { dailyCap: DEFAULT_DAILY_CAP, channels: {} };
    const entry = s.settings.channels[id] || {};
    if (!entry.since) entry.since = new Date(now).toISOString();
    s.settings.channels[id] = entry;
    since = entry.since;
    return s;
  }, ws);
  return since;
}

const seenSet = (state, id) => new Set(state.seen?.[id] || []);

function markSeen(id, externalId, ws) {
  update((s) => {
    s.seen = s.seen || {};
    s.seen[id] = [...(s.seen[id] || []), String(externalId)].slice(-MAX_SEEN);
    return s;
  }, ws);
}

function addItem(item, ws) {
  update((s) => {
    s.items = [item, ...(s.items || [])].slice(0, MAX_ITEMS);
    return s;
  }, ws);
  return item;
}

function patchItem(id, patch, ws) {
  let found = null;
  update((s) => {
    const it = (s.items || []).find((x) => x.id === id);
    if (it) {
      Object.assign(it, patch);
      found = { ...it };
    }
    return s;
  }, ws);
  return found;
}

const getItem = (id, ws) => (read(ws).items || []).find((x) => x.id === id) || null;

function setLastRun(id, run, ws) {
  update((s) => {
    s.lastRun = { ...(s.lastRun || {}), [id]: run };
    return s;
  }, ws);
}

/** Replies actually sent in the last 24 hours (the daily limit counts these). */
function sentInLastDay(state, now = Date.now()) {
  return (state.items || []).filter((i) => i.status === 'sent' && i.sentAt && now - new Date(i.sentAt).getTime() < 86_400_000).length;
}

const workspaceIds = () => store.entries().map(([id]) => id);

module.exports = {
  CHANNELS,
  DEFAULT_DAILY_CAP,
  read,
  update,
  modeOf,
  setSettings,
  sinceOf,
  ensureSince,
  seenSet,
  markSeen,
  addItem,
  patchItem,
  getItem,
  setLastRun,
  sentInLastDay,
  workspaceIds,
};
