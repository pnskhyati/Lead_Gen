/**
 * HTTP API for the content planner. Mounted at /api/social/*.
 * Members can create and edit drafts; approving, publishing and managing competitors is admin-only.
 */
const multer = require('multer');
const R = require('./platformRules');
const T = require('./timeUtil');
const store = require('./postStore');
const generator = require('./generator');
const competitors = require('./competitors');
const connections = require('./connections');
const jobs = require('./jobs');
const importSheet = require('./importSheet');
const brandStyle = require('./brandStyle');
const postFormats = require('./postFormats');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DAYS = 30;
const DEFAULT_TZ = 'Asia/Kolkata';

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/** Identify an image by its bytes, not its filename or declared type. */
function sniffImage(buf) {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/** Shape a stored post for the client (no internal lease fields) with its current problems. */
function present(post, connected, now = Date.now()) {
  const { leaseUntil, ...rest } = post;
  return {
    ...rest,
    previewUrl: post.image?.file ? `/api/social/media/${post.image.file}` : null,
    finalLength: R.finalText(post).length,
    maxLength: R.rulesFor(post.platform)?.maxChars ?? null,
    issues: ['draft', 'failed', 'missed'].includes(post.status) ? R.validatePost(post, { connected, now }) : [],
  };
}

function mountRoutes(app, { vertex, requireAuth, requireAdmin, aiLimiter, worker, linkedinAccountExists, imageGenerator, analytics = require('./analytics').createDefault() }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();
  const admin = typeof requireAdmin === 'function' ? requireAdmin : (_r, _s, n) => n();
  const limit = typeof aiLimiter === 'function' ? aiLimiter : (_r, _s, n) => n();
  const ws = (req) => req.appUser?.workspaceId || 'default';

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single('file');
  const uploadMw = (req, res, next) =>
    upload(req, res, (err) => {
      if (!err) return next();
      res.status(400).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'Images must be 8MB or smaller' : err.message });
    });

  const sheetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: importSheet.MAX_BYTES, files: 1 } }).single('file');
  const sheetMw = (req, res, next) =>
    sheetUpload(req, res, (err) => {
      if (!err) return next();
      res.status(400).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 2MB.' : err.message });
    });

  const ok = (res, data) => res.json({ success: true, data });
  const fail = (res, status, error, extra = {}) => res.status(status).json({ success: false, error, ...extra });
  const getConnectionMap = async (req) => connections.connectedMap(await connections.getConnections({ linkedinAccountExists }, ws(req)));

  function timeZoneFor(req, campaign) {
    const tz = campaign?.timezone || store.getSettings(ws(req)).timezone || DEFAULT_TZ;
    return T.isValidTimeZone(tz) ? tz : DEFAULT_TZ;
  }

  // ------------------------------------------------------------------ settings + connections
  app.get('/api/social/connections', guard, async (req, res) => {
    ok(res, await connections.getConnections({ linkedinAccountExists }, ws(req)));
  });

  app.get('/api/social/settings', guard, (req, res) => {
    const s = store.getSettings(ws(req));
    ok(res, { timezone: s.timezone || DEFAULT_TZ, defaultPlatforms: s.defaultPlatforms || [] });
  });

  app.put('/api/social/settings', guard, admin, async (req, res) => {
    const patch = {};
    if (req.body?.timezone !== undefined) {
      if (!T.isValidTimeZone(req.body.timezone)) return fail(res, 400, 'Unknown time zone');
      patch.timezone = req.body.timezone;
    }
    if (Array.isArray(req.body?.defaultPlatforms)) patch.defaultPlatforms = req.body.defaultPlatforms.map(R.normalize).filter(R.isSupported);
    ok(res, await store.saveSettings(patch, ws(req)));
  });

  // ------------------------------------------------------------------ how posts are written, per platform
  app.get('/api/social/post-style', guard, (req, res) => {
    const saved = store.getSettings(ws(req)).postPrefs;
    ok(res, { catalog: postFormats.catalog(), prefs: postFormats.sanitizePrefs(saved), saved: Boolean(saved) });
  });

  app.put('/api/social/post-style', guard, admin, async (req, res) => {
    const current = postFormats.sanitizePrefs(store.getSettings(ws(req)).postPrefs);
    const postPrefs = postFormats.sanitizePrefs(req.body?.prefs, current);
    await store.saveSettings({ postPrefs }, ws(req));
    ok(res, { prefs: postPrefs });
  });

  app.post('/api/social/post-style/suggest', guard, limit, async (req, res) => {
    const platforms = [...new Set((Array.isArray(req.body?.platforms) ? req.body.platforms : []).map(R.normalize))].filter(R.isSupported);
    if (!platforms.length) return fail(res, 400, 'Choose at least one platform.');
    const ctx = await generator.gatherContext('', ws(req));
    ok(res, await postFormats.suggest(vertex, { brand: `${ctx.brand}
Known facts:
${ctx.facts}`, platforms }));
  });

  // ------------------------------------------------------------------ plan generation (one prompt -> calendar)
  app.post('/api/social/plan', guard, limit, (req, res) => {
    if (!vertex?.generateJson) return fail(res, 503, 'AI is not configured');
    const b = req.body || {};
    const prompt = clip(b.prompt, 2000);
    if (prompt.length < 8) return fail(res, 400, 'Describe what the posts should be about (a sentence or two).');
    const days = Math.round(Number(b.days));
    if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) return fail(res, 400, `Choose between 1 and ${MAX_DAYS} days.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate || ''))) return fail(res, 400, 'Choose a start date.');
    const platforms = [...new Set((Array.isArray(b.platforms) ? b.platforms : []).map(R.normalize))].filter(R.isSupported);
    if (!platforms.length) return fail(res, 400, 'Choose at least one platform.');
    const timezone = T.isValidTimeZone(b.timezone) ? b.timezone : timeZoneFor(req);
    const intensity = ['light', 'standard', 'heavy'].includes(b.intensity) ? b.intensity : 'standard';
    const workspace = ws(req);
    const createdBy = req.appUser?.email || null;
    const postPrefs = b.postStyle ? postFormats.sanitizePrefs(b.postStyle, postFormats.sanitizePrefs(store.getSettings(workspace).postPrefs)) : null;
    // An owner's choices become the new defaults; a team member's apply to this plan only.
    if (postPrefs && req.appUser?.role === 'admin') void store.saveSettings({ postPrefs }, workspace);

    const { job, joined } = jobs.start(workspace, 'plan', (setProgress) =>
      require('../workspaceContext').run(workspace, () =>
        generator.generatePlan(
          { vertex, imageGenerator, prompt, startDate: b.startDate, days, platforms, timezone, intensity, createdBy, postPrefs, onProgress: setProgress },
          workspace
        )
      )
    );
    // Remember the owner's time zone so the next plan starts with it.
    void store.saveSettings({ timezone }, workspace);
    res.status(202).json({ success: true, data: { ...job, joined } });
  });

  app.get('/api/social/plan/:jobId', guard, (req, res) => {
    const job = jobs.get(req.params.jobId, ws(req));
    if (!job) return fail(res, 404, 'That plan is no longer being tracked. Open it from your campaigns.');
    ok(res, job);
  });

  // ------------------------------------------------------------------ import your own calendar (.xlsx / .csv)
  app.get('/api/social/import/template.csv', guard, (_req, res) => {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="content-calendar-template.csv"');
    res.send(`\uFEFF${importSheet.templateCsv()}`);
  });

  app.get('/api/social/import/template.xlsx', guard, async (_req, res) => {
    try {
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', 'attachment; filename="content-calendar-template.xlsx"');
      res.send(await importSheet.templateXlsx());
    } catch (err) {
      fail(res, 500, err.message);
    }
  });

  // Read the file and show what we understood. Nothing is saved yet.
  app.post('/api/social/import/preview', guard, limit, sheetMw, async (req, res) => {
    try {
      if (!req.file) return fail(res, 400, 'Choose a spreadsheet to upload.');
      ok(res, await importSheet.parseCalendarFile({ buffer: req.file.buffer, filename: req.file.originalname }));
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  // Build the calendar from the (possibly edited) preview rows. Rows are re-validated here, never trusted.
  app.post('/api/social/import/create', guard, limit, (req, res) => {
    if (!vertex?.generateJson) return fail(res, 503, 'AI is not configured');
    const b = req.body || {};
    if (!Array.isArray(b.rows) || !b.rows.length) return fail(res, 400, 'There are no rows to import.');
    if (b.rows.length > importSheet.MAX_ROWS) return fail(res, 400, `At most ${importSheet.MAX_ROWS} rows can be imported at once.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate || ''))) return fail(res, 400, 'Choose a start date.');
    const timezone = T.isValidTimeZone(b.timezone) ? b.timezone : timeZoneFor(req);
    const platforms = [...new Set((Array.isArray(b.platforms) ? b.platforms : []).map(R.normalize))].filter(R.isSupported);
    const rows = b.rows.map((r, i) => importSheet.validateRow({ ...r, errors: [], warnings: [] }, r?.row ?? i + 2));
    const bad = rows.find((r) => r.errors.length);
    if (bad) return fail(res, 400, `Row ${bad.row}: ${bad.errors[0]}`);
    const workspace = ws(req);
    const createdBy = req.appUser?.email || null;
    const filename = clip(b.filename, 80) || 'spreadsheet';
    const { job, joined } = jobs.start(workspace, 'plan', (setProgress) =>
      require('../workspaceContext').run(workspace, () =>
        generator.generateFromRows({ vertex, imageGenerator, rows, platforms, startDate: b.startDate, timezone, filename, createdBy, onProgress: setProgress }, workspace)
      )
    );
    void store.saveSettings({ timezone }, workspace);
    res.status(202).json({ success: true, data: { ...job, joined } });
  });

  // ------------------------------------------------------------------ campaigns + calendar
  app.get('/api/social/campaigns', guard, (req, res) => ok(res, store.listCampaigns(ws(req))));

  app.get('/api/social/campaigns/:id', guard, async (req, res) => {
    const campaign = store.getCampaign(req.params.id, ws(req));
    if (!campaign) return fail(res, 404, 'Campaign not found');
    const connected = await getConnectionMap(req);
    ok(res, { campaign, posts: store.listPosts({ campaignId: campaign.id }, ws(req)).map((p) => present(p, connected)), connections: connected });
  });

  app.get('/api/social/calendar', guard, async (req, res) => {
    const connected = await getConnectionMap(req);
    const posts = store.listPosts({ from: req.query.from ? String(req.query.from) : undefined, to: req.query.to ? String(req.query.to) : undefined, campaignId: req.query.campaignId ? String(req.query.campaignId) : undefined }, ws(req));
    ok(res, { posts: posts.map((p) => present(p, connected)), connections: connected, timezone: timeZoneFor(req) });
  });

  app.get('/api/social/overview', guard, (req, res) => {
    const posts = store.listPosts({}, ws(req));
    const now = new Date().toISOString();
    const upcoming = posts.filter((p) => p.status === 'approved' && p.scheduledAt >= now);
    ok(res, {
      counts: Object.fromEntries(store.STATUSES.map((s) => [s, posts.filter((p) => p.status === s).length])),
      next: upcoming[0] ? { id: upcoming[0].id, platform: upcoming[0].platform, scheduledAt: upcoming[0].scheduledAt, topic: upcoming[0].topic } : null,
      needsAttention: posts.filter((p) => ['failed', 'missed'].includes(p.status)).length,
    });
  });

  // ------------------------------------------------------------------ how published posts are doing (read from the platforms)
  app.get('/api/social/analytics', guard, (req, res) => ok(res, analytics.summary(ws(req))));

  app.post('/api/social/analytics/refresh', guard, limit, async (req, res) => {
    try {
      const result = await analytics.refresh(ws(req), { force: req.body?.force === true });
      ok(res, { ...result, ...analytics.summary(ws(req)) });
    } catch (err) {
      fail(res, 500, err.message);
    }
  });

  // ------------------------------------------------------------------ editing posts
  app.patch('/api/social/posts/:id', guard, async (req, res) => {
    try {
      const post = store.getPost(req.params.id, ws(req));
      if (!post) return fail(res, 404, 'Post not found');
      const b = req.body || {};
      const patch = { userEdited: true };
      if (b.text !== undefined) patch.text = clip(b.text, 6000);
      if (b.hashtags !== undefined) {
        if (!Array.isArray(b.hashtags)) return fail(res, 400, 'hashtags must be a list');
        patch.hashtags = b.hashtags.map((t) => clip(String(t).replace(/^#+/, '').replace(/\s+/g, ''), 60)).filter(Boolean).slice(0, 30);
      }
      if (b.imagePrompt !== undefined) patch.imagePrompt = clip(b.imagePrompt, 600);
      if (b.scheduledAt !== undefined || (b.date && b.time)) {
        const campaign = store.getCampaign(post.campaignId, ws(req));
        const tz = timeZoneFor(req, campaign);
        const iso = b.scheduledAt ? new Date(b.scheduledAt).toISOString() : T.zonedToUtc(String(b.date), String(b.time), tz);
        if (Number.isNaN(new Date(iso).getTime())) return fail(res, 400, 'That date and time is not valid.');
        patch.scheduledAt = iso;
        patch.dayKey = T.localDayKey(iso, tz);
      }
      const updated = await store.updatePost(post.id, patch, ws(req));
      ok(res, present(updated, await getConnectionMap(req)));
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  app.delete('/api/social/posts/:id', guard, async (req, res) => {
    try {
      if (!(await store.deletePost(req.params.id, ws(req)))) return fail(res, 404, 'Post not found');
      ok(res, { deleted: true });
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  app.post('/api/social/posts/:id/regenerate', guard, limit, async (req, res) => {
    if (!vertex?.generateJson) return fail(res, 503, 'AI is not configured');
    try {
      const scope = ['text', 'image', 'both'].includes(req.body?.scope) ? req.body.scope : 'text';
      const updated = await generator.regeneratePost(
        { vertex, imageGenerator, postId: req.params.id, instruction: clip(req.body?.instruction, 400), scope, imagePrompt: req.body?.imagePrompt },
        ws(req)
      );
      ok(res, present(updated, await getConnectionMap(req)));
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  // ------------------------------------------------------------------ images
  app.post('/api/social/posts/:id/image', guard, uploadMw, async (req, res) => {
    try {
      const post = store.getPost(req.params.id, ws(req));
      if (!post) return fail(res, 404, 'Post not found');
      if (!req.file) return fail(res, 400, 'Attach an image file.');
      const mime = sniffImage(req.file.buffer);
      if (!mime) return fail(res, 400, 'That file is not a PNG, JPEG or WebP image.');
      const image = store.saveImage({ buffer: req.file.buffer, mime, source: 'uploaded' }, ws(req));
      const updated = await store.updatePost(post.id, { image, imageStatus: 'ready', imageError: null, userEdited: true }, ws(req));
      ok(res, present(updated, await getConnectionMap(req)));
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  // "Use this picture on that day": applies to every post of the day, or to one post.
  app.post('/api/social/campaigns/:id/day-image', guard, uploadMw, async (req, res) => {
    try {
      const campaign = store.getCampaign(req.params.id, ws(req));
      if (!campaign) return fail(res, 404, 'Campaign not found');
      const dayKey = clip(req.body?.date, 10);
      const postId = clip(req.body?.postId, 80) || undefined;
      if (!postId && !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return fail(res, 400, 'Choose the day this image is for.');
      if (!req.file) return fail(res, 400, 'Attach an image file.');
      const mime = sniffImage(req.file.buffer);
      if (!mime) return fail(res, 400, 'That file is not a PNG, JPEG or WebP image.');
      const image = store.saveImage({ buffer: req.file.buffer, mime, source: 'uploaded' }, ws(req));
      const ids = await generator.applyImageToDay({ campaignId: campaign.id, dayKey, postId, image }, ws(req));
      if (!ids.length) return fail(res, 404, 'There are no editable posts on that day.');
      ok(res, { updated: ids });
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  // Create any missing images for a campaign in one go (e.g. after the image model hit its rate limit).
  app.post('/api/social/campaigns/:id/images/retry', guard, limit, (req, res) => {
    const campaign = store.getCampaign(req.params.id, ws(req));
    if (!campaign) return fail(res, 404, 'Campaign not found');
    const workspace = ws(req);
    const { job, joined } = jobs.start(workspace, `images:${campaign.id}`, (setProgress) =>
      require('../workspaceContext').run(workspace, () => generator.fillMissingImages({ vertex, imageGenerator, campaignId: campaign.id, onProgress: setProgress }, workspace))
    );
    res.status(202).json({ success: true, data: { ...job, joined } });
  });

  app.get('/api/social/media/:file', guard, (req, res) => {
    const p = store.imagePath(req.params.file, ws(req));
    if (!p) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(p);
  });

  // ------------------------------------------------------------------ brand style (learn the look from their own posts)
  const brandUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: brandStyle.MAX_IMAGES } }).array('files', brandStyle.MAX_IMAGES);
  const brandMw = (req, res, next) =>
    brandUpload(req, res, (err) => {
      if (!err) return next();
      res.status(400).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5MB or smaller' : err.code === 'LIMIT_UNEXPECTED_FILE' ? `Upload up to ${brandStyle.MAX_IMAGES} images at a time` : err.message });
    });
  const brandFail = (res, err) => fail(res, err.status || 500, err.status ? err.message : 'Could not read the style. Try again.');

  app.get('/api/social/brand-style', guard, (req, res) => ok(res, brandStyle.view(ws(req))));

  app.post('/api/social/brand-style/images', guard, admin, brandMw, (req, res) => {
    const files = (req.files || [])
      .map((f) => ({ buffer: f.buffer, mime: sniffImage(f.buffer) }))
      .filter((f) => f.mime);
    if (!files.length) return fail(res, 400, 'Choose PNG, JPG or WebP images of your previous posts.');
    try {
      const r = brandStyle.addImages(files, ws(req));
      ok(res, { ...brandStyle.view(ws(req)), ...r, rejected: (req.files || []).length - files.length });
    } catch (err) {
      brandFail(res, err);
    }
  });

  app.delete('/api/social/brand-style/images/:id', guard, admin, (req, res) => {
    if (!brandStyle.removeImage(String(req.params.id), ws(req))) return fail(res, 404, 'That image is not in your examples.');
    ok(res, brandStyle.view(ws(req)));
  });

  app.post('/api/social/brand-style/analyze', guard, admin, limit, async (req, res) => {
    try {
      ok(res, await brandStyle.analyze(vertex, ws(req)));
    } catch (err) {
      console.error('[BrandStyle] analyze failed:', err.message);
      brandFail(res, err);
    }
  });

  app.put('/api/social/brand-style', guard, admin, (req, res) => ok(res, brandStyle.setOptions({ enabled: req.body?.enabled, overlay: req.body?.overlay }, ws(req))));

  // ------------------------------------------------------------------ approval + publishing (admin)
  async function approve(req, res, ids) {
    const workspace = ws(req);
    const connected = await getConnectionMap(req);
    const targets = ids.map((id) => store.getPost(id, workspace)).filter(Boolean).filter((p) => ['draft', 'failed', 'missed'].includes(p.status));
    if (!targets.length) return fail(res, 404, 'There is nothing to approve.');
    const problems = targets.map((p) => ({ postId: p.id, platform: p.platform, dayKey: p.dayKey, issues: R.validatePost(p, { connected }).filter((i) => i.severity === 'error') })).filter((x) => x.issues.length);
    const onlyValid = req.body?.onlyValid === true;
    if (problems.length && !onlyValid) {
      return fail(res, 422, `${problems.length} post${problems.length === 1 ? '' : 's'} cannot be approved yet.`, { problems });
    }
    const bad = new Set(problems.map((p) => p.postId));
    const approved = await store.approvePosts(targets.filter((p) => !bad.has(p.id)).map((p) => p.id), workspace);
    ok(res, { approved, skipped: problems });
  }

  app.post('/api/social/posts/:id/approve', guard, admin, (req, res) => approve(req, res, [req.params.id]).catch((e) => fail(res, 400, e.message)));

  app.post('/api/social/campaigns/:id/approve', guard, admin, (req, res) => {
    const posts = store.listPosts({ campaignId: req.params.id }, ws(req));
    if (!posts.length) return fail(res, 404, 'Campaign not found');
    return approve(req, res, posts.map((p) => p.id)).catch((e) => fail(res, 400, e.message));
  });

  app.post('/api/social/posts/:id/unapprove', guard, admin, async (req, res) => {
    try {
      const post = await store.setStatus(req.params.id, 'draft', { approvedAt: null }, ws(req));
      if (!post) return fail(res, 404, 'Post not found');
      ok(res, present(post, await getConnectionMap(req)));
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  app.post('/api/social/posts/:id/publish-now', guard, admin, async (req, res) => {
    try {
      const workspace = ws(req);
      const post = store.getPost(req.params.id, workspace);
      if (!post) return fail(res, 404, 'Post not found');
      if (post.status === 'draft') {
        const connected = await getConnectionMap(req);
        const errors = R.validatePost({ ...post, scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString() }, { connected }).filter((i) => i.severity === 'error');
        if (errors.length) return fail(res, 422, errors[0].message, { problems: [{ postId: post.id, issues: errors }] });
        await store.approvePosts([post.id], workspace);
      }
      const result = await worker.publishNow(post.id, workspace);
      const after = store.getPost(post.id, workspace);
      ok(res, { ...result, post: present(after, await getConnectionMap(req)) });
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  // ------------------------------------------------------------------ competitors
  app.get('/api/social/competitors', guard, (req, res) => {
    ok(res, { competitors: competitors.getCompetitors(ws(req)), insights: competitors.getInsights(ws(req)), needsRefresh: competitors.needsRefresh(ws(req)), max: competitors.MAX_COMPETITORS });
  });

  app.put('/api/social/competitors', guard, admin, async (req, res) => {
    try {
      ok(res, await competitors.setCompetitors(req.body?.competitors, ws(req)));
    } catch (err) {
      fail(res, 400, err.message);
    }
  });

  app.post('/api/social/competitors/analyze', guard, admin, limit, (req, res) => {
    if (!vertex?.generateJson) return fail(res, 503, 'AI is not configured');
    if (!competitors.getCompetitors(ws(req)).length) return fail(res, 400, 'Add at least one competitor first.');
    const workspace = ws(req);
    const { job } = jobs.start(workspace, 'competitors', () => require('../workspaceContext').run(workspace, () => competitors.analyze(vertex, workspace)));
    res.status(202).json({ success: true, data: job });
  });

  app.get('/api/social/competitors/analyze/:jobId', guard, (req, res) => {
    const job = jobs.get(req.params.jobId, ws(req));
    if (!job) return fail(res, 404, 'Not found');
    ok(res, job);
  });
}

module.exports = { mountRoutes, sniffImage, present };
