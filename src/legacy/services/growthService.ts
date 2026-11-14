const API_BASE = import.meta.env.VITE_API_URL || '';

export type SignalLevel = 'red' | 'yellow' | 'green';
export interface GrowthSignal {
  id: string;
  level: SignalLevel;
  count: number;
  text: string;
  link: { category: string; sub: string };
}

export interface GrowthAction {
  id: string;
  type: 'follow_up_lead' | 'track_phrases' | 'competitor_response' | 'insight';
  priority: SignalLevel;
  title: string;
  why: string;
  actionLabel: string;
  status: 'pending' | 'done' | 'dismissed' | 'failed';
  payload: { leadId?: string; text?: string; phrases?: string[]; topic?: string };
  result: string | null;
  error: string | null;
  createdAt: string;
}

export interface PerformanceRow {
  key: string;
  label: string;
  kind: 'campaign' | 'channel';
  enquiries: number;
  qualified: number;
  booked: number;
  won: number;
  qualifiedRate: number;
  bookedRate: number;
}
export interface Performance {
  days: number;
  total: number;
  qualified: number;
  booked: number;
  won: number;
  rows: PerformanceRow[];
  insights: { id: string; text: string; suggestion: string | null }[];
  note: string;
}

export interface AppointmentSettings {
  enabled: boolean;
  days: number[];
  start: string;
  end: string;
  slotMinutes: number;
  daysAhead: number;
  minNoticeHours: number;
  utcOffsetMinutes: number;
}
export interface AppointmentRequest {
  id: string;
  leadId: string | null;
  name: string;
  contact: string;
  channel: string;
  preferredText: string;
  status: 'pending' | 'confirmed' | 'declined';
  createdAt: string;
  confirmedSlot: string | null;
}
export interface Appointments {
  settings: AppointmentSettings;
  requests: AppointmentRequest[];
  slots: { iso: string; label: string }[];
}

export interface CompetitorWatch {
  id: string;
  url: string;
  label: string;
  lastCheckedAt: string | null;
  lastError: string | null;
}
export interface CompetitorChange {
  id: string;
  label: string;
  url: string;
  detectedAt: string;
  summary: string;
  added: string[];
  removed: string[];
  priceChanges: { added: string[]; removed: string[] };
  seen: boolean;
}

export interface AutopilotSettings {
  enabled: boolean;
  goal: string;
  targetQualified: number;
  cadenceHours: number;
  lastRunAt: string | null;
  brief: { generatedAt: string; goal: string | null; goalProgress: { text: string } | null; lines: string[]; notes: string[]; actionsAdded: number } | null;
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.error || `Request failed (${res.status})`);
  return json.data as T;
}

export const getSignals = () => call<GrowthSignal[]>('GET', '/api/growth/signals');
export const getActions = (status = 'pending,failed') => call<GrowthAction[]>('GET', `/api/growth/actions?status=${status}`);
export const refreshActions = () => call<{ added: number }>('POST', '/api/growth/actions/refresh', {});
export const approveAction = (id: string, text?: string) => call<GrowthAction>('POST', `/api/growth/actions/${encodeURIComponent(id)}/approve`, { text });
export const dismissAction = (id: string) => call<GrowthAction>('POST', `/api/growth/actions/${encodeURIComponent(id)}/dismiss`, {});
export const getPerformance = (days = 30) => call<Performance>('GET', `/api/growth/performance?days=${days}`);
export const getAppointments = () => call<Appointments>('GET', '/api/growth/appointments');
export const saveAppointmentSettings = (patch: Partial<AppointmentSettings>) => call<AppointmentSettings>('PUT', '/api/growth/appointments/settings', patch);
export const confirmAppointment = (id: string, slot: string) => call<{ label: string; message: string; delivered: boolean }>('POST', `/api/growth/appointments/${encodeURIComponent(id)}/confirm`, { slot });
export const declineAppointment = (id: string) => call<AppointmentRequest>('POST', `/api/growth/appointments/${encodeURIComponent(id)}/decline`, {});
export const getCompetitors = () => call<{ list: CompetitorWatch[]; changes: CompetitorChange[] }>('GET', '/api/growth/competitors');
export const addCompetitor = (url: string, label: string) => call<CompetitorWatch>('POST', '/api/growth/competitors', { url, label });
export const removeCompetitor = (id: string) => call<{ removed: boolean }>('DELETE', `/api/growth/competitors/${encodeURIComponent(id)}`);
export const scanCompetitors = () => call<{ changes: CompetitorChange[] }>('POST', '/api/growth/competitors/scan', {});
export const markCompetitorChangeSeen = (id: string) => call<{ seen: boolean }>('POST', `/api/growth/competitors/changes/${encodeURIComponent(id)}/seen`, {});
export const getAutopilot = () => call<AutopilotSettings>('GET', '/api/growth/autopilot');
export const saveAutopilot = (patch: Partial<Pick<AutopilotSettings, 'enabled' | 'goal' | 'targetQualified' | 'cadenceHours'>>) => call<AutopilotSettings>('PUT', '/api/growth/autopilot', patch);
export const runAutopilot = () => call<{ brief: AutopilotSettings['brief']; added: number }>('POST', '/api/growth/autopilot/run', {});
