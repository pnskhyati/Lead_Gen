import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  ChevronDown, 
  User, 
  Settings, 
  HelpCircle, 
  LogOut, 
  Menu,
  CheckCircle2,
  Sparkles,
  Command,
  X,
  Sun,
  Moon,
  Plus,
  Calendar,
  Megaphone,
  Check,
  Clock,
  ExternalLink
} from 'lucide-react';
import { NavCategory, SubCategory } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface AppTopBarProps {
  activeCategory: NavCategory;
  activeSubCategory: SubCategory;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
  onOpenQuickSearch: () => void;
  onSelectNav: (category: NavCategory, subCategory?: SubCategory) => void;
  onTriggerNew: (type: 'lead' | 'post' | 'content' | 'campaign') => void;
  onOpenProfileDrawer?: () => void;
  onOpenLogin?: () => void;
  currentUser?: { name: string; email: string; workspace: string; role?: string } | null;
  currentRecordTitle?: string;
  tecavyShell?: boolean;
}

export default function AppTopBar({
  activeCategory,
  activeSubCategory,
  onOpenMobileMenu,
  onLogout,
  onOpenQuickSearch,
  onSelectNav,
  onTriggerNew,
  onOpenProfileDrawer,
  onOpenLogin,
  currentUser,
  currentRecordTitle,
  tecavyShell = false,
}: AppTopBarProps) {
  const { theme, setTheme } = useTheme();

  // Menus state
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const newMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target as Node)) {
        setNewMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setNotifMenuOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listeners for + New
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        onTriggerNew('lead');
      } else if (e.key === 'p' || e.key === 'P') {
        onTriggerNew('post');
      } else if (e.key === 'c' || e.key === 'C') {
        onTriggerNew('content');
      } else if (e.key === 'm' || e.key === 'M') {
        onTriggerNew('campaign');
      } else if (e.key === '?') {
        setShowShortcutsModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTriggerNew]);

  // Notifications State (Page 9 spec)
  const [notifications, setNotifications] = useState([
    {
      id: 'n-1',
      group: 'TODAY',
      unread: true,
      title: 'Rahul Sharma needs a human',
      time: '4m',
      detail: 'WhatsApp · asked for custom pricing',
      category: 'inbox' as NavCategory,
      sub: 'inbox' as SubCategory
    },
    {
      id: 'n-2',
      group: 'TODAY',
      unread: true,
      title: 'Aster Labs qualified as Hot',
      time: '22m',
      detail: 'Score 92 · budget & timeline verified',
      category: 'leads' as NavCategory,
      sub: 'all-leads' as SubCategory
    },
    {
      id: 'n-3',
      group: 'TODAY',
      unread: true,
      title: 'Follow-up due: Nova Retail',
      time: '1h',
      detail: 'Priya Mehta · Email revised proposal',
      category: 'leads' as NavCategory,
      sub: 'follow-ups' as SubCategory
    },
    {
      id: 'n-4',
      group: 'EARLIER',
      unread: false,
      title: '"Diwali offer" post published',
      time: 'Yest.',
      detail: 'Scheduled broadcast live on Instagram',
      category: 'content' as NavCategory,
      sub: 'schedule' as SubCategory
    },
    {
      id: 'n-5',
      group: 'EARLIER',
      unread: false,
      title: 'Aisha joined the workspace',
      time: 'Mon',
      detail: 'Role: Marketing · Invited by Owner',
      category: 'settings' as NavCategory,
      sub: 'team' as SubCategory
    }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const formatCategoryTitle = (cat: NavCategory) => {
    switch (cat) {
      case 'overview': return 'Overview';
      case 'inbox': return 'Inbox';
      case 'leads': return 'Leads';
      case 'content': return 'Content';
      case 'campaigns': return 'Campaigns';
      case 'analytics': return 'Analytics';
      case 'agents': return 'Agents';
      case 'channels': return 'Connections';
      case 'admin': return 'Admin';
      case 'settings': return 'Settings';
      case 'followups': return 'Follow-ups';
      case 'agent': return 'Engagement Agent';
      case 'intelligence': return 'Market Intelligence';
      default: return cat;
    }
  };

  if (tecavyShell) {
    const pageTitle = currentRecordTitle || formatCategoryTitle(activeCategory);
    const initials = (currentUser?.name || 'N')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <header className="tecavy-topbar">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="tecavy-iconbtn md:hidden shrink-0"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="tecavy-crumb truncate">
            Tecavy workspace <span style={{ margin: '0 10px' }}>/</span> <b>{pageTitle}</b>
          </div>
        </div>
        <div className="tecavy-topright">
          <button type="button" className="tecavy-searchbtn" onClick={onOpenQuickSearch}>
            <Search className="w-4 h-4 shrink-0" />
            <span>Search</span>
            <span className="tecavy-kbd">⌘K</span>
          </button>
          <div className="relative" ref={newMenuRef}>
            <button
              type="button"
              className="tecavy-btn primary sm"
              onClick={() => setNewMenuOpen(!newMenuOpen)}
            >
              + New
            </button>
            {newMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-48 py-1.5 z-50 rounded-lg border shadow-xl text-xs"
                style={{ background: 'var(--tx-surface)', borderColor: 'var(--tx-line)' }}
              >
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-[#f3f7f9]" onClick={() => { setNewMenuOpen(false); onTriggerNew('lead'); }}>Lead</button>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-[#f3f7f9]" onClick={() => { setNewMenuOpen(false); onTriggerNew('post'); }}>Post</button>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-[#f3f7f9]" onClick={() => { setNewMenuOpen(false); onTriggerNew('content'); }}>Content</button>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-[#f3f7f9]" onClick={() => { setNewMenuOpen(false); onTriggerNew('campaign'); }}>Campaign</button>
              </div>
            )}
          </div>
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              className="tecavy-iconbtn"
              title="Notifications"
              onClick={() => setNotifMenuOpen(!notifMenuOpen)}
            >
              <Bell className="w-4 h-4" />
            </button>
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 text-[9px] font-bold text-white rounded-full px-1 min-w-[16px] text-center"
                style={{ background: 'var(--tx-teal)' }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <button
            type="button"
            className="tecavy-avatar border-0 cursor-pointer"
            onClick={() => {
              onOpenProfileDrawer?.();
              if (!currentUser) onOpenLogin?.();
            }}
          >
            {initials}
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className={`sticky top-0 z-20 w-full h-14 sm:h-16 shrink-0 border-b transition-colors select-none ${
      theme === 'light' 
        ? 'border-[#CBD5E1] bg-[#FFFFFF] shadow-2xs' 
        : 'border-[rgba(169,191,165,0.18)] bg-[#061816]'
    }`}>
      <div className={`h-full px-4 sm:px-8 flex items-center justify-between ${
        theme === 'light' ? 'bg-[#FFFFFF] text-[#000000]' : 'bg-transparent text-[#E8E9D8]'
      }`}>
        
        {/* Left: Mobile hamburger & Breadcrumb (Page 6 & 7 spec) */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className={`md:hidden p-1.5 focus:outline-none cursor-pointer ${
              theme === 'light' ? 'text-[#000000] hover:text-black' : 'text-[#A9BFA5] hover:text-white'
            }`}
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Breadcrumb Segment */}
          <nav className={`flex items-center space-x-2 text-xs font-mono tracking-widest ${
            theme === 'light' ? 'text-[#000000]' : 'text-[#E8E9D8]'
          }`} aria-label="Breadcrumb">
            <button
              type="button"
              onClick={() => onSelectNav(activeCategory)}
              className={`px-3.5 py-1.5 rounded-[6px] uppercase tracking-wider transition-all cursor-pointer font-extrabold ${
                theme === 'light'
                  ? 'bg-[#FFFFFF] border-2 border-[#CBD5E1] text-[#000000] hover:bg-white hover:border-[#94A3B8] shadow-xs'
                  : 'bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] hover:border-[#A9BFA5]'
              }`}
            >
              {formatCategoryTitle(activeCategory)}
            </button>

            {currentRecordTitle && (
              <>
                <span className={theme === 'light' ? 'text-[#000000] font-extrabold' : 'text-[#A9BFA5]/60'}>›</span>
                <span className={`px-3.5 py-1.5 rounded-[6px] font-extrabold truncate max-w-[140px] sm:max-w-[240px] ${
                  theme === 'light'
                    ? 'bg-[#FFFFFF] border-2 border-[#CBD5E1] text-[#000000] shadow-xs'
                    : 'bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                }`}>
                  {currentRecordTitle}
                </span>
              </>
            )}
          </nav>
        </div>

        {/* Right Controls: Search ⌘K | + New ▼ | 🔔 3 | ◯ Acme ▼ */}
        <div className="flex items-center space-x-2 sm:space-x-3.5">
          
          {/* 1. [🔍 Search ⌘K] Command Palette trigger */}
          <button
            type="button"
            id="topbar-search-button"
            onClick={onOpenQuickSearch}
            className={`flex items-center space-x-2 text-xs px-3.5 py-1.5 rounded-[6px] transition-all focus:outline-none cursor-pointer font-mono font-extrabold ${
              theme === 'light'
                ? 'text-[#000000] bg-[#FFFFFF] hover:bg-white border-2 border-[#CBD5E1] hover:border-[#94A3B8] shadow-xs'
                : 'text-[#A9BFA5] hover:text-white bg-[#051513] border border-[rgba(169,191,165,0.25)] hover:border-[#A9BFA5]'
            }`}
            title="Search workspace (⌘K or Ctrl+K)"
          >
            <Search className={`w-3.5 h-3.5 stroke-[2.5] ${theme === 'light' ? 'text-[#000000]' : 'text-[#A9BFA5]'}`} />
            <span className={`hidden sm:inline text-xs font-extrabold ${theme === 'light' ? 'text-[#000000]' : 'text-[#A9BFA5]'}`}>Search</span>
            <kbd className={`text-[10px] px-1.5 py-0.2 border rounded-[3px] font-mono font-extrabold ${
              theme === 'light' ? 'border-[#94A3B8] bg-[#F1F5F9] text-[#000000]' : 'border-[rgba(169,191,165,0.2)] bg-[#041210] text-[#A9BFA5]/60'
            }`}>⌘K</kbd>
          </button>

          {/* 2. [+ New ▼] Universal Creator Menu (Page 8 spec) */}
          <div className="relative" ref={newMenuRef}>
            <button
              type="button"
              id="topbar-new-button"
              onClick={() => setNewMenuOpen(!newMenuOpen)}
              className={`flex items-center space-x-1.5 text-xs font-mono font-extrabold px-3.5 py-1.5 rounded-[6px] transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-[#FFFFFF] hover:bg-white border-2 border-[#CBD5E1] hover:border-[#94A3B8] text-[#000000] shadow-xs'
                  : 'bg-[#E8E9D8] text-[#071C1A] hover:bg-white shadow-sm'
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="font-extrabold">New</span>
              <ChevronDown className="w-3 h-3 stroke-[2.5]" />
            </button>

            {newMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-[#051513] border border-[rgba(169,191,165,0.3)] shadow-2xl rounded-[2px] py-1.5 z-50 font-mono text-xs animate-fadeIn">
                <button
                  type="button"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onTriggerNew('lead');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#0D2D2A] text-left text-[#E8E9D8] transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <User className="w-3.5 h-3.5 text-[#A9BFA5]" />
                    <span>Lead</span>
                  </div>
                  <kbd className="text-[10px] text-[#A9BFA5]/60 font-mono">L</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onTriggerNew('post');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#0D2D2A] text-left text-[#E8E9D8] transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Post</span>
                  </div>
                  <kbd className="text-[10px] text-[#A9BFA5]/60 font-mono">P</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onTriggerNew('content');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#0D2D2A] text-left text-[#E8E9D8] transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Content</span>
                  </div>
                  <kbd className="text-[10px] text-[#A9BFA5]/60 font-mono">C</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewMenuOpen(false);
                    onTriggerNew('campaign');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#0D2D2A] text-left text-[#E8E9D8] transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <Megaphone className="w-3.5 h-3.5 text-sky-400" />
                    <span>Campaign</span>
                  </div>
                  <kbd className="text-[10px] text-[#A9BFA5]/60 font-mono">M</kbd>
                </button>
              </div>
            )}
          </div>

          {/* 3. 🔔 Notifications Panel (Page 8 & 9 spec) */}
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              id="topbar-notifications-button"
              onClick={() => setNotifMenuOpen(!notifMenuOpen)}
              className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-[6px] focus:outline-none cursor-pointer transition-all font-extrabold ${
                theme === 'light'
                  ? 'text-[#000000] bg-[#FFFFFF] hover:bg-white border-2 border-[#CBD5E1] hover:border-[#94A3B8] shadow-xs'
                  : 'text-[#A9BFA5] hover:text-white bg-[#051513] border border-[rgba(169,191,165,0.25)] hover:border-[#A9BFA5]'
              }`}
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4 stroke-[2.2]" />
              {unreadCount > 0 && (
                <span className={`font-mono text-[11px] font-extrabold px-1.5 py-0.2 rounded-[3px] ${
                  theme === 'light'
                    ? 'bg-[#FEF3C7] border border-[#F59E0B] text-[#000000]'
                    : 'bg-emerald-400 text-[#071C1A]'
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>

            {notifMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#061816] border border-[rgba(169,191,165,0.25)] shadow-2xl z-50 rounded-[2px] animate-fadeIn font-mono text-xs">
                <div className="p-3.5 border-b border-[rgba(169,191,165,0.15)] flex items-center justify-between">
                  <span className="uppercase tracking-widest text-[#E8E9D8] font-semibold text-[11px]">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[11px] text-[#A9BFA5] hover:text-white transition-colors cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[rgba(169,191,165,0.1)]">
                  {/* Group: TODAY */}
                  <div className="px-3.5 py-1.5 bg-[#051513] text-[10px] uppercase tracking-wider text-[#A9BFA5]/60 font-semibold">
                    TODAY
                  </div>
                  {notifications.filter(n => n.group === 'TODAY').map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        setNotifMenuOpen(false);
                        onSelectNav(notif.category, notif.sub);
                      }}
                      className="p-3 hover:bg-[#0D2D2A]/40 transition-colors cursor-pointer space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          {notif.unread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          )}
                          <span className="font-semibold text-white text-xs">{notif.title}</span>
                        </div>
                        <span className="text-[10px] text-[#A9BFA5]/60">{notif.time}</span>
                      </div>
                      <p className="text-[11px] text-[#A9BFA5] font-light pl-3">
                        {notif.detail}
                      </p>
                    </div>
                  ))}

                  {/* Group: EARLIER */}
                  <div className="px-3.5 py-1.5 bg-[#051513] text-[10px] uppercase tracking-wider text-[#A9BFA5]/60 font-semibold">
                    EARLIER
                  </div>
                  {notifications.filter(n => n.group === 'EARLIER').map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        setNotifMenuOpen(false);
                        onSelectNav(notif.category, notif.sub);
                      }}
                      className="p-3 hover:bg-[#0D2D2A]/40 transition-colors cursor-pointer space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs">{notif.title}</span>
                        <span className="text-[10px] text-[#A9BFA5]/60">{notif.time}</span>
                      </div>
                      <p className="text-[11px] text-[#A9BFA5]/70 font-light">
                        {notif.detail}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 border-t border-[rgba(169,191,165,0.15)] bg-[#051513] text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifMenuOpen(false);
                      onSelectNav('settings', 'notifications');
                    }}
                    className="text-[11px] text-emerald-300 hover:underline cursor-pointer"
                  >
                    Notification settings →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Button (Light / Dark) */}
          <button
            type="button"
            id="topbar-theme-toggle"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className={`flex items-center space-x-1.5 p-2 rounded-[6px] text-xs transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-[#FFFFFF] hover:bg-white border-2 border-[#CBD5E1] hover:border-[#94A3B8] text-[#000000] shadow-xs'
                : 'bg-[#051513] hover:bg-[#081F1C] border border-[rgba(169,191,165,0.25)] hover:border-[#A9BFA5] text-[#A9BFA5] hover:text-white'
            }`}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle theme mode"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-[#000000] stroke-[2.5]" />
            ) : (
              <Sun className="w-4 h-4 text-[#E8E9D8] stroke-[2.5]" />
            )}
          </button>

          {/* 4. ◯ Acme ▼ Account Menu (Page 9 spec) */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              id="topbar-user-menu"
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className={`flex items-center space-x-2 text-xs p-1.5 pr-2.5 rounded-[6px] transition-all cursor-pointer font-extrabold ${
                theme === 'light'
                  ? 'text-[#000000] bg-[#FFFFFF] hover:bg-white border-2 border-[#CBD5E1] hover:border-[#94A3B8] shadow-xs'
                  : 'text-[#E8E9D8] bg-[#051513] hover:bg-[#081F1C] border border-[rgba(169,191,165,0.25)] hover:border-[#A9BFA5]'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-black uppercase ${
                theme === 'light'
                  ? 'bg-[#E2E8F0] border border-[#94A3B8] text-[#000000]'
                  : 'bg-[#0D2D2A] border border-[rgba(169,191,165,0.3)] text-[#A9BFA5]'
              }`}>
                {(currentUser?.workspace || currentUser?.name || 'A')[0]}
              </div>
              <span className={`hidden sm:inline font-mono text-xs font-extrabold ${
                theme === 'light' ? 'text-[#000000]' : 'text-[#E8E9D8]'
              }`}>
                {currentUser?.workspace || currentUser?.name || 'Acme'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {accountMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#061816] border border-[rgba(169,191,165,0.25)] shadow-2xl rounded-[2px] py-1.5 z-50 font-mono text-xs animate-fadeIn">
                {/* User details */}
                <div className="px-3.5 py-2 border-b border-[rgba(169,191,165,0.15)]">
                  <p className="text-[#E8E9D8] font-semibold text-xs">
                    {currentUser?.workspace || currentUser?.name || 'Acme Studio'}
                  </p>
                  <p className="text-[11px] text-[#A9BFA5]/70 truncate">
                    {currentUser?.email || 'you@acme.com'} · {currentUser?.role || 'Owner'}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      if (onOpenProfileDrawer) onOpenProfileDrawer();
                      else onSelectNav('settings', 'business');
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer"
                  >
                    Your profile
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      if (onOpenLogin) onOpenLogin();
                      else onLogout();
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-[#A9BFA5] hover:text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer flex items-center space-x-2"
                  >
                    <User className="w-3.5 h-3.5 text-[#A9BFA5]/70" />
                    <span>Switch account / Log in</span>
                  </button>

                  {/* Theme Switcher: Light · Dark · System */}
                  <div className="px-3.5 py-1.5 flex items-center justify-between text-[#A9BFA5]">
                    <span>Theme</span>
                    <div className="flex items-center space-x-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          theme === 'light'
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        Light
                      </button>
                      <span className="text-[var(--text-muted)]">·</span>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          theme === 'dark'
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        Dark
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setShowShortcutsModal(true);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-1.5 text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer"
                  >
                    <span>Keyboard shortcuts</span>
                    <kbd className="text-[10px] text-[#A9BFA5]/60 font-mono">?</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onSelectNav('settings', 'billing');
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer"
                  >
                    Billing
                  </button>
                </div>

                <div className="border-t border-[rgba(169,191,165,0.15)] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3.5 py-1.5 text-rose-300 hover:bg-[#0D2D2A] transition-colors cursor-pointer flex items-center space-x-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Keyboard Shortcuts Dialog */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#061816] border border-[rgba(169,191,165,0.3)] shadow-2xl p-6 rounded-[2px] font-mono text-xs space-y-4 text-[#E8E9D8]">
            <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.2)] pb-3">
              <span className="serif text-lg font-light text-white">Keyboard Shortcuts</span>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 text-[#A9BFA5] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#A9BFA5]">Open Command Palette</span>
                <kbd className="px-2 py-0.5 border border-[rgba(169,191,165,0.25)] rounded bg-[#071C1A]">⌘K / Ctrl+K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A9BFA5]">Create New Lead</span>
                <kbd className="px-2 py-0.5 border border-[rgba(169,191,165,0.25)] rounded bg-[#071C1A]">L</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A9BFA5]">Create New Post</span>
                <kbd className="px-2 py-0.5 border border-[rgba(169,191,165,0.25)] rounded bg-[#071C1A]">P</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A9BFA5]">Create Content</span>
                <kbd className="px-2 py-0.5 border border-[rgba(169,191,165,0.25)] rounded bg-[#071C1A]">C</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A9BFA5]">Create Campaign</span>
                <kbd className="px-2 py-0.5 border border-[rgba(169,191,165,0.25)] rounded bg-[#071C1A]">M</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A9BFA5]">Inbox Navigation</span>
                <kbd className="px-2 py-0.5 border border-[rgba(169,191,165,0.25)] rounded bg-[#071C1A]">J / K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A9BFA5]">Take over conversation</span>
                <kbd className="px-2 py-0.5 border border-[rgba(169,191,165,0.25)] rounded bg-[#071C1A]">T</kbd>
              </div>
            </div>

            <div className="pt-2 border-t border-[rgba(169,191,165,0.15)] text-right">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-3 py-1.5 bg-[#E8E9D8] text-[#071C1A] font-semibold rounded-[2px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
