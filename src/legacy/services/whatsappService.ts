const API_BASE = import.meta.env.VITE_API_URL || '';

export interface WhatsAppStatus {
  configured: boolean;
  phoneNumberId: string | null;
  businessAccountId: string | null;
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const res = await fetch(`${API_BASE}/api/whatsapp/status`, { credentials: 'include' });
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || 'Failed to load WhatsApp status');
  const payload = (json.data || json) as WhatsAppStatus;
  return {
    configured: Boolean(payload.configured),
    phoneNumberId: payload.phoneNumberId ?? null,
    businessAccountId: payload.businessAccountId ?? null,
  };
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ to, text }),
  });
  const json = await parseJson(res);
  if (!res.ok || json.success === false) {
    throw new Error(json.error || 'Failed to send WhatsApp message');
  }
  return json.data;
}
