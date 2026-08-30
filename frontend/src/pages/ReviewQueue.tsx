import React, { useState, useMemo, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ShieldAlert,
  Check,
  Search,
  Filter,
  ArrowUpDown,
  ArrowDownUp,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
  X,
  CheckSquare,
  Square,
  Zap,
} from 'lucide-react';
import type { ReviewQueueItem, Activity, ReviewQueueFilters, Discipline, ToastMessage } from '../types';

// ── Toast Component ─────────────────────────────────────────────────────────
const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const bgColor = toast.type === 'success' ? 'bg-emerald-950 border-emerald-700' : 
                   toast.type === 'error' ? 'bg-rose-950 border-rose-700' : 
                   'bg-sky-950 border-sky-700';
  const textColor = toast.type === 'success' ? 'text-emerald-400' : 
                     toast.type === 'error' ? 'text-rose-400' : 
                     'text-sky-400';
  const Icon = toast.type === 'success' ? CheckCircle2 : 
               toast.type === 'error' ? XCircle : 
               MessageSquare;

  return (
    <div className={`${bgColor} border rounded-xl px-4 py-3 flex items-start gap-3 shadow-2xl animate-slide-in min-w-[320px] max-w-md`}>
      <Icon className={`h-5 w-5 ${textColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${textColor}`}>{toast.title}</p>
        <p className="text-xs text-slate-300 mt-0.5">{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-slate-500 hover:text-slate-300 transition">
        <X className="h-4 w-4" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div 
        className="relative glass-panel rounded-2xl p-6 max-w-lg w-full mx-4 border border-slate-700 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{description}</p>
          </div>
        </div>
        {children}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition ${confirmColor}`}
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

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ items, activities, onApprove, onReject, onOverride }) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items.length > 0 ? items[0].proposal.id : null);
  const [filters, setFilters] = useState<ReviewQueueFilters>({ discipline: 'ALL', matchTier: 'ALL', sortBy: 'confidence_desc', searchQuery: '' });
  const [showFilters, setShowFilters] = useState(false);
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

  // ── Toast helpers ─────────────────────────────────────────────────────
  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Filtering & Sorting ───────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (filters.discipline && filters.discipline !== 'ALL') {
      result = result.filter(i => i.observation?.discipline === filters.discipline);
    }
    if (filters.matchTier && filters.matchTier !== 'ALL') {
      result = result.filter(i => i.proposal.match_tier === filters.matchTier);
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(i => 
        (i.observation?.raw_text?.toLowerCase().includes(q)) ||
        (i.activity?.code?.toLowerCase().includes(q)) ||
        (i.activity?.name?.toLowerCase().includes(q))
      );
    }

    switch (filters.sortBy) {
      case 'confidence_asc':
        result.sort((a, b) => a.proposal.confidence_score - b.proposal.confidence_score);
        break;
      case 'confidence_desc':
        result.sort((a, b) => b.proposal.confidence_score - a.proposal.confidence_score);
        break;
      case 'date_asc':
        result.sort((a, b) => new Date(a.proposal.created_at).getTime() - new Date(b.proposal.created_at).getTime());
        break;
      case 'date_desc':
        result.sort((a, b) => new Date(b.proposal.created_at).getTime() - new Date(a.proposal.created_at).getTime());
        break;
    }

    return result;
  }, [items, filters]);

  const currentItem = filteredItems.find(i => i.proposal.id === selectedItemId) || filteredItems[0];

  // ── Action handlers ───────────────────────────────────────────────────
  const handleApprove = (proposalId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Approval',
      description: `This will irreversibly commit the proposed match to the PostgreSQL Event Ledger via the Rust Trust Layer. The activity state will be updated to COMPLETED.`,
      confirmLabel: 'Approve & Commit to Ledger',
      confirmColor: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30',
      onConfirm: () => {
        onApprove(proposalId, undefined, commentText || undefined);
        addToast('success', 'Proposal Approved', `Match committed to event ledger. Activity state updated to COMPLETED.`);
        setCommentText('');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        // Select next item
        const idx = filteredItems.findIndex(i => i.proposal.id === proposalId);
        if (idx >= 0 && filteredItems.length > 1) {
          const nextIdx = idx === filteredItems.length - 1 ? 0 : idx + 1;
          setSelectedItemId(filteredItems[nextIdx].proposal.id);
        } else {
          setSelectedItemId(null);
        }
      },
    });
  };

  const handleReject = (proposalId: string) => {
    if (!rejectReason.trim()) {
      addToast('error', 'Rejection Reason Required', 'Please provide a reason for rejecting this proposal for the audit trail.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Rejection',
      description: `This will reject the proposed match and log the decision to the audit trail. The observation will remain unmatched.`,
      confirmLabel: 'Reject Proposal',
      confirmColor: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30',
      onConfirm: () => {
        onReject(proposalId, rejectReason);
        addToast('info', 'Proposal Rejected', `Match rejected. Reason logged to audit trail.`);
        setRejectReason('');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const idx = filteredItems.findIndex(i => i.proposal.id === proposalId);
        if (idx >= 0 && filteredItems.length > 1) {
          const nextIdx = idx === filteredItems.length - 1 ? 0 : idx + 1;
          setSelectedItemId(filteredItems[nextIdx].proposal.id);
        } else {
          setSelectedItemId(null);
        }
      },
    });
  };

  const handleOverride = (proposalId: string) => {
    if (!selectedOverrideActivityId) {
      addToast('error', 'Select Target Activity', 'Choose an alternative activity to override the AI match.');
      return;
    }
    const overrideActivity = activities.find(a => a.id === selectedOverrideActivityId);
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Override',
      description: `This will override the AI-proposed match and link this observation to "${overrideActivity?.code} — ${overrideActivity?.name}" instead. The event will be committed to the ledger.`,
      confirmLabel: 'Override & Commit',
      confirmColor: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30',
      onConfirm: () => {
        onOverride(proposalId, selectedOverrideActivityId!, commentText || undefined);
        addToast('success', 'Match Overridden', `Observation re-linked to ${overrideActivity?.code}. Event committed.`);
        setCommentText('');
        setSelectedOverrideActivityId(null);
        setShowOverridePanel(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const idx = filteredItems.findIndex(i => i.proposal.id === proposalId);
        if (idx >= 0 && filteredItems.length > 1) {
          const nextIdx = idx === filteredItems.length - 1 ? 0 : idx + 1;
          setSelectedItemId(filteredItems[nextIdx].proposal.id);
        } else {
          setSelectedItemId(null);
        }
      },
    });
  };

  const handleBatchApprove = () => {
    if (selectedForBatch.size === 0) {
      addToast('error', 'No Items Selected', 'Select at least one proposal to batch approve.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: `Batch Approve ${selectedForBatch.size} Proposals`,
      description: `This will approve and commit all ${selectedForBatch.size} selected proposals to the event ledger. This action is irreversible.`,
      confirmLabel: `Approve All ${selectedForBatch.size} Selected`,
      confirmColor: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30',
      onConfirm: () => {
        selectedForBatch.forEach(pid => {
          onApprove(pid);
        });
        addToast('success', 'Batch Approved', `${selectedForBatch.size} proposals committed to event ledger.`);
        setSelectedForBatch(new Set());
        setBatchMode(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const toggleBatchSelect = (proposalId: string) => {
    setSelectedForBatch(prev => {
      const next = new Set(prev);
      if (next.has(proposalId)) {
        next.delete(proposalId);
      } else {
        next.add(proposalId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedForBatch.size === filteredItems.length) {
      setSelectedForBatch(new Set());
    } else {
      setSelectedForBatch(new Set(filteredItems.map(i => i.proposal.id)));
    }
  };

  // Discipline options for filter
  const disciplineOptions: (Discipline | 'ALL')[] = ['ALL', 'CIVIL', 'PIPING', 'MECHANICAL', 'ELECTRICAL', 'INSTRUMENTATION', 'HSE', 'GENERAL'];
  const tierOptions: ('ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED')[] = ['ALL', 'HIGH', 'MEDIUM', 'LOW', 'UNMATCHED'];

  return (
    <div className="space-y-6">
      {/* Toast Container */}
      <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2">
        {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

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

        <div className="flex items-center gap-2">
          {batchMode && selectedForBatch.size > 0 && (
            <button
              onClick={handleBatchApprove}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
            >
              <Zap className="h-3.5 w-3.5" />
              Approve {selectedForBatch.size} Selected
            </button>
          )}
          <button
            onClick={() => { setBatchMode(!batchMode); setSelectedForBatch(new Set()); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition border ${
              batchMode ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            {batchMode ? 'Exit Batch' : 'Batch Mode'}
          </button>
          <div className="flex items-center space-x-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="font-bold text-amber-400">{items.length}</span> Proposals Pending
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="glass-panel rounded-xl p-3 border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by observation text or activity code..."
            value={filters.searchQuery || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition border ${
            showFilters ? 'bg-sky-950 text-sky-400 border-sky-800' : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <button
          onClick={() => setFilters(prev => ({ 
            ...prev, 
            sortBy: prev.sortBy === 'confidence_desc' ? 'confidence_asc' : 
                    prev.sortBy === 'confidence_asc' ? 'date_desc' : 
                    prev.sortBy === 'date_desc' ? 'date_asc' : 'confidence_desc'
          }))}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-700 hover:text-slate-200 transition"
        >
          {filters.sortBy?.includes('asc') ? <ArrowUpDown className="h-3.5 w-3.5" /> : <ArrowDownUp className="h-3.5 w-3.5" />}
          {filters.sortBy === 'confidence_desc' ? 'Confidence ↓' :
           filters.sortBy === 'confidence_asc' ? 'Confidence ↑' :
           filters.sortBy === 'date_desc' ? 'Newest First' : 'Oldest First'}
        </button>

        {(filters.discipline !== 'ALL' || filters.matchTier !== 'ALL' || filters.searchQuery) && (
          <button
            onClick={() => setFilters({ discipline: 'ALL', matchTier: 'ALL', sortBy: 'confidence_desc', searchQuery: '' })}
            className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-900/40 hover:bg-rose-950/60 transition"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <div className="glass-card rounded-xl p-4 border border-slate-800 flex flex-wrap gap-4 animate-slide-down">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Discipline</label>
            <div className="flex flex-wrap gap-1.5">
              {disciplineOptions.map(d => (
                <button
                  key={d}
                  onClick={() => setFilters(prev => ({ ...prev, discipline: d }))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition border ${
                    filters.discipline === d
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Confidence Tier</label>
            <div className="flex flex-wrap gap-1.5">
              {tierOptions.map(t => (
                <button
                  key={t}
                  onClick={() => setFilters(prev => ({ ...prev, matchTier: t }))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition border ${
                    filters.matchTier === t
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {filteredItems.length === 0 && items.length > 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center border border-slate-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-3">
            <Filter className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No Matching Results</h3>
          <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
            No proposals match the current filters. Try broadening your search criteria.
          </p>
        </div>
      ) : items.length === 0 ? (
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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {batchMode ? `Selected ${selectedForBatch.size} of ${filteredItems.length}` : `Pending Items (${filteredItems.length})`}
              </h3>
              {batchMode && (
                <button
                  onClick={toggleSelectAll}
                  className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition"
                >
                  {selectedForBatch.size === filteredItems.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredItems.map((item) => {
                const isSelected = (currentItem?.proposal.id === item.proposal.id);
                const isBatchSelected = selectedForBatch.has(item.proposal.id);
                const confidence = (item.proposal.confidence_score * 100).toFixed(0);

                return (
                  <div
                    key={item.proposal.id}
                    onClick={() => {
                      if (batchMode) {
                        toggleBatchSelect(item.proposal.id);
                      } else {
                        setSelectedItemId(item.proposal.id);
                        setShowOverridePanel(false);
                        setSelectedOverrideActivityId(null);
                      }
                    }}
                    className={`glass-card rounded-xl p-4 cursor-pointer transition border ${
                      batchMode && isBatchSelected
                        ? 'border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-500/10'
                        : isSelected && !batchMode
                        ? 'border-sky-500 bg-slate-800/90 shadow-lg shadow-sky-500/10' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {batchMode && (
                          isBatchSelected 
                            ? <CheckSquare className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                            : <Square className="h-4 w-4 text-slate-600 flex-shrink-0" />
                        )}
                        <span className="font-mono text-xs font-bold text-sky-400">
                          {item.activity?.code || 'UNASSIGNED'}
                        </span>
                      </div>
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
          {currentItem && !batchMode && (
            <div className="lg:col-span-8 space-y-6">
              {/* Evidence Panel */}
              <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-6">
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
                        <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${currentItem.proposal.lexical_score * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Semantic Vector Cosine (45%)</span>
                        <span className="font-bold text-white">{(currentItem.proposal.semantic_score * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${currentItem.proposal.semantic_score * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Contextual Boost (15%)</span>
                        <span className="font-bold text-white">{(currentItem.proposal.context_boost * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, currentItem.proposal.context_boost * 333)}%` }} />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-xs font-bold border-t border-slate-800">
                      <span className="text-slate-300">Combined Confidence:</span>
                      <span className="text-base text-amber-400 font-mono">{(currentItem.proposal.confidence_score * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Override Panel */}
                {showOverridePanel && (
                  <div className="rounded-xl bg-amber-950/20 p-4 border border-amber-800/40 space-y-3 animate-slide-down">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Override — Select Alternative Activity</span>
                      </div>
                      <button onClick={() => { setShowOverridePanel(false); setSelectedOverrideActivityId(null); }} className="text-slate-500 hover:text-slate-300">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                      {activities
                        .filter(a => a.id !== currentItem.activity?.id)
                        .map(a => (
                          <div
                            key={a.id}
                            onClick={() => setSelectedOverrideActivityId(a.id)}
                            className={`rounded-lg p-3 cursor-pointer transition border text-xs ${
                              selectedOverrideActivityId === a.id
                                ? 'border-amber-500 bg-amber-950/40 shadow-sm shadow-amber-500/10'
                                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-bold text-sky-400">{a.code}</span>
                              <span className="text-[10px] text-slate-400">{a.discipline}</span>
                            </div>
                            <p className="text-slate-200 font-medium">{a.name}</p>
                            <p className="text-slate-500 mt-0.5">{a.location} · {a.zone}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Comment / Rejection Reason Input */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      <MessageSquare className="h-3 w-3 inline mr-1" />
                      Planner Comment (optional for approve, required for reject)
                    </label>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add reasoning, notes, or context for the audit trail..."
                      rows={2}
                      className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-rose-400/80 mb-1.5">
                      Rejection Reason (required to reject)
                    </label>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g., Wrong discipline, Duplicate observation, Incorrect date..."
                      className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>
                </div>

                {/* Action Decision Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-emerald-400" />
                    <span>Approved events are irreversibly committed by Rust into the PostgreSQL Event Ledger.</span>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleReject(currentItem.proposal.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-rose-400 border border-rose-900/40 hover:bg-rose-950/40 transition"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => setShowOverridePanel(!showOverridePanel)}
                      className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition border ${
                        showOverridePanel
                          ? 'bg-amber-950/40 text-amber-400 border-amber-800/40'
                          : 'bg-slate-800 text-amber-400 border-amber-900/40 hover:bg-amber-950/30'
                      }`}
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Override</span>
                    </button>

                    {showOverridePanel && selectedOverrideActivityId ? (
                      <button
                        onClick={() => handleOverride(currentItem.proposal.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg bg-amber-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 transition"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span>Commit Override</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(currentItem.proposal.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Approve & Commit</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline style for animations */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in { animation: slideIn 0.3s ease-out; }
        .animate-scale-in { animation: scaleIn 0.2s ease-out; }
        .animate-slide-down { animation: slideDown 0.2s ease-out; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.5); border-radius: 2px; }
      `}</style>
    </div>
  );
};
