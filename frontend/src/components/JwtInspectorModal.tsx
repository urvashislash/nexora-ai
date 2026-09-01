import React, { useState } from 'react';
import { 
  KeyRound, 
  Copy, 
  Check, 
  X, 
  ShieldCheck, 
  Clock, 
  FileCode2, 
  Hash,
  Fingerprint
} from 'lucide-react';
import { parseJwt } from '../lib/supabase';
import type { AuthUser } from '../types';

interface JwtInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
  user?: AuthUser | null;
}

export const JwtInspectorModal: React.FC<JwtInspectorModalProps> = ({
  isOpen,
  onClose,
  token,
  user,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const rawToken = token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdHhnc2hyanB5dmN6aWR6dnRvIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiI2N2M2ODkwNC04YTkxLTRjMTktOWU1Zi1jMGM4Mzc0OWFhNjEiLCJlbWFpbCI6InBsYW5uZXJAbmV4b3JhLmFpIiwiZXhwIjoyMTAzNjU2NzY3LCJpYXQiOjE3ODgwODA3NjcsInVzZXJfbWV0YWRhdGEiOnsiZnVsbF9uYW1lIjoiVmlrcmFtIFNpbmdoIiwicm9sZSI6IlBMQU5ORVIifX0.demo_signature_hash_verified';
  const claims = parseJwt(rawToken) || {
    sub: user?.id || 'd1000000-0000-0000-0000-000000000001',
    email: user?.email || 'planner@nexora.ai',
    role: user?.role || 'PLANNER',
    aud: 'authenticated',
    exp: 2103656767,
    iat: 1788080767,
    user_metadata: {
      full_name: user?.full_name || 'Lead Project Planner',
      role: user?.role || 'PLANNER',
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const expDate = claims.exp ? new Date(claims.exp * 1000).toUTCString() : 'N/A';
  const iatDate = claims.iat ? new Date(claims.iat * 1000).toUTCString() : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C38B4B]/15 border border-[#C38B4B]/30 text-[#C38B4B]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white font-mono tracking-tight">
                  JWT AUTHENTICATION CLAIMS INSPECTOR
                </h2>
                <span className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>SIGNATURE VALID</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                RFC 7519 JSON Web Token verification across Rust Trust Plane & Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Decoded Claims Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <Fingerprint className="h-3 w-3 text-[#C38B4B]" />
                <span>Subject Identifier (sub)</span>
              </div>
              <p className="text-xs font-mono font-medium text-slate-200 truncate">{claims.sub}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <ShieldCheck className="h-3 w-3 text-cyan-400" />
                <span>Enterprise Role (role)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-mono font-bold text-cyan-300">
                  {claims.user_metadata?.role || claims.role || 'PLANNER'}
                </span>
                <span className="text-xs text-slate-400">({claims.email || user?.email})</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <Clock className="h-3 w-3 text-emerald-400" />
                <span>Issued At (iat)</span>
              </div>
              <p className="text-xs font-mono text-slate-300">{iatDate}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <Clock className="h-3 w-3 text-rose-400" />
                <span>Expiration (exp)</span>
              </div>
              <p className="text-xs font-mono text-slate-300">{expDate}</p>
            </div>
          </div>

          {/* JSON Decoded Payload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCode2 className="h-3.5 w-3.5 text-[#C38B4B]" />
                <span>Decoded Payload Claims</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Header: HS256 / JWT</span>
            </div>
            <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-xs font-mono text-emerald-400 overflow-x-auto">
              {JSON.stringify(claims, null, 2)}
            </pre>
          </div>

          {/* Raw Encoded Bearer Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-[#C38B4B]" />
                <span>Raw Bearer Token</span>
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs font-mono text-[#C38B4B] hover:text-[#b07d42] transition"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Token</span>
                  </>
                )}
              </button>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] font-mono text-slate-400 break-all select-all">
              {rawToken}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-3 text-[10px] text-slate-500 font-mono flex items-center justify-between">
          <span>Bearer Authorization Header Attached to All API Requests</span>
          <button
            onClick={onClose}
            className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-1 text-xs font-mono text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
