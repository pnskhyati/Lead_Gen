/**
 * Talking to a mailbox: check the login, send, and read new messages. The mail libraries are injectable so tests
 * run without a mail server. Every connection goes to an address we resolved ourselves and verified is public.
 */
const dns = require('dns').promises;
const net = require('net');
const { isPrivateIp } = require('../seoGeo/ssrf');

const TIMEOUT = 20_000;
const MAX_MESSAGE_BYTES = 256 * 1024;

const smtpAuth = (a) => (a.authType === 'oauth' ? { type: 'OAuth2', user: a.user, accessToken: a.accessToken } : { user: a.user, pass: a.password });
const imapAuth = (a) => (a.authType === 'oauth' ? { user: a.user, accessToken: a.accessToken } : { user: a.user, pass: a.password });

const realDeps = () => ({
  createTransport: (opts) => require('nodemailer').createTransport(opts),
  ImapFlow: require('imapflow').ImapFlow,
  lookup: (host) => dns.lookup(host, { all: true }),
});

/** Resolve once, refuse private addresses, and return the address to connect to (the name is kept for TLS). */
async function publicAddress(host, lookup) {
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('That mail server address is not allowed.');
    return host;
  }
  let found;
  try {
    found = await lookup(host);
  } catch {
    throw new Error(`Could not find the mail server "${host}". Check the name.`);
  }
  if (!found.length || found.some((f) => isPrivateIp(f.address))) throw new Error('That mail server address is not allowed.');
  // Many networks cannot reach IPv6 even when the name has an IPv6 record, so prefer IPv4.
  return (found.find((f) => net.isIPv4(f.address)) || found[0]).address;
}

function friendly(err, account, kind) {
  const raw = String(err?.responseText || err?.response || err?.message || err);
  if (/not allowed|Could not find the mail server/.test(raw)) return raw;
  if (err?.authenticationFailed || err?.code === 'EAUTH' || /auth|invalid credentials|login failed|password/i.test(raw)) {
    if (account.authType === 'oauth') return `The ${kind} sign-in was refused. Sign in again to reconnect.`;
    const hint = account.provider === 'gmail' ? ' Gmail needs an App Password, not your normal password.' : ' Use an app password if your provider offers one.';
    return `The ${kind} login was refused.${hint}`;
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(raw)) return `Could not find the ${kind} server. Check the server name.`;
  if (/ECONNREFUSED|ETIMEDOUT|timed? ?out|ESOCKET/i.test(raw)) return `Could not reach the ${kind} server (${kind === 'SMTP' ? account.smtp.host : account.imap.host}). Check the server and port.`;
  if (/certificate|TLS|SSL/i.test(raw)) return `The ${kind} server's security certificate was not accepted.`;
  return `${kind} error: ${raw.slice(0, 160)}`;
}

async function smtpTransport(account, deps) {
  const ip = await publicAddress(account.smtp.host, deps.lookup);
  return deps.createTransport({
    host: ip,
    port: account.smtp.port,
    secure: account.smtp.secure,
    requireTLS: !account.smtp.secure,
    auth: smtpAuth(account),
    tls: { servername: account.smtp.host },
    connectionTimeout: TIMEOUT,
    greetingTimeout: TIMEOUT,
    socketTimeout: TIMEOUT * 2,
  });
}

async function imapClient(account, deps) {
  const ip = await publicAddress(account.imap.host, deps.lookup);
  return new deps.ImapFlow({
    host: ip,
    port: account.imap.port,
    secure: account.imap.secure,
    servername: account.imap.host,
    auth: imapAuth(account),
    logger: false,
    connectionTimeout: TIMEOUT,
    greetingTimeout: TIMEOUT,
    socketTimeout: TIMEOUT * 2,
  });
}

/** Check both logins. Returns where the inbox currently ends, so only later mail is ever answered. */
async function verifyAccount(account, deps = realDeps()) {
  try {
    const t = await smtpTransport(account, deps);
    await t.verify();
  } catch (err) {
    throw new Error(friendly(err, account, 'SMTP'));
  }
  let client;
  try {
    client = await imapClient(account, deps);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    try {
      return { uidNext: client.mailbox.uidNext, uidValidity: String(client.mailbox.uidValidity) };
    } finally {
      lock.release();
    }
  } catch (err) {
    throw new Error(friendly(err, account, 'IMAP'));
  } finally {
    try {
      await client?.logout();
    } catch {
      /* closing is best-effort */
    }
  }
}

async function sendFrom(account, { to, subject, text, inReplyTo, references }, deps = realDeps()) {
  try {
    const t = await smtpTransport(account, deps);
    const info = await t.sendMail({
      from: account.fromName ? { name: account.fromName, address: account.email } : account.email,
      to,
      subject,
      text,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
    });
    return { messageId: info.messageId, accepted: info.accepted };
  } catch (err) {
    throw new Error(friendly(err, account, 'SMTP'));
  }
}

/**
 * New messages after account.lastUid, oldest first, at most `max`. Nothing is marked read or moved.
 * If the server reset its numbering (uidValidity changed) we skip ahead rather than re-answer old mail.
 */
async function fetchNew(account, { max = 20 } = {}, deps = realDeps()) {
  let client;
  try {
    client = await imapClient(account, deps);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    try {
      const validity = String(client.mailbox.uidValidity);
      if (account.uidValidity && account.uidValidity !== validity) {
        return { messages: [], reset: { uidNext: client.mailbox.uidNext, uidValidity: validity } };
      }
      const messages = [];
      if (client.mailbox.uidNext > account.lastUid + 1) {
        for await (const m of client.fetch(`${account.lastUid + 1}:*`, { uid: true, source: { maxBytes: MAX_MESSAGE_BYTES } }, { uid: true })) {
          if (m.uid > account.lastUid) messages.push({ uid: m.uid, source: m.source });
          if (messages.length >= max * 3) break;
        }
      }
      messages.sort((a, b) => a.uid - b.uid);
      return { messages: messages.slice(0, max), uidValidity: validity };
    } finally {
      lock.release();
    }
  } catch (err) {
    const e = new Error(friendly(err, account, 'IMAP'));
    e.auth = Boolean(err?.authenticationFailed);
    throw e;
  } finally {
    try {
      await client?.logout();
    } catch {
      /* best-effort */
    }
  }
}

module.exports = { verifyAccount, sendFrom, fetchNew, publicAddress, realDeps };
