/**
 * SSRF-safe HTTP client.
 *
 * The pre-flight check in ssrf.js resolves a hostname and then lets fetch resolve it again, which leaves a
 * DNS-rebinding window (the name can answer with a public IP first and 127.0.0.1 second). Here the address
 * check happens inside the connection's own DNS lookup, so the IP that was validated is the IP that is used.
 * Literal-IP hosts skip DNS entirely and are vetted by assertSafeFetchUrl before the request.
 */
const dns = require('dns');
const { Agent, fetch: undiciFetch } = require('undici');
const { isPrivateIp, assertSafeFetchUrl } = require('./ssrf');

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT = 'Nexora-Crawler/1.0 (+https://nexora.local; site-reading)';

/**
 * Build a dns.lookup replacement that refuses to hand back a non-public address.
 * @param {{ resolver?: Function, isPrivate?: (ip: string) => boolean }} [opts] injectable for tests
 */
function createSafeLookup({ resolver = dns.lookup, isPrivate = isPrivateIp } = {}) {
  return function safeLookup(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    resolver(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: 4 }];
      const blocked = list.find((a) => isPrivate(a.address));
      if (blocked) {
        const e = new Error(`Blocked: ${hostname} resolves to a private address`);
        e.code = 'ESSRF';
        return callback(e);
      }
      if (options && options.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}

function createSafeFetch(lookupOpts) {
  const agent = new Agent({ connect: { lookup: createSafeLookup(lookupOpts) } });

  /** fetch() through the pinned agent. Redirects are NOT followed; callers vet each hop. */
  function safeFetch(url, init = {}) {
    return undiciFetch(url, { ...init, redirect: 'manual', dispatcher: agent });
  }

  /**
   * GET a URL and return the raw bytes (size- and time-limited) without following redirects.
   * @returns {Promise<{status:number, headers:Record<string,string>, body:Buffer, url:string}>}
   */
  async function fetchBuffer(url, { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_BODY_BYTES } = {}) {
    await assertSafeFetchUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await safeFetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers },
      });
      const chunks = [];
      let total = 0;
      for await (const chunk of res.body || []) {
        total += chunk.length;
        if (total > maxBytes) {
          controller.abort();
          break;
        }
        chunks.push(chunk);
      }
      const outHeaders = {};
      res.headers.forEach((v, k) => {
        outHeaders[k] = v;
      });
      return { status: res.status, headers: outHeaders, body: Buffer.concat(chunks), url };
    } finally {
      clearTimeout(timer);
    }
  }

  return { safeFetch, fetchBuffer, agent };
}

const defaultClient = createSafeFetch();

module.exports = {
  createSafeLookup,
  createSafeFetch,
  safeFetch: defaultClient.safeFetch,
  fetchBuffer: defaultClient.fetchBuffer,
  USER_AGENT,
};
