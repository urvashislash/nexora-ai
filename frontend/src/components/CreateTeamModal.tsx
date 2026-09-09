import React, { useState } from 'react';
import { Building2, X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardTitle, CardDescription } from './ui/card';
import { useTeam } from '../contexts/TeamContext';

interface CreateTeamModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ isOpen, onClose }) => {
  const { isCreateTeamModalOpen, closeCreateTeamModal, createTeam } = useTeam();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalOpen = isOpen !== undefined ? isOpen : isCreateTeamModalOpen;
  const handleClose = onClose || closeCreateTeamModal;

  if (!modalOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    const suggestedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(suggestedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Team name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createTeam(name.trim(), slug.trim() || undefined);
      setName('');
      setSlug('');
      closeCreateTeamModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create team. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-team-title"
    >
      <Card className="w-full max-w-md p-6 bg-white shadow-xl border border-slate-200 rounded-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-800">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle id="create-team-title" className="text-base font-bold text-slate-900 font-sans">
                Create New Team
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-sans">
                Organizations isolate projects, schedules, and members
              </CardDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200/80 rounded-xl" role="alert">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="team-name" className="text-xs font-semibold text-slate-700 font-sans block">
              Team / Company Name <span className="text-rose-500">*</span>
            </label>
            <Input
              id="team-name"
              type="text"
              placeholder="e.g. Larsen & Toubro Construction"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isLoading}
              required
              className="text-sm font-sans"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="team-slug" className="text-xs font-semibold text-slate-700 font-sans block">
              Team Identifier / Slug
            </label>
            <Input
              id="team-slug"
              type="text"
              placeholder="larsen-toubro-construction"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              disabled={isLoading}
              className="text-sm font-mono text-slate-600"
            />
            <p className="text-[11px] text-slate-400 font-sans">
              Used in resource routing and team isolation.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isLoading || !name.trim()}
              className="bg-[#C38B4B] hover:bg-[#b07b3e] text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden="true" />
                  <span>Creating Team...</span>
                </>
              ) : (
                <span>Create Team</span>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
