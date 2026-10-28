import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import {
  ThermometerSnowflake,
  Lock,
  Mail,
  ArrowRight,
  Sun,
  Moon,
  ShieldCheck,
  UserCheck,
  AlertCircle
} from 'lucide-react';

export default function Login() {
  const { login, demoUsers } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [identifier, setIdentifier] = useState('warehouse@coldchain.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFormLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (email) => {
    setError('');
    setLoading(true);
    setIdentifier(email);
    setPassword('password123');
    try {
      await login(email, 'password123');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-4 sm:p-6 transition-colors">
      {/* Top Bar with theme toggle */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-md shadow-sky-500/20">
            <ThermometerSnowflake className="w-5 h-5 animate-pulse-subtle" />
          </div>
          <span className="font-extrabold text-base tracking-tight">
            ColdChain<span className="text-sky-500">Pro</span>
          </span>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-8 space-y-6">
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Cold-Chain Operations Portal
          </h2>
         
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
          <form onSubmit={handleFormLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employee ID or Email:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. warehouse@coldchain.com or EMP-WH-001"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Operations Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick-Login Demo Personas */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block text-center">
               One-Click Role Logins:
            </span>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('warehouse@coldchain.com')}
                className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-left hover:scale-[1.02] transition-transform"
              >
                <span className="font-bold text-blue-900 dark:text-blue-300 block">Warehouse Staff</span>
                <span className="text-[10px] text-slate-500">Karthik (Picking)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('manager@coldchain.com')}
                className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-left hover:scale-[1.02] transition-transform"
              >
                <span className="font-bold text-emerald-900 dark:text-emerald-300 block">Manager</span>
                <span className="text-[10px] text-slate-500">Ananya (Excursion Sign-off)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('driver@coldchain.com')}
                className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-left hover:scale-[1.02] transition-transform"
              >
                <span className="font-bold text-amber-900 dark:text-amber-300 block">Fleet Driver</span>
                <span className="text-[10px] text-slate-500">Murugan (Proof-Delivery)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('verifier@coldchain.com')}
                className="p-2.5 rounded-xl border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/50 dark:bg-cyan-950/20 text-left hover:scale-[1.02] transition-transform"
              >
                <span className="font-bold text-cyan-900 dark:text-cyan-300 block">Verification Staff</span>
                <span className="text-[10px] text-slate-500">Selvi (Door Closure Seal)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('receiver@apollo.com')}
                className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-left hover:scale-[1.02] transition-transform"
              >
                <span className="font-bold text-rose-900 dark:text-rose-300 block">Hospital Receiver</span>
                <span className="text-[10px] text-slate-500">Apollo Head Pharmacist</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@coldchain.com')}
                className="p-2.5 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 text-left hover:scale-[1.02] transition-transform"
              >
                <span className="font-bold text-purple-900 dark:text-purple-300 block">Admin Master</span>
                <span className="text-[10px] text-slate-500">Dr. Rajesh Sekhar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-400">
        WHO Technical Report Series Annex 5 & CDSCO Aligned Cold-Chain Management Platform • Demo Environment
      </div>
    </div>
  );
}
