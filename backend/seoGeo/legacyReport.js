/** Backward-compatible report shape for older clients. */
const { getAuditWithStatuses } = require('./auditEngine');

const CHECK_MAP = {
  gbp: ['local-gbp-not-linked'],
  nap: ['local-nap-incomplete'],
  faq: ['geo-service-faq-coverage'],
  schema: ['tech-missing-structured-data', 'tech-schema-type-gap'],
  reviews: ['local-review-cadence'],
  knowledge: ['geo-knowledge-alignment'],
};

function recToLegacyCategory(category) {
  if (category === 'local_seo') return 'local_seo';
  if (category === 'geo') return 'generative';
  return 'google_search';
}

function buildLegacyReport(audit) {
  if (!audit) {
    return {
      checks: [],
      recommendations: [],
      summary: { passed: 0, needsAttention: 0, notChecked: 0, total: 6, evaluatedAt: new Date().toISOString() },
      audit: null,
    };
  }

  const recs = audit.recommendations || [];
  const active = recs.filter((r) => r.status !== 'verified' && r.status !== 'dismissed');

  const checks = Object.entries(CHECK_MAP).map(([id, recIds]) => {
    const related = recs.filter((r) => recIds.includes(r.id));
    const openRelated = related.filter((r) => r.status !== 'verified' && r.status !== 'dismissed');
    let status = 'passed';
    if (openRelated.some((r) => r.confirmationLevel === 'not_checked')) status = 'not_checked';
    else if (openRelated.length) status = 'needs_attention';

    const labels = {
      gbp: 'Google Business Profile claimed & complete',
      nap: 'NAP consistency (name, address, phone)',
      faq: 'Service / FAQ pages with answer-first copy',
      schema: 'LocalBusiness / FAQ schema planned',
      reviews: 'Review collection cadence',
      knowledge: 'Approved knowledge matches public site',
    };

    return {
      id,
      label: labels[id],
      hint: '',
      status,
      evidence: openRelated.flatMap((r) => r.evidence).slice(0, 4),
      source: 'auto',
      manualAllowed: id === 'gbp' || id === 'reviews',
    };
  });

  const recommendations = active.slice(0, 8).map((r) => ({
    priority: r.priority === 'P0' ? 0 : r.priority === 'P1' ? 1 : r.priority === 'P2' ? 2 : 3,
    category: recToLegacyCategory(r.category),
    title: r.title,
    detail: r.recommendedAction,
    relatedCheckId: null,
  }));

  return {
    checks,
    recommendations,
    summary: {
      passed: checks.filter((c) => c.status === 'passed').length,
      needsAttention: checks.filter((c) => c.status === 'needs_attention').length,
      notChecked: checks.filter((c) => c.status === 'not_checked').length,
      total: checks.length,
      evaluatedAt: audit.runAt,
    },
    audit: {
      id: audit.id,
      runAt: audit.runAt,
      crawlSummary: audit.crawlSummary,
    },
  };
}

function getLegacyReport() {
  const audit = getAuditWithStatuses();
  return buildLegacyReport(audit);
}

module.exports = { buildLegacyReport, getLegacyReport };
