import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Plus, 
  User, 
  MessageSquare, 
  Layers, 
  ArrowRight,
  Calendar,
  Sparkles
} from 'lucide-react';
import { NavCategory, SubCategory } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNav: (category: NavCategory, subCategory?: SubCategory) => void;
  onTriggerQuickAction: (action: 'campaign' | 'content' | 'lead' | 'schedule') => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectNav,
  onTriggerQuickAction
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-xl bg-[#061816] border border-[rgba(169,191,165,0.3)] shadow-2xl rounded-[2px] overflow-hidden font-mono text-xs text-[#E8E9D8]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar (Page 9 spec) */}
        <div className="flex items-center px-4 py-3.5 border-b border-[rgba(169,191,165,0.2)] bg-[#071C1A]">
          <Search className="w-4 h-4 text-[#A9BFA5] mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search leads, conversations, campaigns, or actions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-[#E8E9D8] text-xs focus:outline-none placeholder-[#A9BFA5]/50 font-light"
          />
          <button type="button" onClick={onClose} className="text-[#A9BFA5] hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content sections */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4 divide-y divide-[rgba(169,191,165,0.12)]">
          
          {/* ACTIONS */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-[#A9BFA5]/60 font-semibold block">
              ACTIONS
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerQuickAction('lead');
                }}
                className="px-2.5 py-1 bg-[#0D2D2A] hover:bg-[#A9BFA5]/20 border border-[rgba(169,191,165,0.25)] rounded text-[#E8E9D8] cursor-pointer"
              >
                + New lead
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerQuickAction('schedule');
                }}
                className="px-2.5 py-1 bg-[#0D2D2A] hover:bg-[#A9BFA5]/20 border border-[rgba(169,191,165,0.25)] rounded text-[#E8E9D8] cursor-pointer"
              >
                + New post
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerQuickAction('campaign');
                }}
                className="px-2.5 py-1 bg-[#0D2D2A] hover:bg-[#A9BFA5]/20 border border-[rgba(169,191,165,0.25)] rounded text-[#E8E9D8] cursor-pointer"
              >
                + New campaign
              </button>
            </div>
          </div>

          {/* LEADS */}
          <div className="pt-3 space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#A9BFA5]/60 font-semibold block">
              LEADS
            </span>
            <div 
              onClick={() => {
                onClose();
                onSelectNav('leads', 'all-leads');
              }}
              className="p-2 hover:bg-[#0D2D2A]/40 rounded cursor-pointer flex items-center justify-between"
            >
              <div>
                <span className="font-semibold text-white">Aster Labs</span>
                <span className="text-[#A9BFA5] ml-2">· Qualified · Hot</span>
              </div>
              <span className="text-[#A9BFA5]/60 text-[10px]">92 score</span>
            </div>
          </div>

          {/* CONVERSATIONS */}
          <div className="pt-3 space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#A9BFA5]/60 font-semibold block">
              CONVERSATIONS
            </span>
            <div 
              onClick={() => {
                onClose();
                onSelectNav('inbox', 'inbox');
              }}
              className="p-2 hover:bg-[#0D2D2A]/40 rounded cursor-pointer flex items-center justify-between"
            >
              <div>
                <span className="font-semibold text-white">Rahul Sharma</span>
                <span className="text-[#A9BFA5] ml-2">· WhatsApp · 4 min ago</span>
              </div>
              <span className="text-amber-300 text-[10px]">Needs you</span>
            </div>
          </div>

          {/* PAGES */}
          <div className="pt-3 space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#A9BFA5]/60 font-semibold block">
              PAGES
            </span>
            <div 
              onClick={() => {
                onClose();
                onSelectNav('inbox', 'inbox');
              }}
              className="p-2 hover:bg-[#0D2D2A]/40 rounded cursor-pointer text-xs"
            >
              Inbox › Needs you
            </div>
            <div 
              onClick={() => {
                onClose();
                onSelectNav('followups', 'follow-ups');
              }}
              className="p-2 hover:bg-[#0D2D2A]/40 rounded cursor-pointer text-xs"
            >
              Leads › Follow-ups
            </div>
            <div 
              onClick={() => {
                onClose();
                onSelectNav('agents', 'competitor');
              }}
              className="p-2 hover:bg-[#0D2D2A]/40 rounded cursor-pointer text-xs"
            >
              Agents › Competitor social → content
            </div>
            <div 
              onClick={() => {
                onClose();
                onSelectNav('channels', 'connections');
              }}
              className="p-2 hover:bg-[#0D2D2A]/40 rounded cursor-pointer text-xs"
            >
              Connections › Instagram, X, Google, SEO
            </div>
            <div 
              onClick={() => {
                onClose();
                onSelectNav('admin', 'brand');
              }}
              className="p-2 hover:bg-[#0D2D2A]/40 rounded cursor-pointer text-xs"
            >
              Admin › Brand & knowledge
            </div>
          </div>

        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-[rgba(169,191,165,0.15)] bg-[#071C1A] text-[10px] text-[#A9BFA5]/60 flex items-center justify-between">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}
