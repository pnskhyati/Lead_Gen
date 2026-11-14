/**
 * Gives the rest of the app a mailbox it can use right now. For sign-in accounts that means a fresh access token:
 * refreshed when it is about to expire, saved encrypted, and never refreshed twice at once (Microsoft rotates
 * refresh tokens, so two simultaneous refreshes could invalidate each other).
 */
const accounts = require('./accounts');
const oauth = require('./oauth');
const workspaceContext = require('../workspaceContext');

const SKEW_MS = 120_000;
const inflight = new Map();

const providerName = (account) => (account.provider === 'outlook' ? 'microsoft' : 'google');

async function refreshNow(ws, account, now) {
  try {
    const t = await oauth.refreshAccessToken(providerName(account), account.refreshToken, now);
    accounts.patch(
      {
        accessTokenEnc: accounts.encrypt(t.accessToken),
        accessExpiresAt: t.accessExpiresAt,
        refreshTokenEnc: accounts.encrypt(t.refreshToken),
      },
      ws
    );
    return { ...account, accessToken: t.accessToken, refreshToken: t.refreshToken, accessExpiresAt: t.accessExpiresAt };
  } catch (err) {
    if (err.revoked) {
      const label = account.provider === 'outlook' ? 'Microsoft' : 'Google';
      const message = `${label} access was removed or expired. Sign in again to reconnect.`;
      accounts.patch({ needsReconnect: true, lastError: message, lastErrorAt: new Date(now).toISOString() }, ws);
      const e = new Error(message);
      e.auth = true;
      throw e;
    }
    throw err; // network or provider hiccup: the poller backs off and tries again
  }
}

/** The connected mailbox with credentials ready to use, or null when none is connected. */
async function getUsable(ws, now = Date.now()) {
  const id = workspaceContext.resolve(ws);
  const account = accounts.getWithSecret(id);
  if (!account || account.authType !== 'oauth') return account;
  if (account.accessToken && account.accessExpiresAt - now > SKEW_MS) return account;

  if (!inflight.has(id)) {
    inflight.set(
      id,
      refreshNow(id, account, now).finally(() => inflight.delete(id))
    );
  }
  return inflight.get(id);
}

module.exports = { getUsable };
