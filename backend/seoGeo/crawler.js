/**
 * Lightweight public-site crawler for SEO/GEO audits (no headless browser).
 */
const MAX_BODY = 600_000;
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT = 'Nexora-SEO-Audit/1.0 (+https://nexora.local; audit-only)';

function normalizeSiteUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    return u.origin;
  } catch {
    return null;
  }
}

async function fetchUrl(url, { maxRedirects = 4, skipSsrf = false } = {}) {
  if (!skipSsrf) {
    const { assertSafeFetchUrl } = require('./ssrf');
    await assertSafeFetchUrl(url);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = url;
    let redirects = 0;
    while (redirects <= maxRedirects) {
      const res = await fetch(current, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,text/plain,application/xml,*/*;q=0.8',
        },
        redirect: 'manual',
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) {
          return { ok: false, url: current, status: res.status, error: 'Redirect without location' };
        }
        current = new URL(loc, current).href;
        redirects += 1;
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      const buf = await res.arrayBuffer();
      const truncated = buf.byteLength > MAX_BODY;
      const text = Buffer.from(truncated ? buf.slice(0, MAX_BODY) : buf).toString('utf8');

      return {
        ok: res.ok,
        url: current,
        status: res.status,
        contentType,
        text,
        truncated,
        redirectCount: redirects,
      };
    }
    return { ok: false, url: current, status: 0, error: 'Too many redirects' };
  } catch (err) {
    return {
      ok: false,
      url,
      status: 0,
      error: err.name === 'AbortError' ? 'Request timed out' : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseHtmlSignals(html, pageUrl) {
  const text = String(html || '');
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const metaDesc =
    text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
    text.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ||
    '';

  const robotsMeta =
    text.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
    text.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i)?.[1] ||
    '';

  const canonical =
    text.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)?.[1] ||
    text.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i)?.[1] ||
    '';

  const jsonLdBlocks = [];
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(text))) {
    const block = m[1].trim();
    if (block) jsonLdBlocks.push(block);
  }

  let jsonLdValid = false;
  let jsonLdTypes = [];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const t = node['@type'];
        if (t) jsonLdTypes.push(String(t));
      }
      jsonLdValid = true;
    } catch {
      /* invalid block */
    }
  }

  const h1Count = (text.match(/<h1[\s>]/gi) || []).length;

  return {
    pageUrl,
    title,
    metaDescription: metaDesc.trim(),
    robotsMeta: robotsMeta.trim().toLowerCase(),
    canonical: canonical.trim(),
    jsonLdBlocks,
    jsonLdValid,
    jsonLdTypes: [...new Set(jsonLdTypes)],
    h1Count,
  };
}

function analyzeRobotsTxt(body, origin) {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map((l) => l.trim());
  let disallowAll = false;
  let sitemapUrls = [];
  let inWildcardAgent = false;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const lower = line.toLowerCase();
    if (lower.startsWith('user-agent:')) {
      const agent = lower.slice('user-agent:'.length).trim();
      inWildcardAgent = agent === '*';
    } else if (inWildcardAgent && lower.startsWith('disallow:')) {
      const path = line.slice(line.indexOf(':') + 1).trim();
      if (path === '/' || path === '/*') disallowAll = true;
    } else if (lower.startsWith('sitemap:')) {
      const sm = line.slice(line.indexOf(':') + 1).trim();
      if (sm) sitemapUrls.push(sm);
    }
  }

  if (!sitemapUrls.length) {
    sitemapUrls.push(`${origin}/sitemap.xml`);
  }

  return { disallowAll, sitemapUrls: [...new Set(sitemapUrls)] };
}

async function crawlPublicSite(websiteUrl) {
  const origin = normalizeSiteUrl(websiteUrl);
  if (!origin) {
    return {
      ok: false,
      origin: null,
      error: 'No valid website URL in brand profile',
      homepage: null,
      robots: null,
      sitemap: null,
      signals: null,
    };
  }

  const [robotsRes, homeRes] = await Promise.all([
    fetchUrl(`${origin}/robots.txt`),
    fetchUrl(`${origin}/`),
  ]);

  const robotsAnalysis =
    robotsRes.ok && robotsRes.text
      ? analyzeRobotsTxt(robotsRes.text, origin)
      : { disallowAll: false, sitemapUrls: [`${origin}/sitemap.xml`] };

  let sitemap = null;
  const smUrl = robotsAnalysis.sitemapUrls[0];
  if (smUrl) {
    const smRes = await fetchUrl(smUrl);
    sitemap = {
      url: smUrl,
      ok: smRes.ok,
      status: smRes.status,
      error: smRes.error,
      text: smRes.text || '',
      looksLikeXml: /<\?xml|<urlset|<sitemapindex/i.test(smRes.text || ''),
    };
  }

  const signals = homeRes.ok && homeRes.text ? parseHtmlSignals(homeRes.text, homeRes.url) : null;

  return {
    ok: homeRes.ok,
    origin,
    error: homeRes.error,
    homepage: {
      url: homeRes.url,
      ok: homeRes.ok,
      status: homeRes.status,
      redirectCount: homeRes.redirectCount || 0,
      error: homeRes.error,
    },
    robots: {
      url: `${origin}/robots.txt`,
      ok: robotsRes.ok,
      status: robotsRes.status,
      disallowAll: robotsAnalysis.disallowAll,
      fetched: robotsRes.ok,
    },
    sitemap,
    signals,
  };
}

module.exports = {
  normalizeSiteUrl,
  fetchUrl,
  parseHtmlSignals,
  analyzeRobotsTxt,
  crawlPublicSite,
};
