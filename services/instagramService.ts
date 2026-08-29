import type { Lead } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface InstagramStatus {
  configured: boolean;
  connected: boolean;
  account: {
    username: string;
    name: string;
    igUserId: string;
    pageName: string;
    connectedAt?: string;
  } | null;
}

export interface InstagramSyncResult {
  fetched: number;
  newComments: number;
  scored: number;
  leads: Lead[];
  account: InstagramStatus['account'];
}

export async function getInstagramStatus(): Promise<InstagramStatus> {
  const res = await fetch(`${API_BASE}/api/instagram/status`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load Instagram status');
  return res.json();
}

export function openInstagramConnect(): Promise<InstagramStatus['account']> {
  return new Promise((resolve, reject) => {
    const width = 680;
    const height = 760;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      `${API_BASE}/auth/instagram`,
      'nexora_instagram_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Allow popups for Connect Instagram.'));
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Instagram connect window closed'));
      }
    }, 600);

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'INSTAGRAM_AUTH_SUCCESS') {
        cleanup();
        resolve(data.account);
      }
      if (data.type === 'INSTAGRAM_AUTH_ERROR') {
        cleanup();
        reject(new Error(data.error || 'Instagram auth failed'));
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

export async function disconnectInstagram(): Promise<void> {
  await fetch(`${API_BASE}/api/instagram/disconnect`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function syncInstagramLeads(forceRescore = false): Promise<InstagramSyncResult> {
  const res = await fetch(`${API_BASE}/api/instagram/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ forceRescore }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Instagram sync failed (${res.status})`);
  }
  return json.data as InstagramSyncResult;
}
