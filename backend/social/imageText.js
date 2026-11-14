/**
 * Short headline on a generated image.
 *
 * Image models misspell words, so the picture is made WITHOUT text and the words are added afterwards in a headless
 * browser: spelling is exactly what we wrote, and the colors come from the brand's own style guide. If no browser is
 * installed the plain picture is kept (never a broken one).
 */
const { Type } = require('@google/genai');
const { findBrowser } = require('../knowledge/renderPage');

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);

const SCHEMA = {
  type: Type.OBJECT,
  properties: { headline: { type: Type.STRING }, sub: { type: Type.STRING } },
  required: ['headline', 'sub'],
};

/** Tidy model output: no hashtags, emoji, quotes or run-ons. Returns null when nothing usable is left. */
function cleanText(t) {
  const strip = (s, maxWords, maxChars) => {
    const plain = String(s || '')
      .replace(/[#@]\S+/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, '')
      .replace(/["“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return words(plain).slice(0, maxWords).join(' ').slice(0, maxChars).trim();
  };
  const headline = strip(t?.headline, 8, 60);
  if (!headline) return null;
  return { headline, sub: strip(t?.sub, 14, 90) };
}

/** Write the words for one post's image from the post itself, so nothing is invented. */
async function writeOverlayText(vertex, post, ctx) {
  if (!vertex?.generateJson) return null;
  const prompt = `Write the text that goes ON the image of this social media post for ${ctx.company}${ctx.industry ? ` (${ctx.industry})` : ''}.
- headline: at most 7 words. A hook that makes the right customer stop scrolling and want to read the post.
- sub: at most 12 words. One concrete benefit or call to action that the post itself states.
Use only what the post says: no invented prices, numbers, discounts, awards or claims. No hashtags, emoji or quotation marks. Same language as the post.

Post (${post.platform}):
"""${clip(post.text, 900)}"""`;
  try {
    return cleanText(await vertex.generateJson(prompt, SCHEMA, undefined, { thinkingLevel: 'MINIMAL' }));
  } catch (err) {
    console.warn('[ImageText] could not write the headline:', err.message);
    return null;
  }
}

// -------------------------------------------------------------------------------------------- colors

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function saturation([r, g, b]) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
const luma = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** The brand's most vivid mid-to-light color, for the accent bar. */
function accentFrom(palette) {
  const usable = (palette || [])
    .filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex))
    .map((c) => ({ hex: c.hex, rgb: hexToRgb(c.hex) }))
    .filter((c) => luma(c.rgb) > 0.35 && saturation(c.rgb) > 0.25)
    .sort((a, b) => saturation(b.rgb) - saturation(a.rgb));
  return usable[0]?.hex || '#ffffff';
}

// -------------------------------------------------------------------------------------------- compose

function pageHtml({ dataUrl, headline, sub, footer, accent }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000}
.wrap{position:relative;width:100vw;height:100vh;overflow:hidden}
.wrap img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.78) 0%,rgba(0,0,0,.55) 24%,rgba(0,0,0,0) 52%)}
.copy{position:absolute;left:7%;right:7%;bottom:7%;color:#fff;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif}
.bar{width:11%;height:.7vmin;min-height:4px;background:${accent};border-radius:99px;margin-bottom:2.4vmin}
h1{font-size:6.4vmin;line-height:1.1;font-weight:800;letter-spacing:-.01em;text-shadow:0 .2vmin 1.2vmin rgba(0,0,0,.45)}
p.sub{font-size:3.3vmin;line-height:1.3;font-weight:500;margin-top:1.6vmin;opacity:.94;text-shadow:0 .2vmin 1vmin rgba(0,0,0,.45)}
p.foot{font-size:2.5vmin;font-weight:600;letter-spacing:.06em;margin-top:2.6vmin;color:${accent};text-transform:lowercase}
</style></head><body><div class="wrap"><img id="bg" src="${dataUrl}"><div class="scrim"></div>
<div class="copy"><div class="bar"></div><h1>${esc(headline)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${footer ? `<p class="foot">${esc(footer)}</p>` : ''}</div></div></body></html>`;
}

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    const executablePath = findBrowser();
    if (!executablePath) throw new Error('No Chrome/Edge/Chromium found');
    const args = ['--disable-gpu', '--disable-extensions', '--disable-dev-shm-usage', '--no-first-run', '--mute-audio', '--host-resolver-rules=MAP * ~NOTFOUND'];
    if (process.env.CHROME_NO_SANDBOX === 'true') args.push('--no-sandbox');
    browserPromise = require('puppeteer-core')
      .launch({ executablePath, headless: true, args })
      .then((b) => {
        b.on('disconnected', () => {
          browserPromise = null;
        });
        return b;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

function isAvailable() {
  return Boolean(findBrowser());
}

/** Image size without a library: read it from the PNG / JPEG header. */
function dimensions(buf) {
  if (buf.length > 24 && buf.subarray(1, 4).toString('latin1') === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i + 9 < buf.length; ) {
      if (buf[i] !== 0xff) return null;
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/**
 * @param {{ buffer: Buffer, mime: string, text: { headline: string, sub?: string }, footer?: string, palette?: { hex: string }[] }} o
 * @returns {Promise<Buffer|null>} PNG with the words on it, or null if it could not be done
 */
async function compose({ buffer, mime, text, footer, palette }) {
  if (!text?.headline) return null;
  const size = dimensions(buffer) || { w: 1024, h: 1024 };
  const w = Math.min(Math.max(size.w, 512), 2048);
  const h = Math.round((w * size.h) / size.w);
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith('data:') || r.url() === 'about:blank' ? r.continue() : r.abort('blockedbyclient')));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const html = pageHtml({ dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, headline: text.headline, sub: text.sub, footer, accent: accentFrom(palette) });
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    return Buffer.from(await page.screenshot({ type: 'png' }));
  } catch (err) {
    console.warn('[ImageText] could not add the headline:', err.message);
    return null;
  } finally {
    await page?.close().catch(() => undefined);
  }
}

async function close() {
  const b = await browserPromise?.catch(() => null);
  browserPromise = null;
  if (b) await b.close().catch(() => undefined);
}

/** "https://www.tecavy.com/about" -> "tecavy.com" */
function domainOf(url) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

module.exports = { writeOverlayText, compose, cleanText, accentFrom, dimensions, domainOf, isAvailable, close };
