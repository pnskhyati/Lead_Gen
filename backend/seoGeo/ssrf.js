const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

function normalizeHost(h) {
  return String(h || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

/** True when `ip` is not a publicly routable address. Anything unparseable counts as unsafe. */
function isPrivateIp(ip) {
  const v = normalizeHost(ip);
  if (!v) return true;
  if (v.startsWith('::ffff:')) {
    const rest = v.slice(7);
    return rest.includes('.') ? isPrivateIp(rest) : true; // hex-form mapped IPv4: refuse
  }
  if (net.isIPv6(v)) {
    return v === '::1' || v === '::' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd');
  }
  if (!net.isIPv4(v)) return true;
  const [a, b] = v.split('.').map(Number);
  if (a === 127 || a === 0 || a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast / reserved
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
  const host = normalizeHost(u.hostname);
  if (BLOCKED_HOSTS.has(host) || /\.(local|localhost|internal)$/.test(host)) {
    throw new Error('Blocked host');
  }
  // Hostnames are vetted by the DNS lookup below; only literal IPs are checked directly.
  if (net.isIP(host) && isPrivateIp(host)) {
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
