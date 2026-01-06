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

    // Simulate API call
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
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <h1 className="font-bold text-4xl text-slate-900 dark:text-white tracking-wider">
                Nexora
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">GenAI Digital Commerce Assistant</p>
        </div>
        
        <div className="bg-white/40 dark:bg-slate-900/50 backdrop-blur-lg p-8 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xl shadow-black/5 dark:shadow-black/30">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                className="w-full bg-white/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                className="w-full bg-white/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-colors"
              />
            </div>
            
            {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-lg shadow-brand-blue/30 text-sm font-medium text-white bg-brand-blue hover:bg-brand-blue/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue transition-all duration-300 hover:shadow-brand-blue/40 hover:-translate-y-0.5 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
           <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
              Use <code className="bg-slate-200 dark:bg-slate-700 p-1 rounded">demo@nexora.com</code> and <code className="bg-slate-200 dark:bg-slate-700 p-1 rounded">password</code> to sign in.
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;