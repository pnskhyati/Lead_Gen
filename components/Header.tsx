import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  onLogout: () => void;
}

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200/50 dark:bg-slate-700/50 hover:bg-slate-300/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors duration-200"
        >
            {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.706-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 14.464A1 1 0 106.465 13.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm-1.414-2.12a1 1 0 011.414 0l.706.707a1 1 0 11-1.414 1.414l-.706-.707a1 1 0 010-1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" clipRule="evenodd" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
            )}
        </button>
    )
}

const NotificationsDropdown: React.FC = () => {
  const notifications = [
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
      title: "New report available: Q2 Sales Performance",
      time: "5 mins ago"
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
      title: "Campaign 'Summer Sips' needs approval",
      time: "1 hour ago"
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a2 2 0 012 2v5a2 2 0 01-2 2h-1v-2a5 5 0 00-5-5H7V7a3 3 0 013-3h5z" /></svg>,
      title: "Mention detected on Instagram for Smirnoff",
      time: "3 hours ago"
    }
  ];

  return (
    <div className="absolute top-12 right-0 w-80 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/60 rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/30 animate-fade-in origin-top-right">
      <div className="p-4 border-b border-slate-200/80 dark:border-slate-700/80">
        <h3 className="font-semibold text-slate-800 dark:text-white">Notifications</h3>
      </div>
      <ul className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
        {notifications.map((item, index) => (
          <li key={index}>
            <a href="#" className="flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-900/50 flex items-center justify-center">
                {item.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.title}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{item.time}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <div className="p-2">
        <a href="#" className="block w-full text-center text-sm font-semibold text-brand-blue hover:bg-brand-blue/10 rounded-md py-2 transition-colors">
          View all notifications
        </a>
      </div>
    </div>
  );
};


const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);


  const IconButton: React.FC<{ children: React.ReactNode; onClick?: () => void; ariaLabel: string; className?: string; }> = ({ children, onClick, ariaLabel, className }) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`relative w-10 h-10 flex items-center justify-center rounded-full bg-slate-200/50 dark:bg-slate-700/50 hover:bg-slate-300/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors duration-200 ${className}`}
    >
      {children}
    </button>
  );

  return (
    <header className="relative z-10 flex-shrink-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {/* Placeholder for a page title */}
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            <div className="relative" ref={notificationsRef}>
              <IconButton 
                ariaLabel="Notifications"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800/70" />
              </IconButton>
              {isNotificationsOpen && <NotificationsDropdown />}
            </div>

            <IconButton onClick={onLogout} ariaLabel="Logout">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </IconButton>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;