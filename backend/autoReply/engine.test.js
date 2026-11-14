/* Run: node autoReply/engine.test.js — auto-reply: baseline, review vs auto, limits, safety, approval, isolation. */
const assert = require('assert');
const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const writer = require('./writer');
const { createEngine } = require('./engine');
const { mountRoutes } = require('./routes');
const ctx = require('../workspaceContext');

const stamp = Date.now();
const A = `ws-test-ar1-${stamp}`;
const B = `ws-test-ar2-${stamp}`;
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

let clock = Date.parse('2026-12-01T10:00:00Z');
const minutes = (n) => new Date(clock + n * 60_000).toISOString();

const sentLog = [];
const captured = [];
let commentsNow = [];
let failSend = false;
let failFetch = null;
let dmResult = null;

const adapters = {
  instagram_comments: {
    workspaceIds: () => [A],
    connected: () => true,
    fetch: async () => {
      if (failFetch) throw failFetch;
      return commentsNow;
    },
    send: async (msg, text) => {
      if (failSend) throw Object.assign(new Error('boom'), { response: { status: 400, data: { error: { message: 'Permission denied', code: 200 } } } });
      sentLog.push({ id: msg.externalId, text });
    },
  },
  instagram_dms: { workspaceIds: () => [A], connected: () => true, fetch: async () => commentsNow.filter((c) => c.dm), handleDm: async () => dmResult },
  linkedin_comments: { workspaceIds: () => [A], connected: () => false, fetch: async () => [], send: async () => {} },
  facebook_messenger: { workspaceIds: () => [A], connected: () => false, fetch: async () => [], handleDm: async () => ({}) },
  facebook_comments: { workspaceIds: () => [], connected: () => false, fetch: async () => [], send: async () => {} },
  x_mentions: { workspaceIds: () => [], connected: () => false, fetch: async () => [], send: async () => {} },
};

let modelCalls = 0;
const vertex = {
  generateJson: async (prompt) => {
    modelCalls += 1;
    const comment = (/COMMENT by [^:]*: "([^"]*)"/.exec(prompt) || [])[1] || '';
    if (/refund|angry/i.test(comment)) return { action: 'handoff', intent: 'complaint', reply: '', reason: 'A complaint' };
    if (/price|cost/i.test(comment)) return { action: 'reply', intent: 'pricing', reply: 'Happy to help! Send us a message with what you need #sale @bob https://evil.example/x', reason: 'Price interest' };
    return { action: 'reply', intent: 'praise', reply: 'Thank you, that means a lot to us!', reason: 'Praise' };
  },
};

const engine = createEngine({
  vertex,
  leadAgent: {},
  adapters,
  getProfile: () => ({ companyName: 'Acme', websiteUrl: 'https://acme.test' }),
  leads: () => ({ upsertLead: async (l) => captured.push(l) }),
  now: () => clock,
  maxSendsPerRun: 5,
  log: { warn() {}, log() {} },
});

const c = (id, text, offsetMin, extra = {}) => ({ externalId: id, text, author: 'sam', timestamp: minutes(offsetMin), ...extra });

(async () => {
  await test('the backlog is never answered: only messages after the first check are', async () => {
    commentsNow = [c('old1', 'Loved this post so much', -300)];
    store.setSettings({ channels: { instagram_comments: { mode: 'auto' } } }, A, clock);
    await engine.runWorkspace(A);
    assert.strictEqual(sentLog.length, 0);
    assert.strictEqual((store.read(A).items || []).length, 0);
    assert.ok(store.sinceOf(store.read(A), 'instagram_comments'));
  });

  await test('auto mode answers a new comment once, and never twice', async () => {
    clock += 5 * 60_000;
    commentsNow = [c('n1', 'Great work team, love it', 1)];
    await engine.runWorkspace(A);
    await engine.runWorkspace(A);
    assert.strictEqual(sentLog.length, 1);
    const item = store.read(A).items.find((i) => i.externalId === 'n1');
    assert.strictEqual(item.status, 'sent');
    assert.strictEqual(item.auto, true);
  });

  await test('replies are cleaned: no hashtags, mentions or foreign links', async () => {
    clock += 60_000;
    commentsNow = [c('n2', 'What is the price for this?', 7)];
    await engine.runWorkspace(A);
    const reply = sentLog.at(-1).text;
    assert.ok(!/[#@]|evil\.example|https?:/.test(reply), reply);
    assert.ok(reply.length > 5);
  });

  await test('buying questions also become leads', () => {
    assert.ok(captured.some((l) => /price/.test(l.customerComment) && l.channel === 'instagram'));
  });

  await test('emoji-only, links and spam are skipped without asking the model', async () => {
    clock += 60_000;
    const before = modelCalls;
    commentsNow = [c('s1', '🔥🔥🔥', 9), c('s2', 'check this http://spam.example now', 9), c('s3', 'earn $500 a day with crypto', 9)];
    await engine.runWorkspace(A);
    assert.strictEqual(modelCalls, before);
    const items = store.read(A).items.filter((i) => ['s1', 's2', 's3'].includes(i.externalId));
    assert.strictEqual(items.length, 3);
    assert.ok(items.every((i) => i.status === 'skipped' && i.reason));
  });

  await test('complaints are never answered publicly: a person is flagged and a lead is kept', async () => {
    clock += 60_000;
    const sentBefore = sentLog.length;
    commentsNow = [c('h1', 'I am angry, I want a refund', 12)];
    await engine.runWorkspace(A);
    assert.strictEqual(sentLog.length, sentBefore);
    assert.strictEqual(store.read(A).items.find((i) => i.externalId === 'h1').status, 'needs_human');
    assert.ok(captured.some((l) => /refund/.test(l.customerComment)));
  });

  await test('review mode only drafts; approving sends the edited text', async () => {
    store.setSettings({ channels: { instagram_comments: { mode: 'review' } } }, A, clock);
    clock += 60_000;
    const sentBefore = sentLog.length;
    commentsNow = [c('r1', 'Nice launch, well done', 15)];
    await engine.runWorkspace(A);
    assert.strictEqual(sentLog.length, sentBefore);
    const item = store.read(A).items.find((i) => i.externalId === 'r1');
    assert.strictEqual(item.status, 'pending_review');
    assert.ok(item.draft);
    const done = await engine.approve(A, item.id, 'Thanks so much! #win');
    assert.strictEqual(done.status, 'sent');
    assert.strictEqual(sentLog.at(-1).text, 'Thanks so much!');
    await assert.rejects(() => engine.approve(A, item.id), /not waiting/);
  });

  await test('a failed send is shown with the platform reason and is not retried by itself', async () => {
    store.setSettings({ channels: { instagram_comments: { mode: 'auto' } } }, A, clock);
    clock += 60_000;
    failSend = true;
    commentsNow = [c('f1', 'Love your work', 18)];
    await engine.runWorkspace(A);
    failSend = false;
    const item = store.read(A).items.find((i) => i.externalId === 'f1');
    assert.strictEqual(item.status, 'failed');
    assert.match(item.error, /Permission denied/);
    assert.match(item.error, /permission/i);
    const sentBefore = sentLog.length;
    await engine.runWorkspace(A);
    assert.strictEqual(sentLog.length, sentBefore, 'not retried automatically');
    const retried = await engine.approve(A, item.id);
    assert.strictEqual(retried.status, 'sent');
  });

  await test('the daily limit holds replies back for the owner instead of posting them', async () => {
    store.setSettings({ dailyCap: 1 }, A, clock);
    clock += 60_000;
    const sentBefore = sentLog.length;
    commentsNow = [c('d1', 'Brilliant stuff', 21)];
    await engine.runWorkspace(A);
    assert.strictEqual(sentLog.length, sentBefore);
    const item = store.read(A).items.find((i) => i.externalId === 'd1');
    assert.strictEqual(item.status, 'pending_review');
    assert.match(item.reason, /limit/);
    store.setSettings({ dailyCap: 40 }, A, clock);
  });

  await test('switching a channel off and on again starts a fresh clock', async () => {
    store.setSettings({ channels: { instagram_comments: { mode: 'off' } } }, A, clock);
    clock += 120 * 60_000;
    store.setSettings({ channels: { instagram_comments: { mode: 'auto' } } }, A, clock);
    const sentBefore = sentLog.length;
    commentsNow = [c('gap1', 'Posted while it was off', -30)];
    await engine.runWorkspace(A);
    assert.strictEqual(sentLog.length, sentBefore);
  });

  await test('a platform error is recorded for the owner and does not stop other channels', async () => {
    clock += 60_000;
    failFetch = Object.assign(new Error('x'), { response: { status: 403, data: { error: { message: '(#10) Application does not have permission', code: 10 } } } });
    const r = await engine.runWorkspace(A);
    failFetch = null;
    assert.match(r.instagram_comments.error, /permission/i);
    assert.match(store.read(A).lastRun.instagram_comments.error, /Reconnect/);
    assert.ok(r.instagram_dms);
  });

  await test('direct messages go through the conversation agent and the result is recorded', async () => {
    clock += 60_000;
    dmResult = { sent: true, agentResult: { reply: 'Hi, how can I help?', intent: 'SERVICE_QUERY' } };
    commentsNow = [c('dm1', 'Do you do websites?', 130, { dm: true, authorId: '999' })];
    await engine.runWorkspace(A);
    let item = store.read(A).items.find((i) => i.externalId === 'dm1');
    assert.strictEqual(item.status, 'sent');
    assert.strictEqual(item.kind, 'dm');
    clock += 60_000;
    dmResult = { skipped: true, reason: 'handoff' };
    commentsNow = [c('dm2', 'Another question', 132, { dm: true, authorId: '999' })];
    await engine.runWorkspace(A);
    item = store.read(A).items.find((i) => i.externalId === 'dm2');
    assert.strictEqual(item.status, 'skipped');
    assert.match(item.reason, /person/);
    clock += 60_000;
    dmResult = { sent: false, sendError: 'Messaging window closed', agentResult: {} };
    commentsNow = [c('dm3', 'Hello again', 134, { dm: true, authorId: '999' })];
    await engine.runWorkspace(A);
    item = store.read(A).items.find((i) => i.externalId === 'dm3');
    assert.strictEqual(item.status, 'failed');
    assert.match(item.error, /window/);
  });

  await test('workspaces are separate', async () => {
    assert.deepStrictEqual(store.read(B).items, []);
    assert.strictEqual(engine.status(B).channels.find((x) => x.id === 'instagram_comments').waiting, 0);
  });

  await test('reply cleaning keeps the business website, drops others, and respects the length limit', () => {
    const t = writer.cleanReply('See https://acme.test/book and https://other.test #x @y ' + 'word '.repeat(80), 'x', 'https://acme.test');
    assert.ok(t.includes('https://acme.test/book') && !t.includes('other.test') && !/[#@]/.test(t));
    assert.ok(t.length <= writer.LIMITS.x);
  });

  const app = express();
  app.use(express.json());
  let role = 'admin';
  app.use((req, res, next) => {
    req.appUser = { id: 'u', role, workspaceId: A };
    ctx.run(A, next);
  });
  const adminOnly = (req, res, n) => (req.appUser.role === 'admin' ? n() : res.status(403).json({ success: false, error: 'Admin access required' }));
  mountRoutes(app, { engine, requireAuth: (_q, _s, n) => n(), requireAdmin: adminOnly });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() };
  };

  await test('API: status lists every channel and what cannot be automated; only an admin can change it', async () => {
    const s = await call('GET', '/api/auto-reply/status');
    assert.deepStrictEqual(s.json.data.channels.map((x) => x.id), ['instagram_comments', 'instagram_dms', 'facebook_comments', 'linkedin_comments', 'facebook_messenger', 'x_mentions']);
    assert.ok(s.json.data.unsupported.some((u) => u.id === 'whatsapp' && u.reason));
    const put = await call('PUT', '/api/auto-reply/settings', { channels: { facebook_comments: { mode: 'auto' }, instagram_dms: { mode: 'review' } } });
    const fb = put.json.data.channels.find((x) => x.id === 'facebook_comments');
    assert.strictEqual(fb.mode, 'auto');
    assert.strictEqual(put.json.data.channels.find((x) => x.id === 'instagram_dms').mode, 'auto', 'review is not a valid mode for messages');
    role = 'member';
    assert.strictEqual((await call('PUT', '/api/auto-reply/settings', { channels: {} })).status, 403);
    assert.strictEqual((await call('POST', '/api/auto-reply/run')).status, 403);
    role = 'admin';
  });

  await test('API: the queue lists waiting replies and a reply can be dismissed', async () => {
    const q = await call('GET', '/api/auto-reply/items?status=pending_review');
    assert.ok(q.json.data.length >= 1);
    const d = await call('POST', `/api/auto-reply/items/${q.json.data[0].id}/dismiss`);
    assert.strictEqual(d.json.data.status, 'dismissed');
    assert.strictEqual((await call('POST', '/api/auto-reply/items/nope/approve')).status, 400);
  });

  server.close();
  for (const w of [A, B]) {
    try {
      const f = path.join(__dirname, '..', 'data', 'auto-reply.json');
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      delete j.workspaces[w];
      fs.writeFileSync(f, JSON.stringify(j, null, 2));
    } catch {
      /* nothing stored */
    }
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  setTimeout(() => process.exit(failures ? 1 : 0), 100);
})();
