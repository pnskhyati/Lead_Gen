/**
 * Checks every connected mailbox for new mail and hands each message to the lead agent.
 *
 * Delivery is at-most-once: the position in the inbox moves forward BEFORE a message is answered, so a crash can
 * lose one reply but can never send the same customer two. Mail that arrived before the mailbox was connected is
 * never touched, and nothing is marked read, moved or deleted.
 */
const accounts = require('./accounts');
const tokens = require('./tokens');
const mailbox = require('./mailbox');
const { toInbound } = require('./inbound');
const workspaceContext = require('../workspaceContext');

const MAX_PER_TICK = 20;
const BACKOFF_AFTER = 5; // consecutive failures
const BACKOFF_MS = 10 * 60_000;

/**
 * @param {{ handle: (payload: object, ws: string) => Promise<unknown>, deps?: object, simpleParser?: Function, intervalMs?: number }} opts
 */
function createEmailPoller({ handle, deps = mailbox.realDeps(), simpleParser = (src) => require('mailparser').simpleParser(src), intervalMs = 60_000 }) {
  const running = new Set();
  let timer = null;

  async function pollWorkspace(ws, now = Date.now()) {
    const stats = { fetched: 0, answered: 0, skipped: {}, error: null };
    let acct;
    try {
      acct = await tokens.getUsable(ws, now);
    } catch (err) {
      // Only a revoked sign-in or an unreadable stored secret needs the owner. A network blip while refreshing a token must not disconnect anyone.
      const needsOwner = Boolean(err.auth) || /unreadable/i.test(err.message);
      const current = accounts.get(ws);
      accounts.patch(
        needsOwner
          ? { lastError: err.message, needsReconnect: true }
          : { lastError: err.message, lastErrorAt: new Date(now).toISOString(), failures: (current?.failures || 0) + 1 },
        ws
      );
      stats.error = err.message;
      return stats;
    }
    if (!acct || acct.needsReconnect) return stats;
    if (acct.failures >= BACKOFF_AFTER && acct.lastErrorAt && now - new Date(acct.lastErrorAt).getTime() < BACKOFF_MS) return stats;

    try {
      const res = await mailbox.fetchNew(acct, { max: MAX_PER_TICK }, deps);
      if (res.reset) {
        accounts.patch({ lastUid: Math.max(0, res.reset.uidNext - 1), uidValidity: res.reset.uidValidity }, ws);
      }
      if (!acct.uidValidity && res.uidValidity) accounts.patch({ uidValidity: res.uidValidity }, ws);

      for (const m of res.messages) {
        stats.fetched += 1;
        accounts.patch({ lastUid: m.uid }, ws); // advance first: never answer the same message twice

        let parsed;
        try {
          parsed = await toInbound(m.source, simpleParser, acct.email);
        } catch (err) {
          stats.skipped.unreadable = (stats.skipped.unreadable || 0) + 1;
          console.warn(`[Email:${ws}] could not read message ${m.uid}:`, err.message);
          continue;
        }
        if (parsed.skip) {
          stats.skipped[parsed.skip] = (stats.skipped[parsed.skip] || 0) + 1;
          continue;
        }

        const { inbound } = parsed;
        const fresh = accounts.get(ws);
        if (inbound.messageId && fresh.seenIds.includes(inbound.messageId)) {
          stats.skipped.duplicate = (stats.skipped.duplicate || 0) + 1;
          continue;
        }
        accounts.patch({ seenIds: [...fresh.seenIds, inbound.messageId].filter(Boolean).slice(-200) }, ws);

        const senderAddress = (/<([^>]+)>/.exec(inbound.from)?.[1] || inbound.from).toLowerCase();
        const allowance = accounts.replyAllowance(senderAddress, ws, now);
        try {
          const result = await handle({ ...inbound, replyAllowed: allowance.ok, replyBlockedReason: allowance.reason }, ws);
          if (result && !result.skipped) stats.answered += 1;
          else stats.skipped[result?.reason || 'not_answered'] = (stats.skipped[result?.reason || 'not_answered'] || 0) + 1;
        } catch (err) {
          stats.skipped.agent_error = (stats.skipped.agent_error || 0) + 1;
          console.error(`[Email:${ws}] agent failed for message ${m.uid}:`, err.message);
        }
      }
      accounts.patch({ lastPollAt: new Date(now).toISOString(), lastError: null, lastErrorAt: null, failures: 0 }, ws);
    } catch (err) {
      stats.error = err.message;
      const failures = (acct.failures || 0) + 1;
      accounts.patch(
        { lastError: err.message, lastErrorAt: new Date(now).toISOString(), failures, ...(err.auth ? { needsReconnect: true } : {}) },
        ws
      );
    }
    return stats;
  }

  /** One pass over every connected workspace. Safe to call overlapping: a workspace is never polled twice at once. */
  async function tick(now = Date.now()) {
    const out = {};
    for (const [ws] of accounts.entries()) {
      if (running.has(ws)) continue;
      running.add(ws);
      try {
        out[ws] = await workspaceContext.run(ws, () => pollWorkspace(ws, now));
      } catch (err) {
        out[ws] = { error: err.message };
      } finally {
        running.delete(ws);
      }
    }
    return out;
  }

  function start() {
    if (timer || process.env.EMAIL_POLLER === 'off') return;
    timer = setInterval(() => void tick().catch((err) => console.warn('[Email] poll', err.message)), intervalMs);
    timer.unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { tick, pollWorkspace, start, stop };
}

module.exports = { createEmailPoller };
