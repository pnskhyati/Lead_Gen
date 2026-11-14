/* Run: node knowledge/hardening.test.js — SSRF/DNS-rebinding, JS rendering, OCR and background-job behaviour. */
process.env.RAG_VERIFY = 'off'; // unit tests must not call the model

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { createSafeLookup, createSafeFetch } = require('../seoGeo/safeFetch');
const { createRenderer, isAvailable } = require('./renderPage');
const { extractFileText } = require('./textExtract');
const ck = require('../companyKnowledge');
const ctx = require('../workspaceContext');

const WS = `ws-test-h-${Date.now()}`;
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

const lookup = (resolver, opts) => new Promise((resolve) => createSafeLookup({ resolver, ...opts })('h.test', opts?.lookupOpts || {}, (...args) => resolve(args)));
const resolveTo = (...addrs) => (_h, _o, cb) => cb(null, addrs.map((a) => ({ address: a, family: a.includes(':') ? 6 : 4 })));

(async () => {
  console.log('hardening');

  await test('safe lookup blocks private, loopback, link-local and mixed answers', async () => {
    for (const bad of [['127.0.0.1'], ['10.1.2.3'], ['169.254.169.254'], ['::1'], ['8.8.8.8', '192.168.0.9']]) {
      const [err] = await lookup(resolveTo(...bad));
      assert.ok(err && err.code === 'ESSRF', `expected block for ${bad}`);
    }
  });

  await test('safe lookup passes public addresses in both callback shapes', async () => {
    const [err1, addr, fam] = await lookup(resolveTo('93.184.216.34'));
    assert.ok(!err1 && addr === '93.184.216.34' && fam === 4);
    const [err2, list] = await new Promise((r) => createSafeLookup({ resolver: resolveTo('93.184.216.34') })('h.test', { all: true }, (...a) => r(a)));
    assert.ok(!err2 && Array.isArray(list) && list[0].address === '93.184.216.34');
  });

  await test('DNS rebinding: a name that resolves to loopback cannot be fetched', async () => {
    const server = http.createServer((_req, res) => res.end('internal-secret'));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      // Control: with the address check disabled the same request reaches the internal server...
      const open = createSafeFetch({ resolver: resolveTo('127.0.0.1'), isPrivate: () => false });
      const ok = await open.safeFetch(`http://rebind.test:${port}/`);
      assert.strictEqual(await ok.text(), 'internal-secret');
      // ...and with the real guard it is refused at connect time, even though the name looked public.
      const guarded = createSafeFetch({ resolver: resolveTo('127.0.0.1') });
      await assert.rejects(guarded.safeFetch(`http://rebind.test:${port}/`), (e) => /fetch failed|Blocked/.test(e.message) && /ESSRF|Blocked/.test(String(e.cause?.code || e.cause?.message || e.message)));
    } finally {
      server.close();
    }
  });

  await test('fetchBuffer refuses literal private IPs before connecting', async () => {
    const { fetchBuffer } = createSafeFetch();
    await assert.rejects(fetchBuffer('http://127.0.0.1:9/'), /Blocked/);
    await assert.rejects(fetchBuffer('http://169.254.169.254/latest/meta-data'), /Blocked/);
  });

  const SPA = '<html><head><title>Acme</title></head><body><div id="app"></div><script src="/app.js"></script></body></html>';
  const APP_JS = "document.getElementById('app').innerHTML='<h1>Acme Widgets</h1><p>'+'We sell premium widgets across Pune. '.repeat(8)+'</p>';";
  const spaFetch = (log) => async (url) => {
    log.push(url);
    if (url.endsWith('/app.js')) return { status: 200, headers: { 'content-type': 'application/javascript' }, body: Buffer.from(APP_JS) };
    return { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(SPA) };
  };

  if (isAvailable()) {
    await test('headless renderer reads a JavaScript-only page via the guarded fetcher', async () => {
      const log = [];
      const renderer = createRenderer({ fetchBuffer: spaFetch(log) });
      try {
        const out = await renderer.render('https://spa.example/');
        assert.ok(out.html.includes('Acme Widgets'));
        assert.ok(log.every((u) => u.startsWith('https://spa.example/')), 'every request went through the injected fetcher');
      } finally {
        await renderer.close();
      }
    });

    await test('renderer cannot be used to reach the network directly (blocked requests fail)', async () => {
      const seen = [];
      const failing = async (url) => {
        seen.push(url);
        if (url.includes('169.254')) throw new Error('Blocked private address');
        return spaFetch([])(url);
      };
      const page = SPA.replace('/app.js', 'http://169.254.169.254/app.js');
      const renderer = createRenderer({ fetchBuffer: async (u) => (u === 'https://spa2.example/' ? { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(page) } : failing(u)) });
      try {
        const out = await renderer.render('https://spa2.example/');
        assert.ok(!out.html.includes('Acme Widgets'), 'blocked script never ran');
        assert.ok(seen.some((u) => u.includes('169.254')), 'attempt was routed to the guard, not the network');
      } finally {
        await renderer.close();
      }
    });
  } else {
    console.log('  skip headless renderer tests (no Chrome/Edge found)');
  }

  // A structurally valid PDF with one blank page (no text layer): what a scan looks like to a text parser.
  function buildBlankPdf() {
    const objs = [
      '<</Type/Catalog/Pages 2 0 R>>',
      '<</Type/Pages/Kids[3 0 R]/Count 1>>',
      '<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>',
    ];
    let out = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => {
      out += `${String(o).padStart(10, '0')} 00000 n \n`;
    });
    out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out);
  }
  const blankPdf = buildBlankPdf();
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

  await test('scanned (text-less) PDFs fall back to OCR', async () => {
    let calls = 0;
    const r = await extractFileText({
      buffer: blankPdf,
      fileName: 'scan.pdf',
      ocr: async ({ mimeType }) => {
        calls += 1;
        assert.strictEqual(mimeType, 'application/pdf');
        return 'Teeth Cleaning | Rs 800\nOpen Mon-Sat 9am to 7pm';
      },
    });
    assert.strictEqual(calls, 1);
    assert.strictEqual(r.ocr, true);
    assert.ok(r.text.includes('Rs 800'));
  });

  await test('a damaged PDF still gets an OCR attempt instead of a cryptic parser error', async () => {
    const damaged = Buffer.from('%PDF-1.4\nthis is not really a pdf structure');
    const r = await extractFileText({ buffer: damaged, fileName: 'broken.pdf', ocr: async () => 'Recovered text from the damaged file via OCR' });
    assert.ok(r.ocr && r.text.includes('Recovered'));
    await assert.rejects(extractFileText({ buffer: damaged, fileName: 'broken.pdf', ocr: async () => '' }), /No readable text found in this PDF/);
  });

  await test('images are OCRd, and empty OCR is reported clearly', async () => {
    const r = await extractFileText({ buffer: PNG, fileName: 'menu.png', ocr: async () => 'Cappuccino Rs 180 / Latte Rs 200' });
    assert.ok(r.ocr && r.text.includes('Latte'));
    await assert.rejects(extractFileText({ buffer: PNG, fileName: 'blank.png', ocr: async () => '' }), /No readable text/);
    await assert.rejects(extractFileText({ buffer: Buffer.from('not an image'), fileName: 'x.png', ocr: async () => 'x' }), /not a valid PNG/);
  });

  await test('OCR failures surface as a clear error, not a crash', async () => {
    await assert.rejects(
      extractFileText({ buffer: PNG, fileName: 'a.png', ocr: async () => { throw new Error('deadline exceeded'); } }),
      /Could not read text from this scanned file \(deadline exceeded\)/
    );
  });

  await test('analysis runs as a background job with progress and per-workspace access', async () => {
    ctx.run(WS, () => ck.addDocument({ title: 'About', text: 'We are Acme Dental in Pune. Open Monday to Saturday 9am to 7pm. Cleaning costs Rs 800.' }, WS));
    const stages = [];
    const vertex = {
      generateJson: async () => {
        await new Promise((r) => setTimeout(r, 30));
        return { companyName: 'Acme Dental', whatYouSell: 'Dental care', voiceTone: 'Warm', writingStyle: 'Short', suggestedFaqs: [{ question: 'Price of cleaning?', answer: 'Rs 800' }] };
      },
    };
    const job = ck.startAnalyzeJob(vertex, { uploadedBy: 't@example.com' }, WS);
    assert.strictEqual(job.status, 'running');
    assert.strictEqual(ck.startAnalyzeJob(vertex, {}, WS).id, job.id, 'a second request joins the running job');
    assert.strictEqual(ck.getAnalyzeJob(job.id, 'ws-someone-else'), null, 'other workspaces cannot see the job');
    for (let i = 0; i < 100 && ck.getAnalyzeJob(job.id, WS).status === 'running'; i += 1) {
      stages.push(ck.getAnalyzeJob(job.id, WS).stage);
      await new Promise((r) => setTimeout(r, 20));
    }
    const done = ck.getAnalyzeJob(job.id, WS);
    assert.strictEqual(done.status, 'done');
    assert.strictEqual(done.result.draft.companyName, 'Acme Dental');
    assert.strictEqual(done.result.draft.faqs.length, 1);
    assert.ok(stages.includes('learning'), `saw stages: ${stages}`);
  });

  await test('a failing analysis ends in an error state instead of hanging', async () => {
    const bad = { generateJson: async () => { throw new Error('model unavailable'); } };
    const job = ck.startAnalyzeJob(bad, {}, WS);
    for (let i = 0; i < 100 && ck.getAnalyzeJob(job.id, WS).status === 'running'; i += 1) await new Promise((r) => setTimeout(r, 20));
    const final = ck.getAnalyzeJob(job.id, WS);
    assert.strictEqual(final.status, 'error');
    assert.match(final.error, /model unavailable/);
  });

  fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', WS), { recursive: true, force: true });
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
