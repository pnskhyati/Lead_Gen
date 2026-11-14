/* Run: node social/generator.test.js — plan generation, per-platform fitting, retries, images, rewrites. Uses a scripted model. */
process.env.RAG_DISABLE_EMBEDDINGS = 'true';
process.env.SOCIAL_IMAGE_RETRY_DELAYS = '';
process.env.RAG_VERIFY = 'off';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gen = require('./generator');
const store = require('./postStore');
const competitors = require('./competitors');
const ck = require('../companyKnowledge');
const rag = require('../rag');
const ctx = require('../workspaceContext');

const stamp = Date.now();
const WS = `ws-test-g1-${stamp}`;
const cleanups = [];
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

// A 1x1-ish PNG padded beyond the 1000-byte sanity floor.
const PNG = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2000, 7)]).toString('base64')}`;
const okImages = async () => PNG;

/** A scripted model: reads the slot indices out of the prompt and answers per call type. */
function scriptedModel(opts = {}) {
  const calls = [];
  return {
    calls,
    async generateJson(prompt, schema) {
      calls.push({ prompt, kind: schema.properties.theme ? 'strategy' : 'copy' });
      if (schema.properties.theme) {
        if (opts.strategyFails) throw new Error('strategy exploded');
        const idx = [...prompt.matchAll(/^\[(\d+)\] /gm)].map((m) => Number(m[1]));
        return {
          theme: 'Diwali glow week',
          summary: 'A story from awareness to booking.',
          offerEndDate: opts.offerEndDate ?? '',
          posts: idx.filter((i) => !(opts.skipStrategy || []).includes(i)).map((i) => ({ i, pillar: i % 2 ? 'Education' : 'Offer', topic: `Topic ${i}`, angle: `Angle ${i}`, promo: opts.promo || 'soft' })),
        };
      }
      const platform = (/Write \d+ (\w+) post/.exec(prompt) || [])[1];
      const idx = [...prompt.matchAll(/^\[(\d+)\] \d{4}/gm)].map((m) => Number(m[1]));
      const isRetry = /IMPORTANT: every post/.test(prompt);
      return {
        posts: idx
          .filter((i) => !(opts.skipCopy || []).includes(i) || isRetry)
          .map((i) => {
            let text = `${platform} post number ${i}. Fresh ideas for your studio this week.`;
            if (platform === 'X') text = `${'This is a deliberately long tweet that will not fit. '.repeat(8)}`;
            if ((opts.competitorIn || []).includes(i) && !isRetry) text = `Better than ${opts.competitorName} for sure ${i}`;
            if (opts.mentionEndDate && !isRetry) text = `Hurry, our offer runs until ${opts.mentionEndDate}. Post ${i}.`;
            return { i, text, hashtags: ['Yoga', 'Pune', 'Wellness', 'Diwali', 'Glow', 'Extra'], imagePrompt: `A calm yoga studio scene ${i}`, rationale: `Because ${i}` };
          }),
      };
    },
  };
}

const base = { prompt: 'Promote our Diwali offer: first class free until 15 Nov at Lotus Yoga', startDate: '2026-11-10', days: 7, platforms: ['linkedin', 'instagram', 'facebook', 'x'], timezone: 'Asia/Kolkata', now: Date.parse('2026-11-09T04:00:00Z') };

(async () => {
  console.log('social generator');
  ck.saveProfile({ companyName: 'Lotus Yoga', botName: 'Lila', voiceTone: 'Warm and calm', writingStyle: 'Short sentences', industry: 'Yoga studio', location: 'Pune', audience: 'Busy professionals' }, WS);
  ck.addDocument({ title: 'Info', text: 'Lotus Yoga offers Hatha, Vinyasa and Yin classes in Koregaon Park. The first class is free for new students. Drop-in costs Rs 600.' }, WS);
  rag.reload(WS);
  cleanups.push(() => fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', WS), { recursive: true, force: true }));

  await test('one prompt produces a draft calendar: every slot has a platform-valid post and an image', async () => {
    const model = scriptedModel();
    const stages = [];
    const r = await gen.generatePlan({ vertex: model, imageGenerator: okImages, ...base, onProgress: (s) => stages.push(s) }, WS);
    await ctx.run(WS, async () => {
      const posts = store.listPosts({ campaignId: r.campaignId });
      assert.strictEqual(posts.length, r.posts);
      assert.ok(posts.length >= 12);
      for (const p of posts) {
        assert.strictEqual(p.status, 'draft');
        assert.ok(p.text.length > 0, `${p.platform} has text`);
        assert.ok(p.image && p.imageStatus === 'ready' && p.image.source === 'generated');
        assert.ok(require('./platformRules').finalText(p).length <= require('./platformRules').rulesFor(p.platform).maxChars, `${p.platform} within limit`);
        assert.ok(p.rationale && p.topic && p.dayKey);
      }
      const c = store.getCampaign(r.campaignId);
      assert.strictEqual(c.status, 'review');
      assert.strictEqual(c.theme, 'Diwali glow week');
    });
    assert.deepStrictEqual([...new Set(stages)], ['planning', 'writing', 'images', 'done']);
  });

  await test('the model is given the owner brief, brand voice, approved facts and the no-invention rules', async () => {
    const model = scriptedModel();
    await gen.generatePlan({ vertex: model, imageGenerator: okImages, ...base, days: 3, platforms: ['instagram'] }, WS);
    const strategy = model.calls.find((c) => c.kind === 'strategy').prompt;
    const copy = model.calls.find((c) => c.kind === 'copy').prompt;
    for (const p of [strategy, copy]) {
      assert.ok(p.includes('first class free until 15 Nov'), 'owner brief');
      assert.ok(/FACT RULES/.test(p) && /Never invent prices/.test(p), 'grounding rules');
      assert.ok(/Lotus Yoga/.test(p) && /Koregaon Park/.test(p), 'brand + retrieved facts');
    }
    assert.ok(/Warm and calm/.test(copy), 'brand voice');
    assert.ok(/INSTAGRAM STYLE/.test(copy) && /5-10 relevant hashtags/.test(copy), 'platform style guide');
  });

  await test('each platform is written in its own batch with its own limits (an over-long tweet is cut to fit)', async () => {
    const model = scriptedModel();
    const r = await gen.generatePlan({ vertex: model, imageGenerator: okImages, ...base, days: 7 }, WS);
    const copyCalls = model.calls.filter((c) => c.kind === 'copy');
    const labels = new Set(copyCalls.map((c) => /Write \d+ (\w+) post/.exec(c.prompt)[1]));
    assert.deepStrictEqual([...labels].sort(), ['Facebook', 'Instagram', 'LinkedIn', 'X']);
    await ctx.run(WS, async () => {
      const xs = store.listPosts({ campaignId: r.campaignId, platform: 'x' });
      assert.ok(xs.length > 0);
      for (const p of xs) {
        assert.ok(require('./platformRules').finalText(p).length <= 280);
        assert.ok(p.hashtags.length <= 2);
      }
      for (const p of store.listPosts({ campaignId: r.campaignId, platform: 'linkedin' })) assert.ok(p.hashtags.length <= 5);
    });
  });

  await test('a failed image is left empty and flagged (never replaced with stock art)', async () => {
    // Some pictures keep being refused (the quota does not refill for them), the rest succeed.
    const refused = (prompt) => [...prompt].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 2 === 0;
    const flaky = async (prompt) => {
      if (refused(prompt)) throw new Error('quota exceeded');
      return PNG;
    };
    const r = await gen.generatePlan({ vertex: scriptedModel(), imageGenerator: flaky, ...base, days: 7, platforms: ['instagram'] }, WS);
    await ctx.run(WS, async () => {
      const posts = store.listPosts({ campaignId: r.campaignId });
      const failed = posts.filter((p) => p.imageStatus === 'failed');
      assert.ok(failed.length > 0 && failed.length < posts.length);
      for (const p of failed) assert.ok(p.image === null && /quota/.test(p.imageError));
      for (const p of posts.filter((x) => x.imageStatus === 'ready')) assert.ok(store.imageDataUrl(p.image));
    });
  });

  await test('garbage from the image model is rejected', async () => {
    const r = await gen.generatePlan({ vertex: scriptedModel(), imageGenerator: async () => 'data:image/png;base64,AAAA', ...base, days: 3, platforms: ['instagram'] }, WS);
    await ctx.run(WS, async () => assert.ok(store.listPosts({ campaignId: r.campaignId }).every((p) => p.imageStatus === 'failed')));
  });

  await test('posts that name a competitor are rewritten once, and dropped (blank) if the retry also fails', async () => {
    competitors.setCompetitors([{ name: 'Zenith Yoga' }], WS);
    const model = scriptedModel({ competitorIn: [0], competitorName: 'Zenith Yoga' });
    const r = await gen.generatePlan({ vertex: model, imageGenerator: okImages, ...base, days: 3, platforms: ['instagram'] }, WS);
    await ctx.run(WS, async () => {
      const posts = store.listPosts({ campaignId: r.campaignId });
      assert.ok(posts.every((p) => !/Zenith/i.test(p.text)), 'no competitor name in any post');
      assert.ok(posts.every((p) => p.text.length > 0), 'the retry replaced the offending post');
    });
    assert.ok(model.calls.some((c) => /IMPORTANT: every post/.test(c.prompt)), 'a retry was made');
    // A model that keeps naming the competitor leaves a blank draft for the owner to fix.
    const stubborn = scriptedModel();
    const orig = stubborn.generateJson;
    stubborn.generateJson = async (prompt, schema) => {
      const out = await orig(prompt, schema);
      if (!schema.properties.theme) out.posts.forEach((p) => { p.text = `Unlike Zenith Yoga we care ${p.i}`; });
      return out;
    };
    const r2 = await gen.generatePlan({ vertex: stubborn, imageGenerator: okImages, ...base, days: 3, platforms: ['instagram'] }, WS);
    await ctx.run(WS, async () => assert.ok(store.listPosts({ campaignId: r2.campaignId }).every((p) => p.text === '')));
    competitors.setCompetitors([], WS);
  });

  await test('posts the model skipped are retried, and stay as blank drafts with an explanation if still missing', async () => {
    const model = scriptedModel({ skipCopy: [1] });
    const r = await gen.generatePlan({ vertex: model, imageGenerator: okImages, ...base, days: 3, platforms: ['instagram'] }, WS);
    await ctx.run(WS, async () => assert.ok(store.listPosts({ campaignId: r.campaignId }).every((p) => p.text.length > 0), 'retry filled the gap'));
    const hopeless = scriptedModel();
    const o = hopeless.generateJson;
    hopeless.generateJson = async (prompt, schema) => {
      const out = await o(prompt, schema);
      if (!schema.properties.theme) out.posts = out.posts.slice(1);
      return out;
    };
    const r2 = await gen.generatePlan({ vertex: hopeless, imageGenerator: okImages, ...base, days: 3, platforms: ['instagram'] }, WS);
    await ctx.run(WS, async () => {
      const blanks = store.listPosts({ campaignId: r2.campaignId }).filter((p) => p.text === '');
      assert.ok(blanks.length >= 1 && blanks.every((p) => /could not be generated/.test(p.rationale)));
    });
  });

  await test('a strategy that skips slots falls back to the owner brief instead of failing', async () => {
    const r = await gen.generatePlan({ vertex: scriptedModel({ skipStrategy: [0, 1] }), imageGenerator: okImages, ...base, days: 3, platforms: ['instagram'] }, WS);
    await ctx.run(WS, async () => assert.ok(store.listPosts({ campaignId: r.campaignId }).every((p) => p.topic.length > 0)));
  });

  await test('a failing model marks the campaign failed and reports why', async () => {
    await assert.rejects(gen.generatePlan({ vertex: scriptedModel({ strategyFails: true }), imageGenerator: okImages, ...base, days: 3, platforms: ['x'] }, WS), /strategy exploded/);
    await ctx.run(WS, async () => {
      const failed = store.listCampaigns().find((c) => c.status === 'failed');
      assert.ok(failed && /strategy exploded/.test(failed.error));
    });
  });

  await test('input is validated before anything is spent', async () => {
    await assert.rejects(gen.generatePlan({ vertex: scriptedModel(), imageGenerator: okImages, ...base, platforms: [] }, WS), /at least one platform/);
    await assert.rejects(gen.generatePlan({ vertex: scriptedModel(), imageGenerator: okImages, ...base, prompt: '  ' }, WS), /Describe what/);
    await assert.rejects(gen.generatePlan({ vertex: scriptedModel(), imageGenerator: okImages, ...base, startDate: '2026-11-01', days: 1, platforms: ['x'] }, WS), /No posting times/);
  });

  await test('regenerating text keeps the post editable, follows the instruction, and avoids sibling topics', async () => {
    const model = scriptedModel();
    const r = await gen.generatePlan({ vertex: model, imageGenerator: okImages, ...base, days: 3, platforms: ['linkedin', 'instagram'] }, WS);
    let postId;
    await ctx.run(WS, async () => { postId = store.listPosts({ campaignId: r.campaignId })[0].id; });
    const before = model.calls.length;
    const updated = await gen.regeneratePost({ vertex: model, imageGenerator: okImages, postId, instruction: 'Make it shorter and mention the free first class', scope: 'text' }, WS);
    const prompt = model.calls[before].prompt;
    assert.ok(/REWRITE/.test(prompt) && /Make it shorter and mention the free first class/.test(prompt));
    assert.ok(/Other posts in this campaign/.test(prompt));
    assert.strictEqual(updated.source, 'edited');
    assert.strictEqual(updated.status, 'draft');
  });

  await test('regenerating an image works, and a failure surfaces instead of keeping a stale image', async () => {
    const r = await gen.generatePlan({ vertex: scriptedModel(), imageGenerator: okImages, ...base, days: 3, platforms: ['instagram'] }, WS);
    let post;
    await ctx.run(WS, async () => { post = store.listPosts({ campaignId: r.campaignId })[0]; });
    const fresh = await gen.regeneratePost({ vertex: scriptedModel(), imageGenerator: okImages, postId: post.id, scope: 'image', imagePrompt: 'Sunrise over the studio' }, WS);
    assert.notStrictEqual(fresh.image.file, post.image.file);
    assert.strictEqual(fresh.imagePrompt, 'Sunrise over the studio');
    await assert.rejects(gen.regeneratePost({ vertex: scriptedModel(), imageGenerator: async () => { throw new Error('model busy'); }, postId: post.id, scope: 'image' }, WS), /model busy/);
  });

  await test('an uploaded image for a day replaces that day only; approved posts go back to review', async () => {
    const r = await gen.generatePlan({ vertex: scriptedModel(), imageGenerator: okImages, ...base, days: 7, platforms: ['instagram', 'facebook', 'x'] }, WS);
    let day, others, approvedId;
    await ctx.run(WS, async () => {
      const posts = store.listPosts({ campaignId: r.campaignId });
      day = posts[0].dayKey;
      others = posts.filter((p) => p.dayKey !== day).map((p) => ({ id: p.id, file: p.image.file }));
      approvedId = posts.find((p) => p.dayKey === day).id;
      await store.approvePosts([approvedId]);
    });
    const image = await ctx.run(WS, async () => store.saveImage({ buffer: Buffer.alloc(3000, 9), mime: 'image/jpeg', source: 'uploaded' }));
    const touched = await gen.applyImageToDay({ campaignId: r.campaignId, dayKey: day, image }, WS);
    assert.ok(touched.length >= 1);
    await ctx.run(WS, async () => {
      for (const id of touched) {
        const p = store.getPost(id);
        assert.ok(p.image.file === image.file && p.image.source === 'uploaded' && p.image.dayUpload === day);
      }
      assert.strictEqual(store.getPost(approvedId).status, 'draft', 'a changed image needs re-approval');
      for (const o of others) assert.strictEqual(store.getPost(o.id).image.file, o.file, 'other days untouched');
    });
  });

  await test('image generation backs off and retries on rate limits, but never on real failures', async () => {
    const pctx = { company: 'Lotus', industry: 'Yoga' };
    const post = { platform: 'instagram', imagePrompt: 'a calm studio' };
    let calls = 0;
    const limited = Object.assign(new Error('Image generation is rate-limited right now (RESOURCE_EXHAUSTED)'), { rateLimited: true });
    const flaky = async () => { calls += 1; if (calls < 3) throw limited; return PNG; };
    const ok1 = await gen.generateOneImage(post, pctx, flaky, WS, [1, 1, 1]);
    assert.ok(ok1.imageStatus === 'ready' && calls === 3, `calls=${calls}`);
    calls = 0;
    const always = async () => { calls += 1; throw limited; };
    const bad = await gen.generateOneImage(post, pctx, always, WS, [1, 1]);
    assert.ok(bad.imageStatus === 'failed' && bad.imageRetryable === true && calls === 3, `calls=${calls}`);
    calls = 0;
    const policy = async () => { calls += 1; throw new Error('Prompt blocked by safety filters'); };
    const blocked = await gen.generateOneImage(post, pctx, policy, WS, [1, 1, 1]);
    assert.ok(blocked.imageStatus === 'failed' && blocked.imageRetryable === false && calls === 1, 'safety blocks are not retried');
  });

  await test('after a rate-limited first pass the plan makes a second pass, so owners are not left with gaps', async () => {
    const seen = new Set();
    const limited = Object.assign(new Error('RESOURCE_EXHAUSTED quota'), { rateLimited: true });
    const failFirstTime = async (prompt) => {
      if (!seen.has(prompt)) { seen.add(prompt); throw limited; }
      return PNG;
    };
    const r = await gen.generatePlan({ vertex: scriptedModel(), imageGenerator: failFirstTime, ...base, days: 5, platforms: ['instagram', 'linkedin'] }, WS);
    await ctx.run(WS, async () => {
      const posts = store.listPosts({ campaignId: r.campaignId });
      assert.ok(posts.length >= 4 && posts.every((p) => p.imageStatus === 'ready' && p.image), posts.map((p) => p.imageStatus).join());
    });
  });

  await test('"create missing images" fills only the gaps and leaves existing, approved and published posts alone', async () => {
    const limited = Object.assign(new Error('RESOURCE_EXHAUSTED'), { rateLimited: true });
    const r = await gen.generatePlan({ vertex: scriptedModel(), imageGenerator: async () => { throw limited; }, ...base, days: 5, platforms: ['instagram', 'x'] }, WS);
    let ids;
    await ctx.run(WS, async () => {
      ids = store.listPosts({ campaignId: r.campaignId }).map((p) => p.id);
      assert.ok(ids.length >= 4 && store.listPosts({ campaignId: r.campaignId }).every((p) => p.imageStatus === 'failed'));
      // give one post its own image, and approve another (an approved post is not touched)
      const own = store.saveImage({ buffer: Buffer.alloc(3000, 8), mime: 'image/png', source: 'uploaded' });
      await store.updatePost(ids[0], { image: own, imageStatus: 'ready' });
      await store.approvePosts([ids[1]]);
    });
    let calls = 0;
    const progress = [];
    const res = await gen.fillMissingImages({ imageGenerator: async () => { calls += 1; return PNG; }, campaignId: r.campaignId, onProgress: (s, d) => progress.push(d.done) }, WS);
    await ctx.run(WS, async () => {
      const posts = store.listPosts({ campaignId: r.campaignId });
      assert.strictEqual(posts.find((p) => p.id === ids[0]).image.source, 'uploaded', 'the owner image is kept');
      assert.ok(!posts.find((p) => p.id === ids[1]).image, 'an approved post is not changed behind the owner back');
      assert.ok(posts.filter((p) => p.id !== ids[0] && p.id !== ids[1]).every((p) => p.image && p.imageStatus === 'ready'));
    });
    assert.strictEqual(calls, ids.length - 2);
    assert.strictEqual(res.attempted, ids.length - 2);
    assert.strictEqual(res.stillMissing, 0, 'nothing reviewable is left without an image (the approved post was deliberately not touched)');
    assert.strictEqual(progress[progress.length - 1], ids.length - 2);
  });

  await test('each post is told its own date and where it sits relative to the offer, and the promo balance is enforced in code', async () => {
    const model = scriptedModel({ offerEndDate: '2026-11-13', promo: 'lead' });
    const r = await gen.generatePlan({ vertex: model, imageGenerator: okImages, ...base, days: 7, platforms: ['instagram', 'x', 'linkedin'] }, WS);
    const copyPrompts = model.calls.filter((c) => c.kind === 'copy').map((c) => c.prompt).join('\n');
    assert.ok(/offer: ENDED on 2026-11-13; do NOT mention/.test(copyPrompts), 'posts after the end are told it ended');
    assert.ok(/offer: runs until 2026-11-13/.test(copyPrompts), 'posts before the end know the end date');
    assert.ok(/LAST DAY is today \(2026-11-13\)/.test(copyPrompts), 'the last day is marked');
    assert.ok(/Each post is written for its OWN date/.test(copyPrompts));
    await ctx.run(WS, async () => {
      const posts = store.listPosts({ campaignId: r.campaignId });
      assert.strictEqual(store.getCampaign(r.campaignId).offerEndDate, '2026-11-13');
      const after = posts.filter((p) => p.dayKey > '2026-11-13');
      assert.ok(after.length > 0 && after.every((p) => p.promo === 'none'), 'no promotion after the offer ends');
      const leads = posts.filter((p) => p.promo === 'lead').length;
      assert.ok(leads <= Math.ceil(posts.length / 3), `lead posts capped: ${leads} of ${posts.length}`);
      assert.ok(posts.every((p) => p.offerEndDate === '2026-11-13'), 'each post remembers the offer end for validation');
    });
  });

  await test('an implausible or malformed offer end date from the model is ignored, never trusted', async () => {
    for (const bad of ['yesterday', '2026-02-31', '2031-01-01', '15/11/2026']) {
      const r = await gen.generatePlan({ vertex: scriptedModel({ offerEndDate: bad }), imageGenerator: okImages, ...base, days: 3, platforms: ['x'] }, WS);
      await ctx.run(WS, async () => assert.strictEqual(store.getCampaign(r.campaignId).offerEndDate, null, bad));
    }
  });

  await test('copy that mentions an ended offer is rewritten once; if it still does, approval is blocked by validation', async () => {
    const model = scriptedModel({ offerEndDate: '2026-11-11', mentionEndDate: '11 November' });
    const r = await gen.generatePlan({ vertex: model, imageGenerator: okImages, ...base, days: 7, platforms: ['x'] }, WS);
    assert.ok(model.calls.some((c) => /respect each post's offer line/.test(c.prompt)), 'a corrective retry was made');
    await ctx.run(WS, async () => {
      const posts = store.listPosts({ campaignId: r.campaignId });
      const late = posts.filter((p) => p.dayKey > '2026-11-11');
      assert.ok(late.length > 0);
      for (const p of late) {
        const issues = require('./platformRules').validatePost(p, { now: Date.parse('2026-11-09T00:00:00Z') });
        assert.ok(p.text.includes('11 November') ? issues.some((i) => i.code === 'offer_expired') : true, 'a post that still names the ended offer is blocked');
      }
    });
  });

  await test('copy is matched back by position when the model numbers its answers from 0 instead of using our labels', async () => {
    const renumbering = { generateJson: async () => ({ posts: [{ i: 0, text: 'Hello from the renumbered answer', hashtags: [], imagePrompt: 'x', rationale: 'r' }] }) };
    const c = { company: 'Acme', industry: '', brand: 'Business: Acme', voice: 'plain', facts: '-', competitorBrief: '', postPrefs: {} };
    const entries = [{ i: 2, slot: { date: '2026-12-01' }, plan: { pillar: 'a', topic: 'b', promo: 'none' } }];
    const got = await gen.__writeCopy(renumbering, { prompt: 'p', ctx: c, platform: 'facebook', entries });
    assert.strictEqual(got.get(2)?.text, 'Hello from the renumbered answer');
    assert.strictEqual(got.get(2).i, 2);
    // an answer that is genuinely about a different post (wrong count) is never guessed at
    const two = { generateJson: async () => ({ posts: [{ i: 7, text: 'a' }, { i: 8, text: 'b' }] }) };
    assert.strictEqual((await gen.__writeCopy(two, { prompt: 'p', ctx: c, platform: 'facebook', entries })).size, 0);
  });

  cleanups.forEach((fn) => fn());
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
