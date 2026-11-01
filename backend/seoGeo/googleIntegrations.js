/**
 * Google Search Console + Business Profile OAuth and read-only sync for SEO/GEO audits.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');
const { rec } = require('./rules');

const STORE_PATH = path.join(__dirname, '..', 'data', 'company', 'seo-geo-google.json');
const PENDING_PATH = path.join(__dirname, '..', 'data', 'company', 'seo-geo-oauth-pending.json');

const CLIENT_ID = process.env.GOOGLE_SEO_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_SEO_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || '';
const REDIRECT_URI =
  process.env.GOOGLE_SEO_OAUTH_REDIRECT_URI ||
  `http://localhost:${process.env.PORT || 4000}/api/seo-geo/oauth/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/business.manage',
  'openid',
  'email',
  'profile',
];

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore() {
  ensureDir();
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return { connected: false, refreshToken: null, email: null, gsc: {}, gbp: {}, updatedAt: null };
    }
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { connected: false, refreshToken: null, email: null, gsc: {}, gbp: {}, updatedAt: null };
  }
}

function writeStore(data) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
}

function isOAuthConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function getIntegrationStatus() {
  const s = readStore();
  return {
    oauthConfigured: isOAuthConfigured(),
    connected: Boolean(s.refreshToken),
    email: s.email || null,
    googleSearchConsole: {
      connected: Boolean(s.refreshToken && s.gsc?.siteUrl),
      siteUrl: s.gsc?.siteUrl || null,
      lastSyncAt: s.gsc?.lastSyncAt || null,
      note: s.refreshToken
        ? s.gsc?.siteUrl
          ? 'Property linked from Search Console.'
          : 'Connected — re-audit to match site property.'
        : isOAuthConfigured()
          ? 'Connect Google to pull indexing and search data.'
          : 'Set GOOGLE_SEO_CLIENT_ID and GOOGLE_SEO_CLIENT_SECRET on the server.',
    },
    googleBusinessProfile: {
      connected: Boolean(s.refreshToken && s.gbp?.locationName),
      locationTitle: s.gbp?.title || null,
      lastSyncAt: s.gbp?.lastSyncAt || null,
      note: s.refreshToken
        ? s.gbp?.locationName
          ? 'Location synced via Business Profile API.'
          : 'Connected — ensure Business Profile API access, then re-audit.'
        : isOAuthConfigured()
          ? 'Connect Google to sync GBP location facts.'
          : 'OAuth not configured on server.',
    },
  };
}

function createOAuthClient(redirectUri = REDIRECT_URI) {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
}

async function getAuthedClient() {
  const store = readStore();
  if (!store.refreshToken) throw new Error('Google not connected');
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: store.refreshToken });
  return client;
}

function startOAuth() {
  if (!isOAuthConfigured()) {
    throw new Error('Google OAuth is not configured on the server (GOOGLE_SEO_CLIENT_ID / SECRET)');
  }
  const state = crypto.randomBytes(16).toString('hex');
  ensureDir();
  fs.writeFileSync(
    PENDING_PATH,
    JSON.stringify({ state, createdAt: Date.now() }, null, 2)
  );
  const client = createOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
  return { url, state };
}

async function handleOAuthCallback(code, state) {
  if (!fs.existsSync(PENDING_PATH)) throw new Error('OAuth session expired — start connect again');
  const pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
  if (pending.state !== state) throw new Error('Invalid OAuth state');
  fs.unlinkSync(PENDING_PATH);

  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email || null;
  } catch {
    /* optional */
  }

  writeStore({
    connected: true,
    refreshToken: tokens.refresh_token || readStore().refreshToken,
    email,
    gsc: readStore().gsc || {},
    gbp: readStore().gbp || {},
  });

  return { email };
}

function disconnectGoogle() {
  writeStore({
    connected: false,
    refreshToken: null,
    email: null,
    gsc: {},
    gbp: {},
  });
}

function normalizeDomain(origin) {
  try {
    return new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function pickGscSite(sites, origin) {
  const domain = normalizeDomain(origin);
  if (!domain) return null;
  const entries = sites || [];
  const exact = entries.find(
    (s) =>
      s.siteUrl === origin ||
      s.siteUrl === `${origin}/` ||
      s.siteUrl === `sc-domain:${domain}` ||
      s.siteUrl?.includes(domain)
  );
  return exact?.siteUrl || entries[0]?.siteUrl || null;
}

async function syncGoogleData(origin) {
  const store = readStore();
  if (!store.refreshToken) return { gsc: null, gbp: null };

  const auth = await getAuthedClient();
  const next = { ...store };

  try {
    const webmasters = google.webmasters({ version: 'v3', auth });
    const { data } = await webmasters.sites.list();
    const siteUrl = pickGscSite(data.siteEntry, origin);
    next.gsc = {
      siteUrl,
      sites: (data.siteEntry || []).map((s) => s.siteUrl),
      lastSyncAt: new Date().toISOString(),
    };
  } catch (err) {
    next.gsc = { ...(store.gsc || {}), error: err.message, lastSyncAt: new Date().toISOString() };
  }

  try {
    const acct = google.mybusinessaccountmanagement({ version: 'v1', auth });
    const { data: acctData } = await acct.accounts.list();
    const account = acctData.accounts?.[0];
    if (account?.name) {
      const biz = google.mybusinessbusinessinformation({ version: 'v1', auth });
      const { data: locData } = await biz.accounts.locations.list({
        parent: account.name,
        readMask: 'name,title,phoneNumbers,storefrontAddress,websiteUri,metadata',
      });
      const loc = locData.locations?.[0];
      if (loc) {
        next.gbp = {
          locationName: loc.name,
          title: loc.title,
          phone: loc.phoneNumbers?.primaryPhone || loc.phoneNumbers?.[0]?.phoneNumber,
          address: loc.storefrontAddress
            ? [
                loc.storefrontAddress.addressLines?.join(', '),
                loc.storefrontAddress.locality,
                loc.storefrontAddress.administrativeArea,
                loc.storefrontAddress.postalCode,
              ]
                .filter(Boolean)
                .join(', ')
            : null,
          websiteUri: loc.websiteUri,
          lastSyncAt: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    next.gbp = { ...(store.gbp || {}), error: err.message, lastSyncAt: new Date().toISOString() };
  }

  writeStore(next);
  return { gsc: next.gsc, gbp: next.gbp };
}

async function inspectHomepageIndex(auth, siteUrl, inspectionUrl) {
  try {
    const sc = google.searchconsole({ version: 'v1', auth });
    const { data } = await sc.urlInspection.index.inspect({
      requestBody: { siteUrl, inspectionUrl },
    });
    const result = data.inspectionResult?.indexStatusResult;
    return {
      verdict: result?.verdict,
      coverageState: result?.coverageState,
      indexingState: result?.indexingState,
      robotsTxtState: result?.robotsTxtState,
    };
  } catch (err) {
    return { error: err.message };
  }
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits.slice(-10);
}

function buildGoogleRecommendations({ profile, origin, gsc, gbp, indexInspect }) {
  const out = [];

  if (gsc && !gsc?.siteUrl && !gsc?.error) {
    out.push(
      rec({
        id: 'gsc-no-property',
        category: 'technical_seo',
        confirmationLevel: 'confirmed',
        factors: { impact: 60, severity: 55, confidence: 80, urgency: 40, effort: 35 },
        title: 'No Search Console property found for this Google account',
        evidence: ['Connected Google account returned zero verified Search Console properties.'],
        businessImpact: 'Indexing and query insights require a verified property.',
        recommendedAction: 'Verify your domain or URL prefix in Google Search Console, then re-audit.',
        verificationMethod: 'Search Console → Add property → verify ownership.',
      })
    );
  }

  if (gsc?.error && !gsc?.siteUrl) {
    out.push(
      rec({
        id: 'gsc-sync-error',
        category: 'technical_seo',
        confirmationLevel: 'heuristic',
        factors: { impact: 50, severity: 40, confidence: 70, urgency: 30, effort: 35 },
        title: 'Search Console data could not be loaded',
        evidence: [gsc.error],
        businessImpact: 'Without GSC, indexing issues may go unnoticed.',
        recommendedAction: 'Confirm OAuth scopes and that this Google user has Search Console access.',
        verificationMethod: 'Reconnect Google and re-audit.',
        status: 'needs_verification',
      })
    );
  }

  if (indexInspect?.verdict && String(indexInspect.verdict).toUpperCase().includes('FAIL')) {
    out.push(
      rec({
        id: 'gsc-homepage-index-fail',
        category: 'technical_seo',
        confirmationLevel: 'confirmed',
        forceMinPriority: 'P0',
        factors: { impact: 92, severity: 90, confidence: 90, urgency: 85, effort: 45 },
        title: 'Search Console reports homepage indexing problems',
        evidence: [
          `Verdict: ${indexInspect.verdict}`,
          indexInspect.coverageState ? `Coverage: ${indexInspect.coverageState}` : null,
          indexInspect.indexingState ? `Indexing: ${indexInspect.indexingState}` : null,
        ].filter(Boolean),
        affectedUrls: [origin],
        businessImpact: 'Pages that fail indexing may not appear in Google Search.',
        recommendedAction: 'Use URL Inspection details to fix coverage/blocking; re-request indexing after fix.',
        verificationMethod: 'Search Console URL Inspection → Live test → Request indexing.',
      })
    );
  }

  if (gbp?.error && !gbp?.locationName) {
    out.push(
      rec({
        id: 'gbp-sync-error',
        category: 'local_seo',
        confirmationLevel: 'heuristic',
        factors: { impact: 55, severity: 45, confidence: 65, urgency: 35, effort: 40 },
        title: 'Business Profile API sync failed',
        evidence: [gbp.error],
        businessImpact: 'Local recommendations cannot compare live GBP facts to your brand record.',
        recommendedAction:
          'Enable Google Business Profile API in Cloud Console and grant business.manage scope to the OAuth client.',
        verificationMethod: 'Reconnect Google and re-audit.',
        status: 'needs_verification',
      })
    );
  }

  if (gbp?.title || gbp?.phone || gbp?.address) {
    const evidence = [];
    if (profile.companyName && gbp.title && profile.companyName.trim().toLowerCase() !== gbp.title.trim().toLowerCase()) {
      evidence.push(`Brand name “${profile.companyName}” vs GBP “${gbp.title}”.`);
    }
    const pPhone = normalizePhone(profile.businessPhone);
    const gPhone = normalizePhone(gbp.phone);
    if (pPhone && gPhone && pPhone !== gPhone) {
      evidence.push('Phone in Brand settings does not match synced GBP primary phone.');
    }
    if (profile.businessAddress && gbp.address) {
      const a = profile.businessAddress.toLowerCase().replace(/\s+/g, ' ');
      const b = gbp.address.toLowerCase().replace(/\s+/g, ' ');
      if (!a.includes(b.slice(0, 12)) && !b.includes(a.slice(0, 12))) {
        evidence.push('Address in Brand settings may not match synced GBP address.');
      }
    }
    if (evidence.length) {
      out.push(
        rec({
          id: 'gbp-nap-mismatch',
          category: 'local_seo',
          confirmationLevel: 'confirmed',
          factors: { impact: 82, severity: 78, confidence: 88, urgency: 65, effort: 35 },
          title: 'Google Business Profile facts differ from Nexora brand record',
          evidence,
          businessImpact: 'Inconsistent NAP across GBP and your site hurts local trust signals.',
          recommendedAction: 'Pick one source of truth, update GBP and Brand settings to match, then update your site footer.',
          verificationMethod: 'Re-sync (re-audit) and manually verify public GBP listing.',
        })
      );
    }
  }

  return out;
}

async function collectGoogleAuditEvidence(origin) {
  const store = readStore();
  if (!store.refreshToken) {
    return { integrations: getIntegrationStatus(), recommendations: [], gsc: null, gbp: null };
  }

  const { gsc, gbp } = await syncGoogleData(origin);
  let indexInspect = null;
  if (gsc?.siteUrl && origin) {
    try {
      const auth = await getAuthedClient();
      indexInspect = await inspectHomepageIndex(auth, gsc.siteUrl, `${origin}/`);
    } catch (err) {
      indexInspect = { error: err.message };
    }
  }

  const profile = require('../companyKnowledge').getProfile();
  const recommendations = buildGoogleRecommendations({ profile, origin, gsc, gbp, indexInspect });

  return {
    integrations: getIntegrationStatus(),
    recommendations,
    gsc,
    gbp,
    indexInspect,
  };
}

module.exports = {
  getIntegrationStatus,
  isOAuthConfigured,
  startOAuth,
  handleOAuthCallback,
  disconnectGoogle,
  syncGoogleData,
  collectGoogleAuditEvidence,
  readStore,
  getAuthedClient,
  FRONTEND_URL,
};
