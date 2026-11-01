/**
 * Full-site crawl jobs — queued BFS + sitemap discovery with budgets and SSRF guards.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  fetchUrl,
  parseHtmlSignals,
  analyzeRobotsTxt,
  normalizeSiteUrl,
} = require('./crawler');
const { assertSafeFetchUrl } = require('./ssrf');
const { buildMultiPageRecommendations } = require('./siteCrawl');

const DATA_DIR = path.join(__dirname, '..', 'data', 'company', 'seo-geo-crawl');
const INDEX_PATH = path.join(DATA_DIR, 'jobs-index.json');

const DEFAULT_MAX_URLS = Number(process.env.SEO_GEO_CRAWL_MAX_URLS || 500);
const MAX_CAP = Number(process.env.SEO_GEO_CRAWL_HARD_CAP || 2000);
const FETCH_DELAY_MS = Number(process.env.SEO_GEO_CRAWL_DELAY_MS || 250);
const CONCURRENCY = Number(process.env.SEO_GEO_CRAWL_CONCURRENCY || 3);

const runningJobs = new Set();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readIndex() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return { latestCompletedId: null, jobs: [] };
  }
}

function writeIndex(idx) {
  ensureDir();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2));
}

function jobPath(id) {
  return path.join(DATA_DIR, `${id}.json`);
}

function readJob(id) {
  try {
    return JSON.parse(fs.readFileSync(jobPath(id), 'utf8'));
  } catch {
    return null;
  }
}

function writeJob(job) {
  ensureDir();
  fs.writeFileSync(jobPath(job.id), JSON.stringify(job, null, 2));
}

function normalizeUrl(href, origin) {
  try {
    const u = new URL(href, origin);
    if (u.origin !== origin) return null;
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return null;
  }
}

function extractInternalLinks(html, origin) {
  const links = [];
  const re = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const n = normalizeUrl(m[1], origin);
    if (n) links.push(n);
  }
  return links;
}

function extractLocsFromSitemap(xml, origin, limit = 5000) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(String(xml || ''))) && locs.length < limit) {
    const n = normalizeUrl(m[1], origin);
    if (n) locs.push(n);
  }
  return locs;
}

function isSitemapIndex(xml) {
  return /<sitemapindex/i.test(String(xml || ''));
}

async function safeFetch(url) {
  await assertSafeFetchUrl(url);
  return fetchUrl(url);
}

function robotsDisallowsPath(robotsBody, pathname) {
  const lines = String(robotsBody || '').split(/\r?\n/);
  let agentAll = false;
  const rules = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const lower = t.toLowerCase();
    if (lower.startsWith('user-agent:')) {
      agentAll = lower.slice('user-agent:'.length).trim() === '*';
    } else if (agentAll && lower.startsWith('disallow:')) {
      const p = t.slice(t.indexOf(':') + 1).trim();
      if (p) rules.push(p);
    }
  }
  for (const rule of rules) {
    if (rule === '/') return true;
    if (rule !== '/' && pathname.startsWith(rule)) return true;
  }
  return false;
}

async function discoverUrls(origin, maxUrls) {
  const discovered = new Set();
  const robotsRes = await safeFetch(`${origin}/robots.txt`);
  let robotsBody = robotsRes.ok ? robotsRes.text : '';
  const robotsInfo = robotsBody ? analyzeRobotsTxt(robotsBody, origin) : { sitemapUrls: [`${origin}/sitemap.xml`] };

  const sitemapQueue = [...robotsInfo.sitemapUrls];
  const seenSm = new Set();
  while (sitemapQueue.length && discovered.size < maxUrls) {
    const smUrl = sitemapQueue.shift();
    if (!smUrl || seenSm.has(smUrl)) continue;
    seenSm.add(smUrl);
    try {
      const smRes = await safeFetch(smUrl);
      if (!smRes.ok || !smRes.text) continue;
      if (isSitemapIndex(smRes.text)) {
        const childLocs = extractLocsFromSitemap(smRes.text, origin, 50);
        for (const c of childLocs) {
          if (!seenSm.has(c)) sitemapQueue.push(c);
        }
      } else {
        for (const u of extractLocsFromSitemap(smRes.text, origin, maxUrls)) {
          discovered.add(u);
        }
      }
    } catch {
      /* skip bad sitemap */
    }
  }

  discovered.add(`${origin}/`);
  const home = await safeFetch(`${origin}/`);
  if (home.ok && home.text) {
    for (const l of extractInternalLinks(home.text, origin)) {
      discovered.add(l);
      if (discovered.size >= maxUrls) break;
    }
  }

  return { urls: [...discovered].slice(0, maxUrls), robotsBody };
}

async function crawlPages(origin, urls, robotsBody) {
  const pages = [];
  let idx = 0;

  async function worker() {
    while (idx < urls.length) {
      const i = idx++;
      const url = urls[i];
      try {
        const pathname = new URL(url).pathname;
        if (robotsBody && robotsDisallowsPath(robotsBody, pathname)) {
          pages[i] = { url, skipped: true, reason: 'robots.txt disallow', status: 0 };
          continue;
        }
        await assertSafeFetchUrl(url);
        if (FETCH_DELAY_MS) await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
        const res = await fetchUrl(url);
        const signals =
          res.ok && res.text && /html/i.test(res.contentType || '')
            ? parseHtmlSignals(res.text, res.url)
            : null;
        pages[i] = {
          url: res.url || url,
          ok: res.ok,
          status: res.status,
          error: res.error,
          title: signals?.title || '',
          metaDescription: signals?.metaDescription || '',
          robotsMeta: signals?.robotsMeta || '',
          canonical: signals?.canonical || '',
          hasJsonLd: Boolean(signals?.jsonLdValid),
          h1Count: signals?.h1Count ?? 0,
        };
      } catch (err) {
        pages[i] = { url, ok: false, status: 0, error: err.message };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker()));
  return pages.filter(Boolean);
}

function startCrawlJob({ maxUrls } = {}) {
  const profile = require('../companyKnowledge').getProfile();
  const origin = normalizeSiteUrl(profile.websiteUrl);
  if (!origin) throw new Error('Set website URL in Brand settings before crawling');

  const budget = Math.min(Math.max(1, Number(maxUrls) || DEFAULT_MAX_URLS), MAX_CAP);
  const id = `crawl-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const job = {
    id,
    status: 'queued',
    origin,
    maxUrls: budget,
    urlsDiscovered: 0,
    urlsCrawled: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    pages: [],
  };
  writeJob(job);
  const idx = readIndex();
  idx.jobs = [{ id, status: 'queued', startedAt: job.startedAt }, ...(idx.jobs || [])].slice(0, 30);
  writeIndex(idx);

  setImmediate(() => {
    void executeCrawlJob(id).catch((err) => {
      console.error('[SEO/GEO crawl]', id, err.message);
    });
  });

  return job;
}

async function executeCrawlJob(id) {
  if (runningJobs.has(id)) return;
  runningJobs.add(id);
  const job = readJob(id);
  if (!job) {
    runningJobs.delete(id);
    return;
  }

  job.status = 'running';
  writeJob(job);

  try {
    const { urls, robotsBody } = await discoverUrls(job.origin, job.maxUrls);
    job.urlsDiscovered = urls.length;
    writeJob(job);

    job.pages = await crawlPages(job.origin, urls, robotsBody);
    job.urlsCrawled = job.pages.length;
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    writeJob(job);

    const idx = readIndex();
    idx.latestCompletedId = id;
    idx.jobs = (idx.jobs || []).map((j) => (j.id === id ? { ...j, status: 'completed' } : j));
    writeIndex(idx);
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    job.completedAt = new Date().toISOString();
    writeJob(job);
    const idx = readIndex();
    idx.jobs = (idx.jobs || []).map((j) => (j.id === id ? { ...j, status: 'failed' } : j));
    writeIndex(idx);
  } finally {
    runningJobs.delete(id);
  }
}

function getCrawlJob(id) {
  return readJob(id);
}

function getLatestCompletedCrawl() {
  const idx = readIndex();
  if (idx.latestCompletedId) {
    const j = readJob(idx.latestCompletedId);
    if (j?.status === 'completed') return j;
  }
  const jobs = idx.jobs || [];
  for (const meta of jobs) {
    const j = readJob(meta.id);
    if (j?.status === 'completed') return j;
  }
  return null;
}

function listCrawlJobs(limit = 15) {
  const idx = readIndex();
  return (idx.jobs || []).slice(0, limit);
}

function getCrawlRecommendations(pages, origin) {
  return buildMultiPageRecommendations(pages, origin);
}

module.exports = {
  startCrawlJob,
  executeCrawlJob,
  getCrawlJob,
  getLatestCompletedCrawl,
  listCrawlJobs,
  getCrawlRecommendations,
  DEFAULT_MAX_URLS,
};
