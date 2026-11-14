/* Run: node social/routes.test.js — the planner HTTP API (scripted model, fake publisher, real Express). */
process.env.RAG_DISABLE_EMBEDDINGS = 'true';
process.env.SOCIAL_IMAGE_RETRY_DELAYS = '';
process.env.RAG_VERIFY = 'off';
const assert = require('assert');
const express = require('express');
const fs = require('fs');
const path = require('path');
const routes = require('./routes');
const store = require('./postStore');
const connections = require('./connections');
const ck = require('../companyKnowledge');
const ctx = require('../workspaceContext');
const fbStore = require('../facebookStore');
const xStore = require('../xStore');
const DATA = path.join(__dirname, '..', 'data');

const stamp = Date.now();
const A = `ws-test-r1-${stamp}`;
const B = `ws-test-r2-${stamp}`;
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

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2500, 3)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2500, 4)]);
const pngDataUrl = `data:image/png;base64,${PNG.toString('base64')}`;

let slowMs = 0;
const model = {
  async generateJson(prompt, schema) {
    if (slowMs) await new Promise((r) => setTimeout(r, slowMs));
    if (schema.properties.theme) {
      const idx = [...prompt.matchAll(/^\[(\d+)\] /gm)].map((m) => Number(m[1]));
      return { theme: 'Test theme', summary: 's', posts: idx.map((i) => ({ i, pillar: 'P', topic: `T${i}`, angle: 'a' })) };
    }
    const idx = [...prompt.matchAll(/^\[(\d+)\] \d{4}/gm)].map((m) => Number(m[1]));
    return { posts: idx.map((i) => ({ i, text: `Copy ${i} for the studio.`, hashtags: ['Yoga'], imagePrompt: `scene ${i}`, rationale: 'r' })) };
  },
};

const published = [];
const worker = {
  publishNow: async (id, ws) => {
    published.push({ id, ws });
    await store.markPublished(id, 'live-1', ws).catch(async () => {
      await ctx.run(ws, async () => { await store.claimSpecific(id, {}, ws); await store.markPublished(id, 'live-1', ws); });
    });
    return { ok: true };
  },
};

function buildApp() {
  const app = express();
  app.use(express.json());
  // Stand-in for the app session: the test says who is calling.
  const guard = (req, res, next) => {
    const wsId = req.get('x-ws');
    if (!wsId) return res.status(401).json({ success: false, error: 'Sign in required' });
    req.appUser = { id: `u-${wsId}`, email: 'o@example.com', role: req.get('x-role') || 'admin', workspaceId: wsId };
    ctx.run(wsId, next);
  };
  routes.mountRoutes(app, {
    vertex: model,
    requireAuth: guard,
    requireAdmin: ck.requireAdmin,
    worker,
    linkedinAccountExists: async () => true,
    imageGenerator: async () => pngDataUrl,
  });
  return app;
}

(async () => {
  console.log('social routes');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { ws = A, role, body, form } = {}) => {
    const headers = { 'x-ws': ws, ...(role ? { 'x-role': role } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(base + url, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
    const ct = res.headers.get('content-type') || '';
    const json = ct.includes('json') ? await res.json() : null;
    return { status: res.status, json, res };
  };
  const upload = (buf, filename, fields = {}) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    f.append('file', new Blob([buf]), filename);
    return f;
  };
  const waitJob = async (url, ws = A) => {
    for (let i = 0; i < 100; i += 1) {
      const r = await call('GET', url, { ws });
      if (r.json.data.status !== 'running') return r.json.data;
      await new Promise((r2) => setTimeout(r2, 50));
    }
    throw new Error('job did not finish');
  };

  ck.saveProfile({ companyName: 'Lotus Yoga', botName: 'Lila', voiceTone: 'Warm', writingStyle: 'Short', industry: 'Yoga' }, A);
  ck.saveProfile({ companyName: 'Other Co', botName: 'Bo', voiceTone: 'Formal', writingStyle: 'Long' }, B);

  const start = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const plan = { prompt: 'Promote our Diwali offer: first class free', days: 7, startDate: start, platforms: ['instagram', 'x'], timezone: 'Asia/Kolkata' };
  let campaignId;
  let posts;

  await test('requests without a session are refused', async () => {
    const r = await fetch(`${base}/api/social/campaigns`);
    assert.strictEqual(r.status, 401);
  });

  await test('plan input is validated with plain-language errors', async () => {
    const bad = async (patch, re) => {
      const r = await call('POST', '/api/social/plan', { body: { ...plan, ...patch } });
      assert.strictEqual(r.status, 400, JSON.stringify(patch));
      assert.match(r.json.error, re);
    };
    await bad({ prompt: 'hi' }, /Describe/);
    await bad({ days: 0 }, /between 1 and 30/);
    await bad({ days: 45 }, /between 1 and 30/);
    await bad({ startDate: 'tomorrow' }, /start date/);
    await bad({ platforms: [] }, /at least one platform/);
    await bad({ platforms: ['myspace'] }, /at least one platform/);
  });

  await test('one prompt starts a background job that ends in a reviewable campaign', async () => {
    const r = await call('POST', '/api/social/plan', { body: plan });
    assert.strictEqual(r.status, 202);
    const done = await waitJob(`/api/social/plan/${r.json.data.id}`);
    assert.strictEqual(done.status, 'done', JSON.stringify(done));
    campaignId = done.result.campaignId;
    const c = await call('GET', `/api/social/campaigns/${campaignId}`);
    posts = c.json.data.posts;
    assert.ok(posts.length >= 6 && posts.every((p) => p.status === 'draft' && p.previewUrl));
    assert.strictEqual(c.json.data.campaign.status, 'review');
    assert.strictEqual((await call('GET', '/api/social/settings')).json.data.timezone, 'Asia/Kolkata', 'time zone remembered');
  });

  await test('another workspace cannot see, edit, approve or fetch images of this campaign', async () => {
    assert.strictEqual((await call('GET', `/api/social/campaigns/${campaignId}`, { ws: B })).status, 404);
    assert.strictEqual((await call('PATCH', `/api/social/posts/${posts[0].id}`, { ws: B, body: { text: 'x' } })).status, 404);
    assert.strictEqual((await call('POST', `/api/social/posts/${posts[0].id}/approve`, { ws: B })).status, 404);
    assert.strictEqual((await call('GET', posts[0].previewUrl, { ws: B })).status, 404);
    assert.strictEqual((await call('GET', posts[0].previewUrl)).status, 200);
    assert.strictEqual((await call('GET', '/api/social/media/..%2F..%2Fpackage.json')).status, 404);
    assert.deepStrictEqual((await call('GET', '/api/social/campaigns', { ws: B })).json.data, []);
  });

  await test('only one plan runs at a time per workspace (a second request joins it)', async () => {
    slowMs = 200;
    const a = await call('POST', '/api/social/plan', { body: plan });
    const b = await call('POST', '/api/social/plan', { body: plan });
    assert.strictEqual(a.json.data.id, b.json.data.id);
    assert.strictEqual(b.json.data.joined, true);
    await waitJob(`/api/social/plan/${a.json.data.id}`);
    slowMs = 0;
  });

  await test('editing text and time works; the day follows the owner time zone; bad input is refused', async () => {
    const p = posts.find((x) => x.platform === 'instagram');
    const r = await call('PATCH', `/api/social/posts/${p.id}`, { body: { text: 'My own words', hashtags: ['#Yoga', 'Pune ', 'bad tag'], date: '2026-12-05', time: '07:45' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.data.text, 'My own words');
    assert.deepStrictEqual(r.json.data.hashtags, ['Yoga', 'Pune', 'badtag']);
    assert.strictEqual(r.json.data.scheduledAt, '2026-12-05T02:15:00.000Z');
    assert.strictEqual(r.json.data.dayKey, '2026-12-05');
    assert.strictEqual(r.json.data.source, 'edited');
    assert.strictEqual((await call('PATCH', `/api/social/posts/${p.id}`, { body: { date: '2026-13-45', time: '99:99' } })).status, 400);
    assert.strictEqual((await call('PATCH', `/api/social/posts/${p.id}`, { body: { hashtags: 'nope' } })).status, 400);
  });

  await test('images are checked by their bytes: real PNG/JPEG accepted, disguised files and oversize rejected', async () => {
    const p = posts.find((x) => x.platform === 'x');
    const good = await call('POST', `/api/social/posts/${p.id}/image`, { form: upload(JPG, 'photo.png') }); // wrong extension, real JPEG
    assert.strictEqual(good.status, 200);
    assert.strictEqual(good.json.data.image.source, 'uploaded');
    assert.strictEqual(good.json.data.image.mime, 'image/jpeg');
    const exe = await call('POST', `/api/social/posts/${p.id}/image`, { form: upload(Buffer.from('MZ\x90\x00 definitely not an image'), 'evil.png') });
    assert.strictEqual(exe.status, 400);
    assert.match(exe.json.error, /not a PNG, JPEG or WebP/);
    const huge = await call('POST', `/api/social/posts/${p.id}/image`, { form: upload(Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]), 'big.png') });
    assert.strictEqual(huge.status, 400);
    assert.match(huge.json.error, /8MB/);
    assert.strictEqual((await call('POST', `/api/social/posts/${p.id}/image`, {})).status, 400);
  });

  await test('an image uploaded for a day lands on that day only', async () => {
    const day = posts.find((x) => x.platform === 'x').dayKey;
    const r = await call('POST', `/api/social/campaigns/${campaignId}/day-image`, { form: upload(PNG, 'day.png', { date: day }) });
    assert.strictEqual(r.status, 200);
    const after = (await call('GET', `/api/social/campaigns/${campaignId}`)).json.data.posts;
    const onDay = after.filter((p) => p.dayKey === day);
    assert.ok(onDay.length >= 1 && onDay.every((p) => p.image.dayUpload === day && p.image.source === 'uploaded'));
    assert.ok(after.filter((p) => p.dayKey !== day).every((p) => p.image.source === 'generated' || p.image.source === 'uploaded'));
    assert.strictEqual((await call('POST', `/api/social/campaigns/${campaignId}/day-image`, { form: upload(PNG, 'd.png', { date: '1999-01-01' }) })).status, 404);
    assert.strictEqual((await call('POST', `/api/social/campaigns/${campaignId}/day-image`, { form: upload(PNG, 'd.png') })).status, 400);
  });

  await test('regenerate returns an edited draft', async () => {
    const p = posts[0];
    const r = await call('POST', `/api/social/posts/${p.id}/regenerate`, { body: { scope: 'text', instruction: 'shorter please' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.data.source, 'edited');
  });

  await test('approval is refused while channels are not connected, listing exactly what is wrong', async () => {
    const r = await call('POST', `/api/social/campaigns/${campaignId}/approve`, {});
    assert.strictEqual(r.status, 422);
    assert.ok(r.json.problems.length >= 1);
    assert.ok(r.json.problems.every((p) => p.issues.some((i) => i.code === 'not_connected')));
    const after = (await call('GET', `/api/social/campaigns/${campaignId}`)).json.data;
    assert.ok(after.posts.every((p) => p.status === 'draft'), 'nothing was approved');
  });

  await test('members cannot approve or publish; admins can', async () => {
    assert.strictEqual((await call('POST', `/api/social/campaigns/${campaignId}/approve`, { role: 'member' })).status, 403);
    assert.strictEqual((await call('POST', `/api/social/posts/${posts[0].id}/publish-now`, { role: 'member' })).status, 403);
    assert.strictEqual((await call('PUT', '/api/social/competitors', { role: 'member', body: { competitors: [] } })).status, 403);
  });

  // Connect Instagram+Facebook (page) and X for workspace A.
  await ctx.run(A, async () => {
    fbStore.setAccount({ pageId: 'p1', pageAccessToken: 't', igUserId: 'ig1' });
    xStore.setAccount({ userId: 'x1' });
  });

  await test('with channels connected, approval succeeds; invalid posts block it unless "only valid" is chosen', async () => {
    const empty = posts.find((p) => p.platform === 'x' && p.id !== posts.find((q) => q.platform === 'x').id) || posts[1];
    await call('PATCH', `/api/social/posts/${empty.id}`, { body: { text: '' } });
    const refused = await call('POST', `/api/social/campaigns/${campaignId}/approve`, {});
    assert.strictEqual(refused.status, 422);
    assert.ok(refused.json.problems.some((p) => p.postId === empty.id && p.issues.some((i) => i.code === 'empty')));
    const partial = await call('POST', `/api/social/campaigns/${campaignId}/approve`, { body: { onlyValid: true } });
    assert.strictEqual(partial.status, 200);
    assert.ok(partial.json.data.approved.length >= 1 && partial.json.data.skipped.length === 1);
    const c = (await call('GET', `/api/social/campaigns/${campaignId}`)).json.data;
    assert.strictEqual(c.posts.find((p) => p.id === empty.id).status, 'draft');
    assert.ok(c.posts.filter((p) => p.id !== empty.id).every((p) => p.status === 'approved'));
    assert.strictEqual(c.campaign.status, 'generating' === c.campaign.status ? 'x' : c.campaign.status, 'campaign stays open while a draft remains');
    assert.notStrictEqual(c.campaign.status, 'approved');
  });

  await test('editing an approved post sends it back for approval; unapprove works', async () => {
    const approved = (await call('GET', `/api/social/campaigns/${campaignId}`)).json.data.posts.filter((p) => p.status === 'approved');
    const r = await call('PATCH', `/api/social/posts/${approved[0].id}`, { body: { text: 'Changed after approval' } });
    assert.strictEqual(r.json.data.status, 'draft');
    const un = await call('POST', `/api/social/posts/${approved[1].id}/unapprove`, {});
    assert.strictEqual(un.json.data.status, 'draft');
  });

  await test('publish-now sends one approved post; a published post cannot be edited or deleted', async () => {
    const draft = (await call('GET', `/api/social/campaigns/${campaignId}`)).json.data.posts.find((p) => p.status === 'draft' && p.text);
    const r = await call('POST', `/api/social/posts/${draft.id}/publish-now`, {});
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    assert.strictEqual(r.json.data.post.status, 'published');
    assert.strictEqual(published.length, 1);
    assert.strictEqual((await call('PATCH', `/api/social/posts/${draft.id}`, { body: { text: 'late edit' } })).status, 400);
    assert.strictEqual((await call('DELETE', `/api/social/posts/${draft.id}`)).status, 400);
  });

  await test('publish-now refuses a post that cannot go out (empty text)', async () => {
    const blank = (await call('GET', `/api/social/campaigns/${campaignId}`)).json.data.posts.find((p) => p.status === 'draft' && !p.text);
    const r = await call('POST', `/api/social/posts/${blank.id}/publish-now`, {});
    assert.strictEqual(r.status, 422);
    assert.match(r.json.error, /no text/);
  });

  await test('drafts can be deleted; the overview reports counts and what needs attention', async () => {
    const draft = (await call('GET', `/api/social/campaigns/${campaignId}`)).json.data.posts.find((p) => p.status === 'draft');
    assert.strictEqual((await call('DELETE', `/api/social/posts/${draft.id}`)).status, 200);
    const o = (await call('GET', '/api/social/overview')).json.data;
    assert.ok(o.counts.published === 1 && o.counts.approved >= 1);
    assert.ok(typeof o.needsAttention === 'number');
  });

  await test('calendar returns posts in a date range with their problems', async () => {
    const r = (await call('GET', `/api/social/calendar?from=${new Date().toISOString()}&to=${new Date(Date.now() + 40 * 86_400_000).toISOString()}`)).json.data;
    assert.ok(r.posts.length > 0 && r.timezone === 'Asia/Kolkata');
    assert.ok(r.posts.every((p) => Array.isArray(p.issues) && typeof p.finalLength === 'number'));
  });

  await test('competitors: list is validated, trimmed and capped; analysis needs at least one', async () => {
    assert.strictEqual((await call('POST', '/api/social/competitors/analyze', {})).status, 400);
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `Rival ${i}`, instagram: '@r' }));
    many.push({ name: '' }, { name: 'rival 1' });
    const r = await call('PUT', '/api/social/competitors', { body: { competitors: many } });
    assert.strictEqual(r.json.data.length, 8);
    assert.strictEqual((await call('GET', '/api/social/competitors', { ws: B })).json.data.competitors.length, 0, 'isolated per workspace');
    assert.strictEqual((await call('PUT', '/api/social/competitors', { body: { competitors: 'x' } })).status, 400);
  });

  await test('connections reflect what is linked (LinkedIn via the workspace link, others via their accounts)', async () => {
    const before = (await call('GET', '/api/social/connections')).json.data;
    assert.ok(before.instagram.connected && before.facebook.connected && before.x.connected && !before.linkedin.connected);
    connections.linkLinkedIn(A, { urn: 'urn:li:person:abc', name: 'Owner' });
    assert.ok((await call('GET', '/api/social/connections')).json.data.linkedin.connected);
    assert.throws(() => connections.linkLinkedIn(B, { urn: 'urn:li:person:abc' }), /already connected to another workspace/);
    const other = (await call('GET', '/api/social/connections', { ws: B })).json.data;
    assert.ok(!other.instagram.connected && !other.x.connected && !other.linkedin.connected);
    connections.unlinkLinkedIn(A);
  });

  await test('sniffImage identifies formats by signature', () => {
    assert.strictEqual(routes.sniffImage(PNG), 'image/png');
    assert.strictEqual(routes.sniffImage(JPG), 'image/jpeg');
    assert.strictEqual(routes.sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)])), 'image/webp');
    assert.strictEqual(routes.sniffImage(Buffer.from('GIF89a......')), null);
  });

  server.close();
  for (const w of [A, B]) fs.rmSync(path.join(DATA, 'company', 'workspaces', w), { recursive: true, force: true });
  for (const f of ['facebook.json', 'x.json', 'linkedin-links.json']) {
    // these stores are keyed per workspace; remove only our test workspaces' entries
    try {
      const p = path.join(DATA, f);
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j.workspaces) {
        delete j.workspaces[A];
        delete j.workspaces[B];
        fs.writeFileSync(p, JSON.stringify(j, null, 2));
      }
    } catch {
      /* file may not exist */
    }
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
