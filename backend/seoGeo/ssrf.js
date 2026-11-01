const dns = require('dns').promises;
const { URL } = require('url');

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

function isPrivateIp(ip) {
  if (!ip) return true;
  const v = ip.toLowerCase();
  if (v === '::1' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;
  if (v.includes(':')) return false; // IPv6 public heuristic — block only loopback/link-local above
  const parts = v.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 127 || a === 0) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

async function assertSafeFetchUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error('Blocked host');
  }
  if (isPrivateIp(host)) {
    throw new Error('Blocked private address');
  }
  try {
    const looked = await dns.lookup(host, { all: true });
    for (const entry of looked) {
      if (isPrivateIp(entry.address)) {
        throw new Error('Host resolves to private network');
      }
    }
  } catch (err) {
    if (err.message.includes('private') || err.message.includes('Blocked')) throw err;
    // DNS failure — allow fetch to fail naturally for public hostnames
  }
  return u.href;
}

module.exports = { assertSafeFetchUrl, isPrivateIp };
