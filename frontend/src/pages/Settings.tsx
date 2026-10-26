import React, { useState } from 'react';
import { Radio, Check, Save } from 'lucide-react';

export const Settings: React.FC = () => {
  const [stunServer, setStunServer] = useState('stun:stun.l.google.com:19302');
  const [turnServer, setTurnServer] = useState('');
  const [turnUsername, setTurnUsername] = useState('');
  const [turnCredential, setTurnCredential] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(
      'omnicontrol_webrtc_config',
      JSON.stringify({ stunServer, turnServer, turnUsername, turnCredential })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Application Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure WebRTC network traversal (STUN/TURN), signaling endpoints, and telemetry preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="glass-panel rounded-2xl border border-slate-800 p-6 space-y-6">
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-400" />
            WebRTC ICE Servers
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">STUN Server Address</label>
            <input
              type="text"
              value={stunServer}
              onChange={(e) => setStunServer(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">Used for discovering public IP mapping across home NAT routers.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">TURN Relay Server Address (Optional)</label>
            <input
              type="text"
              placeholder="turn:turn.example.com:3478"
              value={turnServer}
              onChange={(e) => setTurnServer(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">Required when symmetric NAT or strict enterprise firewalls block direct P2P connections.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">TURN Username</label>
              <input
                type="text"
                value={turnUsername}
                onChange={(e) => setTurnUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">TURN Password / Credential</label>
              <input
                type="password"
                value={turnCredential}
                onChange={(e) => setTurnCredential(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          {saved ? (
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
              <Check className="w-4 h-4" /> Preferences saved
            </span>
          ) : <div />}
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-sky-500/20 transition"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
