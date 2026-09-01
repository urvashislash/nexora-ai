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
import { Card, CardTitle, CardDescription } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

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
      <Card className="p-6 sm:p-7 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="signal-tick bg-[#34C759]" />
              <Badge variant="success">ON SCHEDULE</Badge>
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

          <Progress 
            value={Math.min(100, Math.max(5, kpis.overall_progress_pct))} 
            className="h-2.5 bg-slate-100"
            indicatorClassName="bg-[#34C759]"
          />

          {/* 3 Compact Decision Count Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div 
              onClick={() => onNavigateTab('schedule')}
              className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70 hover:border-slate-300 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
                  <Flame className="h-4 w-4 text-[#FF9500]" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 font-sans block">
                    {criticalActivities.length} Critical Path Tasks
                  </span>
                  <span className="text-[11px] text-slate-500 font-sans">0 currently at risk</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900">&rarr;</span>
            </div>

            <div 
              onClick={() => onNavigateTab('review')}
              className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70 hover:border-slate-300 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
                  <Clock className="h-4 w-4 text-[#C38B4B]" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 font-sans block">
                    {kpis.review_queue_count} Reviews Pending
                  </span>
                  <span className="text-[11px] text-slate-500 font-sans">Requires planner decision</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-[#C38B4B]">&rarr;</span>
            </div>

            <div 
              onClick={() => onNavigateTab('schedule')}
              className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70 hover:border-slate-300 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
                  <AlertTriangle className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 font-sans block">
                    {delayedActivities.length} Delayed Tasks
                  </span>
                  <span className="text-[11px] text-slate-500 font-sans">Within tolerance limits</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900">&rarr;</span>
            </div>
          </div>
        </div>
      </Card>

      {/* LEVEL 2: S-CURVE PERFORMANCE CHART */}
      <Card className="p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              S-Curve Physical Progress Variance
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Cumulative planned baseline vs actual reconciled progress over time
            </CardDescription>
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
      </Card>

      {/* LEVEL 3: ACTION REQUIRED & RECENT FIELD DIGEST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Needs Attention Table */}
        <Card className="lg:col-span-7 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">Needs planner attention</CardTitle>
              <CardDescription className="text-xs text-slate-500">Unresolved AI match proposals requiring human signoff</CardDescription>
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
        </Card>

        {/* Recent Field Digest */}
        <Card className="lg:col-span-5 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">Recent field activity</CardTitle>
              <CardDescription className="text-xs text-slate-500">Latest extracted observation facts</CardDescription>
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
        </Card>

      </div>
    </motion.div>
  );
};
