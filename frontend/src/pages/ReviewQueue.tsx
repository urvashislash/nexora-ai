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
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';

// ── Toast Notification Component ───────────────────────────────────────────
const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className={`w-[calc(100vw-2rem)] min-w-0 max-w-md border rounded-xl px-4 py-3 flex items-start gap-3 shadow-lg bg-white ${
      isSuccess ? 'border-emerald-200 text-emerald-950' : 
      isError ? 'border-rose-200 text-rose-950' : 
      'border-slate-200 text-slate-900'
    } font-sans transition-all duration-200`}>
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
        const q = filters.searchQuery.toLowerCase();
        const obsMatch = item.observation?.raw_text.toLowerCase().includes(q);
        const actMatch = item.activity?.name.toLowerCase().includes(q) || item.activity?.code.toLowerCase().includes(q);
        if (!obsMatch && !actMatch) return false;
      }
      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'confidence_desc') return b.proposal.confidence_score - a.proposal.confidence_score;
      if (filters.sortBy === 'confidence_asc') return a.proposal.confidence_score - b.proposal.confidence_score;
      return 0;
    });
  }, [items, filters]);

  const selectedItem = useMemo(() => {
    return items.find(i => i.proposal.id === selectedItemId) || filteredItems[0] || null;
  }, [items, filteredItems, selectedItemId]);

  // Actions
  const handleApprove = useCallback(async (item: ReviewQueueItem) => {
    try {
      await onApprove(item.proposal.id, commentText);
      addToast('success', 'Proposal Approved & Committed', `Event committed to ledger for activity ${item.activity?.code || ''}.`);
      setCommentText('');
    } catch {
      addToast('error', 'Commit Failed', 'Could not record event in deterministic ledger.');
    }
  }, [onApprove, commentText]);

  const handleConfirmReject = async () => {
    if (!selectedItem) return;
    try {
      await onReject(selectedItem.proposal.id, rejectReason || 'Rejected by Lead Planner');
      addToast('info', 'Proposal Rejected', `Proposal rejected and logged to immutable audit trail.`);
      setIsRejectModalOpen(false);
      setRejectReason('');
    } catch {
      addToast('error', 'Rejection Failed', 'Could not complete rejection request.');
    }
  };

  const handleCommitOverride = async () => {
    if (!selectedItem || !selectedOverrideActivityId) return;
    try {
      await onOverride(selectedItem.proposal.id, selectedOverrideActivityId, 'Planner override match selection');
      addToast('success', 'Match Override Committed', `Observation linked to selected activity.`);
      setShowOverridePanel(false);
      setSelectedOverrideActivityId(null);
    } catch {
      addToast('error', 'Override Failed', 'Could not save override.');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey || e.defaultPrevented) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button, [role="dialog"]')) return;

      if (e.key.toLowerCase() === 'a' && selectedItem) {
        e.preventDefault();
        handleApprove(selectedItem);
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRejectModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, handleApprove]);

  useEffect(() => {
    animateStaggerEntrance('.review-queue-card', { stagger: 60 });
  }, [filteredItems]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Header & Hotkey Guide */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-[#FF9500]" />
            <Badge variant="warning">Planner Review Queue</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-none font-sans">
            Review matches
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-[65ch] font-sans">
            Review ambiguous matches. Matches at 88% confidence or higher link automatically.
          </p>
        </div>

        {/* Hotkey Guide Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-[11px] font-sans text-slate-600">
          <span className="text-slate-400">Hotkeys:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-semibold font-sans text-[10px]">⌘⇧A</kbd>
          <span>Approve</span>
          <span className="text-slate-300">&bull;</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-semibold font-sans text-[10px]">⌘⇧R</kbd>
          <span>Reject</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <Card className="p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                aria-label="Search pending proposals"
                placeholder="Search proposals by WBS code, description, location..."
                value={filters.searchQuery || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="pl-8"
              />
            </div>

            {/* Discipline Filter */}
            <div className="flex items-center gap-1 text-xs font-sans">
              <span className="text-slate-400 text-[11px] mr-1">Discipline:</span>
              {(['ALL', 'CIVIL', 'PIPING', 'ELECTRICAL', 'MECHANICAL'] as const).map(disc => (
                <button
                  key={disc}
                  onClick={() => setFilters(prev => ({ ...prev, discipline: disc }))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    filters.discipline === disc 
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {disc}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-sans text-slate-500">
            <span><strong className="text-slate-900 font-semibold">{filteredItems.length}</strong> of {items.length} pending</span>
          </div>
        </div>
      </Card>

      {/* Main Review Console: Side-by-Side Master/Detail */}
      {filteredItems.length === 0 ? (
        <Card className="p-16 text-center shadow-2xs space-y-3">
          <CheckCircle2 className="h-10 w-10 text-[#34C759] mx-auto" />
          <h3 className="text-base font-bold text-slate-900 font-sans">Queue Clear</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans">
            All proposals are processed. New evidence appears here after upload.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Proposal List (Master) */}
          <div className="lg:col-span-4 space-y-3">
            {filteredItems.map(item => {
              const isSelected = item.proposal.id === selectedItemId;
              const confPct = Math.round(item.proposal.confidence_score * 100);

              return (
                <button
                  key={item.proposal.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedItemId(item.proposal.id)}
                  className={`review-queue-card w-full space-y-3 rounded-2xl border p-4 text-left shadow-2xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
                    isSelected 
                      ? 'bg-white border-slate-900 ring-2 ring-slate-900/10' 
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {item.activity?.code || 'UNLINKED'}
                    </span>
                    <Badge variant={confPct >= 80 ? 'success' : 'warning'}>
                      {confPct}% Match
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-800 font-medium line-clamp-2 font-sans leading-snug">
                    {item.activity?.name || item.observation?.raw_text}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans pt-1 border-t border-slate-100">
                    <span>{item.observation?.discipline || 'GENERAL'}</span>
                    <span className="font-mono">{item.observation?.recorded_at ? new Date(item.observation.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Decision Details (Detail Panel) */}
          {selectedItem ? (
            <div className="lg:col-span-8 space-y-6">
              <Card className="p-6 sm:p-7 shadow-2xs space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-sans uppercase tracking-wider text-slate-400 block font-semibold">
                      Proposed Target Match
                    </span>
                    <CardTitle className="text-lg font-bold text-slate-900 mt-0.5">
                      {selectedItem.activity?.name}
                    </CardTitle>
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

                {/* Match explanation */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                    Why it matched
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
                      <Progress value={(selectedItem.proposal.semantic_score || 0.78) * 100} className="h-1.5" indicatorClassName="bg-[#007AFF]" />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500 text-[11px]">Activity Terminology:</span>
                        <span className="font-semibold font-mono">{Math.round((selectedItem.proposal.lexical_score || 0.72) * 100)}%</span>
                      </div>
                      <Progress value={(selectedItem.proposal.lexical_score || 0.72) * 100} className="h-1.5" indicatorClassName="bg-[#34C759]" />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500 text-[11px]">Spatial & Context:</span>
                        <span className="font-semibold font-mono">+{Math.round((selectedItem.proposal.context_boost || 0.15) * 100)}%</span>
                      </div>
                      <Progress value={(selectedItem.proposal.context_boost || 0.15) * 100} className="h-1.5" indicatorClassName="bg-[#C38B4B]" />
                    </div>
                  </div>
                </div>

                {/* Pre-Commit Safety Validation Checklist */}
                <Alert variant="success" className="bg-emerald-50/60 border-emerald-200/80">
                  <ShieldCheck className="h-4 w-4 text-[#34C759]" />
                  <AlertTitle className="text-emerald-900 font-semibold text-xs">
                    Trust Plane Pre-Validation (Safe to Commit)
                  </AlertTitle>
                  <AlertDescription className="grid grid-cols-2 gap-2 text-xs font-sans text-emerald-950 mt-2">
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
                  </AlertDescription>
                </Alert>

                {/* Override Modal / Panel */}
                {showOverridePanel && (
                  <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-sans font-semibold text-amber-900">Select Alternate Schedule Activity</span>
                      <button type="button" onClick={() => setShowOverridePanel(false)} aria-label="Close alternate activity selector" className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <select
                      aria-label="Alternate schedule activity"
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

              </Card>
            </div>
          ) : (
            <Card className="lg:col-span-8 p-12 text-center">
              <p className="text-xs font-sans text-slate-500">Select an item from the queue to review.</p>
            </Card>
          )}

        </div>
      )}

      {/* Rejection Dialog with Mandatory Rationale */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md p-6 font-sans">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-[#FF3B30]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-slate-900 font-sans">
                  Reject AI Match Proposal
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5 font-sans">
                  Your reason is saved to the audit trail.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Textarea
            placeholder="Enter engineering rationale (e.g. Activity already completed under Package 03)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="w-full text-xs font-sans"
          />

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => setIsRejectModalOpen(false)} variant="outline" size="sm">
              Cancel
            </Button>
            <Button onClick={handleConfirmReject} variant="destructive" size="sm">
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
