import React, { useState } from 'react';
import type { View } from '../types';
import { APP_INITIAL, APP_NAME } from '../constants/branding';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NAV: { view: View; label: string; icon: React.ReactNode; tint: string }[] = [
  {
    view: 'insights',
    label: 'Growth Radar',
    tint: 'bg-soft-sky text-soft-azure',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h4v8H3v-8zm7-6h4v14h-4V7zm7 3h4v11h-4V10z" />
      </svg>
    ),
  },
  {
    view: 'campaigns',
    label: 'Campaigns',
    tint: 'bg-soft-mint text-soft-deep',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    view: 'lab',
    label: 'Creative Lab',
    tint: 'bg-soft-lavender text-soft-lilac',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
  },
  {
    view: 'linkedin',
    label: 'Social Hub',
    tint: 'bg-soft-foam text-soft-azure',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.238 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    ),
  },
  {
    view: 'agents',
    label: 'Agents',
    tint: 'bg-soft-mint text-soft-deep',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    view: 'automation',
    label: 'Lead Inbox',
    tint: 'bg-soft-peach text-soft-deep',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    view: 'chat',
    label: 'AI Assistant',
    tint: 'bg-soft-sky text-soft-azure',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    view: 'admin',
    label: 'Admin',
    tint: 'bg-soft-lavender text-soft-lilac',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`
        hidden sm:flex flex-shrink-0 flex-col items-stretch py-6 pl-3 pr-2 z-40
        transition-[width] duration-300 ease-out
        ${expanded ? 'w-[220px]' : 'w-[92px]'}
      `}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="h-full flex flex-col bg-white/75 backdrop-blur-2xl border border-soft-sky/50 shadow-soft rounded-[2rem] py-5 px-3 overflow-visible">
        <div className={`mb-8 flex items-center gap-3 ${expanded ? 'px-1' : 'justify-center'}`}>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-soft-deep via-soft-azure to-soft-lilac text-white flex items-center justify-center font-extrabold text-lg shadow-aqua flex-shrink-0">
            {APP_INITIAL}
          </div>
          <span
            className={`font-display font-semibold text-ink text-2xl tracking-tight whitespace-nowrap transition-all duration-300 ${
              expanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0 overflow-hidden'
            }`}
          >
            {APP_NAME}
          </span>
        </div>

        <nav className="flex-1 w-full flex flex-col gap-2">
          {NAV.map((item) => {
            const active = currentView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => setCurrentView(item.view)}
                className={`
                  flex items-center gap-3 h-12 rounded-2xl transition-all duration-200
                  ${expanded ? 'px-3 w-full justify-start' : 'w-12 mx-auto justify-center px-0'}
                  ${active
                    ? 'bg-gradient-to-br from-soft-deep to-soft-azure text-white shadow-aqua'
                    : `${item.tint} hover:brightness-95 hover:shadow-soft hover:-translate-y-0.5`}
                `}
              >
                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
                  {item.icon}
                </span>
                <span
                  className={`text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                    expanded ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0 overflow-hidden'
                  } ${active ? 'text-white' : 'text-ink'}`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
