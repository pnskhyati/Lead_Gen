import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  FileText,
  TrendingUp,
  Megaphone
} from 'lucide-react';
import { AssistantMessage, StatMetric, Lead, Campaign } from '../../types';

interface AssistantViewProps {
  metrics: StatMetric[];
  leads: Lead[];
  campaigns: Campaign[];
  onTriggerQuickAction: (action: 'campaign' | 'content' | 'lead' | 'schedule') => void;
}

export default function AssistantView({
  metrics,
  leads,
  campaigns,
  onTriggerQuickAction
}: AssistantViewProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      content: 'Good morning, Evelyn. I have full context on your active campaigns, 248 total leads, and recent reach performance. How can I assist your operations today?',
      timestamp: '9:00 AM',
      suggestedActions: [
        'Analyze conversion bottlenecks in Q2 campaigns',
        'Draft executive newsletter based on trending spatial audio',
        'Summarize top 3 leads ready for closing'
      ]
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim()) return;

    const userMsg: AssistantMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: query,
      timestamp: 'Just now'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsTyping(true);

    setTimeout(() => {
      let botReply = '';
      let suggested: string[] | undefined = undefined;

      const lower = query.toLowerCase();
      if (lower.includes('conversion') || lower.includes('bottleneck')) {
        botReply = `Based on current metrics, your global conversion rate is strong at 64% (+3.1% this week). However, the "Micro-Interaction Showcase" draft has yet to launch, and "Quiet Horizon" is yielding 4.8% on LinkedIn. Recommended action: Synchronize an automated personalized follow-up sequence for qualified prospects with intent scores above 85.`;
        suggested = ['Prepare follow-up sequence', 'Review campaign budgets'];
      } else if (lower.includes('lead') || lower.includes('closing')) {
        botReply = `Your highest-conviction leads currently are:\n1. Julian Montgomery (Vanguard Atelier) — Intent Score: 94 · Retainer: $12,400 · Viewed proposal 12m ago.\n2. Marcus Thorne (Aether Collective) — Intent Score: 96 · Scheduled strategy sync.\n3. Seraphina Lin (Komorebi) — Inbound referral awaiting review.`;
        suggested = ['Draft reply to Julian', 'View Live Leads table'];
      } else if (lower.includes('newsletter') || lower.includes('draft') || lower.includes('spatial')) {
        botReply = `I have drafted a high-conviction narrative combining "Minimalist Spatial Audio Systems" (+58% market growth) with Nexora's architectural philosophy. Would you like me to push this directly into Creative Lab for one-click distribution?`;
        suggested = ['Send to Creative Lab', 'Refine with provocation tone'];
      } else {
        botReply = `I analyzed your query in connection with Nexora's live data streams. 32 active campaigns are operating within normal bandwidth parameters. Let me know if you would like me to draft new assets or generate automated outreach.`;
        suggested = ['+ Create Campaign', '+ Schedule Post'];
      }

      const botMsg: AssistantMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: botReply,
        timestamp: 'Just now',
        suggestedActions: suggested
      };

      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <div className="space-y-8 py-4 max-w-4xl mx-auto">
      {/* Header */}
      <section className="border-b border-[rgba(169,191,165,0.2)] pb-6 flex items-baseline justify-between">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-2">
            INTELLIGENT COMMAND COPILOT
          </span>
          <h1 className="serif text-4xl sm:text-5xl font-light text-[#E8E9D8] tracking-tight">
            AI Assistant
          </h1>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-[#A9BFA5]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Context Synchronized</span>
        </div>
      </section>

      {/* Chat messages log (Sharp border, no rounded cards) */}
      <div className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A] divide-y divide-[rgba(169,191,165,0.15)] min-h-[420px] max-h-[560px] overflow-y-auto p-6 space-y-6">
        {messages.map((m) => (
          <div key={m.id} className="pt-4 first:pt-0">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-[2px] bg-[#0D2D2A] border border-[rgba(169,191,165,0.2)] flex items-center justify-center shrink-0 mt-0.5">
                {m.sender === 'assistant' ? (
                  <Sparkles className="w-3.5 h-3.5 text-[#A9BFA5]" />
                ) : (
                  <User className="w-3.5 h-3.5 text-[#E8E9D8]" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-xs uppercase tracking-wider text-[#E8E9D8] font-medium">
                    {m.sender === 'assistant' ? 'Nexora Copilot' : 'You'}
                  </span>
                  <span className="text-[10px] text-[#A9BFA5]/60 font-mono">{m.timestamp}</span>
                </div>

                <div className="text-xs sm:text-sm text-[#E8E9D8] font-light leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>

                {/* Suggested follow-ups */}
                {m.suggestedActions && m.suggestedActions.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {m.suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendMessage(action)}
                        className="text-[11px] font-light text-[#A9BFA5] hover:text-[#E8E9D8] border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5] px-2.5 py-1 transition-colors cursor-pointer"
                      >
                        {action} &rarr;
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center space-x-2 text-xs text-[#A9BFA5] font-light pt-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Consulting live workspace telemetry...</span>
          </div>
        )}
      </div>

      {/* Input box */}
      <div className="border border-[rgba(169,191,165,0.25)] p-2 bg-[#061816] flex items-center space-x-3">
        <input
          type="text"
          placeholder="Ask anything about leads, campaign performance, or content synthesis..."
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          className="flex-1 bg-transparent text-xs sm:text-sm text-[#E8E9D8] px-3 py-2 focus:outline-none placeholder-[#A9BFA5]/40 font-light"
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputPrompt.trim() || isTyping}
          className="bg-[#E8E9D8] text-[#071C1A] px-5 py-2.5 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
        >
          <span>Send</span>
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
