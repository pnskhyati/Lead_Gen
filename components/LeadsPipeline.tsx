import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lead, LeadHandoffPackage, LeadMessage, LeadTemperature } from '../types';
import {
  fetchLeadDetail,
  fetchLeads,
  getLeads,
  replyToLead,
  releaseLeadToAi,
  triggerHandoff,
  updateLeadStatus,
} from '../services/leadStore';
import { buildMailto } from '../services/leadAgentService';
import LeadBadge from './common/LeadBadge';
import Spinner from './common/Spinner';
import InstagramConnect from './InstagramConnect';
import FacebookConnect from './FacebookConnect';
import Card from './common/Card';

type TempFilter = 'all' | LeadTemperature;
type ChannelFilter = 'all' | 'web' | 'instagram' | 'facebook' | 'whatsapp' | 'manual';
type StatusFilter = 'all' | Lead['status'];

const TEMPS: TempFilter[] = ['all', 'hot', 'warm', 'cold'];
const CHANNELS: ChannelFilter[] = ['all', 'web', 'instagram', 'facebook', 'whatsapp', 'manual'];
const STATUSES: StatusFilter[] = ['all', 'new', 'contacted', 'qualified', 'handed_off', 'closed'];

function channelLabel(lead: Lead) {
  if (lead.channel === 'whatsapp') return 'WhatsApp';
  if (lead.channel === 'facebook') return 'Facebook';
  if (lead.channel === 'instagram') return lead.platform?.includes('DM') ? 'IG DM' : 'Instagram';
  if (lead.channel === 'web') return 'Web chat';
  return lead.platform || 'Manual';
}

function openDeepLink(lead: Lead, handoff?: LeadHandoffPackage | null) {
  if (lead.channel === 'whatsapp' && (handoff?.waLink || lead.phone)) {
    const url = handoff?.waLink || `https://wa.me/${String(lead.phone).replace(/\D/g, '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (lead.mediaPermalink) {
    window.open(lead.mediaPermalink, '_blank', 'noopener,noreferrer');
  }
}

const LeadsPipeline: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempFilter, setTempFilter] = useState<TempFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [handoff, setHandoff] = useState<LeadHandoffPackage | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScoreTool, setShowScoreTool] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchLeads();
      setLeads(list.length ? list : getLeads());
    } catch {
      setLeads(getLeads());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener('nexora-leads-updated', onUpdate);
    const poll = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.removeEventListener('nexora-leads-updated', onUpdate);
      window.clearInterval(poll);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (tempFilter !== 'all' && l.temperature !== tempFilter) return false;
      if (channelFilter !== 'all' && (l.channel || 'manual') !== channelFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      return true;
    });
  }, [leads, tempFilter, channelFilter, statusFilter]);

  const selected = leads.find((l) => l.id === selectedId) || null;

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setError(null);
    const detail = await fetchLeadDetail(id);
    if (detail) {
      setMessages(detail.messages || []);
      setHandoff(detail.handoff || null);
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...detail.lead } : l)));
    } else {
      const lead = getLeads().find((l) => l.id === id);
      setMessages(
        lead?.customerComment
          ? [
              {
                id: 'local-1',
                leadId: id,
                role: 'customer',
                text: lead.customerComment,
                createdAt: lead.createdAt,
              },
              ...(lead.suggestedReply
                ? [
                    {
                      id: 'local-2',
                      leadId: id,
                      role: 'agent' as const,
                      text: lead.suggestedReply,
                      createdAt: lead.createdAt,
                    },
                  ]
                : []),
            ]
          : []
      );
      setHandoff(null);
    }
  }, []);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await replyToLead(selected.id, reply.trim(), true);
      setReply('');
      if (!result.delivered && (selected.channel === 'whatsapp' || selected.igScopedId)) {
        setError('Saved locally — channel delivery may need WhatsApp/IG tokens configured.');
      }
      await loadDetail(selected.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply failed');
    } finally {
      setBusy(false);
    }
  };

  const handleHandoff = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await triggerHandoff(selected.id, 'Close with human from Leads tab');
      setHandoff(result.handoff);
      await refresh();
      window.location.href = buildMailto(
        result.handoff.email,
        result.handoff.subject,
        result.handoff.body
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Handoff failed');
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    active
      ? 'bg-gradient-to-r from-soft-deep to-soft-azure text-white shadow-aqua'
      : 'bg-soft-bg text-ink-muted hover:bg-white';

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink tracking-tight">Leads</h1>
          <p className="text-ink-muted mt-1 font-medium">
            Pipeline home — score, reply on channel, hand Hot deals to a human with the full transcript.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowScoreTool((v) => !v)}
          className="self-start px-4 py-2 rounded-full text-sm font-bold bg-soft-mint text-soft-deep"
        >
          {showScoreTool ? 'Hide score tool' : 'Score a comment'}
        </button>
      </div>

      <InstagramConnect compact onSynced={() => void refresh()} />
      <FacebookConnect compact onSynced={() => void refresh()} />

      {showScoreTool && <ScoreCommentTool onScored={() => void refresh()} />}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-5 min-h-[560px]">
        {/* List */}
        <Card className="!p-0 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="p-4 border-b border-soft-sky/40 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {TEMPS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTempFilter(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${chip(tempFilter === t)}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannelFilter(c)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${chip(channelFilter === c)}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${chip(statusFilter === s)}`}
                >
                  {String(s).replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <ul className="overflow-y-auto flex-1 divide-y divide-soft-sky/30">
            {loading ? (
              <li className="p-10 flex justify-center">
                <Spinner />
              </li>
            ) : filtered.length === 0 ? (
              <li className="p-10 text-center text-sm text-ink-muted">
                No leads match. Sync Instagram, open the Lead Agent, or score a comment.
              </li>
            ) : (
              filtered.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(lead.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors ${
                      selectedId === lead.id ? 'bg-soft-sky/40' : 'hover:bg-soft-bg/80'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <LeadBadge temperature={lead.temperature} score={lead.score} />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-soft-azure">
                        {channelLabel(lead)}
                      </span>
                      <span className="text-[10px] font-semibold text-ink-muted capitalize">
                        {lead.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-ink line-clamp-2">
                      {lead.author ? `@${lead.author}: ` : ''}“{lead.customerComment}”
                    </p>
                    <p className="text-[11px] text-ink-muted mt-1 truncate">
                      {lead.intent ? `${lead.intent} · ` : ''}{lead.intentSummary}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>

        {/* Thread */}
        <Card className="flex flex-col max-h-[70vh] !p-0 overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-ink-muted p-8">
              Select a lead to view the thread and reply.
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-soft-sky/40 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <LeadBadge temperature={selected.temperature} score={selected.score} />
                      <span className="text-sm font-bold text-ink">{channelLabel(selected)}</span>
                      {selected.author && (
                        <span className="text-xs text-ink-muted">@{selected.author}</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted">
                      {selected.intent && (
                        <span className="font-semibold text-soft-deep">{selected.intent} · </span>
                      )}
                      {selected.intentSummary}
                    </p>
                    {selected.scoreExplanation && (
                      <div className="mt-2 rounded-2xl bg-soft-foam/80 border border-soft-sky/40 px-3 py-2 max-w-md">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-soft-azure">
                          Why this score
                        </p>
                        <p className="text-xs text-ink-soft mt-0.5">{selected.scoreExplanation}</p>
                        {selected.scoringVersion && (
                          <p className="text-[10px] text-ink-muted mt-1">Rules: {selected.scoringVersion}</p>
                        )}
                      </div>
                    )}
                    {selected.nextBestAction && (
                      <p className="text-xs font-semibold text-soft-azure mt-1">
                        Next: {selected.nextBestAction}
                      </p>
                    )}
                    {selected.conversationState && selected.conversationState !== 'AI_ACTIVE' && (
                      <p className="text-[11px] font-bold text-soft-coral mt-1 uppercase tracking-wide">
                        {selected.conversationState.replace(/_/g, ' ')}
                      </p>
                    )}
                    {selected.recommendedProduct && (
                      <p className="text-xs font-semibold text-soft-deep mt-1">
                        Interest: {selected.recommendedProduct}
                      </p>
                    )}
                  </div>
                  <select
                    value={selected.status}
                    onChange={(e) => {
                      updateLeadStatus(selected.id, e.target.value as Lead['status']);
                      void refresh().then(() => loadDetail(selected.id));
                    }}
                    className="text-xs font-semibold bg-soft-bg rounded-full px-3 py-1.5 text-ink border-0 focus:outline-none focus:ring-2 focus:ring-soft-sky"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="handed_off">Handed off</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(selected.channel === 'whatsapp' || selected.phone) && (
                    <button
                      type="button"
                      onClick={() => openDeepLink(selected, handoff)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#25D366]/15 text-[#128C7E]"
                    >
                      Open WhatsApp
                    </button>
                  )}
                  {(selected.channel === 'instagram' || selected.mediaPermalink) && (
                    <button
                      type="button"
                      onClick={() => openDeepLink(selected, handoff)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-soft-sky text-soft-azure"
                    >
                      Open on Instagram
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleHandoff()}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-soft-coral/20 text-soft-coral"
                  >
                    Take over
                  </button>
                  {(selected.autoReplyPaused || selected.conversationState === 'HUMAN_REQUIRED') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await releaseLeadToAi(selected.id);
                          await refresh();
                          await loadDetail(selected.id);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-soft-mint text-soft-deep"
                    >
                      Release to AI
                    </button>
                  )}
                  {handoff && (
                    <a
                      href={buildMailto(handoff.email, handoff.subject, handoff.body)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-soft-mint text-soft-deep"
                    >
                      Email specialist
                    </a>
                  )}
                </div>
                {selected.autoReplyPaused && (
                  <p className="text-[11px] font-semibold text-soft-coral">
                    Auto-replies paused — human owns this thread.
                  </p>
                )}
                {error && <p className="text-[11px] text-soft-coral font-medium">{error}</p>}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-soft-bg/40">
                {messages.length === 0 ? (
                  <p className="text-sm text-ink-muted text-center py-8">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.role === 'customer'
                          ? 'bg-white text-ink mr-auto shadow-sm'
                          : m.role === 'human'
                            ? 'bg-soft-deep text-white ml-auto'
                            : 'bg-soft-sky/70 text-ink ml-auto'
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-0.5">
                        {m.role}
                      </p>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleReply} className="p-3 border-t border-soft-sky/40 flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={
                    selected.channel === 'whatsapp' || selected.igScopedId
                      ? 'Reply on channel…'
                      : 'Add a note / reply…'
                  }
                  className="flex-1 nexora-input !rounded-full text-sm px-4 py-2.5"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !reply.trim()}
                  className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-soft-deep to-soft-azure disabled:opacity-50"
                >
                  {busy ? '…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

/** Compact paste-to-score tool (former Automation main flow). */
const ScoreCommentTool: React.FC<{ onScored: () => void }> = ({ onScored }) => {
  const [platform, setPlatform] = useState('Instagram');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const { generateSocialReply } = await import('../services/geminiService');
      const { addLeadFromInteraction } = await import('../services/leadStore');
      const response = await generateSocialReply({ platform, customerComment: comment });
      addLeadFromInteraction({ platform, customerComment: comment }, response);
      setComment('');
      onScored();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Score failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 className="text-sm font-bold text-ink mb-3">Score a pasted comment</h3>
      <form onSubmit={run} className="space-y-3">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="nexora-input text-sm w-full sm:w-48"
        >
          {['Instagram', 'Facebook', 'Twitter / X', 'WhatsApp', 'LinkedIn'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Paste a customer comment…"
          className="nexora-input text-sm w-full"
        />
        {err && <p className="text-xs text-soft-coral">{err}</p>}
        <button
          type="submit"
          disabled={loading || !comment.trim()}
          className="px-4 py-2 rounded-full text-sm font-bold text-white bg-gradient-to-r from-soft-deep to-soft-azure disabled:opacity-50"
        >
          {loading ? 'Scoring…' : 'Score → Hot / Warm / Cold'}
        </button>
      </form>
    </Card>
  );
};

export default LeadsPipeline;
