import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Plus, Trash2, Radio, Battery, Wifi, ShieldAlert, X, Copy, Check, Clock } from 'lucide-react';
import { api } from '../services/api.js';
import { Device, PairingCodeResponse } from '../types/index.js';

export const Devices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingData, setPairingData] = useState<PairingCodeResponse | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const data = await api.getDevices();
      setDevices(data);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleStartPairing = async () => {
    try {
      setPairingLoading(true);
      setPairingModalOpen(true);
      const res = await api.generatePairingCode();
      setPairingData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to generate pairing code');
      setPairingModalOpen(false);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleRevoke = async (deviceId: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke access for "${name}"? It will immediately disconnect.`)) {
      return;
    }
    try {
      await api.revokeDevice(deviceId);
      await fetchDevices();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke device');
    }
  };

  const handleCopyCode = () => {
    if (pairingData?.pairingCode) {
      navigator.clipboard.writeText(pairingData.pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Device Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Enrolled Android devices authorized for secure remote support sessions.
          </p>
        </div>
        <button
          onClick={handleStartPairing}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/25 transition"
        >
          <Plus className="w-4 h-4" />
          Pair New Android Device
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-slate-400">Loading devices...</div>
      ) : devices.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-slate-800">
          <Smartphone className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">No Authorized Devices</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Pair your personal Android phone by generating a cryptographic 6-digit code and approving enrollment on the device.
          </p>
          <button
            onClick={handleStartPairing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold shadow-lg transition"
          >
            <Plus className="w-4 h-4" />
            Generate Pairing Code
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices.map((device) => (
            <div
              key={device.id}
              className="glass-panel rounded-2xl p-5 border border-slate-800/80 flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 text-sm">{device.displayName}</h3>
                    <p className="text-xs text-slate-400 font-mono">Android App v{device.appVersion}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Authorized
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                <div className="flex items-center gap-1.5">
                  <Battery className="w-3.5 h-3.5 text-slate-400" />
                  <span>{device.batteryLevel ? `${device.batteryLevel}%` : 'Standard'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-slate-400" />
                  <span>{device.networkType || 'Wi-Fi / 5G'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => handleRevoke(device.id, device.displayName)}
                  title="Revoke device access"
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Revoke</span>
                </button>
                <button
                  onClick={() => navigate(`/session?deviceId=${device.id}`)}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-500/20 transition flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Start Session
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pairing Code Modal */}
      {pairingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-700/80 p-6 space-y-6 shadow-2xl bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-slate-100 text-base">Pair Android Device</h3>
              </div>
              <button
                onClick={() => setPairingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pairingLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Generating secure pairing code...</div>
            ) : pairingData ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <p className="text-xs text-slate-400">Enter this one-time pairing code on your Android device:</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-4xl font-extrabold tracking-widest text-sky-400 bg-sky-950/60 border border-sky-500/40 px-6 py-3 rounded-2xl shadow-inner">
                      {pairingData.pairingCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
                      title="Copy Code"
                    >
                      {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expires in 5 minutes (One-Time Use)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li>Open <strong>OmniControl</strong> on your Android phone.</li>
                    <li>Tap <strong>Enroll Device</strong> on the welcome screen.</li>
                    <li>Enter the 6-digit code shown above and grant consent.</li>
                  </ol>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setPairingModalOpen(false);
                      fetchDevices();
                    }}
                    className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
