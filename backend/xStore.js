const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'x.json');
const PENDING_PATH = path.join(DATA_DIR, 'x-oauth-pending.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ account: null, seenMentionIds: [], leads: [] }, null, 2));
  }
}

function read() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { account: null, seenMentionIds: [], leads: [] };
  }
}

function write(data) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function getAccount() {
  return read().account;
}

function setAccount(account) {
  const data = read();
  data.account = account;
  write(data);
  return account;
}

function clearAccount() {
  const data = read();
  data.account = null;
  write(data);
}

function setPending(pending) {
  ensureStore();
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2));
}

function consumePending(state) {
  try {
    const pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
    if (pending.state !== state) return null;
    fs.unlinkSync(PENDING_PATH);
    return pending;
  } catch {
    return null;
  }
}

function getSeenMentionIds() {
  return new Set(read().seenMentionIds || []);
}

function markMentionsSeen(ids) {
  const data = read();
  const set = new Set([...(data.seenMentionIds || []), ...ids]);
  data.seenMentionIds = Array.from(set).slice(-2000);
  write(data);
}

function appendLeads(leads) {
  const data = read();
  const existingIds = new Set((data.leads || []).map((l) => l.externalId).filter(Boolean));
  const fresh = leads.filter((l) => l.externalId && !existingIds.has(l.externalId));
  data.leads = [...fresh, ...(data.leads || [])].slice(0, 200);
  write(data);
  return fresh;
}

function getStoredLeads() {
  return read().leads || [];
}

module.exports = {
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
