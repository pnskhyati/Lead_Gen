import type { Lead } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface FacebookStatus {
  configured: boolean;
  connected: boolean;
  account: {
    pageId: string;
    pageName: string;
    igUserId?: string | null;
    igUsername?: string | null;
    connectedAt?: string;
  } | null;
}

export interface FacebookSyncResult {
  fetched: number;
  newComments: number;
  scored: number;
  leads: Lead[];
  account: FacebookStatus['account'];
}

export async function getFacebookStatus(): Promise<FacebookStatus> {
  const res = await fetch(`${API_BASE}/api/facebook/status`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load Facebook status');
  return res.json();
}

export function openFacebookConnect(): Promise<FacebookStatus['account']> {
  const authPath = `${API_BASE}/auth/facebook`;
  return new Promise((resolve, reject) => {
    const width = 720;
    const height = 780;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      authPath,
      'nexora_facebook_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      window.location.assign(authPath);
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Facebook connect window closed'));
      }
    }, 600);

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'FACEBOOK_AUTH_SUCCESS') {
        cleanup();
        resolve(data.account);
      }
      if (data.type === 'FACEBOOK_AUTH_ERROR') {
        cleanup();
        reject(new Error(data.error || 'Facebook auth failed'));
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

export async function disconnectFacebook(): Promise<void> {
  await fetch(`${API_BASE}/api/facebook/disconnect`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function syncFacebookLeads(forceRescore = false): Promise<FacebookSyncResult> {
  const res = await fetch(`${API_BASE}/api/facebook/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ forceRescore }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Facebook sync failed (${res.status})`);
  }
  return json.data as FacebookSyncResult;
}
