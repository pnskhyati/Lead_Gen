/* Run: node social/brandStyle.test.js — brand style: upload examples, learn a style guide, feed it to image generation. */
const assert = require('assert');
const express = require('express');
const fs = require('fs');
const path = require('path');
const brand = require('./brandStyle');
const routes = require('./routes');
const gen = require('./generator');
const store = require('./postStore');
const ctx = require('../workspaceContext');
const imageText = require('./imageText');

const stamp = Date.now();
const A = `ws-test-b1-${stamp}`;
const B = `ws-test-b2-${stamp}`;
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

const png = (n = 0) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2500, n)]);
const PNG = `data:image/png;base64,${png(3).toString('base64')}`;

let seen = [];
const model = {
  async describeImagesJson({ images }) {
    seen.push(images.length);
    return {
      summary: 'Warm flat-lay photos with soft shadows.',
      look: 'Real photography, slightly desaturated.',
      palette: [{ hex: '#F4E9DC', role: 'background' }, { hex: 'not-a-color', role: 'bad' }, { hex: '#2B2B2B', role: 'text' }],
      composition: 'Centered subject, lots of empty space.',
      subjects: 'Products on wood.',
      lighting: 'Soft window light.',
      typography: 'no text on images',
      recurringElements: ['thin white border'],
      avoid: ['neon colors'],
    };
  },
};

(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const w = req.get('x-ws');
    if (!w) return res.status(401).json({ success: false, error: 'Sign in required' });
    req.appUser = { id: `u-${w}`, role: 'admin', workspaceId: w };
    ctx.run(w, next);
  });
  routes.mountRoutes(app, { vertex: model, requireAuth: (_q, _s, n) => n(), requireAdmin: (_q, _s, n) => n(), worker: {}, linkedinAccountExists: async () => true, imageGenerator: async () => PNG });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { ws = A, body, form } = {}) => {
    const res = await fetch(base + url, { method, headers: { 'x-ws': ws, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: form || (body ? JSON.stringify(body) : undefined) });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  const upload = (parts) => {
    const f = new FormData();
    parts.forEach(([content, name]) => f.append('files', new Blob([content]), name));
    return f;
  };

  await test('only real images are accepted (checked by content, not file name)', async () => {
    const r = await call('POST', '/api/social/brand-style/images', { form: upload([[Buffer.from('<html>not an image</html>'), 'x.png']]) });
    assert.strictEqual(r.status, 400);
    const ok = await call('POST', '/api/social/brand-style/images', { form: upload([[png(1), 'a.png'], [Buffer.from('nope'), 'b.png']]) });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.json.data.images.length, 1);
    assert.strictEqual(ok.json.data.rejected, 1);
  });

  await test('analysis needs at least three examples', async () => {
    const r = await call('POST', '/api/social/brand-style/analyze');
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /at least 3/);
  });

  await test('the style guide is built from the examples and cleaned (bad colors dropped)', async () => {
    await call('POST', '/api/social/brand-style/images', { form: upload([[png(2), 'b.png'], [png(4), 'c.png']]) });
    const r = await call('POST', '/api/social/brand-style/analyze');
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    const g = r.json.data.guide;
    assert.deepStrictEqual(g.palette.map((c) => c.hex), ['#F4E9DC', '#2B2B2B']);
    assert.strictEqual(r.json.data.analyzedWith, 3);
    assert.strictEqual(r.json.data.stale, false);
    assert.deepStrictEqual(seen, [3]);
  });

  await test('adding or removing examples marks the style as out of date until it is re-read', async () => {
    const add = await call('POST', '/api/social/brand-style/images', { form: upload([[png(5), 'd.png']]) });
    assert.strictEqual(add.json.data.stale, true);
    const id = add.json.data.images[3].id;
    const del = await call('DELETE', `/api/social/brand-style/images/${id}`);
    assert.strictEqual(del.json.data.stale, false);
    assert.strictEqual((await call('DELETE', `/api/social/brand-style/images/${id}`)).status, 404);
  });

  await test('image generation receives the guide and the example posts; switching it off removes both', async () => {
    const s = await ctx.run(A, async () => brand.forGeneration(A));
    assert.ok(s.text.includes('#F4E9DC') && s.text.includes('thin white border') && s.text.includes('Avoid: neon colors'));
    assert.strictEqual(s.refs.length, 3);
    assert.ok(s.refs.every((r) => r.mimeType === 'image/png' && r.data.length > 100));
    await call('PUT', '/api/social/brand-style', { body: { enabled: false } });
    assert.strictEqual(brand.forGeneration(A), null);
    await call('PUT', '/api/social/brand-style', { body: { enabled: true } });
    assert.ok(brand.forGeneration(A));
  });

  await test('the planner hands the workspace to the image generator so the right style is used', async () => {
    const calls = [];
    await ctx.run(A, async () => {
      const post = { id: 'p1', platform: 'instagram', imagePrompt: 'a cup of tea' };
      const r = await gen.generateOneImage(post, { company: 'Acme' }, async (prompt, o) => { calls.push(o); return PNG; }, A);
      assert.strictEqual(r.imageStatus, 'ready');
    });
    assert.strictEqual(calls[0].ws, A);
  });

  await test('headline text is cleaned: no hashtags, emoji or quotes, and it is kept short', async () => {
    const t = imageText.cleanText({ headline: '"Grow your business fast with our amazing new AI tools today" #ai 🚀', sub: 'Book a call @tecavy now' });
    assert.ok(t.headline.split(' ').length <= 8 && !/[#"🚀]/.test(t.headline), t.headline);
    assert.strictEqual(t.sub, 'Book a call now');
    assert.strictEqual(imageText.cleanText({ headline: '#only #tags' }), null);
    assert.strictEqual(imageText.domainOf('https://www.tecavy.com/about'), 'tecavy.com');
  });

  await test('with a style set up, the post gets a headline written from the post and saved on it; the picture stays usable if it cannot be drawn', async () => {
    let asked = 0;
    const vertex = { generateJson: async (p) => { asked += 1; assert.ok(p.includes('wash day')); return { headline: 'Wash day, sorted', sub: 'Book today' }; } };
    await ctx.run(A, async () => {
      const post = { id: 'p2', platform: 'instagram', text: 'Our wash day service is here', imagePrompt: 'towels' };
      const r = await gen.generateOneImage(post, { company: 'Acme', website: 'https://acme.test' }, async () => PNG, A, [], { vertex });
      assert.strictEqual(r.imageStatus, 'ready');
      assert.deepStrictEqual(r.imageText, { headline: 'Wash day, sorted', sub: 'Book today' });
      // regenerating only the image reuses the saved headline instead of asking again
      await gen.generateOneImage({ ...post, imageText: r.imageText }, { company: 'Acme' }, async () => PNG, A, [], { vertex });
    });
    assert.strictEqual(asked, 1);
  });

  await test('the headline can be switched off, and nothing is added when no style exists', async () => {
    await call('PUT', '/api/social/brand-style', { body: { overlay: false } });
    assert.strictEqual(brand.overlaySettings(A).on, false);
    assert.strictEqual((await call('GET', '/api/social/brand-style')).json.data.overlay, false);
    await call('PUT', '/api/social/brand-style', { body: { overlay: true } });
    assert.strictEqual(brand.overlaySettings(A).on, true);
    assert.strictEqual(brand.overlaySettings(B).on, false);
  });

  if (imageText.isAvailable()) {
    await test('the headline is really drawn onto the picture (needs Chrome/Edge)', async () => {
      const sharpish = require('zlib');
      // 8x8 solid PNG
      const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
      const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(64, 0); ihdr.writeUInt32BE(64, 4); ihdr[8] = 8; ihdr[9] = 2;
      const raw = Buffer.concat(Array.from({ length: 64 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(64 * 3, 90)])));
      const img = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', sharpish.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
      const out = await imageText.compose({ buffer: img, mime: 'image/png', text: { headline: 'Hello there' }, palette: [] });
      assert.ok(out && out.length > img.length && out.subarray(1, 4).toString() === 'PNG');
      assert.ok(!out.equals(img));
      const dims = imageText.dimensions(out);
      assert.ok(dims.w >= 512 && Math.abs(dims.w - dims.h) <= 2, JSON.stringify(dims));
    });
  }

  await test('workspaces never see each other\'s examples or style', async () => {
    const v = await call('GET', '/api/social/brand-style', { ws: B });
    assert.deepStrictEqual(v.json.data.images, []);
    assert.strictEqual(v.json.data.guide, null);
    assert.strictEqual(brand.forGeneration(B), null);
  });

  await test('no style set up: image generation is unchanged', async () => {
    assert.strictEqual(brand.forGeneration(`ws-none-${stamp}`), null);
  });

  await test('the limit of example posts is enforced', async () => {
    const parts = Array.from({ length: 12 }, (_, i) => [png(10 + i), `${i}.png`]);
    const r = await call('POST', '/api/social/brand-style/images', { form: upload(parts), ws: B });
    assert.strictEqual(r.json.data.images.length, 12);
    const more = await call('POST', '/api/social/brand-style/images', { form: upload([[png(99), 'z.png']]), ws: B });
    assert.strictEqual(more.status, 400);
  });

  await imageText.close();
  server.close();
  for (const w of [A, B]) {
    fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', w), { recursive: true, force: true });
    try {
      const f = path.join(__dirname, '..', 'data', 'brand-style.json');
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
