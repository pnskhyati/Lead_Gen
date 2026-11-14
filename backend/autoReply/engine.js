/**
 * The auto-reply loop. Every couple of minutes it asks each connected channel for new messages, decides what to do with
 * each one, and either sends the reply (auto mode), queues it for the owner (review mode) or leaves it alone.
 *
 * Safety rules that always apply:
 *  - only messages that arrived AFTER the channel was switched on are answered (never the backlog)
 *  - each message is looked at once; a failed send is shown to the owner and not retried on its own
 *  - a daily limit and a per-check limit cap how much is posted
 *  - spam, abuse and sensitive messages are never answered publicly
 */
const crypto = require('crypto');
const workspaceContext = require('../workspaceContext');
const defaultStore = require('./store');
const defaultWriter = require('./writer');
const { explainError } = require('./adapters');

const LEAD_INTENTS = new Set(['pricing', 'buying', 'complaint', 'interest']);
const DM_SKIP_REASON = {
  handoff: 'A person is already handling this conversation',
  auto_reply_disabled: 'Auto-reply is switched off for this platform in your business settings',
  echo: 'Our own message',
};

/** What this app cannot automate, and why, shown to the owner so nothing is silently missing. */
const UNSUPPORTED = [
  { id: 'whatsapp', label: 'WhatsApp', reason: 'WhatsApp only delivers messages to a public web address, and cannot be checked from here. It needs the app to be reachable on the internet with a valid access token.' },
  { id: 'email', label: 'Email', reason: 'Already automatic. Replies are handled from the Email settings in Connections.' },
];

function createEngine({
  vertex,
  leadAgent,
  adapters,
  store = defaultStore,
  writer = defaultWriter,
  getProfile = (ws) => require('../companyKnowledge').getProfile(ws),
  leads = () => require('../leadsCrm'),
  now = () => Date.now(),
  maxSendsPerRun = 5,
  intervalMs = 120_000,
  log = console,
}) {
  let timer = null;
  let ticking = false;
  const iso = () => new Date(now()).toISOString();

  async function captureLead(def, id, msg, text, ws) {
    try {
      await leads().upsertLead({
        channel: def.platform,
        platform: `${def.label}`,
        externalId: `${id}:${msg.externalId}`,
        author: msg.author || 'user',
        customerComment: text,
        status: 'new',
      });
    } catch (err) {
      log.warn(`[AutoReply:${ws}] could not save lead:`, err.message);
    }
  }

  async function sendReply(ws, item, text) {
    const ad = adapters[item.channel];
    try {
      await ad.send(item, text);
      store.patchItem(item.id, { status: 'sent', finalText: text, sentAt: iso(), error: null }, ws);
      return true;
    } catch (err) {
      store.patchItem(item.id, { status: 'failed', finalText: text, error: explainError(err) }, ws);
      return false;
    }
  }

  async function runChannel(ws, id) {
    const def = store.CHANNELS[id];
    const ad = adapters[id];
    const state = store.read(ws);
    const mode = store.modeOf(state, id);
    if (mode === 'off') return { off: true };

    const run = { at: iso(), fetched: 0, drafted: 0, sent: 0, skipped: 0, needsHuman: 0, error: null };
    if (!ad.connected()) {
      run.error = 'Not connected';
      store.setLastRun(id, run, ws);
      return run;
    }

    const since = new Date(store.ensureSince(id, ws, now())).getTime();
    let messages;
    try {
      messages = await ad.fetch();
    } catch (err) {
      run.error = explainError(err);
      store.setLastRun(id, run, ws);
      return run;
    }

    const seen = store.seenSet(store.read(ws), id);
    const fresh = messages
      .filter((m) => m.externalId && !seen.has(m.externalId))
      .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    const profile = getProfile(ws);
    let sentThisRun = 0;

    for (const msg of fresh) {
      store.markSeen(id, msg.externalId, ws); // each message is looked at exactly once
      const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : now();
      if (Number.isFinite(ts) && ts < since) continue; // arrived before auto-reply was switched on
      run.fetched += 1;

      const item = {
        id: `ar-${now()}-${crypto.randomBytes(3).toString('hex')}`,
        channel: id,
        platform: def.platform,
        kind: def.kind,
        externalId: msg.externalId,
        author: msg.author || '',
        authorId: msg.authorId || null,
        text: String(msg.text || '').slice(0, 1000),
        context: String(msg.context || '').slice(0, 300),
        permalink: msg.permalink || '',
        receivedAt: msg.timestamp || iso(),
        createdAt: iso(),
        status: 'skipped',
        intent: 'other',
        draft: '',
        finalText: '',
        reason: '',
        auto: false,
        error: null,
        sentAt: null,
      };

      // Direct messages: the existing conversation agent writes the lead and sends the reply.
      if (def.kind === 'dm') {
        try {
          const r = await ad.handleDm(vertex, leadAgent, msg);
          item.intent = String(r?.agentResult?.intent || 'other').toLowerCase();
          if (r?.skipped) {
            item.reason = DM_SKIP_REASON[r.reason] || r.reason || 'Not answered';
            run.skipped += 1;
          } else if (r?.sent) {
            item.status = 'sent';
            item.auto = true;
            item.finalText = r.agentResult?.reply || '';
            item.sentAt = iso();
            run.sent += 1;
            if (r.agentResult?.needsHandoff) {
              item.reason = 'Answered, and handed to a person for follow-up';
              run.needsHuman += 1;
            }
          } else {
            item.status = 'failed';
            item.error = r?.sendError || 'The message could not be sent';
          }
        } catch (err) {
          item.status = 'failed';
          item.error = explainError(err);
        }
        store.addItem(item, ws);
        continue;
      }

      // Public comments and mentions.
      const d = await writer.decide(vertex, { platform: def.platform, text: item.text, author: item.author, context: item.context }, { profile, ws });
      item.intent = d.intent;
      item.reason = d.reason;
      if (d.action === 'skip') {
        run.skipped += 1;
        store.addItem(item, ws);
        continue;
      }
      if (d.action === 'handoff') {
        item.status = 'needs_human';
        run.needsHuman += 1;
        store.addItem(item, ws);
        await captureLead(def, id, msg, item.text, ws);
        continue;
      }

      item.draft = d.text;
      item.status = 'pending_review';
      run.drafted += 1;
      store.addItem(item, ws);
      if (LEAD_INTENTS.has(d.intent)) await captureLead(def, id, msg, item.text, ws);

      const current = store.read(ws);
      const underCap = store.sentInLastDay(current, now()) < (current.settings?.dailyCap || store.DEFAULT_DAILY_CAP);
      if (mode === 'auto' && sentThisRun < maxSendsPerRun && underCap) {
        store.patchItem(item.id, { auto: true }, ws);
        if (await sendReply(ws, { ...item, auto: true }, d.text)) {
          run.sent += 1;
          sentThisRun += 1;
        }
      } else if (mode === 'auto') {
        store.patchItem(item.id, { reason: `${d.reason} (waiting for your OK: the sending limit was reached)` }, ws);
      }
    }

    store.setLastRun(id, run, ws);
    return run;
  }

  async function runWorkspace(ws) {
    const out = {};
    await workspaceContext.run(ws, async () => {
      for (const id of Object.keys(store.CHANNELS)) {
        try {
          out[id] = await runChannel(ws, id);
        } catch (err) {
          out[id] = { error: err.message };
          log.warn(`[AutoReply:${ws}] ${id} failed:`, err.message);
        }
      }
    });
    return out;
  }

  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const ids = new Set(store.workspaceIds());
      for (const ad of Object.values(adapters)) for (const w of ad.workspaceIds()) ids.add(w);
      for (const ws of ids) await runWorkspace(ws);
    } finally {
      ticking = false;
    }
  }

  /** Send a queued reply, optionally with the owner's edited wording. */
  async function approve(ws, itemId, text) {
    return workspaceContext.run(ws, async () => {
      const item = store.getItem(itemId, ws);
      if (!item) throw new Error('Reply not found');
      if (!['pending_review', 'failed'].includes(item.status)) throw new Error('This reply is not waiting to be sent');
      const ad = adapters[item.channel];
      if (!ad.connected()) throw new Error('This account is not connected any more. Reconnect it in Connections.');
      const final = writer.cleanReply(text ?? item.draft, item.platform, getProfile(ws).websiteUrl);
      if (final.length < 2) throw new Error('Write a reply first');
      await sendReply(ws, item, final);
      return store.getItem(itemId, ws);
    });
  }

  function dismiss(ws, itemId) {
    const item = store.getItem(itemId, ws);
    if (!item) throw new Error('Reply not found');
    if (item.status === 'sent') throw new Error('Already sent');
    return store.patchItem(itemId, { status: 'dismissed' }, ws);
  }

  function status(ws) {
    const st = store.read(ws);
    const items = st.items || [];
    return {
      dailyCap: st.settings?.dailyCap || store.DEFAULT_DAILY_CAP,
      sentToday: store.sentInLastDay(st, now()),
      channels: Object.entries(store.CHANNELS).map(([id, def]) => {
        let connected = false;
        try {
          connected = Boolean(workspaceContext.run(ws, () => adapters[id].connected()));
        } catch {
          connected = false;
        }
        return {
          id,
          label: def.label,
          platform: def.platform,
          modes: def.modes,
          mode: store.modeOf(st, id),
          connected,
          since: store.sinceOf(st, id),
          lastRun: st.lastRun?.[id] || null,
          waiting: items.filter((i) => i.channel === id && i.status === 'pending_review').length,
        };
      }),
      unsupported: UNSUPPORTED,
    };
  }

  function start() {
    if (timer || String(process.env.AUTO_REPLY_POLLER || '').toLowerCase() === 'off') return;
    timer = setInterval(() => void tick().catch((err) => log.warn('[AutoReply] tick failed:', err.message)), intervalMs);
    timer.unref?.();
    setTimeout(() => void tick().catch((err) => log.warn('[AutoReply] first tick failed:', err.message)), 20_000).unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { tick, runWorkspace, runChannel, approve, dismiss, status, start, stop };
}

module.exports = { createEngine, UNSUPPORTED };
