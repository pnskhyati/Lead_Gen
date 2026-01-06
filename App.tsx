import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ContentStudio from './components/ContentStudio';
import MarketingCopilot from './components/MarketingCopilot';
import SocialCommerce from './components/SocialCommerce';
import Campaigns from './components/Campaigns';
import Login from './components/Login';
import BridalAssistant from './components/BridalAssistant';
import type { View } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('insights');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentView('insights');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'insights':
        return <Dashboard setCurrentView={setCurrentView} />;
      case 'campaigns':
        return <Campaigns />;
      case 'lab':
        return <ContentStudio />;
      case 'automation':
        return <SocialCommerce />;
      case 'chat':
        return <MarketingCopilot />;
      case 'bridal':
        return <BridalAssistant />;
      default:
        return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-slate-100/30 dark:bg-slate-900/50">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="flex-1 flex flex-col">
        <Header onLogout={handleLogout} />
        <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;