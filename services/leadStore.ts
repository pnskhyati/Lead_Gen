import type { Lead, LeadTemperature, SocialInteraction, SocialResponse } from '../types';

const STORAGE_KEY = 'nexora-leads';
const SEED_FLAG = 'nexora-leads-seeded';

const SAMPLE_LEADS: Omit<Lead, 'id' | 'createdAt'>[] = [
  {
    platform: 'Instagram',
    customerComment: 'Where can I buy the new limited edition near me? Need it this weekend for a party.',
    temperature: 'hot',
    score: 92,
    intentSummary: 'Ready to purchase — asking for local availability this weekend.',
    recommendedProduct: 'Johnnie Walker Blue Label',
    suggestedReply: 'Happy to help you find it nearby!',
    status: 'new',
  },
  {
    platform: 'Facebook',
    customerComment: 'Looking for a smooth whisky gift under $80 — any recommendations?',
    temperature: 'warm',
    score: 68,
    intentSummary: 'Gift shopping with budget — comparing options.',
    recommendedProduct: 'Johnnie Walker Black Label',
    status: 'new',
  },
  {
    platform: 'Twitter / X',
    customerComment: 'That new ad looks fire 🔥',
    temperature: 'cold',
    score: 22,
    intentSummary: 'Casual engagement with no purchase ask.',
    recommendedProduct: 'Guinness',
    status: 'new',
  },
];

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

function ensureSeeded() {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(SEED_FLAG)) return;
  const existing = readRaw();
  if (existing.length === 0) {
    const now = Date.now();
    const seeded: Lead[] = SAMPLE_LEADS.map((lead, i) => ({
      ...lead,
      id: `seed-${i}`,
      createdAt: new Date(now - i * 3600_000).toISOString(),
    }));
    writeRaw(seeded);
  }
  localStorage.setItem(SEED_FLAG, '1');
}

export function getLeads(): Lead[] {
  ensureSeeded();
  return readRaw().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

export function addLeadFromInteraction(
  interaction: SocialInteraction,
  response: SocialResponse
): Lead {
  ensureSeeded();
  const temperature = normalizeTemperature(response.leadTemperature);
  const score = clampScore(response.leadScore, temperature);
  const lead: Lead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform: interaction.platform,
    customerComment: interaction.customerComment,
    temperature,
    score,
    intentSummary: response.intentSummary || defaultIntent(temperature),
    recommendedProduct: response.productRecommendation?.name,
    suggestedReply: response.suggestedReply,
    status: 'new',
    createdAt: new Date().toISOString(),
    source: 'manual',
  };
  const next = [lead, ...readRaw()];
  writeRaw(next);
  return lead;
}

/** Merge Instagram (or other) leads, de-duping by externalId / id */
export function mergeLeads(incoming: Lead[]): number {
  ensureSeeded();
  const existing = readRaw();
  const byKey = new Set(
    existing.flatMap((l) => [l.externalId, l.id].filter(Boolean) as string[])
  );
  const fresh = incoming.filter((l) => {
    const keys = [l.externalId, l.id].filter(Boolean) as string[];
    return keys.length === 0 || !keys.some((k) => byKey.has(k));
  });
  if (fresh.length === 0) return 0;
  writeRaw([...fresh, ...existing]);
  return fresh.length;
}

export function updateLeadStatus(id: string, status: Lead['status']) {
  const next = readRaw().map((l) => (l.id === id ? { ...l, status } : l));
  writeRaw(next);
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
