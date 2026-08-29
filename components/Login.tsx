import React, { useState, FormEvent } from 'react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('demo@nexora.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      if (email === 'demo@nexora.com' && password === 'password') {
        onLoginSuccess();
      } else {
        setError('Invalid credentials. Please try again.');
      }
      setIsLoading(false);
    }, 1000);
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
            N
          </div>
          <h1 className="font-display font-semibold text-5xl text-ink tracking-tight">Nexora</h1>
          <p className="text-ink-muted mt-2 text-sm font-medium tracking-wide">Premium GenAI commerce suite</p>
        </div>

        <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[2rem] border border-soft-sky/50 shadow-soft-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="nexora-input w-full py-3 px-4 text-sm text-ink"
              />
            </div>

            {error && <p className="text-sm text-soft-coral text-center font-medium">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="nexora-btn-primary w-full py-3.5 text-sm"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-xs text-ink-muted mt-5">
            Demo · demo@nexora.com / password
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
