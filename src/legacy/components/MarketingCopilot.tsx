import React, { useState, useRef, useEffect, FormEvent, useImperativeHandle, forwardRef } from 'react';
import type { ChatMessage } from '../types';
import { chatWithCopilot } from '../services/geminiService';
import Spinner from './common/Spinner';
import Chart from './common/Chart';

export interface FloatingChatHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MarketingCopilot = forwardRef<FloatingChatHandle>((_props, ref) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const savedHistory = localStorage.getItem('nexora-chat-history');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          return parsedHistory;
        }
      }
    } catch (error) {
      console.error('Failed to load chat history from localStorage', error);
    }
    return [
      {
        role: 'model',
        text: "Hi — I'm Catalyst AI. Ask about markets, brands, or campaigns.\n\nTry: *'Compare Tanqueray vs Gordon\\'s market share.'*",
      },
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen((v) => !v),
  }));

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 180);
    }
  }, [open, messages, isLoading]);

  useEffect(() => {
    try {
      localStorage.setItem('nexora-chat-history', JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save chat history to localStorage', error);
    }
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: trimmedInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiHistory = [...messages, userMessage].map(({ role, text }) => ({ role, text }));
      const response = await chatWithCopilot(apiHistory, trimmedInput);
      const modelMessage: ChatMessage = {
        role: 'model',
        text: response.textReply,
        sources: response.sources,
        chartData: response.chartData,
      };
      setMessages((prev) => [...prev, modelMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'My apologies, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([{ role: 'model', text: 'Welcome back. How may I assist you today?' }]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 pointer-events-none">
      {/* Panel */}
      <div
        className={`
          pointer-events-auto w-[min(100vw-1.5rem,380px)] h-[min(72vh,560px)]
          flex flex-col overflow-hidden
          rounded-[1.75rem] border border-soft-sky/50
          bg-white/90 backdrop-blur-2xl shadow-soft-lg
          origin-bottom-right transition-all duration-300 ease-out
          ${open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-4 pointer-events-none absolute'}
        `}
        aria-hidden={!open}
      >
        <div className="px-4 py-3.5 flex items-center justify-between gap-2 bg-gradient-to-r from-soft-deep to-soft-azure text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">Catalyst AI</p>
              <p className="text-[10px] text-white/75 font-medium">Flying assistant · online</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleClearChat}
              title="Clear chat"
              className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Minimize"
              className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 bg-soft-mist/40">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={index}
                className={`flex w-full animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-soft ${
                    isUser
                      ? 'bg-gradient-to-br from-soft-deep to-soft-azure text-white rounded-br-md'
                      : 'bg-white border border-soft-sky/40 text-ink-soft rounded-bl-md'
                  }`}
                >
                  {isUser ? (
                    message.text
                  ) : (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: message.text.replace(/\*(.*?)\*/g, '<strong class="text-ink">$1</strong>'),
                      }}
                    />
                  )}
                  {message.chartData && (
                    <div className="mt-3 bg-soft-bg rounded-xl p-2.5 h-[240px] overflow-hidden">
                      <Chart chartData={message.chartData} compact />
                    </div>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.sources.slice(0, 3).map((source, i) => (
                        <a
                          key={i}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[10px] text-soft-azure truncate hover:underline"
                        >
                          {i + 1}. {source.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white border border-soft-sky/40 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-soft flex items-center gap-2">
                <Spinner />
                <span className="text-xs text-ink-muted">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-3 border-t border-soft-sky/30 bg-white/80 flex items-center gap-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Catalyst…"
            className="nexora-input flex-1 py-2.5 px-3.5 text-sm text-ink placeholder:text-ink-muted"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-soft-deep to-soft-azure text-white rounded-full hover:shadow-aqua transition-all disabled:opacity-40 shadow-soft flex items-center justify-center"
            aria-label="Send"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          pointer-events-auto group relative
          w-14 h-14 rounded-full shadow-aqua
          bg-gradient-to-br from-soft-deep via-soft-azure to-soft-lilac text-white
          flex items-center justify-center
          transition-transform duration-300 hover:scale-105 active:scale-95
          ${open ? 'rotate-0' : 'animate-[float_3s_ease-in-out_infinite]'}
        `}
        aria-label={open ? 'Close chat' : 'Open Catalyst AI chat'}
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-soft-coral ring-2 ring-white" />
        )}
      </button>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
});

MarketingCopilot.displayName = 'MarketingCopilot';

export default MarketingCopilot;
