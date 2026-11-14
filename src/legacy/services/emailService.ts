const API_BASE = import.meta.env.VITE_API_URL || '';

export interface EmailStatus {
  account?: EmailAccountView;
  configured: boolean;
  from: string | null;
  inboundWebhookPath: string;
  publicInboundUrl: string | null;
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function getEmailStatus(): Promise<EmailStatus> {
  const res = await fetch(`${API_BASE}/api/email/status`, { credentials: 'include' });
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || 'Failed to load email status');
  const payload = (json.data || json) as EmailStatus;
  return {
    configured: Boolean(payload.configured),
    from: payload.from ?? null,
    inboundWebhookPath: payload.inboundWebhookPath || '/api/email/inbound',
    publicInboundUrl: payload.publicInboundUrl ?? null,
  };
}

export async function sendEmailMessage(to: string, text: string, subject?: string, leadId?: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ to, text, subject, leadId }),
  });
  const json = await parseJson(res);
  if (!res.ok || json.success === false) {
    throw new Error(json.error || 'Failed to send email');
  }
  return json.data;
}

export async function simulateInboundEmail(from: string, text: string, subject?: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/email/simulate-inbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ from, subject, text }),
  });
  const json = await parseJson(res);
  if (!res.ok || json.success === false) {
    throw new Error(json.error || 'Simulate inbound failed');
  }
  return json.data;
}

// ---- the workspace's own mailbox (the agent sends from it and reads new mail from it)
export interface EmailAccountView {
  connected: boolean;
  email?: string;
  provider?: string;
  fromName?: string;
  connectedAt?: string | null;
  lastPollAt?: string | null;
  lastError?: string | null;
  needsReconnect?: boolean;
  repliesLast24h?: number;
  autoReply?: boolean;
  authType?: 'password' | 'oauth';
}

export interface EmailProviderOption {
  id: string;
  label: string;
  help: string;
  custom: boolean;
}

export interface ConnectEmailInput {
  provider: string;
  email: string;
  password: string;
  fromName?: string;
  smtp?: { host: string; port: number };
  imap?: { host: string; port: number };
}

async function emailCall<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok || json.success === false) throw new Error(json.error || `Request failed (${res.status})`);
  return json.data as T;
}

export interface EmailProviders {
  presets: EmailProviderOption[];
  /** Which "Sign in with" buttons this server has credentials for. */
  signIn: { google: boolean; microsoft: boolean };
}
export const getEmailProviders = () => emailCall<EmailProviders>('GET', '/api/email/providers');
export const getEmailAccount = () => emailCall<EmailAccountView>('GET', '/api/email/account');
export const connectEmailAccount = (input: ConnectEmailInput) => emailCall<EmailAccountView>('PUT', '/api/email/account', input);
export const disconnectEmailAccount = () => emailCall<EmailAccountView>('DELETE', '/api/email/account');
export const sendEmailAccountTest = () => emailCall<{ sentTo: string }>('POST', '/api/email/account/test', {});
export const setEmailAutoReply = (enabled: boolean) => emailCall<EmailAccountView>('PUT', '/api/email/auto-reply', { enabled });
