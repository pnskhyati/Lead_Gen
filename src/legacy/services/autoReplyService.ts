const API_BASE = import.meta.env.VITE_API_URL || '';

async function parse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.error || `Request failed (${res.status})`);
  return json.data;
}

const call = (method: string, url: string, body?: unknown) =>
  fetch(`${API_BASE}${url}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(parse);

export type AutoReplyMode = 'off' | 'review' | 'auto';

export interface AutoReplyRun {
  at: string;
  fetched: number;
  drafted: number;
  sent: number;
  skipped: number;
  needsHuman: number;
  error: string | null;
}

export interface AutoReplyChannel {
  id: string;
  label: string;
  platform: 'instagram' | 'facebook' | 'x' | 'linkedin';
  modes: AutoReplyMode[];
  mode: AutoReplyMode;
  connected: boolean;
  since: string | null;
  lastRun: AutoReplyRun | null;
  waiting: number;
}

export interface AutoReplyStatus {
  dailyCap: number;
  sentToday: number;
  channels: AutoReplyChannel[];
  unsupported: { id: string; label: string; reason: string }[];
}

export interface AutoReplyItem {
  id: string;
  channel: string;
  platform: 'instagram' | 'facebook' | 'x' | 'linkedin';
  kind: 'comment' | 'dm';
  author: string;
  text: string;
  context: string;
  permalink: string;
  receivedAt: string;
  status: 'pending_review' | 'sent' | 'skipped' | 'needs_human' | 'failed' | 'dismissed';
  intent: string;
  draft: string;
  finalText: string;
  reason: string;
  auto: boolean;
  error: string | null;
  sentAt: string | null;
}

export const getAutoReplyStatus = (): Promise<AutoReplyStatus> => call('GET', '/api/auto-reply/status');

export const saveAutoReplySettings = (body: { channels?: Record<string, { mode: AutoReplyMode }>; dailyCap?: number }): Promise<AutoReplyStatus> =>
  call('PUT', '/api/auto-reply/settings', body);

export const listAutoReplyItems = (status?: string): Promise<AutoReplyItem[]> =>
  call('GET', `/api/auto-reply/items${status ? `?status=${encodeURIComponent(status)}` : ''}`);

export const approveAutoReply = (id: string, text?: string): Promise<AutoReplyItem> =>
  call('POST', `/api/auto-reply/items/${encodeURIComponent(id)}/approve`, text === undefined ? {} : { text });

export const dismissAutoReply = (id: string): Promise<AutoReplyItem> => call('POST', `/api/auto-reply/items/${encodeURIComponent(id)}/dismiss`, {});

export const runAutoReplyNow = (): Promise<{ status: AutoReplyStatus }> => call('POST', '/api/auto-reply/run', {});
