/* Run: node social/scheduler.test.js — publishing reliability against a scripted platform. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createWorker, classifyError } = require('./scheduler');
const store = require('./postStore');
const ctx = require('../workspaceContext');

const stamp = Date.now();
const WS = `ws-test-p1-${stamp}`;
const WS2 = `ws-test-p2-${stamp}`;
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

const http = (status, message) => Object.assign(new Error(message || `HTTP ${status}`), { response: { status, data: { error: { message } } } });
const net = (code) => Object.assign(new Error(code), { code });

/** Seed one approved, due post. Returns its id. */
async function seed(ws, extra = {}) {
  return ctx.run(ws, async () => {
    const c = await store.createCampaign({ prompt: 'p', platforms: ['x'] });
    const t = new Date(Date.now() - 60_000).toISOString();
    const [p] = await store.addPosts(c.id, [{ platform: 'x', text: 'Hello', hashtags: ['a'], scheduledAt: t, dayKey: '2026-01-01', ...extra }]);
    await store.approvePosts([p.id]);
    return p.id;
  });
}
const get = (ws, id) => ctx.run(ws, async () => store.getPost(id));

(async () => {
  console.log('social scheduler');

  await test('error classification: only provably-rejected attempts are retryable', () => {
    assert.strictEqual(classifyError(http(429, 'rate limited')).kind, 'transient');
    assert.strictEqual(classifyError(http(503)).kind, 'transient');
    assert.strictEqual(classifyError(net('ENOTFOUND')).kind, 'transient');
    assert.strictEqual(classifyError(net('ECONNREFUSED')).kind, 'transient');
    assert.strictEqual(classifyError(http(500)).kind, 'unknown', 'a 500 may have partly succeeded');
    assert.strictEqual(classifyError(http(502)).kind, 'unknown');
    assert.strictEqual(classifyError(net('ECONNRESET')).kind, 'unknown');
    assert.strictEqual(classifyError(net('ETIMEDOUT')).kind, 'unknown');
    assert.strictEqual(classifyError(Object.assign(new Error('slow'), { timedOut: true })).kind, 'unknown');
    assert.strictEqual(classifyError(http(401, 'Invalid OAuth access token')).kind, 'permanent');
    assert.strictEqual(classifyError(http(400, 'Invalid image')).kind, 'permanent');
    assert.strictEqual(classifyError(new Error('Something odd')).kind, 'permanent', 'unexplained errors are not blindly retried');
    assert.match(classifyError(http(401, 'Invalid OAuth access token')).message, /Invalid OAuth/);
  });

  await test('a due approved post is published inside its own workspace, then never sent again', async () => {
    const id = await seed(WS);
    const seen = [];
    const worker = createWorker({ publish: async (platform, post) => { seen.push({ platform, ws: ctx.current(), content: post.content, headline: post.headline, tags: post.hashtags }); return { id: 'x-99' }; } });
    await worker.tick();
    await worker.tick();
    assert.strictEqual(seen.length, 1);
    assert.deepStrictEqual(seen[0], { platform: 'x', ws: WS, content: 'Hello', headline: '', tags: ['a'] });
    const p = await get(WS, id);
    assert.ok(p.status === 'published' && p.platformPostId === 'x-99' && p.publishedAt);
  });

  await test('drafts and future posts are left alone', async () => {
    const draft = await ctx.run(WS, async () => {
      const c = await store.createCampaign({ prompt: 'd' });
      const [d] = await store.addPosts(c.id, [{ platform: 'x', text: 'draft', hashtags: [], scheduledAt: new Date(Date.now() - 1000).toISOString(), dayKey: 'k' }]);
      const [f] = await store.addPosts(c.id, [{ platform: 'x', text: 'future', hashtags: [], scheduledAt: new Date(Date.now() + 3_600_000).toISOString(), dayKey: 'k' }]);
      await store.approvePosts([f.id]);
      return { d: d.id, f: f.id };
    });
    let calls = 0;
    await createWorker({ publish: async () => { calls += 1; return { id: '1' }; } }).tick();
    assert.strictEqual(calls, 0);
    assert.strictEqual((await get(WS, draft.d)).status, 'draft');
    assert.strictEqual((await get(WS, draft.f)).status, 'approved');
  });

  await test('a rate limit is retried later and then succeeds, publishing exactly once', async () => {
    const id = await seed(WS);
    let calls = 0;
    const worker = createWorker({ publish: async () => { calls += 1; if (calls === 1) throw http(429, 'too many requests'); return { id: 'ok-1' }; } });
    await worker.tick();
    let p = await get(WS, id);
    assert.ok(p.status === 'approved' && p.attempts === 1 && p.nextAttemptAt && /too many/.test(p.lastError));
    await worker.tick({ now: Date.now() + 5_000 });
    assert.strictEqual(calls, 1, 'not retried before the backoff has passed');
    await worker.tick({ now: Date.now() + 20 * 60_000 }); // past the 2-minute backoff, before any other seeded post is due
    p = await get(WS, id);
    assert.ok(p.status === 'published' && calls === 2 && p.platformPostId === 'ok-1');
  });

  await test('an expired token fails immediately with the platform message, no retries', async () => {
    const id = await seed(WS);
    let calls = 0;
    await createWorker({ publish: async () => { calls += 1; throw http(401, 'Invalid OAuth access token'); } }).tick();
    const p = await get(WS, id);
    assert.ok(p.status === 'failed' && p.errorKind === 'permanent' && calls === 1 && /Invalid OAuth/.test(p.lastError));
  });

  await test('a timeout after sending is NOT retried (it may have posted) and tells the owner to check', async () => {
    const id = await seed(WS);
    let calls = 0;
    const worker = createWorker({ publishTimeoutMs: 40, publish: () => { calls += 1; return new Promise(() => {}); } });
    await worker.tick();
    await worker.tick({ now: Date.now() + 20 * 60_000 });
    const p = await get(WS, id);
    assert.ok(p.status === 'failed' && p.errorKind === 'unknown' && calls === 1, `calls=${calls} status=${p.status}`);
    assert.match(p.lastError, /may or may not/);
  });

  await test('a 500 from the platform is treated as unknown outcome, not retried', async () => {
    const id = await seed(WS);
    let calls = 0;
    const worker = createWorker({ publish: async () => { calls += 1; throw http(500, 'internal error'); } });
    await worker.tick();
    await worker.tick({ now: Date.now() + 20 * 60_000 });
    assert.strictEqual(calls, 1);
    assert.strictEqual((await get(WS, id)).errorKind, 'unknown');
  });

  await test('LinkedIn without a linked account fails clearly instead of crashing', async () => {
    const id = await seed(WS, { platform: 'linkedin' });
    let calls = 0;
    await createWorker({ linkedinUrn: () => null, publish: async () => { calls += 1; return { id: '1' }; } }).tick();
    const p = await get(WS, id);
    assert.ok(p.status === 'failed' && calls === 0 && /LinkedIn is not connected/.test(p.lastError));
  });

  await test('LinkedIn receives the workspace identity, and the image as a data URL', async () => {
    const ws = WS2;
    const id = await ctx.run(ws, async () => {
      const image = store.saveImage({ buffer: Buffer.alloc(2500, 5), mime: 'image/png', source: 'generated' });
      const c = await store.createCampaign({ prompt: 'l' });
      const [p] = await store.addPosts(c.id, [{ platform: 'linkedin', text: 'Body', hashtags: [], scheduledAt: new Date(Date.now() - 1000).toISOString(), dayKey: 'k', image }]);
      await store.approvePosts([p.id]);
      return p.id;
    });
    let got;
    await createWorker({ linkedinUrn: (w) => `urn:li:person:${w}`, publish: async (platform, post, opts) => { got = { platform, opts, img: post.imageUrl }; return { id: 'li-1' }; } }).tick();
    assert.strictEqual(got.opts.userUrn, `urn:li:person:${ws}`);
    assert.ok(got.img.startsWith('data:image/png;base64,'));
    assert.strictEqual((await get(ws, id)).status, 'published');
  });

  await test('a missing image file blocks the post with a clear message', async () => {
    const id = await seed(WS, { image: { source: 'generated', file: 'aaaaaaaaaaaaaaaaaaaaaaaa.png', mime: 'image/png', bytes: 1 } });
    let calls = 0;
    await createWorker({ publish: async () => { calls += 1; return { id: '1' }; } }).tick();
    const p = await get(WS, id);
    assert.ok(p.status === 'failed' && calls === 0 && /image file/.test(p.lastError));
  });

  await test('overlapping ticks never double-publish', async () => {
    const id = await seed(WS);
    let calls = 0;
    const worker = createWorker({ publish: async () => { calls += 1; await new Promise((r) => setTimeout(r, 60)); return { id: 'z' }; } });
    const [a, b] = await Promise.all([worker.tick(), worker.tick()]);
    assert.ok(a.skipped || b.skipped, 'one pass was skipped while the other ran');
    assert.strictEqual(calls, 1);
    assert.strictEqual((await get(WS, id)).status, 'published');
  });

  await test('a crash mid-publish is recovered as unknown and never auto-retried', async () => {
    const C = `ws-test-p3-${stamp}`;
    const id = await seed(C);
    await ctx.run(C, async () => store.claimDuePosts({ now: Date.now(), limit: 5 })); // "worker died" right after claiming
    let calls = 0;
    const worker = createWorker({ publish: async () => { calls += 1; return { id: '1' }; } });
    await worker.tick({ now: Date.now() + store.LEASE_MS + 5000 });
    await worker.tick({ now: Date.now() + 2 * store.LEASE_MS });
    const p = await get(C, id);
    assert.ok(p.status === 'failed' && p.errorKind === 'unknown' && calls === 0, `calls=${calls} ${p.status}`);
    fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', C), { recursive: true, force: true });
  });

  await test('posts overdue past the grace window are marked missed, not published late', async () => {
    const id = await seed(WS, { scheduledAt: new Date(Date.now() - 5 * 3_600_000).toISOString() });
    let calls = 0;
    await createWorker({ publish: async () => { calls += 1; return { id: '1' }; } }).tick();
    assert.ok(calls === 0 && (await get(WS, id)).status === 'missed');
  });

  await test('"Publish now" sends exactly the chosen post; a failed one can be retried from the same call', async () => {
    const a = await seed(WS, { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() });
    const b = await seed(WS, { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() });
    const sent = [];
    const worker = createWorker({ publish: async (pf, post) => { sent.push(post.id); return { id: `pub-${post.id}` }; } });
    const r = await worker.publishNow(a, WS);
    assert.ok(r.ok && sent.length === 1 && sent[0] === a);
    assert.strictEqual((await get(WS, b)).status, 'approved', 'the other post is untouched and keeps its attempts');
    assert.strictEqual((await get(WS, b)).attempts, 0);
    // retry a failed post
    const f = await seed(WS);
    await createWorker({ publish: async () => { throw http(401, 'bad token'); } }).tick();
    assert.strictEqual((await get(WS, f)).status, 'failed');
    const again = await createWorker({ publish: async () => ({ id: 'fixed' }) }).publishNow(f, WS);
    assert.ok(again.ok && (await get(WS, f)).status === 'published');
    await assert.rejects(worker.publishNow(f, WS), /not ready/, 'a published post cannot be published again');
  });

  await test('one workspace failing does not stop another from publishing', async () => {
    const A = `ws-test-p4-${stamp}`;
    const B = `ws-test-p5-${stamp}`;
    const idA = await seed(A);
    const idB = await seed(B);
    const worker = createWorker({ publish: async () => (ctx.current() === A ? Promise.reject(http(401, 'nope')) : { id: 'fine' }) });
    await worker.tick();
    assert.strictEqual((await get(A, idA)).status, 'failed');
    assert.strictEqual((await get(B, idB)).status, 'published');
    for (const w of [A, B]) fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', w), { recursive: true, force: true });
  });

  for (const w of [WS, WS2]) fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', w), { recursive: true, force: true });
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
