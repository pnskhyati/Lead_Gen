/* Run: node social/foundation.test.js — time zones, slot planning, platform rules, post state machine. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T = require('./timeUtil');
const { planSlots } = require('./slots');
const R = require('./platformRules');
const store = require('./postStore');
const ctx = require('../workspaceContext');

const WS = `ws-test-s-${Date.now()}`;
const cleanups = [];
const after = (fn) => cleanups.push(fn);
let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.stack.split('\n').slice(0, 3).join('\n       ')}`);
  }
}

(async () => {
  console.log('social foundation');

  // ----------------------------------------------------------------- time
  await test('local times convert to UTC correctly, including India (no DST) and US daylight saving', () => {
    assert.strictEqual(T.zonedToUtc('2026-11-12', '10:30', 'Asia/Kolkata'), '2026-11-12T05:00:00.000Z');
    // New York: EDT (UTC-4) in July, EST (UTC-5) in December.
    assert.strictEqual(T.zonedToUtc('2026-07-01', '09:00', 'America/New_York'), '2026-07-01T13:00:00.000Z');
    assert.strictEqual(T.zonedToUtc('2026-12-01', '09:00', 'America/New_York'), '2026-12-01T14:00:00.000Z');
    // The day clocks change (2026-11-01 in the US): 09:00 local is already EST.
    assert.strictEqual(T.zonedToUtc('2026-11-01', '09:00', 'America/New_York'), '2026-11-01T14:00:00.000Z');
  });

  await test('UTC instants map back to the right local day and time (day can differ from UTC date)', () => {
    assert.strictEqual(T.localDayKey('2026-11-12T20:00:00.000Z', 'Asia/Kolkata'), '2026-11-13'); // 01:30 next day
    assert.strictEqual(T.localTime('2026-11-12T20:00:00.000Z', 'Asia/Kolkata'), '01:30');
    assert.strictEqual(T.localDayKey('2026-11-12T02:00:00.000Z', 'America/Los_Angeles'), '2026-11-11');
  });

  await test('time zone validation, weekdays and date arithmetic', () => {
    assert.ok(T.isValidTimeZone('Asia/Kolkata') && !T.isValidTimeZone('Mars/Olympus') && !T.isValidTimeZone(''));
    assert.strictEqual(T.weekdayOf('2026-11-12'), 4); // Thursday
    assert.strictEqual(T.addDays('2026-12-30', 3), '2027-01-02');
    assert.throws(() => T.zonedToUtc('nope', '10:00', 'UTC'));
    for (const [d, t] of [['2026-13-01', '10:00'], ['2026-02-30', '10:00'], ['2026-11-12', '24:00'], ['2026-11-12', '10:60'], ['2026-00-10', '10:00'], ['2026-11-31', '10:00']]) {
      assert.throws(() => T.zonedToUtc(d, t, 'UTC'), /Invalid date/, `${d} ${t}`);
    }
    assert.strictEqual(T.zonedToUtc('2028-02-29', '10:00', 'UTC'), '2028-02-29T10:00:00.000Z'); // leap day is valid
  });

  // ----------------------------------------------------------------- slots
  const NOW = Date.parse('2026-11-09T04:00:00Z'); // Monday 09:30 IST
  const base = { startDate: '2026-11-10', days: 14, timezone: 'Asia/Kolkata', now: NOW };

  await test('each platform gets its own cadence over two weeks', () => {
    const slots = planSlots({ ...base, platforms: ['linkedin', 'instagram', 'facebook', 'x'] });
    const count = (p) => slots.filter((s) => s.platform === p).length;
    assert.strictEqual(count('linkedin'), 6);
    assert.strictEqual(count('instagram'), 8);
    assert.strictEqual(count('facebook'), 6);
    assert.strictEqual(count('x'), 10);
  });

  await test('LinkedIn only posts on weekdays; no platform posts twice on one day', () => {
    const slots = planSlots({ ...base, platforms: ['linkedin', 'instagram', 'facebook', 'x'] });
    for (const s of slots.filter((x) => x.platform === 'linkedin')) assert.ok(T.weekdayOf(s.date) >= 1 && T.weekdayOf(s.date) <= 5, s.date);
    const seen = new Set();
    for (const s of slots) {
      const k = `${s.platform}:${s.date}`;
      assert.ok(!seen.has(k), `duplicate ${k}`);
      seen.add(k);
    }
  });

  await test('slots stay inside the requested window and are sorted', () => {
    const slots = planSlots({ ...base, platforms: ['instagram', 'x'] });
    for (const s of slots) assert.ok(s.date >= '2026-11-10' && s.date <= '2026-11-23', s.date);
    assert.deepStrictEqual([...slots].map((s) => s.scheduledAt), [...slots].map((s) => s.scheduledAt).sort());
  });

  await test('nothing is scheduled in the past or inside the 30-minute lead time', () => {
    const slots = planSlots({ startDate: '2026-11-09', days: 3, platforms: ['x', 'instagram'], timezone: 'Asia/Kolkata', now: Date.parse('2026-11-09T12:00:00Z') });
    for (const s of slots) assert.ok(new Date(s.scheduledAt).getTime() >= Date.parse('2026-11-09T12:30:00Z'), s.scheduledAt);
    assert.ok(slots.length > 0);
  });

  await test('times land in local windows and are not all on the hour; same input gives the same plan', () => {
    const a = planSlots({ ...base, platforms: ['x'] });
    const b = planSlots({ ...base, platforms: ['x'] });
    assert.deepStrictEqual(a, b);
    for (const s of a) assert.ok(/^(0[89]|1[0-9]):\d\d$/.test(s.time), s.time);
    assert.ok(new Set(a.map((s) => s.time.slice(3))).size > 1, 'minutes vary');
  });

  await test('intensity changes volume; short windows still produce a post', () => {
    const light = planSlots({ ...base, platforms: ['x'], intensity: 'light' }).length;
    const heavy = planSlots({ ...base, platforms: ['x'], intensity: 'heavy' }).length;
    assert.ok(light < heavy);
    assert.ok(planSlots({ ...base, days: 3, platforms: ['linkedin'] }).length >= 1);
  });

  await test('learned best times override the default windows', () => {
    const slots = planSlots({ ...base, platforms: ['linkedin'], bestTimes: { linkedin: ['07:00'] } });
    assert.ok(slots.every((s) => /^0[67]:/.test(s.time)), slots.map((s) => s.time).join());
  });

  // ----------------------------------------------------------------- platform rules
  await test('final text is what the platform receives (text + hashtags)', () => {
    assert.strictEqual(R.finalText({ text: 'Hello world', hashtags: ['Yoga', '#Pune'] }), 'Hello world\n\n#Yoga #Pune');
  });

  await test('fitToPlatform shortens only when needed and respects hashtags in the limit', () => {
    const long = `${'This is a sentence about studio life. '.repeat(20)}`;
    const fit = R.fitToPlatform('x', { text: long, hashtags: ['a', 'b', 'c', 'd'] });
    assert.ok(R.finalText(fit).length <= 280, String(R.finalText(fit).length));
    assert.strictEqual(fit.hashtags.length, 2);
    const ok = R.fitToPlatform('linkedin', { text: 'Short and sweet.', hashtags: [] });
    assert.strictEqual(ok.text, 'Short and sweet.');
  });

  await test('validation catches missing images, long posts, past times and unconnected platforms', () => {
    const now = Date.parse('2026-11-09T00:00:00Z');
    const future = '2026-11-12T05:00:00.000Z';
    const codes = (p, ctxArg) => R.validatePost(p, { now, ...ctxArg }).map((i) => i.code);
    assert.ok(codes({ platform: 'instagram', text: 'hi', scheduledAt: future }).includes('image_required'));
    assert.ok(!codes({ platform: 'instagram', text: 'hi', scheduledAt: future, image: { file: 'x' } }).includes('image_required'));
    assert.ok(codes({ platform: 'x', text: 'a'.repeat(300), scheduledAt: future }).includes('too_long'));
    assert.ok(codes({ platform: 'linkedin', text: 'hi', scheduledAt: '2026-11-08T00:00:00Z' }).includes('past'));
    assert.ok(codes({ platform: 'facebook', text: 'hi', scheduledAt: future }, { connected: { facebook: false } }).includes('not_connected'));
    assert.deepStrictEqual(codes({ platform: 'facebook', text: 'hi', scheduledAt: future }, { connected: { facebook: true } }), []);
    assert.ok(codes({ platform: 'linkedin', text: '', scheduledAt: future }).includes('empty'));
  });

  await test('evenly spaced posts still rotate through the platform time windows (not all at one hour)', () => {
    const slots = planSlots({ ...base, platforms: ['instagram'] });
    const hours = new Set(slots.map((x) => x.time.slice(0, 2)));
    assert.ok(hours.size >= 2, `instagram times: ${slots.map((x) => x.time).join(',')}`);
  });

  await test('offer dates are recognised in common wordings, and only the right date', () => {
    for (const t of ['until 15 November', 'ends 15th Nov', 'Nov 15 only', 'on the 15 of November', 'by NOVEMBER 15th']) assert.ok(R.mentionsDate(t, '2026-11-15'), t);
    for (const t of ['until 16 November', 'in 150 days', 'call 15 minutes', 'November is great']) assert.ok(!R.mentionsDate(t, '2026-11-15'), t);
    assert.ok(!R.mentionsDate('anything', 'not-a-date'));
  });

  await test('a post that promotes an offer after it ended is blocked; "today" wording on the wrong day is flagged', () => {
    const now = Date.parse('2026-11-09T00:00:00Z');
    const base2 = { platform: 'x', scheduledAt: '2026-11-17T05:00:00.000Z', offerEndDate: '2026-11-15' };
    const codes = (p) => R.validatePost({ ...base2, ...p }, { now }).map((i) => `${i.severity}:${i.code}`);
    assert.ok(codes({ dayKey: '2026-11-16', text: 'Today is 15 November, the final day of our offer' }).includes('error:offer_expired'));
    assert.ok(!codes({ dayKey: '2026-11-16', text: 'Join us this week for a calm class' }).some((c) => c.includes('offer')));
    assert.ok(codes({ dayKey: '2026-11-13', text: 'Last day to claim the free class offer' }).includes('warning:offer_timing'));
    assert.ok(!codes({ dayKey: '2026-11-15', text: 'Last day to claim the free class offer' }).some((c) => c.includes('offer_timing')), 'fine on the actual last day');
    assert.ok(!codes({ dayKey: '2026-11-14', text: 'Free class until 15 November' }).some((c) => c.includes('offer_expired')), 'mentioning the date before it ends is fine');
  });

  // ----------------------------------------------------------------- store state machine
  const FUTURE = new Date(Date.now() + 3600_000).toISOString();
  const base1 = (extra = {}) => ({ platform: 'linkedin', text: 'Post', hashtags: [], scheduledAt: FUTURE, dayKey: '2026-11-12', ...extra });

  await test('draft -> approved -> publishing -> published, with timestamps', async () => {
    await ctx.run(WS, async () => {
      const c = await store.createCampaign({ prompt: 'p', platforms: ['linkedin'] });
      const [p] = await store.addPosts(c.id, [base1()]);
      assert.strictEqual(p.status, 'draft');
      await store.approvePosts([p.id]);
      assert.strictEqual(store.getPost(p.id).status, 'approved');
      assert.strictEqual(store.getCampaign(c.id).status, 'approved');
      const claimed = await store.claimDuePosts({ now: Date.parse(FUTURE) + 1000 });
      assert.strictEqual(claimed.length, 1);
      assert.strictEqual(store.getPost(p.id).status, 'publishing');
      await store.markPublished(p.id, 'li-123');
      const done = store.getPost(p.id);
      assert.ok(done.status === 'published' && done.platformPostId === 'li-123' && done.publishedAt);
    });
  });

  await test('invalid transitions and edits of live posts are refused', async () => {
    await ctx.run(WS, async () => {
      const c = await store.createCampaign({ prompt: 'p2' });
      const [p] = await store.addPosts(c.id, [base1()]);
      await assert.rejects(store.setStatus(p.id, 'published', {}), /Cannot move/);
      await store.approvePosts([p.id]);
      await store.claimDuePosts({ now: Date.parse(FUTURE) + 1000 });
      await assert.rejects(store.updatePost(p.id, { text: 'sneaky edit' }), /cannot be edited/);
      await assert.rejects(store.deletePost(p.id), /cannot be deleted/);
    });
  });

  await test('editing an approved post sends it back to draft; cosmetic fields do not', async () => {
    await ctx.run(WS, async () => {
      const c = await store.createCampaign({ prompt: 'p3' });
      const [p] = await store.addPosts(c.id, [base1()]);
      await store.approvePosts([p.id]);
      await store.updatePost(p.id, { imagePrompt: 'new prompt only' });
      assert.strictEqual(store.getPost(p.id).status, 'approved');
      await store.updatePost(p.id, { text: 'changed words', userEdited: true });
      const after = store.getPost(p.id);
      assert.ok(after.status === 'draft' && after.approvedAt === null && after.source === 'edited');
    });
  });

  await test('only due approved posts are claimed; a post is never claimed twice', async () => {
    await ctx.run(WS, async () => {
      const c = await store.createCampaign({ prompt: 'p4' });
      const soon = new Date(Date.now() + 60_000).toISOString();
      const later = new Date(Date.now() + 86_400_000).toISOString();
      const [a, b, d] = await store.addPosts(c.id, [base1({ scheduledAt: soon }), base1({ scheduledAt: later }), base1({ scheduledAt: soon })]);
      await store.approvePosts([a.id, b.id]); // d stays draft
      const now = Date.parse(soon) + 1000;
      const first = await store.claimDuePosts({ now });
      assert.deepStrictEqual(first.map((x) => x.id), [a.id]);
      assert.deepStrictEqual(await store.claimDuePosts({ now }), []);
      assert.strictEqual(store.getPost(d.id).status, 'draft');
      assert.strictEqual(store.getPost(b.id).status, 'approved');
    });
  });

  await test('concurrent claims cannot double-publish the same post', async () => {
    await ctx.run(WS, async () => {
      const c = await store.createCampaign({ prompt: 'p5' });
      const t = new Date(Date.now() + 1000).toISOString();
      const posts = await store.addPosts(c.id, Array.from({ length: 6 }, () => base1({ scheduledAt: t })));
      await store.approvePosts(posts.map((p) => p.id));
      const now = Date.parse(t) + 1000;
      const results = await Promise.all(Array.from({ length: 5 }, () => store.claimDuePosts({ now, limit: 3 })));
      const ids = results.flat().map((p) => p.id);
      assert.strictEqual(ids.length, new Set(ids).size, 'no duplicates across racing workers');
      assert.strictEqual(ids.length, 6);
    });
  });

  await test('transient failures retry with backoff and then give up; permanent failures fail at once', async () => {
    await ctx.run(WS, async () => {
      const c = await store.createCampaign({ prompt: 'p6' });
      const t = new Date(Date.now() + 1000).toISOString();
      const [a, b] = await store.addPosts(c.id, [base1({ scheduledAt: t }), base1({ scheduledAt: t })]);
      await store.approvePosts([a.id, b.id]);
      let now = Date.parse(t) + 1000;
      await store.claimDuePosts({ now });
      await store.markFailed(b.id, { message: 'invalid token', kind: 'permanent' });
      assert.strictEqual(store.getPost(b.id).status, 'failed');
      await store.markFailed(a.id, { message: 'timeout', kind: 'transient' });
      let pa = store.getPost(a.id);
      assert.ok(pa.status === 'approved' && pa.nextAttemptAt && pa.attempts === 1);
      assert.deepStrictEqual(await store.claimDuePosts({ now }), [], 'not retried before the backoff has passed');
      for (let attempt = 2; attempt <= 3; attempt += 1) {
        now += 40 * 60_000;
        const [again] = await store.claimDuePosts({ now });
        assert.strictEqual(again.id, a.id);
        await store.markFailed(a.id, { message: 'timeout', kind: 'transient' });
      }
      pa = store.getPost(a.id);
      assert.ok(pa.status === 'failed' && pa.attempts === 3, 'gives up after the third attempt');
    });
  });

  await test('posts that are too overdue are marked missed instead of published late', async () => {
    await ctx.run(WS, async () => {
      const c = await store.createCampaign({ prompt: 'p7' });
      const t = new Date(Date.now() + 1000).toISOString();
      const [p] = await store.addPosts(c.id, [base1({ scheduledAt: t })]);
      await store.approvePosts([p.id]);
      const claimed = await store.claimDuePosts({ now: Date.parse(t) + 4 * 3_600_000 });
      assert.deepStrictEqual(claimed, []);
      assert.strictEqual(store.getPost(p.id).status, 'missed');
    });
  });

  await test('a crash mid-publish is recovered as "unknown outcome", never retried automatically', async () => {
    const CRASH = `ws-test-s4-${Date.now()}`;
    after(() => fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', CRASH), { recursive: true, force: true }));
    await ctx.run(CRASH, async () => {
      const c = await store.createCampaign({ prompt: 'p8' });
      const t = new Date(Date.now() + 1000).toISOString();
      const [p] = await store.addPosts(c.id, [base1({ scheduledAt: t })]);
      await store.approvePosts([p.id]);
      const now = Date.parse(t) + 1000;
      await store.claimDuePosts({ now });
      assert.deepStrictEqual(await store.recoverStale({ now: now + 60_000 }), [], 'lease still valid');
      assert.deepStrictEqual(await store.recoverStale({ now: now + store.LEASE_MS + 1000 }), [p.id]);
      const after = store.getPost(p.id);
      assert.ok(after.status === 'failed' && after.errorKind === 'unknown' && /unclear whether/.test(after.lastError));
      assert.deepStrictEqual(await store.claimDuePosts({ now: now + 10 * 3600_000 }), []);
    });
  });

  await test('workspaces are isolated and images are stored per workspace', async () => {
    const OTHER = `ws-test-s2-${Date.now()}`;
    let img;
    await ctx.run(WS, async () => {
      img = store.saveImage({ buffer: Buffer.from('fakepng'), mime: 'image/png', source: 'uploaded' });
      assert.ok(store.imageDataUrl(img).startsWith('data:image/png;base64,'));
    });
    await ctx.run(OTHER, async () => {
      assert.strictEqual(store.listPosts().length, 0);
      assert.strictEqual(store.readImage(img), null, 'the other workspace cannot read this image');
      assert.strictEqual(store.imagePath('../../etc/passwd'), null);
    });
    fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', OTHER), { recursive: true, force: true });
  });

  await test('the scheduler only looks at workspaces that have approved posts', async () => {
    const A = `ws-test-s3-${Date.now()}`;
    await ctx.run(A, async () => {
      const c = await store.createCampaign({ prompt: 'x' });
      await store.addPosts(c.id, [base1()]);
    });
    assert.ok(!store.workspacesWithApprovedPosts().includes(A));
    await ctx.run(A, async () => store.approvePosts(store.listPosts().map((p) => p.id)));
    assert.ok(store.workspacesWithApprovedPosts().includes(A));
    fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', A), { recursive: true, force: true });
  });

  cleanups.forEach((fn) => fn());
  fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', WS), { recursive: true, force: true });
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
