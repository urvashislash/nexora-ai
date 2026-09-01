import React from 'react';
import { ShieldAlert, Home, Terminal, RefreshCw } from 'lucide-react';

interface NotFoundProps {
  onNavigateHome: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onNavigateHome }) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-card p-8 text-center space-y-6 shadow-xl border border-slate-200">
        
        {/* Visual Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
          <ShieldAlert className="h-8 w-8" />
        </div>

        {/* Status Code & Headings */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            HTTP 404 • ROUTE_NOT_FOUND
          </div>
          <h1 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
            Signal Lost in Pipeline
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
            The requested schedule node, evidence document, or ledger view does not exist in the active project topology.
          </p>
        </div>

        {/* Technical Telemetry Box */}
        <div className="p-3.5 rounded-lg bg-slate-900 text-left font-mono text-[11px] text-slate-300 space-y-1.5 shadow-inner">
          <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-1 text-[10px] uppercase font-bold">
            <Terminal className="h-3 w-3 text-[#C38B4B]" />
            <span>Telemetry Diagnostic</span>
          </div>
          <p><span className="text-slate-500">Resource:</span> <span className="text-amber-400">{typeof window !== 'undefined' ? window.location.pathname : '/unknown'}</span></p>
          <p><span className="text-slate-500">Status:</span> <span className="text-rose-400">UNRESOLVED_RESOURCE</span></p>
          <p><span className="text-slate-500">Trust Engine:</span> <span className="text-emerald-400">ACTIVE</span></p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onNavigateHome}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-mono font-bold text-white hover:bg-slate-800 transition shadow-sm cursor-pointer"
          >
            <Home className="h-4 w-4 text-[#C38B4B]" />
            <span>Return to Command Centre</span>
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-mono font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload</span>
          </button>
        </div>

      </div>
    </div>
  );
};
