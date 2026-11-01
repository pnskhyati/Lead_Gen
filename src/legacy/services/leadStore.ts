import type {
  FollowUpQueueItem,
  Lead,
  LeadHandoffPackage,
  LeadMessage,
  LeadTemperature,
  LifecyclePipelineSummary,
  SocialInteraction,
  SocialResponse,
} from '../types';

const STORAGE_KEY = 'nexora-leads';
const SEED_FLAG = 'nexora-leads-seeded';
const API = '/api/leads';

function readRaw(): Lead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(leads: Lead[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads.slice(0, 100)));
  window.dispatchEvent(new CustomEvent('nexora-leads-updated'));
}

/** Strip legacy demo/sample leads — workspace starts empty. */
function clearLegacySeedData() {
  if (typeof window === 'undefined') return;
  try {
    const existing = readRaw();
    const cleaned = existing.filter((l) => !String(l.id || '').startsWith('seed-'));
    if (cleaned.length !== existing.length) {
      writeRaw(cleaned);
    }
    localStorage.setItem(SEED_FLAG, '1');
  } catch {
    /* ignore */
  }
}

function notify() {
  window.dispatchEvent(new CustomEvent('nexora-leads-updated'));
}

/** Sync from API into localStorage cache; falls back to cache if API down. */
export async function fetchLeads(params?: {
  temperature?: string;
  status?: string;
  channel?: string;
}): Promise<Lead[]> {
  clearLegacySeedData();
  try {
    const q = new URLSearchParams();
    if (params?.temperature) q.set('temperature', params.temperature);
    if (params?.status) q.set('status', params.status);
    if (params?.channel) q.set('channel', params.channel);
    const res = await fetch(`${API}?${q.toString()}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const leads: Lead[] = json.data?.leads || [];
    if (leads.length > 0 || json.success) {
      writeRaw(leads.length ? leads : readRaw());
      return leads.length
        ? leads
        : readRaw().sort(
            (a, b) =>
              new Date(b.lastMessageAt || b.createdAt).getTime() -
              new Date(a.lastMessageAt || a.createdAt).getTime()
          );
    }
  } catch (err) {
    console.warn('[leadStore] API fetch failed, using cache', err);
  }
  return getLeads();
}

export function getLeads(): Lead[] {
  clearLegacySeedData();
  return readRaw().sort(
    (a, b) =>
      new Date(b.lastMessageAt || b.createdAt).getTime() -
      new Date(a.lastMessageAt || a.createdAt).getTime()
  );
}

export function getLeadCounts(): Record<LeadTemperature, number> {
  const leads = getLeads();
  return {
    hot: leads.filter((l) => l.temperature === 'hot').length,
    warm: leads.filter((l) => l.temperature === 'warm').length,
    cold: leads.filter((l) => l.temperature === 'cold').length,
  };
}

export async function fetchLeadDetail(id: string): Promise<{
  lead: Lead;
  messages: LeadMessage[];
  handoff: LeadHandoffPackage;
} | null> {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(id)}`, { credentials: 'include' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function fetchLeadMessages(id: string): Promise<LeadMessage[]> {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(id)}/messages`, {
      credentials: 'include',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function replyToLead(
  id: string,
  text: string,
  asHuman = true
): Promise<{ delivered: boolean; lead?: Lead; message?: LeadMessage }> {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text, asHuman }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Reply failed');
  }
  if (json.data?.lead) {
    const next = readRaw().map((l) => (l.id === id ? { ...l, ...json.data.lead } : l));
    writeRaw(next);
  }
  notify();
  return json.data;
}

export async function releaseLeadToAi(
  id: string
): Promise<Lead | null> {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(id)}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (res.ok && json.data?.lead) {
      const next = readRaw().map((l) => (l.id === id ? { ...l, ...json.data.lead } : l));
      writeRaw(next);
      notify();
      return json.data.lead;
    }
  } catch (err) {
    console.warn('[leadStore] release API failed', err);
  }
  return updateLead(id, {
    autoReplyPaused: false,
    conversationState: 'AI_ACTIVE',
    status: 'contacted',
  });
}

export async function triggerHandoff(
  id: string,
  reason?: string
): Promise<{ lead: Lead; handoff: LeadHandoffPackage }> {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Handoff failed');
  }
  if (json.data?.lead) {
    const next = readRaw().map((l) => (l.id === id ? { ...l, ...json.data.lead } : l));
    writeRaw(next);
  }
  notify();
  return json.data;
}

export function addLeadFromInteraction(
  interaction: SocialInteraction,
  response: SocialResponse
): Lead {
  clearLegacySeedData();
  const temperature = normalizeTemperature(response.leadTemperature);
  const score = clampScore(response.leadScore, temperature);
  const channel =
    /whatsapp/i.test(interaction.platform)
      ? 'whatsapp'
      : /instagram/i.test(interaction.platform)
        ? 'instagram'
        : /lead agent/i.test(interaction.platform)
          ? 'web'
          : 'manual';

  const lead: Lead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform: interaction.platform,
    channel,
    customerComment: interaction.customerComment,
    temperature,
    score,
    intentSummary: response.intentSummary || defaultIntent(temperature),
    recommendedProduct: response.productRecommendation?.name,
    suggestedReply: response.suggestedReply,
    status: 'new',
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    source: channel,
  };

  const next = [lead, ...readRaw()];
  writeRaw(next);

  void fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      ...lead,
      initialMessage: interaction.customerComment,
      agentMessage: response.suggestedReply,
    }),
  })
    .then(async (res) => {
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.id && json.data.id !== lead.id) {
        const mapped = readRaw().map((l) => (l.id === lead.id ? { ...l, ...json.data } : l));
        writeRaw(mapped);
      }
    })
    .catch(() => {});

  return lead;
}

/** Merge Instagram (or other) leads, de-duping by externalId / id */
export function mergeLeads(incoming: Lead[]): number {
  clearLegacySeedData();
  const existing = readRaw();
  const byKey = new Set(
    existing.flatMap((l) => [l.externalId, l.id].filter(Boolean) as string[])
  );
  const fresh = incoming.filter((l) => {
    const keys = [l.externalId, l.id].filter(Boolean) as string[];
    return keys.length === 0 || !keys.some((k) => byKey.has(k));
  });
  if (fresh.length === 0) {
    void fetchLeads();
    return 0;
  }
  writeRaw([...fresh, ...existing]);
  void fetchLeads();
  return fresh.length;
}

export function updateLeadStatus(id: string, status: Lead['status']) {
  const next = readRaw().map((l) => (l.id === id ? { ...l, status } : l));
  writeRaw(next);
  void fetch(`${API}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  }).catch(() => {});
}

function normalizeTemperature(value: unknown): LeadTemperature {
  const v = String(value || '').toLowerCase();
  if (v === 'hot' || v === 'warm' || v === 'cold') return v;
  return 'warm';
}

function clampScore(score: unknown, temperature: LeadTemperature): number {
  const n = typeof score === 'number' ? score : Number(score);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  if (temperature === 'hot') return 85;
  if (temperature === 'cold') return 25;
  return 55;
}

function defaultIntent(temperature: LeadTemperature): string {
  if (temperature === 'hot') return 'Strong purchase or trial intent.';
  if (temperature === 'cold') return 'Low purchase intent — casual engagement.';
  return 'Interested but not ready to buy yet.';
}

export async function fetchFollowUpQueue(): Promise<{
  queue: FollowUpQueueItem[];
  summary: LifecyclePipelineSummary;
}> {
  try {
    const res = await fetch(`${API}/follow-ups/queue`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return {
      queue: json.data?.queue || [],
      summary: json.data?.summary || {
        channels: {},
        stages: {},
        pendingFollowUps: 0,
        overdueFollowUps: 0,
        reactivationPending: 0,
      },
    };
  } catch (err) {
    console.warn('[leadStore] follow-up queue', err);
    return {
      queue: [],
      summary: {
        channels: {},
        stages: {},
        pendingFollowUps: 0,
        overdueFollowUps: 0,
        reactivationPending: 0,
      },
    };
  }
}

export async function executeFollowUp(
  leadId: string,
  followUpId: string,
  text?: string
): Promise<{ delivered?: boolean }> {
  const res = await fetch(`${API}/${encodeURIComponent(leadId)}/follow-ups/${encodeURIComponent(followUpId)}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ send: true, text }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Follow-up failed');
  await fetchLeads();
  notify();
  return json.data || {};
}

export async function scanLeadLifecycle(): Promise<void> {
  try {
    await fetch(`${API}/lifecycle/scan`, { method: 'POST', credentials: 'include' });
    await fetchLeads();
    notify();
  } catch {
    /* ignore */
  }
}
