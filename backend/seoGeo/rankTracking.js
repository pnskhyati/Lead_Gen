const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { getAuthedClient, readStore } = require('./googleIntegrations');

const KEYWORDS_PATH = path.join(__dirname, '..', 'data', 'company', 'seo-geo-keywords.json');
const SNAPSHOTS_PATH = path.join(__dirname, '..', 'data', 'company', 'seo-geo-rank-snapshots.json');

const SERP_API_KEY = process.env.SERPAPI_KEY || process.env.SERP_API_KEY || '';

function ensureDir() {
  const dir = path.dirname(KEYWORDS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readKeywords() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf8')).keywords || [];
  } catch {
    return [];
  }
}

function writeKeywords(keywords) {
  ensureDir();
  fs.writeFileSync(KEYWORDS_PATH, JSON.stringify({ keywords, updatedAt: new Date().toISOString() }, null, 2));
}

function readSnapshots() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOTS_PATH, 'utf8')).snapshots || [];
  } catch {
    return [];
  }
}

function appendSnapshots(rows) {
  const snapshots = readSnapshots();
  const next = [...rows, ...snapshots].slice(0, 5000);
  ensureDir();
  fs.writeFileSync(SNAPSHOTS_PATH, JSON.stringify({ snapshots: next, updatedAt: new Date().toISOString() }, null, 2));
  return next;
}

function addKeyword(payload) {
  const keywords = readKeywords();
  const kw = {
    id: `kw-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    keyword: String(payload.keyword || '').trim(),
    country: String(payload.country || 'US').trim(),
    language: String(payload.language || 'en').trim(),
    device: payload.device === 'mobile' ? 'mobile' : 'desktop',
    createdAt: new Date().toISOString(),
  };
  if (!kw.keyword) throw new Error('Keyword is required');
  keywords.push(kw);
  writeKeywords(keywords);
  return kw;
}

function deleteKeyword(id) {
  const keywords = readKeywords().filter((k) => k.id !== id);
  writeKeywords(keywords);
}

async function fetchGscQueryMetrics(siteUrl, keyword) {
  const store = readStore();
  if (!store.refreshToken || !siteUrl) return null;
  const auth = await getAuthedClient();
  const webmasters = require('googleapis').google.webmasters({ version: 'v3', auth });
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 28);
  const { data } = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ['query'],
      dimensionFilterGroups: [
        {
          filters: [{ dimension: 'query', operator: 'equals', expression: keyword }],
        },
      ],
      rowLimit: 1,
    },
  });
  const row = data.rows?.[0];
  if (!row) return null;
  return {
    source: 'gsc',
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.ctr,
    position: row.position,
  };
}

async function fetchSerpPosition(keyword, { country, language, device }) {
  if (!SERP_API_KEY) return null;
  const { data } = await axios.get('https://serpapi.com/search.json', {
    params: {
      engine: 'google',
      q: keyword,
      gl: country?.toLowerCase() || 'us',
      hl: language || 'en',
      device: device || 'desktop',
      api_key: SERP_API_KEY,
      num: 20,
    },
    timeout: 20000,
  });
  const profile = require('../companyKnowledge').getProfile();
  const domain = String(profile.websiteUrl || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
  const organic = data.organic_results || [];
  let position = null;
  organic.forEach((r, i) => {
    if (position) return;
    const link = String(r.link || '');
    if (domain && link.includes(domain)) position = i + 1;
  });
  return {
    source: 'serpapi',
    position,
    sampled: true,
    resultCount: organic.length,
  };
}

async function syncRankings() {
  const keywords = readKeywords();
  const store = readStore();
  const siteUrl = store.gsc?.siteUrl;
  const runAt = new Date().toISOString();
  const rows = [];

  for (const kw of keywords) {
    const prev = readSnapshots().find((s) => s.keywordId === kw.id);
    let gsc = null;
    let serp = null;
    try {
      if (siteUrl) gsc = await fetchGscQueryMetrics(siteUrl, kw.keyword);
    } catch (err) {
      gsc = { error: err.message };
    }
    try {
      serp = await fetchSerpPosition(kw.keyword, kw);
    } catch (err) {
      serp = { error: err.message };
    }

    const currentPosition = serp?.position ?? gsc?.position ?? null;
    const previousPosition = prev?.currentPosition ?? null;
    const change =
      currentPosition != null && previousPosition != null
        ? Number(previousPosition) - Number(currentPosition)
        : null;

    rows.push({
      id: `snap-${Date.now()}-${kw.id}`,
      keywordId: kw.id,
      keyword: kw.keyword,
      runAt,
      currentPosition,
      previousPosition,
      change,
      impressions: gsc?.impressions ?? null,
      clicks: gsc?.clicks ?? null,
      ctr: gsc?.ctr ?? null,
      gsc,
      serp,
      disclaimer:
        'GSC position is query average, not live rank. SERP API is a sampled observation when configured.',
    });
  }

  appendSnapshots(rows);
  return { synced: rows.length, runAt, rows };
}

function getRankDashboard() {
  const keywords = readKeywords();
  const snapshots = readSnapshots();
  const latestByKw = {};
  for (const s of snapshots) {
    if (!latestByKw[s.keywordId]) latestByKw[s.keywordId] = s;
  }
  return keywords.map((k) => ({
    keyword: k,
    latest: latestByKw[k.id] || null,
  }));
}

module.exports = {
  readKeywords,
  addKeyword,
  deleteKeyword,
  syncRankings,
  getRankDashboard,
  SERP_API_KEY: Boolean(SERP_API_KEY),
};
