import React, { useEffect, useRef, useState, FormEvent } from 'react';
import {
  buildMailto,
  chatWithLeadAgent,
  getStoredLeadAttribution,
  parseAdsAttributionFromUrl,
  storeLeadAttribution,
  type LeadAgentMessage,
  type LeadAgentResponse,
} from '../services/leadAgentService';
import { addLeadFromInteraction, fetchLeads } from '../services/leadStore';
import { getCompanyProfile } from '../services/companyService';
import LeadBadge from './common/LeadBadge';
import Spinner from './common/Spinner';
import type { SocialResponse } from '../types';

const LeadAgentChat: React.FC = () => {
  const [botName, setBotName] = useState('Alex');
  const [companyName, setCompanyName] = useState('Tecavy');
  const [open, setOpen] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [messages, setMessages] = useState<LeadAgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [handoff, setHandoff] = useState<LeadAgentResponse | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [crmLeadId, setCrmLeadId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fromUrl = parseAdsAttributionFromUrl();
    if (fromUrl) storeLeadAttribution(fromUrl);
    const params = new URLSearchParams(window.location.search);
    if (params.get('ads') || window.location.hash === '#chat') {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    void getCompanyProfile()
      .then((p) => {
        const name = (p.botName || 'Alex').trim() || 'Alex';
        const company = (p.companyName || 'Tecavy').trim() || 'Tecavy';
        setBotName(name);
        setCompanyName(company);
        setMessages([
          {
            role: 'model',
            text: `Hi! I'm ${name} from ${company} — how can I help you today?`,
          },
        ]);
      })
      .catch(() => {
        setMessages([
          {
            role: 'model',
            text: "Hey! I'm Alex — happy to help. What are you looking for?",
          },
        ]);
      });
  }, []);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 160);
    }
  }, [open, messages, isLoading, showEmailDraft]);

  const captureLead = (data: LeadAgentResponse, userText: string) => {
    const fakeResponse: SocialResponse = {
      suggestedReply: data.reply,
      productRecommendation: {
        name: companyName || 'Approved recommendation',
        reasoning: data.intentSummary || 'Lead agent conversation',
        productImagePrompt: '',
        recipes: [],
      },
      leadTemperature: data.leadTemperature,
      leadScore: data.leadScore,
      intentSummary: data.intentSummary || data.handoffReason || 'Lead agent chat',
    };
    addLeadFromInteraction(
      { platform: 'Lead Agent Chat', customerComment: userText },
      fakeResponse
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: LeadAgentMessage = { role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await chatWithLeadAgent(
        messages.map(({ role, text: t }) => ({ role, text: t })),
        text,
        undefined,
        { leadId: crmLeadId, adsVisit: Boolean(getStoredLeadAttribution()) }
      );
      setMessages((prev) => [...prev, { role: 'model', text: data.reply }]);
      if (data.leadId) setCrmLeadId(data.leadId);
      if (data.botName) setBotName(data.botName);
      if (data.captureLead || data.needsHandoff) {
        try {
          captureLead(data, text);
          void fetchLeads();
        } catch (leadErr) {
          console.warn('Lead capture skipped:', leadErr);
        }
      }

      if (data.needsHandoff) {
        setHandoff(data);
        setEmailTo(data.handoffEmail);
        setEmailSubject(data.emailSubject);
        setEmailBody(data.emailBody);
        setShowEmailDraft(true);
      }
    } catch (err) {
      console.error('Lead agent chat failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: `I'm still here — tell me a bit more about what you need, or tap Draft email and a specialist can jump in with our chat so far.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const openMailClient = () => {
    window.location.href = buildMailto(emailTo, emailSubject, emailBody);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(
        `To: ${emailTo}\nSubject: ${emailSubject}\n\n${emailBody}`
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-[80] flex flex-col items-start gap-3 pointer-events-none">
      <div
        className={`
          pointer-events-auto w-[min(100vw-1.5rem,400px)] h-[min(74vh,600px)]
          flex flex-col overflow-hidden
          rounded-[1.75rem] border border-soft-sky/50
          bg-white/92 backdrop-blur-2xl shadow-soft-lg
          origin-bottom-left transition-all duration-300 ease-out
          ${open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-4 pointer-events-none absolute'}
        `}
        aria-hidden={!open}
      >
        <div className="px-4 py-3.5 flex items-center justify-between gap-2 bg-gradient-to-r from-soft-deep to-soft-azure text-white shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{botName} · Lead Agent</p>
            <p className="text-[10px] text-white/75">
              {companyName} · Guardrails v2 · RAG-only facts · policy-authorized actions
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center"
            title="Minimize"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {!showEmailDraft ? (
          <>
            <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 bg-soft-mist/50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-soft ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-soft-deep to-soft-azure text-white rounded-br-md'
                        : 'bg-white border border-soft-sky/40 text-ink-soft rounded-bl-md'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-soft-sky/40 rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-xs text-ink-muted">
                    <Spinner /> {botName} is typing…
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {handoff?.needsHandoff && (
              <div className="px-3 py-2 border-t border-soft-sky/30 bg-soft-foam/80 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-soft-deep truncate">Human help suggested</p>
                    <p className="text-[10px] text-ink-muted truncate">{handoff.handoffReason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEmailDraft(true)}
                    className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-soft-deep to-soft-azure text-white"
                  >
                    Draft email
                  </button>
                </div>
                {handoff.nextBestAction && (
                  <p className="text-[10px] text-soft-azure font-semibold">Next: {handoff.nextBestAction}</p>
                )}
                {handoff.scoreExplanation && (
                  <p className="text-[10px] text-ink-muted truncate" title={handoff.scoreExplanation}>
                    Score factors: {handoff.scoreExplanation}
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-3 border-t border-soft-sky/30 bg-white/85 flex items-center gap-2 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message ${botName}…`}
                className="nexora-input flex-1 py-2.5 px-3.5 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-soft-deep to-soft-azure text-white disabled:opacity-40 shadow-soft flex items-center justify-center"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-soft-mist/40">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-ink">Email a human specialist</p>
                <p className="text-[11px] text-ink-muted">Conversation summary is already included.</p>
              </div>
              {handoff && <LeadBadge temperature={handoff.leadTemperature} score={handoff.leadScore} />}
            </div>

            <label className="block text-xs font-semibold text-ink-soft">
              To
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="nexora-input mt-1 w-full py-2 px-3 text-sm !rounded-xl"
              />
            </label>
            <label className="block text-xs font-semibold text-ink-soft">
              Subject
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="nexora-input mt-1 w-full py-2 px-3 text-sm !rounded-xl"
              />
            </label>
            <label className="block text-xs font-semibold text-ink-soft">
              Message (includes full chat)
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={12}
                className="mt-1 w-full py-2.5 px-3 text-sm text-ink bg-soft-bg border border-soft-sky/60 rounded-xl focus:outline-none focus:ring-4 focus:ring-soft-sky/60 focus:bg-white resize-none"
              />
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={openMailClient} className="nexora-btn-primary px-4 py-2.5 text-xs">
                Open in mail app
              </button>
              <button
                type="button"
                onClick={copyEmail}
                className="px-4 py-2.5 text-xs font-semibold rounded-full bg-white border border-soft-sky text-ink-soft"
              >
                Copy draft
              </button>
              <button
                type="button"
                onClick={() => setShowEmailDraft(false)}
                className="px-4 py-2.5 text-xs font-semibold rounded-full bg-soft-bg text-ink-muted"
              >
                Back to chat
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          pointer-events-auto relative
          w-14 h-14 rounded-full shadow-aqua
          bg-gradient-to-br from-soft-azure to-soft-deep text-white
          flex items-center justify-center
          transition-transform duration-300 hover:scale-105 active:scale-95
          ${open ? '' : 'animate-[float_3.2s_ease-in-out_infinite]'}
        `}
        aria-label={open ? `Close ${botName}` : `Open ${botName}`}
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default LeadAgentChat;
