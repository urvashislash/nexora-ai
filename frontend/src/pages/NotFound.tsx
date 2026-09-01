import React from 'react';
import { ShieldAlert, Home, Terminal, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';

interface NotFoundProps {
  onNavigateHome: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onNavigateHome }) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl border-slate-200 bg-white">
        
        {/* Visual Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#FF9500] shadow-2xs">
          <ShieldAlert className="h-8 w-8" />
        </div>

        {/* Status Code & Headings */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2">
            <Badge variant="warning">HTTP 404 &bull; ROUTE_NOT_FOUND</Badge>
          </div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">
            Signal Lost in Pipeline
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto font-sans">
            The requested schedule node, evidence document, or ledger view does not exist in the active project topology.
          </p>
        </div>

        {/* Technical Telemetry Box */}
        <div className="p-3.5 rounded-xl bg-slate-950 text-left font-mono text-[11px] text-slate-300 space-y-1.5 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-1 text-[10px] uppercase font-semibold font-sans">
            <Terminal className="h-3 w-3 text-[#C38B4B]" />
            <span>Telemetry Diagnostic</span>
          </div>
          <p><span className="text-slate-500">Resource:</span> <span className="text-amber-400">{typeof window !== 'undefined' ? window.location.pathname : '/unknown'}</span></p>
          <p><span className="text-slate-500">Status:</span> <span className="text-[#FF3B30]">UNRESOLVED_RESOURCE</span></p>
          <p><span className="text-slate-500">Trust Engine:</span> <span className="text-[#34C759]">ACTIVE</span></p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={onNavigateHome}
            variant="default"
            size="default"
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4 text-[#C38B4B]" />
            <span>Return to Overview</span>
          </Button>
          
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload</span>
          </Button>
        </div>

      </Card>
    </div>
  );
};
