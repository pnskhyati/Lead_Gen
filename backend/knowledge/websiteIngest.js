/**
 * Crawl a company's public website for onboarding: homepage plus the pages most likely
 * to describe the business (about, services, pricing, contact, FAQ). SSRF-guarded.
 */
const { fetchUrl, normalizeSiteUrl } = require('../seoGeo/crawler');
const {
  htmlToText,
  extractTitle,
  extractMetaDescription,
  extractJsonLd,
  extractLinks,
} = require('./textExtract');

const renderPage = require('./renderPage');

const MAX_PAGES = 24;
const THIN_TEXT_CHARS = 400; // below this a page is almost certainly a JavaScript shell
const MAX_RENDERED_PAGES = 4;
const MAX_CHARS_PER_PAGE = 12_000;
const MAX_CONCURRENCY = 3;
const PRIORITY = /(about|service|product|pric|plan|contact|faq|team|treat|solution|offer|menu|location|hours|book|appointment|why)/i;
const SKIP = /\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|css|js|mp4|mp3|woff2?)(\?|$)|\/(wp-admin|wp-json|cart|checkout|login|signin|account|tag|category|feed)\b/i;

const EXCLUDED = -1000; // never crawl; low-priority pages (negative depth penalty) are still crawled

function scoreLink(url) {
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    return EXCLUDED;
  }
  if (SKIP.test(url)) return EXCLUDED;
  const depth = path.split('/').filter(Boolean).length;
  return (PRIORITY.test(path) ? 10 : 0) - depth;
}

const BOILERPLATE_LINE = /(cookie|accept all|manage preferences|privacy policy|terms (of|and) (service|use|conditions)|all rights reserved|subscribe to our newsletter|follow us on|sign up for (our|the)|skip to (main )?content|back to top|powered by)/i;

/**
 * Remove page chrome that would otherwise pollute retrieval: lines repeated across most pages
 * (menus, footers, taglines) and cookie / legal banners. Page text itself is left alone.
 */
function stripBoilerplate(pages) {
  const counts = new Map();
  for (const p of pages) {
    for (const line of new Set(p.text.split('\n').map((l) => l.trim()).filter(Boolean))) {
      counts.set(line, (counts.get(line) || 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  return pages.map((p) => ({
    ...p,
    text: p.text
      .split('\n')
      .filter((raw) => {
        const line = raw.trim();
        if (!line) return true;
        if (line.length < 160 && BOILERPLATE_LINE.test(line)) return false;
        return !(pages.length >= 2 && line.length < 160 && (counts.get(line) || 0) >= threshold);
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  }));
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * @returns {Promise<{ origin: string, pages: {url:string,title:string,description:string,text:string}[], structuredData: object[] }>}
 */
async function crawlCompanySite(websiteUrl, { renderer: injectedRenderer } = {}) {
  const origin = normalizeSiteUrl(websiteUrl);
  if (!origin) throw new Error('Enter a valid website address (for example acme.com)');

  // JavaScript-only sites ship an empty shell; fall back to a headless browser when the plain HTML is thin.
  const renderer = injectedRenderer || (renderPage.isAvailable() ? renderPage.createRenderer() : null);
  let renderedCount = 0;
  let renderTried = false;

  async function loadPage(url) {
    const res = await fetchUrl(url);
    const isHtml = res.ok && res.text && /html|text/i.test(res.contentType || 'text/html');
    if (isHtml && htmlToText(res.text).length < THIN_TEXT_CHARS && renderer && renderedCount < MAX_RENDERED_PAGES) {
      renderedCount += 1;
      renderTried = true;
      try {
        const out = await renderer.render(res.url || url);
        return { ...res, text: out.html, url: out.url || res.url, rendered: true };
      } catch (err) {
        console.warn('[Ingest] JS render failed for', url, err.message);
      }
    }
    return res;
  }

  try {
    return await crawlWith(origin, loadPage, () => ({ renderTried, rendererAvailable: Boolean(renderer) }));
  } finally {
    if (renderer && !injectedRenderer) await renderer.close();
  }
}

async function crawlWith(origin, loadPage, renderInfo) {
  const home = await loadPage(`${origin}/`);
  if (!home.ok || !home.text) {
    throw new Error(home.error || `Could not read ${origin} (HTTP ${home.status || 'error'})`);
  }

  const homeHost = new URL(home.url).hostname.replace(/^www\./, '');
  const sameSite = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '') === homeHost;
    } catch {
      return false;
    }
  };

  // The sitemap is the owner's own list of pages; it finds ones the home page does not link to.
  let sitemapUrls = [];
  try {
    const sm = await loadPage(`${new URL(home.url).origin}/sitemap.xml`);
    if (sm.ok && /<urlset/i.test(sm.text || '')) {
      sitemapUrls = [...String(sm.text).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
    }
  } catch {
    /* no sitemap is fine */
  }

  const candidates = [...new Set([...extractLinks(home.text, home.url), ...sitemapUrls])]
    .filter(sameSite)
    .map((url) => ({ url, score: scoreLink(url) }))
    .filter((c) => c.score > EXCLUDED && c.url.replace(/\/$/, '') !== home.url.replace(/\/$/, ''))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PAGES - 1)
    .map((c) => c.url);

  const fetched = await mapLimit(candidates, MAX_CONCURRENCY, (url) => loadPage(url));
  const rawPages = [home, ...fetched.filter((r) => r && r.ok && /html|text/i.test(r.contentType || 'text/html'))];

  const structuredData = [];
  const pages = [];
  const seenText = new Set();
  for (const r of rawPages) {
    structuredData.push(...extractJsonLd(r.text));
    const text = htmlToText(r.text).slice(0, MAX_CHARS_PER_PAGE);
    if (text.length < 80) continue;
    const fingerprint = text.slice(0, 300);
    if (seenText.has(fingerprint)) continue; // same page reached via two URLs
    seenText.add(fingerprint);
    pages.push({
      url: r.url,
      title: extractTitle(r.text),
      description: extractMetaDescription(r.text),
      text,
    });
  }

  const cleaned = stripBoilerplate(pages).filter((p) => p.text.length >= 80);
  pages.length = 0;
  pages.push(...cleaned);

  if (!pages.length) {
    const info = renderInfo();
    throw new Error(
      info.rendererAvailable
        ? 'The site returned no readable text even after rendering it. Upload a brochure or paste your details instead.'
        : 'The site returned no readable text. It looks JavaScript-rendered and this server has no browser to render it — upload a brochure or paste your details instead.'
    );
  }
  return {
    origin: home.url ? new URL(home.url).origin : origin,
    pages,
    structuredData,
    rendered: Boolean(home.rendered) || fetched.some((r) => r && r.rendered),
  };
}

/** One document body from the crawl, with page boundaries kept so chunks stay attributable. */
function pagesToDocumentText(pages) {
  return pages
    .map((p) => `# ${p.title || p.url}\nSource: ${p.url}\n${p.description ? `${p.description}\n` : ''}\n${p.text}`)
    .join('\n\n---\n\n');
}

module.exports = { crawlCompanySite, pagesToDocumentText, stripBoilerplate };
