import React, { useState } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Send, 
  CheckCircle2, 
  HelpCircle, 
  Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { useTeam } from '../contexts/TeamContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  activeTab = 'dashboard',
}) => {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const { activeTeam } = useTeam();

  const [rating, setRating] = useState<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null>(null);
  const [category, setCategory] = useState<'AI_SUGGESTION' | 'BUG' | 'FEATURE' | 'GENERAL'>('AI_SUGGESTION');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !rating) return;

    setIsSubmitting(true);
    try {
      // Package rich telemetry for debugging
      const payload = {
        rating,
        category,
        message: message.trim(),
        user_id: user?.id,
        user_email: user?.email,
        team_id: activeTeam?.id,
        team_name: activeTeam?.name,
        project_id: activeProject?.id,
        project_code: activeProject?.code,
        active_tab: activeTab,
        browser: navigator.userAgent,
        screen_resolution: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
      };

      console.info('[NEXORA Beta Telemetry] User Feedback submitted:', payload);

      // Attempt endpoint or local storage persistence
      try {
        const stored = JSON.parse(localStorage.getItem('nexora:beta_feedback') || '[]');
        stored.push(payload);
        localStorage.setItem('nexora:beta_feedback', JSON.stringify(stored));
      } catch {
        // ignore
      }

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setMessage('');
        setRating(null);
        onClose();
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-6 font-sans">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800">
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                Send Beta Feedback & Support
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-sans">
                Help us refine AI matching, schedule synchronization, and workflows
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-2 animate-in fade-in">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900 font-sans">Thank you for your feedback!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto font-sans">
              Our engineering team reviews beta feedback daily to tune match models and fix issues.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Sentiment Rating */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                How is your experience with NEXORA?
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRating('POSITIVE')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition ${
                    rating === 'POSITIVE'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Works Great</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRating('NEGATIVE')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition ${
                    rating === 'NEGATIVE'
                      ? 'border-rose-500 bg-rose-50 text-rose-950 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                  <span>Needs Work</span>
                </button>
              </div>
            </div>

            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'AI_SUGGESTION', label: 'AI Match Accuracy' },
                  { id: 'BUG', label: 'Bug / Ingestion Error' },
                  { id: 'FEATURE', label: 'Feature Request' },
                  { id: 'GENERAL', label: 'General Usability' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id as any)}
                    className={`p-2 text-left rounded-lg border text-xs transition ${
                      category === c.id
                        ? 'border-slate-900 bg-slate-900 text-white font-medium'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Notes or Details
              </label>
              <Textarea
                rows={3}
                placeholder="What happened? (e.g. equipment tag P-101 was matched to PIP-2001 with 92% confidence instead of P-102)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="text-xs resize-none"
              />
            </div>

            {/* Telemetry disclosure */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500 font-sans">
              Attaching telemetry: <span className="font-mono text-slate-700">{activeProject?.code || 'NO_PROJECT'}</span> &bull; Tab: <span className="font-mono text-slate-700">{activeTab}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <a
                  href="mailto:support@nexora.ai?subject=NEXORA%20Beta%20Support"
                  className="hover:text-slate-800 underline flex items-center gap-1"
                  target="_blank"
                  rel="noreferrer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Email Support</span>
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || (!message.trim() && !rating)}
                  className="bg-[#C38B4B] hover:bg-[#b07b3e] text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
