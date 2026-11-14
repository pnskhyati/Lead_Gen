/**
 * One store for everything the growth features keep per workspace: recommended actions, appointment requests,
 * the competitor watch list and the autopilot settings.
 */
const path = require('path');
const { createWorkspaceStore } = require('../wsStore');

const DEFAULT_APPOINTMENT_SETTINGS = () => ({
  enabled: true,
  days: [1, 2, 3, 4, 5], // 0 = Sunday
  start: '10:00',
  end: '18:00',
  slotMinutes: 30,
  daysAhead: 7,
  minNoticeHours: 4,
  utcOffsetMinutes: -new Date().getTimezoneOffset(),
});

const store = createWorkspaceStore(path.join(__dirname, '..', 'data', 'growth.json'), {
  actions: [],
  appointments: { settings: null, requests: [] },
  competitors: { list: [], snapshots: {}, changes: [] },
  autopilot: { enabled: false, goal: '', targetQualified: 0, cadenceHours: 24, lastRunAt: null, lastRadarAt: null, brief: null },
});

module.exports = { store, DEFAULT_APPOINTMENT_SETTINGS };
