import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import {
  ThermometerSnowflake,
  Sun,
  Moon,
  LogOut,
  Radio,
  Sliders,
  UserCheck,
  ShieldAlert,
  Bell
} from 'lucide-react';

export default function Navbar({ onOpenSimulator, onOpenChat, activeTab, setActiveTab }) {
  const { user, logout, quickSwitchRole, demoUsers } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isConnected } = useSocket();

  const roleColors = {
    'Admin': 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    'Warehouse Employee': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    'Manager': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    'Driver': 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    'Verification Staff': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700',
    'Hospital Receiver': 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300 dark:border-rose-700',
    'Auditor': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo and Tagline */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-md shadow-sky-500/20">
            <ThermometerSnowflake className="w-6 h-6 animate-pulse-subtle" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg text-slate-900 dark:text-white">
                ColdChain<span className="text-sky-500">Pro</span>
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-300/40">
                WHO/CDSCO Aligned
              </span>
            </div>
          
          </div>
        </div>

        {/* Live IoT & Role Switcher Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* IoT Telemetry status badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-rose-500'}`} />
            <span>{isConnected ? 'IoT Live Feed (4s)' : 'Reconnecting...'}</span>
          </div>

          {/* Quick Demo Switcher */}
          {user && (
            <div className="flex items-center gap-1">
              <label htmlFor="role-select" className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400 font-medium">
                Demo Role:
              </label>
              <select
                id="role-select"
                value={user.role}
                onChange={(e) => quickSwitchRole(e.target.value)}
                className="text-xs font-semibold py-1.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                title="Switch demo persona instantly"
              >
                {demoUsers.map((u) => (
                  <option key={u.id} value={u.role}>
                    {u.role} ({u.name.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Role Badge */}
          {user && (
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${roleColors[user.role] || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
              <UserCheck className="w-3.5 h-3.5" />
              <span>{user.role}</span>
            </div>
          )}

          {/* Simulator Drawer Trigger */}
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-sm"
            title="Open IoT Fault-Injection Control Panel"
          >
            <Sliders className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Fault Injector</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Logout */}
          {user && (
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
