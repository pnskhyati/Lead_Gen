import type { LeadTemperature } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface LeadAgentMessage {
  role: 'user' | 'model';
  text: string;
}

export interface LeadAgentResponse {
  reply: string;
  intent?: string;
  intentConfidence?: number;
  needsHandoff: boolean;
  handoffReason: string;
  handoffEmail: string;
  captureLead?: boolean;
  leadTemperature: LeadTemperature;
  leadScore: number;
  scoreBand?: string;
  scoreFactors?: { id: string; label: string; points: number; reasonCode?: string }[];
  scoreExplanation?: string;
  scoringVersion?: string;
  intentSummary: string;
  nextBestAction?: string;
  conversationState?: string;
  policyDecision?: string;
  runId?: string;
  promptVersion?: string;
  agentVersion?: string;
  emailSubject: string;
  emailBody: string;
  usedDocs: { id: string; title: string }[];
  retrievedCount: number;
  leadId?: string;
  botName?: string;
  companyName?: string;
}

const SESSION_KEY = 'nexora-lead-agent-session';
const ATTRIBUTION_KEY = 'nexora-lead-attribution';

export interface LeadAttribution {
  leadSource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
}

export function parseAdsAttributionFromUrl(): LeadAttribution | null {
  try {
    const p = new URLSearchParams(window.location.search);
    const ads = p.get('ads');
    const gclid = p.get('gclid');
    const utmSource = p.get('utm_source');
    if (!ads && !gclid && !utmSource) return null;
    return {
      leadSource: 'google_ads_click',
      utmSource: utmSource || undefined,
      utmMedium: p.get('utm_medium') || undefined,
      utmCampaign: p.get('utm_campaign') || undefined,
      utmTerm: p.get('utm_term') || undefined,
      utmContent: p.get('utm_content') || undefined,
      gclid: gclid || undefined,
    };
  } catch {
    return null;
  }
}

export function getStoredLeadAttribution(): LeadAttribution | null {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LeadAttribution;
  } catch {
    return null;
  }
}

export function storeLeadAttribution(attr: LeadAttribution | null) {
  try {
    if (!attr) sessionStorage.removeItem(ATTRIBUTION_KEY);
    else sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attr));
  } catch {
    /* ignore */
  }
}

export function getOrCreateLeadSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `sess-${Date.now()}`;
  }
}

export async function chatWithLeadAgent(
  history: LeadAgentMessage[],
  message: string,
  visitorName?: string,
  opts?: { sessionId?: string; leadId?: string; attribution?: LeadAttribution | null; adsVisit?: boolean }
): Promise<LeadAgentResponse> {
  const sessionId = opts?.sessionId || getOrCreateLeadSessionId();
  const attribution = opts?.attribution ?? getStoredLeadAttribution();
  const res = await fetch(`${API_BASE}/api/lead-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      history,
      message,
      visitorName,
      sessionId,
      leadId: opts?.leadId,
      attribution: attribution || undefined,
      adsVisit: opts?.adsVisit || Boolean(attribution?.gclid || attribution?.utmSource),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Lead agent failed (${res.status})`);
  }
  return json.data as LeadAgentResponse;
}

export function buildMailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
