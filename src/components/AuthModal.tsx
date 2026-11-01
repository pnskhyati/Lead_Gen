import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  ArrowRight, 
  Check, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Building, 
  User, 
  Shield, 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { demoLogin, login, register, type AppUser } from '../legacy/services/authService';

export interface UserSession {
  name: string;
  email: string;
  workspace: string;
  role: string;
}

function toSession(user: AppUser, workspace = 'Nexora'): UserSession {
  return {
    name: user.name || user.email.split('@')[0] || 'User',
    email: user.email,
    workspace,
    role: user.role === 'admin' ? 'Admin' : user.role || 'Member',
  };
}

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'signup' | 'forgot';
  onClose: () => void;
  onSuccess: (user: UserSession) => void;
  onSwitchToSignup?: () => void;
}

export default function AuthModal({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
  onSwitchToSignup
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('Acme Studio');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  // Sync mode whenever initialMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setForgotSent(false);
    }
  }, [isOpen, initialMode]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle standard login submission
  const handleSubmitLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const targetEmail = email.trim();
    const targetPassword = password.trim();

    if (!targetPassword && !targetEmail) {
      await handleQuickDemoLogin();
      return;
    }

    if (!targetEmail || !targetPassword) {
      setError('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(targetEmail, targetPassword);
      onSuccess(toSession(user, workspaceName.trim() || 'Nexora'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick 1-click demo login
  const handleQuickDemoLogin = async (_role: 'owner' | 'sales' = 'owner') => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await demoLogin();
      setEmail(user.email);
      onSuccess(toSession(user, 'Nexora Demo'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google SSO login — falls back to demo session until Google OAuth is wired
  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await demoLogin();
      onSuccess(toSession(user, 'Nexora'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sign up submission
  const handleSubmitSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide a work email address.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await register(email.trim(), password.trim(), fullName.trim() || undefined);
      onSuccess(toSession(user, workspaceName.trim() || 'My Workspace'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle forgot password request
  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your account email address.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setForgotSent(true);
    }, 700);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-[#071C1A] border border-[rgba(169,191,165,0.25)] p-6 sm:p-8 shadow-2xl rounded-[3px] text-[#E8E9D8] transition-all">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#A9BFA5]/60 hover:text-[#E8E9D8] p-1.5 rounded-[2px] transition-colors cursor-pointer focus:outline-none hover:bg-[#0D2D2A]/60"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {/* Modal Top Branding */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <span className="serif text-xl font-medium tracking-tight text-[#E8E9D8] lowercase">
              nexora
            </span>
            <span className="text-[10px] text-[#A9BFA5]/50 font-mono">/</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#A9BFA5]/75">
              TECAVY AI WORKSPACE
            </span>
          </div>

          {/* Tab Switcher (Log in / Sign up) */}
          {mode !== 'forgot' ? (
            <div className="flex border-b border-[rgba(169,191,165,0.15)] mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 pb-2.5 text-xs uppercase tracking-widest font-mono font-medium transition-all text-center cursor-pointer relative ${
                  mode === 'login'
                    ? 'text-[#E8E9D8] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#E8E9D8]'
                    : 'text-[#A9BFA5]/60 hover:text-[#E8E9D8]'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onSwitchToSignup) {
                    onSwitchToSignup();
                  } else {
                    setMode('signup');
                    setError(null);
                  }
                }}
                className={`flex-1 pb-2.5 text-xs uppercase tracking-widest font-mono font-medium transition-all text-center cursor-pointer relative ${
                  mode === 'signup'
                    ? 'text-[#E8E9D8] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#E8E9D8]'
                    : 'text-[#A9BFA5]/60 hover:text-[#E8E9D8]'
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setForgotSent(false);
              }}
              className="inline-flex items-center space-x-1.5 text-xs font-mono text-[#A9BFA5] hover:text-[#E8E9D8] mt-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to log in</span>
            </button>
          )}
        </div>

        {/* ERROR NOTICE */}
        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-[2px] flex items-center space-x-2 text-rose-300 text-xs font-mono animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* MODE: FORGOT PASSWORD */}
        {mode === 'forgot' ? (
          <div>
            <div className="mb-5">
              <h2 id="auth-modal-title" className="serif text-2xl font-light text-[#E8E9D8] mb-1">
                Reset your password
              </h2>
              <p className="text-xs text-[#A9BFA5] font-light leading-relaxed">
                Enter your verified work email address and we will immediately send a secure recovery link.
              </p>
            </div>

            {forgotSent ? (
              <div className="p-4 bg-[#0D2D2A]/80 border border-[#A9BFA5]/30 rounded-[2px] text-center space-y-3 font-mono text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-semibold text-white">Reset instructions dispatched!</p>
                <p className="text-[#A9BFA5] text-[11px] leading-relaxed">
                  We sent an email to <span className="text-white font-medium">{email || 'your address'}</span> with a single-use login link.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotSent(false);
                  }}
                  className="w-full mt-2 py-2 bg-[#E8E9D8] text-[#071C1A] font-semibold uppercase tracking-wider text-xs hover:bg-white transition-colors cursor-pointer"
                >
                  Return to Log In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1.5">
                    Account Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#A9BFA5]/60 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@acme.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#051513] border border-[rgba(169,191,165,0.25)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-semibold uppercase tracking-widest text-xs rounded-[2px] transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    <span>Send Reset Instructions</span>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : mode === 'login' ? (
          /* MODE: LOG IN */
          <div>
            <div className="mb-5">
              <h2 id="auth-modal-title" className="serif text-2xl font-light text-[#E8E9D8] mb-1">
                Log in to workspace
              </h2>
              <p className="text-xs text-[#A9BFA5] font-light leading-relaxed">
                Welcome back. Access your Acme Studio leads, inbox, and campaign intelligence.
              </p>
            </div>

            {/* Quick 1-Click Demo Login Banner */}
            <div className="mb-5 p-3.5 bg-gradient-to-r from-[#0D2D2A] to-[#0A2321] border border-[#A9BFA5]/30 rounded-[2px] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5 text-emerald-300 font-mono text-[11px] font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider">Instant Demo Access</span>
                </div>
                <span className="text-[10px] text-[#A9BFA5]/70 font-mono">No password required</span>
              </div>
              <p className="text-[11px] text-[#A9BFA5] font-light leading-snug mb-3">
                Preloaded with live leads, WhatsApp conversations, scheduled campaigns, and intelligence metrics.
              </p>
              <button
                type="button"
                id="auth-demo-login-btn"
                onClick={() => handleQuickDemoLogin('owner')}
                disabled={isLoading}
                className="w-full py-2 bg-[#E8E9D8] hover:bg-white text-[#071C1A] text-xs font-mono font-bold uppercase tracking-widest rounded-[2px] transition-all cursor-pointer shadow flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ 1-Click Demo Login (Acme Studio)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full py-2.5 px-3 bg-[#061816] hover:bg-[#0D2D2A] border border-[rgba(169,191,165,0.25)] rounded-[2px] text-xs font-mono text-[#E8E9D8] flex items-center justify-center space-x-2.5 transition-colors cursor-pointer mb-4"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="w-full border-t border-[rgba(169,191,165,0.15)]" />
              <span className="absolute bg-[#071C1A] px-2 text-[10px] font-mono uppercase tracking-widest text-[#A9BFA5]/60">
                or sign in with email
              </span>
            </div>

            {/* Email + Password Form */}
            <form onSubmit={handleSubmitLogin} className="space-y-3.5 font-mono text-xs">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#A9BFA5]/60 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    id="auth-login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@acme.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.25)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    className="text-[10px] text-[#A9BFA5]/80 hover:text-[#E8E9D8] underline transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#A9BFA5]/60 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="auth-login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-9 py-2 bg-[#051513] border border-[rgba(169,191,165,0.25)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#A9BFA5]/60 hover:text-[#E8E9D8] transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 text-[11px] text-[#A9BFA5] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded-[2px] bg-[#051513] border-[rgba(169,191,165,0.3)] text-[#0D2D2A] focus:ring-0 cursor-pointer accent-[#A9BFA5]"
                  />
                  <span>Remember me for 30 days</span>
                </label>
              </div>

              <button
                type="submit"
                id="auth-submit-login-btn"
                disabled={isLoading}
                className="w-full py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-mono font-bold uppercase tracking-widest text-xs rounded-[2px] transition-all cursor-pointer flex items-center justify-center space-x-2 shadow"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Log In to Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* MODE: SIGN UP */
          <div>
            <div className="mb-5">
              <h2 id="auth-modal-title" className="serif text-2xl font-light text-[#E8E9D8] mb-1">
                Create your workspace
              </h2>
              <p className="text-xs text-[#A9BFA5] font-light leading-relaxed">
                Start your 14-day free trial. Full access to AI lead scoring, omni-inbox, and campaign builder.
              </p>
            </div>

            <form onSubmit={handleSubmitSignUp} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#A9BFA5]/60 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full pl-9 pr-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.25)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#A9BFA5]/60 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@acme.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.25)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  Company / Workspace
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 text-[#A9BFA5]/60 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Acme Studio"
                    className="w-full pl-9 pr-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.25)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#A9BFA5]/60 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-9 py-2 bg-[#051513] border border-[rgba(169,191,165,0.25)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#A9BFA5]/60 hover:text-[#E8E9D8] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-mono font-bold uppercase tracking-widest text-xs rounded-[2px] transition-all cursor-pointer flex items-center justify-center space-x-2 shadow"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Start 14-Day Free Trial</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Security badge and switcher footer */}
        <div className="mt-6 pt-4 border-t border-[rgba(169,191,165,0.15)] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-[#A9BFA5]/75">
          <div className="flex items-center space-x-1.5">
            <Shield className="w-3 h-3 text-[#A9BFA5]" />
            <span>256-bit encrypted · SOC-2 compliant</span>
          </div>

          <div>
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => {
                  if (onSwitchToSignup) {
                    onSwitchToSignup();
                  } else {
                    setMode('signup');
                    setError(null);
                  }
                }}
                className="hover:text-white underline transition-colors cursor-pointer"
              >
                Need an account? Sign up
              </button>
            ) : mode === 'signup' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="hover:text-white underline transition-colors cursor-pointer"
              >
                Have an account? Log in
              </button>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
}
