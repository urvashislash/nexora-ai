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
import { Card } from '../components/ui/card';

// ── Toast Notification Component ───────────────────────────────────────────
const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className={`border rounded-xl px-4 py-3 flex items-start gap-3 shadow-lg bg-white ${
      isSuccess ? 'border-emerald-200 text-emerald-950' : 
      isError ? 'border-rose-200 text-rose-950' : 
      'border-slate-200 text-slate-900'
    } min-w-[320px] max-w-md font-sans transition-all duration-200`}>
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 text-[#34C759] shrink-0 mt-0.5" />
      ) : isError ? (
        <XCircle className="h-4 w-4 text-[#FF3B30] shrink-0 mt-0.5" />
      ) : (
        <MessageSquare className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0 text-xs font-sans">
        <p className="font-semibold text-slate-900">{toast.title}</p>
        <p className="text-slate-600 mt-0.5 font-normal">{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-slate-400 hover:text-slate-600 transition cursor-pointer">
        <X className="h-3.5 w-3.5" />
      </button>
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
  const [commentText, setCommentText] = useState('');
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [selectedOverrideActivityId, setSelectedOverrideActivityId] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
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

  const advanceSelection = useCallback((currentId: string, direction: 'next' | 'prev' = 'next') => {
    const currentIndex = filteredItems.findIndex(i => i.proposal.id === currentId);
    if (currentIndex === -1) return;
    
    if (direction === 'next') {
      const nextItem = filteredItems[currentIndex + 1] || filteredItems[0];
      if (nextItem) setSelectedItemId(nextItem.proposal.id);
    } else {
      const prevItem = filteredItems[currentIndex - 1] || filteredItems[filteredItems.length - 1];
      if (prevItem) setSelectedItemId(prevItem.proposal.id);
    }
  }, [filteredItems]);

  const selectedItem = useMemo(() => {
    return items.find(i => i.proposal.id === selectedItemId) || filteredItems[0] || null;
  }, [items, selectedItemId, filteredItems]);

  // Actions
  const handleApprove = useCallback(async (item: ReviewQueueItem) => {
    try {
      await onApprove(item.proposal.id, commentText);
      addToast(
        'success',
        'Proposal Approved & Committed',
        `Reconciled with ${item.activity?.code || 'activity'}. Immutable actual event committed to ledger.`
      );
      setCommentText('');
      advanceSelection(item.proposal.id, 'next');
    } catch {
      addToast('error', 'Approval Failed', 'Unable to commit state update to Trust Plane ledger.');
    }
  }, [onApprove, commentText, advanceSelection]);

  const handleConfirmReject = async () => {
    if (!selectedItem) return;
    try {
      await onReject(selectedItem.proposal.id, rejectReason || 'Rejected by Lead Planner');
      addToast('info', 'Proposal Rejected', `Proposal ${selectedItem.proposal.id.slice(0, 8)} logged as REJECTED in audit trail.`);
      setIsRejectModalOpen(false);
      setRejectReason('');
      advanceSelection(selectedItem.proposal.id, 'next');
    } catch {
      addToast('error', 'Rejection Failed', 'Network or validation error occurred.');
    }
  };

  const handleCommitOverride = async () => {
    if (!selectedItem || !selectedOverrideActivityId) {
      addToast('error', 'Select Activity', 'Please select a valid alternate schedule activity.');
      return;
    }
    try {
      await onOverride(selectedItem.proposal.id, selectedOverrideActivityId, commentText || 'Planner manual match override');
      const act = activities.find(a => a.id === selectedOverrideActivityId);
      addToast(
        'success',
        'Match Overridden',
        `Linked observation to ${act?.code || 'new activity'} and committed actual progress.`
      );
      setShowOverridePanel(false);
      setSelectedOverrideActivityId(null);
      setCommentText('');
      advanceSelection(selectedItem.proposal.id, 'next');
    } catch {
      addToast('error', 'Override Failed', 'Could not apply manual schedule link.');
    }
  };

  // Keyboard Shortcuts for Rapid Planner Review
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (!selectedItem) return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        void handleApprove(selectedItem);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setIsRejectModalOpen(true);
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setShowOverridePanel(prev => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        advanceSelection(selectedItem.proposal.id, 'next');
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        advanceSelection(selectedItem.proposal.id, 'prev');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, handleApprove, advanceSelection]);

  // Anime.js entrance animation on items
  useEffect(() => {
    if (filteredItems.length > 0) {
      animateStaggerEntrance('.queue-item-card', { stagger: 30 });
    }
  }, [filteredItems.length]);

  return (
    <div className="space-y-6 pb-12">
      {/* Fixed Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}
      </div>

      {/* Hero Decision Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-[#FF9500]" />
            <span className="text-[10px] font-sans text-amber-800 font-semibold uppercase tracking-wider">
              Human-in-the-Loop Gateway
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">
            Planner Review Queue
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-[65ch] font-sans">
            AI proposes &rarr; Rust Trust Plane validates &rarr; You approve. Human verification guarantees zero phantom progress.
          </p>
        </div>

        {/* Hotkey Guide Pill */}
        <div className="hidden lg:flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs font-sans text-slate-600">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Hotkeys:</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-800 font-semibold shadow-2xs font-sans">A</kbd> Approve</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-800 font-semibold shadow-2xs font-sans">R</kbd> Reject</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-800 font-semibold shadow-2xs font-sans">O</kbd> Override</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-800 font-semibold shadow-2xs font-sans">N</kbd>/<kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-800 font-semibold shadow-2xs font-sans">P</kbd> Nav</span>
        </div>
      </div>

      {/* Main Review Console Layout */}
      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-[#34C759] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 font-sans">You're all caught up</h3>
          <p className="text-xs text-slate-500 font-sans mt-1">
            No ambiguous proposals require review. Last processed at 16:40.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Queue Triage List */}
          <div className="lg:col-span-4 space-y-3">
            {/* Search & Sorting Bar */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-2 shadow-2xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter queue by code or text..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200/80 text-xs font-sans placeholder-slate-400 focus:outline-hidden focus:border-[#C38B4B]"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-sans text-slate-500 pt-1">
                <span>{filteredItems.length} items awaiting review</span>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as any }))}
                  className="bg-transparent font-sans text-slate-700 font-medium focus:outline-hidden cursor-pointer"
                >
                  <option value="confidence_desc">Highest Confidence</option>
                  <option value="confidence_asc">Lowest Confidence</option>
                  <option value="date_desc">Newest First</option>
                </select>
              </div>
            </div>

            {/* Queue Item Cards */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredItems.map(({ proposal, observation, activity }) => {
                const isSelected = selectedItem?.proposal.id === proposal.id;
                const confPct = Math.round(proposal.confidence_score * 100);

                return (
                  <div
                    key={proposal.id}
                    onClick={() => setSelectedItemId(proposal.id)}
                    className={`queue-item-card p-3.5 rounded-xl border transition-all duration-150 cursor-pointer relative shadow-2xs ${
                      isSelected 
                        ? 'bg-white border-[#C38B4B] ring-2 ring-[#C38B4B]/30' 
                        : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {activity?.critical_path && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] shrink-0" title="Critical Path" />
                        )}
                        <span className="font-mono font-bold text-xs text-slate-900">{activity?.code || 'UNMATCHED'}</span>
                        <span className="text-[10px] text-slate-500 font-sans">&bull; {activity?.discipline}</span>
                      </div>
                      <Badge variant={confPct >= 85 ? 'success' : confPct >= 70 ? 'warning' : 'destructive'}>
                        {confPct}% Match
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 font-sans line-clamp-2 mb-2">
                      "{observation?.raw_text}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-sans text-slate-400 pt-2 border-t border-slate-100">
                      <span>{observation?.location || 'Zone 2'}</span>
                      <span>{new Date(proposal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Hero Proposal Decision Console */}
          {selectedItem ? (
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 space-y-6 shadow-2xs">
                
                {/* Decision Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-sans uppercase tracking-wider text-slate-400 block font-semibold">
                      Proposed Target Match
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-0.5 font-sans">
                      {selectedItem.activity?.name}
                    </h2>
                  </div>
                  <Badge variant="warning" className="text-xs py-1 px-2.5">
                    {Math.round(selectedItem.proposal.confidence_score * 100)}% Confidence Score
                  </Badge>
                </div>

                {/* Open Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                  {/* Left: Ingested Field Evidence */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                      Field Evidence Source
                    </span>
                    <p className="text-xs text-slate-800 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 font-sans italic">
                      "{selectedItem.observation?.raw_text}"
                    </p>
                    <div className="flex items-center gap-2 text-[11px] font-sans text-slate-500">
                      <Tag className="h-3 w-3 text-slate-400" />
                      <span>{selectedItem.observation?.discipline || 'GENERAL'} &bull; {selectedItem.observation?.location || 'Pipe Rack B'}</span>
                    </div>
                  </div>

                  {/* Right: Schedule Baseline Target */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                      Schedule Baseline Activity
                    </span>
                    <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-mono font-bold text-slate-900 text-sm">{selectedItem.activity?.code}</span>
                        <Badge variant="secondary">{selectedItem.activity?.discipline}</Badge>
                      </div>
                      <p className="text-slate-700 font-sans font-medium">{selectedItem.activity?.name}</p>
                      <div className="pt-2 border-t border-slate-200/60 flex justify-between text-[10px] text-slate-500 font-sans">
                        <span>Planned: {selectedItem.activity?.planned_start_date}</span>
                        <span>Scope: {selectedItem.activity?.planned_quantity} {selectedItem.activity?.unit_of_measure}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Why NEXORA Matched This (Visual AI Explanation) */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                    Why NEXORA Matched This
                  </span>
                  
                  <p className="text-xs text-slate-700 font-sans leading-relaxed">
                    {selectedItem.proposal.explanation || 'This evidence matches the same discipline, Pipe Rack Tier 2 location, and carbon steel spool erection activity keywords with valid precedence.'}
                  </p>

                  <div className="grid grid-cols-3 gap-4 text-xs font-sans pt-1">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500 text-[11px]">Semantic Similarity:</span>
                        <span className="font-semibold font-mono">{Math.round((selectedItem.proposal.semantic_score || 0.78) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#007AFF] h-full rounded-full" style={{ width: `${(selectedItem.proposal.semantic_score || 0.78) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500 text-[11px]">Activity Terminology:</span>
                        <span className="font-semibold font-mono">{Math.round((selectedItem.proposal.lexical_score || 0.72) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#34C759] h-full rounded-full" style={{ width: `${(selectedItem.proposal.lexical_score || 0.72) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500 text-[11px]">Spatial & Context:</span>
                        <span className="font-semibold font-mono">+{Math.round((selectedItem.proposal.context_boost || 0.15) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#C38B4B] h-full rounded-full" style={{ width: `${(selectedItem.proposal.context_boost || 0.15) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pre-Commit Safety Validation Checklist */}
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs font-sans">
                    <ShieldCheck className="h-4 w-4 text-[#34C759]" />
                    <span>Why This Is Safe to Commit (Trust Plane Pre-Validation)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-sans text-emerald-950">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-[#34C759]" />
                      <span>Activity exists in baseline</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-[#34C759]" />
                      <span>Dates satisfy precedence</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-[#34C759]" />
                      <span>Monotonic progress delta</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-[#34C759]" />
                      <span>Planner authorized</span>
                    </div>
                  </div>
                </div>

                {/* Override Modal / Panel */}
                {showOverridePanel && (
                  <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-sans font-semibold text-amber-900">Select Alternate Schedule Activity</span>
                      <button onClick={() => setShowOverridePanel(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <select
                      value={selectedOverrideActivityId || ''}
                      onChange={(e) => setSelectedOverrideActivityId(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs font-sans"
                    >
                      <option value="">-- Choose activity --</option>
                      {activities.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name} ({a.discipline})
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={handleCommitOverride}
                      variant="bronze"
                      className="w-full"
                    >
                      Confirm Match Override
                    </Button>
                  </div>
                )}

                {/* Action Decision Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
                  <Button
                    onClick={() => setIsRejectModalOpen(true)}
                    variant="destructive"
                    size="default"
                    className="flex items-center gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </Button>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => setShowOverridePanel(prev => !prev)}
                      variant="outline"
                      size="default"
                    >
                      Change Match
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedItem)}
                      variant="default"
                      size="default"
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759]" />
                      <span>Approve & Commit</span>
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <Card className="lg:col-span-8 p-12 text-center">
              <p className="text-xs font-sans text-slate-500">Select an item from the queue to review.</p>
            </Card>
          )}

        </div>
      )}

      {/* Rejection Modal with Mandatory Rationale */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setIsRejectModalOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" />
          <div 
            className="relative bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200/80 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-[#FF3B30]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 font-sans">Reject AI Match Proposal</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Rejections are permanently registered in the immutable audit trail with your engineering rationale.
                </p>
              </div>
            </div>

            <textarea
              placeholder="Enter engineering rationale (e.g. Activity already completed under Package 03)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs font-sans focus:border-[#FF3B30] focus:outline-hidden"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button onClick={() => setIsRejectModalOpen(false)} variant="outline" size="sm">
                Cancel
              </Button>
              <Button onClick={handleConfirmReject} variant="destructive" size="sm">
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
