const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'instagram.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ account: null, seenCommentIds: [], leads: [] }, null, 2)
    );
  }
}

function read() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { account: null, seenCommentIds: [], leads: [] };
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

function getSeenCommentIds() {
  return new Set(read().seenCommentIds || []);
}

function markCommentsSeen(ids) {
  const data = read();
  const set = new Set([...(data.seenCommentIds || []), ...ids]);
  data.seenCommentIds = Array.from(set).slice(-2000);
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
  getSeenCommentIds,
  markCommentsSeen,
  appendLeads,
  getStoredLeads,
};
