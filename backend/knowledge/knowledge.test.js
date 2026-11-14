/* Run: node knowledge/knowledge.test.js */
process.env.RAG_VERIFY = 'off'; // unit tests must not call the model

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ck = require('../companyKnowledge');
const rag = require('../rag');
const { htmlToText, extractFileText, extractLinks } = require('./textExtract');

const WS_A = `ws-test-a-${Date.now()}`;
const WS_B = `ws-test-b-${Date.now()}`;
let failures = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

function cleanup() {
  for (const ws of [WS_A, WS_B]) {
    fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', ws), { recursive: true, force: true });
  }
}

(async () => {
  console.log('knowledge');

  await test('chunkText keeps headings and respects maxLen', () => {
    const text = `# Pricing\n\n${'Cleaning costs 800 rupees. '.repeat(20)}\n\n# Hours\n\nOpen Monday to Saturday 9am to 7pm.`;
    const chunks = ck.chunkText(text, { maxLen: 300 });
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((c) => c.length <= 300 + 200), 'chunks stay near maxLen (heading + overlap allowance)');
    assert.ok(chunks.some((c) => c.includes('Pricing')), 'heading carried into chunk');
    assert.ok(chunks.some((c) => c.includes('Monday to Saturday')));
  });

  await test('chunkText splits long text on sentences, not mid-word', () => {
    const sentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} talks about dental care.`).join(' ');
    const chunks = ck.chunkText(sentences, { maxLen: 200 });
    assert.ok(chunks.every((c) => /\.$/.test(c.trim())), 'every chunk ends on a sentence boundary');
  });

  await test('tokenize drops stopwords and stems plurals', () => {
    const t = rag.tokenize('What are the prices for cleanings?');
    assert.ok(!t.includes('the') && !t.includes('what'));
    assert.ok(t.includes('price') && t.includes('cleaning'));
  });

  await test('search finds the right chunk and reports grounded', async () => {
    ck.saveProfile(
      {
        companyName: 'SmileCare Dental',
        botName: 'Ava',
        voiceTone: 'Friendly',
        writingStyle: 'Short',
        businessPhone: '+91 20 5555 0100',
        businessHours: 'Mon-Sat 9am-7pm',
        faqs: [
          { id: '1', question: 'How much does teeth whitening cost?', answer: 'Whitening is 6,500 rupees per session.' },
          { id: '2', question: 'Do you treat children?', answer: 'Yes, our pediatric consult is 500 rupees.' },
        ],
      },
      WS_A
    );
    ck.addDocument({ title: 'Services', text: 'Root canal treatment (RCT) starts at 4,500 rupees. We offer dental implants and crowns.\n\nParking is available behind the clinic.' }, WS_A);
    rag.reload(WS_A);

    const hit = await rag.search('how much is whitening', { ws: WS_A });
    assert.strictEqual(hit.grounded, true);
    assert.strictEqual(hit.chunks[0].id, 'faq-1');

    const rct = await rag.search('root canal price', { ws: WS_A });
    assert.ok(rct.grounded);
    assert.ok(rct.chunks.some((c) => /Root canal/.test(c.text)));
  });

  await test('search reports NOT grounded for unrelated questions', async () => {
    const miss = await rag.search('do you sell motorcycle insurance in Berlin', { ws: WS_A });
    assert.strictEqual(miss.grounded, false);
    assert.strictEqual(miss.confidence, 'low');
  });

  await test('borderline retrievals consult the answerability check; clear hits and clear misses do not', async () => {
    const W = `ws-test-v-${Date.now()}`;
    try {
      ck.saveProfile({ companyName: 'Acme Dental', botName: 'Ava', voiceTone: 'x', writingStyle: 'y' }, W);
      ck.addDocument({ title: 'Prices', text: 'Teeth cleaning costs 800 rupees. Whitening costs 6000 rupees. Root canal treatment costs 5000 rupees. Parking is behind the clinic. We are open Monday to Saturday.' }, W);
      rag.reload(W);
      let calls = 0;
      const yes = async () => { calls += 1; return true; };
      const no = async () => { calls += 1; return false; };

      const clear = await rag.search('teeth cleaning costs', { ws: W, verify: true, verifier: yes });
      assert.ok(clear.grounded && !clear.verified && calls === 0, 'a confident hit never calls the checker');

      const miss = await rag.search('what is the weather in Berlin', { ws: W, verify: true, verifier: yes });
      assert.ok(!miss.grounded && calls === 0, 'an unrelated question never calls the checker');

      // Find a question whose keyword coverage lands in the borderline band.
      const candidates = ['is there a student discount on teeth cleaning', 'do you offer teeth cleaning for children on sunday', 'can I pay for root canal in instalments', 'does whitening hurt'];
      let borderlineQ = null;
      for (const q of candidates) {
        const a = await rag.analyzeQuery(q, { ws: W });
        if (a.topCoverage >= 0.15 && a.topCoverage < 0.3) { borderlineQ = q; break; }
      }
      assert.ok(borderlineQ, 'test needs a borderline question');
      const approved = await rag.search(borderlineQ, { ws: W, verify: true, verifier: yes });
      assert.ok(calls === 1 && approved.grounded && approved.verified && approved.confidence === 'medium');
      const refused = await rag.search(borderlineQ, { ws: W, verify: true, verifier: no });
      assert.ok(!refused.grounded && !refused.verified);
      const off = await rag.search(borderlineQ, { ws: W, verify: false, verifier: yes });
      assert.ok(!off.grounded, 'verification can be switched off');
      const crashed = await rag.search(borderlineQ, { ws: W, verify: true, verifier: async () => { throw new Error('boom'); } }).catch((e) => e);
      assert.ok(crashed instanceof Error || crashed.grounded === false, 'a checker failure must never grant an answer');
    } finally {
      fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', W), { recursive: true, force: true });
    }
  });

  await test('workspaces are isolated', async () => {
    ck.saveProfile({ companyName: 'Other Co', botName: 'Bo', voiceTone: 'Formal', writingStyle: 'Long' }, WS_B);
    rag.reload(WS_B);
    const res = await rag.search('teeth whitening', { ws: WS_B });
    assert.strictEqual(res.grounded, false);
    assert.ok(res.chunks.every((c) => !/whitening/i.test(c.text)));
    assert.strictEqual(ck.getProfile(WS_B).companyName, 'Other Co');
    assert.strictEqual(ck.getProfile(WS_A).companyName, 'SmileCare Dental');
  });

  await test('invalid workspace ids are rejected (no path traversal)', () => {
    assert.throws(() => ck.getProfile('../../etc'), /Invalid workspace/);
  });

  await test('re-uploading identical content does not duplicate', () => {
    const body = 'We are open on all public holidays except Diwali and Christmas.';
    const a = ck.addDocument({ title: 'Holidays', text: body }, WS_A);
    const b = ck.addDocument({ title: 'Holidays again', text: body }, WS_A);
    assert.strictEqual(b.duplicate, true);
    assert.strictEqual(b.id, a.id);
  });

  await test('sanitizeProfilePatch drops incomplete FAQs and bad input', () => {
    const p = ck.sanitizeProfilePatch({ faqs: [{ question: 'q', answer: '' }, { question: 'Real?', answer: 'Yes' }], companyName: '  Acme  ', unknown: 'x' });
    assert.strictEqual(p.faqs.length, 1);
    assert.strictEqual(p.companyName, 'Acme');
    assert.ok(!('unknown' in p));
  });

  await test('htmlToText strips scripts/nav and keeps headings', () => {
    const t = htmlToText('<html><head><title>x</title></head><body><nav>Menu</nav><script>evil()</script><h1>About us</h1><p>We fix teeth &amp; smiles.</p><ul><li>Cleaning</li></ul></body></html>');
    assert.ok(t.includes('# About us'));
    assert.ok(t.includes('teeth & smiles'));
    assert.ok(!/evil|Menu/.test(t));
    assert.ok(t.includes('- Cleaning'));
  });

  await test('extractLinks resolves relative urls and ignores mailto', () => {
    const l = extractLinks('<a href="/about">a</a><a href="mailto:x@y.z">m</a><a href="https://other.com/p#frag">o</a>', 'https://acme.com/');
    assert.deepStrictEqual(l.sort(), ['https://acme.com/about', 'https://other.com/p'].sort());
  });

  await test('extractFileText rejects wrong magic bytes and unsupported types', async () => {
    await assert.rejects(extractFileText({ buffer: Buffer.from('not a pdf at all'), fileName: 'x.pdf' }), /not a valid PDF/);
    await assert.rejects(extractFileText({ buffer: Buffer.from('MZ'), fileName: 'x.exe' }), /Unsupported/);
  });

  await test('extractFileText reads text and html', async () => {
    const t = await extractFileText({ buffer: Buffer.from('Hello   world\n\n\n\nbye'), fileName: 'a.txt' });
    assert.strictEqual(t.text, 'Hello world\n\nbye');
    const h = await extractFileText({ buffer: Buffer.from('<p>Hi there</p>'), fileName: 'a.html' });
    assert.strictEqual(h.text, 'Hi there');
  });

  await test('knowledge health flags missing facts', () => {
    const h = ck.getKnowledgeHealth(WS_B);
    assert.ok(h.score < 60);
    assert.ok(h.checks.find((c) => c.key === 'faqs' && !c.ok));
    const a = ck.getKnowledgeHealth(WS_A);
    assert.ok(a.checks.find((c) => c.key === 'pricing').ok);
  });

  cleanup();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
