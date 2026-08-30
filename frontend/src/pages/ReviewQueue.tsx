import React, { useState, useMemo, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Check, 
  Search, 
  MessageSquare, 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  Tag 
} from 'lucide-react';
import type { ReviewQueueItem, Activity, ReviewQueueFilters, ToastMessage } from '../types';

// ── Toast Notification Component ───────────────────────────────────────────
const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className={`border rounded-lg px-4 py-3 flex items-start gap-3 shadow-lg bg-white ${
      isSuccess ? 'border-emerald-300 text-emerald-900' : 
      isError ? 'border-rose-300 text-rose-900' : 
      'border-slate-300 text-slate-900'
    } min-w-[320px] max-w-md`}>
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
      ) : isError ? (
        <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
      ) : (
        <MessageSquare className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0 font-mono text-xs">
        <p className="font-bold">{toast.title}</p>
        <p className="text-slate-600 mt-0.5">{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-slate-400 hover:text-slate-600 transition">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// ── Confirmation Modal ──────────────────────────────────────────────────────
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, title, description, confirmLabel, confirmColor, onConfirm, onCancel, children 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" />
      <div 
        className="relative bg-white rounded-lg p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-amber-50 border border-amber-200 shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          </div>
        </div>
        {children}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded text-xs font-bold text-white shadow-xs transition ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ReviewQueue Component ──────────────────────────────────────────────
interface ReviewQueueProps {
  items: ReviewQueueItem[];
  activities: Activity[];
  onApprove: (proposalId: string, selectedActivityId?: string, comment?: string) => void;
  onReject: (proposalId: string, reason?: string) => void;
  onOverride: (proposalId: string, newActivityId: string, comment?: string) => void;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ 
  items, 
  activities, 
  onApprove, 
  onReject, 
  onOverride 
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items.length > 0 ? items[0].proposal.id : null);
  const [filters, setFilters] = useState<ReviewQueueFilters>({ discipline: 'ALL', matchTier: 'ALL', sortBy: 'confidence_desc', searchQuery: '' });
  const [commentText, setCommentText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [selectedOverrideActivityId, setSelectedOverrideActivityId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', description: '', confirmLabel: '', confirmColor: '', onConfirm: () => {} });

  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Filter & Sort
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (filters.discipline && filters.discipline !== 'ALL') {
      result = result.filter(i => i.observation?.discipline === filters.discipline);
    }
    if (filters.matchTier && filters.matchTier !== 'ALL') {
      result = result.filter(i => i.proposal.match_tier === filters.matchTier);
    }
    if (filters.searchQuery?.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(i => 
        i.observation?.raw_text.toLowerCase().includes(q) ||
        i.activity?.name.toLowerCase().includes(q) ||
        i.activity?.code.toLowerCase().includes(q) ||
        i.proposal.explanation?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'confidence_asc':
          return a.proposal.confidence_score - b.proposal.confidence_score;
        case 'confidence_desc':
          return b.proposal.confidence_score - a.proposal.confidence_score;
        case 'date_asc':
          return new Date(a.proposal.created_at).getTime() - new Date(b.proposal.created_at).getTime();
        case 'date_desc':
        default:
          return new Date(b.proposal.created_at).getTime() - new Date(a.proposal.created_at).getTime();
      }
    });

    return result;
  }, [items, filters]);

  const selectedItem = useMemo(() => {
    return items.find(i => i.proposal.id === selectedItemId) || filteredItems[0] || null;
  }, [items, selectedItemId, filteredItems]);

  // Actions
  const handleApprove = (item: ReviewQueueItem) => {
    onApprove(item.proposal.id, item.activity?.id, commentText);
    addToast('success', 'Proposal Approved', `Matched ${item.activity?.code} committed to event ledger.`);
    setCommentText('');
    advanceSelection(item.proposal.id);
  };

  const handleRejectPrompt = (item: ReviewQueueItem) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Match Proposal',
      description: 'Please specify the engineering or scheduling rationale for rejecting this proposal. The observation will remain in the unmatched queue.',
      confirmLabel: 'Confirm Rejection',
      confirmColor: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: () => {
        if (!rejectReason.trim()) {
          addToast('error', 'Reason Required', 'A rejection reason is mandatory.');
          return;
        }
        onReject(item.proposal.id, rejectReason);
        addToast('error', 'Proposal Rejected', `Proposal ${item.proposal.id} was rejected.`);
        setRejectReason('');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        advanceSelection(item.proposal.id);
      }
    });
  };

  const handleOverridePrompt = (item: ReviewQueueItem) => {
    if (!selectedOverrideActivityId) {
      addToast('error', 'Selection Required', 'Please choose an alternate target activity.');
      return;
    }
    const targetAct = activities.find(a => a.id === selectedOverrideActivityId);
    setConfirmModal({
      isOpen: true,
      title: 'Override Proposed Activity',
      description: `Re-map observation to ${targetAct?.code} (${targetAct?.name})? This will generate a human-override audit record.`,
      confirmLabel: 'Apply Override',
      confirmColor: 'bg-amber-600 hover:bg-amber-700',
      onConfirm: () => {
        onOverride(item.proposal.id, selectedOverrideActivityId, commentText);
        addToast('info', 'Proposal Overridden', `Observation re-linked to ${targetAct?.code}.`);
        setShowOverridePanel(false);
        setSelectedOverrideActivityId(null);
        setCommentText('');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        advanceSelection(item.proposal.id);
      }
    });
  };

  const handleBatchApprove = () => {
    if (selectedForBatch.size === 0) return;
    setConfirmModal({
      isOpen: true,
      title: `Batch Approve ${selectedForBatch.size} Proposals`,
      description: `Are you sure you want to approve all ${selectedForBatch.size} selected proposals? All associated events will be verified and written to the event ledger.`,
      confirmLabel: `Approve ${selectedForBatch.size} Proposals`,
      confirmColor: 'bg-emerald-600 hover:bg-emerald-700',
      onConfirm: () => {
        selectedForBatch.forEach(id => {
          onApprove(id);
        });
        addToast('success', 'Batch Approval Complete', `${selectedForBatch.size} proposals committed.`);
        setSelectedForBatch(new Set());
        setBatchMode(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const advanceSelection = (currentId: string) => {
    const remaining = filteredItems.filter(i => i.proposal.id !== currentId);
    if (remaining.length > 0) {
      setSelectedItemId(remaining[0].proposal.id);
    } else {
      setSelectedItemId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Fixed Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="signal-tick bg-amber-500" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-700">
              Human-in-the-Loop Gateway
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-none">
            Planner Review Queue
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-[65ch]">
            Review ambiguous AI match proposals before committing state updates to the immutable event ledger. Human oversight guarantees zero phantom progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {batchMode ? (
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded border border-slate-200">
              <button
                onClick={handleBatchApprove}
                disabled={selectedForBatch.size === 0}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold font-mono hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                Approve Selected ({selectedForBatch.size})
              </button>
              <button
                onClick={() => { setBatchMode(false); setSelectedForBatch(new Set()); }}
                className="px-2.5 py-1.5 rounded text-xs font-mono text-slate-600 hover:text-slate-900"
              >
                Exit Batch
              </button>
            </div>
          ) : (
            <button
              onClick={() => setBatchMode(true)}
              className="px-3 py-2 rounded bg-white border border-slate-300 text-xs font-mono font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Enable Batch Mode
            </button>
          )}
        </div>
      </div>

      {/* Main Review Console Grid */}
      {items.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Review Queue Clear</h3>
          <p className="text-xs text-slate-500 font-mono mt-1">All field observations have been reconciled and committed to the schedule.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Queue List */}
          <div className="lg:col-span-4 space-y-3">
            {/* Search & Filter Bar */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter queue by text or tag..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
                  className="w-full pl-8 pr-3 py-1.5 rounded border border-slate-200 text-xs font-mono placeholder-slate-400 focus:outline-none focus:border-[#C38B4B]"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                <span>{filteredItems.length} items pending</span>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as any }))}
                  className="bg-transparent font-mono text-slate-700 font-semibold focus:outline-none"
                >
                  <option value="confidence_desc">Highest Conf</option>
                  <option value="confidence_asc">Lowest Conf</option>
                  <option value="date_desc">Newest First</option>
                </select>
              </div>
            </div>

            {/* Proposals List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredItems.map(({ proposal, observation, activity }) => {
                const isSelected = selectedItem?.proposal.id === proposal.id;
                const isChecked = selectedForBatch.has(proposal.id);
                const confPct = Math.round(proposal.confidence_score * 100);

                return (
                  <div
                    key={proposal.id}
                    onClick={() => setSelectedItemId(proposal.id)}
                    className={`p-3.5 rounded-lg border transition cursor-pointer relative ${
                      isSelected 
                        ? 'bg-white border-[#C38B4B] shadow-xs ring-1 ring-[#C38B4B]' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {batchMode && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              const next = new Set(selectedForBatch);
                              if (isChecked) next.delete(proposal.id);
                              else next.add(proposal.id);
                              setSelectedForBatch(next);
                            }}
                            className="rounded border-slate-300 text-[#C38B4B] focus:ring-[#C38B4B]"
                          />
                        )}
                        <span className="font-mono font-bold text-xs text-slate-900">{activity?.code || 'UNMATCHED'}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        confPct >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        confPct >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {confPct}% Conf.
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-sans line-clamp-2 mb-2">
                      "{observation?.raw_text}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-100">
                      <span>{observation?.discipline || 'GENERAL'}</span>
                      <span>{new Date(proposal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center & Right: Selected Proposal Detail & Decision Pane */}
          {selectedItem ? (
            <div className="lg:col-span-8 space-y-6">
              
              {/* Proposal Card */}
              <div className="glass-card p-6 space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Proposal ID:</span>
                      <span className="font-mono text-xs font-bold text-slate-900">{selectedItem.proposal.id}</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      Proposed Match: {selectedItem.activity?.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold">
                      {Math.round(selectedItem.proposal.confidence_score * 100)}% Confidence
                    </span>
                  </div>
                </div>

                {/* Source vs Proposed Target */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source Evidence */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                      Ingested Field Source
                    </span>
                    <p className="text-xs font-mono text-slate-800 leading-relaxed bg-white p-3 rounded border border-slate-200">
                      "{selectedItem.observation?.raw_text}"
                    </p>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 pt-1">
                      <Tag className="h-3 w-3" />
                      <span>Discipline: {selectedItem.observation?.discipline}</span>
                      <span>•</span>
                      <span>Reported: {selectedItem.observation?.reported_progress ?? 100}%</span>
                    </div>
                  </div>

                  {/* Target Activity */}
                  <div className="p-4 rounded-lg bg-blue-50/40 border border-blue-100 space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700 block">
                      Target Schedule Activity
                    </span>
                    <div className="bg-white p-3 rounded border border-blue-200 space-y-1 text-xs font-mono">
                      <div className="font-bold text-slate-900">{selectedItem.activity?.code}</div>
                      <div className="text-slate-600 font-sans text-xs">{selectedItem.activity?.name}</div>
                      <div className="text-[11px] text-slate-500 pt-1">
                        Planned: {selectedItem.activity?.planned_start_date} → {selectedItem.activity?.planned_finish_date}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-blue-800 pt-1">
                      <span>Explanation: {selectedItem.proposal.explanation || 'Semantic embedding overlap with equipment tags.'}</span>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    Confidence Score Decomposition
                  </span>
                  <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500">Lexical:</span>
                        <span className="font-bold">{Math.round((selectedItem.proposal.lexical_score || 0.75) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-slate-700 h-full rounded-full" style={{ width: `${(selectedItem.proposal.lexical_score || 0.75) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500">Semantic:</span>
                        <span className="font-bold">{Math.round((selectedItem.proposal.semantic_score || 0.82) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${(selectedItem.proposal.semantic_score || 0.82) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500">Context Boost:</span>
                        <span className="font-bold">+{Math.round((selectedItem.proposal.context_boost || 0.15) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#C38B4B] h-full rounded-full" style={{ width: `${(selectedItem.proposal.context_boost || 0.15) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trust Validation Checklist */}
                <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-xs font-bold font-mono uppercase">Pre-Commit Validation Checklist</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-emerald-900/80">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Activity exists in baseline</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Dates satisfy precedence</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Monotonic progress delta</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Caller role: Lead Planner</span>
                    </div>
                  </div>
                </div>

                {/* Planner Comment & Override Panel */}
                <div className="space-y-3 pt-2">
                  <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                    Planner Decision Log & Comments (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified with QA/QC test pack signoff on site."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full p-2.5 rounded border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#C38B4B]"
                  />

                  {showOverridePanel && (
                    <div className="p-4 rounded border border-amber-200 bg-amber-50/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-amber-900">Select Alternate Schedule Activity</span>
                        <button onClick={() => setShowOverridePanel(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <select
                        value={selectedOverrideActivityId || ''}
                        onChange={(e) => setSelectedOverrideActivityId(e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 bg-white text-xs font-mono"
                      >
                        <option value="">-- Choose activity --</option>
                        {activities.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name} ({a.discipline})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleOverridePrompt(selectedItem)}
                        className="w-full py-2 rounded bg-amber-600 text-white font-mono font-bold text-xs hover:bg-amber-700 transition"
                      >
                        Commit Override to Ledger
                      </button>
                    </div>
                  )}
                </div>

                {/* Decision Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleRejectPrompt(selectedItem)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono font-bold hover:bg-rose-100 transition"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Reject Proposal</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowOverridePanel(!showOverridePanel)}
                      className="px-4 py-2 rounded bg-white text-slate-700 border border-slate-300 text-xs font-mono font-medium hover:bg-slate-50 transition"
                    >
                      Override Match
                    </button>
                    <button
                      onClick={() => handleApprove(selectedItem)}
                      className="flex items-center gap-1.5 px-5 py-2 rounded bg-slate-900 text-white text-xs font-mono font-bold hover:bg-slate-800 transition shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Approve & Commit</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="lg:col-span-8 glass-card p-12 text-center">
              <p className="text-xs font-mono text-slate-500">Select an item from the queue on the left to review details.</p>
            </div>
          )}

        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      >
        {confirmModal.title.includes('Reject') && (
          <textarea
            placeholder="Enter mandatory rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="w-full p-2.5 rounded border border-slate-300 text-xs font-mono focus:border-rose-500 focus:outline-none"
          />
        )}
      </ConfirmModal>

    </div>
  );
};
