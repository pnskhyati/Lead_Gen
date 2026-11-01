const API_BASE = import.meta.env.VITE_API_URL || '';

export interface EmailStatus {
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
