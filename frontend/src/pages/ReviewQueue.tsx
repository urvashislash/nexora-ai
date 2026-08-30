import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ShieldAlert,
  Check
} from 'lucide-react';
import type { ReviewQueueItem } from '../types';

interface ReviewQueueProps {
  items: ReviewQueueItem[];
  onApprove: (proposalId: string, selectedActivityId?: string) => void;
  onReject: (proposalId: string, reason?: string) => void;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ items, onApprove, onReject }) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items.length > 0 ? items[0].proposal.id : null);
  const [selectedAlternativeId] = useState<string | null>(null);

  const currentItem = items.find(i => i.proposal.id === selectedItemId) || items[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Planner Review & Evidence Verification Queue
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Review ambiguous candidate mappings, inspect source document evidence, and approve validated actual progress events.
          </p>
        </div>

        <div className="flex items-center space-x-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="font-bold text-amber-400">{items.length}</span> Proposals Pending Planner Decision
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center border border-slate-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Review Queue is Clear!</h3>
          <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
            All high-confidence observations have been auto-linked or verified by the Rust Trust Plane.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Queue List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Pending Items ({items.length})
            </h3>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {items.map((item) => {
                const isSelected = (currentItem?.proposal.id === item.proposal.id);
                const confidence = (item.proposal.confidence_score * 100).toFixed(0);

                return (
                  <div
                    key={item.proposal.id}
                    onClick={() => {
                      setSelectedItemId(item.proposal.id);
                    }}
                    className={`glass-card rounded-xl p-4 cursor-pointer transition border ${
                      isSelected 
                        ? 'border-sky-500 bg-slate-800/90 shadow-lg shadow-sky-500/10' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-sky-400">
                        {item.activity?.code || 'UNASSIGNED'}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        item.proposal.confidence_score >= 0.88 ? 'bg-emerald-950 text-emerald-400' :
                        item.proposal.confidence_score >= 0.60 ? 'bg-amber-950 text-amber-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {confidence}% Match
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium line-clamp-2 mb-2">
                      "{item.observation?.raw_text}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/50">
                      <span>{item.observation?.discipline || 'GENERAL'}</span>
                      <span className="font-mono">{new Date(item.proposal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Evidence & Decision Panel (8 cols) */}
          {currentItem && (
            <div className="lg:col-span-8 glass-panel rounded-xl p-6 border border-slate-800 space-y-6">
              {/* Evidence Banner */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Observation #{currentItem.observation?.id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-slate-400">
                    Received from {currentItem.observation?.discipline || 'Field'} Supervisor
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  "{currentItem.observation?.raw_text}"
                </h2>
                {currentItem.observation?.normalized_text && (
                  <div className="mt-2 rounded-md bg-slate-900/80 p-2 text-xs font-mono text-slate-300 border border-slate-800">
                    <span className="text-sky-400 font-bold">Normalized Terminology:</span> {currentItem.observation.normalized_text}
                  </div>
                )}
              </div>

              {/* Matched Schedule Activity Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-900/60 p-4 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Target Baseline Activity
                  </div>
                  <div className="font-mono text-base font-bold text-sky-400">
                    {currentItem.activity?.code}
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {currentItem.activity?.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentItem.activity?.description}
                  </div>
                  <div className="pt-2 text-xs text-slate-300 font-mono">
                    Planned: {currentItem.activity?.planned_start_date} → {currentItem.activity?.planned_finish_date}
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="rounded-xl bg-slate-900/60 p-4 border border-slate-800 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Hybrid Confidence Breakdown
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Lexical / Tag Match (40%)</span>
                      <span className="font-bold text-white">{(currentItem.proposal.lexical_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500" style={{ width: `${currentItem.proposal.lexical_score * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Semantic Vector Cosine (45%)</span>
                      <span className="font-bold text-white">{(currentItem.proposal.semantic_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${currentItem.proposal.semantic_score * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Contextual Boost (15%)</span>
                      <span className="font-bold text-white">{(currentItem.proposal.context_boost * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, currentItem.proposal.context_boost * 333)}%` }} />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between items-center text-xs font-bold border-t border-slate-800">
                    <span className="text-slate-300">Combined Confidence:</span>
                    <span className="text-base text-amber-400 font-mono">{(currentItem.proposal.confidence_score * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Action Decision Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-emerald-400" />
                  <span>Approved events are irreversibly committed by Rust into the PostgreSQL Event Ledger.</span>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <button
                    onClick={() => onReject(currentItem.proposal.id, "Rejected by planner")}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-rose-400 border border-rose-900/40 hover:bg-rose-950/40 transition"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Reject Proposal</span>
                  </button>

                  <button
                    onClick={() => onApprove(currentItem.proposal.id, selectedAlternativeId || undefined)}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Approve & Commit to Ledger</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
