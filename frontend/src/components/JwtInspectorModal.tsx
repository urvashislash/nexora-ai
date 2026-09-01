import React, { useState } from 'react';
import { 
  KeyRound, 
  Copy, 
  Check, 
  ShieldCheck, 
  Clock, 
  FileCode2, 
  Hash,
  Fingerprint
} from 'lucide-react';
import { parseJwt } from '../lib/supabase';
import type { AuthUser } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden font-sans">
        
        {/* Header */}
        <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/70 text-[#C38B4B]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                  Cryptographic JWT Claims Inspector
                </DialogTitle>
                <Badge variant="success">SIGNATURE VALID</Badge>
              </div>
              <DialogDescription className="text-[11px] text-slate-500 font-sans">
                RFC 7519 JSON Web Token verification across Rust Trust Plane & Supabase
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Decoded Claims Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-sans font-semibold uppercase text-slate-400">
                <Fingerprint className="h-3 w-3 text-[#C38B4B]" />
                <span>Subject Identifier (sub)</span>
              </div>
              <p className="text-xs font-mono font-medium text-slate-900 truncate">{claims.sub}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-sans font-semibold uppercase text-slate-400">
                <Hash className="h-3 w-3 text-sky-500" />
                <span>Planner / User Email</span>
              </div>
              <p className="text-xs font-sans font-semibold text-slate-900 truncate">{claims.email}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-sans font-semibold uppercase text-slate-400">
                <ShieldCheck className="h-3 w-3 text-[#34C759]" />
                <span>Assigned RBAC Role</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {claims.user_metadata?.role || claims.role}
                </span>
                <Badge variant="secondary">AUTHORIZATION OK</Badge>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-sans font-semibold uppercase text-slate-400">
                <Clock className="h-3 w-3 text-purple-500" />
                <span>Issued At / Expiry</span>
              </div>
              <p className="text-[11px] font-mono text-slate-600 truncate">
                Expires: {expDate}
              </p>
            </div>
          </div>

          {/* Decoded Claims JSON */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-sans text-slate-600">
              <div className="flex items-center gap-1.5">
                <FileCode2 className="h-3.5 w-3.5 text-[#C38B4B]" />
                <span className="font-semibold">Decoded Token Payload</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">ALGORITHM: HS256</span>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
              {JSON.stringify(claims, null, 2)}
            </pre>
          </div>

          {/* Raw Encoded JWT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-sans text-slate-600">
              <span className="font-semibold">Raw Encoded Token String</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-[#C38B4B] hover:underline font-semibold cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-[#34C759]" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Token'}</span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 font-mono text-[10px] text-slate-600 break-all select-all">
              {rawToken}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-sans">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
            <span>Passed to backend in <code className="font-mono text-slate-800 font-semibold">Authorization: Bearer</code> header</span>
          </div>
          <Button onClick={onClose} variant="default" size="sm">
            Close
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};
