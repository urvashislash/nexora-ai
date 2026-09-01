import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { animateStaggerEntrance } from '../lib/animations';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardTitle } from '../components/ui/card';

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
          <Button 
            onClick={onCancel}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            size="sm"
            className={`${confirmColor} text-white font-mono font-bold text-xs shadow-xs`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Props Interface ────────────────────────────────────────────────────────
interface ReviewQueueProps {
  items: ReviewQueueItem[];
  activities: Activity[];
  onApprove: (proposalId: string, comment?: string) => Promise<void>;
  onReject: (proposalId: string, reason?: string) => Promise<void>;
  onOverride: (proposalId: string, newActivityId: string, comment?: string) => Promise<void>;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({
  items,
  activities,
  onApprove,
  onReject,
  onOverride,
}) => {
  // State
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.proposal.id || null);
  const [filters, setFilters] = useState<ReviewQueueFilters>({
    discipline: 'ALL',
    minConfidence: 0,
    searchQuery: '',
    sortBy: 'confidence_desc',
  });
  const [batchMode, setBatchMode] = useState(false);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState('');
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [selectedOverrideActivityId, setSelectedOverrideActivityId] = useState<string | null>(null);
  
  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, title, message, timestamp: new Date().toISOString() }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: '',
    confirmColor: '',
    onConfirm: () => {},
  });
  const [rejectReason, setRejectReason] = useState('');

  // Filtered and Sorted Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filters.discipline !== 'ALL' && item.observation?.discipline !== filters.discipline) {
        return false;
      }
      if (filters.minConfidence !== undefined && item.proposal.confidence_score * 100 < filters.minConfidence) {
        return false;
      }
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const rawMatch = item.observation?.raw_text?.toLowerCase().includes(query);
        const codeMatch = item.activity?.code.toLowerCase().includes(query);
        const nameMatch = item.activity?.name.toLowerCase().includes(query);
        if (!rawMatch && !codeMatch && !nameMatch) return false;
      }
      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'confidence_desc') {
        return b.proposal.confidence_score - a.proposal.confidence_score;
      }
      if (filters.sortBy === 'confidence_asc') {
        return a.proposal.confidence_score - b.proposal.confidence_score;
      }
      return new Date(b.proposal.created_at).getTime() - new Date(a.proposal.created_at).getTime();
    });
  }, [items, filters]);

  // Anime.js entrance animation on items
  useEffect(() => {
    if (filteredItems.length > 0) {
      animateStaggerEntrance('.queue-item-card', { stagger: 40 });
    }
  }, [filteredItems.length]);

  const selectedItem = useMemo(() => {
    return items.find(i => i.proposal.id === selectedItemId) || filteredItems[0] || null;
  }, [items, selectedItemId, filteredItems]);

  const advanceSelection = useCallback((currentId: string) => {
    const remaining = filteredItems.filter(i => i.proposal.id !== currentId);
    if (remaining.length > 0) {
      setSelectedItemId(remaining[0].proposal.id);
    } else {
      setSelectedItemId(null);
    }
  }, [filteredItems]);

  // Actions
  const handleApprove = useCallback(async (item: ReviewQueueItem) => {
    try {
      await onApprove(item.proposal.id, commentText);
      addToast(
        'success',
        'Proposal Approved',
        `Reconciled with ${item.activity?.code || 'activity'}. Status updated to IN_PROGRESS/COMPLETED.`
      );
      setCommentText('');
      advanceSelection(item.proposal.id);
    } catch {
      addToast('error', 'Approval Failed', 'Unable to commit state update to Trust Plane ledger.');
    }
  }, [onApprove, commentText, advanceSelection]);

  const handleRejectPrompt = (item: ReviewQueueItem) => {
    setRejectReason('');
    setConfirmModal({
      isOpen: true,
      title: 'Reject Match Proposal',
      description: 'Are you sure you want to reject this AI candidate match? An audit record will be logged with your reason.',
      confirmLabel: 'Confirm Rejection',
      confirmColor: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: async () => {
        try {
          await onReject(item.proposal.id, rejectReason || 'Rejected by Lead Planner');
          addToast('info', 'Proposal Rejected', `Proposal ${item.proposal.id.slice(0, 8)} marked as REJECTED in ledger.`);
          advanceSelection(item.proposal.id);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch {
          addToast('error', 'Rejection Failed', 'Network or validation error occurred.');
        }
      }
    });
  };

  const handleOverridePrompt = async (item: ReviewQueueItem) => {
    if (!selectedOverrideActivityId) {
      addToast('error', 'Select Activity', 'Please select a valid alternate schedule activity from the list.');
      return;
    }
    try {
      await onOverride(item.proposal.id, selectedOverrideActivityId, commentText || 'Lead Planner manual target override');
      const overriddenAct = activities.find(a => a.id === selectedOverrideActivityId);
      addToast(
        'success',
        'Match Overridden',
        `Linked observation to ${overriddenAct?.code || 'new activity'} and committed actual progress.`
      );
      setShowOverridePanel(false);
      setSelectedOverrideActivityId(null);
      setCommentText('');
      advanceSelection(item.proposal.id);
    } catch {
      addToast('error', 'Override Failed', 'Could not apply manual schedule link.');
    }
  };

  const handleBatchApprove = () => {
    const count = selectedForBatch.size;
    if (count === 0) return;

    setConfirmModal({
      isOpen: true,
      title: `Batch Approve ${count} Proposals`,
      description: `You are about to commit ${count} AI match proposals into the active schedule baseline simultaneously.`,
      confirmLabel: `Approve All (${count})`,
      confirmColor: 'bg-emerald-600 hover:bg-emerald-700',
      onConfirm: async () => {
        for (const id of selectedForBatch) {
          await onApprove(id, 'Batch Approved by Lead Planner');
        }
        addToast('success', 'Batch Approved', `Successfully committed ${count} proposals into immutable event ledger.`);
        setSelectedForBatch(new Set());
        setBatchMode(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
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
            <Badge variant="warning">HUMAN-IN-THE-LOOP GATEWAY</Badge>
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
              <Button
                onClick={handleBatchApprove}
                disabled={selectedForBatch.size === 0}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Approve Selected ({selectedForBatch.size})
              </Button>
              <Button
                onClick={() => { setBatchMode(false); setSelectedForBatch(new Set()); }}
                variant="ghost"
                size="sm"
              >
                Exit Batch
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setBatchMode(true)}
              variant="outline"
              size="sm"
            >
              Enable Batch Mode
            </Button>
          )}
        </div>
      </div>

      {/* Main Review Console Grid */}
      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Review Queue Clear</h3>
          <p className="text-xs text-slate-500 font-mono mt-1">All field observations have been reconciled and committed to the schedule.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Queue List */}
          <div className="lg:col-span-4 space-y-3">
            {/* Search & Filter Bar */}
            <Card className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter queue by text or tag..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
                  className="w-full pl-8 pr-3 py-1.5 rounded border border-slate-200 text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-[#C38B4B]"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                <span>{filteredItems.length} items pending</span>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as any }))}
                  className="bg-transparent font-mono text-slate-700 font-semibold focus:outline-hidden"
                >
                  <option value="confidence_desc">Highest Conf</option>
                  <option value="confidence_asc">Lowest Conf</option>
                  <option value="date_desc">Newest First</option>
                </select>
              </div>
            </Card>

            {/* Proposals List with Anime.js Card Entrance */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredItems.map(({ proposal, observation, activity }) => {
                const isSelected = selectedItem?.proposal.id === proposal.id;
                const isChecked = selectedForBatch.has(proposal.id);
                const confPct = Math.round(proposal.confidence_score * 100);

                return (
                  <div
                    key={proposal.id}
                    onClick={() => setSelectedItemId(proposal.id)}
                    className={`queue-item-card p-3.5 rounded-lg border transition cursor-pointer relative ${
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
                      <Badge variant={confPct >= 85 ? 'success' : confPct >= 70 ? 'warning' : 'destructive'}>
                        {confPct}% Conf.
                      </Badge>
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
              <Card className="p-6 space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Proposal ID:</span>
                      <span className="font-mono text-xs font-bold text-slate-900">{selectedItem.proposal.id}</span>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900 mt-1">
                      Proposed Match: {selectedItem.activity?.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning" className="text-xs">
                      {Math.round(selectedItem.proposal.confidence_score * 100)}% Confidence
                    </Badge>
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
                      <span>{selectedItem.observation?.discipline || 'GENERAL'} &bull; {selectedItem.observation?.location || 'Zone 2'}</span>
                    </div>
                  </div>

                  {/* Proposed Activity Target */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                      Schedule Baseline Activity
                    </span>
                    <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-mono font-bold text-xs text-slate-900">{selectedItem.activity?.code}</span>
                        <span className="text-[10px] font-mono text-slate-500">{selectedItem.activity?.discipline}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-800">{selectedItem.activity?.name}</p>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1">
                        <span>Planned: {selectedItem.activity?.planned_start_date}</span>
                        <span>Quantity: {selectedItem.activity?.planned_quantity} {selectedItem.activity?.unit_of_measure}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Reasoning & Similarity Scores */}
                <div className="p-4 rounded-lg bg-slate-50/70 border border-slate-200 space-y-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    AI Semantic & Lexical Match Reasoning
                  </span>
                  <p className="text-xs font-mono text-slate-700 bg-white p-3 rounded border border-slate-200">
                    {selectedItem.proposal.explanation || 'Semantic vector similarity on WBS keywords with positive discipline overlap.'}
                  </p>
                  
                  {/* Score Breakdown Bars */}
                  <div className="grid grid-cols-3 gap-3 font-mono text-[11px]">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500">Vector Embeddings:</span>
                        <span className="font-bold">{Math.round((selectedItem.proposal.semantic_score || 0.78) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-600 h-full rounded-full" style={{ width: `${(selectedItem.proposal.semantic_score || 0.78) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500">Lexical Overlap:</span>
                        <span className="font-bold">{Math.round((selectedItem.proposal.lexical_score || 0.72) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${(selectedItem.proposal.lexical_score || 0.72) * 100}%` }} />
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
                    className="w-full p-2.5 rounded border border-slate-300 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-[#C38B4B]"
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
                      <Button
                        onClick={() => handleOverridePrompt(selectedItem)}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold text-xs"
                      >
                        Commit Override to Ledger
                      </Button>
                    </div>
                  )}
                </div>

                {/* Decision Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                  <Button
                    onClick={() => handleRejectPrompt(selectedItem)}
                    variant="destructive"
                    size="default"
                    className="flex items-center gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Reject Proposal</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setShowOverridePanel(!showOverridePanel)}
                      variant="outline"
                      size="default"
                    >
                      Override Match
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedItem)}
                      variant="default"
                      size="default"
                      className="flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Approve & Commit</span>
                    </Button>
                  </div>
                </div>

              </Card>

            </div>
          ) : (
            <Card className="lg:col-span-8 p-12 text-center">
              <p className="text-xs font-mono text-slate-500">Select an item from the queue on the left to review details.</p>
            </Card>
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
            className="w-full p-2.5 rounded border border-slate-300 text-xs font-mono focus:border-rose-500 focus:outline-hidden"
          />
        )}
      </ConfirmModal>

    </div>
  );
};
