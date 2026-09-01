import React from 'react';
import { CheckCircle2, ArrowRight, Eye, PlusCircle } from 'lucide-react';
import { generateEntityId } from '../lib/idGenerator';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';

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
      <Card className="max-w-lg w-full p-8 text-center space-y-6 shadow-2xl border-emerald-200/80 bg-white">
        
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#34C759] shadow-2xs">
          <CheckCircle2 className="h-9 w-9" />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5">
            <Badge variant="success">VERIFIED</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-sans text-slate-900 tracking-tight">
            Submission Confirmed
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto font-sans">
            Your submission was signed and added to the NEXORA ledger.
          </p>
        </div>

        {/* Verification Provenance Card */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 text-left font-sans text-xs space-y-2">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">Submission Type:</span>
            <span className="font-semibold text-slate-800">{submissionDetails.type}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">Record ID:</span>
            <span className="font-mono text-emerald-700 font-bold">{submissionDetails.id}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">Timestamp (UTC):</span>
            <span className="text-slate-700 font-mono text-[11px]">{new Date(submissionDetails.timestamp || '').toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-slate-500">Trust State:</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
              Policy checks passed
            </span>
          </div>
        </div>

        {/* Action Routing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            onClick={() => onNavigateTab('review')}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            <Eye className="h-4 w-4 text-[#C38B4B]" />
            <span>Open Review Queue</span>
          </Button>

          <Button
            onClick={() => onNavigateTab('upload')}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Upload Another File</span>
          </Button>
        </div>

        <button
          onClick={() => onNavigateTab('dashboard')}
          className="text-xs font-sans text-slate-500 hover:text-slate-900 hover:underline inline-flex items-center gap-1 transition cursor-pointer"
        >
          <span>Return to Command Centre</span>
          <ArrowRight className="h-3 w-3" />
        </button>

      </Card>
    </div>
  );
};
