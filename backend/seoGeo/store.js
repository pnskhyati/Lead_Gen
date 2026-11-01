const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'company');
const AUDIT_STORE = path.join(DATA_DIR, 'seo-geo-audits.json');
const STATUS_STORE = path.join(DATA_DIR, 'seo-geo-recommendation-status.json');
const LEGACY_MANUAL = path.join(DATA_DIR, 'seo-geo.json');

const MAX_AUDITS = 25;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDir();
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readAuditStore() {
  return readJson(AUDIT_STORE, { latestAuditId: null, audits: [] });
}

function saveAudit(audit) {
  const store = readAuditStore();
  store.audits = [audit, ...(store.audits || [])].slice(0, MAX_AUDITS);
  store.latestAuditId = audit.id;
  writeJson(AUDIT_STORE, store);
  return audit;
}

function getLatestAudit() {
  const store = readAuditStore();
  if (!store.latestAuditId) return null;
  return (store.audits || []).find((a) => a.id === store.latestAuditId) || store.audits?.[0] || null;
}

function listAuditHistory(limit = 10) {
  const store = readAuditStore();
  return (store.audits || []).slice(0, limit).map((a) => ({
    id: a.id,
    runAt: a.runAt,
    websiteUrl: a.websiteUrl,
    recommendationCount: (a.recommendations || []).length,
    crawlOk: a.crawlSummary?.homepageOk,
  }));
}

function readRecommendationStatuses() {
  return readJson(STATUS_STORE, { statuses: {} }).statuses || {};
}

function setRecommendationStatus(id, status) {
  const all = readJson(STATUS_STORE, { statuses: {} });
  all.statuses = all.statuses || {};
  all.statuses[id] = { status, updatedAt: new Date().toISOString() };
  writeJson(STATUS_STORE, all);
  return all.statuses[id];
}

function readLegacyManualStatuses() {
  const raw = readJson(LEGACY_MANUAL, { manualStatuses: {} });
  return raw.manualStatuses || {};
}

module.exports = {
  readAuditStore,
  saveAudit,
  getLatestAudit,
  listAuditHistory,
  readRecommendationStatuses,
  setRecommendationStatus,
  readLegacyManualStatuses,
};
