/* Run: node linkedinCm.test.js — LinkedIn comments, replies and numbers through the Community Management API (LinkedIn is faked). */
const assert = require('assert');
const axios = require('axios');
const ctx = require('./workspaceContext');
const postStore = require('./social/postStore');
const store = require('./linkedinCmStore');
const li = require('./linkedinCm');

const WS = `ws-test-licm-${Date.now()}`;
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

const POST = 'urn:li:share:111';
const C1 = 'urn:li:comment:(urn:li:activity:222,333)';
let posted = null;
axios.get = async (url) => {
  if (url.includes('/socialActions/') && url.includes('/comments')) {
    return { data: { elements: [
      { '$URN': C1, actor: 'urn:li:person:abc', created: { time: Date.parse('2026-11-13T10:00:00Z') }, message: { text: 'How do you handle data entry?' } },
      { '$URN': 'urn:li:comment:(urn:li:activity:222,334)', actor: 'urn:li:person:me', created: { time: 1 }, message: { text: 'our own comment' } },
      { '$URN': 'urn:li:comment:(urn:li:activity:222,335)', actor: 'urn:li:person:abc', parentComment: C1, message: { text: 'a reply in a thread' } },
    ] } };
  }
  if (url.includes('/socialMetadata/')) return { data: { reactionSummaries: { LIKE: { count: 4 }, PRAISE: { count: 1 } }, commentSummary: { count: 2 } } };
  if (url.includes('queryType=IMPRESSION')) return { data: { elements: [{ count: 321 }] } };
  throw Object.assign(new Error('nope'), { response: { data: { message: 'Not enough permissions' } } });
};
axios.post = async (url, body) => {
  posted = { url, body };
  return { data: {}, headers: { 'x-restli-id': 'urn:li:comment:(urn:li:activity:222,999)' } };
};

(async () => {
  await ctx.run(WS, async () => {
    await test('not connected: reading says so plainly', async () => {
      await assert.rejects(() => li.fetchRecentComments(), /not connected/);
    });

    store.setAccount({ accessToken: 't', urn: 'urn:li:person:me', name: 'Sonam', expiresAt: new Date(Date.now() + 86400000).toISOString() });
    const c = await postStore.createCampaign({ prompt: 'p', platforms: ['linkedin'] });
    const [p] = await postStore.addPosts(c.id, [{ platform: 'linkedin', text: 'li post', hashtags: [], scheduledAt: new Date(Date.now() + 3600_000).toISOString(), dayKey: '2026-11-14' }]);
    await postStore.approvePosts([p.id]);
    await postStore.claimDuePosts({ now: Date.now() + 7200_000 });
    await postStore.markPublished(p.id, POST, undefined, { url: 'https://example.test/li' });

    await test('comments by others are read; our own comments and threaded replies are left out', async () => {
      const list = await li.fetchRecentComments();
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].id, C1);
      assert.strictEqual(list[0].text, 'How do you handle data entry?');
    });

    await test('a reply goes under the comment, from the connected person, on the right post', async () => {
      const r = await li.replyToComment(C1, 'Thanks! We connect your systems.');
      assert.match(posted.url, /socialActions\/urn%3Ali%3Aactivity%3A222\/comments/);
      assert.strictEqual(posted.body.actor, 'urn:li:person:me');
      assert.strictEqual(posted.body.parentComment, C1);
      assert.strictEqual(posted.body.object, 'urn:li:activity:222');
      assert.ok(r.id);
    });

    await test('post numbers: real figures where LinkedIn gives them, null with a note where it does not', async () => {
      const m = (await li.readPostMetrics([{ id: p.id, platformPostId: POST }])).get(p.id);
      assert.deepStrictEqual([m.likes, m.comments, m.views], [5, 2, 321]);
      assert.strictEqual(m.shares, null);
      assert.match(m.note, /reshare: Not enough permissions/);
    });

    await test('an expired sign-in is reported, not used', async () => {
      store.setAccount({ accessToken: 't', urn: 'x', expiresAt: new Date(Date.now() - 1000).toISOString() });
      assert.strictEqual(li.getStatus().connected, false);
      await assert.rejects(() => li.fetchRecentComments(), /expired/);
    });

    store.clearAccount();
  });

  await test('status names the exact settings that are missing', () => {
    const keep = { ...process.env };
    delete process.env.LINKEDIN_CM_CLIENT_ID;
    assert.ok(li.getStatus().missing.includes('LINKEDIN_CM_CLIENT_ID'));
    Object.assign(process.env, keep);
  });

  const fs = require('fs');
  const path = require('path');
  for (const f of ['social-planner.json'].map((n) => path.join(__dirname, 'data', 'company', n)).concat(path.join(__dirname, 'data', 'linkedin-cm.json'))) {
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
