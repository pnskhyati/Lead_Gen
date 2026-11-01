import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { NavCategory, SubCategory } from '../types';
import type { LinkedInDraft } from '../legacy/types';
import AppSidebar from './app/AppSidebar';
import AppTopBar from './app/AppTopBar';
import CommandPalette from './app/CommandPalette';
import ChannelsView from './app/ChannelsView';
import LiveOverview from './app/LiveOverview';
import LiveInbox from './app/LiveInbox';
import LiveContent from './app/LiveContent';
import LiveCampaigns from './app/LiveCampaigns';
import AgentsView from './app/AgentsView';
import AdminView from './app/AdminView';
import LiveAnalytics from './app/LiveAnalytics';
import LiveSettings from './app/LiveSettings';
import MarketIntelligenceView from './app/MarketIntelligenceView';
import TecavyPageHead from './app/TecavyPageHead';
import { resolveTecavyNavKey } from './app/AppSidebar';
import type { UserSession } from './AuthModal';
import type { Lead } from '../types';

import LinkedInHub from '../legacy/linkedin/LinkedInHub';
import MarketingCopilot, { type FloatingChatHandle } from '../legacy/components/MarketingCopilot';
import LeadAgentChat from '../legacy/components/LeadAgentChat';

interface LiveNexoraShellProps {
  onReturnToLanding: () => void;
  currentUser?: UserSession | null;
  onOpenLogin?: () => void;
  isAdmin?: boolean;
}

function defaultSub(category: NavCategory): SubCategory {
  switch (category) {
    case 'overview':
      return 'overview';
    case 'inbox':
    case 'engage':
      return 'inbox';
    case 'leads':
      return 'all-leads';
    case 'content':
      return 'create';
    case 'campaigns':
      return 'campaign-list';
    case 'analytics':
      return 'overview';
    case 'agents':
      return 'competitor';
    case 'channels':
      return 'connections';
    case 'admin':
      return 'brand';
    case 'settings':
      return 'business';
    case 'followups':
      return 'follow-ups';
    case 'agent':
      return 'lead-growth';
    case 'intelligence':
      return 'competitor';
    default:
      return 'default';
  }
}

function tecavyPageTitle(category: NavCategory, sub: SubCategory): string {
  const key = resolveTecavyNavKey(category, sub);
  const titles: Record<string, string> = {
    overview: 'Overview',
    inbox: 'Inbox',
    leads: 'Leads',
    followups: 'Follow-ups',
    agent: 'Engagement Agent',
    'content-studio': 'Content Studio',
    schedule: 'Schedule',
    library: 'Library',
    campaigns: 'Campaigns',
    analytics: 'Analytics',
    intelligence: 'Market Intelligence',
    connections: 'Connections',
    settings: 'Settings',
  };
  if (titles[key]) return titles[key];
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function LiveNexoraShell({
  onReturnToLanding,
  currentUser,
  onOpenLogin,
  isAdmin = false,
}: LiveNexoraShellProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const chatRef = useRef<FloatingChatHandle>(null);

  const [activeCategory, setActiveCategory] = useState<NavCategory>('overview');
  const [activeSubCategory, setActiveSubCategory] = useState<SubCategory>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [linkedinDrafts, setLinkedinDrafts] = useState<LinkedInDraft[] | undefined>();
  const [linkedinBrief, setLinkedinBrief] = useState<string | undefined>();
  const [hubKey, setHubKey] = useState(0);

  const showToast = (title: string, desc: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ title, desc });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 4000);
  };

  const handleSelectNav = useCallback((category: NavCategory, subCategory?: SubCategory) => {
    let targetCategory: NavCategory = category;
    let targetSub = subCategory;

    if (category === 'engage') targetCategory = 'inbox';
    else if (category === 'insights') {
      targetCategory = 'overview';
      targetSub = 'dashboard';
    } else if (category === 'creative-lab') {
      targetCategory = 'content';
      targetSub = subCategory === 'generated-assets' ? 'library' : 'create';
    } else if (category === 'social-hub') {
      targetCategory = 'content';
      targetSub = 'schedule';
    } else if (category === 'assistant') {
      chatRef.current?.open();
      return;
    } else if (category === 'channels') {
      targetCategory = 'settings';
      targetSub = targetSub || 'connections';
    } else if (category === 'admin') {
      targetCategory = 'settings';
      targetSub = targetSub || 'brand';
    }

    const resolvedSub = targetSub || defaultSub(targetCategory);
    setActiveCategory(targetCategory);
    setActiveSubCategory(resolvedSub);

    try {
      const newPath = `/${targetCategory}${
        resolvedSub && resolvedSub !== 'default' && resolvedSub !== targetCategory && resolvedSub !== 'overview'
          ? `/${resolvedSub}`
          : ''
      }`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\//, '');
      const parts = path.split('/');
      const cat = (parts[0] || 'overview') as NavCategory;
      const sub = (parts[1] || defaultSub(cat)) as SubCategory;
      setActiveCategory(cat === 'engage' ? 'inbox' : cat);
      setActiveSubCategory(sub);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openLinkedInHub = useCallback((drafts?: LinkedInDraft[], brief?: string) => {
    setLinkedinDrafts(drafts);
    setLinkedinBrief(brief);
    setHubKey((k) => k + 1);
    handleSelectNav('content', 'linkedin-studio');
  }, [handleSelectNav]);

  const handleDraftsConsumed = useCallback(() => {
    setLinkedinDrafts(undefined);
    setLinkedinBrief(undefined);
  }, []);

  const isInbox = activeCategory === 'inbox' || activeCategory === 'engage';
  const topBarTitle = tecavyPageTitle(activeCategory, activeSubCategory);

  const handleSelectOverviewLead = useCallback(
    (_lead: Lead) => {
      handleSelectNav('inbox', 'inbox');
      showToast('Opening Inbox', 'Jumping to live lead conversations.');
    },
    [handleSelectNav]
  );

  const renderLiveView = () => {
    if (activeCategory === 'overview') {
      return (
        <LiveOverview
          workspaceName={currentUser?.workspace || currentUser?.name || 'Nexora'}
          onNavigate={handleSelectNav}
          onSelectLead={handleSelectOverviewLead}
          onTriggerQuickAction={(action) => {
            if (action === 'content') handleSelectNav('content', 'create');
            else if (action === 'campaign') handleSelectNav('campaigns', 'create-campaign');
            else if (action === 'schedule') handleSelectNav('content', 'schedule');
            else handleSelectNav('leads', 'all-leads');
          }}
        />
      );
    }

    if (activeCategory === 'analytics') {
      return (
        <div className="flex flex-col gap-4">
          <TecavyPageHead
            label="Insights / Analytics"
            title="Analytics"
            description="Live lead counts, channel mix, and audit export from your connected backend."
          />
          <LiveAnalytics
            activeSubCategory={activeSubCategory}
            onNavigateSub={(sub) => handleSelectNav('analytics', sub)}
            onOpenLead={() => {
              handleSelectNav('inbox', 'inbox');
              showToast('Opening Inbox', 'Jumping to live lead conversations.');
            }}
          />
        </div>
      );
    }

    if (activeCategory === 'followups') {
      return (
        <div className="flex flex-col gap-4 min-h-0">
          <TecavyPageHead
            label="Workspace / Leads / Follow-ups"
            title="Follow-ups"
            description="Recover conversations using your live lead pipeline and follow-up queue."
            tools={
              <button
                type="button"
                className="tecavy-btn sm primary"
                onClick={() => handleSelectNav('inbox', 'overdue-followups')}
              >
                Overdue in inbox →
              </button>
            }
          />
          <LiveInbox
            mode="leads"
            activeSubCategory="follow-ups"
            onNavigateSub={(sub) => handleSelectNav('followups', sub)}
            onNavigateChannels={() => handleSelectNav('settings', 'connections')}
            onNotify={showToast}
            onSelectLead={handleSelectOverviewLead}
          />
        </div>
      );
    }

    if (activeCategory === 'agent') {
      return (
        <div className="flex flex-col gap-4">
          <TecavyPageHead
            label="Intelligence / Engagement Agent"
            title="Engagement Agent"
            description="Live lead-growth chat and qualification — powered by /api/lead-agent."
          />
          <AgentsView initialTab="leadGrowth" />
        </div>
      );
    }

    if (activeCategory === 'intelligence') {
      return <MarketIntelligenceView onNavigate={handleSelectNav} />;
    }

    if (activeCategory === 'inbox' || activeCategory === 'engage') {
      return (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          <TecavyPageHead
            label="Workspace / Inbox"
            title="Inbox"
            description="One conversation, one lead record — live CRM and channel replies."
            tools={
              <button
                type="button"
                className="tecavy-btn sm"
                onClick={() => handleSelectNav('settings', 'connections')}
              >
                Manage connections
              </button>
            }
          />
          <LiveInbox
            mode="inbox"
            activeSubCategory={activeSubCategory}
            onNavigateSub={(sub) => handleSelectNav('inbox', sub)}
            onNavigateChannels={() => handleSelectNav('settings', 'connections')}
            onNotify={showToast}
            onSelectLead={handleSelectOverviewLead}
          />
        </div>
      );
    }

    if (activeCategory === 'leads') {
      return (
        <div className="flex flex-col gap-4">
          <TecavyPageHead
            label="Workspace / Leads"
            title="Leads & qualification"
            description="Manage every enquiry through one pipeline backed by live lead APIs."
            tools={
              <button type="button" className="tecavy-btn sm primary" onClick={() => handleSelectNav('leads', 'all-leads')}>
                + Add lead
              </button>
            }
          />
          <LiveInbox
            mode="leads"
            activeSubCategory={activeSubCategory}
            onNavigateSub={(sub) => handleSelectNav('leads', sub)}
            onNavigateChannels={() => handleSelectNav('settings', 'connections')}
            onNotify={showToast}
            onSelectLead={handleSelectOverviewLead}
          />
        </div>
      );
    }

    if (activeCategory === 'content') {
      if (activeSubCategory === 'linkedin-studio') {
        return (
          <div className="legacy-feature-surface rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[rgba(248,250,252,0.97)] text-slate-900 p-4 sm:p-6">
            <LinkedInHub
              key={hubKey}
              incomingDrafts={linkedinDrafts}
              incomingBrief={linkedinBrief}
              onDraftsConsumed={handleDraftsConsumed}
            />
          </div>
        );
      }
      const contentHead =
        activeSubCategory === 'schedule'
          ? {
              label: 'Marketing / Content / Schedule',
              title: 'Content calendar',
              description: 'Plan and review scheduled posts — live content workspace.',
            }
          : activeSubCategory === 'library'
            ? {
                label: 'Marketing / Content / Library',
                title: 'Content library',
                description: 'Saved drafts and generated assets from your content studio.',
              }
            : {
                label: 'Marketing / Content',
                title: 'Content Studio',
                description: 'Create on-brand drafts with live AI generation — review before publishing.',
              };
      return (
        <div className="flex flex-col gap-4">
          <TecavyPageHead
            label={contentHead.label}
            title={contentHead.title}
            description={contentHead.description}
          />
          <LiveContent
            activeSubCategory={activeSubCategory}
            onNavigateSub={(sub) => handleSelectNav('content', sub)}
            onNotify={showToast}
            onOpenLinkedInStudio={() => handleSelectNav('content', 'linkedin-studio')}
            onOpenConnections={() => handleSelectNav('channels', 'connections')}
          />
        </div>
      );
    }

    if (activeCategory === 'campaigns') {
      return (
        <div className="flex flex-col gap-4">
          <TecavyPageHead
            label="Marketing / Campaigns"
            title="Campaigns"
            description="Plan campaigns with live AI strategy — stored locally until backend campaign APIs expand."
          />
          <LiveCampaigns
            activeSubCategory={activeSubCategory}
            onNavigate={handleSelectNav}
            onNotify={showToast}
          />
        </div>
      );
    }

    if (activeCategory === 'agents') {
      return (
        <AgentsView initialTab={activeSubCategory === 'lead-growth' ? 'leadGrowth' : 'competitor'} />
      );
    }

    if (activeCategory === 'channels') {
      return <ChannelsView onNavigate={handleSelectNav} />;
    }

    if (activeCategory === 'admin') {
      return <AdminView isAdmin={isAdmin} />;
    }

    if (activeCategory === 'settings') {
      return (
        <LiveSettings
          activeSubCategory={activeSubCategory}
          isAdmin={isAdmin}
          onNavigateSub={(sub) => handleSelectNav('settings', sub)}
          onNavigate={handleSelectNav}
        />
      );
    }

    return (
      <LiveOverview
        workspaceName={currentUser?.workspace || currentUser?.name || 'Nexora'}
        onNavigate={handleSelectNav}
        onSelectLead={handleSelectOverviewLead}
      />
    );
  };

  return (
    <div
      className={`tecavy-shell ${isLight ? 'theme-light' : 'theme-dark'} ${
        isInbox ? 'h-screen overflow-hidden flex' : 'min-h-screen flex'
      }`}
    >
      <AppSidebar
        activeCategory={activeCategory}
        activeSubCategory={activeSubCategory}
        onSelectNav={handleSelectNav}
        onLogout={onReturnToLanding}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        isDemoWorkspace={false}
        onOpenHelp={() => setIsHelpOpen(true)}
        workspaceName={currentUser?.workspace || currentUser?.name || 'Nexora'}
        onToggleTheme={toggleTheme}
        tecavyShell
      />

      <div className={`tecavy-main ${isInbox ? 'h-full min-h-0 overflow-hidden' : ''}`}>
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
          tecavyShell
          currentRecordTitle={topBarTitle}
          onTriggerNew={(type) => {
            if (type === 'content') handleSelectNav('content', 'create');
            else if (type === 'campaign') handleSelectNav('campaigns', 'create-campaign');
            else if (type === 'post') handleSelectNav('content', 'schedule');
            else if (type === 'lead') handleSelectNav('leads', 'all-leads');
          }}
        />

        <main
          className={`flex-1 w-full flex flex-col relative min-h-0 ${
            isInbox ? 'overflow-hidden' : ''
          }`}
        >
          <div className="tecavy-statusbar">
            <span>
              <span className="live-dot" aria-hidden />
              Live workspace · backend APIs connected
            </span>
            <span>
              {currentUser?.email || 'Signed in'} · {currentUser?.workspace || 'Nexora'}
            </span>
          </div>

          <div
            className={
              isInbox
                ? 'w-full px-3 sm:px-4 py-2 sm:py-3 flex-1 min-h-0 flex flex-col overflow-auto tecavy-content !max-w-none !py-4'
                : 'tecavy-content'
            }
          >
            {renderLiveView()}
            {!isInbox && (
              <p className="tecavy-footerhint">
                TECAVY NEXORA · Premium workspace · Live APIs when backend is running
              </p>
            )}
          </div>
        </main>
      </div>

      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectNav={handleSelectNav}
        onTriggerQuickAction={(action) => {
          if (action === 'content') handleSelectNav('content', 'create');
          else if (action === 'campaign') handleSelectNav('campaigns', 'create-campaign');
          else if (action === 'schedule') handleSelectNav('content', 'schedule');
          else handleSelectNav('leads', 'all-leads');
        }}
      />

      {isHelpOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div className="fixed inset-0 bg-black/60" onClick={() => setIsHelpOpen(false)} />
          <div className="relative w-full max-w-md bg-[#071C1A] border-l border-[rgba(169,191,165,0.25)] h-full p-6 z-10 text-[#E8E9D8]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Help</h3>
              <button type="button" onClick={() => setIsHelpOpen(false)} className="text-[#A9BFA5]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[#A9BFA5] leading-relaxed">
              Engagement Agent for lead growth, Market Intelligence for competitor analysis, Settings for channels and
              brand knowledge, Inbox for live CRM. Press ⌘K for quick navigation.
            </p>
          </div>
        </div>
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div className="fixed inset-0 bg-black/60" onClick={() => setIsProfileOpen(false)} />
          <div className="relative w-full max-w-md bg-[#071C1A] border-l border-[rgba(169,191,165,0.25)] h-full p-6 z-10 text-[#E8E9D8]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Profile</h3>
              <button type="button" onClick={() => setIsProfileOpen(false)} className="text-[#A9BFA5]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-[#A9BFA5]">Name</span>
                <br />
                {currentUser?.name || '—'}
              </p>
              <p>
                <span className="text-[#A9BFA5]">Email</span>
                <br />
                {currentUser?.email || '—'}
              </p>
              <p>
                <span className="text-[#A9BFA5]">Role</span>
                <br />
                {currentUser?.role || '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#061816] border border-[rgba(169,191,165,0.3)] shadow-xl p-3.5 max-w-sm text-[#E8E9D8] rounded-lg">
          <p className="text-xs uppercase tracking-wider text-[#A9BFA5] font-semibold mb-0.5">{toastMessage.title}</p>
          <p className="text-xs">{toastMessage.desc}</p>
        </div>
      )}

      <MarketingCopilot ref={chatRef} />
      <LeadAgentChat />
    </div>
  );
}
