import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Smartphone,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  LayoutDashboard,
  Radio,
  Menu,
  X,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/devices', label: 'Devices', icon: Smartphone },
    { to: '/session', label: 'Remote Session', icon: Radio },
    { to: '/history', label: 'Session History', icon: History },
    { to: '/security', label: 'Security & Audit', icon: ShieldCheck },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-slate-800/80 bg-slate-900/40">
        {/* Brand header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/60">
          <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl shadow-lg shadow-sky-500/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-sky-400 bg-clip-text text-transparent">
              OmniControl
            </h1>
            <p className="text-xs text-sky-400 font-mono tracking-wider flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> SECURE SUPPORT
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center justify-between mb-2">
            <div className="truncate">
              <p className="text-xs text-slate-400">Authenticated as</p>
              <p className="text-sm font-medium text-slate-200 truncate">{user?.email || 'Authenticated User'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/40 text-[11px] text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            E2E Transport Active
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-500 rounded-lg">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">OmniControl</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 border-b border-slate-800 px-4 py-4 space-y-2 z-50">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  <Icon className="w-4 h-4 text-sky-400" />
                  {item.label}
                </NavLink>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
