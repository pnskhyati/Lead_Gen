/**
 * "Sign in with Google / Microsoft" for the mailbox, so owners never type a mail password and workspaces that block
 * app passwords still work. The assistant gets a refresh token and uses it to read and send mail (XOAUTH2).
 *
 * Needs an OAuth app registered with each provider (see README); without one the button reports it is not set up.
 */
const axios = require('axios');
const { resolveServers } = require('./providers');

const env = () => process.env;
const tenant = () => env().EMAIL_MICROSOFT_TENANT || 'common';

const PROVIDERS = {
  google: {
    label: 'Google',
    preset: 'gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/ openid email profile',
    extraAuth: { access_type: 'offline', prompt: 'consent' },
    clientId: () => env().EMAIL_GOOGLE_CLIENT_ID || '',
    clientSecret: () => env().EMAIL_GOOGLE_CLIENT_SECRET || '',
  },
  microsoft: {
    label: 'Microsoft',
    preset: 'outlook',
    authUrl: () => `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`,
    scope: 'offline_access openid email profile https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
    extraAuth: { prompt: 'select_account' },
    clientId: () => env().EMAIL_MICROSOFT_CLIENT_ID || '',
    clientSecret: () => env().EMAIL_MICROSOFT_CLIENT_SECRET || '',
  },
};

// Swapped by tests so no real network is used.
const http = {
  post: (url, form) =>
    axios.post(url, new URLSearchParams(form).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 }).then((r) => r.data),
};

const valueOf = (v) => (typeof v === 'function' ? v() : v);

function provider(name) {
  const p = PROVIDERS[name];
  if (!p) throw new Error('Unknown sign-in provider.');
  return p;
}

const configured = (name) => Boolean(PROVIDERS[name] && PROVIDERS[name].clientId() && PROVIDERS[name].clientSecret());
const status = () => ({ google: configured('google'), microsoft: configured('microsoft') });

const frontendUrl = () => (env().FRONTEND_URL || 'https://127.0.0.1:3000').replace(/\/$/, '');
const redirectUri = () => env().EMAIL_OAUTH_REDIRECT_URI || `${frontendUrl()}/auth/email/callback`;

function authorizeUrl(name, state) {
  const p = provider(name);
  if (!configured(name)) throw new Error(`Sign in with ${p.label} is not set up on this server yet.`);
  const params = new URLSearchParams({
    client_id: p.clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: p.scope,
    state,
    ...p.extraAuth,
  });
  return `${valueOf(p.authUrl)}?${params.toString()}`;
}

function toTokens(data, now) {
  if (!data?.access_token) throw new Error('The sign-in did not return an access token.');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    idToken: data.id_token || null,
    accessExpiresAt: now + Math.max(60, Number(data.expires_in || 3600)) * 1000,
  };
}

function oauthError(err) {
  const body = err?.response?.data || {};
  const code = body.error || '';
  const e = new Error(body.error_description ? String(body.error_description).split('\n')[0].slice(0, 200) : code || err.message);
  e.revoked = code === 'invalid_grant' || code === 'invalid_client' || code === 'unauthorized_client';
  e.code = code;
  return e;
}

async function exchangeCode(name, code, now = Date.now()) {
  const p = provider(name);
  try {
    const data = await http.post(valueOf(p.tokenUrl), {
      grant_type: 'authorization_code',
      code: String(code),
      client_id: p.clientId(),
      client_secret: p.clientSecret(),
      redirect_uri: redirectUri(),
    });
    const tokens = toTokens(data, now);
    if (!tokens.refreshToken) {
      throw new Error(`${p.label} did not allow ongoing access. Remove Nexora from your ${p.label} account permissions and connect again.`);
    }
    return tokens;
  } catch (err) {
    throw err.response ? oauthError(err) : err;
  }
}

/** A new access token. Microsoft may rotate the refresh token; the new one is returned and must be stored. */
async function refreshAccessToken(name, refreshToken, now = Date.now()) {
  const p = provider(name);
  try {
    const data = await http.post(valueOf(p.tokenUrl), {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: p.clientId(),
      client_secret: p.clientSecret(),
      scope: p.scope,
    });
    const t = toTokens(data, now);
    return { ...t, refreshToken: t.refreshToken || refreshToken };
  } catch (err) {
    throw err.response ? oauthError(err) : err;
  }
}

/**
 * The address that signed in, from the id_token the provider sent straight back to us over TLS
 * (the OpenID Connect spec allows skipping signature checks for tokens received directly from the token endpoint).
 */
function identityFromIdToken(idToken) {
  let claims;
  try {
    claims = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Could not read which email address signed in.');
  }
  const email = String(claims.email || claims.preferred_username || '').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new Error('The sign-in did not include an email address.');
  if (claims.email_verified === false) throw new Error('That email address is not verified with the provider.');
  return { email, name: String(claims.name || '').slice(0, 80) };
}

const serversFor = (name) => resolveServers(provider(name).preset === 'outlook' ? 'outlook' : 'gmail');

/** Outlook sends over STARTTLS on smtp.office365.com (the older smtp-mail host does not accept OAuth). */
function mailServers(name) {
  const s = serversFor(name);
  if (name === 'microsoft') s.smtp = { host: 'smtp.office365.com', port: 587, secure: false };
  return s;
}

module.exports = { PROVIDERS, http, configured, status, redirectUri, frontendUrl, authorizeUrl, exchangeCode, refreshAccessToken, identityFromIdToken, mailServers };
