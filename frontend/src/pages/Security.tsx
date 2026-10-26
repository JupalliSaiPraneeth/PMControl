import { ShieldCheck, Lock, KeyRound, EyeOff, AlertTriangle } from 'lucide-react';

export const Security: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Security Architecture & Audit</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cryptographic guarantees, platform permission boundaries, and consent enforcement rules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Cryptographic Pairing</h3>
              <p className="text-xs text-slate-400">Entropy & Single-Use Guarantee</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Pairing codes are cryptographically random 6-digit tokens hashed with SHA-256 before storage. Codes expire in 300 seconds and are immediately invalidated upon first redemption to eliminate brute-force attack vectors.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">WebRTC DTLS/SRTP</h3>
              <p className="text-xs text-slate-400">Direct End-to-End Encryption</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All media tracks (screen projection video and microphone audio) are encrypted peer-to-peer using WebRTC standard DTLS/SRTP protocols. Media payloads never pass in plaintext through the API server.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Zero Covert Surveillance</h3>
              <p className="text-xs text-slate-400">Android Foreground Service</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Android MediaProjection explicitly requires user consent per session and enforces an omnipresent system notification. OmniControl contains no background recording or hidden surveillance bypasses.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Row Level Security</h3>
              <p className="text-xs text-slate-400">PostgreSQL Identity Isolation</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Supabase RLS policies guarantee users can only query, pair, or manage devices and sessions that match their authenticated cryptographic identity (`auth.uid() = owner_id`).
          </p>
        </div>
      </div>

      {/* Android Limitation Guidelines */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 bg-slate-900/60">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Android Platform Boundaries & Limitations</span>
        </div>
        <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
          <li><strong>Secure Windows (FLAG_SECURE):</strong> Banking apps and password managers will intentionally render black screens under MediaProjection. This is an intentional Android security policy and is never bypassed.</li>
          <li><strong>Accessibility Permissions:</strong> Gestures (tap, swipe) require explicitly enabling OmniControl under Android Accessibility Settings. If disabled, screen viewing remains functional while remote touch is ignored.</li>
          <li><strong>Audio Isolation:</strong> Android limits internal system audio capture to designated media apps. Microphone audio transmission is live, consent-based, and visibly indicated.</li>
        </ul>
      </div>
    </div>
  );
};
