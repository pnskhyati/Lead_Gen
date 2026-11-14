/* Run: node knowledge/feedback.test.js — knowledge gaps, conflicts, document quality, scheduler. */
process.env.RAG_VERIFY = 'off'; // unit tests must not call the model
process.env.GAPS_CONSOLIDATE = 'off';

process.env.RAG_DISABLE_EMBEDDINGS = 'true';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ck = require('../companyKnowledge');
const rag = require('../rag');
const gaps = require('./gaps');
const conflicts = require('./conflicts');
const { prepareKnowledge } = require('./answerContext');
const { stripBoilerplate } = require('./websiteIngest');
const { refreshStaleWebsites } = require('./scheduler');
const ctx = require('../workspaceContext');

const stamp = Date.now();
const G = `ws-test-g-${stamp}`;
const C = `ws-test-c-${stamp}`;
const O = `ws-test-o-${stamp}`;
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

// A stand-in for the model: flags every candidate pair as a contradiction.
const alwaysConflicts = {
  generateJson: async (prompt) => ({
    conflicts: [...prompt.matchAll(/### Pair (\d+)/g)].map((m) => ({
      pair: Number(m[1]),
      topic: 'Teeth cleaning price',
      statementA: 'Rs 800',
      statementB: 'Rs 1200',
      confidence: 'high',
    })),
  }),
};
const neverConflicts = { generateJson: async () => ({ conflicts: [] }) };

const baseProfile = { companyName: 'Acme Dental', botName: 'Ava', voiceTone: 'Friendly', writingStyle: 'Short' };

(async () => {
  console.log('feedback');

  // ---------------------------------------------------------------- gaps
  await test('redact removes emails, phone numbers and links before storing', () => {
    const r = gaps.redact('call me on +91 98765 43210 or mail bob@example.com see https://x.io/a');
    assert.ok(!/98765|bob@|x\.io/.test(r), r);
    assert.ok(r.includes('[phone]') && r.includes('[email]') && r.includes('[link]'));
  });

  await test('greetings and thanks are not tracked, real questions are', () => {
    for (const t of ['hi', 'Thanks!', 'ok', 'good morning', '']) assert.strictEqual(gaps.isTrackable(t), false, t);
    for (const t of ['do you offer EMI financing', 'wheelchair access?', 'price of dentures']) assert.strictEqual(gaps.isTrackable(t), true, t);
  });

  await test('repeated questions are grouped, different ones are not', async () => {
    await ctx.run(G, async () => {
      await gaps.recordGap({ question: 'Do you offer EMI financing?', channel: 'whatsapp' });
      await gaps.recordGap({ question: 'is EMI financing available', channel: 'instagram' });
      await gaps.recordGap({ question: 'EMI financing options please', channel: 'whatsapp' });
      await gaps.recordGap({ question: 'is there a wheelchair ramp', channel: 'web' });
      const open = gaps.listGaps({ status: 'open' });
      assert.strictEqual(open.length, 2, JSON.stringify(open.map((g) => g.question)));
      assert.strictEqual(open[0].count, 3, 'most asked first');
      assert.deepStrictEqual(open[0].channels, { whatsapp: 2, instagram: 1 });
      assert.ok(open[0].variants.length >= 1);
      assert.strictEqual(gaps.summary().openQuestions, 4);
    });
  });

  await test('concurrent writes never lose a count', async () => {
    await ctx.run(G, async () => {
      const before = gaps.listGaps({ status: 'open' }).find((g) => /EMI/i.test(g.question)).count;
      await Promise.all(Array.from({ length: 25 }, () => gaps.recordGap({ question: 'do you offer EMI financing' })));
      const after = gaps.listGaps({ status: 'open' }).find((g) => /EMI/i.test(g.question)).count;
      assert.strictEqual(after - before, 25);
    });
  });

  await test('gaps are isolated per workspace and can be resolved or dismissed', async () => {
    await ctx.run(O, async () => assert.strictEqual(gaps.listGaps().length, 0));
    await ctx.run(G, async () => {
      const [top, other] = gaps.listGaps({ status: 'open' });
      await gaps.markResolved(top.id, { type: 'faq', faqId: 'faq-1' });
      await gaps.dismiss(other.id);
      assert.strictEqual(gaps.listGaps({ status: 'open' }).length, 0);
      assert.strictEqual(gaps.listGaps({ status: 'resolved' })[0].resolution.faqId, 'faq-1');
    });
  });

  await test('prepareKnowledge records a gap only when knowledge does not cover the question', async () => {
    ck.saveProfile({ ...baseProfile, faqs: [{ id: '1', question: 'Do you treat children?', answer: 'Yes, pediatric consults are Rs 799.' }] }, O);
    rag.reload(O);
    await ctx.run(O, async () => {
      const covered = await prepareKnowledge('do you treat children', { channel: 'web' });
      assert.strictEqual(covered.usable, true);
      assert.ok(covered.retrievedCount > 0);
      const missing = await prepareKnowledge('what is the price of dentures', { channel: 'whatsapp' });
      assert.strictEqual(missing.usable, false);
      assert.strictEqual(missing.retrievedCount, 0);
      assert.ok(missing.notes.some((n) => /does NOT cover/.test(n)));
      await new Promise((r) => setTimeout(r, 50));
      const open = gaps.listGaps({ status: 'open' });
      assert.strictEqual(open.length, 1);
      assert.match(open[0].question, /dentures/);
    });
  });

  await test('an agent deferral on a topically related passage is logged; complaints and discounts are not', async () => {
    const { noteAgentDeferral } = require('./answerContext');
    const grounded = { retrieval: { grounded: true, conflict: false } };
    const W = `ws-test-d-${Date.now()}`;
    try {
      await ctx.run(W, async () => {
        noteAgentDeferral('can I pay the training fee in instalments', { knowledge: grounded, decided: { needsHandoff: true, intent: 'PRICE_QUERY' }, channel: 'web' });
        noteAgentDeferral('this is a complaint about my class', { knowledge: grounded, decided: { needsHandoff: true, intent: 'GENERAL_QUERY' } });
        noteAgentDeferral('please give me a discount on the pack', { knowledge: grounded, decided: { needsHandoff: true, intent: 'PRICE_QUERY' } });
        noteAgentDeferral('I want to speak to someone', { knowledge: grounded, decided: { needsHandoff: true, intent: 'HUMAN_REQUEST' } });
        noteAgentDeferral('how much is parking', { knowledge: grounded, decided: { needsHandoff: false, intent: 'PRICE_QUERY' } });
        noteAgentDeferral('already logged at retrieval time', { knowledge: { retrieval: { grounded: false, conflict: false } }, decided: { needsHandoff: true, intent: 'GENERAL_QUERY' } });
        noteAgentDeferral('contested price', { knowledge: { retrieval: { grounded: true, conflict: true } }, decided: { needsHandoff: true, intent: 'PRICE_QUERY' } });
        await new Promise((r) => setTimeout(r, 80));
        const open = gaps.listGaps({ status: 'open' });
        assert.strictEqual(open.length, 1, JSON.stringify(open.map((g) => g.question)));
        assert.match(open[0].question, /instalments/);
        assert.match(open[0].detail, /did not answer/);
      });
    } finally {
      fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', W), { recursive: true, force: true });
    }
  });

  // ------------------------------------------------------------- conflicts
  const priceA = 'Price list 2024. Teeth cleaning costs 800 rupees. Whitening costs 6000 rupees. Opening hours are Monday to Saturday.';
  const priceB = 'Price list 2025. Teeth cleaning costs 1200 rupees. Whitening costs 6000 rupees. Opening hours are Monday to Saturday.';

  await test('a contradiction between an old and a new price list is detected and blocks quoting', async () => {
    ck.saveProfile(baseProfile, C);
    ck.addDocument({ title: 'price_list_2024.txt', text: priceA }, C);
    const newer = ck.addDocument({ title: 'price_list_2025.txt', text: priceB }, C);
    assert.ok(newer.similarTo.some((s) => s.reason === 'same_name'), 'flagged as a likely newer version');
    rag.reload(C);
    const result = await conflicts.detectConflicts(alwaysConflicts, { docId: newer.id }, C);
    assert.ok(result.found >= 1, JSON.stringify(result));
    assert.strictEqual(conflicts.listConflicts({ status: 'open' }, C).length, result.found);

    const k = await ctx.run(C, () => prepareKnowledge('how much does teeth cleaning cost', { channel: 'web' }));
    assert.strictEqual(k.retrieval.conflict, true);
    assert.strictEqual(k.usable, false, 'contested facts must not count as approved knowledge');
    assert.strictEqual(k.retrievedCount, 0);
    assert.ok(k.notes.some((n) => /CONFLICTING/.test(n)));
  });

  await test('resolving "keep newer" suppresses the old passage and unblocks the answer', async () => {
    const [c] = conflicts.listConflicts({ status: 'open' }, C);
    const keep = c.a.title.includes('2025') ? 'a' : 'b';
    await conflicts.resolveConflict(c.id, keep, C);
    rag.reload(C);
    const k = await ctx.run(C, () => prepareKnowledge('how much does teeth cleaning cost', { channel: 'web', track: false }));
    assert.strictEqual(k.retrieval.conflict, false);
    assert.ok(k.chunks.some((x) => /1200/.test(x.text)), 'new price is served');
    assert.ok(!k.chunks.some((x) => /costs 800/.test(x.text)), 'old price is gone');
  });

  await test('"both are valid" stops the flag without dropping anything', async () => {
    ck.saveProfile(baseProfile, C);
    const d = ck.addDocument({ title: 'branch_b_prices.txt', text: 'Branch B teeth cleaning costs 900 rupees. Branch B is open Sunday.' }, C);
    rag.reload(C);
    const r = await conflicts.detectConflicts(alwaysConflicts, { docId: d.id }, C);
    assert.ok(r.found >= 1);
    for (const c of conflicts.listConflicts({ status: 'open' }, C)) await conflicts.resolveConflict(c.id, 'both', C);
    assert.strictEqual(conflicts.listConflicts({ status: 'open' }, C).length, 0);
    assert.ok(conflicts.suppressedChunkIds(C).size >= 1, 'earlier suppression kept');
  });

  await test('an owner FAQ automatically beats a conflicting document', async () => {
    ck.saveProfile({ ...baseProfile, faqs: [{ id: 'f1', question: 'How much is a root canal?', answer: 'A root canal costs 5000 rupees.' }] }, O);
    const d = ck.addDocument({ title: 'old_brochure.txt', text: 'Our root canal treatment costs 9000 rupees and takes one visit.' }, O);
    rag.reload(O);
    const r = await conflicts.detectConflicts(alwaysConflicts, { docId: d.id }, O);
    assert.strictEqual(r.found, 0, 'nothing for a human to resolve');
    const all = conflicts.listConflicts({ status: 'all' }, O);
    assert.ok(all.length >= 1 && all.every((c) => c.status === 'resolved' && c.resolution === 'faq_wins'));
  });

  await test('no contradiction found means no flag', async () => {
    const d = ck.addDocument({ title: 'extra.txt', text: 'Teeth cleaning takes about 45 minutes and is done by a hygienist.' }, C);
    rag.reload(C);
    assert.deepStrictEqual((await conflicts.detectConflicts(neverConflicts, { docId: d.id }, C)).found, 0);
  });

  await test('FAQ passages are ordered before documents in retrieved context', async () => {
    const res = await rag.search('how much is a root canal', { ws: O, topK: 5 });
    assert.ok(res.chunks[0].tags.includes('faq'), res.chunks.map((c) => c.id).join(','));
  });

  await test('archiving a document removes it from retrieval; restoring brings it back', async () => {
    const d = ck.addDocument({ title: 'winter_offer.txt', text: 'Winter offer: free whitening consultation with any cleaning until January.' }, C);
    rag.reload(C);
    assert.ok((await rag.search('winter offer free whitening', { ws: C })).grounded);
    ck.setDocumentStatus(d.id, 'archived', C);
    rag.reload(C);
    assert.ok(!(await rag.search('winter offer free whitening', { ws: C })).chunks.some((x) => x.sourceDocId === d.id));
    ck.setDocumentStatus(d.id, 'active', C);
    rag.reload(C);
    assert.ok((await rag.search('winter offer free whitening', { ws: C })).chunks.some((x) => x.sourceDocId === d.id));
  });

  // ------------------------------------------------------ quality + ingestion
  await test('document quality flags explain weak content', () => {
    assert.ok(ck.documentQuality({ text: 'short', source: 'upload' }).includes('very_short'));
    const boiler = Array.from({ length: 12 }, (_, i) => (i % 2 ? 'Accept all cookies' : 'Privacy policy')).join('\n') + '\n' + 'x'.repeat(400);
    assert.ok(ck.documentQuality({ text: boiler, source: 'website', uploadedAt: new Date().toISOString() }).includes('boilerplate_heavy'));
    const old = new Date(Date.now() - 40 * 86400000).toISOString();
    const flags = ck.documentQuality({ text: 'Source: a\n'.repeat(5) + 'x'.repeat(400), source: 'website', uploadedAt: old });
    assert.ok(flags.includes('stale') && !flags.includes('few_pages'));
    assert.ok(ck.documentQuality({ text: 'x'.repeat(500), ocr: true }).includes('scanned_ocr'));
  });

  await test('near-duplicate documents are reported on upload', () => {
    const body = 'We offer teeth cleaning whitening implants crowns and root canal treatment in Pune at fair prices for families.';
    ck.addDocument({ title: 'services.txt', text: body }, O);
    const similar = ck.addDocument({ title: 'brochure.txt', text: body + ' Call us today.' }, O);
    assert.ok(similar.similarTo.some((s) => s.reason === 'similar_content'));
    const unrelated = ck.addDocument({ title: 'parking.txt', text: 'Parking is available behind the building on the side street near the gate.' }, O);
    assert.strictEqual(unrelated.similarTo.length, 0);
  });

  await test('website chrome repeated across pages is stripped, page content kept', () => {
    const nav = 'Home\nAbout\nContact\nBook now\n';
    const pages = ['Cleaning costs 800 rupees.', 'Implants start at 25000 rupees.', 'Call 98765 43210 daily.'].map((t) => ({
      text: `${nav}${t}\nAccept all cookies\n(c) 2025 Acme. All rights reserved.`,
    }));
    const out = stripBoilerplate(pages).map((p) => p.text);
    assert.deepStrictEqual(out, ['Cleaning costs 800 rupees.', 'Implants start at 25000 rupees.', 'Call 98765 43210 daily.']);
  });

  await test('scheduler skips workspaces without a website or with a fresh snapshot', async () => {
    ck.saveProfile({ ...baseProfile, websiteUrl: 'https://acme.example' }, O);
    ck.addDocument({ title: 'Website: acme.example', text: 'x'.repeat(300), source: 'website', sourceKey: 'website:https://acme.example' }, O);
    const results = await refreshStaleWebsites({ generateJson: async () => ({}) });
    const mine = results.find((r) => r.ws === O);
    assert.deepStrictEqual(mine.value, { skipped: 'fresh' });
    const noSite = results.find((r) => r.ws === C);
    if (noSite) assert.deepStrictEqual(noSite.value, { skipped: 'no website' });
  });

  for (const ws of [G, C, O]) fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', ws), { recursive: true, force: true });
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
