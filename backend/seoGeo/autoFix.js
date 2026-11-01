const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const FIXES_PATH = path.join(__dirname, '..', 'data', 'company', 'seo-geo-fixes.json');

const WP_URL = process.env.WORDPRESS_SITE_URL || '';
const WP_USER = process.env.WORDPRESS_APP_USER || '';
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD || '';

function ensureDir() {
  const dir = path.dirname(FIXES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFixes() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(FIXES_PATH, 'utf8')).fixes || {};
  } catch {
    return {};
  }
}

function writeFixes(fixes) {
  ensureDir();
  fs.writeFileSync(FIXES_PATH, JSON.stringify({ fixes, updatedAt: new Date().toISOString() }, null, 2));
}

function isWordPressConfigured() {
  return Boolean(WP_URL && WP_USER && WP_PASS);
}

function proposeFix(recommendationId, issueType, context = {}) {
  const fixes = readFixes();
  let draft = null;

  if (issueType === 'missing_title' || recommendationId.includes('title')) {
    draft = {
      field: 'title',
      before: context.before || '',
      after: context.suggestedTitle || `${context.companyName || 'Company'} — ${context.service || 'Services'}`,
    };
  } else if (issueType === 'missing_meta' || recommendationId.includes('meta')) {
    draft = {
      field: 'metaDescription',
      before: context.before || '',
      after:
        context.suggestedMeta ||
        `${context.companyName || 'We'} help customers with ${context.service || 'trusted services'}. Learn more and contact us today.`,
    };
  } else if (issueType === 'json_ld' || recommendationId.includes('structured')) {
    draft = {
      field: 'jsonLd',
      before: null,
      after: JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: context.companyName || 'Company',
          url: context.websiteUrl || '',
          telephone: context.phone || undefined,
          address: context.address || undefined,
        },
        null,
        2
      ),
    };
  } else {
    draft = {
      field: 'manual',
      before: null,
      after: context.note || 'Review recommendation and apply in your CMS manually.',
    };
  }

  const fix = {
    id: `fix-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    recommendationId,
    issueType,
    status: 'proposed',
    draft,
    targetUrl: context.url || null,
    cms: isWordPressConfigured() ? 'wordpress' : null,
    history: [{ at: new Date().toISOString(), action: 'proposed' }],
  };
  fixes[recommendationId] = fix;
  writeFixes(fixes);
  return fix;
}

async function applyWordPressMeta(pageId, { title, metaDescription }) {
  if (!isWordPressConfigured()) throw new Error('WordPress credentials not configured');
  const base = WP_URL.replace(/\/$/, '');
  const auth = { username: WP_USER, password: WP_PASS };
  const payload = {};
  if (title) payload.title = title;
  if (metaDescription) payload.excerpt = metaDescription;
  const { data } = await axios.post(`${base}/wp-json/wp/v2/pages/${pageId}`, payload, { auth, timeout: 20000 });
  return data;
}

async function approveAndApply(recommendationId, { approved = true, pageId } = {}) {
  const fixes = readFixes();
  const fix = fixes[recommendationId];
  if (!fix) throw new Error('No proposed fix — call propose first');
  if (!approved) {
    fix.status = 'rejected';
    fix.history.push({ at: new Date().toISOString(), action: 'rejected' });
    writeFixes(fixes);
    return fix;
  }

  fix.status = 'approved';
  fix.history.push({ at: new Date().toISOString(), action: 'approved' });
  writeFixes(fixes);

  if (fix.cms === 'wordpress' && pageId && fix.draft.field !== 'jsonLd') {
    try {
      const backup = { ...fix.draft };
      await applyWordPressMeta(pageId, {
        title: fix.draft.field === 'title' ? fix.draft.after : undefined,
        metaDescription: fix.draft.field === 'metaDescription' ? fix.draft.after : undefined,
      });
      fix.status = 'applied';
      fix.rollback = backup;
      fix.history.push({ at: new Date().toISOString(), action: 'applied', cms: 'wordpress', pageId });
      writeFixes(fixes);
    } catch (err) {
      fix.status = 'apply_failed';
      fix.error = err.message;
      fix.history.push({ at: new Date().toISOString(), action: 'apply_failed', error: err.message });
      writeFixes(fixes);
      throw err;
    }
  } else {
    fix.status = 'approved_pending_manual';
    fix.history.push({ at: new Date().toISOString(), action: 'approved_manual_required' });
    writeFixes(fixes);
  }

  return fix;
}

function rollback(recommendationId) {
  const fixes = readFixes();
  const fix = fixes[recommendationId];
  if (!fix?.rollback) throw new Error('Nothing to roll back');
  fix.status = 'rolled_back';
  fix.history.push({ at: new Date().toISOString(), action: 'rolled_back', note: 'Restore CMS content from rollback snapshot manually if auto-apply was used.' });
  writeFixes(fixes);
  return fix;
}

function getFix(recommendationId) {
  return readFixes()[recommendationId] || null;
}

function listFixes() {
  return Object.values(readFixes());
}

module.exports = {
  proposeFix,
  approveAndApply,
  rollback,
  getFix,
  listFixes,
  isWordPressConfigured,
};
