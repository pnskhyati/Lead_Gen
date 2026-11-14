/**
 * How published posts are performing, read from the platforms themselves.
 * Only numbers a platform actually returned are shown. Where a platform does not share a number, the field is null and
 * the reason is kept, so a missing figure is never mistaken for zero.
 */
const axios = require('axios');
const store = require('./postStore');
const workspaceContext = require('../workspaceContext');

const FB_GRAPH = 'https://graph.facebook.com/v22.0';
const IG_GRAPH = 'https://graph.instagram.com/v22.0';
const X_API = 'https://api.twitter.com/2';
const FRESH_MS = 10 * 60_000;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

function why(err) {
  const api = err?.response?.data;
  const raw = api?.error?.message || api?.detail || api?.title || (typeof api?.error === 'string' ? api.error : '') || err?.message || 'Unknown error';
  const code = api?.error?.code;
  let hint = '';
  if (code === 190 || err?.response?.status === 401) hint = ' Reconnect this account in Connections.';
  else if (code === 10 || code === 200 || /permission/i.test(raw)) hint = ' The permission to read this is missing; reconnect and allow it.';
  else if (err?.response?.status === 403) hint = ' Your plan or permissions may not allow reading this.';
  return `${String(raw).slice(0, 200)}${hint}`;
}

/** Each reader gets published posts of ONE platform and returns Map(postId -> metrics | { unavailable }). */
function createReaders({ http = axios, accounts, xToken, linkedin = null }) {
  return {
    async x(posts) {
      const out = new Map();
      const token = await xToken();
      for (let i = 0; i < posts.length; i += 100) {
        const batch = posts.slice(i, i + 100);
        const { data } = await http.get(`${X_API}/tweets`, {
          params: { ids: batch.map((p) => p.platformPostId).join(','), 'tweet.fields': 'public_metrics' },
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000,
        });
        const byId = new Map((data.data || []).map((t) => [String(t.id), t.public_metrics || {}]));
        for (const p of batch) {
          const m = byId.get(String(p.platformPostId));
          out.set(p.id, m
            ? { views: num(m.impression_count), likes: num(m.like_count), comments: num(m.reply_count), shares: (num(m.retweet_count) || 0) + (num(m.quote_count) || 0), saves: num(m.bookmark_count) }
            : { unavailable: 'This post was not found on X. It may have been deleted.' });
        }
      }
      return out;
    },

    async facebook(posts) {
      const fb = accounts.facebook();
      if (!fb?.pageAccessToken) throw new Error('Facebook is not connected');
      const out = new Map();
      const get = (id, params) => http.get(`${FB_GRAPH}/${id}`, { params: { ...params, access_token: fb.pageAccessToken }, timeout: 20000 });
      for (const p of posts) {
        let id = p.platformPostId;
        // A photo post is saved by its photo id; the post that shows it (which has likes, shares and views) has another.
        if (!String(id).includes('_')) {
          try {
            const r = await get(id, { fields: 'page_story_id' });
            if (r.data?.page_story_id) id = r.data.page_story_id;
          } catch {
            /* keep the id we have */
          }
        }
        const { data } = await get(id, { fields: 'reactions.summary(true).limit(0),comments.summary(true).limit(0),shares' });
        const m = {
          views: null,
          likes: num(data.reactions?.summary?.total_count),
          comments: num(data.comments?.summary?.total_count),
          shares: num(data.shares?.count) ?? 0,
          saves: null,
        };
        // Views come from Page insights, which can lag a day behind and need their own permission. Never show a missing figure as 0.
        try {
          const r = await http.get(`${FB_GRAPH}/${id}/insights`, { params: { metric: 'post_media_view', access_token: fb.pageAccessToken }, timeout: 20000 });
          const v = num(r.data?.data?.[0]?.values?.[0]?.value);
          m.views = v;
          if (v == null) m.note = 'Facebook has not reported views for this post yet. It can take up to a day.';
        } catch {
          m.note = 'Views are not available: Facebook has not granted the Page insights permission.';
        }
        out.set(p.id, m);
      }
      return out;
    },

    async instagram(posts) {
      const ig = accounts.instagram();
      const token = ig?.accessToken || ig?.pageAccessToken;
      if (!token) throw new Error('Instagram is not connected');
      const base = ig.authMode === 'instagram_login' ? IG_GRAPH : FB_GRAPH;
      const out = new Map();
      for (const p of posts) {
        const { data } = await http.get(`${base}/${p.platformPostId}`, { params: { fields: 'like_count,comments_count', access_token: token }, timeout: 20000 });
        const m = { views: null, likes: num(data.like_count), comments: num(data.comments_count), shares: null, saves: null };
        try {
          const r = await http.get(`${base}/${p.platformPostId}/insights`, { params: { metric: 'reach,saved,shares', access_token: token }, timeout: 20000 });
          const get = (name) => num((r.data?.data || []).find((x) => x.name === name)?.values?.[0]?.value);
          m.views = get('reach');
          m.saves = get('saved');
          m.shares = get('shares');
        } catch {
          m.note = 'Reach and saves are not available for this post.';
        }
        out.set(p.id, m);
      }
      return out;
    },

    async linkedin(posts) {
      if (linkedin?.connected()) return linkedin.read(posts);
      return new Map(posts.map((p) => [p.id, { unavailable: 'LinkedIn does not share post performance with this app. Connect "LinkedIn comments and analytics" in Connections to see them.' }]));
    },
  };
}

function createAnalytics({ readers, now = () => Date.now() }) {
  function refresh(ws, opts) {
    return workspaceContext.run(ws, () => refreshInContext(ws, opts));
  }

  async function refreshInContext(ws, { force = false } = {}) {
    const published = store.listPosts({ status: 'published' }, ws).filter((p) => p.platformPostId);
    const due = published.filter((p) => force || !p.metrics?.fetchedAt || now() - new Date(p.metrics.fetchedAt).getTime() > FRESH_MS);
    const errors = {};
    for (const platform of ['x', 'facebook', 'instagram', 'linkedin']) {
      const mine = due.filter((p) => p.platform === platform);
      if (!mine.length) continue;
      const at = new Date(now()).toISOString();
      try {
        const got = await readers[platform](mine);
        for (const p of mine) await store.setMetrics(p.id, { ...(got.get(p.id) || { unavailable: 'No data returned' }), fetchedAt: at }, ws);
      } catch (err) {
        errors[platform] = why(err);
        for (const p of mine) await store.setMetrics(p.id, { unavailable: errors[platform], fetchedAt: at }, ws);
      }
    }
    return { refreshed: due.length, errors };
  }

  function summary(ws) {
    const posts = store.listPosts({ status: 'published' }, ws).filter((p) => p.platformPostId);
    const platforms = {};
    for (const p of posts) {
      const t = (platforms[p.platform] ||= { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, hasViews: false, unavailable: null });
      t.posts += 1;
      const m = p.metrics;
      if (!m) continue;
      if (m.unavailable) {
        t.unavailable = m.unavailable;
        continue;
      }
      if (m.views != null) {
        t.views += m.views;
        t.hasViews = true;
      }
      t.likes += m.likes || 0;
      t.comments += m.comments || 0;
      t.shares += m.shares || 0;
      t.saves += m.saves || 0;
    }
    const last = posts.map((p) => p.metrics?.fetchedAt).filter(Boolean).sort().at(-1) || null;
    return {
      lastRefreshedAt: last,
      platforms,
      posts: posts
        .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
        .map((p) => ({ id: p.id, platform: p.platform, text: String(p.text || '').slice(0, 140), publishedAt: p.publishedAt, url: p.publishedUrl || null, metrics: p.metrics || null })),
    };
  }

  return { refresh, summary };
}

/** The real thing, wired to the connected accounts. */
function createDefault() {
  const readers = createReaders({
    accounts: { facebook: () => require('../facebookStore').getAccount(), instagram: () => require('../instagramStore').getAccount() },
    xToken: () => require('../x').getAccessToken(),
    linkedin: { connected: () => require('../linkedinCm').getStatus().connected, read: (posts) => require('../linkedinCm').readPostMetrics(posts) },
  });
  return createAnalytics({ readers });
}

module.exports = { createAnalytics, createReaders, createDefault, why };
