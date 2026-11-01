/** Configurable priority scoring (product defaults — not Google ranking factors). */

const DEFAULT_WEIGHTS = {
  impact: 0.35,
  severity: 0.25,
  confidence: 0.2,
  urgency: 0.1,
  effort: 0.1,
};

const PRIORITY_THRESHOLDS = {
  P0: 85,
  P1: 70,
  P2: 45,
};

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

/**
 * P = 0.35·I + 0.25·S + 0.20·C + 0.10·U + 0.10·(100 − E)
 */
function computePriorityScore(factors, weights = DEFAULT_WEIGHTS) {
  const I = clamp(factors.impact);
  const S = clamp(factors.severity);
  const C = clamp(factors.confidence);
  const U = clamp(factors.urgency);
  const E = clamp(factors.effort);
  const score =
    weights.impact * I +
    weights.severity * S +
    weights.confidence * C +
    weights.urgency * U +
    weights.effort * (100 - E);
  return Math.round(score * 10) / 10;
}

function scoreToPriority(score, { forceMinPriority } = {}) {
  const s = clamp(score);
  let priority = 'P3';
  if (s >= PRIORITY_THRESHOLDS.P0) priority = 'P0';
  else if (s >= PRIORITY_THRESHOLDS.P1) priority = 'P1';
  else if (s >= PRIORITY_THRESHOLDS.P2) priority = 'P2';

  if (forceMinPriority) {
    const order = ['P3', 'P2', 'P1', 'P0'];
    if (order.indexOf(priority) < order.indexOf(forceMinPriority)) {
      priority = forceMinPriority;
    }
  }
  return priority;
}

function effortLabel(effortScore) {
  const E = clamp(effortScore);
  if (E <= 35) return 'low';
  if (E <= 65) return 'medium';
  return 'high';
}

module.exports = {
  DEFAULT_WEIGHTS,
  PRIORITY_THRESHOLDS,
  computePriorityScore,
  scoreToPriority,
  effortLabel,
  clamp,
};
