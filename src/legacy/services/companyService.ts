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
  emailAutoReply?: boolean;
  voiceTone: string;
  writingStyle: string;
  vocabulary: string[];
  avoid: string[];
  audience: string;
  productsFocus: string;
  usp?: string;
  idealCustomer?: string;
  painPoints?: string;
  personas?: string;
  reviews?: string;
  extraGuidelines: string;
  websiteUrl?: string;
  businessPhone?: string;
  businessAddress?: string;
  googleBusinessProfileUrl?: string;
  businessHours?: string;
  location?: string;
  handoffEmail?: string;
  faqs?: CompanyFaq[];
  handoffRules?: HandoffRules;
  plannedChannels?: Partial<Record<'whatsapp' | 'instagram' | 'facebook' | 'email' | 'webchat', boolean>>;
  updatedAt?: string | null;
  derivedFromDocs?: boolean;
  setupCompletedAt?: string | null;
}

export interface CompanyFaq {
  id: string;
  question: string;
  answer: string;
}

export interface HandoffRules {
  customerAsksPerson: boolean;
  aiNotSure: boolean;
  dealValueAbove: boolean;
  dealValueThreshold: string;
}

export interface CompanyDocumentMeta {
  id: string;
  title: string;
  fileName: string;
  mimeType?: string;
  charCount: number;
  chunkCount: number;
  tags?: string[];
  source?: 'upload' | 'website' | 'paste';
  sourceUrl?: string | null;
  status?: 'active' | 'archived';
  ocr?: boolean;
  /** very_short | boilerplate_heavy | stale | few_pages | scanned_ocr | archived */
  quality?: string[];
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

// ---------------------------------------------------------------------------
// Onboarding: learn the business, real file upload, progress, knowledge health
// ---------------------------------------------------------------------------

export interface BusinessDraft extends Partial<CompanyProfile> {
  whatYouSell?: string;
}

export interface BusinessAnalysis {
  draft: BusinessDraft;
  sources: { pages: string[]; documents: number };
}

export type AnalyzeStage = 'queued' | 'fetching' | 'reading' | 'learning' | 'done';

interface AnalyzeJob {
  id: string;
  status: 'running' | 'done' | 'error';
  stage: AnalyzeStage;
  detail?: { pages?: number; rendered?: boolean } | null;
  result?: BusinessAnalysis;
  error?: string;
}

export const ANALYZE_STAGE_LABEL: Record<AnalyzeStage, string> = {
  queued: 'Starting…',
  fetching: 'Opening your website…',
  reading: 'Reading your pages…',
  learning: 'Learning your business…',
  done: 'Done',
};

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 4 * 60_000;

/**
 * Learns the business from the website (plus any uploaded documents) and resolves with a draft to review.
 * The server runs this as a background job (it can take a minute); we poll it and report progress.
 */
export async function analyzeBusiness(
  websiteUrl: string,
  onProgress?: (stage: AnalyzeStage, detail?: AnalyzeJob['detail']) => void
): Promise<BusinessAnalysis> {
  const start = await fetch(`${API_BASE}/api/company/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ websiteUrl }),
  });
  const result = await pollJob(await parse(start), onProgress);
  if (!result) throw new Error('The analysis finished without a result. Please try again.');
  return result as BusinessAnalysis;
}

export interface WebsiteRefreshResult {
  refreshed: true;
  unchanged: boolean;
  sources: { pages: string[] };
}

/** Re-read the saved website now and replace the stored snapshot. */
export async function refreshWebsite(
  onProgress?: (stage: AnalyzeStage, detail?: AnalyzeJob['detail']) => void
): Promise<WebsiteRefreshResult> {
  const start = await fetch(`${API_BASE}/api/company/website/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  });
  const result = await pollJob(await parse(start), onProgress);
  return result as unknown as WebsiteRefreshResult;
}

async function pollJob(
  first: AnalyzeJob,
  onProgress?: (stage: AnalyzeStage, detail?: AnalyzeJob['detail']) => void
): Promise<BusinessAnalysis | null> {
  let job: AnalyzeJob = first;

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (job.status === 'running') {
    onProgress?.(job.stage, job.detail);
    if (Date.now() > deadline) throw new Error('Reading your website is taking too long. Try again, or upload a brochure instead.');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${API_BASE}/api/company/analyze/${encodeURIComponent(job.id)}`, { credentials: 'include' });
    job = await parse(res);
  }
  if (job.status === 'error') throw new Error(job.error || 'Could not read that website.');
  return job.result ?? null;
}

export interface UploadResult {
  ok: boolean;
  fileName: string;
  error?: string;
  document?: {
    id: string;
    chunkCount: number;
    charCount: number;
    duplicate?: boolean;
    /** Existing documents that look like an older or newer version of this one. */
    similarTo?: { id: string; title: string; uploadedAt: string; reason: 'same_name' | 'similar_content' }[];
  };
}

/** Multipart upload — the server extracts text from PDF, DOCX, TXT, MD, CSV, JSON and HTML. */
export async function uploadCompanyFiles(files: File[]): Promise<UploadResult[]> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const res = await fetch(`${API_BASE}/api/company/documents/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (Array.isArray(json.data)) return json.data as UploadResult[];
  throw new Error(json.error || `Upload failed (${res.status})`);
}

export async function getOnboardingDraft<T = Record<string, unknown>>(): Promise<T | null> {
  const res = await fetch(`${API_BASE}/api/company/onboarding-draft`, { credentials: 'include' });
  const data = await parse(res);
  return (data?.draft as T) ?? null;
}

export async function saveOnboardingDraft(draft: Record<string, unknown>): Promise<void> {
  await fetch(`${API_BASE}/api/company/onboarding-draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ draft }),
  }).catch(() => undefined); // best-effort; never block the user on autosave
}

export interface KnowledgeHealth {
  score: number;
  checks: { key: string; label: string; ok: boolean; hint: string; action?: 'refresh_website' | 'gaps' | 'conflicts' }[];
  stats: {
    documents: number;
    chunks: number;
    faqs: number;
    openGaps?: number;
    openGapQuestions?: number;
    openConflicts?: number;
    semanticSearch: boolean;
    embeddingModel: string | null;
    embeddingError: string | null;
    indexing: boolean;
  };
}

export async function getKnowledgeHealth(): Promise<KnowledgeHealth> {
  const res = await fetch(`${API_BASE}/api/company/knowledge/health`, { credentials: 'include' });
  return parse(res);
}

export interface KnowledgeSearchResult {
  grounded: boolean;
  confidence: 'high' | 'medium' | 'low';
  mode: 'hybrid' | 'keyword';
  sources: { id: string; title: string; score: number; excerpt: string }[];
}

export async function searchKnowledge(query: string): Promise<KnowledgeSearchResult> {
  const res = await fetch(`${API_BASE}/api/company/knowledge/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query }),
  });
  return parse(res);
}

// ---------------------------------------------------------------------------
// Feedback loop and source conflicts
// ---------------------------------------------------------------------------

export interface UnansweredQuestion {
  id: string;
  kind: 'missing' | 'conflict';
  question: string;
  variants: string[];
  detail?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  channels: Record<string, number>;
}

export interface UnansweredQuestionsResponse {
  summary: { open: number; openQuestions: number; resolved: number; totalAsked: number; top: { id: string; question: string; count: number } | null };
  open: UnansweredQuestion[];
}

export async function getUnansweredQuestions(): Promise<UnansweredQuestionsResponse> {
  const res = await fetch(`${API_BASE}/api/company/gaps`, { credentials: 'include' });
  return parse(res);
}

/** Turn an unanswered question into an FAQ answer. `nowCovered` says whether the assistant can answer it now. */
export async function answerUnansweredQuestion(id: string, payload: { answer: string; question?: string }): Promise<{ faqId: string; nowCovered: boolean }> {
  const res = await fetch(`${API_BASE}/api/company/gaps/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parse(res);
}

export async function dismissUnansweredQuestion(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/company/gaps/${encodeURIComponent(id)}/dismiss`, { method: 'POST', credentials: 'include' });
  await parse(res);
}

export interface ConflictSide {
  chunkId: string;
  docId: string | null;
  source: 'faq' | 'document' | 'website';
  title: string;
  uploadedAt: string | null;
  excerpt: string;
}

export interface KnowledgeConflict {
  id: string;
  topic: string;
  statementA: string;
  statementB: string;
  a: ConflictSide;
  b: ConflictSide;
  detectedAt: string;
}

export async function getKnowledgeConflicts(): Promise<KnowledgeConflict[]> {
  const res = await fetch(`${API_BASE}/api/company/conflicts`, { credentials: 'include' });
  return parse(res);
}

/** keep "a" or "b" to drop the other passage, or "both" when both statements are valid. */
export async function resolveKnowledgeConflict(id: string, keep: 'a' | 'b' | 'both'): Promise<void> {
  const res = await fetch(`${API_BASE}/api/company/conflicts/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ keep }),
  });
  await parse(res);
}

export async function setCompanyDocumentStatus(id: string, status: 'active' | 'archived'): Promise<void> {
  const res = await fetch(`${API_BASE}/api/company/documents/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  await parse(res);
}
