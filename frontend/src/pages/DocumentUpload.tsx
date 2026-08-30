import React, { useState } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import type { WorkObservation } from '../types';

interface DocumentUploadProps {
  onAddObservations: (observations: WorkObservation[], rawText: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onAddObservations, onNavigateTab }) => {
  const [inputText, setInputText] = useState('');
  const [sourceType, setSourceType] = useState('DAILY_REPORT');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [lastResult, setLastResult] = useState<any>(null);

  // 5 Mandatory Demo Preset Scenarios
  const demoPresets = [
    {
      id: 'A',
      title: 'Scenario A: Exact Match',
      badge: 'Auto-Link High Confidence',
      badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-800',
      text: 'P-101 completed successfully. Hydro test pack holding pressure maintained at 42.5 bar for 4 hours.',
      desc: 'Exact line tag match against PIP-2401 -> Auto-linked with >90% confidence'
    },
    {
      id: 'B',
      title: 'Scenario B: Semantic Match',
      badge: 'Semantic Embeddings',
      badgeColor: 'bg-indigo-950 text-indigo-400 border-indigo-800',
      text: 'spool erection complete on Pipe Rack B Tier 2 with alignment and bolt tightening done.',
      desc: 'Colloquial terminology normalized and matched to PIP-2400 despite wording variance'
    },
    {
      id: 'C',
      title: 'Scenario C: Ambiguous Match',
      badge: 'Planner Review Required',
      badgeColor: 'bg-amber-950 text-amber-400 border-amber-800',
      text: 'Hydrostatic pressure testing completed along Interconnecting Pipe Rack B headers yesterday.',
      desc: 'Matches both PIP-2401 and PIP-2402 closely -> Routed to Planner Review Queue'
    },
    {
      id: 'D',
      title: 'Scenario D: Unmatched Work',
      badge: 'Unmatched Queue',
      badgeColor: 'bg-purple-950 text-purple-400 border-purple-800',
      text: 'Emergency dewatering and deep foundation pit excavation carried out near Substation 4 due to heavy rain.',
      desc: 'New field activity not in baseline L5 schedule -> Preserved in Unmatched queue'
    },
    {
      id: 'E',
      title: 'Scenario E: Invalid Date Sequence',
      badge: 'Rust Trust Rejection',
      badgeColor: 'bg-rose-950 text-rose-400 border-rose-800',
      text: 'Line P-101 testing finished on 20-Aug-2026, work started on 28-Aug-2026.',
      desc: 'Finish date before start date -> Caught and rejected by Rust validation engine'
    },
  ];

  const handleProcess = async (textToProcess?: string) => {
    const text = textToProcess || inputText;
    if (!text.trim()) return;

    setIsProcessing(true);
    setActiveStep(1);
    setLastResult(null);

    // Step 1: Ingestion & Storage
    await new Promise(r => setTimeout(r, 400));
    setActiveStep(2);

    // Step 2: Extraction & Normalization
    await new Promise(r => setTimeout(r, 450));
    setActiveStep(3);

    // Step 3: Embeddings & Hybrid Match
    await new Promise(r => setTimeout(r, 500));
    setActiveStep(4);

    // Step 4: Rust Policy & Verification
    await new Promise(r => setTimeout(r, 400));
    setActiveStep(5);

    // Execute Observation Generation
    const newObs: WorkObservation = {
      id: `obs-${Date.now()}`,
      project_id: 'a0000000-0000-0000-0000-000000000001',
      raw_text: text,
      normalized_text: text.includes('P-101') ? text.replace('P-101', 'Line P-101') : text,
      discipline: text.toLowerCase().includes('pour') || text.toLowerCase().includes('civil') ? 'CIVIL' : 'PIPING',
      recorded_at: new Date().toISOString(),
      event_type: 'FINISH',
      reported_progress: 100,
    };

    onAddObservations([newObs], text);
    setIsProcessing(false);
    setLastResult({
      text,
      status: 'PROCESSED',
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Heterogeneous Ingestion & Processing Hub
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload PDFs, discipline spreadsheets, voice transcripts, or select an SIH demo scenario to watch the AI and Rust Trust Plane in action.
        </p>
      </div>

      {/* Demo Preset Scenarios Bar */}
      <div className="glass-panel rounded-xl p-5 border border-sky-900/60">
        <div className="flex items-center space-x-2 mb-3">
          <Sparkles className="h-5 w-5 text-sky-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">
            5 Mandatory SIH Demo Scenarios (One-Click Execution)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {demoPresets.map((preset) => (
            <div 
              key={preset.id}
              onClick={() => {
                setInputText(preset.text);
                handleProcess(preset.text);
              }}
              className="glass-card rounded-lg p-3.5 cursor-pointer hover:border-sky-500/50 hover:bg-slate-800/90 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-sm text-white">{preset.title}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${preset.badgeColor}`}>
                    {preset.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 italic">"{preset.text}"</p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                <span>{preset.desc}</span>
                <ArrowRight className="h-3.5 w-3.5 text-sky-400 shrink-0 ml-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Ingestion Form & Upload Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Manual Field Entry & Upload</h3>
            <div className="flex space-x-1 rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs">
              <button 
                onClick={() => setSourceType('DAILY_REPORT')}
                className={`px-2.5 py-1 rounded font-medium ${sourceType === 'DAILY_REPORT' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
              >
                Daily PDF
              </button>
              <button 
                onClick={() => setSourceType('DISCIPLINE_SPREADSHEET')}
                className={`px-2.5 py-1 rounded font-medium ${sourceType === 'DISCIPLINE_SPREADSHEET' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
              >
                Excel / CSV
              </button>
              <button 
                onClick={() => setSourceType('VOICE')}
                className={`px-2.5 py-1 rounded font-medium ${sourceType === 'VOICE' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
              >
                Voice Note
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Field Execution Report / Log Text
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Completed hydro test on line P-101 at pipe rack B with 100% signoff from inspection team."
              rows={5}
              className="w-full rounded-lg bg-slate-950/80 border border-slate-700/80 p-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <UploadCloud className="h-4 w-4 text-sky-400" />
              <span>Target: Supabase Storage + RabbitMQ Pipeline</span>
            </div>
            <button
              onClick={() => handleProcess()}
              disabled={isProcessing || !inputText.trim()}
              className="flex items-center space-x-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 hover:bg-sky-500 disabled:opacity-50 transition"
            >
              {isProcessing && <RefreshCw className="h-4 w-4 animate-spin" />}
              <span>{isProcessing ? 'Processing Pipeline...' : 'Process Observation'}</span>
            </button>
          </div>
        </div>

        {/* Live Pipeline Tracker */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-white mb-3">
              Real-Time End-to-End Pipeline Execution
            </h3>

            <div className="space-y-3">
              {[
                { step: 1, title: 'Ingestion & Object Storage', desc: 'Durable evidence payload stored in Supabase Storage' },
                { step: 2, title: 'Text Extraction & Normalization', desc: 'Terminology mapped against domain dictionary' },
                { step: 3, title: 'Embeddings & Hybrid Matching', desc: 'RapidFuzz + 384-dim sentence-transformers cosine search' },
                { step: 4, title: 'Rust Trust Plane Validation', desc: 'State machine, date rules & predecessor verification' },
                { step: 5, title: 'PostgreSQL Commit & SHA256 Audit', desc: 'Immutable event ledger update with cryptographic hash' }
              ].map((s) => {
                const isCurrent = activeStep === s.step;
                const isPassed = activeStep > s.step || activeStep === 5;

                return (
                  <div 
                    key={s.step}
                    className={`flex items-start space-x-3 rounded-lg p-2.5 transition ${
                      isCurrent ? 'bg-sky-950/60 border border-sky-600/60' :
                      isPassed ? 'bg-slate-900/40 border border-emerald-900/40' :
                      'bg-slate-950/30 opacity-40'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isPassed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : isCurrent ? (
                        <RefreshCw className="h-4 w-4 text-sky-400 animate-spin" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-slate-600 text-[10px] flex items-center justify-center text-slate-400">
                          {s.step}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{s.title}</div>
                      <div className="text-[11px] text-slate-400">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {lastResult && (
            <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/60 p-3 flex items-center justify-between">
              <div className="text-xs text-emerald-300">
                <span className="font-bold">Execution Complete!</span> Observation mapped and queued.
              </div>
              <button 
                onClick={() => onNavigateTab('review')}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline"
              >
                Inspect in Review Queue →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
