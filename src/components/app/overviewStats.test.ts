/* Run: node src/components/app/overviewStats.test.ts — Overview numbers come from real leads only. */
import assert from 'node:assert';
import { buildActivities, computeStats, rangeFor } from './overviewStats.ts';

const NOW = new Date('2026-11-14T12:00:00').getTime();
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const lead = (id: string, ago: number, status: string, channel: string, extra: object = {}) =>
  ({ id, createdAt: day(ago), lastMessageAt: day(ago - 0.1), status, channel, platform: channel, author: id, score: 50, ...extra }) as never;

const leads = [
  lead('a', 0.2, 'new', 'facebook'),
  lead('b', 1, 'qualified', 'instagram'),
  lead('c', 2, 'closed', 'facebook'),
  lead('d', 3, 'handed_off', 'whatsapp', { followUps: [{ id: 'f1', status: 'pending', dueAt: day(1), title: 't', type: 'follow_up' }, { id: 'f2', status: 'pending', dueAt: new Date(NOW + 86_400_000).toISOString(), title: 't', type: 'follow_up' }] }),
  lead('old', 10, 'qualified', 'x'),
];

const r7 = rangeFor('Last 7 days', { startDate: '', endDate: '' }, NOW);
const s = computeStats(leads, r7, NOW);
assert.strictEqual(s.newLeads, 4, 'the 10-day-old lead is outside 7 days');
assert.strictEqual(s.qualified, 2, 'qualified and won count');
assert.strictEqual(s.won, 1);
assert.strictEqual(s.contacted, 3);
assert.strictEqual(s.qualRate, '50%');
assert.strictEqual(s.followUps, 2);
assert.strictEqual(s.dueText, '1 due');
assert.deepStrictEqual(s.channels.map((c) => [c.label, c.leads]), [['Facebook', 2], ['Instagram', 1], ['WhatsApp', 1]]);
assert.strictEqual(s.growth, '↑ 300%', 'one lead the 7 days before, four now');

const none = computeStats([], r7, NOW);
assert.deepStrictEqual([none.newLeads, none.qualRate, none.growth, none.channels.length], [0, '—', null, 0]);

const acts = buildActivities(leads, [{ id: 'p', ts: NOW - 1000, description: 'Published', icon: '🚀', iconColor: '', category: 'content' as never }], NOW);
assert.ok(acts.length >= 6 && acts[0].description === 'Published', 'newest first, extra events included');
assert.ok(acts.some((a) => /Needs a person · d/.test(a.description)));
assert.ok(!acts.some((a) => /Rahul|Aster|₹/.test(a.description)), 'no invented activity');
console.log('all passed');
