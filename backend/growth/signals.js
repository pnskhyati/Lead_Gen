/**
 * "What requires attention right now?" Worked out from what is really in the workspace, most urgent first.
 * red = a person is needed now, yellow = attention soon, green = an opportunity or a good-to-know.
 */
const HOUR = 3_600_000;
const DAY = 86_400_000;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const time = (l) => new Date(l.lastMessageAt || l.createdAt).getTime();

/** For each question, did the newest answer drop the brand when the one before it had it? */
function visibilityDrops(prompts = []) {
  let dropped = 0;
  for (const p of prompts) {
    const runs = (p.recentRuns || []).filter((r) => !r.error);
    if (runs.length < 2) continue;
    const [now, before] = runs; // newest first
    const had = (r) => r.brandMentioned || r.domainCited;
    if (had(before) && !had(now)) dropped += 1;
  }
  return dropped;
}

function computeSignals({ leads = [], followUps = [], replies = [], requests = [], visibilityPrompts = [], competitorChanges = [], performance = null, now = Date.now() }) {
  const out = [];
  const open = leads.filter((l) => l.status !== 'closed');

  const handoffs = open.filter((l) => l.status === 'handed_off');
  if (handoffs.length) out.push({ id: 'handoffs', level: 'red', count: handoffs.length, text: `${plural(handoffs.length, 'conversation needs', 'conversations need')} a person`, link: { category: 'inbox', sub: 'inbox' } });

  const hot = open.filter((l) => l.temperature === 'hot' && l.status !== 'handed_off');
  if (hot.length) out.push({ id: 'hot', level: 'red', count: hot.length, text: `${plural(hot.length, 'high-intent lead', 'high-intent leads')} detected`, link: { category: 'leads', sub: 'all-leads' } });

  const waiting = replies.filter((r) => r.status === 'pending_review' || r.status === 'needs_human' || r.status === 'failed');
  if (waiting.length) out.push({ id: 'replies', level: 'yellow', count: waiting.length, text: `${plural(waiting.length, 'reply is', 'replies are')} waiting for you on social media`, link: { category: 'autoreply', sub: 'overview' } });

  const due = followUps.filter((f) => f.status === 'pending' && new Date(f.dueAt).getTime() <= now);
  if (due.length) out.push({ id: 'followups', level: 'yellow', count: due.length, text: `${plural(due.length, 'follow-up is', 'follow-ups are')} due`, link: { category: 'followups', sub: 'follow-ups' } });

  const pendingBookings = requests.filter((r) => r.status === 'pending');
  if (pendingBookings.length) out.push({ id: 'bookings', level: 'yellow', count: pendingBookings.length, text: `${plural(pendingBookings.length, 'appointment request needs', 'appointment requests need')} confirming`, link: { category: 'actions', sub: 'appointments' } });

  // Lead leakage: people who wrote in and never got anywhere.
  const unanswered = open.filter((l) => l.status === 'new' && now - new Date(l.createdAt).getTime() > 24 * HOUR);
  if (unanswered.length) out.push({ id: 'leak-new', level: 'yellow', count: unanswered.length, text: `${plural(unanswered.length, 'lead has', 'leads have')} had no follow-up for over a day`, link: { category: 'leads', sub: 'all-leads' } });
  const stalled = open.filter((l) => l.status === 'contacted' && now - time(l) > 3 * DAY);
  if (stalled.length) out.push({ id: 'leak-stalled', level: 'yellow', count: stalled.length, text: `${plural(stalled.length, 'conversation has', 'conversations have')} gone quiet for 3+ days`, link: { category: 'leads', sub: 'all-leads' } });

  const dropped = visibilityDrops(visibilityPrompts);
  if (dropped) out.push({ id: 'ai-visibility', level: 'yellow', count: dropped, text: `Your brand disappeared from ${plural(dropped, 'AI answer', 'AI answers')} it was in before`, link: { category: 'seo', sub: 'overview' } });

  const changes = competitorChanges.filter((c) => !c.seen);
  if (changes.length) out.push({ id: 'competitors', level: 'green', count: changes.length, text: `${plural(changes.length, 'competitor page changed', 'competitor pages changed')}`, link: { category: 'actions', sub: 'competitors' } });

  const insight = performance?.insights?.find((i) => i.suggestion);
  if (insight) out.push({ id: 'performance', level: 'green', count: 1, text: insight.text, link: { category: 'actions', sub: 'performance' } });

  const rank = { red: 0, yellow: 1, green: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

module.exports = { computeSignals, visibilityDrops };
