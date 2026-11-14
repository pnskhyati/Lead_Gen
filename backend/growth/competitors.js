/**
 * Competitor watch: the owner lists competitor pages (pricing, offers, home); we read each one on a schedule and
 * report what changed. We only read public pages and keep a plain-text snapshot, nothing else.
 */
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');
const { Type } = require('@google/genai');
const { store } = require('./store');

const MAX_WATCH = 10;
const MAX_LINES = 300;
const MIN_CHANGED_LINES = 3; // ignore tiny edits such as a date or a counter

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

/** Only public web addresses. Stops anyone from using this to reach machines inside our own network. */
async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    throw new Error('That is not a valid web address.');
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http and https addresses are allowed.');
  if (u.username || u.password) throw new Error('Remove the username and password from the address.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('That address is not public.');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('That address is not public.');
  return u.toString();
}

async function fetchPage(url) {
  let target = url;
  for (let hop = 0; hop < 4; hop += 1) {
    target = await assertPublicUrl(target);
    const res = await axios.get(target, {
      timeout: 15000,
      maxContentLength: 2_000_000,
      maxRedirects: 0,
      validateStatus: (s) => s < 400,
      responseType: 'text',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TecavyWatch/1.0)', Accept: 'text/html' },
    });
    if (res.status >= 300 && res.headers.location) {
      target = new URL(res.headers.location, target).toString();
      continue;
    }
    return String(res.data);
  }
  throw new Error('Too many redirects.');
}

function toText(html) {
  const title = (String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  const body = String(html)
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8377;|&rupee;/g, '₹');
  const seen = new Set();
  const lines = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 4 || seen.has(line)) continue;
    seen.add(line);
    lines.push(line.slice(0, 200));
    if (lines.length >= MAX_LINES) break;
  }
  const prices = [...new Set(lines.join(' ').match(/(?:₹|\$|€|£|Rs\.?)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:\/|per)\s?\w+)?/gi) || [])].slice(0, 30);
  return { title, lines, prices };
}

const hashOf = (lines) => crypto.createHash('sha1').update(lines.join('\n')).digest('hex');

function diffSnapshots(before, after) {
  const old = new Set(before.lines);
  const now = new Set(after.lines);
  const added = after.lines.filter((l) => !old.has(l));
  const removed = before.lines.filter((l) => !now.has(l));
  const oldPrices = new Set(before.prices || []);
  const priceChanges = { added: (after.prices || []).filter((p) => !oldPrices.has(p)), removed: (before.prices || []).filter((p) => !(after.prices || []).includes(p)) };
  const meaningful = added.length + removed.length >= MIN_CHANGED_LINES || priceChanges.added.length + priceChanges.removed.length > 0;
  return { added, removed, priceChanges, meaningful };
}

function list(ws) {
  return store.read(ws).competitors.list;
}

async function add({ url, label }, ws) {
  const clean = await assertPublicUrl(url);
  let created = null;
  store.update((s) => {
    if (s.competitors.list.length >= MAX_WATCH) throw new Error(`You can watch up to ${MAX_WATCH} pages.`);
    if (s.competitors.list.some((c) => c.url === clean)) throw new Error('You already watch that page.');
    created = { id: `cw-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`, url: clean, label: String(label || new URL(clean).hostname).slice(0, 80), addedAt: new Date().toISOString(), lastCheckedAt: null, lastError: null };
    s.competitors.list.push(created);
  }, ws);
  return created;
}

function remove(id, ws) {
  store.update((s) => {
    const c = s.competitors.list.find((x) => x.id === id);
    s.competitors.list = s.competitors.list.filter((x) => x.id !== id);
    if (c) delete s.competitors.snapshots[c.url];
  }, ws);
}

function changes(ws) {
  return store.read(ws).competitors.changes;
}

function markSeen(id, ws) {
  store.update((s) => {
    const c = s.competitors.changes.find((x) => x.id === id);
    if (c) c.seen = true;
  }, ws);
}

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: { summary: { type: Type.STRING }, whatItMeansForUs: { type: Type.STRING } },
  required: ['summary'],
};

async function summarise(vertex, { label, diff }) {
  const plain = () => {
    const bits = [];
    if (diff.priceChanges.added.length || diff.priceChanges.removed.length) bits.push(`Prices on the page changed (now showing ${diff.priceChanges.added.slice(0, 4).join(', ') || 'none new'}).`);
    if (diff.added.length) bits.push(`New text includes: "${diff.added.slice(0, 2).join('"; "')}".`);
    if (diff.removed.length) bits.push(`${diff.removed.length} lines were removed.`);
    return bits.join(' ') || 'The page changed.';
  };
  if (!vertex?.generateJson) return plain();
  try {
    const out = await vertex.generateJson(
      `A competitor page we watch ("${label}") changed. Describe the change in two plain sentences, using only the lines below. Do not guess anything that is not shown.\n\nNEW LINES:\n${diff.added.slice(0, 25).join('\n')}\n\nREMOVED LINES:\n${diff.removed.slice(0, 15).join('\n')}\n\nNEW PRICES SHOWN: ${diff.priceChanges.added.join(', ') || 'none'}\nPRICES NO LONGER SHOWN: ${diff.priceChanges.removed.join(', ') || 'none'}`,
      SUMMARY_SCHEMA,
      'You summarise changes on competitor web pages for a small business owner. Be factual and brief.',
      { thinkingLevel: 'LOW' }
    );
    return String(out?.summary || '').trim().slice(0, 400) || plain();
  } catch {
    return plain();
  }
}

/** Reads every watched page, records the first look as a baseline, and reports real changes. */
async function scan({ vertex, fetch = fetchPage, now = () => Date.now() } = {}, ws) {
  const found = [];
  for (const c of list(ws)) {
    try {
      const snap = toText(await fetch(c.url));
      if (!snap.lines.length) throw new Error('The page had no readable text.');
      const prev = store.read(ws).competitors.snapshots[c.url];
      const record = { hash: hashOf(snap.lines), title: snap.title, lines: snap.lines, prices: snap.prices, fetchedAt: new Date(now()).toISOString() };
      let change = null;
      if (prev && prev.hash !== record.hash) {
        const diff = diffSnapshots(prev, record);
        if (diff.meaningful) {
          change = {
            id: `cc-${now()}-${crypto.randomBytes(2).toString('hex')}`,
            competitorId: c.id,
            url: c.url,
            label: c.label,
            detectedAt: new Date(now()).toISOString(),
            summary: await summarise(vertex, { label: c.label, diff }),
            added: diff.added.slice(0, 10),
            removed: diff.removed.slice(0, 10),
            priceChanges: diff.priceChanges,
            seen: false,
            actioned: false,
          };
        }
      }
      store.update((s) => {
        s.competitors.snapshots[c.url] = record;
        const item = s.competitors.list.find((x) => x.id === c.id);
        if (item) {
          item.lastCheckedAt = record.fetchedAt;
          item.lastError = null;
        }
        if (change) s.competitors.changes = [change, ...s.competitors.changes].slice(0, 50);
      }, ws);
      if (change) found.push(change);
    } catch (err) {
      store.update((s) => {
        const item = s.competitors.list.find((x) => x.id === c.id);
        if (item) {
          item.lastCheckedAt = new Date(now()).toISOString();
          item.lastError = String(err.message || err).slice(0, 200);
        }
      }, ws);
    }
  }
  return found;
}

module.exports = { add, remove, list, changes, markSeen, scan, toText, diffSnapshots, assertPublicUrl, isPrivateIp };
