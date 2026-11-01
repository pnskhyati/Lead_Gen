const crypto = require('crypto');
const companyKnowledge = require('../companyKnowledge');
const { crawlPublicSite } = require('./crawler');
const { runRules } = require('./rules');
const { saveAudit, getLatestAudit, readRecommendationStatuses, readLegacyManualStatuses } = require('./store');
const { crawlSitePages, buildMultiPageRecommendations } = require('./siteCrawl');
const { getLatestCompletedCrawl, getCrawlRecommendations } = require('./crawlJob');
const { collectGoogleAuditEvidence, getIntegrationStatus } = require('./googleIntegrations');
const { enrichWithContentAi } = require('./contentAi');

function loadDocumentBodies() {
  const path = require('path');
  const fs = require('fs');
  const docStorePath = path.join(__dirname, '..', 'data', 'company', 'documents.json');
  try {
    const raw = JSON.parse(fs.readFileSync(docStorePath, 'utf8'));
    return (raw.documents || []).map((d) => String(d.text || '')).filter(Boolean);
  } catch {
    return [];
  }
}

function corpusText(profile, docBodies) {
  const parts = [
    profile.companyName,
    profile.tagline,
    profile.productsFocus,
    profile.audience,
    profile.extraGuidelines,
    profile.businessAddress,
    profile.businessPhone,
    profile.websiteUrl,
    ...docBodies,
  ];
  return parts.filter(Boolean).join('\n');
}

function mergeRecommendationStatuses(recommendations) {
  const statuses = readRecommendationStatuses();
  return recommendations.map((r) => {
    const saved = statuses[r.id];
    if (!saved?.status) return r;
    return { ...r, status: saved.status, statusUpdatedAt: saved.updatedAt };
  });
}

function buildSummaryFromRecommendations(recommendations) {
  const open = recommendations.filter((r) => r.status === 'open' || r.status === 'needs_verification').length;
  const inProgress = recommendations.filter((r) => r.status === 'in_progress').length;
  const verified = recommendations.filter((r) => r.status === 'verified').length;
  const dismissed = recommendations.filter((r) => r.status === 'dismissed').length;
  return {
    total: recommendations.length,
    open,
    inProgress,
    verified,
    dismissed,
    byPriority: {
      P0: recommendations.filter((r) => r.priority === 'P0').length,
      P1: recommendations.filter((r) => r.priority === 'P1').length,
      P2: recommendations.filter((r) => r.priority === 'P2').length,
      P3: recommendations.filter((r) => r.priority === 'P3').length,
    },
  };
}

function dedupeRecommendations(list) {
  const seen = new Set();
  return list.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

async function runAudit({ force = false, vertex = null } = {}) {
  const profile = companyKnowledge.getProfile();
  const docs = companyKnowledge.listDocuments();
  const docBodies = loadDocumentBodies();
  const combined = corpusText(profile, docBodies);

  const crawl = await crawlPublicSite(profile.websiteUrl);
  const legacyManual = readLegacyManualStatuses();

  let multiPage = { urlsCrawled: 0, pages: [] };
  const fullCrawl = getLatestCompletedCrawl();
  if (fullCrawl?.pages?.length) {
    multiPage = { urlsCrawled: fullCrawl.pages.length, pages: fullCrawl.pages };
  } else if (crawl.origin && crawl.sitemap?.ok && crawl.sitemap?.text) {
    multiPage = await crawlSitePages(crawl.origin, crawl.sitemap.text, { maxPages: 20 });
  } else if (crawl.origin && crawl.homepage?.ok) {
    multiPage = await crawlSitePages(crawl.origin, `<urlset><loc>${crawl.origin}/</loc></urlset>`, {
      maxPages: 8,
    });
  }

  let recommendations = runRules({
    profile,
    crawl,
    combined,
    docCount: docs.length,
    docBodies,
    legacyManual,
  });

  recommendations = recommendations.concat(buildMultiPageRecommendations(multiPage.pages, crawl.origin));
  if (fullCrawl?.pages?.length) {
    recommendations = recommendations.concat(getCrawlRecommendations(fullCrawl.pages, crawl.origin));
  } else if (crawl.origin && !fullCrawl) {
    const { rec } = require('./rules');
    recommendations.push(
      rec({
        id: 'crawl-full-site-recommended',
        category: 'technical_seo',
        confirmationLevel: 'heuristic',
        factors: { impact: 55, severity: 45, confidence: 90, urgency: 40, effort: 30 },
        title: 'Run a full-site crawl for complete URL coverage',
        evidence: [
          'Latest audit used quick sampling only.',
          'Start Crawl Health → Full crawl to analyze hundreds of URLs with budgets and robots compliance.',
        ],
        businessImpact: 'Large sites may hide issues on pages outside the sitemap sample.',
        recommendedAction: 'Open Crawl Health tab → Start full crawl, then re-audit.',
        verificationMethod: 'Crawl job completes with URL count; re-audit merges findings.',
      })
    );
  }

  const google = await collectGoogleAuditEvidence(crawl.origin);
  recommendations = recommendations.concat(google.recommendations || []);

  recommendations = dedupeRecommendations(recommendations).sort((a, b) => b.score - a.score);

  const aiAdds = await enrichWithContentAi(vertex, {
    profile,
    combined,
    existingRecommendations: recommendations,
  });
  recommendations = dedupeRecommendations(recommendations.concat(aiAdds)).sort((a, b) => b.score - a.score);

  const integrationStatus = getIntegrationStatus();

  const audit = {
    id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    runAt: new Date().toISOString(),
    websiteUrl: profile.websiteUrl || null,
    crawlSummary: {
      origin: crawl.origin,
      homepageOk: Boolean(crawl.homepage?.ok),
      homepageStatus: crawl.homepage?.status ?? null,
      robotsDisallowAll: Boolean(crawl.robots?.disallowAll),
      sitemapOk: Boolean(crawl.sitemap?.ok),
      pagesCrawled: multiPage.urlsCrawled || 0,
      fullCrawlJobId: fullCrawl?.id || null,
      fullCrawlAt: fullCrawl?.completedAt || null,
      error: crawl.error || null,
    },
    integrations: integrationStatus,
    googleSnapshot: {
      gsc: google.gsc || null,
      gbp: google.gbp || null,
      indexInspect: google.indexInspect || null,
    },
    recommendations,
  };

  saveAudit(audit);
  return audit;
}

function getAuditWithStatuses() {
  const latest = getLatestAudit();
  if (!latest) return null;
  return {
    ...latest,
    recommendations: mergeRecommendationStatuses(latest.recommendations || []),
    summary: buildSummaryFromRecommendations(mergeRecommendationStatuses(latest.recommendations || [])),
  };
}

module.exports = {
  runAudit,
  getAuditWithStatuses,
  mergeRecommendationStatuses,
  buildSummaryFromRecommendations,
  getLatestAudit,
};
