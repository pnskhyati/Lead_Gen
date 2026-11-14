/**
 * Render JavaScript-only websites (React/Vue SPAs) in a headless browser so onboarding can still read them.
 *
 * Security model: the browser never touches the network. Every request it makes is intercepted and
 * answered by our SSRF-safe, DNS-pinned client (redirects included, hop by hop), and Chrome is started
 * with a host-resolver rule that makes any request the interceptor misses (WebSockets, prefetch, ...) fail.
 *
 * Needs a Chromium-based browser on the host: set CHROME_PATH, or install Chrome / Edge / Chromium.
 * Set RENDER_JS_SITES=off to disable.
 */
const fs = require('fs');

const NAV_TIMEOUT_MS = 20_000;
const MAX_REQUESTS = 60;
const BLOCKED_TYPES = new Set(['image', 'media', 'font', 'stylesheet', 'websocket', 'eventsource', 'manifest', 'other']);

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);

function findBrowser() {
  if (process.env.RENDER_JS_SITES === 'off') return null;
  return BROWSER_CANDIDATES.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || null;
}

function isAvailable() {
  return Boolean(findBrowser());
}

/**
 * A renderer shares one browser across several pages; call close() when the crawl finishes.
 * @param {{ fetchBuffer?: Function }} [deps] injectable network layer (tests)
 */
function createRenderer({ fetchBuffer = require('../seoGeo/safeFetch').fetchBuffer } = {}) {
  let browserPromise = null;

  async function getBrowser() {
    if (!browserPromise) {
      const executablePath = findBrowser();
      if (!executablePath) throw new Error('No Chrome/Edge/Chromium found for rendering JavaScript sites (set CHROME_PATH)');
      const puppeteer = require('puppeteer-core');
      const args = [
        '--disable-gpu',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--mute-audio',
        // Fail closed: nothing may resolve DNS itself — responses only ever come from our interceptor.
        '--host-resolver-rules=MAP * ~NOTFOUND',
      ];
      if (process.env.CHROME_NO_SANDBOX === 'true') args.push('--no-sandbox');
      browserPromise = puppeteer.launch({ executablePath, headless: true, args });
    }
    return browserPromise;
  }

  /** @returns {Promise<{ html: string, url: string }>} */
  async function render(url) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    let requests = 0;
    try {
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        try {
          requests += 1;
          if (requests > MAX_REQUESTS || request.method() !== 'GET' || BLOCKED_TYPES.has(request.resourceType())) {
            return await request.abort('blockedbyclient');
          }
          const res = await fetchBuffer(request.url(), { headers: { Accept: request.headers().accept || '*/*' } });
          const headers = { ...res.headers };
          // We already decoded/decompressed the body; do not let stale encoding headers corrupt it.
          for (const h of ['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie', 'content-security-policy']) delete headers[h];
          await request.respond({ status: res.status, headers, body: res.body });
        } catch {
          // Blocked by the SSRF guard, timed out, etc. — the page just does not get that resource.
          try {
            await request.abort('failed');
          } catch {
            /* request already handled */
          }
        }
      });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });
      await new Promise((r) => setTimeout(r, 400)); // let late client-side renders settle
      return { html: await page.content(), url: page.url() };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async function close() {
    if (!browserPromise) return;
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close().catch(() => undefined);
  }

  return { render, close };
}

module.exports = { createRenderer, isAvailable, findBrowser };
