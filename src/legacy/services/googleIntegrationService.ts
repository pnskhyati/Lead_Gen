const API_BASE = import.meta.env.VITE_API_URL || '';

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export interface GoogleAdsStatus {
  webhookReady: boolean;
  apiSyncReady: boolean;
  customerId: string | null;
  webhookPath: string;
}

export interface GoogleSheetsStatus {
  configured: boolean;
  spreadsheetId: string | null;
  sheetTab: string;
}

export interface AdsLandingConfig {
  landingPath: string;
  chatDeepLink: string;
  note: string;
}

export async function getGoogleAdsStatus(): Promise<GoogleAdsStatus> {
  const res = await fetch(`${API_BASE}/api/google-ads/status`, { credentials: 'include' });
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || 'Failed to load Google Ads status');
  return (json.data || json) as GoogleAdsStatus;
}

export async function simulateGoogleAdsLead(payload: {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  campaignId?: string;
  gclid?: string;
}): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/google-ads/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok || json.success === false) throw new Error(json.error || 'Simulate failed');
  return json.data;
}

export async function syncGoogleAdsLeads(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/google-ads/sync`, {
    method: 'POST',
    credentials: 'include',
  });
  const json = await parseJson(res);
  if (!res.ok || json.success === false) throw new Error(json.error || 'Sync failed');
  return json.data;
}

export async function getGoogleSheetsStatus(): Promise<GoogleSheetsStatus> {
  const res = await fetch(`${API_BASE}/api/google/sheets/status`, { credentials: 'include' });
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || 'Failed to load Sheets status');
  return (json.data || json) as GoogleSheetsStatus;
}

export async function testGoogleSheetsAppend(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/google/sheets/test`, {
    method: 'POST',
    credentials: 'include',
  });
  const json = await parseJson(res);
  if (!res.ok || json.success === false) throw new Error(json.error || 'Sheets test failed');
  return json.data;
}

export async function getAdsLandingConfig(): Promise<AdsLandingConfig> {
  const res = await fetch(`${API_BASE}/api/ads-landing/config`);
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || 'Failed to load ads landing config');
  return (json.data || json) as AdsLandingConfig;
}

export function buildAdsLandingUrl(apiBase: string, params?: Record<string, string>): string {
  const base = (apiBase || API_BASE || '').replace(/\/$/, '');
  const q = new URLSearchParams(params || {});
  q.set('utm_source', q.get('utm_source') || 'google');
  q.set('utm_medium', q.get('utm_medium') || 'cpc');
  const qs = q.toString();
  return `${base}/l/ads${qs ? `?${qs}` : ''}`;
}
