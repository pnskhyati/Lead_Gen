import React, { useState, useRef, useEffect, FormEvent } from 'react';
import type { ChatMessage } from '../types';
import { chatWithBridalAssistant } from '../services/geminiService';
import Spinner from './common/Spinner';
import Card from './common/Card';

const BridalAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const savedHistory = localStorage.getItem('nexora-bridal-chat-history');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          return parsedHistory;
        }
      }
    } catch (error) {
      console.error("Failed to load bridal chat history from localStorage", error);
    }
    return [
      { role: 'model', text: "Congratulations on your engagement! I am AURA, your personal AI bridal assistant. How can I help you plan your perfect day?"}
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
      localStorage.setItem('nexora-bridal-chat-history', JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to save bridal chat history to localStorage", error);
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
      const responseText = await chatWithBridalAssistant(apiHistory, trimmedInput);
      const modelMessage: ChatMessage = { 
        role: 'model', 
        text: responseText, 
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
      { role: 'model', text: "Of course, let's start fresh. What shall we plan first?"}
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
    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 border-2 border-brand-violet flex items-center justify-center flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-violet" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 5a1 1 0 000 2h6a1 1 0 100-2H7zM10 15a4.472 4.472 0 004.243-3.228 1 1 0 10-1.833-.805A2.472 2.472 0 0110 13a2.472 2.472 0 01-2.41-2.033 1 1 0 10-1.833.805A4.472 4.472 0 0010 15z" clipRule="evenodd" />
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
            <div className="px-4 py-3 rounded-xl shadow-md bg-brand-violet text-white">
                <p className="text-sm font-medium whitespace-pre-wrap">{message.text}</p>
            </div>
          ) : (
            <Card className="hover:!border-slate-200 dark:hover:!border-slate-700/60 hover:transform-none">
              <div className="space-y-4">
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: message.text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 dark:text-white">$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto w-full animate-fade-in">
        <div className="bg-white/40 dark:bg-slate-900/50 backdrop-blur-lg border border-brand-violet/20 dark:border-brand-violet/30 rounded-xl shadow-2xl shadow-brand-violet/5 dark:shadow-brand-violet/10">
            <div className="flex flex-col h-[calc(100vh-10rem)]">
                <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bridal Assistant</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Your personal wedding planner, AURA.</p>
                    </div>
                    <button 
                        onClick={handleClearChat}
                        title="Clear chat history"
                        className="flex items-center gap-2 text-xs bg-slate-200/60 hover:bg-slate-300/60 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white px-3 py-1.5 rounded-md transition-colors"
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
                        <Card className="hover:!border-slate-200 dark:hover:!border-slate-700/60 hover:transform-none py-3 px-4">
                            <div className="flex items-center">
                              <Spinner />
                              <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">Planning...</span>
                            </div>
                        </Card>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80">
                    <form onSubmit={handleSubmit} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about venues, timelines, dresses..."
                        className="flex-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm py-2.5 px-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-brand-violet transition-all"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="w-10 h-10 flex-shrink-0 bg-brand-violet text-white font-bold p-2.5 rounded-full hover:bg-brand-violet/80 transition-all duration-300 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50 group shadow-lg shadow-brand-violet/30 hover:shadow-brand-violet/40 hover:-translate-y-0.5"
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

export default BridalAssistant;