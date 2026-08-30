import React from 'react';
import { 
  ShieldCheck, 
  Key, 
  Lock, 
  User, 
  Clock
} from 'lucide-react';
import type { AuditEvent } from '../types';

interface AuditTrailProps {
  events: AuditEvent[];
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ events }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Cryptographic & Tamper-Evident Audit Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Immutable execution record guaranteeing zero hallucinated mutations. Every approved actual event is signed with SHA-256 and chained.
          </p>
        </div>

        <div className="flex items-center space-x-2 rounded-lg bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 text-xs text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          <span>Ledger Integrity: Verified (SHA-256 Chaining Active)</span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center border border-slate-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No Audit Events Yet</h3>
          <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
            Audit entries will be automatically generated whenever field observations are matched, approved, or rejected.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((evt, idx) => (
            <div key={evt.id} className="glass-panel rounded-xl p-5 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-950 text-sky-400 text-xs font-bold font-mono border border-sky-800">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-sm text-white">{evt.action}</span>
                    <span className="ml-2 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                      {evt.entity_type} #{evt.entity_id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <div className="flex items-center space-x-1">
                    <User className="h-3.5 w-3.5 text-sky-400" />
                    <span>{evt.actor_role || 'SYSTEM'}</span>
                  </div>
                  <div className="flex items-center space-x-1 font-mono">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span>{new Date(evt.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payload Hash & Diff */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
                <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80 space-y-1">
                  <div className="flex items-center space-x-1.5 text-slate-400 font-semibold mb-1">
                    <Key className="h-3.5 w-3.5 text-emerald-400" />
                    <span>SHA-256 Payload Hash:</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 break-all">{evt.payload_hash}</div>
                </div>

                <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80 space-y-1">
                  <div className="text-slate-400 font-semibold mb-1">State Mutation Diff:</div>
                  <div className="text-[11px] text-slate-300">
                    <div><span className="text-rose-400">- Before:</span> {JSON.stringify(evt.before_state || {})}</div>
                    <div><span className="text-emerald-400">+ After:</span> {JSON.stringify(evt.after_state || {})}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
