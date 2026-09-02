import React from 'react';
import { 
  FileText, 
  Cpu, 
  CheckCircle2, 
  Clock,
  FileAudio,
  ExternalLink
} from 'lucide-react';
import type { WorkObservation } from '../types';
import { getEvidencePublicUrl } from '../lib/supabase';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from './ui/sheet';

interface EvidenceDrawerProps {
  observation: WorkObservation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ observation, isOpen, onClose }) => {
  if (!observation) return null;

  const storagePath = (observation.metadata as any)?.storage_path;
  const audioUrl = storagePath ? getEvidencePublicUrl(storagePath) : null;
  const hasAudio = (observation.metadata as any)?.has_audio || (observation.metadata as any)?.source_type === 'VOICE';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="p-0 sm:max-w-xl md:max-w-2xl bg-white shadow-2xl">
        
        {/* Header */}
        <SheetHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-blue-700" aria-hidden="true" />
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-slate-600">
              Evidence Processing & AI Provenance Sheet
            </span>
          </div>
          <SheetTitle className="text-lg font-bold font-mono text-slate-900">
            {observation.id}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-xs font-sans text-slate-600">
            <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Recorded: {new Date(observation.recorded_at).toLocaleString()}</span>
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Audio Memo Player if present */}
          {hasAudio && (
            <div className="space-y-2 p-4 rounded-xl bg-purple-50/70 border border-purple-200/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-purple-900">
                  <FileAudio className="h-4 w-4 text-purple-700" aria-hidden="true" />
                  Audio Evidence Recording
                </div>
                {audioUrl && (
                  <a 
                    href={audioUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    aria-label="View cloud audio file in new window"
                    className="text-[11px] font-sans text-purple-900 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Cloud File</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
              {audioUrl && (
                <audio controls src={audioUrl} aria-label="Playback of evidence audio recording" className="w-full mt-2 h-8" />
              )}
            </div>
          )}

          {/* Stage 1: Source */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-slate-700">
                <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                Stage 1: Raw Ingested Source
              </div>
              <Badge variant="secondary">DIRECT EXTRACTION</Badge>
            </div>
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 text-xs font-sans text-slate-900 leading-relaxed italic">
              "{observation.raw_text}"
            </div>
          </div>

          {/* Stage 2: Normalization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-slate-700">
                <Cpu className="h-3.5 w-3.5 text-purple-700" aria-hidden="true" />
                Stage 2: Entity Normalization
              </div>
              <Badge variant="cyan">faster-whisper VAD</Badge>
            </div>
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 text-xs font-sans space-y-2 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Normalized Text:</span>
                <span className="font-medium text-slate-900">{observation.normalized_text || observation.raw_text}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Discipline Classification:</span>
                <Badge variant="secondary">{observation.discipline || 'GENERAL'}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Event Type:</span>
                <span className="font-mono text-slate-900 font-semibold">{observation.event_type || 'PROGRESS'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Extracted Progress:</span>
                <span className="font-mono text-emerald-800 font-bold">{observation.reported_progress ?? 100}%</span>
              </div>
            </div>
          </div>

          {/* Stage 3: Spatial Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800" aria-hidden="true" />
                Stage 3: Spatial & Equipment Mapping
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 text-xs font-sans space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Equipment / Line Tag:</span>
                <span className="font-mono font-semibold text-slate-900">{observation.equipment_tag || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Location Area:</span>
                <span className="text-slate-900 font-medium">{observation.location || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Zone:</span>
                <span className="text-slate-900 font-medium">{observation.zone || '—'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <Button onClick={onClose} variant="default" size="sm">
            Done
          </Button>
        </SheetFooter>

      </SheetContent>
    </Sheet>
  );
};
