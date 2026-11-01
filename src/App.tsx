import React, { useEffect, useState } from 'react';
import BackgroundAtmosphere from './components/BackgroundAtmosphere';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import EditorialPhilosophy from './components/EditorialPhilosophy';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';
import LiveNexoraShell from './components/LiveNexoraShell';
import InfoModal from './components/InfoModal';
import AuthModal, { UserSession } from './components/AuthModal';
import OnboardingFlow, { OnboardingData } from './components/OnboardingFlow';
import BrandSetupWizard from './legacy/components/BrandSetupWizard';
import { getCurrentUser, logout } from './legacy/services/authService';
import { getCompanySetup } from './legacy/services/companyService';

function sessionFromUser(user: { id: string; email: string; name?: string; role?: string }): UserSession {
  return {
    name: user.name || user.email.split('@')[0] || 'User',
    email: user.email,
    workspace: 'Nexora',
    role: user.role === 'admin' ? 'Admin' : user.role || 'Member',
  };
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [modalType, setModalType] = useState<'contact' | 'privacy' | 'terms' | null>(null);

  useEffect(() => {
    void getCurrentUser()
      .then((user) => {
        if (user) {
          setCurrentUser(sessionFromUser(user));
          setInApp(true);
        } else {
          setInApp(false);
        }
      })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!currentUser || !inApp) {
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
  }, [currentUser, inApp]);

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const pathname = window.location.pathname;

    if (hash === '#login' || search.includes('auth=login') || pathname === '/login') {
      setInApp(false);
      setAuthMode('login');
      setIsAuthOpen(true);
      setIsOnboardingOpen(false);
    } else if (
      hash === '#signup' ||
      search.includes('auth=signup') ||
      pathname === '/signup' ||
      hash === '#onboarding' ||
      pathname === '/onboarding'
    ) {
      setInApp(false);
      setIsAuthOpen(false);
      setIsOnboardingOpen(true);
    }
  }, []);

  const handleOpenLogin = () => {
    setIsOnboardingOpen(false);
    setAuthMode('login');
    setIsAuthOpen(true);
  };

  const handleOpenGetStarted = () => {
    setIsAuthOpen(false);
    setIsOnboardingOpen(true);
  };

  const handleAuthSuccess = (user: UserSession) => {
    setCurrentUser(user);
    setIsAuthOpen(false);
    setIsOnboardingOpen(false);
    setInApp(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOnboardingComplete = async (data: OnboardingData) => {
    // Prefer real register if credentials were collected; otherwise open login.
    setCurrentUser({
      name: data.name,
      email: data.email,
      workspace: data.businessName || 'Nexora',
      role: 'Owner',
    });
    setIsOnboardingOpen(false);
    setIsAuthOpen(false);
    // If no session cookie yet, force login so APIs work
    const existing = await getCurrentUser();
    if (!existing) {
      setAuthMode('login');
      setIsAuthOpen(true);
      setInApp(false);
      return;
    }
    setInApp(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReturnToLanding = () => {
    void logout().finally(() => {
      setCurrentUser(null);
      setInApp(false);
      setSetupComplete(false);
      setSetupChecked(false);
      setIsAuthOpen(false);
      setIsOnboardingOpen(false);
      window.history.pushState(null, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleLearnMore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070B14] text-[#94A3B8] text-sm">
        Loading Nexora…
      </div>
    );
  }

  if (inApp && currentUser) {
    if (!setupChecked) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#070B14] text-[#94A3B8] text-sm">
          Checking brand setup…
        </div>
      );
    }

    if (!setupComplete) {
      return (
        <div className="min-h-screen bg-[#F8FAFC]">
          <BrandSetupWizard
            onComplete={() => {
              setSetupComplete(true);
            }}
            onLogout={handleReturnToLanding}
          />
        </div>
      );
    }

    return (
      <>
        <LiveNexoraShell
          onReturnToLanding={handleReturnToLanding}
          currentUser={currentUser}
          onOpenLogin={handleOpenLogin}
          isAdmin={String(currentUser.role).toLowerCase() === 'admin'}
        />
        <AuthModal
          isOpen={isAuthOpen}
          initialMode={authMode}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={handleAuthSuccess}
          onSwitchToSignup={handleOpenGetStarted}
        />
      </>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#071C1A] text-[#E8E9D8] font-sans overflow-x-hidden selection:bg-[#A9BFA5]/25 selection:text-[#E8E9D8]">
      <BackgroundAtmosphere />

      <div className="relative z-30 bg-[#061816] border-b border-[rgba(169,191,165,0.2)] py-1.5 px-4 text-center font-mono text-[11px] text-[#A9BFA5] flex items-center justify-center space-x-3">
        <span className="hidden sm:inline">✦ Nexora Marketing OS · live backend</span>
        <button
          type="button"
          onClick={handleOpenLogin}
          className="text-white hover:text-emerald-300 font-semibold underline cursor-pointer"
        >
          [Log In to Workspace]
        </button>
        <span className="opacity-40">·</span>
        <button
          type="button"
          onClick={handleOpenGetStarted}
          className="text-amber-300 hover:text-white font-semibold underline cursor-pointer"
        >
          [Get Started]
        </button>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar onOpenApp={(mode) => (mode === 'signup' ? handleOpenGetStarted() : handleOpenLogin())} />

        <main className="flex-1">
          <Hero onGetStarted={handleOpenGetStarted} onLearnMore={handleLearnMore} />
          <Features onOpenApp={handleOpenGetStarted} />
          <HowItWorks onOpenApp={handleOpenGetStarted} />
          <EditorialPhilosophy />
          <FinalCTA onGetStarted={handleOpenGetStarted} />
        </main>

        <Footer
          onOpenApp={handleOpenGetStarted}
          onContactClick={() => setModalType('contact')}
          onPrivacyClick={() => setModalType('privacy')}
          onTermsClick={() => setModalType('terms')}
        />
      </div>

      <OnboardingFlow
        isOpen={isOnboardingOpen}
        initialStep="signup"
        onClose={() => setIsOnboardingOpen(false)}
        onOpenLogin={handleOpenLogin}
        onComplete={handleOnboardingComplete}
      />

      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        onSwitchToSignup={handleOpenGetStarted}
      />

      <InfoModal type={modalType} onClose={() => setModalType(null)} />
    </div>
  );
}
