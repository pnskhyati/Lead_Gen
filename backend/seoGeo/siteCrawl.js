const { fetchUrl, parseHtmlSignals, normalizeSiteUrl } = require('./crawler');
const { rec } = require('./rules');

const DEFAULT_MAX_PAGES = 20;
const CONCURRENCY = 4;

function extractSitemapLocs(xml, origin, limit = DEFAULT_MAX_PAGES) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(String(xml || ''))) && locs.length < limit * 3) {
    try {
      const u = new URL(m[1].trim());
      if (u.origin === origin || m[1].includes(origin.replace(/^https?:\/\//, ''))) {
        locs.push(u.href);
      }
    } catch {
      /* skip */
    }
  }
  const unique = [...new Set(locs)];
  const prioritized = unique.sort((a, b) => {
    const score = (url) => {
      let s = 0;
      if (/\/$/.test(url) || url.endsWith(origin)) s += 3;
      if (/faq|service|about|contact|pricing/i.test(url)) s += 2;
      return s;
    };
    return score(b) - score(a);
  });
  return prioritized.slice(0, limit);
}

async function mapPool(items, fn, poolSize) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(poolSize, items.length) }, () => worker()));
  return results;
}

async function crawlSitePages(origin, sitemapXml, { maxPages = DEFAULT_MAX_PAGES } = {}) {
  let urls = extractSitemapLocs(sitemapXml, origin, maxPages);
  if (!urls.includes(`${origin}/`)) urls.unshift(`${origin}/`);
  urls = [...new Set(urls)].slice(0, maxPages);

  const pages = await mapPool(
    urls,
    async (url) => {
      const res = await fetchUrl(url);
      const signals =
        res.ok && res.text && /html/i.test(res.contentType || '')
          ? parseHtmlSignals(res.text, res.url)
          : null;
      return {
        url: res.url || url,
        ok: res.ok,
        status: res.status,
        error: res.error,
        title: signals?.title || '',
        metaDescription: signals?.metaDescription || '',
        robotsMeta: signals?.robotsMeta || '',
        hasJsonLd: Boolean(signals?.jsonLdValid),
      };
    },
    CONCURRENCY
  );

  return { urlsCrawled: pages.length, pages };
}

function buildMultiPageRecommendations(pages, origin) {
  const out = [];
  if (!pages?.length) return out;

  const errors = pages.filter((p) => !p.ok || p.status >= 400);
  if (errors.length) {
    out.push(
      rec({
        id: 'tech-multipage-errors',
        category: 'technical_seo',
        confirmationLevel: 'confirmed',
        factors: { impact: 75, severity: 70, confidence: 92, urgency: 60, effort: 50 },
        title: 'Some sitemap URLs return errors',
        evidence: errors.slice(0, 5).map((p) => `${p.url} → HTTP ${p.status || 'error'} ${p.error || ''}`.trim()),
        affectedUrls: errors.map((p) => p.url),
        businessImpact: 'Broken URLs waste crawl budget and block discovery.',
        recommendedAction: 'Fix or remove failing URLs from sitemap; set up 301s where appropriate.',
        verificationMethod: 'Re-audit after deploy; confirm 200 in browser.',
      })
    );
  }

  const missingTitles = pages.filter((p) => p.ok && !p.title);
  if (missingTitles.length) {
    out.push(
      rec({
        id: 'tech-multipage-missing-titles',
        category: 'technical_seo',
        confirmationLevel: 'confirmed',
        factors: { impact: 62, severity: 58, confidence: 90, urgency: 50, effort: 40 },
        title: 'Multiple pages are missing title tags',
        evidence: missingTitles.slice(0, 6).map((p) => p.url),
        affectedUrls: missingTitles.map((p) => p.url),
        businessImpact: 'Weak or missing titles reduce relevance for target queries.',
        recommendedAction: 'Add unique, descriptive titles on each important service/FAQ URL.',
        verificationMethod: 'Re-crawl via Re-audit or inspect HTML source.',
      })
    );
  }

  const thinMeta = pages.filter((p) => p.ok && p.title && !p.metaDescription);
  if (thinMeta.length >= 3) {
    out.push(
      rec({
        id: 'tech-multipage-missing-meta',
        category: 'technical_seo',
        confirmationLevel: 'heuristic',
        factors: { impact: 48, severity: 42, confidence: 85, urgency: 35, effort: 45 },
        title: 'Several pages lack meta descriptions',
        evidence: [`${thinMeta.length} of ${pages.length} crawled URLs missing meta description.`],
        affectedUrls: thinMeta.slice(0, 8).map((p) => p.url),
        businessImpact: 'Snippets may be less compelling in search results.',
        recommendedAction: 'Add meta descriptions on key landing and service pages.',
        verificationMethod: 'Re-audit after publishing updates.',
      })
    );
  }

  return out;
}

module.exports = {
  crawlSitePages,
  buildMultiPageRecommendations,
  extractSitemapLocs,
  DEFAULT_MAX_PAGES,
};
