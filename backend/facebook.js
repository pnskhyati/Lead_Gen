/**
 * Facebook Page — OAuth (Facebook Login), publish support via page token, comment → leads sync.
 */
const axios = require('axios');
const store = require('./facebookStore');
const leadsCrm = require('./leadsCrm');

const GRAPH = 'https://graph.facebook.com/v22.0';
const META_APP_ID = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
const META_REDIRECT_URI =
  process.env.FACEBOOK_REDIRECT_URI ||
  process.env.META_FB_REDIRECT_URI ||
  'https://127.0.0.1:3000/auth/facebook/callback';

const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_engagement',
  'pages_manage_metadata',
  'public_profile',
].join(',');

function isConfigured() {
  return Boolean(META_APP_ID && META_APP_SECRET);
}

function getStatus() {
  const account = store.getAccount();
  return {
    configured: isConfigured(),
    connected: Boolean(account?.pageId && account?.pageAccessToken),
    account: account
      ? {
          pageId: account.pageId,
          pageName: account.pageName,
          igUserId: account.igUserId || null,
          igUsername: account.igUsername || null,
          connectedAt: account.connectedAt,
        }
      : null,
  };
}

/** Page credentials for publishers (Facebook + Page-linked Instagram). */
function getPageAccount() {
  return store.getAccount();
}

function authUrl(state = 'nexora_fb') {
  if (!isConfigured()) {
    throw new Error('Facebook is not configured. Set META_APP_ID and META_APP_SECRET in .env.local');
  }
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
}

async function exchangeCode(code) {
  const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: {
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code: String(code || '').replace(/#_.*$/, '').trim(),
    },
  });
  return data.access_token;
}

async function toLongLivedUserToken(shortToken) {
  const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  return data.access_token || shortToken;
}

async function resolvePageAccount(userToken) {
  const { data } = await axios.get(`${GRAPH}/me/accounts`, {
    params: {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      access_token: userToken,
    },
  });
  const pages = data.data || [];
  if (!pages.length) {
    throw new Error('No Facebook Pages found. Create a Page or ensure you are an admin.');
  }
  // Prefer a Page that also has Instagram linked
  const page = pages.find((p) => p.instagram_business_account?.id) || pages[0];
  const ig = page.instagram_business_account;
  return {
    userAccessToken: userToken,
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    igUserId: ig?.id || null,
    igUsername: ig?.username || null,
    connectedAt: new Date().toISOString(),
  };
}

async function completeOAuth(code) {
  const shortToken = await exchangeCode(code);
  let userToken = shortToken;
  try {
    userToken = await toLongLivedUserToken(shortToken);
  } catch (err) {
    console.warn('[Facebook] long-lived token failed, using short token:', err.message);
  }
  const account = await resolvePageAccount(userToken);
  store.setAccount(account);
  try {
    await subscribePage(account);
  } catch (err) {
    console.warn('[Facebook] page subscribe failed:', err.response?.data || err.message);
  }
  return {
    pageId: account.pageId,
    pageName: account.pageName,
    igUsername: account.igUsername,
  };
}

async function subscribePage(account) {
  if (!account?.pageId || !account?.pageAccessToken) return null;
  const { data } = await axios.post(`${GRAPH}/${account.pageId}/subscribed_apps`, null, {
    params: {
      subscribed_fields: ['feed', 'mention'].join(','),
      access_token: account.pageAccessToken,
    },
  });
  return data;
}

async function fetchRecentComments(limitPosts = 10) {
  const account = store.getAccount();
  if (!account?.pageId || !account?.pageAccessToken) {
    throw new Error('Facebook Page is not connected');
  }

  const postsRes = await axios.get(`${GRAPH}/${account.pageId}/published_posts`, {
    params: {
      fields: 'id,message,created_time,permalink_url,comments.summary(true)',
      limit: limitPosts,
      access_token: account.pageAccessToken,
    },
  });

  const posts = postsRes.data.data || [];
  const comments = [];

  for (const post of posts) {
    try {
      const commentsRes = await axios.get(`${GRAPH}/${post.id}/comments`, {
        params: {
          fields: 'id,message,from,created_time,comment_count',
          limit: 50,
          access_token: account.pageAccessToken,
        },
      });
      for (const c of commentsRes.data.data || []) {
        comments.push({
          id: c.id,
          text: c.message || '',
          username: c.from?.name || 'facebook_user',
          fromId: c.from?.id || null,
          timestamp: c.created_time,
          postId: post.id,
          postMessage: post.message || '',
          postPermalink: post.permalink_url || '',
        });
      }
    } catch (err) {
      console.warn(`[Facebook] comments failed for ${post.id}:`, err.response?.data || err.message);
    }
  }

  return comments;
}

function normalizeTemperature(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'hot' || v === 'warm' || v === 'cold') return v;
  return 'warm';
}

async function scoreComment(vertex, comment) {
  const agentFramework = require('./agentFramework');
  const scored = await vertex.generateSocialReply({
    platform: 'Facebook Comment',
    customerComment: comment.text,
  });
  const signals = agentFramework.detectSignals(comment.text);
  const isPraise = agentFramework.PRAISE_PATTERN.test(String(comment.text || '').trim());
  const intent = isPraise ? 'SOCIAL_ENGAGEMENT' : 'GENERAL_QUERY';
  const temperature = normalizeTemperature(scored.leadTemperature);
  const llmScore = Number.isFinite(Number(scored.leadScore))
    ? Math.max(0, Math.min(100, Math.round(Number(scored.leadScore))))
    : temperature === 'hot'
      ? 85
      : temperature === 'cold'
        ? 25
        : 55;
  const ruleScore = agentFramework.calculateRuleScore({ signals });
  const score = Math.round(ruleScore * 0.5 + llmScore * 0.5);
  const captureLead = agentFramework.shouldCaptureLead({
    intent,
    message: comment.text,
    signals,
    confidence: isPraise ? 0.9 : 0.5,
  });

  return {
    id: `fb-${comment.id}`,
    externalId: comment.id,
    source: 'facebook',
    platform: 'Facebook',
    customerComment: comment.text,
    temperature: agentFramework.temperatureFromScore(score),
    score,
    scoreBand: agentFramework.scoreBandFromScore(score),
    intent,
    captureLead,
    intentSummary: scored.intentSummary || 'Scored from Facebook comment.',
    recommendedProduct: scored.productRecommendation?.name,
    suggestedReply: scored.suggestedReply,
    status: 'new',
    createdAt: comment.timestamp || new Date().toISOString(),
    author: comment.username,
    mediaPermalink: comment.postPermalink,
  };
}

async function syncAndScoreLeads(vertex, { forceRescore = false } = {}) {
  const comments = await fetchRecentComments();
  const seen = store.getSeenCommentIds();
  const fresh = forceRescore ? comments : comments.filter((c) => c.id && !seen.has(c.id));

  const leads = [];
  for (const comment of fresh) {
    if (!comment.text?.trim()) {
      store.markCommentsSeen([comment.id]);
      continue;
    }
    try {
      const lead = await scoreComment(vertex, comment);
      if (!lead.captureLead && lead.score < 31) {
        store.markCommentsSeen([comment.id]);
        continue;
      }
      leads.push(lead);
      store.markCommentsSeen([comment.id]);
    } catch (err) {
      console.error(`[Facebook] score failed for ${comment.id}:`, err.message);
    }
  }

  const saved = store.appendLeads(leads);

  for (const lead of leads) {
    if (!lead.captureLead && lead.score < 31) continue;
    try {
      const crmLead = await leadsCrm.upsertLead({
        channel: 'facebook',
        platform: 'Facebook',
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
      console.warn('[Facebook] CRM mirror failed:', err.message);
    }
  }

  return {
    fetched: comments.length,
    newComments: fresh.length,
    scored: leads.length,
    leads: saved.length ? saved : leads,
    account: getStatus().account,
  };
}

function oauthReturnScript(frontendUrl, payload) {
  const origin = JSON.stringify(frontendUrl);
  const message = payload.success
    ? `{ type: 'FACEBOOK_AUTH_SUCCESS', account: ${JSON.stringify(payload.account || null)} }`
    : `{ type: 'FACEBOOK_AUTH_ERROR', error: ${JSON.stringify(payload.error || 'auth_failed')} }`;
  const fallback = payload.success
    ? JSON.stringify(`${frontendUrl}/?facebook=connected`)
    : JSON.stringify(
        `${frontendUrl}/?facebook_error=${encodeURIComponent(String(payload.error || 'auth_failed'))}`
      );
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

  app.get('/api/facebook/status', guard, (_req, res) => {
    res.json(getStatus());
  });

  app.get('/auth/facebook', (req, res) => {
    try {
      const url = authUrl(req.query.state || 'nexora_fb');
      res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Connect Facebook</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1.5rem;line-height:1.5}
a{display:inline-block;margin-top:1rem;background:#1877f2;color:#fff;text-decoration:none;padding:.75rem 1.25rem;border-radius:999px;font-weight:600}</style>
</head><body>
  <h1>Continue to Facebook</h1>
  <p>Log in and grant Page access so Nexora can publish and sync comments.</p>
  <a href="${url}">Continue to Facebook</a>
  <script>setTimeout(function(){ window.location.replace(${JSON.stringify(url)}); }, 600);</script>
</body></html>`);
    } catch (err) {
      res.status(400).send(`<h1>Facebook setup needed</h1><p>${err.message}</p>`);
    }
  });

  app.get('/auth/facebook/callback', async (req, res) => {
    const { code, error, error_description: errorDescription } = req.query;
    if (error) {
      return res.send(
        oauthReturnScript(FRONTEND_URL, { success: false, error: String(errorDescription || error) })
      );
    }
    if (!code) {
      return res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: 'missing_code' }));
    }
    try {
      const account = await completeOAuth(String(code));
      res.send(oauthReturnScript(FRONTEND_URL, { success: true, account }));
    } catch (err) {
      console.error('[Facebook] Auth Error:', err.response?.data || err.message);
      const message = err.response?.data?.error?.message || err.message || 'auth_failed';
      res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: message }));
    }
  });

  app.post('/api/facebook/disconnect', guard, (_req, res) => {
    store.clearAccount();
    res.json({ success: true });
  });

  app.post('/api/facebook/sync', guard, async (req, res) => {
    try {
      if (!getStatus().connected) {
        return res.status(400).json({ success: false, error: 'Connect Facebook Page first' });
      }
      const result = await syncAndScoreLeads(vertex, {
        forceRescore: Boolean(req.body?.forceRescore),
      });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[Facebook] sync error:', err.response?.data || err.message);
      res.status(500).json({
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Facebook sync failed',
      });
    }
  });

  app.get('/api/facebook/leads', guard, (_req, res) => {
    res.json({ success: true, data: store.getStoredLeads() });
  });
}

module.exports = {
  isConfigured,
  getStatus,
  getPageAccount,
  mountRoutes,
  syncAndScoreLeads,
};
