/**
 * Company knowledge / brand voice Admin Console API client.
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

async function parse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data;
}

export interface CompanyProfile {
  companyName: string;
  industry: string;
  tagline: string;
  botName: string;
  instagramAutoReply: boolean;
  whatsappAutoReply: boolean;
  voiceTone: string;
  writingStyle: string;
  vocabulary: string[];
  avoid: string[];
  audience: string;
  productsFocus: string;
  extraGuidelines: string;
  updatedAt?: string | null;
  derivedFromDocs?: boolean;
  setupCompletedAt?: string | null;
}

export interface CompanyDocumentMeta {
  id: string;
  title: string;
  fileName: string;
  mimeType?: string;
  charCount: number;
  chunkCount: number;
  tags?: string[];
  uploadedAt: string;
  uploadedBy?: string;
}

export interface CompanyStatus {
  documentCount: number;
  chunkCount: number;
  hasVoice: boolean;
  companyName: string | null;
  botName?: string | null;
  instagramAutoReply?: boolean;
  whatsappAutoReply?: boolean;
  derivedFromDocs: boolean;
  updatedAt?: string | null;
  setupComplete?: boolean;
  setupMissing?: string[];
  setupCompletedAt?: string | null;
}

export type SetupMissingField = 'companyName' | 'botName' | 'voiceTone' | 'writingStyle';

export interface CompanySetupStatus {
  setupComplete: boolean;
  setupMissing: string[];
  profile: CompanyProfile;
}

export async function getCompanyStatus(): Promise<CompanyStatus> {
  const res = await fetch(`${API_BASE}/api/company/status`, { credentials: 'include' });
  return parse(res);
}

export async function getCompanySetup(): Promise<CompanySetupStatus> {
  const res = await fetch(`${API_BASE}/api/company/setup`, { credentials: 'include' });
  return parse(res);
}

export async function completeCompanySetup(
  payload: Partial<CompanyProfile> & {
    companyName: string;
    botName: string;
    voiceTone: string;
    writingStyle: string;
  }
): Promise<{ profile: CompanyProfile; setupComplete: boolean }> {
  const res = await fetch(`${API_BASE}/api/company/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parse(res);
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const res = await fetch(`${API_BASE}/api/company/profile`, { credentials: 'include' });
  return parse(res);
}

export async function saveCompanyProfile(patch: Partial<CompanyProfile>): Promise<CompanyProfile> {
  const res = await fetch(`${API_BASE}/api/company/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  return parse(res);
}

export async function listCompanyDocuments(): Promise<CompanyDocumentMeta[]> {
  const res = await fetch(`${API_BASE}/api/company/documents`, { credentials: 'include' });
  return parse(res);
}

export async function uploadCompanyDocument(payload: {
  title?: string;
  fileName: string;
  mimeType?: string;
  text: string;
  tags?: string[];
}): Promise<CompanyDocumentMeta> {
  const res = await fetch(`${API_BASE}/api/company/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parse(res);
}

export async function deleteCompanyDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/company/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await parse(res);
}

export async function deriveCompanyVoice(): Promise<CompanyProfile> {
  const res = await fetch(`${API_BASE}/api/company/derive-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return parse(res);
}

export async function getAgentAudit(limit = 40): Promise<
  {
    event_id: string;
    action?: string;
    policy_decision?: string;
    status?: string;
    timestamp?: string;
    result?: { intent?: string; score?: number; handoff?: boolean };
    meta?: { next_best_action?: string; score_factors?: unknown };
    prompt_version?: string;
    agent_version?: string;
  }[]
> {
  const res = await fetch(`${API_BASE}/api/lead-agent/audit?limit=${limit}`, {
    credentials: 'include',
  });
  return parse(res);
}

/** Read supported text files in the browser */
export async function readFileAsText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const ok =
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    name.endsWith('.html') ||
    file.type.startsWith('text/') ||
    file.type === 'application/json';
  if (!ok) {
    throw new Error('Supported uploads: .txt, .md, .csv, .json, .html (paste PDF text if needed)');
  }
  return file.text();
}
