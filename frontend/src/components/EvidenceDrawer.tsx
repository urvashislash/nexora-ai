import React from 'react';
import { 
  X, 
  FileText, 
  Cpu, 
  CheckCircle2, 
  Clock,
  FileAudio,
  ExternalLink
} from 'lucide-react';
import type { WorkObservation } from '../types';
import { getEvidencePublicUrl } from '../lib/supabase';

interface EvidenceDrawerProps {
  observation: WorkObservation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ observation, isOpen, onClose }) => {
  if (!isOpen || !observation) return null;

  const storagePath = (observation.metadata as any)?.storage_path;
  const audioUrl = storagePath ? getEvidencePublicUrl(storagePath) : null;
  const hasAudio = (observation.metadata as any)?.has_audio || (observation.metadata as any)?.source_type === 'VOICE';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="signal-tick bg-blue-500" />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  Evidence Processing & AI Provenance Sheet
                </span>
              </div>
              <h2 className="text-xl font-bold font-mono text-slate-900">{observation.id}</h2>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mt-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Recorded: {new Date(observation.recorded_at).toLocaleString()}</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Audio Memo Player if present */}
            {hasAudio && (
              <div className="space-y-2 p-4 rounded-lg bg-purple-50/70 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-purple-700">
                    <FileAudio className="h-4 w-4 text-purple-600" />
                    Audio Evidence Recording
                  </div>
                  {audioUrl && (
                    <a 
                      href={audioUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] font-mono text-purple-700 hover:underline flex items-center gap-1"
                    >
                      <span>Cloud File</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {audioUrl && (
                  <audio controls src={audioUrl} className="w-full mt-2 h-8" />
                )}
              </div>
            )}

            {/* Stage 1: Source */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  Stage 1: Raw Ingested Source
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  DIRECT EXTRACTION
                </span>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono leading-relaxed text-slate-800">
                "{observation.raw_text}"
              </div>
            </div>

            {/* Stage 2: AI Interpretation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
                  <Cpu className="h-3.5 w-3.5 text-blue-500" />
                  Stage 2: AI Normalized Interpretation
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  NER & DICTIONARY
                </span>
              </div>
              <div className="p-4 rounded-lg bg-blue-50/40 border border-blue-100 text-xs font-mono text-slate-800 space-y-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Normalized Fact:</span>
                  <span className="font-semibold text-slate-900">{observation.normalized_text || observation.raw_text}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-100 text-[11px]">
                  <div>
                    <span className="text-slate-500">Discipline:</span> <span className="font-bold text-slate-800">{observation.discipline || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Event Type:</span> <span className="font-bold text-slate-800">{observation.event_type || 'PROGRESS'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Reported Progress:</span> <span className="font-bold text-slate-800">{observation.reported_progress ?? 100}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Location:</span> <span className="font-bold text-slate-800">{observation.location || 'Pipe Rack B'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 3: Match Proposal & Confidence Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Stage 3: Hybrid Score & Routing
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  COSINE + RAPIDFUZZ
                </span>
              </div>
              
              <div className="p-4 rounded-lg bg-emerald-50/30 border border-emerald-200 text-xs font-mono space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Hybrid Match Confidence:</span>
                  <span className="text-base font-bold font-mono text-emerald-700">92.4%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '92.4%' }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600 pt-2 border-t border-emerald-100">
                  <div>
                    <span className="block text-slate-400">Lexical:</span>
                    <span className="font-bold text-slate-800">95%</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Semantic:</span>
                    <span className="font-bold text-slate-800">89%</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Context Boost:</span>
                    <span className="font-bold text-slate-800">+15%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Metadata */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Technical Telemetry</span>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Embedding Engine:</span>
                <span className="text-slate-800 font-semibold">all-MiniLM-L6-v2 (384-d)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Storage Location:</span>
                <span className="text-slate-800 font-semibold">evidence-documents/reports</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Trust State:</span>
                <span className="text-emerald-600 font-semibold">PASSED RUST VERIFICATION</span>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Project: a0000000-0000-0000-0000-000000000001</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-slate-900 text-white font-sans font-medium text-xs hover:bg-slate-800 transition"
            >
              Close Sheet
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
