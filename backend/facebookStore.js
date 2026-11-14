const path = require('path');
const { createWorkspaceStore } = require('./wsStore');

const store = createWorkspaceStore(path.join(__dirname, 'data', 'facebook.json'), {
  account: null,
  seenCommentIds: [],
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

function getSeenCommentIds() {
  return new Set(store.read().seenCommentIds || []);
}

function markCommentsSeen(ids) {
  store.update((s) => {
    s.seenCommentIds = Array.from(new Set([...(s.seenCommentIds || []), ...ids])).slice(-2000);
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

/** Which workspace owns the connected Facebook Page (or its linked Instagram account) with this id. */
function findWorkspaceByAccountId(id) {
  const target = String(id || '');
  if (!target) return null;
  for (const [ws, state] of store.entries()) {
    const a = state.account;
    if (a && [a.pageId, a.igUserId].filter(Boolean).map(String).includes(target)) return ws;
  }
  return null;
}

/** Workspaces that have a Facebook Page connected (used by the reply poller). */
function workspaceIds() {
  return store.entries().filter(([, s]) => s.account).map(([id]) => id);
}

module.exports = {
  workspaceIds,
  getAccount,
  setAccount,
  clearAccount,
  getSeenCommentIds,
  markCommentsSeen,
  appendLeads,
  getStoredLeads,
  findWorkspaceByAccountId,
};
