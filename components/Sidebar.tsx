import React from 'react';
import type { View } from '../types';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{
  view: View;
  label: string;
  icon: React.ReactNode;
  currentView: View;
  setCurrentView: (view: View) => void;
}> = ({ view, label, icon, currentView, setCurrentView }) => {
  const isActive = currentView === view;
  return (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group relative ${
        isActive
          ? 'text-slate-900 dark:text-white bg-brand-blue/20'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
      }`}
    >
      <div className={`
        absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-brand-blue rounded-r-full transition-opacity duration-300
        ${isActive ? 'opacity-100 shadow-[0_0_10px_theme(colors.brand-blue)]' : 'opacity-0'}
      `}></div>
      <div className={`mr-4 transition-colors duration-200 ${isActive ? 'text-brand-blue' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  return (
    <aside className="w-64 flex-shrink-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 p-4 flex flex-col">
      <div className="flex items-center h-16 flex-shrink-0 px-2">
        <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-wide">
          Nexora
        </span>
      </div>
      <nav className="mt-8 space-y-2">
        <NavItem 
          view="insights" 
          label="Insights" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>}
          currentView={currentView} 
          setCurrentView={setCurrentView} 
        />
        <NavItem 
          view="campaigns" 
          label="Campaigns" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414L8.586 11l-1.293 1.293a1 1 0 101.414 1.414L10 12.414l1.293 1.293a1 1 0 001.414-1.414L11.414 11l1.293-1.293z" clipRule="evenodd" /></svg>}
          currentView={currentView} 
          setCurrentView={setCurrentView} 
        />
        <NavItem 
          view="lab" 
          label="Creative Lab" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 00-1 1v1H3a1 1 0 000 2h1v1a1 1 0 001 1h3a1 1 0 001-1V6h1a1 1 0 100-2h-1V3a1 1 0 00-1-1H5zM3 14a1 1 0 011-1h1v-1a1 1 0 112 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H4a1 1 0 01-1-1zm5-1a1 1 0 000 2h3a1 1 0 000-2H8zm6-7a1 1 0 011-1h1V5a1 1 0 112 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0V8h-1a1 1 0 01-1-1z" clipRule="evenodd" /></svg>}
          currentView={currentView} 
          setCurrentView={setCurrentView} 
        />
        <NavItem 
          view="automation" 
          label="Automation" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a1.5 1.5 0 013 0V5a1 1 0 001 1h1.5a1.5 1.5 0 010 3H14a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V10a1 1 0 00-1-1H7.5a1.5 1.5 0 010-3H9a1 1 0 001-1V3.5zM7.5 11H9a1 1 0 001 1v1.5a1.5 1.5 0 01-3 0V12a1 1 0 00-1-1H3.5a1.5 1.5 0 010-3H5a1 1 0 001-1V6.5a1.5 1.5 0 013 0V8a1 1 0 001 1h1.5a1.5 1.5 0 010 3H12a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V14a1 1 0 00-1-1H5.5a1.5 1.5 0 010-3H7a1 1 0 001-1V8.5a1.5 1.5 0 01-3 0V10a1 1 0 00-1 1H1.5a1.5 1.5 0 010 3H3a1 1 0 001 1v1.5a1.5 1.5 0 01-3 0V16a1 1 0 00-1-1H.5a1.5 1.5 0 010-3H2a1 1 0 001-1v-1.5a1.5 1.5 0 013 0v.005z"></path></svg>}
          currentView={currentView} 
          setCurrentView={setCurrentView} 
        />
        <NavItem 
          view="chat" 
          label="AI Assistant" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.08-3.239A8.962 8.962 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM4.707 14.707a1 1 0 001.414 0L10 10.414l3.879 3.879a1 1 0 001.414-1.414L11.414 9l3.879-3.879a1 1 0 00-1.414-1.414L10 7.586 6.121 3.707a1 1 0 00-1.414 1.414L8.586 9 4.707 12.707a1 1 0 000 1.414z" clipRule="evenodd" /></svg>}
          currentView={currentView} 
          setCurrentView={setCurrentView} 
        />
         <NavItem 
          view="bridal" 
          label="Bridal Assistant" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 5a1 1 0 000 2h6a1 1 0 100-2H7zM10 15a4.472 4.472 0 004.243-3.228 1 1 0 10-1.833-.805A2.472 2.472 0 0110 13a2.472 2.472 0 01-2.41-2.033 1 1 0 10-1.833.805A4.472 4.472 0 0010 15z" clipRule="evenodd" /></svg>}
          currentView={currentView} 
          setCurrentView={setCurrentView} 
        />
      </nav>
    </aside>
  );
};

export default Sidebar;