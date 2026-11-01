import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { 
  NavCategory, 
  SubCategory, 
  Lead, 
  Campaign, 
  TrendingTopic, 
  StatMetric, 
  GeneratedAsset, 
  SocialAccount, 
  ScheduledPost,
  SystemNotification 
} from '../types';

import { 
  INITIAL_METRICS, 
  INITIAL_LEADS, 
  INITIAL_TRENDING_TOPICS, 
  INITIAL_CAMPAIGNS, 
  INITIAL_GENERATED_ASSETS, 
  INITIAL_SOCIAL_ACCOUNTS, 
  INITIAL_SCHEDULED_POSTS,
  INITIAL_NOTIFICATIONS 
} from '../data/mockData';

import AppSidebar from './app/AppSidebar';
import AppTopBar from './app/AppTopBar';
import OverviewView from './app/OverviewView';
import EngageView from './app/EngageView';
import LeadsView from './app/LeadsView';
import CreativeLabView from './app/CreativeLabView';
import SocialHubView from './app/SocialHubView';
import CampaignsView from './app/CampaignsView';
import AnalyticsView from './app/AnalyticsView';
import SettingsView from './app/SettingsView';
import AssistantView from './app/AssistantView';
import ActionModals from './app/ActionModals';
import CommandPalette from './app/CommandPalette';
import SettingsModal from './app/SettingsModal';
import LeadIntelligenceWorkspace from './app/leads/LeadIntelligenceWorkspace';
import { UserSession } from './AuthModal';

interface NexoraAppProps {
  initialMode?: 'login' | 'signup' | 'forgot';
  onReturnToLanding: () => void;
  currentUser?: UserSession | null;
  onOpenLogin?: () => void;
  initialFirstRun?: boolean;
}

export default function NexoraApp({
  onReturnToLanding,
  currentUser,
  onOpenLogin,
  initialFirstRun = false
}: NexoraAppProps) {
  // Navigation State (Overview is the top-level default)
  const [activeCategory, setActiveCategory] = useState<NavCategory>('overview');
  const [activeSubCategory, setActiveSubCategory] = useState<SubCategory>('default');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(initialFirstRun);

  // Application Data States
  const [metrics, setMetrics] = useState<StatMetric[]>(INITIAL_METRICS);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>(INITIAL_TRENDING_TOPICS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [assets, setAssets] = useState<GeneratedAsset[]>(INITIAL_GENERATED_ASSETS);
  const [accounts, setAccounts] = useState<SocialAccount[]>(INITIAL_SOCIAL_ACCOUNTS);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(INITIAL_SCHEDULED_POSTS);
  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);

  // Interactive Modals State
  const [activeModal, setActiveModal] = useState<'campaign' | 'content' | 'lead' | 'schedule' | 'lead-details' | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDemoWorkspace, setIsDemoWorkspace] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (title: string, desc: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ title, desc });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 4000);
  };

  // Keyboard shortcut for command palette (⌘K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync browser URL with view state (Rule 1: Every page has a URL)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\//, '');
      const parts = path.split('/');
      const cat = (parts[0] || 'overview') as NavCategory;
      const sub = (parts[1] || (cat === 'overview' ? 'overview' : 'default')) as SubCategory;
      setActiveCategory(cat);
      setActiveSubCategory(sub);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectNav = (category: NavCategory, subCategory?: SubCategory) => {
    if (activeModal === 'lead-details') setActiveModal(null);

    // Normalization for routes
    let targetCategory: NavCategory = category;
    let targetSub: SubCategory | undefined = subCategory;

    if (category === 'engage') {
      targetCategory = 'inbox';
    } else if (category === 'insights') {
      targetCategory = 'overview';
      targetSub = 'dashboard';
    } else if (category === 'creative-lab') {
      targetCategory = 'content';
      targetSub = subCategory === 'generated-assets' ? 'library' : 'create';
    } else if (category === 'social-hub') {
      targetCategory = 'content';
      targetSub = 'schedule';
    }

    // Default subcategory per main tab
    const resolvedSub: SubCategory = targetSub || (
      targetCategory === 'overview'
        ? 'overview'
        : targetCategory === 'inbox'
        ? 'inbox'
        : targetCategory === 'leads'
        ? 'all-leads'
        : targetCategory === 'content'
        ? 'create'
        : targetCategory === 'campaigns'
        ? 'campaign-list'
        : targetCategory === 'analytics'
        ? 'overview'
        : targetCategory === 'settings'
        ? 'business'
        : 'default'
    );

    // If navigating to lead drawer / page, ensure a lead is selected
    if (resolvedSub === 'lead-page' || resolvedSub === 'lead-details') {
      if (!selectedLead && leads.length > 0) {
        setSelectedLead(leads[0]);
      }
    } else if (targetCategory !== 'leads') {
      setSelectedLead(null);
    }

    setActiveCategory(targetCategory);
    setActiveSubCategory(resolvedSub);

    // Sync browser URL history (Rule 1) with safe sandboxed iframe fallback
    try {
      const newPath = `/${targetCategory}${resolvedSub && resolvedSub !== 'default' && resolvedSub !== targetCategory && resolvedSub !== 'overview' ? `/${resolvedSub}` : ''}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    } catch {
      // Sandboxed iframes may block history.pushState; state update still succeeds
    }

    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Ignore scroll errors in headless/iframe test runners
    }
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
  };

  const handleTriggerQuickAction = (action: 'campaign' | 'content' | 'lead' | 'schedule') => {
    setActiveModal(action);
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setActiveModal('lead-details');
  };

  const handleAddLead = (newLead: Lead) => {
    setLeads([newLead, ...leads]);
    setMetrics(metrics.map(m => m.id === 'leads' ? { ...m, value: (parseInt(m.value) + 1).toString() } : m));
    showToast('Lead Created', `Added ${newLead.name} (${newLead.company}) to pipeline.`);
  };

  const handleAddCampaign = (newCamp: Campaign) => {
    setCampaigns([newCamp, ...campaigns]);
    setMetrics(metrics.map(m => m.id === 'campaigns' ? { ...m, value: (parseInt(m.value) + 1).toString() } : m));
    showToast('Campaign Launched', `"${newCamp.name}" has been created.`);
  };

  const handleAddAsset = (newAsset: GeneratedAsset) => {
    setAssets([newAsset, ...assets]);
    showToast('Asset Saved', `"${newAsset.title}" added to your content library.`);
  };

  const handleAddScheduledPost = (newPost: ScheduledPost) => {
    setScheduledPosts(prev => [newPost, ...prev]);
    showToast('Broadcast Scheduled', `Queued for release across ${newPost.platforms.join(', ')} at ${newPost.scheduledTime}.`);
  };

  const handleDeleteScheduledPost = (id: string) => {
    setScheduledPosts(prev => prev.filter(p => p.id !== id));
    showToast('Broadcast Removed', 'The scheduled broadcast has been canceled and removed from the queue.');
  };

  const handleUpdateScheduledPost = (updated: ScheduledPost) => {
    setScheduledPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const isInbox = activeCategory === 'inbox' || activeCategory === 'engage';

  return (
    <div className={`${
      isLight ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#071C1A] text-[#E8E9D8]'
    } font-sans-body selection:bg-teal-500/25 selection:text-teal-900 relative ${
      isInbox ? 'h-screen overflow-hidden flex flex-col' : 'min-h-screen'
    }`}>
      {/* Background atmosphere subtle ambient lighting in dark mode */}
      {!isLight && (
        <>
          <div 
            className="fixed top-0 right-0 w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #A9BFA5 0%, transparent 70%)' }}
          />
          <div 
            className="fixed bottom-0 left-60 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #0D2D2A 0%, transparent 70%)' }}
          />
        </>
      )}

      {/* Fixed Left Sidebar Navigation (10-item spec) */}
      <AppSidebar
        activeCategory={activeCategory}
        activeSubCategory={activeSubCategory}
        onSelectNav={handleSelectNav}
        onLogout={onReturnToLanding}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        isDemoWorkspace={isDemoWorkspace}
        onToggleDemoWorkspace={(val) => {
          setIsDemoWorkspace(val);
          showToast(val ? 'Demo Workspace Active' : 'Live Workspace', val ? 'Showing simulated sample data.' : 'Switched to live production workspace.');
        }}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Workspace Frame */}
      {(() => {
        return (
          <div className={`md:pl-60 flex flex-col ${isInbox ? 'h-full flex-1 min-h-0 overflow-hidden' : 'min-h-screen'}`}>
            {/* Top Navigation Bar with Dynamic Breadcrumb */}
            <AppTopBar
              activeCategory={activeCategory}
              activeSubCategory={activeSubCategory}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              onLogout={onReturnToLanding}
              onOpenQuickSearch={() => setIsSearchOpen(true)}
              onSelectNav={handleSelectNav}
              onOpenProfileDrawer={() => setIsProfileOpen(true)}
              onOpenLogin={onOpenLogin}
              currentUser={currentUser}
              currentRecordTitle={selectedLead ? selectedLead.company || selectedLead.name : undefined}
              onTriggerNew={(type) => {
                if (type === 'lead') setActiveModal('lead');
                else if (type === 'post') setActiveModal('schedule');
                else if (type === 'content') handleSelectNav('content', 'create');
                else if (type === 'campaign') handleSelectNav('campaigns', 'create-campaign');
              }}
            />

            {/* Dynamic Main Workspace Content (Constant navigation & page views) */}
            <main className={`flex-1 w-full flex flex-col relative ${isInbox ? 'min-h-0 overflow-hidden' : 'min-h-[calc(100vh-65px)]'}`}>
              
              {/* Mode Switch Banner for First-Run vs Demo Data */}
              <div className={`${
                isLight 
                  ? 'bg-white border-b border-slate-200 text-slate-600' 
                  : 'bg-[#051513] border-b border-[rgba(169,191,165,0.18)] text-[#A9BFA5]'
              } px-6 py-2 flex items-center justify-between text-xs font-mono shrink-0`}>
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${isFirstRun ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  <span className={`${isLight ? 'text-slate-800' : 'text-[#E8E9D8]'} font-medium`}>
                    {isFirstRun ? 'First-Run Mode (Image 6 Empty States)' : 'Demo Mode (Preloaded Leads & WhatsApp)'}
                  </span>
                </div>
                <button
                  type="button"
                  id="toggle-first-run-mode-btn"
                  onClick={() => {
                    const nextState = !isFirstRun;
                    setIsFirstRun(nextState);
                    showToast(
                      nextState ? 'First-Run Mode' : 'Demo Mode Active',
                      nextState ? 'Displaying empty state screens from Image 6.' : 'Loaded active leads, metrics, and conversations.'
                    );
                  }}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs'
                      : 'bg-[#0D2D2A] hover:bg-[#133F3B] border border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
                  }`}
                >
                  {isFirstRun ? '⚡ Switch to Demo Sample Data' : '✦ View First-Run Empty States'}
                </button>
              </div>

              <div className={
                isInbox
                  ? "w-full px-3 sm:px-4 py-2 sm:py-3 flex-1 min-h-0 flex flex-col overflow-hidden"
                  : "max-w-7xl w-full mx-auto px-6 sm:px-10 lg:px-12 py-8 lg:py-10"
              }>
            {/* 1. OVERVIEW */}
            {activeCategory === 'overview' && (
              <OverviewView
                metrics={metrics}
                leads={leads}
                campaigns={campaigns}
                trendingTopics={trendingTopics}
                onNavigate={handleSelectNav}
                onSelectLead={handleSelectLead}
                onTriggerQuickAction={handleTriggerQuickAction}
                isFirstRun={isFirstRun}
              />
            )}

            {/* 2. INBOX (Views, Conversation) */}
            {(activeCategory === 'inbox' || activeCategory === 'engage') && (
              <EngageView
                activeSubCategory={activeSubCategory}
                leads={leads}
                onNavigateSub={(sub) => handleSelectNav('inbox', sub)}
                onSelectLead={handleSelectLead}
                onNotify={showToast}
                isFirstRun={isFirstRun}
                onNavigateSettings={() => handleSelectNav('settings', 'channels')}
              />
            )}

            {/* 3. LEADS (All Leads table, Pipeline board, Follow-ups) */}
            {activeCategory === 'leads' && (
              <LeadsView
                activeSubCategory={activeSubCategory}
                leads={leads}
                selectedLead={selectedLead}
                onNavigateSub={(sub) => handleSelectNav('leads', sub)}
                onSelectLead={handleSelectLead}
                onAddLeadModal={() => setActiveModal('lead')}
                onUpdateLead={handleUpdateLead}
                onNotify={showToast}
                isFirstRun={isFirstRun}
              />
            )}

            {/* 4. CONTENT (Create, Schedule, Library) */}
            {activeCategory === 'content' && (
              <>
                {(activeSubCategory === 'create' || activeSubCategory === 'ai-content') && (
                  <CreativeLabView
                    activeSubCategory="create"
                    assets={assets}
                    onNavigateSub={(sub) => handleSelectNav('content', sub)}
                    onGenerateSuccess={handleAddAsset}
                  />
                )}

                {(activeSubCategory === 'schedule' || activeSubCategory === 'social-posts') && (
                  <SocialHubView
                    activeSubCategory="ai-guided-creation"
                    accounts={accounts}
                    scheduledPosts={scheduledPosts}
                    onNavigateSub={(sub) => handleSelectNav('content', sub)}
                    onSchedulePostSuccess={() => showToast('Broadcast Queued', 'Queued for release.')}
                    onAddScheduledPost={handleAddScheduledPost}
                    onDeleteScheduledPost={handleDeleteScheduledPost}
                    onUpdateScheduledPost={handleUpdateScheduledPost}
                    isFirstRun={isFirstRun}
                  />
                )}

                {(activeSubCategory === 'library' || activeSubCategory === 'content-library' || activeSubCategory === 'generated-assets') && (
                  <CreativeLabView
                    activeSubCategory="generated-assets"
                    assets={assets}
                    onNavigateSub={(sub) => handleSelectNav('content', sub)}
                    onGenerateSuccess={handleAddAsset}
                  />
                )}
              </>
            )}

            {/* 5. CAMPAIGNS (Campaigns, Create Campaign, Campaign Performance) */}
            {activeCategory === 'campaigns' && (
              <CampaignsView
                campaigns={campaigns}
                activeSubCategory={activeSubCategory}
                onAddCampaign={handleAddCampaign}
                onUpdateCampaign={(updated) => {
                  setCampaigns(campaigns.map(c => c.id === updated.id ? updated : c));
                }}
                onNavigateToModule={(cat, sub) => handleSelectNav(cat as NavCategory, (sub as SubCategory) || 'overview')}
                isFirstRun={isFirstRun}
              />
            )}

            {/* 6. ANALYTICS (Overview, Lead Analytics, Channel Performance) */}
            {activeCategory === 'analytics' && (
              <AnalyticsView
                activeSubCategory={activeSubCategory}
                onNavigateSub={(sub) => handleSelectNav('analytics', sub)}
                metrics={metrics}
              />
            )}

            {/* 7. SETTINGS (Business Profile, Channels, AI & Automation, Team & Access) */}
            {activeCategory === 'settings' && (
              <SettingsView
                activeSubCategory={activeSubCategory}
                onNavigateSub={(sub) => handleSelectNav('settings', sub)}
                onNotify={showToast}
              />
            )}

            {/* Legacy Assistant View if selected */}
            {activeCategory === 'assistant' && (
              <AssistantView
                metrics={metrics}
                leads={leads}
                campaigns={campaigns}
                onTriggerQuickAction={handleTriggerQuickAction}
              />
            )}
          </div>

          {/* Lead Intelligence Workspace Drawer (Slide-over keeps main view & navigation constant!) */}
          {selectedLead && (
            <LeadIntelligenceWorkspace
              lead={selectedLead}
              onClose={() => {
                setSelectedLead(null);
                if (activeModal === 'lead-details') setActiveModal(null);
              }}
              onUpdateLead={(updated) => {
                handleUpdateLead(updated);
                setSelectedLead(updated);
              }}
              onNavigate={(category, sub) => {
                setSelectedLead(null);
                handleSelectNav(category, sub);
              }}
              onNotify={showToast}
            />
          )}
        </main>
      </div>
        );
      })()}

      {/* Interactive Action Modals */}
      <ActionModals
        activeModal={activeModal === 'lead-details' ? null : activeModal}
        selectedLead={selectedLead}
        onClose={() => { setActiveModal(null); setSelectedLead(null); }}
        onAddLead={handleAddLead}
        onAddCampaign={handleAddCampaign}
        onNotify={showToast}
        onAddScheduledPost={handleAddScheduledPost}
      />

      {/* Command Palette (Quick Search ⌘K) */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectNav={handleSelectNav}
        onTriggerQuickAction={handleTriggerQuickAction}
      />

      {/* Workspace Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onNotify={showToast}
      />

      {/* Help Panel Drawer (Page 7 spec) */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fadeIn">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setIsHelpOpen(false)} />
          <div className="relative w-full max-w-md bg-[#071C1A] border-l border-[rgba(169,191,165,0.25)] h-full p-6 shadow-2xl z-10 flex flex-col justify-between font-mono text-xs text-[#E8E9D8]">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.2)] pb-3">
                <span className="serif text-xl font-light text-white">Help & Documentation</span>
                <button type="button" onClick={() => setIsHelpOpen(false)} className="text-[#A9BFA5] hover:text-white">✕</button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)]">
                  <h4 className="font-semibold text-white mb-1">Tecavy OS Architecture</h4>
                  <p className="text-[11px] text-[#A9BFA5] font-light">Learn how autonomous WhatsApp qualifiers and human escalation work in one loop.</p>
                </div>
                <div className="p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)]">
                  <h4 className="font-semibold text-white mb-1">Keyboard Shortcuts</h4>
                  <p className="text-[11px] text-[#A9BFA5] font-light">Press ⌘K for search, L for new lead, P for post, C for content, M for campaign.</p>
                </div>
                <div className="p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)]">
                  <h4 className="font-semibold text-white mb-1">Support & Hotline</h4>
                  <p className="text-[11px] text-[#A9BFA5] font-light">Direct email: support@tecavy.io · WhatsApp: +91 98201 44820</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2 bg-[#E8E9D8] text-[#071C1A] font-semibold rounded-[2px]"
            >
              Close Help
            </button>
          </div>
        </div>
      )}

      {/* Profile Drawer (Page 8 spec) */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fadeIn">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setIsProfileOpen(false)} />
          <div className="relative w-full max-w-md bg-[#071C1A] border-l border-[rgba(169,191,165,0.25)] h-full p-6 shadow-2xl z-10 flex flex-col justify-between font-mono text-xs text-[#E8E9D8]">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.2)] pb-3">
                <span className="serif text-xl font-light text-white">Your Profile</span>
                <button type="button" onClick={() => setIsProfileOpen(false)} className="text-[#A9BFA5] hover:text-white">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase text-[#A9BFA5] block mb-1">Name</label>
                  <input type="text" defaultValue="Aryan Mehta" className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-3 py-2 rounded text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#A9BFA5] block mb-1">Email</label>
                  <input type="email" defaultValue="you@acme.com" className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-3 py-2 rounded text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#A9BFA5] block mb-1">Role</label>
                  <span className="text-emerald-300 font-semibold">Workspace Owner</span>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#A9BFA5] block mb-1">Notification Preferences</label>
                  <p className="text-[#A9BFA5] text-[11px]">Instant alerts for leads needing human response.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  showToast('Profile Saved', 'Account details updated successfully.');
                }}
                className="w-full py-2 bg-[#E8E9D8] text-[#071C1A] font-semibold rounded-[2px]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating System Toast (positioned top-right to avoid covering bottom-right action buttons) */}
      {toastMessage && (
        <div className="fixed top-5 right-5 sm:right-6 z-50 bg-[#061816] border border-[rgba(169,191,165,0.3)] shadow-xl p-3.5 max-w-sm text-[#E8E9D8] animate-fadeIn rounded-lg flex items-start justify-between space-x-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-[#A9BFA5] font-semibold mb-0.5">
              {toastMessage.title}
            </p>
            <p className="text-xs text-[#E8E9D8]/90 leading-relaxed">
              {toastMessage.desc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
              setToastMessage(null);
            }}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 shrink-0"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
