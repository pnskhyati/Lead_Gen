/* Run: node email/email.test.js — per-workspace mailbox: login checks, sending, reading new mail, safety rules. */
process.env.RAG_DISABLE_EMBEDDINGS = 'true';
const assert = require('assert');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { simpleParser } = require('mailparser');
const providers = require('./providers');
const accounts = require('./accounts');
const mailbox = require('./mailbox');
const inbound = require('./inbound');
const { createEmailPoller } = require('./poller');
const emailChannel = require('../email');
const ctx = require('../workspaceContext');
const leadsCrm = require('../leadsCrm');

const stamp = Date.now();
const A = `ws-test-em1-${stamp}`;
const B = `ws-test-em2-${stamp}`;
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

const raw = (headers, body) => Buffer.from(`${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n${body}`);
const mail = (o = {}) =>
  raw(
    { From: o.from || 'Ravi <ravi@acmeretail.in>', To: 'info@tecavy.com', Subject: o.subject || 'Question about your service', 'Message-ID': o.id || `<m${Math.random().toString(36).slice(2)}@acme>`, Date: 'Tue, 10 Nov 2026 10:00:00 +0000', 'Content-Type': 'text/plain; charset=utf-8', ...(o.headers || {}) },
    o.body || 'Hi, can you automate our lead follow-ups?'
  );

// ----------------------------------------------------------------------------- fake mail servers
function fakeServers({ publicIp = '93.184.216.34', inboxFor = () => ({ uidNext: 5, uidValidity: 7, messages: [] }), authOk = true, smtpOk = true } = {}) {
  const log = { imap: [], smtp: [], sent: [] };
  class ImapFlow {
    constructor(opts) {
      this.opts = opts;
      log.imap.push(opts);
    }
    async connect() {
      if (!authOk) {
        const e = new Error('Command failed');
        e.authenticationFailed = true;
        throw e;
      }
    }
    async getMailboxLock() {
      const box = inboxFor(this.opts.auth.user);
      this.box = box;
      this.mailbox = { uidNext: box.uidNext, uidValidity: box.uidValidity };
      return { release() {} };
    }
    async *fetch(range) {
      const from = Number(String(range).split(':')[0]);
      // Real servers always return at least the newest message for "N:*", even when N is past the end.
      const list = this.box.messages.filter((m) => m.uid >= from);
      const out = list.length ? list : this.box.messages.slice(-1);
      for (const m of out) yield m;
    }
    async logout() {}
  }
  const createTransport = (opts) => {
    log.smtp.push(opts);
    return {
      async verify() {
        if (!smtpOk) {
          const e = new Error('Invalid login');
          e.code = 'EAUTH';
          throw e;
        }
      },
      async sendMail(m) {
        log.sent.push(m);
        return { messageId: `<sent${log.sent.length}@x>`, accepted: [m.to] };
      },
    };
  };
  const lookup = async (host) => [{ address: host.startsWith('internal') ? '10.0.0.5' : publicIp }];
  return { deps: { ImapFlow, createTransport, lookup }, log };
}

const base = { email: 'info@tecavy.com', provider: 'gmail', user: 'info@tecavy.com', password: 'secret-app-pass', fromName: 'Tecavy', ...providers.resolveServers('gmail') };

(async () => {
  console.log('email mailbox');

  // ----------------------------------------------------------------------------- providers
  await test('presets cover the common providers; custom servers are validated', () => {
    assert.ok(['gmail', 'outlook', 'zoho', 'zoho_in', 'yahoo', 'custom'].every((id) => providers.publicPresets().some((p) => p.id === id)));
    assert.strictEqual(providers.resolveServers('gmail').smtp.host, 'smtp.gmail.com');
    const ok = providers.resolveServers('custom', { smtp: { host: 'Mail.Example.com', port: 587 }, imap: { host: 'imap.example.com', port: 993 } });
    assert.deepStrictEqual(ok.smtp, { host: 'mail.example.com', port: 587, secure: false });
    assert.strictEqual(ok.imap.secure, true);
    assert.throws(() => providers.resolveServers('nope'), /Choose an email provider/);
    assert.throws(() => providers.resolveServers('custom', { smtp: { host: 'localhost', port: 587 }, imap: { host: 'imap.example.com' } }), /valid SMTP server/);
    assert.throws(() => providers.resolveServers('custom', { smtp: { host: 'smtp.example.com', port: 22 }, imap: { host: 'imap.example.com' } }), /port must be/);
    assert.throws(() => providers.resolveServers('custom', { smtp: { host: 'smtp.example.com', port: 25 }, imap: { host: 'imap.example.com' } }), /port must be/);
  });

  // ----------------------------------------------------------------------------- accounts
  await test('passwords are encrypted at rest, tamper-proof and never shown', () => {
    const enc = accounts.encrypt('hunter2');
    assert.ok(!enc.includes('hunter2'));
    assert.strictEqual(accounts.decrypt(enc), 'hunter2');
    assert.notStrictEqual(accounts.encrypt('hunter2'), enc, 'fresh IV every time');
    const parts = enc.split(':');
    parts[3] = Buffer.from('x'.repeat(10)).toString('base64');
    assert.throws(() => accounts.decrypt(parts.join(':')));
    accounts.connect({ ...base, uidNext: 10, uidValidity: '7' }, A);
    const file = fs.readFileSync(path.join(__dirname, '..', 'data', 'email-accounts.json'), 'utf8');
    assert.ok(!file.includes('secret-app-pass'), 'plain password is not on disk');
    assert.ok(!JSON.stringify(accounts.publicView(A)).includes('secret-app-pass'));
    assert.strictEqual(accounts.getWithSecret(A).password, 'secret-app-pass');
    assert.strictEqual(accounts.get(A).lastUid, 9, 'starts after the newest existing mail');
    assert.strictEqual(accounts.publicView(B).connected, false, 'other workspaces see nothing');
  });

  await test('reply limits: 3 per sender per day and 30 per workspace per hour', () => {
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) accounts.recordSent('Ravi@Acme.in', A, now - i * 1000);
    assert.deepStrictEqual(accounts.replyAllowance('ravi@acme.in', A, now), { ok: false, reason: 'sender_limit' });
    assert.strictEqual(accounts.replyAllowance('other@acme.in', A, now).ok, true);
    assert.strictEqual(accounts.replyAllowance('ravi@acme.in', A, now + 25 * 3_600_000).ok, true, 'a day later it is allowed again');
    for (let i = 0; i < 30; i += 1) accounts.recordSent(`p${i}@x.com`, A, now);
    assert.strictEqual(accounts.replyAllowance('new@x.com', A, now).reason, 'workspace_limit');
    accounts.connect({ ...base, uidNext: 1 }, A); // reset
  });

  // ----------------------------------------------------------------------------- mailbox
  await test('servers on private networks are refused (a tenant cannot point the app at internal services)', async () => {
    const { deps } = fakeServers();
    await assert.rejects(mailbox.publicAddress('127.0.0.1', deps.lookup), /not allowed/);
    await assert.rejects(mailbox.publicAddress('169.254.169.254', deps.lookup), /not allowed/);
    await assert.rejects(mailbox.publicAddress('internal.corp.example.com', deps.lookup), /not allowed/);
    assert.strictEqual(await mailbox.publicAddress('imap.gmail.com', deps.lookup), '93.184.216.34');
    const both = async () => [{ address: '2404:6800:4000:1025::6d' }, { address: '192.178.211.108' }];
    assert.strictEqual(await mailbox.publicAddress('smtp.gmail.com', both), '192.178.211.108', 'IPv4 is preferred; the first record was IPv6');
    assert.strictEqual(await mailbox.publicAddress('v6only.example.com', async () => [{ address: '2404:6800:4000:1025::6d' }]), '2404:6800:4000:1025::6d');
    await assert.rejects(mailbox.publicAddress('mixed.example.com', async () => [{ address: '192.178.211.108' }, { address: '::1' }]), /not allowed/, 'any private record blocks the host');
    const evil = { ...base, provider: 'custom', smtp: { host: 'internal.corp.example.com', port: 587, secure: false } };
    await assert.rejects(mailbox.verifyAccount(evil, deps), /not allowed/);
  });

  await test('verify checks both logins, connects to the vetted address, and returns where the inbox ends', async () => {
    const { deps, log } = fakeServers({ inboxFor: () => ({ uidNext: 42, uidValidity: 9, messages: [] }) });
    const pos = await mailbox.verifyAccount({ ...base }, deps);
    assert.deepStrictEqual(pos, { uidNext: 42, uidValidity: '9' });
    assert.strictEqual(log.smtp[0].host, '93.184.216.34', 'connects to the IP we resolved');
    assert.strictEqual(log.smtp[0].tls.servername, 'smtp.gmail.com', 'but validates the certificate for the real name');
    assert.strictEqual(log.imap[0].servername, 'imap.gmail.com');
  });

  await test('login failures give a plain-language reason', async () => {
    await assert.rejects(mailbox.verifyAccount({ ...base }, fakeServers({ smtpOk: false }).deps), /SMTP login was refused.*App Password/);
    await assert.rejects(mailbox.verifyAccount({ ...base }, fakeServers({ authOk: false }).deps), /IMAP login was refused/);
    await assert.rejects(mailbox.verifyAccount({ ...base, provider: 'zoho' }, fakeServers({ authOk: false }).deps), /app password if your provider/);
  });

  await test('only mail after the saved position is returned, oldest first, capped', async () => {
    const messages = [3, 4, 5, 6, 7].map((uid) => ({ uid, source: mail() }));
    const { deps } = fakeServers({ inboxFor: () => ({ uidNext: 8, uidValidity: 7, messages }) });
    const r = await mailbox.fetchNew({ ...base, lastUid: 5, uidValidity: '7' }, { max: 10 }, deps);
    assert.deepStrictEqual(r.messages.map((m) => m.uid), [6, 7]);
    const capped = await mailbox.fetchNew({ ...base, lastUid: 2, uidValidity: '7' }, { max: 2 }, deps);
    assert.deepStrictEqual(capped.messages.map((m) => m.uid), [3, 4]);
    const none = await mailbox.fetchNew({ ...base, lastUid: 7, uidValidity: '7' }, {}, deps);
    assert.deepStrictEqual(none.messages, [], 'the "N:*" quirk of returning the newest message is ignored');
  });

  await test('if the server renumbers the inbox, old mail is skipped instead of answered again', async () => {
    const messages = [1, 2, 3].map((uid) => ({ uid, source: mail() }));
    const { deps } = fakeServers({ inboxFor: () => ({ uidNext: 4, uidValidity: 99, messages }) });
    const r = await mailbox.fetchNew({ ...base, lastUid: 0, uidValidity: '7' }, {}, deps);
    assert.deepStrictEqual(r.messages, []);
    assert.deepStrictEqual(r.reset, { uidNext: 4, uidValidity: '99' });
  });

  await test('sending uses the connected address as the sender and keeps the thread', async () => {
    const { deps, log } = fakeServers();
    await mailbox.sendFrom({ ...base }, { to: 'ravi@acme.in', subject: 'Re: Hi', text: 'Hello', inReplyTo: '<a@x>', references: '<a@x>' }, deps);
    assert.deepStrictEqual(log.sent[0].from, { name: 'Tecavy', address: 'info@tecavy.com' });
    assert.strictEqual(log.sent[0].inReplyTo, '<a@x>');
  });

  // ----------------------------------------------------------------------------- inbound rules
  await test('automated mail is never answered: newsletters, auto-replies, bounces, no-reply senders, our own mail', async () => {
    const own = 'info@tecavy.com';
    const verdict = async (o) => inbound.classify(await simpleParser(mail(o)), own);
    assert.strictEqual((await verdict({})).automated, false);
    assert.strictEqual((await verdict({ from: 'noreply@shop.com' })).reason, 'no_reply_sender');
    assert.strictEqual((await verdict({ from: 'MAILER-DAEMON@mx.google.com' })).reason, 'no_reply_sender');
    assert.strictEqual((await verdict({ from: 'info@tecavy.com' })).reason, 'own_mail');
    assert.strictEqual((await verdict({ headers: { 'Auto-Submitted': 'auto-replied' } })).reason, 'auto_submitted');
    assert.strictEqual((await verdict({ headers: { 'Auto-Submitted': 'no' } })).automated, false);
    assert.strictEqual((await verdict({ headers: { Precedence: 'bulk' } })).reason, 'bulk_precedence');
    assert.strictEqual((await verdict({ headers: { 'List-Unsubscribe': '<mailto:u@x.com>' } })).reason, 'mailing_list');
    assert.strictEqual((await verdict({ headers: { 'X-Auto-Response-Suppress': 'All' } })).reason, 'auto_reply');
    assert.strictEqual((await verdict({ subject: 'Out of office: back Monday' })).reason, 'auto_subject');
    assert.strictEqual((await verdict({ subject: 'Undeliverable: your message' })).reason, 'auto_subject');
    assert.strictEqual((await verdict({ headers: { 'Content-Type': 'multipart/report; report-type=delivery-status; boundary=b' }, body: '--b--' })).reason, 'delivery_report');
  });

  await test('only what the sender wrote is passed on: quoted history is cut, length is capped', async () => {
    const body = 'Yes please book me in.\n\nOn Mon, 9 Nov 2026 at 10:00, Tecavy <info@tecavy.com> wrote:\n> Would you like a call?\n> Let us know.';
    const r = await inbound.toInbound(mail({ body }), simpleParser, 'info@tecavy.com');
    assert.strictEqual(r.inbound.text, 'Yes please book me in.');
    assert.strictEqual(r.inbound.from, 'Ravi <ravi@acmeretail.in>');
    const long = await inbound.toInbound(mail({ body: 'x'.repeat(9000) }), simpleParser, 'info@tecavy.com');
    assert.strictEqual(long.inbound.text.length, 4000);
    assert.strictEqual((await inbound.toInbound(mail({ body: '> only quoted' }), simpleParser, 'info@tecavy.com')).skip, 'empty');
    const html = await inbound.toInbound(raw({ From: 'a@b.com', Subject: 'x', 'Content-Type': 'text/html' }, '<p>Hello <b>there</b></p><script>bad()</script>'), simpleParser, 'info@tecavy.com');
    assert.ok(/Hello\s+there/.test(html.inbound.text) && !html.inbound.text.includes('bad()'));
  });

  // ----------------------------------------------------------------------------- the poller
  const setup = (inbox, extra = {}) => {
    const servers = fakeServers({ inboxFor: () => inbox, ...extra });
    const handled = [];
    const poller = createEmailPoller({
      handle: async (p, ws) => {
        handled.push({ ...p, ws });
        if (extra.handlerThrows) throw new Error('model down');
        return { lead: {}, agentResult: {} };
      },
      deps: servers.deps,
      simpleParser,
    });
    return { poller, handled, servers };
  };

  await test('answers only mail that arrives after connecting; skips newsletters; reads each message once', async () => {
    accounts.connect({ ...base, uidNext: 3, uidValidity: '7' }, A);
    const inbox = {
      uidNext: 7,
      uidValidity: 7,
      messages: [
        { uid: 1, source: mail({ subject: 'OLD before connect' }) },
        { uid: 2, source: mail({ subject: 'OLD before connect 2' }) },
        { uid: 3, source: mail({ subject: 'New real question', id: '<real1@acme>' }) },
        { uid: 4, source: mail({ from: 'deals@shop.com', headers: { 'List-Unsubscribe': '<mailto:x@y>' }, subject: 'Sale!' }) },
        { uid: 5, source: mail({ headers: { 'Auto-Submitted': 'auto-replied' }, subject: 'Auto' }) },
        { uid: 6, source: mail({ subject: 'Second real question', id: '<real2@acme>', from: 'Sara <sara@other.in>' }) },
      ],
    };
    const { poller, handled } = setup(inbox);
    const out = await poller.tick();
    assert.deepStrictEqual(handled.map((h) => h.subject), ['New real question', 'Second real question']);
    assert.ok(handled.every((h) => h.ws === A && h.replyAllowed === true));
    assert.strictEqual(out[A].skipped.mailing_list, 1);
    assert.strictEqual(out[A].skipped.auto_submitted, 1);
    assert.strictEqual(accounts.get(A).lastUid, 6);
    await poller.tick();
    assert.strictEqual(handled.length, 2, 'a second pass finds nothing new and answers nothing');
    assert.ok(accounts.get(A).lastPollAt && !accounts.get(A).lastError);
  });

  await test('a crash or model failure never causes the same message to be answered twice', async () => {
    accounts.connect({ ...base, uidNext: 1, uidValidity: '7' }, A);
    const inbox = { uidNext: 3, uidValidity: 7, messages: [{ uid: 1, source: mail({ id: '<x1@a>' }) }, { uid: 2, source: mail({ id: '<x2@a>', from: 'b@c.in' }) }] };
    const { poller, handled } = setup(inbox, { handlerThrows: true });
    await poller.tick();
    assert.strictEqual(handled.length, 2, 'both were attempted; one failure does not block the next');
    await poller.tick();
    assert.strictEqual(handled.length, 2, 'and neither is retried');
  });

  await test('the same Message-ID is never answered twice, even if the server resends it', async () => {
    accounts.connect({ ...base, uidNext: 1, uidValidity: '7' }, A);
    const inbox = { uidNext: 3, uidValidity: 7, messages: [{ uid: 1, source: mail({ id: '<same@a>' }) }, { uid: 2, source: mail({ id: '<same@a>' }) }] };
    const { poller, handled } = setup(inbox);
    const out = await poller.tick();
    assert.strictEqual(handled.length, 1);
    assert.strictEqual(out[A].skipped.duplicate, 1);
  });

  await test('over the reply limit the message is still captured but the agent is told not to answer', async () => {
    accounts.connect({ ...base, uidNext: 1, uidValidity: '7' }, A);
    for (let i = 0; i < 3; i += 1) accounts.recordSent('ravi@acmeretail.in', A);
    const inbox = { uidNext: 2, uidValidity: 7, messages: [{ uid: 1, source: mail({ id: '<lim@a>' }) }] };
    const { poller, handled } = setup(inbox);
    await poller.tick();
    assert.strictEqual(handled[0].replyAllowed, false);
    assert.strictEqual(handled[0].replyBlockedReason, 'sender_limit');
  });

  await test('a refused login stops polling and asks the owner to reconnect; transient errors back off instead', async () => {
    accounts.connect({ ...base, uidNext: 1, uidValidity: '7' }, A);
    const bad = setup({ uidNext: 1, uidValidity: 7, messages: [] }, { authOk: false });
    await bad.poller.tick();
    assert.strictEqual(accounts.get(A).needsReconnect, true);
    assert.match(accounts.get(A).lastError, /IMAP login was refused/);
    assert.strictEqual(accounts.publicView(A).connected, false);
    const calls = bad.servers.log.imap.length;
    await bad.poller.tick();
    assert.strictEqual(bad.servers.log.imap.length, calls, 'no more login attempts until reconnected (avoids locking the account)');

    accounts.connect({ ...base, uidNext: 1, uidValidity: '7' }, A);
    accounts.patch({ failures: 5, lastErrorAt: new Date().toISOString(), lastError: 'timeout' }, A);
    const waiting = setup({ uidNext: 1, uidValidity: 7, messages: [] });
    await waiting.poller.tick();
    assert.strictEqual(waiting.servers.log.imap.length, 0, 'backing off after repeated failures');
  });

  await test('workspaces are polled independently with their own mailbox', async () => {
    accounts.connect({ ...base, email: 'a@a.com', user: 'a@a.com', uidNext: 1, uidValidity: '7' }, A);
    accounts.connect({ ...base, email: 'b@b.com', user: 'b@b.com', uidNext: 1, uidValidity: '7' }, B);
    const servers = fakeServers({ inboxFor: (user) => ({ uidNext: 2, uidValidity: 7, messages: [{ uid: 1, source: mail({ subject: `for ${user}`, id: `<${user}>` }) }] }) });
    const handled = [];
    const poller = createEmailPoller({ handle: async (p, ws) => handled.push([ws, p.subject]), deps: servers.deps, simpleParser });
    await poller.tick();
    assert.deepStrictEqual(handled.sort(), [[A, 'for a@a.com'], [B, 'for b@b.com']].sort());
    accounts.disconnect(B);
  });

  // ----------------------------------------------------------------------------- the agent reply path
  await test('replies leave through the workspace mailbox, threaded, and count toward the limits', async () => {
    accounts.connect({ ...base, uidNext: 1, uidValidity: '7' }, A);
    const sent = [];
    const realSend = mailbox.sendFrom;
    mailbox.sendFrom = async (acct, m) => {
      sent.push({ acct: acct.email, ...m });
      return { messageId: '<r@x>' };
    };
    const agent = { chat: async () => ({ reply: 'Yes, we can automate that.', leadTemperature: 'warm', leadScore: 40, intent: 'SERVICE_QUERY', captureLead: true }) };
    try {
      const r = await ctx.run(A, () => emailChannel.scoreAndReply({}, agent, { from: 'Ravi <ravi@acmeretail.in>', subject: 'Automation', text: 'Can you help?', messageId: '<q1@acme>', references: '<q0@acme>' }));
      assert.ok(r.agentResult);
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].acct, 'info@tecavy.com');
      assert.strictEqual(sent[0].to, 'ravi@acmeretail.in');
      assert.strictEqual(sent[0].subject, 'Re: Automation');
      assert.strictEqual(sent[0].inReplyTo, '<q1@acme>');
      assert.strictEqual(sent[0].references, '<q0@acme> <q1@acme>');
      assert.strictEqual(accounts.get(A).sent.length, 1);

      const blocked = await ctx.run(A, () => emailChannel.scoreAndReply({}, agent, { from: 'ravi@acmeretail.in', subject: 'Again', text: 'More', messageId: '<q2@acme>', replyAllowed: false, replyBlockedReason: 'sender_limit' }));
      assert.strictEqual(blocked.skipped, true);
      assert.strictEqual(sent.length, 1, 'nothing sent when blocked');
    } finally {
      mailbox.sendFrom = realSend;
    }
  });

  await test('with auto-reply switched off the lead is captured and nothing is sent', async () => {
    require('../companyKnowledge').saveProfile({ emailAutoReply: false }, A);
    const realSend = mailbox.sendFrom;
    let sends = 0;
    mailbox.sendFrom = async () => {
      sends += 1;
      return {};
    };
    try {
      const r = await ctx.run(A, () => emailChannel.scoreAndReply({}, { chat: async () => ({ reply: 'x' }) }, { from: 'q@z.com', subject: 's', text: 't', messageId: '<off@a>' }));
      assert.strictEqual(r.reason, 'auto_reply_disabled');
      assert.strictEqual(sends, 0);
    } finally {
      mailbox.sendFrom = realSend;
      require('../companyKnowledge').saveProfile({ emailAutoReply: true }, A);
    }
  });

  // ----------------------------------------------------------------------------- API
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const w = req.get('x-ws');
    if (!w) return res.status(401).json({ success: false, error: 'Sign in required' });
    req.appUser = { id: `u-${w}`, email: 'o@example.com', role: req.get('x-role') || 'admin', workspaceId: w };
    ctx.run(w, next);
  });
  emailChannel.mountRoutes(app, { vertex: {}, leadAgent: {}, requireAuth: (_q, _s, n) => n() });
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, { ws = A, role, body } = {}) => {
    const res = await fetch(url + p, { method, headers: { 'x-ws': ws, ...(role ? { 'x-role': role } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() };
  };
  const realVerify = mailbox.verifyAccount;

  await test('API: connect verifies first, hides the password, and a failed check saves nothing', async () => {
    accounts.disconnect(A);
    mailbox.verifyAccount = async () => {
      throw new Error('The IMAP login was refused. Gmail needs an App Password, not your normal password.');
    };
    const bad = await call('PUT', '/api/email/account', { body: { provider: 'gmail', email: 'x@gmail.com', password: 'nope' } });
    assert.strictEqual(bad.status, 400);
    assert.match(bad.json.error, /App Password/);
    assert.strictEqual(accounts.get(A), null, 'nothing saved when the check fails');

    mailbox.verifyAccount = async (acct) => {
      assert.strictEqual(acct.password, 'abcdefghijklmnop', 'Google app passwords are pasted with spaces; they are removed');
      return { uidNext: 20, uidValidity: '3' };
    };
    const ok = await call('PUT', '/api/email/account', { body: { provider: 'gmail', email: 'Info@Tecavy.com', password: 'abcd efgh ijkl mnop', fromName: 'Tecavy' } });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.json.data.email, 'info@tecavy.com');
    assert.strictEqual(ok.json.data.connected, true);
    assert.ok(!JSON.stringify(ok.json).includes('abcdefghijklmnop') && !JSON.stringify(ok.json).includes('passwordEnc'));
    assert.strictEqual(accounts.get(A).lastUid, 19);
    assert.strictEqual((await call('GET', '/api/email/account', { ws: B })).json.data.connected, false, 'other workspaces see nothing');
  });

  await test('API: bad input, non-admins and too many attempts are refused', async () => {
    const put = (body, o = {}) => call('PUT', '/api/email/account', { body, ...o, ws: o.ws || `ws-test-em3-${stamp}` });
    assert.match((await put({ provider: 'gmail', email: 'not-an-email', password: 'x' })).json.error, /valid email/);
    assert.match((await put({ provider: 'gmail', email: 'a@b.com', password: '' })).json.error, /password/);
    assert.match((await put({ provider: 'bogus', email: 'a@b.com', password: 'x' })).json.error, /provider/);
    assert.match((await put({ provider: 'custom', email: 'a@b.com', password: 'x', smtp: { host: '127.0.0.1', port: 587 }, imap: { host: 'imap.b.com' } })).json.error, /valid SMTP server/);
    assert.strictEqual((await put({ provider: 'gmail', email: 'a@b.com', password: 'x' }, { role: 'member' })).status, 403);
    assert.strictEqual((await call('DELETE', '/api/email/account', { role: 'member' })).status, 403);
    const ws = `ws-test-em4-${stamp}`;
    let last;
    for (let i = 0; i < 9; i += 1) last = await call('PUT', '/api/email/account', { ws, body: { provider: 'gmail', email: 'a@b.com', password: 'x' } });
    assert.strictEqual(last.status, 429);
  });

  await test('API: the test message goes only to the connected address; disconnect removes everything', async () => {
    const realSend = mailbox.sendFrom;
    const sent = [];
    mailbox.sendFrom = async (a, m) => {
      sent.push(m);
      return {};
    };
    try {
      const r = await call('POST', '/api/email/account/test', { body: { to: 'victim@elsewhere.com' } });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(sent[0].to, 'info@tecavy.com', 'the recipient cannot be chosen by the caller');
      assert.strictEqual((await call('POST', '/api/email/account/test', { ws: B })).status, 400, 'no mailbox, no test');
    } finally {
      mailbox.sendFrom = realSend;
    }
    const toggled = await call('PUT', '/api/email/auto-reply', { body: { enabled: false } });
    assert.strictEqual(toggled.json.data.autoReply, false);
    await call('PUT', '/api/email/auto-reply', { body: { enabled: true } });
    const gone = await call('DELETE', '/api/email/account');
    assert.strictEqual(gone.json.data.connected, false);
    assert.strictEqual(accounts.get(A), null);
  });
  mailbox.verifyAccount = realVerify;

  server.close();
  for (const w of [A, B, `ws-test-em3-${stamp}`, `ws-test-em4-${stamp}`]) {
    try {
      accounts.disconnect(w);
    } catch {
      /* ignore */
    }
    fs.rmSync(path.join(__dirname, '..', 'data', 'company', 'workspaces', w), { recursive: true, force: true });
  }
  void leadsCrm;
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  setTimeout(() => process.exit(failures ? 1 : 0), 100);
})();
