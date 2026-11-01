import type { Lead } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface XStatus {
  configured: boolean;
  connected: boolean;
  account: {
    userId: string;
    username: string;
    name?: string;
    connectedAt?: string;
  } | null;
}

export interface XSyncResult {
  fetched: number;
  newMentions: number;
  scored: number;
  leads: Lead[];
  account: XStatus['account'];
}

export async function getXStatus(): Promise<XStatus> {
  const res = await fetch(`${API_BASE}/api/x/status`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load X status');
  return res.json();
}

export function openXConnect(): Promise<XStatus['account']> {
  const authPath = `${API_BASE}/auth/x`;
  return new Promise((resolve, reject) => {
    const width = 720;
    const height = 780;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(authPath, 'nexora_x_oauth', `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      window.location.assign(authPath);
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('X connect window closed'));
      }
    }, 600);

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'X_AUTH_SUCCESS') {
        cleanup();
        resolve(data.account);
      }
      if (data.type === 'X_AUTH_ERROR') {
        cleanup();
        reject(new Error(data.error || 'X auth failed'));
      }
    };

    const cleanup = () => {
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      try {
        popup.close();
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('message', onMessage);
  });
}

export async function disconnectX(): Promise<void> {
  await fetch(`${API_BASE}/api/x/disconnect`, { method: 'POST', credentials: 'include' });
}

export async function syncXLeads(forceRescore = false): Promise<XSyncResult> {
  const res = await fetch(`${API_BASE}/api/x/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ forceRescore }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `X sync failed (${res.status})`);
  }
  return json.data as XSyncResult;
}
