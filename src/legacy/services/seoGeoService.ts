const API_BASE = import.meta.env.VITE_API_URL || '';

async function parse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data;
}

export type SeoGeoCategory = 'technical_seo' | 'local_seo' | 'geo';
export type SeoGeoPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type RecommendationStatus =
  | 'open'
  | 'in_progress'
  | 'needs_verification'
  | 'verified'
  | 'dismissed';
export type ConfirmationLevel = 'confirmed' | 'heuristic' | 'not_checked';

export interface SeoGeoRecommendation {
  id: string;
  category: SeoGeoCategory;
  title: string;
  priority: SeoGeoPriority;
  score: number;
  status: RecommendationStatus;
  confirmationLevel: ConfirmationLevel;
  evidence: string[];
  affectedUrls: string[];
  businessImpact: string;
  recommendedAction: string;
  verificationMethod: string;
  effort: 'low' | 'medium' | 'high';
  detectedAt: string;
  statusUpdatedAt?: string;
}

export interface SeoGeoAudit {
  id: string;
  runAt: string;
  websiteUrl: string | null;
  crawlSummary: {
    origin: string | null;
    homepageOk: boolean;
    homepageStatus: number | null;
    robotsDisallowAll: boolean;
    sitemapOk: boolean;
    error: string | null;
  };
  integrations: {
    googleSearchConsole: { connected: boolean; note: string };
    googleBusinessProfile: { connected: boolean; note: string };
  };
  recommendations: SeoGeoRecommendation[];
  summary?: SeoGeoRecommendationsSummary;
}

export interface SeoGeoRecommendationsSummary {
  total: number;
  open: number;
  inProgress: number;
  verified: number;
  dismissed: number;
  byPriority: Record<SeoGeoPriority, number>;
}

export interface SeoGeoIntegrationsStatus {
  oauthConfigured: boolean;
  connected: boolean;
  email: string | null;
  googleSearchConsole: {
    connected: boolean;
    siteUrl: string | null;
    lastSyncAt?: string | null;
    note: string;
  };
  googleBusinessProfile: {
    connected: boolean;
    locationTitle: string | null;
    lastSyncAt?: string | null;
    note: string;
  };
}

export interface SeoGeoRecommendationsResponse {
  auditId: string;
  runAt: string;
  crawlSummary: SeoGeoAudit['crawlSummary'] & { pagesCrawled?: number };
  integrations: SeoGeoIntegrationsStatus;
  recommendations: SeoGeoRecommendation[];
  summary: SeoGeoRecommendationsSummary;
}

export async function getSeoGeoIntegrations(): Promise<SeoGeoIntegrationsStatus> {
  const res = await fetch(`${API_BASE}/api/seo-geo/integrations`, { credentials: 'include' });
  return parse(res);
}

export async function startSeoGeoGoogleOAuth(): Promise<{ url: string; state: string }> {
  const res = await fetch(`${API_BASE}/api/seo-geo/oauth/start`, { credentials: 'include' });
  return parse(res);
}

export async function disconnectSeoGeoGoogle(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/seo-geo/oauth/disconnect`, {
    method: 'POST',
    credentials: 'include',
  });
  await parse(res);
}

/** @deprecated Legacy checklist report — prefer getSeoGeoRecommendations */
export type SeoGeoCheckStatus = 'passed' | 'needs_attention' | 'not_checked';

export interface SeoGeoReport {
  checks: {
    id: string;
    label: string;
    hint: string;
    status: SeoGeoCheckStatus;
    evidence: string[];
    source: string;
    manualAllowed: boolean;
  }[];
  recommendations: { priority: number; category: string; title: string; detail: string }[];
  summary: { passed: number; needsAttention: number; notChecked: number; total: number; evaluatedAt: string };
  audit?: { id: string; runAt: string } | null;
}

export async function runSeoGeoAudit(): Promise<SeoGeoAudit> {
  const res = await fetch(`${API_BASE}/api/seo-geo/audit`, {
    method: 'POST',
    credentials: 'include',
  });
  return parse(res);
}

export async function getSeoGeoAudit(): Promise<SeoGeoAudit> {
  const res = await fetch(`${API_BASE}/api/seo-geo/audit`, { credentials: 'include' });
  return parse(res);
}

export async function getSeoGeoRecommendations(params?: {
  category?: SeoGeoCategory;
  priority?: SeoGeoPriority;
  status?: RecommendationStatus;
}): Promise<SeoGeoRecommendationsResponse> {
  const q = new URLSearchParams();
  if (params?.category) q.set('category', params.category);
  if (params?.priority) q.set('priority', params.priority);
  if (params?.status) q.set('status', params.status);
  const qs = q.toString();
  const res = await fetch(`${API_BASE}/api/seo-geo/recommendations${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
  });
  return parse(res);
}

export async function patchSeoGeoRecommendation(
  id: string,
  status: RecommendationStatus
): Promise<SeoGeoAudit> {
  const res = await fetch(`${API_BASE}/api/seo-geo/recommendations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  return parse(res);
}

export async function getSeoGeoReport(): Promise<SeoGeoReport> {
  const res = await fetch(`${API_BASE}/api/seo-geo/report`, { credentials: 'include' });
  return parse(res);
}

export const SEO_GEO_LEGACY_STORAGE_KEY = 'tecavy-seo-geo';

export function readLegacySeoGeoChecklist(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SEO_GEO_LEGACY_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

async function migrateLegacySeoGeoChecklist(checklist: Record<string, boolean>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/seo-geo/migrate-legacy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ checklist }),
  });
  await parse(res);
}

export async function loadSeoGeoRecommendations(): Promise<SeoGeoRecommendationsResponse> {
  const legacy = readLegacySeoGeoChecklist();
  if (Object.values(legacy).some(Boolean)) {
    try {
      await migrateLegacySeoGeoChecklist(legacy);
      localStorage.removeItem(SEO_GEO_LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  return getSeoGeoRecommendations();
}

export function categoryLabel(category: SeoGeoCategory): string {
  switch (category) {
    case 'technical_seo':
      return 'Google Search';
    case 'local_seo':
      return 'Local SEO';
    default:
      return 'Generative (GEO)';
  }
}

export function statusLabel(status: RecommendationStatus): string {
  switch (status) {
    case 'in_progress':
      return 'In progress';
    case 'needs_verification':
      return 'Needs verification';
    case 'verified':
      return 'Verified';
    case 'dismissed':
      return 'Dismissed';
    default:
      return 'Open';
  }
}

export function confirmationLabel(level: ConfirmationLevel): string {
  switch (level) {
    case 'confirmed':
      return 'Confirmed';
    case 'heuristic':
      return 'Heuristic';
    default:
      return 'Not checked';
  }
}

export interface SeoGeoCrawlJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  origin: string;
  maxUrls: number;
  urlsDiscovered?: number;
  urlsCrawled?: number;
  startedAt: string;
  completedAt?: string | null;
  error?: string | null;
  pages?: { url: string; ok?: boolean; status?: number; title?: string }[];
}

export interface SeoGeoKeyword {
  id: string;
  keyword: string;
  country: string;
  language: string;
  device: 'desktop' | 'mobile';
  createdAt: string;
}

export interface SeoGeoRankSnapshot {
  keywordId: string;
  keyword: string;
  source: string;
  position: number | null;
  url: string | null;
  runAt: string;
  note?: string;
}

export interface SeoGeoGeoPrompt {
  id: string;
  prompt: string;
  createdAt: string;
}

export interface SeoGeoFix {
  id: string;
  recommendationId: string;
  issueType: string;
  status: string;
  draft: { field: string; before: string | null; after: string };
  cms: string | null;
  targetUrl?: string | null;
}

export async function startSeoGeoCrawl(maxUrls?: number): Promise<SeoGeoCrawlJob> {
  const res = await fetch(`${API_BASE}/api/seo-geo/crawl/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(maxUrls ? { maxUrls } : {}),
  });
  return parse(res);
}

export async function listSeoGeoCrawlJobs(): Promise<SeoGeoCrawlJob[]> {
  const res = await fetch(`${API_BASE}/api/seo-geo/crawl/jobs`, { credentials: 'include' });
  return parse(res);
}

export async function getSeoGeoCrawlJob(id: string): Promise<SeoGeoCrawlJob> {
  const res = await fetch(`${API_BASE}/api/seo-geo/crawl/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  return parse(res);
}

export async function getSeoGeoKeywords(): Promise<SeoGeoKeyword[]> {
  const res = await fetch(`${API_BASE}/api/seo-geo/keywords`, { credentials: 'include' });
  return parse(res);
}

export async function addSeoGeoKeyword(payload: {
  keyword: string;
  country?: string;
  device?: 'desktop' | 'mobile';
}): Promise<SeoGeoKeyword> {
  const res = await fetch(`${API_BASE}/api/seo-geo/keywords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parse(res);
}

export async function deleteSeoGeoKeyword(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/seo-geo/keywords/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await parse(res);
}

export async function syncSeoGeoRankings(): Promise<{ synced: number; runAt: string; rows: SeoGeoRankSnapshot[] }> {
  const res = await fetch(`${API_BASE}/api/seo-geo/rankings/sync`, {
    method: 'POST',
    credentials: 'include',
  });
  return parse(res);
}

export async function getSeoGeoRankDashboard(): Promise<{
  serpApiConfigured: boolean;
  rows: { keyword: SeoGeoKeyword; latest: SeoGeoRankSnapshot | null }[];
}> {
  const res = await fetch(`${API_BASE}/api/seo-geo/rankings/dashboard`, { credentials: 'include' });
  return parse(res);
}

export async function getSeoGeoCitationPrompts(): Promise<SeoGeoGeoPrompt[]> {
  const res = await fetch(`${API_BASE}/api/seo-geo/citations/prompts`, { credentials: 'include' });
  return parse(res);
}

export async function addSeoGeoCitationPrompt(prompt: string): Promise<SeoGeoGeoPrompt> {
  const res = await fetch(`${API_BASE}/api/seo-geo/citations/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ prompt }),
  });
  return parse(res);
}

export async function deleteSeoGeoCitationPrompt(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/seo-geo/citations/prompts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await parse(res);
}

export async function runSeoGeoCitationTests(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/seo-geo/citations/run`, {
    method: 'POST',
    credentials: 'include',
  });
  return parse(res);
}

export async function getSeoGeoVertexStatus(): Promise<{
  configured: boolean;
  mode: string;
  project: string | null;
  location: string;
  textModel: string;
  authHint?: string;
}> {
  const res = await fetch(`${API_BASE}/api/seo-geo/vertex-status`, { credentials: 'include' });
  return parse(res);
}

export async function getSeoGeoCitationDashboard(): Promise<{
  totalRuns: number;
  promptsCitingSite: number;
  citationRate: number;
  uniqueCitedPages: number;
  disclaimer: string;
  prompts: { prompt: SeoGeoGeoPrompt; recentRuns: unknown[] }[];
}> {
  const res = await fetch(`${API_BASE}/api/seo-geo/citations/dashboard`, { credentials: 'include' });
  return parse(res);
}

export async function listSeoGeoFixes(): Promise<{ fixes: SeoGeoFix[]; wordpress: boolean }> {
  const res = await fetch(`${API_BASE}/api/seo-geo/fixes`, { credentials: 'include' });
  return parse(res);
}

export async function proposeSeoGeoFix(payload: {
  recommendationId: string;
  issueType?: string;
  context?: Record<string, unknown>;
}): Promise<SeoGeoFix> {
  const res = await fetch(`${API_BASE}/api/seo-geo/fixes/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parse(res);
}

export async function approveSeoGeoFix(
  recommendationId: string,
  body: { approved?: boolean; pageId?: number }
): Promise<SeoGeoFix> {
  const res = await fetch(`${API_BASE}/api/seo-geo/fixes/${encodeURIComponent(recommendationId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parse(res);
}

export async function rollbackSeoGeoFix(recommendationId: string): Promise<SeoGeoFix> {
  const res = await fetch(`${API_BASE}/api/seo-geo/fixes/${encodeURIComponent(recommendationId)}/rollback`, {
    method: 'POST',
    credentials: 'include',
  });
  return parse(res);
}
