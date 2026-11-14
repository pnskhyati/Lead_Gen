/**
 * Each workspace connects its own mailbox. The agent sends from it (SMTP) and reads new mail from it (IMAP),
 * so no public webhook is needed. Passwords are encrypted at rest and never returned by the API.
 */
const crypto = require('crypto');
const path = require('path');
const { createWorkspaceStore } = require('../wsStore');

const store = createWorkspaceStore(path.join(__dirname, '..', 'data', 'email-accounts.json'), {
  email: '',
  provider: '',
  user: '',
  passwordEnc: '',
  authType: 'password',
  refreshTokenEnc: '',
  accessTokenEnc: '',
  accessExpiresAt: 0,
  fromName: '',
  smtp: null,
  imap: null,
  connectedAt: null,
  lastUid: 0,
  uidValidity: null,
  lastPollAt: null,
  lastError: null,
  lastErrorAt: null,
  needsReconnect: false,
  failures: 0,
  seenIds: [],
  sent: [],
});

const key = () => crypto.createHash('sha256').update(`email-credentials:${process.env.CREDENTIALS_KEY || process.env.JWT_SECRET || 'nexora-dev-only-change-me'}`).digest();

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

function decrypt(blob) {
  const [v, iv, tag, enc] = String(blob || '').split(':');
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('Stored email password is unreadable. Reconnect the mailbox.');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MAX_PER_SENDER_PER_DAY = 3;
const MAX_PER_WORKSPACE_PER_HOUR = 30;

/** The raw record (with the encrypted password) or null when no mailbox is connected. */
function get(ws) {
  const a = store.read(ws);
  return a.email && (a.passwordEnc || a.refreshTokenEnc) ? a : null;
}

/** Account with the password decrypted, for connecting to the mail servers. */
function getWithSecret(ws) {
  const a = get(ws);
  if (!a) return null;
  if (a.authType === 'oauth') {
    return { ...a, refreshToken: decrypt(a.refreshTokenEnc), accessToken: a.accessTokenEnc ? decrypt(a.accessTokenEnc) : '' };
  }
  return { ...a, password: decrypt(a.passwordEnc) };
}

function connect({ email, provider, user, password, authType = 'password', refreshToken, accessToken, accessExpiresAt, fromName, smtp, imap, uidNext, uidValidity }, ws) {
  return store.update(
    () => ({
      email: String(email).toLowerCase(),
      provider,
      user: user || String(email).toLowerCase(),
      passwordEnc: authType === 'oauth' ? '' : encrypt(password),
      authType,
      refreshTokenEnc: authType === 'oauth' ? encrypt(refreshToken) : '',
      accessTokenEnc: authType === 'oauth' && accessToken ? encrypt(accessToken) : '',
      accessExpiresAt: authType === 'oauth' ? Number(accessExpiresAt || 0) : 0,
      fromName: String(fromName || '').slice(0, 80),
      smtp,
      imap,
      connectedAt: new Date().toISOString(),
      // Only mail that arrives after connecting is ever answered; the existing inbox is left alone.
      lastUid: Math.max(0, Number(uidNext || 1) - 1),
      uidValidity: uidValidity ?? null,
      lastPollAt: null,
      lastError: null,
      lastErrorAt: null,
      needsReconnect: false,
      failures: 0,
      seenIds: [],
      sent: [],
    }),
    ws
  );
}

function disconnect(ws) {
  store.update(
    (s) => ({ ...s, email: '', passwordEnc: '', authType: 'password', refreshTokenEnc: '', accessTokenEnc: '', accessExpiresAt: 0, provider: '', user: '', smtp: null, imap: null, connectedAt: null, lastUid: 0, uidValidity: null, seenIds: [], sent: [], needsReconnect: false, failures: 0, lastError: null }),
    ws
  );
}

const patch = (fields, ws) => store.update((s) => ({ ...s, ...fields }), ws);

function recordSent(to, ws, now = Date.now()) {
  store.update((s) => ({ ...s, sent: [...s.sent.filter((x) => now - x.at < DAY), { to: String(to).toLowerCase(), at: now }] }), ws);
}

/** Replies are capped per sender and per workspace so a loop or a flood can never turn into a mail storm. */
function replyAllowance(to, ws, now = Date.now()) {
  const a = store.read(ws);
  const recent = a.sent.filter((x) => now - x.at < DAY);
  if (recent.filter((x) => x.to === String(to).toLowerCase()).length >= MAX_PER_SENDER_PER_DAY) return { ok: false, reason: 'sender_limit' };
  if (recent.filter((x) => now - x.at < HOUR).length >= MAX_PER_WORKSPACE_PER_HOUR) return { ok: false, reason: 'workspace_limit' };
  return { ok: true };
}

function publicView(ws) {
  const a = get(ws);
  if (!a) return { connected: false };
  const now = Date.now();
  return {
    connected: !a.needsReconnect,
    email: a.email,
    provider: a.provider,
    authType: a.authType || 'password',
    fromName: a.fromName,
    connectedAt: a.connectedAt,
    lastPollAt: a.lastPollAt,
    lastError: a.lastError,
    needsReconnect: a.needsReconnect,
    repliesLast24h: a.sent.filter((x) => now - x.at < DAY).length,
  };
}

function entries() {
  return store.entries().filter(([, a]) => a.email && (a.passwordEnc || a.refreshTokenEnc));
}

module.exports = { get, getWithSecret, connect, disconnect, patch, recordSent, replyAllowance, publicView, entries, encrypt, decrypt, MAX_PER_SENDER_PER_DAY, MAX_PER_WORKSPACE_PER_HOUR };
