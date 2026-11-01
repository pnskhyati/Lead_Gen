const cron = require('node-cron');

let started = false;

function startSeoGeoScheduler({ vertex } = {}) {
  if (started || process.env.SEO_GEO_SCHEDULER === 'off') return;
  started = true;

  const rankCron = process.env.SEO_GEO_RANK_CRON || '0 6 * * *';
  const citationCron = process.env.SEO_GEO_CITATION_CRON || '0 7 * * *';

  if (cron.validate(rankCron)) {
    cron.schedule(rankCron, () => {
      const rankTracking = require('./rankTracking');
      void rankTracking.syncRankings().catch((err) => console.warn('[SEO/GEO scheduler] rank', err.message));
    });
  }

  if (cron.validate(citationCron)) {
    cron.schedule(citationCron, () => {
      const citationMonitor = require('./citationMonitor');
      if (!vertex) return;
      void citationMonitor.runAllCitationTests(vertex).catch((err) => console.warn('[SEO/GEO scheduler] geo', err.message));
    });
  }

  console.log('[SEO/GEO] scheduler active (rank + citation jobs)');
}

module.exports = { startSeoGeoScheduler };
