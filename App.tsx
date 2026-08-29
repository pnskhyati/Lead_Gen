import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ContentStudio from './components/ContentStudio';
import MarketingCopilot from './components/MarketingCopilot';
import SocialCommerce from './components/SocialCommerce';
import Campaigns from './components/Campaigns';
import Login from './components/Login';
import LinkedInHub from './linkedin/LinkedInHub';
import type { View, LinkedInDraft } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('insights');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [linkedinDrafts, setLinkedinDrafts] = useState<LinkedInDraft[] | undefined>();
  const [linkedinBrief, setLinkedinBrief] = useState<string | undefined>();
  const [hubKey, setHubKey] = useState(0);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentView('insights');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
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

  const renderView = () => {
    switch (currentView) {
      case 'insights':
        return <Dashboard setCurrentView={setCurrentView} />;
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
        return <SocialCommerce />;
      case 'chat':
        return <MarketingCopilot />;
      default:
        return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onLogout={handleLogout}
          currentView={currentView}
          setCurrentView={setCurrentView}
        />
        {/* Mobile bottom nav */}
        <div className="sm:hidden px-3 pb-1">
          <div className="flex gap-1 overflow-x-auto p-1 bg-white/70 backdrop-blur-xl border border-white/80 shadow-soft rounded-full">
            {([
              ['insights', 'Home'],
              ['campaigns', 'Campaigns'],
              ['lab', 'Lab'],
              ['linkedin', 'Social'],
              ['automation', 'Leads'],
              ['chat', 'Chat'],
            ] as [View, string][]).map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => setCurrentView(view)}
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
    </div>
  );
};

export default App;
