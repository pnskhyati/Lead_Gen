/**
 * X (Twitter) API v2 — OAuth 2.0 PKCE, publish tweets, sync @mentions → leads.
 */
const crypto = require('crypto');
const axios = require('axios');
const store = require('./xStore');
const leadsCrm = require('./leadsCrm');

const X_CLIENT_ID = process.env.X_CLIENT_ID || process.env.TWITTER_CLIENT_ID || '';
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET || '';
const X_REDIRECT_URI =
  process.env.X_REDIRECT_URI ||
  process.env.TWITTER_REDIRECT_URI ||
  'https://127.0.0.1:3000/auth/x/callback';

const AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const API = 'https://api.twitter.com/2';

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');

function isConfigured() {
  return Boolean(X_CLIENT_ID);
}

function base64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkce() {
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

function getStatus() {
  const account = store.getAccount();
  return {
    configured: isConfigured(),
    connected: Boolean(account?.userId && account?.accessToken),
    account: account
      ? {
          userId: account.userId,
          username: account.username,
          name: account.name,
          connectedAt: account.connectedAt,
        }
      : null,
  };
}

function authUrl(state, codeChallenge) {
  if (!isConfigured()) {
    throw new Error('X is not configured. Set X_CLIENT_ID in backend .env.local');
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: X_CLIENT_ID,
    redirect_uri: X_REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function tokenAuthHeader() {
  if (X_CLIENT_SECRET) {
    return `Basic ${Buffer.from(`${encodeURIComponent(X_CLIENT_ID)}:${encodeURIComponent(X_CLIENT_SECRET)}`).toString('base64')}`;
  }
  return null;
}

async function exchangeToken(bodyParams) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const basic = tokenAuthHeader();
  if (basic) headers.Authorization = basic;

  const { data } = await axios.post(TOKEN_URL, new URLSearchParams(bodyParams).toString(), { headers });
  return data;
}

async function fetchMe(accessToken) {
  const { data } = await axios.get(`${API}/users/me`, {
    params: { 'user.fields': 'profile_image_url,username,name' },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data.data;
}

async function completeOAuth(code, pending) {
  const tokenBody = {
    grant_type: 'authorization_code',
    code: String(code || '').trim(),
    redirect_uri: X_REDIRECT_URI,
    code_verifier: pending.codeVerifier,
    client_id: X_CLIENT_ID,
  };
  const tokens = await exchangeToken(tokenBody);
  const me = await fetchMe(tokens.access_token);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
    : null;

  return store.setAccount({
    userId: me.id,
    username: me.username,
    name: me.name,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt,
    connectedAt: new Date().toISOString(),
  });
}

async function ensureAccessToken() {
  const account = store.getAccount();
  if (!account?.accessToken) throw new Error('Connect X first (Channels → X)');

  const expires = account.expiresAt ? new Date(account.expiresAt).getTime() : 0;
  if (expires && expires > Date.now() + 60_000) return account.accessToken;

  if (!account.refreshToken) return account.accessToken;

  const tokenBody = {
    grant_type: 'refresh_token',
    refresh_token: account.refreshToken,
    client_id: X_CLIENT_ID,
  };
  const tokens = await exchangeToken(tokenBody);
  account.accessToken = tokens.access_token;
  if (tokens.refresh_token) account.refreshToken = tokens.refresh_token;
  if (tokens.expires_in) {
    account.expiresAt = new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString();
  }
  store.setAccount(account);
  return account.accessToken;
}

function tweetTextFromPost(post) {
  const tags = (post.hashtags || [])
    .map((t) => (String(t).startsWith('#') ? t : `#${t}`))
    .join(' ');
  let text = [post.headline, post.content, tags].filter(Boolean).join('\n\n').trim();
  if (text.length > 280) text = `${text.slice(0, 277)}…`;
  return text;
}

async function publishTweet(post) {
  const token = await ensureAccessToken();
  const text = tweetTextFromPost(post);
  const { data } = await axios.post(
    `${API}/tweets`,
    { text },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  const id = data.data?.id;
  return { id, platform: 'x', url: id ? `https://x.com/i/web/status/${id}` : undefined };
}

async function fetchRecentMentions() {
  const account = store.getAccount();
  if (!account?.userId) throw new Error('Connect X first');
  const token = await ensureAccessToken();
  const { data } = await axios.get(`${API}/users/${account.userId}/mentions`, {
    params: {
      max_results: 25,
      'tweet.fields': 'created_at,author_id,text',
      expansions: 'author_id',
      'user.fields': 'username,name',
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  const users = {};
  for (const u of data.includes?.users || []) users[u.id] = u;
  return (data.data || []).map((t) => ({
    id: t.id,
    text: t.text,
    timestamp: t.created_at,
    username: users[t.author_id]?.username || 'user',
    authorName: users[t.author_id]?.name || '',
    permalink: `https://x.com/${users[t.author_id]?.username || 'i'}/status/${t.id}`,
  }));
}

async function scoreMention(vertex, mention) {
  const agentFramework = require('./agentFramework');
  const scored = await vertex.generateSocialReply({
    platform: 'X Mention',
    customerComment: mention.text,
  });
  const signals = agentFramework.detectSignals(mention.text);
  const isPraise = agentFramework.PRAISE_PATTERN.test(String(mention.text || '').trim());
  const intent = isPraise ? 'SOCIAL_ENGAGEMENT' : 'GENERAL_QUERY';
  const temperature =
    scored.leadTemperature === 'hot' || scored.leadTemperature === 'warm' || scored.leadTemperature === 'cold'
      ? scored.leadTemperature
      : 'warm';
  const llmScore = Number.isFinite(Number(scored.leadScore))
    ? Math.max(0, Math.min(100, Math.round(Number(scored.leadScore))))
    : 55;
  const ruleScore = agentFramework.calculateRuleScore({ signals });
  const score = Math.round(ruleScore * 0.5 + llmScore * 0.5);
  const captureLead = agentFramework.shouldCaptureLead({
    intent,
    message: mention.text,
    signals,
    confidence: isPraise ? 0.9 : 0.5,
  });

  return {
    id: `x-${mention.id}`,
    externalId: mention.id,
    source: 'x',
    platform: 'X (Twitter)',
    customerComment: mention.text,
    temperature: agentFramework.temperatureFromScore(score),
    score,
    scoreBand: agentFramework.scoreBandFromScore(score),
    intent,
    captureLead,
    intentSummary: scored.intentSummary || 'Scored from X mention.',
    recommendedProduct: scored.productRecommendation?.name,
    suggestedReply: scored.suggestedReply,
    status: 'new',
    createdAt: mention.timestamp || new Date().toISOString(),
    author: mention.username ? `@${mention.username}` : mention.authorName,
    mediaPermalink: mention.permalink,
  };
}

async function syncAndScoreLeads(vertex, { forceRescore = false } = {}) {
  const mentions = await fetchRecentMentions();
  const seen = store.getSeenMentionIds();
  const fresh = forceRescore ? mentions : mentions.filter((m) => m.id && !seen.has(m.id));

  const leads = [];
  for (const mention of fresh) {
    if (!mention.text?.trim()) {
      store.markMentionsSeen([mention.id]);
      continue;
    }
    try {
      const lead = await scoreMention(vertex, mention);
      if (!lead.captureLead && lead.score < 31) {
        store.markMentionsSeen([mention.id]);
        continue;
      }
      leads.push(lead);
      store.markMentionsSeen([mention.id]);
    } catch (err) {
      console.error(`[X] score failed for ${mention.id}:`, err.message);
    }
  }

  const saved = store.appendLeads(leads);

  for (const lead of leads) {
    if (!lead.captureLead && lead.score < 31) continue;
    try {
      const crmLead = await leadsCrm.upsertLead({
        channel: 'x',
        platform: 'X (Twitter)',
        externalId: lead.externalId,
        author: lead.author,
        customerComment: lead.customerComment,
        temperature: lead.temperature,
        score: lead.score,
        scoreBand: lead.scoreBand,
        intent: lead.intent,
        intentSummary: lead.intentSummary,
        recommendedProduct: lead.recommendedProduct,
        suggestedReply: lead.suggestedReply,
        mediaPermalink: lead.mediaPermalink,
        status: 'new',
      });
      await leadsCrm.addMessage({
        leadId: crmLead.id,
        role: 'customer',
        text: lead.customerComment,
        channelMessageId: lead.externalId,
      });
      if (lead.suggestedReply) {
        await leadsCrm.addMessage({
          leadId: crmLead.id,
          role: 'agent',
          text: lead.suggestedReply,
        });
      }
    } catch (err) {
      console.warn('[X] CRM mirror failed:', err.message);
    }
  }

  return {
    fetched: mentions.length,
    newMentions: fresh.length,
    scored: leads.length,
    leads: saved.length ? saved : leads,
    account: getStatus().account,
  };
}

function oauthReturnScript(frontendUrl, payload) {
  const origin = JSON.stringify(frontendUrl);
  const message = payload.success
    ? `{ type: 'X_AUTH_SUCCESS', account: ${JSON.stringify(payload.account || null)} }`
    : `{ type: 'X_AUTH_ERROR', error: ${JSON.stringify(payload.error || 'auth_failed')} }`;
  const fallback = payload.success
    ? JSON.stringify(`${frontendUrl}/?x=connected`)
    : JSON.stringify(`${frontendUrl}/?x_error=${encodeURIComponent(String(payload.error || 'auth_failed'))}`);
  return `<!DOCTYPE html><html><body><p>Returning to Nexora…</p><script>
    var msg = ${message};
    var fallback = ${fallback};
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, ${origin});
      window.close();
    } else {
      window.location.replace(fallback);
    }
  </script></body></html>`;
}

function mountRoutes(app, { vertex, requireAuth }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();
  const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://127.0.0.1:3000').replace(/\/$/, '');

  app.get('/api/x/status', guard, (_req, res) => {
    res.json(getStatus());
  });

  app.get('/auth/x', (req, res) => {
    try {
      const state = crypto.randomBytes(16).toString('hex');
      const { codeVerifier, codeChallenge } = generatePkce();
      store.setPending({ state, codeVerifier, createdAt: new Date().toISOString() });
      const url = authUrl(state, codeChallenge);
      res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Connect X</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1.5rem;line-height:1.5}
a{display:inline-block;margin-top:1rem;background:#0f172a;color:#fff;text-decoration:none;padding:.75rem 1.25rem;border-radius:999px;font-weight:600}</style>
</head><body>
  <h1>Continue to X</h1>
  <p>Authorize Nexora to post and read @mentions for lead sync.</p>
  <a href="${url}">Continue to X</a>
  <script>setTimeout(function(){ window.location.replace(${JSON.stringify(url)}); }, 600);</script>
</body></html>`);
    } catch (err) {
      res.status(400).send(`<h1>X setup needed</h1><p>${err.message}</p>`);
    }
  });

  app.get('/auth/x/callback', async (req, res) => {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (error) {
      return res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: String(errorDescription || error) }));
    }
    if (!code || !state) {
      return res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: 'missing_code' }));
    }
    const pending = store.consumePending(String(state));
    if (!pending?.codeVerifier) {
      return res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: 'oauth_session_expired' }));
    }
    try {
      const account = await completeOAuth(String(code), pending);
      res.send(oauthReturnScript(FRONTEND_URL, { success: true, account: getStatus().account }));
    } catch (err) {
      console.error('[X] Auth Error:', err.response?.data || err.message);
      const message = err.response?.data?.error_description || err.response?.data?.error || err.message;
      res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: message }));
    }
  });

  app.post('/api/x/disconnect', guard, (_req, res) => {
    store.clearAccount();
    res.json({ success: true });
  });

  app.post('/api/x/sync', guard, async (req, res) => {
    try {
      if (!getStatus().connected) {
        return res.status(400).json({ success: false, error: 'Connect X first' });
      }
      const result = await syncAndScoreLeads(vertex, { forceRescore: Boolean(req.body?.forceRescore) });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[X] sync error:', err.response?.data || err.message);
      res.status(500).json({
        success: false,
        error: err.response?.data?.detail || err.response?.data?.title || err.message || 'X sync failed',
      });
    }
  });
}

module.exports = {
  isConfigured,
  getStatus,
  mountRoutes,
  publishTweet,
  syncAndScoreLeads,
  tweetTextFromPost,
};
