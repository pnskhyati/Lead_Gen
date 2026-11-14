const fs = require('fs');
const path = require('path');
const { createWorkspaceStore } = require('./wsStore');

const DATA_DIR = path.join(__dirname, 'data');
const PENDING_PATH = path.join(DATA_DIR, 'x-oauth-pending.json');
const PENDING_TTL_MS = 15 * 60_000;

const store = createWorkspaceStore(path.join(DATA_DIR, 'x.json'), {
  account: null,
  seenMentionIds: [],
  leads: [],
});

function getAccount() {
  return store.read().account;
}

function setAccount(account) {
  store.update((s) => {
    s.account = account;
  });
  return account;
}

function clearAccount() {
  store.update((s) => {
    s.account = null;
  });
}

// PKCE verifiers wait here between the redirect to X and the callback, keyed by OAuth state
// so concurrent connects from different workspaces never collide.
function readPending() {
  try {
    const raw = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
    return raw && typeof raw === 'object' && !raw.state ? raw : {};
  } catch {
    return {};
  }
}

function setPending(pending) {
  const all = readPending();
  const now = Date.now();
  for (const [key, value] of Object.entries(all)) {
    if (now - new Date(value.createdAt).getTime() > PENDING_TTL_MS) delete all[key];
  }
  all[pending.state] = pending;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PENDING_PATH, JSON.stringify(all, null, 2));
}

function consumePending(state) {
  const all = readPending();
  const pending = all[state];
  if (!pending) return null;
  delete all[state];
  fs.writeFileSync(PENDING_PATH, JSON.stringify(all, null, 2));
  return Date.now() - new Date(pending.createdAt).getTime() > PENDING_TTL_MS ? null : pending;
}

function getSeenMentionIds() {
  return new Set(store.read().seenMentionIds || []);
}

function markMentionsSeen(ids) {
  store.update((s) => {
    s.seenMentionIds = Array.from(new Set([...(s.seenMentionIds || []), ...ids])).slice(-2000);
  });
}

function appendLeads(leads) {
  let fresh = [];
  store.update((s) => {
    const existingIds = new Set((s.leads || []).map((l) => l.externalId).filter(Boolean));
    fresh = leads.filter((l) => l.externalId && !existingIds.has(l.externalId));
    s.leads = [...fresh, ...(s.leads || [])].slice(0, 200);
  });
  return fresh;
}

function getStoredLeads() {
  return store.read().leads || [];
}

/** Workspaces that have X connected (used by the reply poller). */
function workspaceIds() {
  return store.entries().filter(([, s]) => s.account).map(([id]) => id);
}

module.exports = {
  workspaceIds,
  getAccount,
  setAccount,
  clearAccount,
  setPending,
  consumePending,
  getSeenMentionIds,
  markMentionsSeen,
  appendLeads,
  getStoredLeads,
};
