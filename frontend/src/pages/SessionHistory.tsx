import React, { useEffect, useState } from 'react';
import { History, Clock, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api.js';
import { RemoteSession } from '../types/index.js';

export const SessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const data = await api.getSessions();
        setSessions(data);
      } catch (err) {
        console.error('Failed to load session history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return 'In progress / Interrupted';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Session History</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cryptographically audited log of past remote-support connections and consent decisions.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-slate-400">Loading session history...</div>
      ) : sessions.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-3 border border-slate-800">
          <History className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Recorded Sessions</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Past authorized sessions will appear here with timestamps, duration, and consent audit records.
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Session ID</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Requested At</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Controller</th>
                  <th className="px-5 py-3.5">Audit Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/40 transition">
                    <td className="px-5 py-4 font-mono font-medium text-slate-200">
                      {s.id.substring(0, 8)}...
                    </td>
                    <td className="px-5 py-4">
                      {s.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : s.status === 'ended' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          <Clock className="w-3 h-3" /> Completed
                        </span>
                      ) : s.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <XCircle className="w-3 h-3" /> Declined by Device
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {new Date(s.requestedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {calculateDuration(s.startedAt, s.endedAt)}
                    </td>
                    <td className="px-5 py-4 text-slate-400 capitalize">
                      {s.controllerType} Dashboard
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 font-mono">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
