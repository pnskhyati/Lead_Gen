/* Run: node social/analytics.test.js — post performance read from the platforms: real numbers only, reasons when unavailable. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const store = require('./postStore');
const { createAnalytics, createReaders } = require('./analytics');
const ctx = require('../workspaceContext');

const WS = `ws-test-an-${Date.now()}`;
const FUTURE = new Date(Date.now() + 3600_000).toISOString();
let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.stack.split('\n').slice(0, 4).join('\n       ')}`);
  }
}

let calls = [];
let failFor = null; // a substring of a URL that should fail
let denyInsights = false;
const http = {
  get: async (url, opts = {}) => {
    calls.push(url);
    if (failFor && url.includes(failFor)) throw Object.assign(new Error('nope'), { response: { status: 400, data: { error: { message: 'Permission denied', code: 200 } } } });
    if (url.includes('api.twitter.com/2/tweets')) {
      const ids = String(opts.params.ids).split(',');
      return { data: { data: ids.filter((i) => i !== 'gone').map((id) => ({ id, public_metrics: { impression_count: 120, like_count: 7, reply_count: 2, retweet_count: 1, quote_count: 1, bookmark_count: 3 } })) } };
    }
    if (url.includes('/insights')) {
      if (denyInsights || url.includes('facebook')) throw Object.assign(new Error('x'), { response: { status: 400, data: { error: { message: '(#10) permission', code: 10 } } } });
      return { data: { data: [{ name: 'reach', values: [{ value: 55 }] }, { name: 'saved', values: [{ value: 4 }] }, { name: 'shares', values: [{ value: 2 }] }] } };
    }
    if (url.includes('graph.facebook.com/v22.0/photo1') && opts.params?.fields === 'page_story_id') return { data: { page_story_id: 'page_story9' } };
    if (url.includes('graph.facebook.com/v22.0/photo1')) throw Object.assign(new Error('x'), { response: { status: 400, data: { error: { message: '(#100) Tried accessing nonexisting field (reactions)', code: 100 } } } });
    if (url.includes('graph.facebook.com/v22.0/page_story9') && !url.includes('/insights')) return { data: { reactions: { summary: { total_count: 4 } }, comments: { summary: { total_count: 1 } }, shares: { count: 0 } } };
    if (url.includes('graph.facebook.com')) return { data: { reactions: { summary: { total_count: 9 } }, comments: { summary: { total_count: 3 } }, shares: { count: 2 } } };
    if (url.includes('graph.instagram.com')) return { data: { like_count: 11, comments_count: 5 } };
    throw new Error(`unexpected ${url}`);
  },
};

const readers = createReaders({
  http,
  accounts: { facebook: () => ({ pageAccessToken: 't' }), instagram: () => ({ authMode: 'instagram_login', accessToken: 't' }) },
  xToken: async () => 'xt',
});
let clock = Date.now();
const analytics = createAnalytics({ readers, now: () => clock });

(async () => {
  let ids = {};
  await ctx.run(WS, async () => {
    const c = await store.createCampaign({ prompt: 'p', platforms: ['x', 'facebook', 'instagram', 'linkedin'] });
    const mk = (platform, text) => ({ platform, text, hashtags: [], scheduledAt: FUTURE, dayKey: '2026-11-14' });
    const posts = await store.addPosts(c.id, [mk('x', 'tweet one'), mk('x', 'tweet gone'), mk('facebook', 'fb post'), mk('instagram', 'ig post'), mk('linkedin', 'li post')]);
    const pid = ['111', 'gone', 'fb1', 'ig1', 'li1'];
    for (const [k, p] of posts.entries()) {
      await store.approvePosts([p.id]);
      await store.claimSpecific?.(p.id);
      await store.markPublished(p.id, pid[k], undefined, { url: `https://example.test/${pid[k]}` }).catch(async () => {
        await store.claimDuePosts({ now: Date.parse(FUTURE) + 1000 });
        await store.markPublished(p.id, pid[k], undefined, { url: `https://example.test/${pid[k]}` });
      });
    }
    ids = Object.fromEntries(posts.map((p, k) => [pid[k], p.id]));
  });

  const get = (k) => ctx.run(WS, async () => store.getPost(ids[k]));

  await test('the link to a published post is saved with it', async () => {
    assert.strictEqual((await get('111')).publishedUrl, 'https://example.test/111');
  });

  await test('X: the real counts are read; a deleted post is reported as missing, not as zeros', async () => {
    await analytics.refresh(WS, { force: true });
    const m = (await get('111')).metrics;
    assert.deepStrictEqual([m.views, m.likes, m.comments, m.shares, m.saves], [120, 7, 2, 2, 3]);
    assert.match((await get('gone')).metrics.unavailable, /not found on X/);
  });

  await test('Facebook: likes, comments and shares are real; reach is null with a reason when the permission is missing, never 0', async () => {
    const m = (await get('fb1')).metrics;
    assert.deepStrictEqual([m.likes, m.comments, m.shares], [9, 3, 2]);
    assert.strictEqual(m.views, null);
    assert.match(m.note, /insights permission/);
  });

  await test('Facebook: a photo post saved by its photo id is resolved to its post, so likes and comments are still real', async () => {
    const m = (await readers.facebook([{ id: 'x', platformPostId: 'photo1' }])).get('x');
    assert.deepStrictEqual([m.likes, m.comments, m.shares], [4, 1, 0]);
  });

  await test('Facebook: views that Facebook has not reported yet stay empty with a note, not 0', async () => {
    const empty = createReaders({
      http: { get: async (url) => (url.includes('/insights') ? { data: { data: [] } } : { data: { reactions: { summary: { total_count: 1 } }, comments: { summary: { total_count: 0 } } } }) },
      accounts: { facebook: () => ({ pageAccessToken: 't' }), instagram: () => null },
      xToken: async () => 't',
    });
    const m = (await empty.facebook([{ id: 'y', platformPostId: 'page_post1' }])).get('y');
    assert.strictEqual(m.views, null);
    assert.match(m.note, /not reported views/);
  });

  await test('Instagram: likes and comments, plus reach and saves when allowed', async () => {
    const m = (await get('ig1')).metrics;
    assert.deepStrictEqual([m.likes, m.comments, m.views, m.saves, m.shares], [11, 5, 55, 4, 2]);
  });

  await test('LinkedIn is honestly marked unavailable with the reason', async () => {
    assert.match((await get('li1')).metrics.unavailable, /Connect "LinkedIn comments and analytics"/);
  });

  await test('recent numbers are reused for 10 minutes; "force" asks again', async () => {
    calls = [];
    const r = await analytics.refresh(WS);
    assert.strictEqual(r.refreshed, 0);
    assert.strictEqual(calls.length, 0);
    clock += 11 * 60_000;
    const r2 = await analytics.refresh(WS);
    assert.ok(r2.refreshed >= 4 && calls.length > 0);
  });

  await test('one platform failing is recorded with its reason and does not stop the others', async () => {
    clock += 11 * 60_000;
    failFor = 'graph.instagram.com';
    const r = await analytics.refresh(WS);
    failFor = null;
    assert.match(r.errors.instagram, /Permission denied/);
    assert.match((await get('ig1')).metrics.unavailable, /permission/i);
    assert.strictEqual((await get('111')).metrics.likes, 7, 'X still refreshed');
  });

  await test('the summary adds up only real numbers and keeps the reasons', async () => {
    clock += 11 * 60_000;
    await analytics.refresh(WS, { force: true });
    const s = await ctx.run(WS, async () => analytics.summary(WS));
    assert.strictEqual(s.platforms.x.posts, 2);
    assert.strictEqual(s.platforms.x.likes, 7);
    assert.strictEqual(s.platforms.x.hasViews, true);
    assert.strictEqual(s.platforms.facebook.hasViews, false);
    assert.match(s.platforms.linkedin.unavailable, /LinkedIn/);
    assert.ok(s.posts.every((p) => p.url));
    assert.ok(s.lastRefreshedAt);
  });

  for (const f of [path.join(__dirname, '..', 'data', 'company', 'social-planner.json')]) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (j.workspaces) delete j.workspaces[WS];
      fs.writeFileSync(f, JSON.stringify(j, null, 2));
    } catch {
      /* nothing stored */
    }
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  setTimeout(() => process.exit(failures ? 1 : 0), 100);
})();
