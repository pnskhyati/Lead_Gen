/**
 * Google Ads click-to-site landing + UTM capture (Integration step 2).
 */
const path = require('path');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

function getStatus() {
  return {
    landingPath: '/l/ads',
    chatDeepLink: `${FRONTEND_URL}/?ads=1`,
    note: 'Preserve utm_* and gclid on the landing URL; chat sends attribution to lead-agent.',
  };
}

function mountRoutes(app) {
  app.get('/api/ads-landing/config', (_req, res) => {
    res.json({ success: true, data: getStatus() });
  });

  app.get('/l/ads', (req, res) => {
    const params = new URLSearchParams(req.query);
    params.set('ads', '1');
    const target = `${FRONTEND_URL}/?${params.toString()}#chat`;
    res.redirect(302, target);
  });

  app.get('/l/ads/page', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ads-landing.html'));
  });
}

module.exports = { mountRoutes, getStatus, FRONTEND_URL };
