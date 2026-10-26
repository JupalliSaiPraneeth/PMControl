import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Radio, ShieldCheck, ArrowRight, Activity, Plus, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api.js';
import { Device, RemoteSession } from '../types/index.js';

export const Overview: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [devList, sessList] = await Promise.all([
          api.getDevices().catch(() => []),
          api.getSessions().catch(() => []),
        ]);
        setDevices(devList);
        setSessions(sessList);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeSessions = sessions.filter((s) => s.status === 'active');

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">System Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry and management for enrolled Android devices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/devices"
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-sky-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Pair Device
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Enrolled Devices</span>
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{devices.length}</span>
            <span className="text-xs text-slate-400">Total authorized</span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Sessions</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{activeSessions.length}</span>
            <span className="text-xs text-emerald-400 font-medium">Live WebRTC</span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Consent Guard</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-lg font-bold text-indigo-300">Enforced</span>
            <span className="text-xs text-slate-400">Explicit approval</span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Transport Mode</span>
            <div className="p-2 bg-violet-500/10 text-violet-400 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-lg font-bold text-violet-300">Direct / TURN</span>
            <span className="text-xs text-slate-400">End-to-End</span>
          </div>
        </div>
      </div>

      {/* Enrolled Devices Quick List */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Authorized Android Devices</h2>
          <Link to="/devices" className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-10 space-y-3 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
            <Smartphone className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-200">No paired devices found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Enroll your personal Android device using a secure 6-digit numeric pairing code.
            </p>
            <Link
              to="/devices"
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-medium shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Pair First Device
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device) => (
              <div
                key={device.id}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-sky-500/30 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-800 text-sky-400 rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{device.displayName}</h3>
                    <p className="text-xs text-slate-400">
                      v{device.appVersion} • Last seen {new Date(device.lastSeenAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/session?deviceId=${device.id}`}
                  className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg text-xs font-medium border border-sky-500/20 transition flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Connect
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security & Consent Notice */}
      <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-900/40 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 text-slate-300">
          <p className="font-semibold text-sky-300">Consent-Based Remote Architecture</p>
          <p>
            OmniControl strictly operates with explicit device-side authorization. Every screen share, voice transmission, and accessibility action requires local consent. Covert access is architecturally prevented.
          </p>
        </div>
      </div>
    </div>
  );
};
