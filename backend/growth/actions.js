/**
 * The Action Center: recommended next steps, each with the reason, waiting for a person to approve or dismiss.
 * Nothing runs by itself. Approving runs one narrow, permitted action and records what happened.
 */
const crypto = require('crypto');
const { store } = require('./store');

const MAX_ACTIONS = 200;
const REPEAT_AFTER_DISMISS_MS = 7 * 86_400_000;
const REPEAT_AFTER_DONE_MS = 14 * 86_400_000;

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function list(ws, status) {
  const wanted = status ? String(status).split(',') : null;
  return store.read(ws).actions.filter((a) => !wanted || wanted.includes(a.status));
}

/** Adds an action unless the same one is already open, or was handled recently. Returns the stored action or null. */
function add(action, ws, now = Date.now()) {
  let stored = null;
  store.update((s) => {
    const same = s.actions.filter((a) => a.dedupeKey === action.dedupeKey);
    const blocked = same.some((a) => {
      const age = now - new Date(a.updatedAt || a.createdAt).getTime();
      if (a.status === 'pending') return true;
      if (a.status === 'dismissed') return age < REPEAT_AFTER_DISMISS_MS;
      if (a.status === 'done') return age < REPEAT_AFTER_DONE_MS;
      return false; // a failed action may be proposed again
    });
    if (blocked) return;
    stored = { id: `act-${now}-${crypto.randomBytes(2).toString('hex')}`, status: 'pending', createdAt: new Date(now).toISOString(), result: null, error: null, ...action };
    s.actions.unshift(stored);
    s.actions = s.actions.slice(0, MAX_ACTIONS);
  }, ws);
  return stored;
}

function patch(id, fields, ws) {
  let found = null;
  store.update((s) => {
    const a = s.actions.find((x) => x.id === id);
    if (a) {
      Object.assign(a, fields, { updatedAt: new Date().toISOString() });
      found = { ...a };
    }
  }, ws);
  return found;
}

function dismiss(id, ws) {
  const a = list(ws).find((x) => x.id === id);
  if (!a) throw new Error('Action not found');
  if (a.status !== 'pending') throw new Error(`This action is already ${a.status}`);
  return patch(id, { status: 'dismissed' }, ws);
}

/** Runs the approved action. `deps` holds the real senders so this stays testable. */
async function approve(id, { text } = {}, deps, ws) {
  const a = list(ws).find((x) => x.id === id);
  if (!a) throw new Error('Action not found');
  if (a.status !== 'pending') throw new Error(`This action is already ${a.status}`);
  try {
    let result = 'Done';
    if (a.type === 'follow_up_lead') {
      const message = clip(text ?? a.payload.text, 1500);
      if (!message) throw new Error('Write the message first.');
      const r = await deps.sendLeadReply(a.payload.leadId, message);
      result = r?.delivered ? 'Sent to the customer on their channel.' : 'Saved to the conversation. This channel cannot be messaged automatically, so contact them yourself.';
    } else if (a.type === 'track_phrases') {
      for (const p of a.payload.phrases || []) deps.addPrompt(p);
      result = `Now tracking ${(a.payload.phrases || []).length} questions in AI visibility.`;
    } else if (a.type === 'competitor_response') {
      const page = await deps.writePage(a.payload.topic, a.payload.kind || 'comparison');
      result = `Draft page written${page?.title ? `: "${page.title}"` : ''}. Review it in SEO / GEO, Write this page.`;
    } else if (a.type === 'insight') {
      result = 'Noted.';
    } else {
      throw new Error('Unknown action type');
    }
    return patch(id, { status: 'done', result, error: null }, ws);
  } catch (err) {
    return patch(id, { status: 'failed', error: err.message || String(err) }, ws);
  }
}

const firstName = (l) => String(l.author || '').trim().split(/\s+/)[0] || 'there';

/** A plain draft used when the AI is unavailable. Never invents facts. */
function templateFollowUp(lead, profile) {
  const about = lead.intentSummary ? ` about ${lead.intentSummary.replace(/^user\s+/i, '').replace(/\.$/, '').toLowerCase()}` : '';
  return `Hi ${firstName(lead)}, thanks for getting in touch with ${profile?.companyName || 'us'}${about}. Would a short call this week help? Tell me a day that suits you and I will arrange it.`;
}

/**
 * Turns the current picture into proposed actions. `draftFollowUp(lead)` may use AI; it falls back to a template.
 * Returns the proposals; the caller stores them with add().
 */
async function recommend({ leads = [], competitorChanges = [], radar = null, performance = null, profile = null, draftFollowUp = null }) {
  const out = [];
  const hot = leads
    .filter((l) => l.temperature === 'hot' && l.status !== 'closed' && l.status !== 'handed_off')
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);
  for (const l of hot) {
    let text = '';
    try {
      text = draftFollowUp ? await draftFollowUp(l) : '';
    } catch {
      text = '';
    }
    out.push({
      type: 'follow_up_lead',
      priority: 'red',
      dedupeKey: `follow:${l.id}`,
      title: `Follow up with ${l.author || l.phone || 'this lead'}`,
      why: `High-intent lead (score ${l.score || 0}) from ${l.platform || l.channel}${l.intentSummary ? `: ${l.intentSummary}` : ''}`,
      actionLabel: 'Send this message',
      payload: { leadId: l.id, text: clip(text, 1500) || templateFollowUp(l, profile) },
    });
  }

  for (const c of competitorChanges.filter((x) => !x.actioned).slice(0, 3)) {
    out.push({
      type: 'competitor_response',
      priority: 'green',
      dedupeKey: `competitor:${c.id}`,
      title: `Respond to a change on ${c.label || c.url}`,
      why: c.summary || 'A page you watch has changed.',
      actionLabel: 'Write a comparison page',
      payload: { topic: `${profile?.companyName || 'Our service'} compared with ${c.label || c.url}`, kind: 'comparison', changeId: c.id },
    });
  }

  if (radar?.phrases?.length) {
    out.push({
      type: 'track_phrases',
      priority: 'green',
      dedupeKey: `radar:${radar.phrases.slice(0, 3).join('|').toLowerCase()}`,
      title: `Start tracking ${radar.phrases.length} questions customers may be asking AI`,
      why: 'Questions where a buyer is choosing between providers. Tracking them shows whether AI assistants mention you.',
      actionLabel: 'Start tracking',
      payload: { phrases: radar.phrases },
    });
  }

  const insight = performance?.insights?.find((i) => i.suggestion);
  if (insight) {
    out.push({ type: 'insight', priority: 'green', dedupeKey: `insight:${insight.id}`, title: 'A pattern in where your leads come from', why: `${insight.text} ${insight.suggestion}`, actionLabel: 'Got it', payload: {} });
  }
  return out;
}

module.exports = { list, add, dismiss, approve, recommend, templateFollowUp };
