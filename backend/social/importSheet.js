/**
 * Parse an uploaded content calendar (.xlsx or .csv) into validated rows.
 *
 * The file is untrusted input: it is size- and row-limited, an .xlsx (a zip) is checked for decompression
 * bombs before it is opened, cell text is clipped, and nothing in it is executed. Dates and times are
 * read tolerantly, but whatever was assumed is reported back so the owner confirms it in the preview.
 */
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const R = require('./platformRules');
const T = require('./timeUtil');

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 200;
const MAX_COLS = 30;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const HEADERS = {
  topic: ['topic', 'title', 'subject', 'idea', 'theme'],
  content: ['content', 'text', 'post', 'caption', 'copy', 'body', 'message'],
  date: ['date', 'day', 'postdate', 'publishdate'],
  time: ['time', 'at', 'posttime', 'publishtime'],
  platform: ['platform', 'platforms', 'channel', 'channels', 'network', 'networks'],
  hashtags: ['hashtags', 'hashtag', 'tags'],
  image: ['image', 'images', 'photo', 'picture', 'media', 'imageurl'],
};
const PLATFORM_ALIASES = { instagram: 'instagram', insta: 'instagram', ig: 'instagram', linkedin: 'linkedin', li: 'linkedin', facebook: 'facebook', fb: 'facebook', x: 'x', twitter: 'x', tweet: 'x' };

const clip = (v, n) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const pad = (n) => String(n).padStart(2, '0');

// ----------------------------------------------------------------------------------------------- cells

/** Reduce any spreadsheet cell shape (rich text, formula result, hyperlink, date...) to a string, Date or number. */
function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date || typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return cellValue(v.text);
    if ('error' in v) return '';
  }
  return String(v);
}

const isRealDate = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** @returns {{ date: string, note?: string } | { error: string } | null} null for blank */
function parseDate(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { error: 'The date could not be read.' };
    return { date: ymd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()) };
  }
  if (typeof value === 'number') {
    if (value > 20000 && value < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
      return { date: ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) };
    }
    return { error: `"${value}" is not a date.` };
  }
  const s = String(value).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(y, mo, d) ? { date: ymd(y, mo, d) } : { error: `"${s}" is not a real date.` };
  }
  m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(s);
  if (m) {
    let [d, mo] = [Number(m[1]), Number(m[2])];
    const y = Number(m[3]);
    let note;
    if (mo > 12 && d <= 12) {
      [d, mo] = [mo, d]; // clearly month/day (e.g. 11/25/2026)
      note = `"${s}" was read as month/day.`;
    } else if (d <= 12 && mo <= 12 && d !== mo) {
      note = `"${s}" was read as day/month (${ymd(y, mo, d)}). Check it is right.`;
    }
    return isRealDate(y, mo, d) ? { date: ymd(y, mo, d), note } : { error: `"${s}" is not a real date.` };
  }
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s) || /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s);
  if (m) {
    const dayFirst = /^\d/.test(m[1]);
    const d = Number(dayFirst ? m[1] : m[2]);
    const mo = MONTHS[String(dayFirst ? m[2] : m[1]).toLowerCase().slice(0, 4).replace(/\.$/, '')] || MONTHS[String(dayFirst ? m[2] : m[1]).toLowerCase().slice(0, 3)];
    const y = Number(m[3]);
    if (mo && isRealDate(y, mo, d)) return { date: ymd(y, mo, d) };
  }
  return { error: `"${clip(s, 30)}" is not a date I can read. Use YYYY-MM-DD or DD/MM/YYYY.` };
}

/** @returns {{ time: string } | { error: string } | null} */
function parseTime(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { error: 'The time could not be read.' };
    return { time: `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}` };
  }
  if (typeof value === 'number') {
    if (value >= 0 && value < 1) {
      const mins = Math.round(value * 1440);
      return { time: `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}` };
    }
    return { error: `"${value}" is not a time.` };
  }
  const s = String(value).trim().toLowerCase();
  let m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/.exec(s) || /^(\d{1,2})\s*([ap]\.?m\.?)$/.exec(s);
  if (!m) return { error: `"${clip(s, 20)}" is not a time. Use HH:MM (24-hour) or 10:30 AM.` };
  let h = Number(m[1]);
  const min = m.length === 4 ? Number(m[2]) : /^\d{1,2}\s*[ap]/.test(s) ? 0 : Number(m[2]);
  const mer = (m[m.length - 1] || '').replace(/\./g, '');
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59 || (mer && Number(m[1]) > 12)) return { error: `"${clip(s, 20)}" is not a valid time.` };
  return { time: `${pad(h)}:${pad(min)}` };
}

/** @returns {{ platforms: string[] } | { error: string }} empty list = "use the default platforms" */
function parsePlatforms(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s || ['all', 'any', '*', 'every', 'everywhere'].includes(s)) return { platforms: [] };
  const out = [];
  for (const token of s.split(/[,;/&|\n]+|\s+and\s+/).map((t) => t.trim()).filter(Boolean)) {
    const p = PLATFORM_ALIASES[token];
    if (!p) return { error: `Unknown platform "${clip(token, 20)}". Use Instagram, LinkedIn, Facebook or X.` };
    if (!out.includes(p)) out.push(p);
  }
  return { platforms: out };
}

function parseHashtags(value) {
  return String(value ?? '')
    .split(/[\s,;]+/)
    .map((t) => t.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 60))
    .filter(Boolean)
    .slice(0, 30);
}

// ----------------------------------------------------------------------------------------------- rows

/** Validate one normalized row (used after parsing, and again on the server when the owner confirms the preview). */
function validateRow(input, n) {
  const errors = [];
  const warnings = [...(input.warnings || [])];
  const content = clip(input.content, 6000);
  let topic = clip(input.topic, 200);
  if (!topic && !content) errors.push('Needs a topic or the post text.');
  if (!topic && content) topic = clip(content.split(/(?<=[.!?])\s|\n/)[0], 120);

  const platforms = Array.isArray(input.platforms) ? input.platforms.map(R.normalize) : [];
  if (platforms.some((p) => !R.isSupported(p))) errors.push('One of the platforms is not supported.');

  let date = input.date || null;
  if (date !== null && !(/^\d{4}-\d{2}-\d{2}$/.test(date) && isRealDate(+date.slice(0, 4), +date.slice(5, 7), +date.slice(8, 10)))) {
    errors.push('The date is not valid.');
    date = null;
  }
  let time = input.time || null;
  if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    errors.push('The time is not valid.');
    time = null;
  }
  const hashtags = Array.isArray(input.hashtags) ? input.hashtags.map((t) => String(t).replace(/^#+/, '').slice(0, 60)).filter(Boolean).slice(0, 30) : [];
  if (content && platforms.includes('x') && R.finalText({ text: content, hashtags }).length > 280) {
    warnings.push('This text is longer than an X post allows (280). You can shorten it in the review step.');
  }
  return { row: n ?? input.row ?? 0, topic, content, platforms, date, time, hashtags, errors: [...(input.errors || []), ...errors], warnings };
}

// ----------------------------------------------------------------------------------------------- file readers

/** RFC 4180-style CSV: quoted fields, embedded commas/newlines, BOM, and comma/semicolon/tab delimiters. */
function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (rows.length > MAX_ROWS + 5) break;
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  rows.forEach((r, i) => {
    r.n = i + 1;
  });
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

async function readXlsx(buffer) {
  // An .xlsx is a zip; refuse archives that would expand to something huge before opening them.
  const zip = await JSZip.loadAsync(buffer);
  let total = 0;
  for (const entry of Object.values(zip.files)) total += entry._data?.uncompressedSize || 0;
  if (total > MAX_UNZIPPED_BYTES) throw new Error('That spreadsheet is too large to import.');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('The spreadsheet has no sheets.');
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rows.length > MAX_ROWS + 5) return;
    const cells = [];
    for (let c = 1; c <= Math.min(sheet.columnCount, MAX_COLS); c += 1) cells.push(cellValue(row.getCell(c).value));
    cells.n = rowNumber;
    rows.push(cells);
  });
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const headerKey = (h) => String(h ?? '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * @param {{ buffer: Buffer, filename: string }} file
 * @returns {Promise<{ rows: object[], columns: Record<string, number>, ignored: string[], truncated: boolean }>}
 */
async function parseCalendarFile({ buffer, filename }) {
  if (!buffer || !buffer.length) throw new Error('The file is empty.');
  if (buffer.length > MAX_BYTES) throw new Error('The file is larger than 2MB.');
  const ext = (/\.([a-z0-9]+)$/i.exec(filename || '') || [])[1]?.toLowerCase();

  let grid;
  if (ext === 'csv' || ext === 'txt') grid = parseCsv(buffer.toString('utf8'));
  else if (ext === 'xlsx' || ext === 'xlsm') {
    if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) throw new Error('That file is not a valid .xlsx workbook.');
    grid = await readXlsx(buffer);
  } else if (ext === 'xls') throw new Error('Old .xls files are not supported. In Excel choose Save As, then .xlsx or .csv.');
  else throw new Error('Upload an .xlsx or .csv file.');

  if (grid.length < 2) throw new Error('The file needs a header row and at least one row of posts.');

  const headers = grid[0].map(headerKey);
  const columns = {};
  const ignored = [];
  headers.forEach((h, i) => {
    const field = Object.keys(HEADERS).find((f) => HEADERS[f].includes(h));
    if (field && !(field in columns)) columns[field] = i;
    else if (h) ignored.push(String(grid[0][i]).slice(0, 40));
  });
  if (!('topic' in columns) && !('content' in columns)) {
    throw new Error('Could not find a "Topic" or "Content" column. Download the template to see the expected columns.');
  }

  const body = grid.slice(1);
  const truncated = body.length > MAX_ROWS;
  const rows = body.slice(0, MAX_ROWS).map((cells, idx) => {
    const get = (f) => (f in columns ? cellValue(cells[columns[f]]) : '');
    const errors = [];
    const warnings = [];
    const d = parseDate(get('date'));
    const t = parseTime(get('time'));
    const p = parsePlatforms(get('platform'));
    if (d?.error) errors.push(d.error);
    if (d?.note) warnings.push(d.note);
    if (t?.error) errors.push(t.error);
    if (p.error) errors.push(p.error);
    if (columns.image !== undefined && String(cellValue(cells[columns.image])).trim()) warnings.push('The image column is not imported. Add images in the review step.');
    return validateRow(
      {
        topic: get('topic'),
        content: get('content'),
        platforms: p.platforms || [],
        date: d?.date || null,
        time: t?.time || null,
        hashtags: parseHashtags(get('hashtags')),
        errors,
        warnings,
      },
      cells.n || idx + 2 // spreadsheet row number (header is row 1)
    );
  });
  return { rows, columns, ignored, truncated };
}

/** CSV the owner can download and fill in. */
function templateCsv() {
  const lines = [
    'Topic,Content,Date,Time,Platforms,Hashtags',
    '"Our Diwali offer","Optional: your own post text, used exactly as written. Leave empty and AI writes it.",2026-11-12,10:30,"Instagram, LinkedIn","#diwali #yoga"',
    '"Meet our teachers",,2026-11-13,,,',
    '"Why Yin yoga helps after a long week",,13/11/2026,6:30 PM,Facebook,',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

async function templateXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Calendar');
  ws.columns = [
    { header: 'Topic', key: 'topic', width: 34 },
    { header: 'Content', key: 'content', width: 60 },
    { header: 'Date', key: 'date', width: 14, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Time', key: 'time', width: 10 },
    { header: 'Platforms', key: 'platforms', width: 24 },
    { header: 'Hashtags', key: 'hashtags', width: 26 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ topic: 'Our Diwali offer', content: 'Optional: your own post text, used exactly as written. Leave empty and AI writes it.', date: new Date(Date.UTC(2026, 10, 12)), time: '10:30', platforms: 'Instagram, LinkedIn', hashtags: '#diwali #yoga' });
  ws.addRow({ topic: 'Meet our teachers', date: new Date(Date.UTC(2026, 10, 13)) });
  ws.addRow({ topic: 'Why Yin yoga helps after a long week', date: new Date(Date.UTC(2026, 10, 14)), time: '6:30 PM', platforms: 'Facebook' });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { parseCalendarFile, validateRow, parseDate, parseTime, parsePlatforms, parseCsv, templateCsv, templateXlsx, MAX_ROWS, MAX_BYTES };
