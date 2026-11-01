/**
 * SEO / GEO API — audit engine, recommendations, legacy report adapter.
 */
const {
  runAudit,
  getAuditWithStatuses,
  buildSummaryFromRecommendations,
  mergeRecommendationStatuses,
} = require('./seoGeo/auditEngine');
const { listAuditHistory, setRecommendationStatus, readLegacyManualStatuses } = require('./seoGeo/store');
const { getLegacyReport } = require('./seoGeo/legacyReport');
const googleIntegrations = require('./seoGeo/googleIntegrations');
const crawlJob = require('./seoGeo/crawlJob');
const rankTracking = require('./seoGeo/rankTracking');
const citationMonitor = require('./seoGeo/citationMonitor');
const autoFix = require('./seoGeo/autoFix');
const { startSeoGeoScheduler } = require('./seoGeo/scheduler');

const VALID_REC_STATUS = new Set(['open', 'in_progress', 'needs_verification', 'verified', 'dismissed']);

function mountRoutes(app, { requireAuth, vertex } = {}) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();
  startSeoGeoScheduler({ vertex });

  app.get('/api/seo-geo/vertex-status', guard, (_req, res) => {
    const status = vertex?.getStatus ? vertex.getStatus() : { configured: false, mode: 'unconfigured' };
    res.json({ success: true, data: status });
  });

  app.get('/api/seo-geo/integrations', guard, (_req, res) => {
    res.json({ success: true, data: googleIntegrations.getIntegrationStatus() });
  });

  app.get('/api/seo-geo/oauth/start', guard, (_req, res) => {
    try {
      const data = googleIntegrations.startOAuth();
      res.json({ success: true, data });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/seo-geo/oauth/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;
      if (error) {
        return res.redirect(`${googleIntegrations.FRONTEND_URL}/?seoGeoError=${encodeURIComponent(String(error))}`);
      }
      await googleIntegrations.handleOAuthCallback(String(code || ''), String(state || ''));
      res.redirect(`${googleIntegrations.FRONTEND_URL}/?seoGeoConnected=1`);
    } catch (err) {
      res.redirect(
        `${googleIntegrations.FRONTEND_URL}/?seoGeoError=${encodeURIComponent(err.message || 'oauth_failed')}`
      );
    }
  });

  app.post('/api/seo-geo/oauth/disconnect', guard, (_req, res) => {
    googleIntegrations.disconnectGoogle();
    res.json({ success: true });
  });

  app.post('/api/seo-geo/audit', guard, async (_req, res) => {
    try {
      const audit = await runAudit({ force: true, vertex });
      const withStatus = {
        ...audit,
        recommendations: mergeRecommendationStatuses(audit.recommendations),
        summary: buildSummaryFromRecommendations(mergeRecommendationStatuses(audit.recommendations)),
      };
      res.json({ success: true, data: withStatus });
    } catch (err) {
      console.error('[SEO/GEO] audit', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/seo-geo/audit', guard, async (req, res) => {
    try {
      let audit = getAuditWithStatuses();
      if (!audit && req.query.run !== '0') {
        const fresh = await runAudit({ vertex });
        audit = {
          ...fresh,
          recommendations: mergeRecommendationStatuses(fresh.recommendations),
          summary: buildSummaryFromRecommendations(mergeRecommendationStatuses(fresh.recommendations)),
        };
      }
      if (!audit) {
        return res.status(404).json({ success: false, error: 'No audit yet. POST /api/seo-geo/audit to run one.' });
      }
      res.json({ success: true, data: audit });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/seo-geo/audit/history', guard, (_req, res) => {
    res.json({ success: true, data: listAuditHistory(15) });
  });

  app.get('/api/seo-geo/recommendations', guard, async (req, res) => {
    try {
      let audit = getAuditWithStatuses();
      if (!audit) {
        const fresh = await runAudit({ vertex });
        audit = getAuditWithStatuses() || fresh;
      }
      let recs = mergeRecommendationStatuses(audit.recommendations || []);
      const category = req.query.category;
      const priority = req.query.priority;
      const status = req.query.status;
      if (category) recs = recs.filter((r) => r.category === category);
      if (priority) recs = recs.filter((r) => r.priority === priority);
      if (status) recs = recs.filter((r) => r.status === status);
      recs = recs.sort((a, b) => b.score - a.score);
      res.json({
        success: true,
        data: {
          auditId: audit.id,
          runAt: audit.runAt,
          crawlSummary: audit.crawlSummary,
          integrations: audit.integrations,
          recommendations: recs,
          summary: buildSummaryFromRecommendations(mergeRecommendationStatuses(audit.recommendations || [])),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/seo-geo/recommendations/:id', guard, (req, res) => {
    try {
      const status = String(req.body?.status || '').trim();
      if (!VALID_REC_STATUS.has(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      setRecommendationStatus(req.params.id, status);
      const audit = getAuditWithStatuses();
      res.json({ success: true, data: audit });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/seo-geo/report', guard, async (_req, res) => {
    try {
      if (!getAuditWithStatuses()) {
        await runAudit({ vertex });
      }
      res.json({ success: true, data: getLegacyReport() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Legacy manual check overrides (GBP / reviews)
  app.put('/api/seo-geo/checks/:id', guard, (req, res) => {
    try {
      const checkId = req.params.id;
      if (!['gbp', 'reviews'].includes(checkId)) {
        return res.status(400).json({ success: false, error: 'Use recommendation workflow for this check' });
      }
      const status = String(req.body?.status || '').trim();
      const map = {
        passed: 'verified',
        needs_attention: 'open',
        not_checked: 'needs_verification',
      };
      const recId = checkId === 'gbp' ? 'local-gbp-not-linked' : 'local-review-cadence';
      const fs = require('fs');
      const path = require('path');
      const LEGACY_MANUAL = path.join(__dirname, 'data', 'company', 'seo-geo.json');
      const raw = fs.existsSync(LEGACY_MANUAL) ? JSON.parse(fs.readFileSync(LEGACY_MANUAL, 'utf8')) : {};
      raw.manualStatuses = { ...(raw.manualStatuses || {}), [checkId]: status };
      raw.updatedAt = new Date().toISOString();
      fs.mkdirSync(path.dirname(LEGACY_MANUAL), { recursive: true });
      fs.writeFileSync(LEGACY_MANUAL, JSON.stringify(raw, null, 2));

      if (map[status]) {
        setRecommendationStatus(recId, map[status]);
      }
      res.json({ success: true, data: getLegacyReport() });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/seo-geo/crawl/start', guard, (req, res) => {
    try {
      const job = crawlJob.startCrawlJob({ maxUrls: req.body?.maxUrls });
      res.json({ success: true, data: job });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/seo-geo/crawl/jobs', guard, (_req, res) => {
    res.json({ success: true, data: crawlJob.listCrawlJobs() });
  });

  app.get('/api/seo-geo/crawl/latest', guard, (_req, res) => {
    const job = crawlJob.getLatestCompletedCrawl();
    if (!job) return res.status(404).json({ success: false, error: 'No completed crawl yet' });
    res.json({ success: true, data: job });
  });

  app.get('/api/seo-geo/crawl/:id', guard, (req, res) => {
    const job = crawlJob.getCrawlJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, data: job });
  });

  app.get('/api/seo-geo/keywords', guard, (_req, res) => {
    res.json({ success: true, data: rankTracking.readKeywords() });
  });

  app.post('/api/seo-geo/keywords', guard, (req, res) => {
    try {
      const kw = rankTracking.addKeyword(req.body || {});
      res.json({ success: true, data: kw });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/seo-geo/keywords/:id', guard, (req, res) => {
    rankTracking.deleteKeyword(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/seo-geo/rankings/sync', guard, async (_req, res) => {
    try {
      const data = await rankTracking.syncRankings();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/seo-geo/rankings/dashboard', guard, (_req, res) => {
    res.json({
      success: true,
      data: {
        serpApiConfigured: rankTracking.SERP_API_KEY,
        rows: rankTracking.getRankDashboard(),
      },
    });
  });

  app.get('/api/seo-geo/citations/prompts', guard, (_req, res) => {
    res.json({ success: true, data: citationMonitor.readPrompts() });
  });

  app.post('/api/seo-geo/citations/prompts', guard, (req, res) => {
    try {
      const p = citationMonitor.addPrompt(req.body?.prompt);
      res.json({ success: true, data: p });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/seo-geo/citations/prompts/:id', guard, (req, res) => {
    citationMonitor.deletePrompt(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/seo-geo/citations/run', guard, async (_req, res) => {
    try {
      const data = await citationMonitor.runAllCitationTests(vertex);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/seo-geo/citations/dashboard', guard, (_req, res) => {
    res.json({ success: true, data: citationMonitor.getCitationDashboard() });
  });

  app.get('/api/seo-geo/fixes', guard, (_req, res) => {
    res.json({ success: true, data: { fixes: autoFix.listFixes(), wordpress: autoFix.isWordPressConfigured() } });
  });

  app.get('/api/seo-geo/fixes/:recommendationId', guard, (req, res) => {
    const fix = autoFix.getFix(req.params.recommendationId);
    if (!fix) return res.status(404).json({ success: false, error: 'No fix' });
    res.json({ success: true, data: fix });
  });

  app.post('/api/seo-geo/fixes/propose', guard, (req, res) => {
    try {
      const { recommendationId, issueType, context } = req.body || {};
      const fix = autoFix.proposeFix(recommendationId, issueType || 'generic', context || {});
      res.json({ success: true, data: fix });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/seo-geo/fixes/:recommendationId/approve', guard, async (req, res) => {
    try {
      const fix = await autoFix.approveAndApply(req.params.recommendationId, req.body || {});
      res.json({ success: true, data: fix });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/seo-geo/fixes/:recommendationId/rollback', guard, (req, res) => {
    try {
      const fix = autoFix.rollback(req.params.recommendationId);
      res.json({ success: true, data: fix });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/seo-geo/migrate-legacy', guard, (req, res) => {
    try {
      const checklist = req.body?.checklist || {};
      const raw = require('fs');
      const path = require('path');
      const LEGACY_MANUAL = path.join(__dirname, 'data', 'company', 'seo-geo.json');
      const existing = raw.existsSync(LEGACY_MANUAL) ? JSON.parse(raw.readFileSync(LEGACY_MANUAL, 'utf8')) : {};
      existing.manualStatuses = existing.manualStatuses || {};
      for (const [id, checked] of Object.entries(checklist)) {
        if (checked && (id === 'gbp' || id === 'reviews')) {
          existing.manualStatuses[id] = 'passed';
          setRecommendationStatus(
            id === 'gbp' ? 'local-gbp-not-linked' : 'local-review-cadence',
            'verified'
          );
        }
      }
      existing.legacyMigrated = true;
      raw.mkdirSync(path.dirname(LEGACY_MANUAL), { recursive: true });
      raw.writeFileSync(LEGACY_MANUAL, JSON.stringify(existing, null, 2));
      res.json({ success: true, data: getLegacyReport() });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  mountRoutes,
  runAudit,
  getAuditWithStatuses,
};
