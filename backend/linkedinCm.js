/**
 * LinkedIn through the app that has the Community Management API: read comments on our posts, reply, read post numbers.
 * Posting keeps using the original LinkedIn connection. This one is only for reading and replying.
 */
const axios = require('axios');
const store = require('./linkedinCmStore');
const oauthState = require('./oauthState');
const postStore = require('./social/postStore');
const connections = require('./social/connections');

const API = 'https://api.linkedin.com/rest';
// Only permissions LinkedIn granted this app (see its Auth tab). It has no "openid" and no "r_member_social", so comments on a
// personal profile cannot be read; analytics for member posts and everything for Company Page posts can.
const DEFAULT_SCOPES = 'r_basicprofile r_member_postAnalytics w_member_social w_member_social_feed r_organization_social r_organization_social_feed w_organization_social_feed rw_organization_admin';

const env = () => ({
  clientId: process.env.LINKEDIN_CM_CLIENT_ID || '',
  clientSecret: process.env.LINKEDIN_CM_CLIENT_SECRET || '',
  redirectUri: process.env.LINKEDIN_CM_REDIRECT_URI || '',
  version: process.env.LINKEDIN_API_VERSION || '202510',
  scopes: process.env.LINKEDIN_CM_SCOPES || DEFAULT_SCOPES,
});

function missingSettings() {
  const e = env();
  return [
    !e.clientId && 'LINKEDIN_CM_CLIENT_ID',
    !e.clientSecret && 'LINKEDIN_CM_CLIENT_SECRET',
    !e.redirectUri && 'LINKEDIN_CM_REDIRECT_URI',
  ].filter(Boolean);
}

const isConfigured = () => missingSettings().length === 0;

function isExpired(account) {
  return Boolean(account?.expiresAt) && new Date(account.expiresAt).getTime() < Date.now();
}

function getStatus() {
  const account = store.getAccount();
  const missing = missingSettings();
  return {
    configured: missing.length === 0,
    missing,
    connected: Boolean(account?.accessToken) && !isExpired(account),
    expired: isExpired(account),
    account: account ? { name: account.name || null, urn: account.urn || null, connectedAt: account.connectedAt, expiresAt: account.expiresAt || null, scopes: account.scopes || [] } : null,
  };
}

function authUrl(state) {
  const e = env();
  if (!isConfigured()) throw new Error(`LinkedIn comments and analytics are not set up. Missing in the backend settings: ${missingSettings().join(', ')}`);
  const p = new URLSearchParams({ response_type: 'code', client_id: e.clientId, redirect_uri: e.redirectUri, scope: e.scopes, state });
  return `https://www.linkedin.com/oauth/v2/authorization?${p.toString()}`;
}

async function completeOAuth(code, ws) {
  const e = env();
  const { data } = await axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    new URLSearchParams({ grant_type: 'authorization_code', code, client_id: e.clientId, client_secret: e.clientSecret, redirect_uri: e.redirectUri }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
  );
  const accessToken = data.access_token;
  const scopes = String(data.scope || '').split(/[ ,]+/).filter(Boolean);

  // Who signed in: from the sign-in profile when allowed, otherwise from the LinkedIn account already linked for posting.
  let urn = null;
  let name = null;
  // A member's id is different in each LinkedIn app, so it must come from THIS app's own sign-in, not from the posting app.
  try {
    const me = await axios.get('https://api.linkedin.com/v2/me', { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20000 });
    if (me.data?.id) urn = `urn:li:person:${me.data.id}`;
    name = [me.data?.localizedFirstName, me.data?.localizedLastName].filter(Boolean).join(' ') || null;
  } catch {
    /* the basic profile permission may be missing */
  }
  if (!urn) name = name || connections.getLinkedInLink(ws)?.name || null;
  return store.setAccount({
    accessToken,
    refreshToken: data.refresh_token || null,
    expiresAt: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null,
    scopes,
    urn,
    name,
    connectedAt: new Date().toISOString(),
  });
}

function headers(account) {
  return { Authorization: `Bearer ${account.accessToken}`, 'Linkedin-Version': env().version, 'X-Restli-Protocol-Version': '2.0.0' };
}

function requireAccount() {
  const account = store.getAccount();
  if (!account?.accessToken) throw new Error('LinkedIn comments and analytics are not connected');
  if (isExpired(account)) throw new Error('The LinkedIn sign-in has expired. Reconnect it in Connections.');
  return account;
}

const enc = (urn) => encodeURIComponent(urn);

/** The post that a comment belongs to, taken from the comment's own id: urn:li:comment:(urn:li:activity:1,2) */
function postOfComment(commentUrn) {
  return String(commentUrn).match(/^urn:li:comment:\((.+),\d+\)$/)?.[1] || null;
}

/** Top-level comments others left on our recent LinkedIn posts. */
async function fetchRecentComments({ limitPosts = 8 } = {}) {
  const account = requireAccount();
  const posts = postStore
    .listPosts({ status: 'published', platform: 'linkedin' })
    .filter((p) => p.platformPostId)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, limitPosts);
  const out = [];
  for (const post of posts) {
    const { data } = await axios.get(`${API}/socialActions/${enc(post.platformPostId)}/comments`, { headers: headers(account), params: { count: 50 }, timeout: 20000 });
    for (const c of data.elements || []) {
      const urn = c['$URN'] || c.commentUrn;
      if (!urn || c.parentComment) continue;
      if (account.urn && c.actor === account.urn) continue;
      const ms = c.created?.time;
      out.push({
        id: urn,
        text: c.message?.text || '',
        username: 'LinkedIn member',
        fromId: c.actor || null,
        timestamp: ms ? new Date(ms).toISOString() : null,
        postMessage: post.text || '',
        postPermalink: post.publishedUrl || '',
      });
    }
  }
  return out;
}

/** Reply under a comment on our post, as the connected person. */
async function replyToComment(commentUrn, text) {
  const account = requireAccount();
  const object = postOfComment(commentUrn);
  if (!object) throw new Error('Could not tell which post this comment belongs to');
  if (!account.urn) throw new Error('LinkedIn did not tell us who signed in, so a reply cannot be sent as you. Reconnect it.');
  const { data, headers: h } = await axios.post(
    `${API}/socialActions/${enc(object)}/comments`,
    { actor: account.urn, object, parentComment: commentUrn, message: { text: String(text).slice(0, 1250) } },
    { headers: { ...headers(account), 'Content-Type': 'application/json' }, timeout: 20000 }
  );
  return { id: data?.['$URN'] || data?.id || h?.['x-restli-id'] || null };
}

/** Real numbers for our posts, from LinkedIn. Each figure that LinkedIn will not give stays null. */
async function readPostMetrics(posts) {
  const account = requireAccount();
  const out = new Map();
  for (const p of posts) {
    const urn = p.platformPostId;
    const kind = /:ugcPost:/.test(urn) ? 'ugcPost' : 'share';
    const m = { views: null, likes: null, comments: null, shares: null, saves: null };
    const notes = [];
    try {
      const { data } = await axios.get(`${API}/socialMetadata/${enc(urn)}`, { headers: headers(account), timeout: 20000 });
      m.likes = Object.values(data.reactionSummaries || {}).reduce((n, r) => n + (Number(r.count) || 0), 0);
      m.comments = Number(data.commentSummary?.count ?? data.commentSummary?.topLevelCount ?? 0);
    } catch (err) {
      notes.push(`Likes and comments: ${err.response?.data?.message || err.message}`);
    }
    for (const [type, field] of [['IMPRESSION', 'views'], ['RESHARE', 'shares']]) {
      try {
        const url = `${API}/memberCreatorPostAnalytics?q=entity&entity=(${kind}:${enc(urn)})&queryType=${type}`;
        const { data } = await axios.get(url, { headers: headers(account), timeout: 20000 });
        const n = Number(data.elements?.[0]?.count);
        if (Number.isFinite(n)) m[field] = n;
      } catch (err) {
        notes.push(`${type.toLowerCase()}: ${err.response?.data?.message || err.message}`);
      }
    }
    if (notes.length) m.note = notes.join(' ').slice(0, 300);
    out.set(p.id, m);
  }
  return out;
}

function oauthReturnScript(frontendUrl, payload) {
  const msg = JSON.stringify({ type: payload.success ? 'LINKEDIN_CM_AUTH_SUCCESS' : 'LINKEDIN_CM_AUTH_ERROR', ...payload });
  const origin = JSON.stringify(frontendUrl);
  const fallback = JSON.stringify(`${frontendUrl}/channels?linkedin_cm=${payload.success ? 'connected' : 'error'}`);
  return `<!DOCTYPE html><html><body><p>${payload.success ? 'LinkedIn connected. You can close this window.' : 'LinkedIn connection failed.'}</p><script>
    if (window.opener && !window.opener.closed) { window.opener.postMessage(${msg}, ${origin}); window.close(); } else { window.location.replace(${fallback}); }
  </script></body></html>`;
}

function mountRoutes(app, { requireAuth }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();
  const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

  app.get('/api/linkedin-cm/status', guard, (_req, res) => res.json(getStatus()));

  app.get('/auth/linkedin-cm', guard, (req, res) => {
    try {
      const state = oauthState.create({ channel: 'linkedin_cm', appUser: req.appUser });
      res.redirect(authUrl(state));
    } catch (err) {
      res.status(400).send(`<h1>LinkedIn setup needed</h1><p>${String(err.message).replace(/</g, '&lt;')}</p>`);
    }
  });

  app.get('/auth/linkedin-cm/callback', guard, async (req, res) => {
    const { code, state, error, error_description: description } = req.query;
    if (error) return res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: String(description || error) }));
    if (!code || !state) return res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: 'missing_code' }));
    try {
      const { workspaceId } = oauthState.verify(String(state), 'linkedin_cm', req.appUser);
      const workspaceContext = require('./workspaceContext');
      await workspaceContext.run(workspaceId, () => completeOAuth(String(code), workspaceId));
      res.send(oauthReturnScript(FRONTEND_URL, { success: true }));
    } catch (err) {
      console.error('[LinkedIn CM] auth error:', err.response?.data || err.message);
      res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: err.response?.data?.error_description || err.message }));
    }
  });

  app.post('/api/linkedin-cm/disconnect', guard, (_req, res) => {
    store.clearAccount();
    res.json({ success: true });
  });
}

module.exports = { isConfigured, getStatus, mountRoutes, fetchRecentComments, replyToComment, readPostMetrics, postOfComment, missingSettings };
