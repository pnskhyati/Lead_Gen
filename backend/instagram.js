/**
 * Instagram Graph API — OAuth, comment sync, lead scoring.
 *
 * Default: Instagram API with Instagram Login (instagram_business_* scopes).
 * Optional: META_IG_AUTH_MODE=facebook for classic Page-linked Facebook Login.
 */
const axios = require('axios');
const store = require('./instagramStore');
const leadsCrm = require('./leadsCrm');

const FB_GRAPH = 'https://graph.facebook.com/v22.0';
const IG_GRAPH = 'https://graph.instagram.com/v22.0';
const AUTH_MODE = String(process.env.META_IG_AUTH_MODE || 'instagram_login').toLowerCase();

const META_APP_ID = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
/** Instagram Login often uses Instagram App ID from App Dashboard → Instagram → API setup */
const IG_APP_ID = process.env.INSTAGRAM_APP_ID || META_APP_ID;
const IG_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || META_APP_SECRET;

const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI ||
  process.env.INSTAGRAM_REDIRECT_URI ||
  'https://127.0.0.1:3000/auth/instagram/callback';
const WEBHOOK_VERIFY = process.env.META_WEBHOOK_VERIFY_TOKEN || 'nexora_ig_verify';

const IG_LOGIN_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
].join(',');

const FB_LOGIN_SCOPES = [
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
].join(',');

function isInstagramLogin() {
  return AUTH_MODE !== 'facebook' && AUTH_MODE !== 'facebook_login';
}

function isConfigured() {
  if (isInstagramLogin()) return Boolean(IG_APP_ID && IG_APP_SECRET);
  return Boolean(META_APP_ID && META_APP_SECRET);
}

function accessTokenOf(account = store.getAccount()) {
  return account?.accessToken || account?.pageAccessToken || null;
}

function graphBase(account = store.getAccount()) {
  if (account?.authMode === 'instagram_login' || (!account && isInstagramLogin())) {
    return IG_GRAPH;
  }
  return FB_GRAPH;
}

function getStatus() {
  const account = store.getAccount();
  let botName = 'Alex';
  let instagramAutoReply = true;
  try {
    const ck = require('./companyKnowledge');
    botName = ck.getBotName();
    instagramAutoReply = ck.isChannelAutoReplyEnabled('instagram');
  } catch {
    /* ignore */
  }
  return {
    configured: isConfigured(),
    connected: Boolean(account?.igUserId && accessTokenOf(account)),
    authMode: isInstagramLogin() ? 'instagram_login' : 'facebook_login',
    dmAutoReply: instagramAutoReply,
    botName,
    account: account
      ? {
          username: account.username,
          name: account.name,
          igUserId: account.igUserId,
          pageName: account.pageName || null,
          authMode: account.authMode || null,
          connectedAt: account.connectedAt,
        }
      : null,
  };
}

function authUrl(state = 'nexora') {
  if (!isConfigured()) {
    throw new Error('Instagram is not configured. Set META_APP_ID and META_APP_SECRET in .env.local');
  }

  if (isInstagramLogin()) {
    const params = new URLSearchParams({
      client_id: IG_APP_ID,
      redirect_uri: META_REDIRECT_URI,
      scope: IG_LOGIN_SCOPES,
      response_type: 'code',
      state,
      enable_fb_login: '0',
      force_authentication: '1',
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    scope: FB_LOGIN_SCOPES,
    response_type: 'code',
    state,
    extras: JSON.stringify({ setup: { channel: 'IG_API_ONBOARDING' } }),
  });
  return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeInstagram(code) {
  const cleanCode = String(code || '').replace(/#_.*$/, '').trim();
  const body = new URLSearchParams({
    client_id: IG_APP_ID,
    client_secret: IG_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: META_REDIRECT_URI,
    code: cleanCode,
  });
  const { data } = await axios.post('https://api.instagram.com/oauth/access_token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  // Response may be { access_token, user_id } or { data: [{ access_token, user_id }] }
  if (Array.isArray(data?.data) && data.data[0]) {
    return { accessToken: data.data[0].access_token, userId: String(data.data[0].user_id) };
  }
  return { accessToken: data.access_token, userId: data.user_id ? String(data.user_id) : null };
}

async function toLongLivedInstagramToken(shortToken) {
  try {
    const { data } = await axios.get('https://graph.instagram.com/access_token', {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: IG_APP_SECRET,
        access_token: shortToken,
      },
    });
    return data.access_token || shortToken;
  } catch (err) {
    // Some environments require POST
    try {
      const body = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: IG_APP_SECRET,
        access_token: shortToken,
      });
      const { data } = await axios.post('https://graph.instagram.com/access_token', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return data.access_token || shortToken;
    } catch (err2) {
      console.warn('[Instagram] long-lived token exchange failed:', err2.response?.data || err2.message);
      return shortToken;
    }
  }
}

async function resolveInstagramLoginAccount(accessToken, fallbackUserId) {
  const { data } = await axios.get(`${IG_GRAPH}/me`, {
    params: {
      fields: 'user_id,username,name,account_type,profile_picture_url',
      access_token: accessToken,
    },
  });
  const igUserId = String(data.user_id || data.id || fallbackUserId || '');
  if (!igUserId) {
    throw new Error('Could not resolve Instagram user id after login');
  }
  return {
    authMode: 'instagram_login',
    accessToken,
    pageAccessToken: accessToken, // compatibility with older helpers
    userAccessToken: accessToken,
    pageId: null,
    pageName: null,
    igUserId,
    username: data.username,
    name: data.name || data.username,
    profilePicture: data.profile_picture_url || null,
    accountType: data.account_type || null,
    connectedAt: new Date().toISOString(),
  };
}

async function exchangeCodeFacebook(code) {
  const { data } = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
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
  const { data } = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  return data.access_token;
}

async function resolveFacebookPageAccount(userToken) {
  const { data } = await axios.get(`${FB_GRAPH}/me/accounts`, {
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
    authMode: 'facebook_login',
    userAccessToken: userToken,
    accessToken: page.access_token,
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
  if (isInstagramLogin()) {
    const short = await exchangeCodeInstagram(code);
    const longToken = await toLongLivedInstagramToken(short.accessToken);
    const account = await resolveInstagramLoginAccount(longToken, short.userId);
    store.setAccount(account);
    return {
      username: account.username,
      name: account.name,
      igUserId: account.igUserId,
      pageName: null,
      authMode: 'instagram_login',
      messagingSubscribed: false,
    };
  }

  const shortToken = await exchangeCodeFacebook(code);
  let userToken = shortToken;
  try {
    userToken = await toLongLivedUserToken(shortToken);
  } catch (err) {
    console.warn('[Instagram] long-lived token exchange failed, using short token:', err.message);
  }
  const account = await resolveFacebookPageAccount(userToken);
  store.setAccount(account);
  try {
    await subscribePageToMessaging(account);
  } catch (err) {
    console.warn('[Instagram] messaging subscribe failed:', err.response?.data || err.message);
  }
  return {
    username: account.username,
    name: account.name,
    igUserId: account.igUserId,
    pageName: account.pageName,
    authMode: 'facebook_login',
    messagingSubscribed: true,
  };
}

/** Subscribe the Facebook Page so Instagram DMs hit our webhook (Facebook Login mode only) */
async function subscribePageToMessaging(account) {
  if (!account?.pageId || !account?.pageAccessToken) return null;
  const { data } = await axios.post(`${FB_GRAPH}/${account.pageId}/subscribed_apps`, null, {
    params: {
      subscribed_fields: [
        'messages',
        'messaging_postbacks',
        'message_deliveries',
        'message_reads',
        'feed',
      ].join(','),
      access_token: account.pageAccessToken,
    },
  });
  console.log('[Instagram] Page subscribed for messaging:', JSON.stringify(data));
  return data;
}

async function sendInstagramDm(igScopedUserId, text) {
  const account = store.getAccount();
  const token = accessTokenOf(account);
  if (!token) throw new Error('Instagram not connected');

  const base = graphBase(account);

  // Instagram Login messaging
  if (account.authMode === 'instagram_login' || isInstagramLogin()) {
    const { data } = await axios.post(
      `${base}/me/messages`,
      {
        recipient: { id: igScopedUserId },
        message: { text },
      },
      { params: { access_token: token } }
    );
    return data;
  }

  // Facebook Login / Page messaging
  try {
    const { data } = await axios.post(
      `${FB_GRAPH}/me/messages`,
      {
        recipient: { id: igScopedUserId },
        message: { text },
        messaging_type: 'RESPONSE',
      },
      { params: { access_token: token } }
    );
    return data;
  } catch (err) {
    console.warn('[Instagram] me/messages failed, trying page id:', err.response?.data || err.message);
  }

  if (account.pageId) {
    const { data } = await axios.post(
      `${FB_GRAPH}/${account.pageId}/messages`,
      {
        recipient: { id: igScopedUserId },
        message: { text },
        messaging_type: 'RESPONSE',
      },
      { params: { access_token: token } }
    );
    return data;
  }

  throw new Error('Could not send Instagram DM');
}

async function handleIncomingDm(vertex, leadAgent, { senderId, text, messageId, isEcho }) {
  if (isEcho) {
    return { skipped: true, reason: 'echo' };
  }

  let ck;
  try {
    ck = require('./companyKnowledge');
  } catch {
    ck = null;
  }

  if (ck && !ck.isChannelAutoReplyEnabled('instagram')) {
    // Still store the lead for the Leads tab, but do not auto-reply in Instagram
    const leadOnly = await leadsCrm.upsertLead({
      channel: 'instagram',
      platform: 'Instagram DM',
      externalId: `igdm:${senderId}`,
      author: senderId,
      igScopedId: senderId,
      customerComment: text,
    });
    await leadsCrm.addMessage({
      leadId: leadOnly.id,
      role: 'customer',
      text,
      channelMessageId: messageId,
    });
    return { lead: leadOnly, skipped: true, reason: 'auto_reply_disabled' };
  }

  const botName = ck?.getBotName?.() || 'Alex';

  const lead = await leadsCrm.upsertLead({
    channel: 'instagram',
    platform: 'Instagram DM',
    externalId: `igdm:${senderId}`,
    author: senderId,
    igScopedId: senderId,
    customerComment: text,
  });

  await leadsCrm.addMessage({
    leadId: lead.id,
    role: 'customer',
    text,
    channelMessageId: messageId,
  });

  if (lead.autoReplyPaused || lead.status === 'handed_off') {
    return { lead, skipped: true, reason: 'handoff' };
  }

  const historyMsgs = await leadsCrm.getMessages(lead.id);
  const history = historyMsgs.slice(-12).map((m) => ({
    role: m.role === 'customer' ? 'user' : 'model',
    text: m.text,
  }));

  const agentResult = await leadAgent.chat(vertex, {
    message: text,
    history: history.slice(0, -1),
    visitorName: senderId,
  });

  // Soft intro with custom bot name on first turn
  let replyText = agentResult.reply;
  if (historyMsgs.filter((m) => m.role === 'customer').length <= 1 && !new RegExp(botName, 'i').test(replyText)) {
    replyText = `Hey — I'm ${botName}. ${replyText}`;
  }

  const updated = await leadsCrm.upsertLead({
    id: lead.id,
    channel: 'instagram',
    platform: 'Instagram DM',
    externalId: `igdm:${senderId}`,
    author: senderId,
    igScopedId: senderId,
    customerComment: text,
    temperature: agentResult.leadTemperature,
    score: agentResult.leadScore,
    scoreBand: agentResult.scoreBand,
    intent: agentResult.intent,
    intentConfidence: agentResult.intentConfidence,
    intentSummary: agentResult.intentSummary,
    nextBestAction: agentResult.nextBestAction,
    scoreExplanation: agentResult.scoreExplanation,
    conversationState: agentResult.conversationState,
    suggestedReply: replyText,
    handoffReason: agentResult.handoffReason,
    handoffEmail: agentResult.handoffEmail,
    status: agentResult.needsHandoff
      ? 'handed_off'
      : agentResult.captureLead || agentResult.leadScore >= 70
        ? 'qualified'
        : 'contacted',
    autoReplyPaused: agentResult.needsHandoff,
    lifecycleStage: agentResult.needsHandoff ? 'engaged' : 'engaged',
  });

  await leadsCrm.addMessage({ leadId: lead.id, role: 'agent', text: replyText });

  try {
    await sendInstagramDm(senderId, replyText);
    console.log(`[Instagram] Auto-replied in DM as ${botName} → ${senderId}`);
  } catch (err) {
    console.error('[Instagram] DM send failed:', err.response?.data || err.message);
  }

  return { lead: updated, agentResult: { ...agentResult, reply: replyText } };
}

async function fetchRecentComments(limitMedia = 8) {
  const account = store.getAccount();
  const token = accessTokenOf(account);
  if (!account?.igUserId || !token) {
    throw new Error('Instagram is not connected');
  }

  const base = graphBase(account);
  const mediaRes = await axios.get(`${base}/${account.igUserId}/media`, {
    params: {
      fields: 'id,caption,timestamp,permalink,comments_count',
      limit: limitMedia,
      access_token: token,
    },
  });

  const mediaItems = mediaRes.data.data || [];
  const comments = [];

  for (const media of mediaItems) {
    if (!media.comments_count) continue;
    try {
      const commentsRes = await axios.get(`${base}/${media.id}/comments`, {
        params: {
          fields: 'id,text,username,timestamp,like_count',
          limit: 50,
          access_token: token,
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
  const agentFramework = require('./agentFramework');
  const details = {
    platform: 'Instagram Comment',
    customerComment: comment.text,
  };
  const scored = await vertex.generateSocialReply(details);
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
    id: `ig-${comment.id}`,
    externalId: comment.id,
    source: 'instagram',
    platform: 'Instagram',
    customerComment: comment.text,
    temperature: agentFramework.temperatureFromScore(score),
    score,
    scoreBand: agentFramework.scoreBandFromScore(score),
    intent,
    captureLead,
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
      if (!lead.captureLead && lead.score < 31) {
        store.markCommentsSeen([comment.id]);
        continue;
      }
      leads.push(lead);
      store.markCommentsSeen([comment.id]);
    } catch (err) {
      console.error(`[Instagram] score failed for ${comment.id}:`, err.message);
    }
  }

  const saved = store.appendLeads(leads);

  // Mirror into unified CRM (commercial intent only)
  for (const lead of leads) {
    if (!lead.captureLead && lead.score < 31) continue;
    try {
      const crmLead = await leadsCrm.upsertLead({
        channel: 'instagram',
        platform: 'Instagram',
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
      console.warn('[Instagram] CRM mirror failed:', err.message);
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
    ? `{ type: 'INSTAGRAM_AUTH_SUCCESS', account: ${JSON.stringify(payload.account || null)} }`
    : `{ type: 'INSTAGRAM_AUTH_ERROR', error: ${JSON.stringify(payload.error || 'auth_failed')} }`;
  const fallback = payload.success
    ? JSON.stringify(`${frontendUrl}/?instagram=connected`)
    : JSON.stringify(`${frontendUrl}/?instagram_error=${encodeURIComponent(String(payload.error || 'auth_failed'))}`);
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

function mountRoutes(app, { vertex, leadAgent, requireAuth }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();
  const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://127.0.0.1:3000').replace(/\/$/, '');

  app.get('/api/instagram/status', guard, (_req, res) => {
    res.json(getStatus());
  });

  app.get('/auth/instagram', (req, res) => {
    try {
      const url = authUrl(req.query.state || 'nexora');
      res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Connect Instagram</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1.5rem;color:#102a43;line-height:1.5}
  a{display:inline-block;margin-top:1rem;background:#0e7c7b;color:#fff;text-decoration:none;padding:.75rem 1.25rem;border-radius:999px;font-weight:600}
  li{margin:.35rem 0}
</style>
</head>
<body>
  <h1>Continue to Instagram</h1>
  <p>You will log in, then Instagram must send you back to Nexora. Stay in this browser tab.</p>
  <ol>
    <li>Log in with your Professional Instagram account.</li>
    <li>If Instagram asks to save login info, click <strong>Not now</strong> (not Save).</li>
    <li>Click <strong>Allow</strong> on the permissions screen. Do not close Instagram until you see Nexora again.</li>
  </ol>
  <p>If you land on the Instagram feed, you only signed in to Instagram — come back here and click Continue again.</p>
  <a href="${url}">Continue to Instagram</a>
  <script>setTimeout(function(){ window.location.replace(${JSON.stringify(url)}); }, 800);</script>
</body>
</html>`);
    } catch (err) {
      res.status(400).send(`<h1>Instagram setup needed</h1><p>${err.message}</p>`);
    }
  });

  app.get('/auth/instagram/callback', async (req, res) => {
    const { code, error, error_description: errorDescription } = req.query;
    if (error) {
      console.error('[Instagram] OAuth error:', error, errorDescription);
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
      console.error('[Instagram] Auth Error:', err.response?.data || err.message);
      const message = err.response?.data?.error?.message || err.message || 'auth_failed';
      res.send(oauthReturnScript(FRONTEND_URL, { success: false, error: message }));
    }
  });

  app.post('/api/instagram/disconnect', guard, (_req, res) => {
    store.clearAccount();
    res.json({ success: true });
  });

  app.post('/api/instagram/sync', guard, async (req, res) => {
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

  app.get('/api/instagram/leads', guard, (_req, res) => {
    res.json({ success: true, data: store.getStoredLeads() });
  });

  app.post('/api/instagram/dm', guard, async (req, res) => {
    try {
      const { igScopedId, text, leadId } = req.body || {};
      if (!igScopedId || !text) {
        return res.status(400).json({ success: false, error: 'igScopedId and text required' });
      }
      const data = await sendInstagramDm(igScopedId, text);
      if (leadId) {
        await leadsCrm.addMessage({ leadId, role: 'human', text });
        await leadsCrm.updateLead(leadId, { status: 'contacted', lastMessageAt: new Date() });
      }
      res.json({ success: true, data });
    } catch (err) {
      console.error('[Instagram] DM', err.response?.data || err.message);
      res.status(500).json({
        success: false,
        error: err.response?.data?.error?.message || err.message,
      });
    }
  });

  // Meta webhook verification + comment / messaging events
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
      let sawComments = false;
      const account = store.getAccount();
      const ownIds = new Set(
        [account?.igUserId, account?.pageId].filter(Boolean).map(String)
      );

      for (const entry of entries) {
        // Page messaging (Instagram DMs via Messenger)
        for (const event of entry.messaging || []) {
          const senderId = event.sender?.id;
          const text = event.message?.text;
          const messageId = event.message?.mid;
          const isEcho = Boolean(event.message?.is_echo) || (senderId && ownIds.has(String(senderId)));
          if (senderId && text && leadAgent) {
            await handleIncomingDm(vertex, leadAgent, {
              senderId,
              text,
              messageId,
              isEcho,
            });
          }
        }
        for (const change of entry.changes || []) {
          if (change.field === 'comments' && change.value?.id) {
            sawComments = true;
          }
          // Instagram messaging field
          if (change.field === 'messages') {
            const value = change.value || {};
            const senderId = value.sender?.id || value.from?.id;
            const text = value.message?.text || value.text;
            const messageId = value.message?.mid || value.id;
            const isEcho =
              Boolean(value.message?.is_echo) || (senderId && ownIds.has(String(senderId)));
            if (senderId && text && leadAgent) {
              await handleIncomingDm(vertex, leadAgent, {
                senderId,
                text,
                messageId,
                isEcho,
              });
            }
          }
        }
      }
      if (sawComments && getStatus().connected) {
        await syncAndScoreLeads(vertex);
      }
    } catch (err) {
      console.error('[Instagram] webhook handling error:', err.message);
    }
  });

  app.post('/api/instagram/subscribe-messaging', guard, async (_req, res) => {
    try {
      const account = store.getAccount();
      if (!account) {
        return res.status(400).json({ success: false, error: 'Connect Instagram first' });
      }
      const data = await subscribePageToMessaging(account);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.response?.data?.error?.message || err.message,
      });
    }
  });
}

module.exports = {
  isConfigured,
  getStatus,
  mountRoutes,
  syncAndScoreLeads,
  sendInstagramDm,
  handleIncomingDm,
};
