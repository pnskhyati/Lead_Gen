/* Run: node growth/growth.test.js — appointments, performance, signals, actions, competitor watch and autopilot (all data simulated). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const appointments = require('./appointments');
const { computePerformance } = require('./performance');
const { computeSignals, visibilityDrops } = require('./signals');
const actions = require('./actions');
const competitors = require('./competitors');
const autopilot = require('./autopilot');

const WS = `ws-test-growth-${Date.now()}`;
const HOUR = 3_600_000;
const DAY = 86_400_000;
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

// A Monday, 09:00 in a UTC+0 business
const NOW = Date.parse('2026-11-16T09:00:00Z');
const lead = (id, over = {}) => ({ id, author: id, platform: 'Facebook', channel: 'facebook', status: 'new', temperature: 'cold', score: 10, createdAt: new Date(NOW - 2 * HOUR).toISOString(), ...over });

(async () => {
  appointments.saveSettings({ utcOffsetMinutes: 0, days: [1, 2, 3, 4, 5], start: '10:00', end: '12:00', slotMinutes: 30, daysAhead: 3, minNoticeHours: 2 }, WS);

  await test('slots stay inside business hours, skip weekends and respect minimum notice', () => {
    const settings = appointments.getSettings(WS);
    const slots = appointments.getSlots({ settings, now: NOW });
    assert.strictEqual(slots[0], '2026-11-16T11:00:00.000Z', '09:00 now + 2h notice: 10:00 is too soon');
    assert.ok(slots.every((s) => { const d = new Date(s); const m = d.getUTCHours() * 60 + d.getUTCMinutes(); return m >= 600 && m < 720 && d.getUTCDay() >= 1 && d.getUTCDay() <= 5; }));
    const sat = appointments.getSlots({ settings: { ...settings, daysAhead: 7 }, now: Date.parse('2026-11-20T13:00:00Z') });
    assert.ok(!sat.some((s) => [0, 6].includes(new Date(s).getUTCDay())), 'no weekend slots');
  });

  await test('a booking request opens once per person, and only a person can confirm it', () => {
    const lead1 = { id: 'L1', author: 'Ravi', channel: 'facebook' };
    const r1 = appointments.noteBookingIntent({ lead: lead1, text: 'Can I book a demo on Tuesday?', ws: WS });
    assert.ok(r1 && r1.status === 'pending');
    assert.strictEqual(appointments.noteBookingIntent({ lead: lead1, text: 'also a call please', ws: WS }), null, 'no second open request');
    assert.strictEqual(appointments.noteBookingIntent({ lead: lead1, text: 'what is the price?', ws: WS }), null, 'no booking words, no request');
    assert.throws(() => appointments.confirm(r1.id, '2026-11-17T03:00:00.000Z', { now: NOW }, WS), /not free|outside/);
    const ok = appointments.confirm(r1.id, '2026-11-17T10:00:00.000Z', { now: NOW, companyName: 'Tecavy' }, WS);
    assert.match(ok.message, /confirmed for Tue 17 Nov, 10:00 AM/);
    assert.match(ok.ics, /BEGIN:VEVENT/);
    assert.ok(!appointments.getSlots({ settings: appointments.getSettings(WS), requests: appointments.listRequests(WS), now: NOW }).includes('2026-11-17T10:00:00.000Z'), 'the confirmed time is no longer offered');
    assert.throws(() => appointments.confirm(r1.id, '2026-11-17T10:30:00.000Z', { now: NOW }, WS), /already confirmed/);
  });

  await test('the agent is only told free times, spread over different days', () => {
    const line = appointments.promptSlots(WS, NOW);
    assert.ok(line.split(';').length >= 2 && !/10:00 AM.*Tue 17 Nov, 10:00 AM/.test(line));
  });

  await test('performance compares sources only when each has enough leads, and says so otherwise', () => {
    const few = computePerformance({ leads: [lead('a'), lead('b', { channel: 'instagram', platform: 'Instagram' })], since: 0 });
    assert.strictEqual(few.insights[0].id, 'need-more-data');
    const leads = [];
    for (let i = 0; i < 12; i += 1) leads.push(lead(`ig${i}`, { channel: 'instagram', status: i < 2 ? 'qualified' : 'new' }));
    for (let i = 0; i < 6; i += 1) leads.push(lead(`g${i}`, { channel: 'web', attribution: { utm_campaign: 'search-b', utm_source: 'google' }, status: i < 4 ? 'qualified' : 'new' }));
    const p = computePerformance({ leads, requests: [], since: 0 });
    assert.strictEqual(p.rows.find((r) => r.kind === 'campaign').qualifiedRate, 67);
    const insight = p.insights.find((i) => i.suggestion);
    assert.match(insight.text, /Instagram brings the most enquiries \(12\), but google · search-b qualifies more/);
    assert.match(insight.suggestion, /controlled test/);
    assert.match(p.note, /No ad|no ad account|not included/i);
  });

  await test('signals list what needs a person first and count honestly', () => {
    const leads = [
      lead('h1', { status: 'handed_off' }),
      lead('hot1', { temperature: 'hot', score: 80 }),
      lead('old', { createdAt: new Date(NOW - 3 * DAY).toISOString() }),
      lead('quiet', { status: 'contacted', createdAt: new Date(NOW - 9 * DAY).toISOString(), lastMessageAt: new Date(NOW - 5 * DAY).toISOString() }),
      lead('done', { status: 'closed', temperature: 'hot' }),
    ];
    const s = computeSignals({
      leads,
      followUps: [{ status: 'pending', dueAt: new Date(NOW - HOUR).toISOString() }, { status: 'pending', dueAt: new Date(NOW + DAY).toISOString() }],
      replies: [{ status: 'pending_review' }, { status: 'sent' }],
      requests: [{ status: 'pending' }],
      visibilityPrompts: [{ recentRuns: [{ brandMentioned: false }, { brandMentioned: true }] }, { recentRuns: [{ brandMentioned: true }, { brandMentioned: true }] }],
      competitorChanges: [{ seen: false }, { seen: true }],
      now: NOW,
    });
    const by = Object.fromEntries(s.map((x) => [x.id, x]));
    assert.deepStrictEqual(s.slice(0, 2).map((x) => x.id).sort(), ['handoffs', 'hot']);
    assert.strictEqual(by.hot.count, 1, 'a closed lead is not counted');
    assert.strictEqual(by.followups.count, 1, 'only the due follow-up');
    assert.strictEqual(by['leak-new'].count, 1, 'only "old" is new and over a day old; the recent hot lead and the contacted one are not leaks');
    assert.strictEqual(by['leak-stalled'].count, 1, 'the contacted lead quiet for 5 days');
  });

  await test('brand dropping out of an AI answer is noticed only when it was there before', () => {
    assert.strictEqual(visibilityDrops([{ recentRuns: [{ brandMentioned: false }, { brandMentioned: true }] }]), 1);
    assert.strictEqual(visibilityDrops([{ recentRuns: [{ brandMentioned: false }] }]), 0, 'one answer is not a trend');
    assert.strictEqual(visibilityDrops([{ recentRuns: [{ error: 'x' }, { brandMentioned: true }, { brandMentioned: true }] }]), 0, 'failed runs are ignored');
  });

  await test('actions: proposed once, approved by a person, and the real result is recorded', async () => {
    const proposals = await actions.recommend({ leads: [lead('hotA', { temperature: 'hot', score: 90, intentSummary: 'Wants a demo' })], profile: { companyName: 'Tecavy' }, draftFollowUp: async () => { throw new Error('ai down'); } });
    assert.strictEqual(proposals.length, 1);
    assert.match(proposals[0].payload.text, /^Hi hotA, thanks for getting in touch with Tecavy/, 'falls back to a plain template');
    const first = actions.add(proposals[0], WS, NOW);
    assert.ok(first);
    assert.strictEqual(actions.add(proposals[0], WS, NOW), null, 'the same action is not added twice');
    let sent = null;
    const deps = { sendLeadReply: async (id, text) => { sent = { id, text }; return { delivered: false }; } };
    const done = await actions.approve(first.id, { text: 'Hi, shall we talk Tuesday?' }, deps, WS);
    assert.strictEqual(done.status, 'done');
    assert.deepStrictEqual(sent, { id: 'hotA', text: 'Hi, shall we talk Tuesday?' }, 'the edited text is what is sent');
    assert.match(done.result, /cannot be messaged automatically/, 'does not claim delivery that did not happen');
    await assert.rejects(() => actions.approve(first.id, {}, deps, WS), /already done/);
  });

  await test('a failed action is recorded with the reason and may be proposed again', async () => {
    const [p] = await actions.recommend({ leads: [lead('hotB', { temperature: 'hot', score: 70 })], profile: {} });
    const a = actions.add(p, WS, NOW);
    const failed = await actions.approve(a.id, {}, { sendLeadReply: async () => { throw new Error('token expired'); } }, WS);
    assert.deepStrictEqual([failed.status, failed.error], ['failed', 'token expired']);
    assert.ok(actions.add(p, WS, NOW + 1000), 'proposed again after a failure');
  });

  await test('a dismissed action stays away for a week', async () => {
    const [p] = await actions.recommend({ leads: [lead('hotC', { temperature: 'hot', score: 70 })], profile: {} });
    const a = actions.add(p, WS, NOW);
    actions.dismiss(a.id, WS);
    assert.strictEqual(actions.add(p, WS, NOW + DAY), null);
    assert.ok(actions.add(p, WS, NOW + 8 * DAY));
  });

  await test('competitor watch refuses private addresses', async () => {
    for (const u of ['http://localhost:4000/x', 'http://127.0.0.1/', 'http://192.168.1.5/a', 'http://10.0.0.2/', 'http://[::1]/', 'ftp://example.com/', 'http://user:pw@example.com/']) {
      await assert.rejects(() => competitors.assertPublicUrl(u), undefined, u);
    }
    assert.ok(competitors.isPrivateIp('169.254.169.254') && competitors.isPrivateIp('172.20.0.1') && !competitors.isPrivateIp('8.8.8.8'));
  });

  await test('competitor watch: the first look is a baseline, a real change is reported, a trivial one is not', async () => {
    const watch = await competitors.add({ url: 'https://8.8.8.8/pricing', label: 'Rival' }, WS);
    const page = (extra = '') => `<html><title>Rival</title><body><h1>Pricing</h1><p>Starter plan ₹999/month</p><p>Pro plan ₹2,999/month</p><p>Support included</p>${extra}</body></html>`;
    let html = page();
    const run = () => competitors.scan({ vertex: null, fetch: async () => html, now: () => NOW }, WS);
    assert.deepStrictEqual(await run(), [], 'baseline: nothing reported');
    html = page('<p>Updated Nov 16</p>');
    assert.deepStrictEqual(await run(), [], 'one extra line is not a meaningful change');
    html = `<html><title>Rival</title><body><h1>Pricing</h1><p>Starter plan ₹799/month</p><p>Pro plan ₹2,999/month</p><p>Support included</p><p>New: free trial for 30 days</p><p>New: annual discount</p></body></html>`;
    const [change] = await run();
    assert.ok(change, 'reported');
    assert.ok(change.priceChanges.added.some((x) => x.includes('799')), 'the new price is named');
    assert.match(change.summary, /Prices on the page changed/);
    assert.strictEqual(competitors.list(WS)[0].id, watch.id);
    assert.strictEqual(competitors.changes(WS).length, 1);
  });

  await test('autopilot only proposes: it runs a cycle, writes a brief with goal progress, and sends nothing', async () => {
    autopilot.saveSettings({ enabled: true, goal: '20 qualified leads a month', targetQualified: 20 }, WS);
    let sentAnything = false;
    const leads = [lead('hotD', { temperature: 'hot', score: 85, intentSummary: 'Asked about pricing' }), lead('q1', { status: 'qualified' })];
    const deps = {
      now: () => NOW,
      profile: { companyName: 'Tecavy' },
      draftFollowUp: async () => 'Hi, thanks for asking about pricing. Free for a short call this week?',
      radarSuggest: async () => ['best ai automation partner for a small business'],
      scanCompetitors: async () => [],
      leads: async () => leads,
      followUps: async () => [],
      replies: async () => [],
      prompts: async () => [],
      sendLeadReply: async () => { sentAnything = true; },
    };
    const r = await autopilot.runCycle(deps, WS);
    assert.strictEqual(sentAnything, false, 'nothing is sent without approval');
    assert.ok(r.added.some((a) => a.type === 'follow_up_lead' && a.status === 'pending'));
    assert.ok(r.added.some((a) => a.type === 'track_phrases'));
    assert.match(r.brief.goalProgress.text, /1 of 20 qualified leads .* \(5%\)/);
    const again = await autopilot.runCycle(deps, WS);
    assert.strictEqual(again.added.length, 0, 'the same suggestions are not piled up again');
    assert.strictEqual(autopilot.isDue({ enabled: true, cadenceHours: 24, lastRunAt: new Date(NOW).toISOString() }, NOW + HOUR), false);
    assert.strictEqual(autopilot.isDue({ enabled: true, cadenceHours: 24, lastRunAt: new Date(NOW).toISOString() }, NOW + 25 * HOUR), true);
  });

  const f = path.join(__dirname, '..', 'data', 'growth.json');
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (j.workspaces) delete j.workspaces[WS];
    fs.writeFileSync(f, JSON.stringify(j, null, 2));
  } catch {
    /* nothing stored */
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  setTimeout(() => process.exit(failures ? 1 : 0), 100);
})();
