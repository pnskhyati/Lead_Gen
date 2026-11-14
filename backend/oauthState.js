/**
 * Signed OAuth `state` that binds a provider callback to the workspace and user that started it.
 * Without this, a callback has no session context (and nothing stops it being replayed by an attacker).
 */
const jwt = require('jsonwebtoken');

let secret = process.env.JWT_SECRET || 'nexora-dev-only-change-me';

function init(jwtSecret) {
  if (jwtSecret) secret = jwtSecret;
}

/** @param {{ channel: string, appUser: { id: string, workspaceId: string }, extra?: object }} opts */
function create({ channel, appUser, extra = {} }) {
  if (!appUser?.id) throw new Error('Sign in required');
  return jwt.sign({ typ: 'oauth', ch: channel, uid: appUser.id, wid: appUser.workspaceId, ...extra }, secret, {
    expiresIn: '15m',
  });
}

/**
 * Verify a callback state. The signed-in user completing the flow must be the one who started it.
 * @returns {{ workspaceId: string, userId: string, extra: object }}
 */
function verify(state, channel, appUser) {
  let payload;
  try {
    payload = jwt.verify(String(state || ''), secret);
  } catch {
    throw new Error('oauth_session_expired');
  }
  if (payload.typ !== 'oauth' || payload.ch !== channel) throw new Error('oauth_state_invalid');
  if (!appUser || appUser.id !== payload.uid) throw new Error('oauth_user_mismatch');
  const { typ, ch, uid, wid, iat, exp, ...extra } = payload;
  return { workspaceId: wid, userId: uid, extra };
}

module.exports = { init, create, verify };
