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
  opts?: { sessionId?: string; leadId?: string }
): Promise<LeadAgentResponse> {
  const sessionId = opts?.sessionId || getOrCreateLeadSessionId();
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
