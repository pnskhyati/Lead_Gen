const assert = require('assert');
const { computePriorityScore, scoreToPriority } = require('./scoring');

const example = computePriorityScore({
  impact: 90,
  severity: 95,
  confidence: 95,
  urgency: 80,
  effort: 20,
});
assert.ok(example >= 90 && example <= 91, `example score ~90.25, got ${example}`);
assert.strictEqual(scoreToPriority(example), 'P0');
assert.strictEqual(scoreToPriority(75), 'P1');
assert.strictEqual(scoreToPriority(50), 'P2');
assert.strictEqual(scoreToPriority(30), 'P3');
assert.strictEqual(scoreToPriority(50, { forceMinPriority: 'P1' }), 'P1');

console.log('seoGeo/scoring.test.js OK');
