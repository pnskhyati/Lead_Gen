import React, { useState, useEffect, useRef } from 'react';
import type { View } from '../types';
import { APP_INITIAL, APP_NAME } from '../constants/branding';
import { getLeadCounts, getLeads } from '../services/leadStore';

interface HeaderProps {
  onLogout: () => void;
  currentView?: View;
  setCurrentView?: (view: View) => void;
}

const VIEW_LABELS: Record<View, string> = {
  insights: 'Growth Radar',
  campaigns: 'Campaigns',
  lab: 'Creative Lab',
  linkedin: 'Social Hub',
  automation: 'Lead Inbox',
  chat: 'AI Assistant',
  admin: 'Admin Console',
};

const TOP_TABS: { view: View; label: string }[] = [
  { view: 'insights', label: 'Radar' },
  { view: 'campaigns', label: 'Campaigns' },
  { view: 'lab', label: 'Lab' },
  { view: 'linkedin', label: 'Social' },
  { view: 'automation', label: 'Leads' },
];

const NotificationsDropdown: React.FC<{ handoffs?: number; hot?: number }> = ({
  handoffs = 0,
  hot = 0,
}) => {
  const notifications = [
    hot > 0
      ? { title: `${hot} hot lead${hot === 1 ? '' : 's'} need attention`, time: 'Live', tint: 'bg-soft-coral/20 text-soft-coral' }
      : { title: 'No hot leads in queue', time: 'Live', tint: 'bg-soft-mint text-soft-deep' },
    handoffs > 0
      ? { title: `${handoffs} conversation${handoffs === 1 ? '' : 's'} awaiting human takeover`, time: 'Live', tint: 'bg-soft-coral/20 text-soft-coral' }
      : { title: 'AI engagement active — no handoffs waiting', time: 'Live', tint: 'bg-soft-sky text-soft-azure' },
    { title: 'Never miss another lead — run the demo checklist on Growth Radar', time: 'Tip', tint: 'bg-soft-mint text-soft-deep' },
  ];

  return (
    <div className="absolute top-12 right-0 w-80 bg-white/95 backdrop-blur-xl border border-white shadow-soft-lg rounded-3xl animate-fade-in origin-top-right overflow-hidden z-50">
      <div className="p-4 border-b border-slate-100">
        <h3 className="font-semibold text-ink">Notifications</h3>
      </div>
      <ul>
        {notifications.map((item, index) => (
          <li key={index}>
            <a href="#" className="flex items-start gap-3 p-4 hover:bg-soft-bg/80 transition-colors">
              <div className={`flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center ${item.tint}`}>
                <span className="w-2 h-2 rounded-full bg-current" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-soft">{item.title}</p>
                <p className="text-xs text-ink-muted mt-1">{item.time}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ onLogout, currentView = 'insights', setCurrentView }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const notificationsRef = useRef<HTMLDivElement>(null);
  const counts = getLeadCounts();
  const handoffs = getLeads().filter(
    (l) => l.status === 'handed_off' || l.conversationState === 'HUMAN_REQUIRED'
  ).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationsOpen]);

  return (
    <header className="relative z-10 flex-shrink-0 px-2 sm:px-4 pt-4 pb-2">
      <div className="bg-white/65 backdrop-blur-2xl border border-soft-sky/40 shadow-soft rounded-[1.75rem] px-4 sm:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-soft-azure">{APP_NAME}</p>
            <h1 className="font-display text-2xl font-semibold text-ink truncate leading-tight">{VIEW_LABELS[currentView]}</h1>
          </div>
        </div>

        {setCurrentView && (
          <nav className="hidden md:flex items-center gap-1 p-1 bg-soft-foam/90 rounded-full border border-soft-sky/40">
            {TOP_TABS.map((tab) => {
              const active = currentView === tab.view;
              return (
                <button
                  key={tab.view}
                  type="button"
                  onClick={() => setCurrentView(tab.view)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full transition-all ${
                    active
                      ? 'bg-gradient-to-r from-soft-deep to-soft-azure text-white shadow-aqua'
                      : 'text-ink-muted hover:text-ink hover:bg-white/90 hover:shadow-sm'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads…"
              className="nexora-input w-full py-2.5 pl-4 pr-11 text-sm text-ink placeholder:text-ink-muted"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && setCurrentView) {
                  setCurrentView('automation');
                }
              }}
            />
            <button
              type="button"
              aria-label="Search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-soft-deep to-soft-azure text-white flex items-center justify-center shadow-aqua"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
              </svg>
            </button>
          </div>

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative w-10 h-10 rounded-2xl bg-soft-bg text-ink-soft hover:bg-white hover:text-ink hover:shadow-soft flex items-center justify-center transition-all hover:-translate-y-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-soft-coral ring-2 ring-white" />
            </button>
            {isNotificationsOpen && (
              <NotificationsDropdown handoffs={handoffs} hot={counts.hot} />
            )}
          </div>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-soft bg-gradient-to-br from-soft-deep to-soft-azure flex items-center justify-center text-sm font-bold text-white hover:shadow-soft-hover hover:-translate-y-0.5 transition-all"
            title="Sign out"
          >
            {APP_INITIAL}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
