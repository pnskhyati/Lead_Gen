import React, { useEffect, useState, FormEvent } from 'react';
import {
  demoLogin,
  getAppAuthStatus,
  login,
  register,
  type AppUser,
} from '../services/authService';
import { APP_INITIAL, APP_NAME, APP_SUBTAGLINE, APP_TAGLINE } from '../constants/branding';

interface LoginProps {
  onLoginSuccess: (user: AppUser) => void;
}

const DEMO_EMAIL = 'demo@nexora.com';
const DEMO_PASSWORD = 'password123';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allowRegister, setAllowRegister] = useState(false);
  const [hasUsers, setHasUsers] = useState(true);
  const [demoAvailable, setDemoAvailable] = useState(true);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void getAppAuthStatus()
      .then((s) => {
        setAllowRegister(s.allowRegister);
        setHasUsers(s.hasUsers);
        setDemoAvailable(s.demoLogin);
        if (s.demoEmail) setEmail(s.demoEmail);
        if (!s.hasUsers) {
          setMode('register');
          setEmail('');
          setPassword('');
        }
      })
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const user =
        mode === 'register'
          ? await register(email.trim(), password, name.trim() || undefined)
          : await login(email.trim(), password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setError('');
    setMode('login');
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    try {
      const user = await demoLogin();
      onLoginSuccess(user);
    } catch (err) {
      // Fallback: try normal login with demo credentials
      try {
        const user = await login(DEMO_EMAIL, DEMO_PASSWORD);
        onLoginSuccess(user);
      } catch {
        setError(err instanceof Error ? err.message : 'Demo login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-soft-lilac/25 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-soft-mint/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-soft-azure/20 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 w-16 h-16 rounded-[1.35rem] bg-gradient-to-br from-soft-deep via-soft-azure to-soft-lilac text-white flex items-center justify-center font-extrabold text-2xl shadow-aqua">
            {APP_INITIAL}
          </div>
          <h1 className="font-display font-semibold text-5xl text-ink tracking-tight">{APP_NAME}</h1>
          <p className="text-ink-muted mt-2 text-sm font-medium tracking-wide">
            {APP_TAGLINE}
          </p>
          <p className="text-ink-muted/80 mt-1 text-xs font-medium">{APP_SUBTAGLINE}</p>
        </div>

        <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[2rem] border border-soft-sky/50 shadow-soft-lg">
          {booting ? (
            <p className="text-center text-sm text-ink-muted py-6">Checking session…</p>
          ) : (
            <>
              {demoAvailable && mode === 'login' && (
                <div className="mb-5">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleDemoLogin()}
                    className="w-full py-3.5 rounded-full text-sm font-bold text-soft-deep bg-soft-mint hover:bg-soft-mint/80 border border-soft-sky/60 transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Signing in…' : 'Continue with demo account'}
                  </button>
                  <p className="text-center text-[11px] text-ink-muted mt-2.5">
                    {DEMO_EMAIL} · {DEMO_PASSWORD}
                  </p>
                  <div className="flex items-center gap-3 my-5">
                    <div className="h-px flex-1 bg-soft-sky/60" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">or</span>
                    <div className="h-px flex-1 bg-soft-sky/60" />
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {!hasUsers && (
                  <p className="text-xs text-soft-deep bg-soft-mint/60 rounded-2xl px-3 py-2.5 font-medium">
                    First-time setup — create your admin account to secure this workspace.
                  </p>
                )}

                {mode === 'register' && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-ink-soft mb-2">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="nexora-input w-full py-3 px-4 text-sm text-ink"
                      placeholder="Your name"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-ink-soft mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="nexora-input w-full py-3 px-4 text-sm text-ink"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-ink-soft mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="nexora-input w-full py-3 px-4 text-sm text-ink"
                  />
                  {mode === 'register' && (
                    <p className="text-[11px] text-ink-muted mt-1.5">At least 8 characters</p>
                  )}
                </div>

                {error && <p className="text-sm text-soft-coral text-center font-medium">{error}</p>}

                <button type="submit" disabled={isLoading} className="nexora-btn-primary w-full py-3.5 text-sm">
                  {isLoading
                    ? mode === 'register'
                      ? 'Creating account…'
                      : 'Signing in…'
                    : mode === 'register'
                      ? 'Create admin account'
                      : 'Sign in'}
                </button>

                {allowRegister && hasUsers && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode((m) => (m === 'login' ? 'register' : 'login'));
                      setError('');
                    }}
                    className="w-full text-center text-xs font-semibold text-soft-azure hover:underline"
                  >
                    {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
