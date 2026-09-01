import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  ChevronRight, 
  AlertTriangle,
  Flame
} from 'lucide-react';
import type { DashboardKPIs, ActivityWithState } from '../types';
import { animateCounter, animateSvgDraw } from '../lib/animations';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

interface DashboardProps {
  kpis: DashboardKPIs;
  activities: ActivityWithState[];
  onNavigateTab: (tab: string) => void;
  onSelectActivity?: (act: ActivityWithState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  kpis, 
  activities, 
  onNavigateTab,
  onSelectActivity
}) => {
  const overallProgRef = useRef<HTMLSpanElement>(null);
  const sCurvePathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    animateCounter(overallProgRef.current, kpis.overall_progress_pct, { duration: 900, suffix: '%' });
    if (sCurvePathRef.current) {
      animateSvgDraw(sCurvePathRef.current, 1200);
    }
  }, [kpis]);

  const criticalActivities = activities.filter(a => a.activity.critical_path);
  const delayedActivities = activities.filter(a => (a.state?.variance_days ?? 0) > 0 || a.state?.execution_status === 'DELAYED');

  return (
    <motion.div 
      className="space-y-6 pb-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* LEVEL 1: PRIMARY DECISION HERO BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="signal-tick bg-[#34C759]" />
              <span className="text-[10px] font-sans text-slate-500 font-semibold uppercase tracking-wider">
                Project Schedule Status
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">
              Project is on schedule <span className="text-[#34C759] font-medium text-lg md:text-xl font-sans">(+2 days ahead of baseline)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              Paradip–Hyderabad Refinery Expansion &bull; Last synchronized with Trust Plane at 16:40
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => onNavigateTab('upload')}
              variant="default"
              size="default"
              className="flex items-center gap-2"
            >
              <span>Ingest Field Report</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar & Decision Metrics */}
        <div className="space-y-3.5 pt-2 border-t border-slate-100">
          <div className="flex justify-between items-baseline text-xs font-sans">
            <span className="text-slate-600">
              <strong ref={overallProgRef} className="text-slate-900 font-bold text-sm font-mono">{kpis.overall_progress_pct}%</strong> Actual Physical Progress &bull; <span className="text-slate-500">25% Planned Target</span>
            </span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 font-mono text-[11px]">
              +2.0 pts Variance
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-[#34C759] h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, Math.max(5, kpis.overall_progress_pct))}%` }}
            />
          </div>

          {/* 3 Compact Decision Count Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div 
              onClick={() => onNavigateTab('schedule')}
              className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70 hover:border-slate-300 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-50 text-[#FF9500]">
                  <Flame className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-slate-800 font-sans">Critical Path</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900">{criticalActivities.length} items</span>
            </div>

            <div 
              onClick={() => onNavigateTab('schedule')}
              className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70 hover:border-slate-300 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-rose-50 text-[#FF3B30]">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-slate-800 font-sans">Delayed Activities</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900">{delayedActivities.length} items</span>
            </div>

            <div 
              onClick={() => onNavigateTab('review')}
              className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/70 hover:border-amber-300 hover:bg-amber-50/80 transition-all duration-150 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-100/80 text-amber-800">
                  <Clock className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-amber-900 font-sans">Review Required</span>
              </div>
              <Badge variant="warning">{kpis.review_queue_count} pending</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* LEVEL 2: SCHEDULE PERFORMANCE S-CURVE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight font-sans">Project schedule performance</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">
              Cumulative physical S-curve actuals measured against baseline L5 target
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-sans">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-300 border-b border-dashed border-slate-400" />
              <span className="text-slate-500 font-normal">Baseline Planned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#34C759] rounded-full" />
              <span className="text-emerald-700 font-semibold font-mono">Actual Progress ({kpis.overall_progress_pct}%)</span>
            </div>
          </div>
        </div>

        {/* S-Curve Chart Canvas */}
        <div className="relative w-full h-56 bg-slate-50/50 rounded-xl p-2 overflow-hidden border border-slate-100">
          <svg viewBox="0 0 500 160" className="w-full h-full">
            {/* Grid lines */}
            <line x1="40" y1="20" x2="480" y2="20" stroke="#E2E8F0" strokeDasharray="3 3" />
            <line x1="40" y1="60" x2="480" y2="60" stroke="#E2E8F0" strokeDasharray="3 3" />
            <line x1="40" y1="100" x2="480" y2="100" stroke="#E2E8F0" strokeDasharray="3 3" />
            <line x1="40" y1="140" x2="480" y2="140" stroke="#CBD5E1" strokeWidth="1.5" />

            {/* Y Axis Labels */}
            <text x="32" y="24" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="SF Mono, IBM Plex Mono, monospace">100%</text>
            <text x="32" y="64" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="SF Mono, IBM Plex Mono, monospace">66%</text>
            <text x="32" y="104" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="SF Mono, IBM Plex Mono, monospace">33%</text>
            <text x="32" y="144" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="SF Mono, IBM Plex Mono, monospace">0%</text>

            {/* Vertical "Today" Line */}
            <line x1="360" y1="15" x2="360" y2="140" stroke="#34C759" strokeDasharray="2 2" strokeWidth="1" />

            {/* Baseline Planned Path */}
            <path
              d="M 40 140 C 150 140, 200 105, 300 55 C 380 25, 430 20, 480 20"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Actual Path */}
            <path
              ref={sCurvePathRef}
              d="M 40 140 C 130 140, 180 115, 270 75 C 310 58, 340 50, 360 46"
              fill="none"
              stroke="#34C759"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Today Indicator Point */}
            <circle cx="360" cy="46" r="5" fill="#34C759" stroke="#FFFFFF" strokeWidth="2" />

            {/* Today Callout */}
            <g transform="translate(360, 46)">
              <text x="0" y="-10" fontSize="9" fill="#047857" textAnchor="middle" fontWeight="bold" fontFamily="SF Mono, IBM Plex Mono, monospace">
                Today ({kpis.overall_progress_pct}%)
              </text>
            </g>

            {/* Milestone Markers */}
            <g transform="translate(180, 115)">
              <circle cx="0" cy="0" r="3" fill="#007AFF" />
              <text x="0" y="-6" fontSize="8" fill="#007AFF" textAnchor="middle" fontFamily="SF Pro Text, Inter, sans-serif">Foundation Handover</text>
            </g>

            {/* X Axis Date Labels */}
            <text x="40" y="154" fontSize="9" fill="#94A3B8" textAnchor="start" fontFamily="SF Mono, IBM Plex Mono, monospace">01-Aug</text>
            <text x="180" y="154" fontSize="9" fill="#94A3B8" textAnchor="middle" fontFamily="SF Mono, IBM Plex Mono, monospace">15-Aug</text>
            <text x="360" y="154" fontSize="9" fill="#047857" textAnchor="middle" fontWeight="bold" fontFamily="SF Mono, IBM Plex Mono, monospace">01-Sep</text>
            <text x="480" y="154" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="SF Mono, IBM Plex Mono, monospace">30-Sep</text>
          </svg>
        </div>
      </div>

      {/* LEVEL 3: ACTION REQUIRED & RECENT FIELD DIGEST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Needs Attention Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight font-sans">Needs planner attention</h3>
              <p className="text-xs text-slate-500 font-sans">Unresolved AI match proposals requiring human signoff</p>
            </div>
            <Button 
              onClick={() => onNavigateTab('review')}
              variant="outline" 
              size="sm"
            >
              Open Queue ({kpis.review_queue_count})
            </Button>
          </div>

          <div className="space-y-2">
            {activities.slice(0, 3).map((act, i) => (
              <div 
                key={i}
                onClick={() => {
                  if (onSelectActivity) onSelectActivity(act);
                  else onNavigateTab('review');
                }}
                className="p-3.5 bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/70 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{act.activity.code}</span>
                    <Badge variant={i === 0 ? 'warning' : 'secondary'}>
                      {i === 0 ? '76% Match' : '82% Match'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5 font-sans">{act.activity.name}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-sans font-semibold text-[#C38B4B] group-hover:underline">
                    Review &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Field Digest */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight font-sans">Recent field activity</h3>
              <p className="text-xs text-slate-500 font-sans">Latest extracted observation facts</p>
            </div>
            <Badge variant="outline">{kpis.total_observations} TOTAL</Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/70 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-[11px] font-sans">
                <span className="font-semibold text-emerald-900">Auto-Linked: PIP-2400</span>
                <span className="text-emerald-700 font-mono">100% Match</span>
              </div>
              <p className="text-slate-700 font-sans text-xs">Spool erection on Pipe Rack B Tier 2 completed with torque check.</p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-[11px] font-sans">
                <span className="font-semibold text-slate-900">Voice Note Captured</span>
                <span className="text-slate-500 font-mono">Audio VAD</span>
              </div>
              <p className="text-slate-700 font-sans text-xs">Hydrostatic testing completed along Pipe Rack B headers.</p>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
