/* Run: node social/postFormats.test.js — per-platform post formats: choices, prompt, suggestions, API. */
const assert = require('assert');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pf = require('./postFormats');
const gen = require('./generator');
const routes = require('./routes');
const ctx = require('../workspaceContext');

const stamp = Date.now();
const A = `ws-test-pf1-${stamp}`;
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

(async () => {
  await test('the LinkedIn default is: punchline, two paragraphs, then a specific question', () => {
    const p = pf.promptFor('linkedin', pf.DEFAULTS.linkedin);
    assert.ok(/punchline hook/.test(p) && /Paragraph 1/.test(p) && /Paragraph 2/.test(p) && /specific question/.test(p));
    assert.ok(/Never beg/.test(p), 'engagement bait is forbidden');
  });

  await test('choices are validated: unknown formats, lengths and goals fall back; notes are capped', () => {
    const r = pf.sanitizePrefs({ linkedin: { format: 'nope', length: 'huge', goal: 'fame', emoji: 'lots', notes: 'x'.repeat(900) }, instagram: { format: 'carousel', goal: 'leads' }, bogus: { format: 'a' } });
    assert.strictEqual(r.linkedin.format, 'hook_story');
    assert.strictEqual(r.linkedin.length, 'standard');
    assert.strictEqual(r.linkedin.goal, 'comments');
    assert.strictEqual(r.linkedin.emoji, 'none');
    assert.strictEqual(r.linkedin.notes.length, 300);
    assert.strictEqual(r.instagram.format, 'carousel');
    assert.strictEqual(r.instagram.goal, 'leads');
    assert.ok(!('bogus' in r));
    // a format from another platform is not accepted
    assert.strictEqual(pf.sanitizePrefs({ x: { format: 'numbered' } }).x.format, 'hot_take_question');
  });

  await test('the chosen format, length, goal and notes reach the writing prompt', async () => {
    let seen = '';
    const vertex = { generateJson: async (prompt) => { seen = prompt; return { posts: [{ i: 0, text: 'Hook', hashtags: [], imagePrompt: 'x', rationale: 'r' }] }; } };
    const prefs = pf.sanitizePrefs({ linkedin: { format: 'numbered', length: 'short', goal: 'leads', emoji: 'none', notes: 'Sound like a friendly founder' } });
    const c = { company: 'Acme', industry: '', brand: 'Business: Acme', voice: 'plain', facts: '-', competitorBrief: '', postPrefs: prefs };
    await gen.__writeCopy(vertex, { prompt: 'p', ctx: c, platform: 'linkedin', entries: [{ i: 0, slot: { date: '2026-12-01' }, plan: { pillar: 'a', topic: 'b', promo: 'none' } }] });
    assert.ok(seen.includes('Numbered takeaways') && seen.includes('60-100 words') && seen.includes('Goal: enquiries') && seen.includes('friendly founder'));
    assert.ok(!seen.includes('Paragraph 1'), 'only the chosen structure is sent');
  });

  await test('suggestions: valid formats only; a failing model falls back to the defaults', async () => {
    const good = await pf.suggest({ generateJson: async () => ({ suggestions: [{ platform: 'linkedin', format: 'bold_take', length: 'long', goal: 'leads', why: 'B2B buyers like a clear opinion.' }, { platform: 'x', format: 'made_up', length: 'x', goal: 'y', why: 'z' }] }) }, { brand: 'b', platforms: ['linkedin', 'x'] });
    assert.strictEqual(good.ai, true);
    assert.deepStrictEqual(good.suggestions.map((s) => [s.platform, s.format, s.length, s.goal]), [['linkedin', 'bold_take', 'long', 'leads'], ['x', 'hot_take_question', 'standard', 'comments']]);
    const bad = await pf.suggest({ generateJson: async () => { throw new Error('down'); } }, { brand: 'b', platforms: ['linkedin'] });
    assert.strictEqual(bad.ai, false);
    assert.strictEqual(bad.suggestions[0].format, 'hook_story');
  });

  const app = express();
  app.use(express.json());
  let role = 'admin';
  app.use((req, res, next) => {
    req.appUser = { id: 'u', role, workspaceId: A };
    ctx.run(A, next);
  });
  const model = { generateJson: async () => ({ suggestions: [{ platform: 'instagram', format: 'carousel', length: 'short', goal: 'saves', why: 'Visual and swipeable.' }] }) };
  const adminOnly = (req, res, n) => (req.appUser.role === 'admin' ? n() : res.status(403).json({ success: false, error: 'Admin access required' }));
  routes.mountRoutes(app, { vertex: model, requireAuth: (_q, _s, n) => n(), requireAdmin: adminOnly, worker: {}, linkedinAccountExists: async () => true, imageGenerator: async () => '' });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() };
  };

  await test('API: defaults first, an owner can save choices, a team member cannot', async () => {
    const g = await call('GET', '/api/social/post-style');
    assert.strictEqual(g.json.data.saved, false);
    assert.strictEqual(g.json.data.prefs.linkedin.format, 'hook_story');
    assert.ok(g.json.data.catalog.linkedin.length >= 3 && g.json.data.catalog.linkedin[0].blurb);
    const put = await call('PUT', '/api/social/post-style', { prefs: { linkedin: { format: 'bold_take', goal: 'leads' } } });
    assert.strictEqual(put.json.data.prefs.linkedin.format, 'bold_take');
    assert.strictEqual(put.json.data.prefs.instagram.format, 'hook_value', 'untouched platforms keep their choice');
    assert.strictEqual((await call('GET', '/api/social/post-style')).json.data.saved, true);
    role = 'member';
    assert.strictEqual((await call('PUT', '/api/social/post-style', { prefs: { linkedin: { format: 'short_note' } } })).status, 403);
    role = 'admin';
    assert.strictEqual((await call('GET', '/api/social/post-style')).json.data.prefs.linkedin.format, 'bold_take');
  });

  await test('API: suggest needs a platform and returns reasons', async () => {
    assert.strictEqual((await call('POST', '/api/social/post-style/suggest', { platforms: [] })).status, 400);
    const r = await call('POST', '/api/social/post-style/suggest', { platforms: ['instagram'] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.data.suggestions[0].format, 'carousel');
    assert.ok(r.json.data.suggestions[0].why);
  });

  server.close();
  fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', A), { recursive: true, force: true });
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  setTimeout(() => process.exit(failures ? 1 : 0), 100);
})();
