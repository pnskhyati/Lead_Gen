/**
 * Retrieval grounding evaluation: how well does the assistant separate questions its knowledge can answer
 * from ones it cannot? Used to choose thresholds and to compare recall mechanisms on real data.
 *
 *   node knowledge/eval.js                     both bundled datasets (needs Vertex credentials)
 *   node knowledge/eval.js --reuse             re-score cached signals without calling the model again
 *   node knowledge/eval.js path/to/set.json    your own dataset: { corpus, questions:[{q, answerable}] }
 *
 * Variants compared (decision = the assistant says "I can answer this"):
 *   V0  passage similarity or keyword coverage                      (the previous production rule)
 *   V1  V0 + generated customer questions matched like-for-like
 *   V2  V0 + model answerability check on borderline cases
 *   V3  V1 + model answerability check on borderline cases
 * Thresholds are tuned on one dataset and scored on the other, so the numbers are not self-flattering.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') });

const args = process.argv.slice(2);
const REUSE = args.includes('--reuse');
const files = args.filter((a) => !a.startsWith('--'));
const datasets = (files.length ? files : [path.join(__dirname, 'eval-data', 'smilecare.json'), path.join(__dirname, 'eval-data', 'yoga.json')]).map((f) => path.resolve(f));

const GRAY = { sim: 0.5, qsim: 0.65, cov: 0.15 }; // must mirror rag.js
const pct = (x) => `${Math.round(x * 100)}%`;
const cachePath = (file) => path.join(os.tmpdir(), `nexora-eval-${path.basename(file)}.cache.json`);

function metrics(rows, decide) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    const said = decide(r);
    if (r.answerable && said) tp += 1;
    else if (r.answerable) fn += 1;
    else if (said) fp += 1;
    else tn += 1;
  }
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  return { tp, fp, tn, fn, precision, recall, accuracy: (tp + tn) / rows.length, f1: (2 * precision * recall) / (precision + recall || 1) };
}

// A confident wrong "I can answer" is worse than an unnecessary handoff, so precision weighs more.
const score = (m) => 0.5 * m.precision + 0.3 * m.recall + 0.2 * m.accuracy;

async function collect(file) {
  if (REUSE && fs.existsSync(cachePath(file))) return JSON.parse(fs.readFileSync(cachePath(file), 'utf8'));

  const ck = require('../companyKnowledge');
  const rag = require('../rag');
  const embeddings = require('./embeddings');
  const dataset = JSON.parse(fs.readFileSync(file, 'utf8'));
  const WS = `ws-eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanup = () => fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', WS), { recursive: true, force: true });
  try {
    const corpus = fs.readFileSync(path.resolve(path.dirname(file), dataset.corpus), 'utf8');
    ck.saveProfile({ companyName: 'Eval Co', botName: 'Eva', voiceTone: 'x', writingStyle: 'y' }, WS);
    ck.addDocument({ title: 'Corpus', text: corpus }, WS);
    rag.reload(WS);
    const idx = await rag.indexEmbeddings(WS);
    if (idx.failed) throw new Error(`Embedding failed: ${embeddings.getLastError()}`);
    rag.reload(WS);
    const stats = rag.getStats(WS);
    console.log(`${path.basename(file)}: chunks=${stats.chunks} embedded=${stats.embedded} generatedQuestions=${stats.generatedQuestions}`);
    if (!stats.generatedQuestions) throw new Error('No customer questions were generated — cannot evaluate question matching');

    const rows = [];
    for (const item of dataset.questions) {
      let a;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        a = await rag.analyzeQuery(item.q, { ws: WS, useQuestions: true });
        if (a.hybrid) break;
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      }
      if (!a.hybrid) throw new Error(`Query could not be embedded: ${embeddings.getLastError()}`);
      rows.push({
        ...item,
        sim: a.topSimilarity ?? 0,
        qsim: a.topQuestionSimilarity ?? 0,
        cov: a.topCoverage,
        top: a.ranked.slice(0, 4).map((r) => a.idx.chunks[r.i]),
      });
    }

    // Model answerability verdicts for anything that could be borderline under any variant.
    const loose = rows.filter((r) => r.sim >= 0.45 || r.qsim >= 0.6 || r.cov >= 0.1);
    let next = 0;
    async function worker() {
      while (next < loose.length) {
        const r = loose[next];
        next += 1;
        r.verdict = await rag.verifyAnswerable(r.q, r.top);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    rows.forEach((r) => {
      r.verdict = Boolean(r.verdict);
      delete r.top;
    });
    fs.writeFileSync(cachePath(file), JSON.stringify(rows));
    return rows;
  } finally {
    cleanup();
  }
}

const gray = (r, qsimOn) => r.sim >= GRAY.sim || (qsimOn && r.qsim >= GRAY.qsim) || r.cov >= GRAY.cov;

const VARIANTS = {
  V0: { label: 'baseline', params: ['T', 'C'], decide: ({ T, C }) => (r) => r.sim >= T || r.cov >= C },
  V1: { label: '+ generated questions', params: ['T', 'C', 'Q'], decide: ({ T, C, Q }) => (r) => r.sim >= T || r.qsim >= Q || r.cov >= C },
  V2: { label: '+ answerability check', params: ['T', 'C'], decide: ({ T, C }) => (r) => r.sim >= T || r.cov >= C || (gray(r, false) && r.verdict) },
  V3: { label: '+ questions + check', params: ['T', 'C', 'Q'], decide: ({ T, C, Q }) => (r) => r.sim >= T || r.qsim >= Q || r.cov >= C || (gray(r, true) && r.verdict) },
};

function grid(variant) {
  const out = [];
  for (let T = 0.5; T <= 0.7001; T += 0.02) {
    for (const C of [0.3, 0.4, 0.5, 1.01]) {
      if (variant.params.includes('Q')) for (let Q = 0.72; Q <= 0.9501; Q += 0.02) out.push({ T: +T.toFixed(2), C, Q: +Q.toFixed(2) });
      else out.push({ T: +T.toFixed(2), C });
    }
  }
  return out;
}

function tune(variant, trainRows) {
  return grid(variant)
    .map((p) => ({ p, m: metrics(trainRows, variant.decide(p)) }))
    .sort((a, b) => score(b.m) - score(a.m))[0];
}

(async () => {
  const sets = [];
  for (const file of datasets) sets.push({ name: path.basename(file, '.json'), rows: await collect(file) });
  console.log('');
  for (const s of sets) {
    const pos = s.rows.filter((r) => r.answerable);
    const neg = s.rows.filter((r) => !r.answerable);
    const avg = (a, k) => (a.reduce((t, r) => t + r[k], 0) / a.length).toFixed(2);
    console.log(`${s.name}: ${pos.length} answerable / ${neg.length} not. passage similarity: answerable avg ${avg(pos, 'sim')}, not-answerable max ${Math.max(...neg.map((r) => r.sim)).toFixed(2)}. generated-question similarity: answerable avg ${avg(pos, 'qsim')}, not-answerable max ${Math.max(...neg.map((r) => r.qsim)).toFixed(2)}`);
  }

  console.log('\nHoldout results (thresholds tuned on the OTHER dataset):');
  console.log('variant                        | dataset      | acc  prec  recall | tuned on other: T    C    Q');
  const summary = {};
  for (const [name, variant] of Object.entries(VARIANTS)) {
    summary[name] = { tp: 0, fp: 0, tn: 0, fn: 0 };
    for (const test of sets) {
      const train = sets.filter((s) => s !== test).flatMap((s) => s.rows);
      const best = tune(variant, train.length ? train : test.rows);
      const m = metrics(test.rows, variant.decide(best.p));
      for (const k of ['tp', 'fp', 'tn', 'fn']) summary[name][k] += m[k];
      console.log(`${name} ${variant.label.padEnd(25)} | ${test.name.padEnd(12)} | ${pct(m.accuracy).padStart(4)} ${pct(m.precision).padStart(4)} ${pct(m.recall).padStart(6)}  |  ${best.p.T}  ${best.p.C}  ${best.p.Q ?? '-'}`);
    }
  }

  console.log('\nCombined holdout (all questions, each scored with thresholds it did not train on):');
  for (const [name, c] of Object.entries(summary)) {
    const precision = c.tp / (c.tp + c.fp || 1);
    const recall = c.tp / (c.tp + c.fn || 1);
    console.log(`  ${name} ${VARIANTS[name].label.padEnd(25)} precision ${pct(precision)}  recall ${pct(recall)}  false "can answer": ${c.fp}  missed: ${c.fn}`);
  }

  const all = sets.flatMap((s) => s.rows);
  console.log('\nBest thresholds on all data pooled (for choosing production defaults):');
  for (const [name, variant] of Object.entries(VARIANTS)) {
    const best = tune(variant, all);
    console.log(`  ${name}: T=${best.p.T} C=${best.p.C}${best.p.Q ? ` Q=${best.p.Q}` : ''} -> precision ${pct(best.m.precision)} recall ${pct(best.m.recall)} accuracy ${pct(best.m.accuracy)}  (FP ${best.m.fp}, FN ${best.m.fn})`);
  }
  process.exit(0);
})().catch((err) => {
  console.error('eval failed:', err.message);
  process.exit(1);
});
