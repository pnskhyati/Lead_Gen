/* Run: node email/oauth.test.js — "Sign in with Google / Microsoft" for the mailbox (no real provider is contacted). */
process.env.RAG_DISABLE_EMBEDDINGS = 'true';
process.env.EMAIL_GOOGLE_CLIENT_ID = 'g-client-id';
process.env.EMAIL_GOOGLE_CLIENT_SECRET = 'g-client-secret';
process.env.EMAIL_MICROSOFT_CLIENT_ID = 'm-client-id';
process.env.EMAIL_MICROSOFT_CLIENT_SECRET = 'm-client-secret';
process.env.FRONTEND_URL = 'https://127.0.0.1:3000';
const assert = require('assert');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { simpleParser } = require('mailparser');
const oauth = require('./oauth');
const accounts = require('./accounts');
const tokens = require('./tokens');
const mailbox = require('./mailbox');
const { createEmailPoller } = require('./poller');
const emailChannel = require('../email');
const oauthState = require('../oauthState');
const ctx = require('../workspaceContext');

const stamp = Date.now();
const A = `ws-test-oa1-${stamp}`;
const B = `ws-test-oa2-${stamp}`;
const C = `ws-test-oa3-${stamp}`;
const D = `ws-test-oa4-${stamp}`;
let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.stack.split('\n').slice(0, 4).join('\n       ')}`);
  }
}

const idToken = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const realPost = oauth.http.post;
const fakeProvider = (handler) => {
  const calls = [];
  oauth.http.post = async (url, form) => {
    calls.push({ url, form });
    return handler(url, form, calls.length);
  };
  return calls;
};
const providerError = (code, description) => {
  const e = new Error('Request failed with status code 400');
  e.response = { data: { error: code, error_description: description } };
  return e;
};

const base = { email: 'info@tecavy.com', provider: 'gmail', user: 'info@tecavy.com', fromName: 'Tecavy', authType: 'oauth', ...oauth.mailServers('google') };
const connectOauth = (ws, o = {}) =>
  accounts.connect({ ...base, refreshToken: 'REFRESH-1', accessToken: 'ACCESS-1', accessExpiresAt: Date.now() + 3_600_000, uidNext: 5, uidValidity: '7', ...o }, ws);

(async () => {
  console.log('email sign-in (OAuth)');

  await test('the authorize links carry the right scopes, redirect and a state; unconfigured providers refuse', () => {
    const g = new URL(oauth.authorizeUrl('google', 'STATE1'));
    assert.strictEqual(g.origin + g.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.strictEqual(g.searchParams.get('client_id'), 'g-client-id');
    assert.strictEqual(g.searchParams.get('redirect_uri'), 'https://127.0.0.1:3000/auth/email/callback');
    assert.strictEqual(g.searchParams.get('state'), 'STATE1');
    assert.strictEqual(g.searchParams.get('access_type'), 'offline');
    assert.strictEqual(g.searchParams.get('prompt'), 'consent');
    assert.ok(g.searchParams.get('scope').includes('https://mail.google.com/'));
    const m = new URL(oauth.authorizeUrl('microsoft', 'STATE2'));
    assert.ok(m.pathname.startsWith('/common/oauth2/v2.0/authorize'));
    assert.ok(m.searchParams.get('scope').includes('IMAP.AccessAsUser.All') && m.searchParams.get('scope').includes('SMTP.Send') && m.searchParams.get('scope').includes('offline_access'));
    assert.deepStrictEqual(oauth.status(), { google: true, microsoft: true });
    const saved = process.env.EMAIL_GOOGLE_CLIENT_SECRET;
    delete process.env.EMAIL_GOOGLE_CLIENT_SECRET;
    assert.throws(() => oauth.authorizeUrl('google', 's'), /not set up on this server/);
    assert.strictEqual(oauth.status().google, false);
    process.env.EMAIL_GOOGLE_CLIENT_SECRET = saved;
    assert.throws(() => oauth.authorizeUrl('yahoo', 's'), /Unknown sign-in provider/);
    assert.strictEqual(oauth.mailServers('microsoft').smtp.host, 'smtp.office365.com');
  });

  await test('the code is exchanged with the right parameters; missing refresh token and provider errors are explained', async () => {
    const calls = fakeProvider(() => ({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, id_token: 'x' }));
    const now = 1_000_000;
    const t = await oauth.exchangeCode('google', 'CODE', now);
    assert.deepStrictEqual({ a: t.accessToken, r: t.refreshToken, e: t.accessExpiresAt }, { a: 'AT', r: 'RT', e: now + 3_600_000 });
    assert.strictEqual(calls[0].url, 'https://oauth2.googleapis.com/token');
    assert.deepStrictEqual(calls[0].form, { grant_type: 'authorization_code', code: 'CODE', client_id: 'g-client-id', client_secret: 'g-client-secret', redirect_uri: 'https://127.0.0.1:3000/auth/email/callback' });

    fakeProvider(() => ({ access_token: 'AT', expires_in: 3600 }));
    await assert.rejects(oauth.exchangeCode('google', 'CODE'), /did not allow ongoing access/);

    fakeProvider(() => {
      throw providerError('invalid_grant', 'Code was already redeemed.\nTrace ID: 1');
    });
    const err = await oauth.exchangeCode('microsoft', 'CODE').catch((e) => e);
    assert.strictEqual(err.revoked, true);
    assert.strictEqual(err.message, 'Code was already redeemed.', 'only the first line of the provider message is shown');
  });

  await test('the signed-in address is read from the id_token; unverified or missing addresses are refused', () => {
    assert.deepStrictEqual(oauth.identityFromIdToken(idToken({ email: 'Info@Tecavy.com', email_verified: true, name: 'Tecavy' })), { email: 'info@tecavy.com', name: 'Tecavy' });
    assert.strictEqual(oauth.identityFromIdToken(idToken({ preferred_username: 'a@corp.onmicrosoft.com' })).email, 'a@corp.onmicrosoft.com');
    assert.throws(() => oauth.identityFromIdToken(idToken({ email: 'a@b.com', email_verified: false })), /not verified/);
    assert.throws(() => oauth.identityFromIdToken(idToken({ sub: '1' })), /did not include an email/);
    assert.throws(() => oauth.identityFromIdToken('garbage'), /Could not read/);
  });

  await test('sign-in tokens are encrypted at rest and never shown', () => {
    connectOauth(A);
    const file = fs.readFileSync(path.join(__dirname, '..', 'data', 'email-accounts.json'), 'utf8');
    assert.ok(!file.includes('REFRESH-1') && !file.includes('ACCESS-1'), 'no plain tokens on disk');
    const view = accounts.publicView(A);
    assert.strictEqual(view.authType, 'oauth');
    assert.ok(!JSON.stringify(view).includes('REFRESH-1'));
    assert.strictEqual(accounts.getWithSecret(A).refreshToken, 'REFRESH-1');
    assert.strictEqual(accounts.get(A).lastUid, 4);
  });

  await test('a still-valid access token is reused; an expiring one is refreshed once, saved, and the rotated refresh token kept', async () => {
    connectOauth(A);
    const calls = fakeProvider(() => ({ access_token: 'ACCESS-2', refresh_token: 'REFRESH-2', expires_in: 3600 }));
    assert.strictEqual((await tokens.getUsable(A)).accessToken, 'ACCESS-1');
    assert.strictEqual(calls.length, 0, 'no network call while the token is fresh');

    const soon = connectOauth(A, { accessExpiresAt: Date.now() + 30_000 });
    assert.ok(soon);
    const now = Date.now();
    const used = await tokens.getUsable(A, now);
    assert.strictEqual(used.accessToken, 'ACCESS-2');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].form.grant_type, 'refresh_token');
    assert.strictEqual(calls[0].form.refresh_token, 'REFRESH-1');
    const stored = accounts.getWithSecret(A);
    assert.deepStrictEqual({ a: stored.accessToken, r: stored.refreshToken }, { a: 'ACCESS-2', r: 'REFRESH-2' });
    const file = fs.readFileSync(path.join(__dirname, '..', 'data', 'email-accounts.json'), 'utf8');
    assert.ok(!file.includes('ACCESS-2') && !file.includes('REFRESH-2'));
  });

  await test('simultaneous requests share one refresh (a rotating refresh token cannot be spent twice)', async () => {
    connectOauth(A, { accessExpiresAt: 0 });
    const calls = fakeProvider(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return { access_token: 'ACCESS-X', refresh_token: 'REFRESH-X', expires_in: 3600 };
    });
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => tokens.getUsable(A)));
    assert.strictEqual(calls.length, 1);
    assert.ok(results.every((r) => r.accessToken === 'ACCESS-X'));
  });

  await test('revoked access asks the owner to sign in again; a network blip does not disconnect anyone', async () => {
    connectOauth(A, { accessExpiresAt: 0 });
    fakeProvider(() => {
      throw new Error('socket hang up');
    });
    await assert.rejects(tokens.getUsable(A), /socket hang up/);
    assert.strictEqual(accounts.get(A).needsReconnect, false, 'transient failure leaves the connection alone');

    fakeProvider(() => {
      throw providerError('invalid_grant', 'Token has been expired or revoked.');
    });
    const err = await tokens.getUsable(A).catch((e) => e);
    assert.strictEqual(err.auth, true);
    assert.match(err.message, /Google access was removed or expired/);
    assert.strictEqual(accounts.get(A).needsReconnect, true);
    assert.strictEqual(accounts.publicView(A).connected, false);
  });

  // ----------------------------------------------------------------------------- mailbox + poller with sign-in accounts
  function fakeServers(inbox) {
    const log = { imap: [], smtp: [] };
    class ImapFlow {
      constructor(o) {
        this.o = o;
        log.imap.push(o);
      }
      async connect() {}
      async getMailboxLock() {
        this.mailbox = { uidNext: inbox.uidNext, uidValidity: inbox.uidValidity };
        return { release() {} };
      }
      async *fetch() {
        for (const m of inbox.messages) yield m;
      }
      async logout() {}
    }
    const createTransport = (o) => {
      log.smtp.push(o);
      return { verify: async () => {}, sendMail: async () => ({ messageId: '<x>', accepted: [] }) };
    };
    return { deps: { ImapFlow, createTransport, lookup: async () => [{ address: '93.184.216.34' }] }, log };
  }

  await test('sign-in accounts authenticate with the access token (XOAUTH2), never a password', async () => {
    const { deps, log } = fakeServers({ uidNext: 9, uidValidity: 3, messages: [] });
    const acct = { ...base, accessToken: 'ACCESS-9', accessExpiresAt: Date.now() + 1e6 };
    const pos = await mailbox.verifyAccount(acct, deps);
    assert.deepStrictEqual(pos, { uidNext: 9, uidValidity: '3' });
    assert.deepStrictEqual(log.imap[0].auth, { user: 'info@tecavy.com', accessToken: 'ACCESS-9' });
    assert.deepStrictEqual(log.smtp[0].auth, { type: 'OAuth2', user: 'info@tecavy.com', accessToken: 'ACCESS-9' });
  });

  await test('the poller refreshes an expired token first, then reads mail with the new one', async () => {
    connectOauth(A, { accessExpiresAt: 0 });
    fakeProvider(() => ({ access_token: 'ACCESS-NEW', refresh_token: 'REFRESH-NEW', expires_in: 3600 }));
    const src = Buffer.from('From: Ravi <ravi@acme.in>\r\nTo: info@tecavy.com\r\nSubject: Hello\r\nMessage-ID: <oa1@acme>\r\nContent-Type: text/plain\r\n\r\nCan you help us?');
    const { deps, log } = fakeServers({ uidNext: 6, uidValidity: 7, messages: [{ uid: 5, source: src }] });
    const handled = [];
    const poller = createEmailPoller({ handle: async (p) => handled.push(p.subject), deps, simpleParser });
    await poller.tick();
    assert.deepStrictEqual(handled, ['Hello']);
    assert.strictEqual(log.imap[0].auth.accessToken, 'ACCESS-NEW');
    assert.strictEqual(accounts.get(A).lastError, null);
  });

  await test('in the poller a network blip backs off and a revoked sign-in asks to reconnect', async () => {
    connectOauth(A, { accessExpiresAt: 0 });
    fakeProvider(() => {
      throw new Error('ECONNRESET');
    });
    const { deps } = fakeServers({ uidNext: 5, uidValidity: 7, messages: [] });
    const poller = createEmailPoller({ handle: async () => {}, deps, simpleParser });
    await poller.tick();
    assert.strictEqual(accounts.get(A).needsReconnect, false);
    assert.strictEqual(accounts.get(A).failures, 1);

    fakeProvider(() => {
      throw providerError('invalid_grant', 'revoked');
    });
    await poller.tick();
    assert.strictEqual(accounts.get(A).needsReconnect, true);
  });

  // ----------------------------------------------------------------------------- routes
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const w = req.get('x-ws');
    if (!w) return res.status(401).json({ success: false, error: 'Sign in required' });
    req.appUser = { id: req.get('x-user') || `u-${w}`, email: 'o@example.com', role: req.get('x-role') || 'admin', workspaceId: w };
    ctx.run(w, next);
  });
  emailChannel.mountRoutes(app, { vertex: {}, leadAgent: {}, requireAuth: (_q, _s, n) => n() });
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}`;
  const get = async (p, { ws = A, role, user } = {}) => {
    const res = await fetch(url + p, { redirect: 'manual', headers: { 'x-ws': ws, ...(role ? { 'x-role': role } : {}), ...(user ? { 'x-user': user } : {}) } });
    return { status: res.status, location: res.headers.get('location'), text: res.status === 302 ? '' : await res.text() };
  };
  const stateFrom = (location) => new URL(location).searchParams.get('state');
  const realVerify = mailbox.verifyAccount;
  const verifyOk = async () => ({ uidNext: 30, uidValidity: '4' });

  await test('route: starting sign-in redirects to the provider with a signed state; non-admins and bad providers are refused', async () => {
    const r = await get('/auth/email/google');
    assert.strictEqual(r.status, 302);
    assert.ok(r.location.startsWith('https://accounts.google.com/'));
    assert.ok(stateFrom(r.location).split('.').length === 3, 'a signed token');
    assert.strictEqual((await get('/auth/email/google', { role: 'member' })).status, 403);
    const bad = await get('/auth/email/yahoo');
    assert.strictEqual(bad.status, 400);
    assert.match(bad.text, /Unknown sign-in provider/);
    const saved = process.env.EMAIL_MICROSOFT_CLIENT_ID;
    delete process.env.EMAIL_MICROSOFT_CLIENT_ID;
    assert.match((await get('/auth/email/microsoft')).text, /not set up on this server/);
    process.env.EMAIL_MICROSOFT_CLIENT_ID = saved;
  });

  await test('route: a completed sign-in connects the mailbox, and nothing is visible to other workspaces', async () => {
    accounts.disconnect(A);
    mailbox.verifyAccount = verifyOk;
    const start = await get('/auth/email/google');
    fakeProvider(() => ({ access_token: 'AT-G', refresh_token: 'RT-G', expires_in: 3600, id_token: idToken({ email: 'Owner@Tecavy.com', email_verified: true, name: 'Tecavy Owner' }) }));
    const done = await get(`/auth/email/callback?code=abc&state=${encodeURIComponent(stateFrom(start.location))}`);
    assert.match(done.text, /EMAIL_AUTH_SUCCESS/);
    const acct = accounts.getWithSecret(A);
    assert.deepStrictEqual({ e: acct.email, t: acct.authType, r: acct.refreshToken, p: acct.provider, last: acct.lastUid }, { e: 'owner@tecavy.com', t: 'oauth', r: 'RT-G', p: 'gmail', last: 29 });
    assert.strictEqual(accounts.get(B), null);

    const ms = await get('/auth/email/microsoft');
    fakeProvider(() => ({ access_token: 'AT-M', refresh_token: 'RT-M', expires_in: 3600, id_token: idToken({ preferred_username: 'boss@corp.com' }) }));
    await get(`/auth/email/callback?code=def&state=${encodeURIComponent(stateFrom(ms.location))}`);
    assert.strictEqual(accounts.get(A).provider, 'outlook');
    assert.strictEqual(accounts.get(A).smtp.host, 'smtp.office365.com');
  });

  await test('route: forged, expired, replayed-by-someone-else and failed sign-ins connect nothing', async () => {
    mailbox.verifyAccount = verifyOk;
    fakeProvider(() => ({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, id_token: idToken({ email: 'x@y.com' }) }));

    const forged = await get('/auth/email/callback?code=abc&state=not-a-real-state', { ws: C });
    assert.match(forged.text, /EMAIL_AUTH_ERROR/);
    assert.match(forged.text, /expired/);

    const start = await get('/auth/email/google', { ws: C, user: 'user-one' });
    const other = await get(`/auth/email/callback?code=abc&state=${encodeURIComponent(stateFrom(start.location))}`, { ws: C, user: 'attacker' });
    assert.match(other.text, /EMAIL_AUTH_ERROR/);
    assert.match(other.text, /Sign in to Nexora first/);

    const instagramState = oauthState.create({ channel: 'instagram', appUser: { id: 'u-' + C, workspaceId: C } });
    assert.match((await get(`/auth/email/callback?code=abc&state=${encodeURIComponent(instagramState)}`, { ws: C })).text, /EMAIL_AUTH_ERROR/, 'a state made for another channel is not accepted');

    const good = await get('/auth/email/google', { ws: C });
    const denied = await get(`/auth/email/callback?error=access_denied&error_description=${encodeURIComponent('The user denied access')}&state=${encodeURIComponent(stateFrom(good.location))}`, { ws: C });
    assert.match(denied.text, /The user denied access/);

    const again = await get('/auth/email/google', { ws: C });
    fakeProvider(() => {
      throw providerError('invalid_grant', 'Code was already redeemed.');
    });
    assert.match((await get(`/auth/email/callback?code=used&state=${encodeURIComponent(stateFrom(again.location))}`, { ws: C })).text, /already redeemed/);

    const unverified = await get('/auth/email/google', { ws: C });
    fakeProvider(() => ({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, id_token: idToken({ email: 'x@y.com', email_verified: false }) }));
    assert.match((await get(`/auth/email/callback?code=u&state=${encodeURIComponent(stateFrom(unverified.location))}`, { ws: C })).text, /not verified/);

    mailbox.verifyAccount = async () => {
      throw new Error('The IMAP sign-in was refused. Sign in again to reconnect.');
    };
    const refused = await get('/auth/email/google', { ws: C });
    fakeProvider(() => ({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, id_token: idToken({ email: 'x@y.com' }) }));
    assert.match((await get(`/auth/email/callback?code=r&state=${encodeURIComponent(stateFrom(refused.location))}`, { ws: C })).text, /IMAP sign-in was refused/);

    assert.strictEqual(accounts.get(C), null, 'none of these left a connection behind');
  });

  await test('route: starting sign-in is limited to 8 attempts an hour per workspace', async () => {
    let last;
    for (let i = 0; i < 9; i += 1) last = await get('/auth/email/google', { ws: D });
    assert.strictEqual(last.status, 400);
    assert.match(last.text, /Too many attempts/);
  });

  await test('route: the setup screen is told which sign-in buttons are available', async () => {
    const res = await fetch(`${url}/api/email/providers`, { headers: { 'x-ws': A } });
    const json = await res.json();
    assert.deepStrictEqual(json.data.signIn, { google: true, microsoft: true });
    assert.ok(json.data.presets.some((p) => p.id === 'gmail'));
  });

  mailbox.verifyAccount = realVerify;
  oauth.http.post = realPost;
  server.close();
  for (const w of [A, B, C, D]) {
    accounts.disconnect(w);
    fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', w), { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  setTimeout(() => process.exit(failures ? 1 : 0), 100);
})();
