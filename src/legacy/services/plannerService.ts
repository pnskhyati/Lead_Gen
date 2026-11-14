/**
 * Client for the content planner API (/api/social/*): one prompt -> calendar -> review -> scheduled publishing.
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

export type PlannerPlatform = 'linkedin' | 'instagram' | 'facebook' | 'x';
export type PostStatus = 'draft' | 'approved' | 'publishing' | 'published' | 'failed' | 'missed' | 'cancelled';

export const PLATFORM_LABEL: Record<PlannerPlatform, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
};

export interface PostIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface PlannerPost {
  id: string;
  campaignId: string;
  platform: PlannerPlatform;
  status: PostStatus;
  scheduledAt: string;
  dayKey: string;
  topic: string;
  pillar?: string;
  text: string;
  hashtags: string[];
  imagePrompt?: string;
  image: { source: 'generated' | 'uploaded'; file: string; mime: string; dayUpload?: string } | null;
  imageStatus?: 'pending' | 'ready' | 'failed';
  imageError?: string;
  previewUrl: string | null;
  rationale?: string;
  source: 'ai' | 'edited' | 'imported';
  attempts: number;
  lastError?: string | null;
  errorKind?: 'transient' | 'permanent' | 'unknown' | null;
  platformPostId?: string | null;
  publishedUrl?: string | null;
  publishedAt?: string | null;
  finalLength: number;
  maxLength: number | null;
  issues: PostIssue[];
}

export interface PlannerCampaign {
  id: string;
  prompt: string;
  theme?: string;
  summary?: string;
  status: 'generating' | 'review' | 'approved' | 'failed';
  error?: string;
  startDate: string;
  days: number;
  platforms: PlannerPlatform[];
  timezone: string;
  createdAt: string;
  counts?: Record<PostStatus | 'total', number>;
  /** platforms that were selected but got no post, with the reason */
  skipped?: { platform: PlannerPlatform; reason: string }[];
}

export type Connections = Record<PlannerPlatform, { connected: boolean; detail?: string }>;

export interface PlanJob {
  id: string;
  status: 'running' | 'done' | 'error';
  stage: 'queued' | 'planning' | 'writing' | 'images' | 'done' | string;
  detail?: { campaignId?: string; done?: number; total?: number; platform?: string } | null;
  result?: { campaignId: string; posts: number };
  error?: string;
  joined?: boolean;
}

export interface ApprovalProblem {
  postId: string;
  platform: PlannerPlatform;
  dayKey: string;
  issues: PostIssue[];
}

export class PlannerError extends Error {
  problems?: ApprovalProblem[];
  constructor(message: string, problems?: ApprovalProblem[]) {
    super(message);
    this.problems = problems;
  }
}

export interface PostMetrics {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  note?: string;
  /** why there are no numbers (the platform does not share them, or the sign-in is missing a permission) */
  unavailable?: string;
  fetchedAt?: string;
}

export interface PostAnalytics {
  lastRefreshedAt: string | null;
  platforms: Record<string, { posts: number; views: number; likes: number; comments: number; shares: number; saves: number; hasViews: boolean; unavailable: string | null }>;
  posts: { id: string; platform: PlannerPlatform; text: string; publishedAt: string; url: string | null; metrics: PostMetrics | null }[];
}

export const getPostAnalytics = (): Promise<PostAnalytics> => call('GET', '/api/social/analytics');
export const refreshPostAnalytics = (force = true): Promise<PostAnalytics & { errors: Record<string, string> }> => call('POST', '/api/social/analytics/refresh', { force });

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    credentials: 'include',
    headers: body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new PlannerError(json.error || `Request failed (${res.status})`, json.problems);
  return json.data as T;
}

// ---- connections + settings
export const getConnections = () => call<Connections>('GET', '/api/social/connections');
export const getPlannerSettings = () => call<{ timezone: string; defaultPlatforms: PlannerPlatform[] }>('GET', '/api/social/settings');

// ---- plan generation
export interface PlanRequest {
  prompt: string;
  days: number;
  startDate: string;
  platforms: PlannerPlatform[];
  intensity: 'light' | 'standard' | 'heavy';
  timezone: string;
  /** how each platform's posts should read (optional; falls back to the saved choices) */
  postStyle?: Partial<Record<PlannerPlatform, Partial<PostPref>>>;
}

export const startPlan = (req: PlanRequest) => call<PlanJob>('POST', '/api/social/plan', req);
export const getPlanJob = (id: string) => call<PlanJob>('GET', `/api/social/plan/${encodeURIComponent(id)}`);

// ---- import your own calendar (.xlsx / .csv)
export interface ImportRow {
  row: number;
  topic: string;
  content: string;
  platforms: PlannerPlatform[];
  date: string | null;
  time: string | null;
  hashtags: string[];
  errors: string[];
  warnings: string[];
}
export interface ImportPreview {
  rows: ImportRow[];
  ignored: string[];
  truncated: boolean;
}

export function previewImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  return call<ImportPreview>('POST', '/api/social/import/preview', form);
}

export const startImport = (req: { rows: ImportRow[]; platforms: PlannerPlatform[]; startDate: string; timezone: string; filename: string }) =>
  call<PlanJob>('POST', '/api/social/import/create', req);

/** Templates need the signed-in session, so they are fetched and saved rather than linked. */
export async function downloadImportTemplate(kind: 'csv' | 'xlsx') {
  const res = await fetch(`${API_BASE}/api/social/import/template.${kind}`, { credentials: 'include' });
  if (!res.ok) throw new PlannerError(`Could not download the template (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `content-calendar-template.${kind}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---- campaigns + calendar
export const listCampaigns = () => call<PlannerCampaign[]>('GET', '/api/social/campaigns');
export const getCampaign = (id: string) =>
  call<{ campaign: PlannerCampaign; posts: PlannerPost[]; connections: Record<PlannerPlatform, boolean> }>('GET', `/api/social/campaigns/${encodeURIComponent(id)}`);
export const getOverview = () =>
  call<{ counts: Record<PostStatus, number>; next: { id: string; platform: PlannerPlatform; scheduledAt: string; topic: string } | null; needsAttention: number }>('GET', '/api/social/overview');

/** Create images for every reviewable post in a campaign that has none. */
export const createMissingImages = (campaignId: string) => call<PlanJob>('POST', `/api/social/campaigns/${encodeURIComponent(campaignId)}/images/retry`, {});

// ---- editing
export interface PostEdit {
  text?: string;
  hashtags?: string[];
  date?: string;
  time?: string;
  imagePrompt?: string;
}
export const editPost = (id: string, edit: PostEdit) => call<PlannerPost>('PATCH', `/api/social/posts/${encodeURIComponent(id)}`, edit);
export const deletePost = (id: string) => call<{ deleted: true }>('DELETE', `/api/social/posts/${encodeURIComponent(id)}`);
export const regeneratePost = (id: string, opts: { scope: 'text' | 'image' | 'both'; instruction?: string; imagePrompt?: string }) =>
  call<PlannerPost>('POST', `/api/social/posts/${encodeURIComponent(id)}/regenerate`, opts);

export function uploadPostImage(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return call<PlannerPost>('POST', `/api/social/posts/${encodeURIComponent(id)}/image`, form);
}

/** Use one picture for every post on a day (or just one post). */
export function uploadDayImage(campaignId: string, file: File, opts: { date?: string; postId?: string }) {
  const form = new FormData();
  if (opts.date) form.append('date', opts.date);
  if (opts.postId) form.append('postId', opts.postId);
  form.append('file', file);
  return call<{ updated: string[] }>('POST', `/api/social/campaigns/${encodeURIComponent(campaignId)}/day-image`, form);
}

// ---- approval + publishing
export const approveCampaign = (id: string, onlyValid = false) =>
  call<{ approved: string[]; skipped: ApprovalProblem[] }>('POST', `/api/social/campaigns/${encodeURIComponent(id)}/approve`, { onlyValid });
export const approvePost = (id: string) => call<{ approved: string[]; skipped: ApprovalProblem[] }>('POST', `/api/social/posts/${encodeURIComponent(id)}/approve`, {});
export const unapprovePost = (id: string) => call<PlannerPost>('POST', `/api/social/posts/${encodeURIComponent(id)}/unapprove`, {});
export const publishPostNow = (id: string) => call<{ ok: boolean; post: PlannerPost }>('POST', `/api/social/posts/${encodeURIComponent(id)}/publish-now`, {});

// ---- competitors
export interface Competitor {
  id?: string;
  name: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  x?: string;
}
export interface CompetitorInsights {
  analyzedAt: string;
  outdated?: boolean;
  confidence: 'high' | 'medium' | 'low';
  usedSearch: boolean;
  summary: string;
  winningPatterns: { pattern: string; platforms: string[]; why: string; adapt: string }[];
  contentPillars: string[];
  marketGaps: string[];
  competitorsAnalyzed: string[];
}
export const getCompetitors = () => call<{ competitors: Competitor[]; insights: CompetitorInsights | null; needsRefresh: boolean; max: number }>('GET', '/api/social/competitors');
export const saveCompetitors = (competitors: Competitor[]) => call<Competitor[]>('PUT', '/api/social/competitors', { competitors });
export const startCompetitorAnalysis = () => call<PlanJob>('POST', '/api/social/competitors/analyze', {});
export const getCompetitorJob = (id: string) => call<PlanJob>('GET', `/api/social/competitors/analyze/${encodeURIComponent(id)}`);

/** Poll a job until it finishes. */
export async function pollJob(first: PlanJob, fetchJob: (id: string) => Promise<PlanJob>, onUpdate?: (j: PlanJob) => void, timeoutMs = 10 * 60_000): Promise<PlanJob> {
  let job = first;
  const deadline = Date.now() + timeoutMs;
  while (job.status === 'running') {
    onUpdate?.(job);
    if (Date.now() > deadline) throw new PlannerError('This is taking too long. Check your campaigns in a moment.');
    await new Promise((r) => setTimeout(r, 1500));
    job = await fetchJob(job.id);
  }
  onUpdate?.(job);
  if (job.status === 'error') throw new PlannerError(job.error || 'Something went wrong.');
  return job;
}

// ---- brand style (learned from the owner's own previous posts)
export interface BrandStyleGuide {
  summary: string;
  look: string;
  palette: { hex: string; role: string }[];
  composition: string;
  subjects: string;
  lighting: string;
  typography: string;
  recurringElements: string[];
  avoid: string[];
}
export interface BrandStyle {
  enabled: boolean;
  /** put a short headline on generated images */
  overlay: boolean;
  images: { id: string; url: string; addedAt: string }[];
  guide: BrandStyleGuide | null;
  analyzedAt: string | null;
  analyzedWith: number;
  /** examples were added or removed after the style was last read */
  stale: boolean;
  limits: { maxImages: number; minToAnalyze: number };
}

export const getBrandStyle = () => call<BrandStyle>('GET', '/api/social/brand-style');
export function uploadBrandImages(files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  return call<BrandStyle & { added: number; skipped: number; rejected: number }>('POST', '/api/social/brand-style/images', form);
}
export const removeBrandImage = (id: string) => call<BrandStyle>('DELETE', `/api/social/brand-style/images/${encodeURIComponent(id)}`);
export const analyzeBrandStyle = () => call<BrandStyle>('POST', '/api/social/brand-style/analyze', {});
export const setBrandStyleOptions = (opts: { enabled?: boolean; overlay?: boolean }) => call<BrandStyle>('PUT', '/api/social/brand-style', opts);

// ---- how posts are written, per platform
export interface PostPref {
  format: string;
  length: 'short' | 'standard' | 'long';
  emoji: 'none' | 'few';
  goal: 'comments' | 'clicks' | 'leads' | 'saves';
  notes: string;
}
export type PostPrefs = Record<PlannerPlatform, PostPref>;
export interface PostFormatOption {
  id: string;
  label: string;
  blurb: string;
}
export interface PostStyleState {
  catalog: Record<PlannerPlatform, PostFormatOption[]>;
  prefs: PostPrefs;
  saved: boolean;
}
export interface PostStyleSuggestion extends Partial<PostPref> {
  platform: PlannerPlatform;
  why: string;
}

export const getPostStyle = () => call<PostStyleState>('GET', '/api/social/post-style');
export const suggestPostStyle = (platforms: PlannerPlatform[]) =>
  call<{ ai: boolean; suggestions: PostStyleSuggestion[] }>('POST', '/api/social/post-style/suggest', { platforms });
