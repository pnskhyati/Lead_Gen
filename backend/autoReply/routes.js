const store = require('./store');

function mountRoutes(app, { engine, requireAuth, requireAdmin }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();
  const admin = typeof requireAdmin === 'function' ? requireAdmin : (_r, _s, n) => n();
  const ws = (req) => req.appUser?.workspaceId;
  const fail = (res, err, code = 400) => res.status(code).json({ success: false, error: err.message || String(err) });

  app.get('/api/auto-reply/status', guard, (req, res) => {
    res.json({ success: true, data: engine.status(ws(req)) });
  });

  app.put('/api/auto-reply/settings', guard, admin, (req, res) => {
    store.setSettings({ channels: req.body?.channels, dailyCap: req.body?.dailyCap }, ws(req));
    res.json({ success: true, data: engine.status(ws(req)) });
  });

  app.get('/api/auto-reply/items', guard, (req, res) => {
    const wanted = String(req.query.status || '');
    const items = (store.read(ws(req)).items || []).filter((i) => !wanted || wanted.split(',').includes(i.status));
    res.json({ success: true, data: items.slice(0, 100) });
  });

  app.post('/api/auto-reply/items/:id/approve', guard, admin, async (req, res) => {
    try {
      const item = await engine.approve(ws(req), req.params.id, typeof req.body?.text === 'string' ? req.body.text : undefined);
      res.json({ success: true, data: item });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/auto-reply/items/:id/dismiss', guard, admin, (req, res) => {
    try {
      res.json({ success: true, data: engine.dismiss(ws(req), req.params.id) });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/auto-reply/run', guard, admin, async (req, res) => {
    try {
      const result = await engine.runWorkspace(ws(req));
      res.json({ success: true, data: { result, status: engine.status(ws(req)) } });
    } catch (err) {
      fail(res, err, 500);
    }
  });
}

module.exports = { mountRoutes };
