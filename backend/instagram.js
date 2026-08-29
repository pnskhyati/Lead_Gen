/**
 * Instagram Graph API — OAuth, comment sync, lead scoring.
 * Requires a Meta app + Instagram Business/Creator account linked to a Facebook Page.
 */
const axios = require('axios');
const store = require('./instagramStore');

const GRAPH = 'https://graph.facebook.com/v21.0';
const META_APP_ID = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI ||
  process.env.INSTAGRAM_REDIRECT_URI ||
  'http://localhost:3000/auth/instagram/callback';
const WEBHOOK_VERIFY = process.env.META_WEBHOOK_VERIFY_TOKEN || 'nexora_ig_verify';

const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_comments',
  'business_management',
].join(',');

function isConfigured() {
  return Boolean(META_APP_ID && META_APP_SECRET);
}

function getStatus() {
  const account = store.getAccount();
  return {
    configured: isConfigured(),
    connected: Boolean(account?.igUserId && account?.pageAccessToken),
    account: account
      ? {
          username: account.username,
          name: account.name,
          igUserId: account.igUserId,
          pageName: account.pageName,
          connectedAt: account.connectedAt,
        }
      : null,
  };
}

function authUrl(state = 'nexora') {
  if (!isConfigured()) {
    throw new Error('Instagram is not configured. Set META_APP_ID and META_APP_SECRET in .env.local');
  }
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

async function exchangeCode(code) {
  const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: {
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code,
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
  return data.access_token;
}

async function resolveInstagramAccount(userToken) {
  const { data } = await axios.get(`${GRAPH}/me/accounts`, {
    params: {
      fields: 'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}',
      access_token: userToken,
    },
  });

  const pages = data.data || [];
  const page = pages.find((p) => p.instagram_business_account?.id);
  if (!page) {
    throw new Error(
      'No Instagram Business account found. Link an Instagram Business/Creator account to a Facebook Page you manage.'
    );
  }

  const ig = page.instagram_business_account;
  return {
    userAccessToken: userToken,
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    igUserId: ig.id,
    username: ig.username,
    name: ig.name || ig.username,
    profilePicture: ig.profile_picture_url || null,
    connectedAt: new Date().toISOString(),
  };
}

async function completeOAuth(code) {
  const shortToken = await exchangeCode(code);
  let userToken = shortToken;
  try {
    userToken = await toLongLivedUserToken(shortToken);
  } catch (err) {
    console.warn('[Instagram] long-lived token exchange failed, using short token:', err.message);
  }
  const account = await resolveInstagramAccount(userToken);
  store.setAccount(account);
  return {
    username: account.username,
    name: account.name,
    igUserId: account.igUserId,
    pageName: account.pageName,
  };
}

async function fetchRecentComments(limitMedia = 8) {
  const account = store.getAccount();
  if (!account?.igUserId || !account?.pageAccessToken) {
    throw new Error('Instagram is not connected');
  }

  const mediaRes = await axios.get(`${GRAPH}/${account.igUserId}/media`, {
    params: {
      fields: 'id,caption,timestamp,permalink,comments_count',
      limit: limitMedia,
      access_token: account.pageAccessToken,
    },
  });

  const mediaItems = mediaRes.data.data || [];
  const comments = [];

  for (const media of mediaItems) {
    if (!media.comments_count) continue;
    try {
      const commentsRes = await axios.get(`${GRAPH}/${media.id}/comments`, {
        params: {
          fields: 'id,text,username,timestamp,like_count',
          limit: 50,
          access_token: account.pageAccessToken,
        },
      });
      for (const c of commentsRes.data.data || []) {
        comments.push({
          id: c.id,
          text: c.text || '',
          username: c.username || 'instagram_user',
          timestamp: c.timestamp,
          likeCount: c.like_count || 0,
          mediaId: media.id,
          mediaCaption: media.caption || '',
          mediaPermalink: media.permalink || '',
        });
      }
    } catch (err) {
      console.warn(`[Instagram] comments fetch failed for media ${media.id}:`, err.response?.data || err.message);
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
  const details = {
    platform: 'Instagram Comment',
    customerComment: comment.text,
  };
  const scored = await vertex.generateSocialReply(details);
  const temperature = normalizeTemperature(scored.leadTemperature);
  const score = Number.isFinite(Number(scored.leadScore))
    ? Math.max(0, Math.min(100, Math.round(Number(scored.leadScore))))
    : temperature === 'hot'
      ? 85
      : temperature === 'cold'
        ? 25
        : 55;

  return {
    id: `ig-${comment.id}`,
    externalId: comment.id,
    source: 'instagram',
    platform: 'Instagram',
    customerComment: comment.text,
    temperature,
    score,
    intentSummary: scored.intentSummary || 'Scored from Instagram comment.',
    recommendedProduct: scored.productRecommendation?.name,
    suggestedReply: scored.suggestedReply,
    status: 'new',
    createdAt: comment.timestamp || new Date().toISOString(),
    author: comment.username,
    mediaPermalink: comment.mediaPermalink,
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
      leads.push(lead);
      store.markCommentsSeen([comment.id]);
    } catch (err) {
      console.error(`[Instagram] score failed for ${comment.id}:`, err.message);
    }
  }

  const saved = store.appendLeads(leads);
  return {
    fetched: comments.length,
    newComments: fresh.length,
    scored: leads.length,
    leads: saved.length ? saved : leads,
    account: getStatus().account,
  };
}

function mountRoutes(app, { vertex }) {
  app.get('/api/instagram/status', (_req, res) => {
    res.json(getStatus());
  });

  app.get('/auth/instagram', (req, res) => {
    try {
      res.redirect(authUrl(req.query.state || 'nexora'));
    } catch (err) {
      res.status(400).send(`<h1>Instagram setup needed</h1><p>${err.message}</p>`);
    }
  });

  app.get('/auth/instagram/callback', async (req, res) => {
    const { code, error, error_description: errorDescription } = req.query;
    if (error) {
      console.error('[Instagram] OAuth error:', error, errorDescription);
      return res.send(
        `<script>window.opener.postMessage({ type: 'INSTAGRAM_AUTH_ERROR', error: ${JSON.stringify(
          String(errorDescription || error)
        )} }, "*"); window.close();</script>`
      );
    }
    if (!code) {
      return res.send(
        `<script>window.opener.postMessage({ type: 'INSTAGRAM_AUTH_ERROR', error: 'missing_code' }, "*"); window.close();</script>`
      );
    }

    try {
      const account = await completeOAuth(String(code));
      res.send(
        `<script>window.opener.postMessage({ type: 'INSTAGRAM_AUTH_SUCCESS', account: ${JSON.stringify(
          account
        )} }, "*"); window.close();</script>`
      );
    } catch (err) {
      console.error('[Instagram] Auth Error:', err.response?.data || err.message);
      const message = err.response?.data?.error?.message || err.message || 'auth_failed';
      res.send(
        `<script>window.opener.postMessage({ type: 'INSTAGRAM_AUTH_ERROR', error: ${JSON.stringify(
          message
        )} }, "*"); window.close();</script>`
      );
    }
  });

  app.post('/api/instagram/disconnect', (_req, res) => {
    store.clearAccount();
    res.json({ success: true });
  });

  app.post('/api/instagram/sync', async (req, res) => {
    try {
      if (!getStatus().connected) {
        return res.status(400).json({ success: false, error: 'Connect Instagram first' });
      }
      const result = await syncAndScoreLeads(vertex, {
        forceRescore: Boolean(req.body?.forceRescore),
      });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[Instagram] sync error:', err.response?.data || err.message);
      res.status(500).json({
        success: false,
        error: err.response?.data?.error?.message || err.message || 'Instagram sync failed',
      });
    }
  });

  app.get('/api/instagram/leads', (_req, res) => {
    res.json({ success: true, data: store.getStoredLeads() });
  });

  // Meta webhook verification + comment events (optional real-time)
  app.get('/api/instagram/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  app.post('/api/instagram/webhook', async (req, res) => {
    res.sendStatus(200);
    try {
      const entries = req.body?.entry || [];
      const commentIds = [];
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          if (change.field === 'comments' && change.value?.id) {
            commentIds.push(change.value.id);
          }
        }
      }
      if (commentIds.length && getStatus().connected) {
        // Full media poll scores new comments including webhook-triggered ones
        await syncAndScoreLeads(vertex);
      }
    } catch (err) {
      console.error('[Instagram] webhook handling error:', err.message);
    }
  });
}

module.exports = {
  isConfigured,
  getStatus,
  mountRoutes,
  syncAndScoreLeads,
};
