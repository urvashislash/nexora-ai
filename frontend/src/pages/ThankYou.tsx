import React from 'react';
import { CheckCircle2, ShieldCheck, ArrowRight, Eye, PlusCircle } from 'lucide-react';
import { generateEntityId } from '../lib/idGenerator';

interface ThankYouProps {
  onNavigateTab: (tab: 'dashboard' | 'upload' | 'review' | 'schedule' | 'audit' | 'export') => void;
  submissionDetails?: {
    type?: string;
    id?: string;
    timestamp?: string;
  };
}

export const ThankYou: React.FC<ThankYouProps> = ({ 
  onNavigateTab,
  submissionDetails = {
    type: 'Field Actualization Note',
    id: generateEntityId('obs'),
    timestamp: new Date().toISOString()
  }
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full glass-card p-8 text-center space-y-6 shadow-2xl border border-emerald-200/80 bg-white/95">
        
        {/* Animated Success Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-md">
          <CheckCircle2 className="h-9 w-9" />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-bold">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>CRYPTOGRAPHICALLY STAGED & VERIFIED</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight">
            Submission Confirmed
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            Your field observation note, voice memo, or inspection report has been cryptographically signed, hashed, and staged into the NEXORA Trust Plane ledger.
          </p>
        </div>

        {/* Verification Provenance Card */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left font-mono text-xs space-y-2">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <span className="text-slate-500">Submission Type:</span>
            <span className="font-bold text-slate-800">{submissionDetails.type}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <span className="text-slate-500">Record Identifier:</span>
            <span className="font-mono text-emerald-700 font-bold">{submissionDetails.id}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <span className="text-slate-500">Timestamp (UTC):</span>
            <span className="text-slate-700">{new Date(submissionDetails.timestamp || '').toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-slate-500">Trust State:</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PASSED POLICY GUARDS
            </span>
          </div>
        </div>

        {/* Action Routing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onNavigateTab('review')}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-mono font-bold text-white hover:bg-slate-800 transition shadow-sm cursor-pointer"
          >
            <Eye className="h-4 w-4 text-[#C38B4B]" />
            <span>Open Review Queue</span>
          </button>

          <button
            onClick={() => onNavigateTab('upload')}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Upload Another File</span>
          </button>
        </div>

        <button
          onClick={() => onNavigateTab('dashboard')}
          className="text-xs font-mono text-slate-500 hover:text-slate-900 hover:underline inline-flex items-center gap-1 transition"
        >
          <span>Return to Command Centre</span>
          <ArrowRight className="h-3 w-3" />
        </button>

      </div>
    </div>
  );
};
