const API_BASE = import.meta.env.VITE_API_URL || '';

export interface ConnectionsHealth {
  status: string;
  vertex?: { configured?: boolean; mode?: string; project?: string | null };
  instagram?: { configured?: boolean; connected?: boolean; account?: { username?: string } | null };
  facebook?: { configured?: boolean; connected?: boolean; account?: { pageName?: string } | null };
  x?: { configured?: boolean; connected?: boolean; account?: { username?: string } | null };
  whatsapp?: { configured?: boolean };
  email?: { configured?: boolean };
  googleAds?: { webhookReady?: boolean; apiSyncReady?: boolean };
  googleSheets?: { configured?: boolean };
  linkedin?: { configured?: boolean };
  mongo?: boolean;
}

export async function getConnectionsHealth(): Promise<ConnectionsHealth> {
  const res = await fetch(`${API_BASE}/api/health`, { credentials: 'include' });
  if (!res.ok) throw new Error('Could not load connection status');
  return res.json();
}
