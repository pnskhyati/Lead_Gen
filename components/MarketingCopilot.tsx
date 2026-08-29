import React, { useState, useRef, useEffect, FormEvent } from 'react';
import type { ChatMessage } from '../types';
import { chatWithCopilot } from '../services/geminiService';
import Spinner from './common/Spinner';
import Chart from './common/Chart';
import Card from './common/Card';

const MarketingCopilot: React.FC = () => {
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
      console.error("Failed to load chat history from localStorage", error);
    }
    return [
      { role: 'model', text: "Welcome to Catalyst AI. I can provide up-to-date market analysis, brand insights, and generate data visualizations. How may I assist you?\n\nFor example, try asking: *'Compare the market share of Tanqueray vs. Gordon's.'*"}
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem('nexora-chat-history', JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to save chat history to localStorage", error);
    }
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: trimmedInput };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiHistory = [...messages, userMessage].map(({ role, text }) => ({ role, text }));
      const response = await chatWithCopilot(apiHistory, trimmedInput);
      const modelMessage: ChatMessage = { 
        role: 'model', 
        text: response.textReply, 
        sources: response.sources,
        chartData: response.chartData
      };
      setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
      const errorMessage: ChatMessage = { role: 'model', text: 'My apologies, I encountered an error. Please try your request again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearChat = () => {
    setMessages([
      { role: 'model', text: "Welcome to Catalyst AI. How may I assist you today?"}
    ]);
  };

  const UserAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center font-bold text-slate-700 dark:text-white text-sm flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    </div>
  );
  
  const ModelAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 border-2 border-brand-blue flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-brand-blue" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 3.5a1.5 1.5 0 013 0V5a1 1 0 001 1h1.5a1.5 1.5 0 010 3H14a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V10a1 1 0 00-1-1H7.5a1.5 1.5 0 010-3H9a1 1 0 001-1V3.5zM7.5 11H9a1 1 0 001 1v1.5a1.5 1.5 0 01-3 0V12a1 1 0 00-1-1H3.5a1.5 1.5 0 010-3H5a1 1 0 001-1V6.5a1.5 1.5 0 013 0V8a1 1 0 001 1h1.5a1.5 1.5 0 010 3H12a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V14a1 1 0 00-1-1H5.5a1.5 1.5 0 010-3H7a1 1 0 001-1V8.5a1.5 1.5 0 01-3 0V10a1 1 0 00-1 1H1.5a1.5 1.5 0 010 3H3a1 1 0 001 1v1.5a1.5 1.5 0 01-3 0V16a1 1 0 00-1-1H.5a1.5 1.5 0 010-3H2a1 1 0 001-1v-1.5a1.5 1.5 0 013 0v.005z"></path>
      </svg>
    </div>
  );

  const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    return (
      <div className={`flex w-full gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {isUser ? <UserAvatar /> : <ModelAvatar />}
        <div className={`w-full max-w-2xl`}>
          {isUser ? (
            <div className="px-4 py-3 rounded-3xl shadow-aqua bg-gradient-to-br from-soft-deep to-soft-azure text-white">
                <p className="text-sm font-medium whitespace-pre-wrap">{message.text}</p>
            </div>
          ) : (
            <Card className="hover:transform-none">
              <div className="space-y-4">
                <p className="text-sm text-ink-soft whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: message.text.replace(/\*(.*?)\*/g, '<strong class="text-ink">$1</strong>') }} />
                
                {message.chartData && (
                  <div className="bg-soft-bg p-4 rounded-3xl mt-4">
                    <div className="h-80">
                      <Chart chartData={message.chartData} />
                    </div>
                  </div>
                )}

                {message.sources && message.sources.length > 0 && (
                  <div>
                      <h4 className="text-xs font-semibold text-ink-muted mb-2">Sources</h4>
                      <div className="flex flex-col items-start gap-2">
                          {message.sources.map((source, index) => (
                              <a 
                                  key={index} 
                                  href={source.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs bg-soft-bg text-ink-soft hover:bg-soft-sky px-3 py-1.5 rounded-full transition-colors w-full"
                                  title={source.title}
                              >
                                  <span className="flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-ink text-white text-[10px] font-bold">{index + 1}</span>
                                  <span className="truncate">{source.title}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                          ))}
                      </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto w-full animate-fade-in">
        <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2rem] shadow-soft-lg">
            <div className="flex flex-col h-[calc(100vh-10rem)]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-ink">AI Assistant</h1>
                        <p className="text-sm text-ink-muted">Conversational marketing intelligence.</p>
                    </div>
                    <button 
                        onClick={handleClearChat}
                        title="Clear chat history"
                        className="flex items-center gap-2 text-xs bg-soft-bg hover:bg-white text-ink-muted hover:text-ink px-3 py-1.5 rounded-full transition-colors font-semibold"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear Chat
                    </button>
                </div>
                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                    {messages.map((msg, index) => <MessageBubble key={index} message={msg} />)}
                    {isLoading && (
                      <div className="flex w-full gap-3 animate-fade-in flex-row">
                        <ModelAvatar />
                        <Card className="hover:transform-none py-3 px-4">
                            <div className="flex items-center">
                              <Spinner />
                              <span className="ml-2 text-sm text-ink-soft">Thinking...</span>
                            </div>
                        </Card>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-slate-100">
                    <form onSubmit={handleSubmit} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question or request a data comparison..."
                        className="nexora-input flex-1 py-3 px-4 text-sm text-ink placeholder:text-ink-muted"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="w-11 h-11 flex-shrink-0 bg-gradient-to-br from-soft-deep to-soft-azure text-white rounded-full hover:shadow-aqua transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-soft flex items-center justify-center group"
                        aria-label="Send message"
                    >
                      <svg className="w-full h-full transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 14L21 3M21 3L15 22L10 14M21 3L3 10L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
  );
};

export default MarketingCopilot;