import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // In production, this authenticates against Supabase Auth:
      // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // For instant local development and pairing tests:
      const token = `mock-token-${email.split('@')[0] || 'user-123'}`;
      login(email, token, 'user-' + email.split('@')[0]);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    login('owner@omnicontrol.local', 'mock-token-user-123', 'user-123');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-2xl shadow-xl shadow-sky-500/25 mb-2">
            <Radio className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">OmniControl</h1>
          <p className="text-xs text-slate-400">
            Secure Android Remote-Support & Management Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6 bg-slate-900/60">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-100">Sign in to your account</h2>
            <p className="text-xs text-slate-400">Manage paired devices and authorized support sessions.</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-sky-500 transition"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-sky-500 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/25 transition flex items-center justify-center gap-2"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Instant Developer Demo Account
          </button>
        </div>
      </div>
    </div>
  );
};
