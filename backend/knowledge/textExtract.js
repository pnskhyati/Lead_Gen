/**
 * Turn uploaded files and fetched web pages into clean plain text for the knowledge base.
 */
const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json', 'html', 'htm']);
const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const SUPPORTED_EXTS = new Set([...TEXT_EXTS, 'pdf', 'docx', ...Object.keys(IMAGE_MIME)]);

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&rsquo;': "'",
  '&lsquo;': "'",
  '&rdquo;': '"',
  '&ldquo;': '"',
  '&ndash;': '-',
  '&mdash;': '-',
  '&hellip;': '...',
  '&rupee;': '₹',
};

function decodeEntities(str) {
  return String(str || '')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ' ');
}

function extOf(fileName) {
  const m = /\.([a-z0-9]+)$/i.exec(String(fileName || ''));
  return m ? m[1].toLowerCase() : '';
}

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** HTML → readable text (drops scripts, styles, nav chrome; keeps headings and list structure). */
function htmlToText(html) {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(nav|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) => `\n\n${'#'.repeat(Number(lvl))} ${inner}\n\n`);
  s = s.replace(/<li\b[^>]*>/gi, '\n- ');
  s = s.replace(/<(br|hr)\b[^>]*>/gi, '\n');
  s = s.replace(/<\/(p|div|section|article|tr|ul|ol|table|header|main|blockquote)>/gi, '\n\n');
  s = s.replace(/<\/(td|th)>/gi, ' | ');
  s = s.replace(/<[^>]+>/g, ' ');
  return normalizeWhitespace(decodeEntities(s));
}

function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ''));
  return m ? normalizeWhitespace(decodeEntities(m[1].replace(/<[^>]+>/g, ' '))) : '';
}

function extractMetaDescription(html) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (/name=["']description["']/i.test(tag) || /property=["']og:description["']/i.test(tag)) {
      const c = /content=["']([^"']*)["']/i.exec(tag);
      if (c) return normalizeWhitespace(decodeEntities(c[1]));
    }
  }
  return '';
}

/** Pull schema.org JSON-LD blocks — often the most reliable source of hours, phone and address. */
function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore malformed block */
    }
  }
  return out;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const re = /<a\b[^>]*\bhref=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    if (m[1].trim().startsWith('#')) continue;
    try {
      const u = new URL(decodeEntities(m[1]), baseUrl);
      if (!['http:', 'https:'].includes(u.protocol)) continue;
      u.hash = '';
      links.add(u.href);
    } catch {
      /* ignore */
    }
  }
  return [...links];
}

function assertMagic(ext, buffer) {
  const head = buffer.subarray(0, 5).toString('latin1');
  if (ext === 'pdf' && !head.startsWith('%PDF')) throw new Error('File is not a valid PDF');
  if (ext === 'docx' && !head.startsWith('PK')) throw new Error('File is not a valid DOCX');
  if (ext === 'png' && !buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) throw new Error('File is not a valid PNG');
  if ((ext === 'jpg' || ext === 'jpeg') && !buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) throw new Error('File is not a valid JPEG');
  if (ext === 'webp' && !(head.startsWith('RIFF') && buffer.subarray(8, 12).toString('latin1') === 'WEBP')) throw new Error('File is not a valid WebP');
}

/** OCR through the multimodal model. `ocr` is injectable for tests. */
async function ocrBuffer(buffer, mimeType, ocr) {
  const run = ocr || require('../vertexAi').ocrDocument;
  try {
    return normalizeWhitespace(await run({ buffer, mimeType }));
  } catch (err) {
    throw new Error(`Could not read text from this scanned file (${err.message})`);
  }
}

/**
 * Extract text from an uploaded file buffer.
 * @returns {Promise<{ text: string, mimeType: string }>}
 */
async function extractFileText({ buffer, fileName, ocr }) {
  const ext = extOf(fileName);
  if (!SUPPORTED_EXTS.has(ext)) {
    throw new Error(`Unsupported file type ".${ext || '?'}". Use PDF, DOCX, TXT, MD, CSV, JSON or HTML.`);
  }
  assertMagic(ext, buffer);

  if (ext === 'pdf') {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    let text = '';
    try {
      text = normalizeWhitespace((await pdfParse(buffer)).text);
    } catch {
      // Damaged or unusual PDF structure: the vision model is more forgiving, so try OCR before giving up.
      text = '';
    }
    let ocrUsed = false;
    if (text.length < 20) {
      // Scanned / image-only PDF: read it with the vision model instead.
      text = await ocrBuffer(buffer, 'application/pdf', ocr);
      ocrUsed = true;
      if (text.length < 20) throw new Error('No readable text found in this PDF, even after OCR.');
    }
    return { text, mimeType: 'application/pdf', ocr: ocrUsed };
  }

  if (IMAGE_MIME[ext]) {
    const text = await ocrBuffer(buffer, IMAGE_MIME[ext], ocr);
    if (text.length < 20) throw new Error('No readable text found in this image.');
    return { text, mimeType: IMAGE_MIME[ext], ocr: true };
  }

  if (ext === 'docx') {
    const mammoth = require('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    const text = normalizeWhitespace(value);
    if (text.length < 20) throw new Error('No readable text found in this DOCX file');
    return {
      text,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  const raw = buffer.toString('utf8');
  if (ext === 'html' || ext === 'htm') return { text: htmlToText(raw), mimeType: 'text/html' };
  if (ext === 'json') {
    try {
      return { text: JSON.stringify(JSON.parse(raw), null, 2), mimeType: 'application/json' };
    } catch {
      return { text: normalizeWhitespace(raw), mimeType: 'application/json' };
    }
  }
  return { text: normalizeWhitespace(raw), mimeType: ext === 'csv' ? 'text/csv' : 'text/plain' };
}

module.exports = {
  SUPPORTED_EXTS,
  extOf,
  decodeEntities,
  normalizeWhitespace,
  htmlToText,
  extractTitle,
  extractMetaDescription,
  extractJsonLd,
  extractLinks,
  extractFileText,
};
