import React, { useState, useCallback, useRef, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ContentStudio from './components/ContentStudio';
import MarketingCopilot, { type FloatingChatHandle } from './components/MarketingCopilot';
import LeadAgentChat from './components/LeadAgentChat';
import LeadsPipeline from './components/LeadsPipeline';
import Campaigns from './components/Campaigns';
import Login from './components/Login';
import BrandSetupWizard from './components/BrandSetupWizard';
import LinkedInHub from './linkedin/LinkedInHub';
import AdminConsole from './components/AdminConsole';
import AgentsHub from './components/AgentsHub';
import type { View, LinkedInDraft } from './types';
import { getCurrentUser, logout, type AppUser } from './services/authService';
import { getCompanySetup } from './services/companyService';
import { APP_NAME } from './constants/branding';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('insights');
  const [user, setUser] = useState<AppUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [linkedinDrafts, setLinkedinDrafts] = useState<LinkedInDraft[] | undefined>();
  const [linkedinBrief, setLinkedinBrief] = useState<string | undefined>();
  const [hubKey, setHubKey] = useState(0);
  const chatRef = useRef<FloatingChatHandle>(null);

  useEffect(() => {
    void getCurrentUser()
      .then((u) => setUser(u))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!user) {
      setSetupChecked(false);
      setSetupComplete(false);
      return;
    }
    let cancelled = false;
    setSetupChecked(false);
    void getCompanySetup()
      .then((s) => {
        if (!cancelled) setSetupComplete(Boolean(s.setupComplete));
      })
      .catch(() => {
        if (!cancelled) setSetupComplete(false);
      })
      .finally(() => {
        if (!cancelled) setSetupChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleLoginSuccess = (next: AppUser) => {
    setUser(next);
    setCurrentView('insights');
  };

  const handleLogout = () => {
    void logout().finally(() => {
      setUser(null);
      setSetupComplete(false);
      setSetupChecked(false);
    });
  };

  const handleSetupComplete = () => {
    setSetupComplete(true);
    setCurrentView('insights');
  };

  const openLinkedInHub = useCallback((drafts?: LinkedInDraft[], brief?: string) => {
    setLinkedinDrafts(drafts);
    setLinkedinBrief(brief);
    setHubKey(k => k + 1);
    setCurrentView('linkedin');
  }, []);

  const handleDraftsConsumed = useCallback(() => {
    setLinkedinDrafts(undefined);
    setLinkedinBrief(undefined);
  }, []);

  const handleNavigate = useCallback((view: View) => {
    if (view === 'chat') {
      chatRef.current?.open();
      return;
    }
    setCurrentView(view);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'insights':
        return <Dashboard setCurrentView={handleNavigate} />;
      case 'campaigns':
        return <Campaigns openLinkedInHub={openLinkedInHub} />;
      case 'lab':
        return <ContentStudio openLinkedInHub={openLinkedInHub} />;
      case 'linkedin':
        return (
          <LinkedInHub
            key={hubKey}
            incomingDrafts={linkedinDrafts}
            incomingBrief={linkedinBrief}
            onDraftsConsumed={handleDraftsConsumed}
          />
        );
      case 'automation':
        return <LeadsPipeline />;
      case 'agents':
        return <AgentsHub />;
      case 'admin':
        return <AdminConsole isAdmin={user?.role === 'admin'} />;
      case 'chat':
        return <Dashboard setCurrentView={handleNavigate} />;
      default:
        return <Dashboard setCurrentView={handleNavigate} />;
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-muted text-sm font-medium">
        Loading {APP_NAME}…
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-muted text-sm font-medium">
        Checking brand setup…
      </div>
    );
  }

  if (!setupComplete) {
    return (
      <BrandSetupWizard onComplete={handleSetupComplete} onLogout={handleLogout} />
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar currentView={currentView} setCurrentView={handleNavigate} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onLogout={handleLogout}
          currentView={currentView}
          setCurrentView={handleNavigate}
        />
        <div className="sm:hidden px-3 pb-1">
          <div className="flex gap-1 overflow-x-auto p-1 bg-white/70 backdrop-blur-xl border border-white/80 shadow-soft rounded-full">
            {([
              ['insights', 'Radar'],
              ['campaigns', 'Campaigns'],
              ['lab', 'Lab'],
              ['linkedin', 'Social'],
              ['agents', 'Agents'],
              ['automation', 'Inbox'],
              ['admin', 'Admin'],
            ] as [View, string][]).map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => handleNavigate(view)}
                className={`flex-shrink-0 px-3 py-2 text-[11px] font-semibold rounded-full transition-all ${
                  currentView === view ? 'bg-gradient-to-r from-soft-deep to-soft-azure text-white shadow-aqua' : 'text-ink-muted hover:bg-white hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <main className="flex-grow px-3 sm:px-6 lg:px-8 pb-6 pt-2 overflow-y-auto">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {renderView()}
          </div>
        </main>
      </div>
      <MarketingCopilot ref={chatRef} />
      <LeadAgentChat />
    </div>
  );
};

export default App;
