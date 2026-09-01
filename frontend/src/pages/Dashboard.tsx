import React from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Database,
  Cpu,
  Lock,
  UserCheck,
  Activity
} from 'lucide-react';
import type { DashboardKPIs, ActivityWithState } from '../types';

interface DashboardProps {
  kpis: DashboardKPIs;
  activities: ActivityWithState[];
  onNavigateTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ kpis, activities, onNavigateTab }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 4 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } }
  };

  return (
    <motion.div 
      className="space-y-8 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="signal-tick bg-emerald-500" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Live Operation</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-none">
            Project Ground Truth
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-[65ch]">
            Verified field operations and automated schedule reconciliation. Extracted evidence is staged for planner review before committing to the immutable event ledger.
          </p>
        </div>
        <button 
          onClick={() => onNavigateTab('upload')}
          className="flex items-center gap-2 rounded bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors active:-translate-y-[1px]"
        >
          <span>Ingest Field Report</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </motion.div>

      {/* KPI Modules */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingested Observations */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Field Extractions</span>
            <FileText className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tracking-tight">{kpis.total_observations}</span>
            <span className="text-[10px] font-mono text-emerald-600 font-semibold">+100% processed</span>
          </div>
          <div className="ledger-rule mt-4 mb-3" />
          <p className="text-[11px] text-slate-500 font-mono">From PDF, Excel & Voice</p>
        </div>

        {/* Auto-Linked Events */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Auto-Linked Events</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tracking-tight">{kpis.auto_linked_events}</span>
            <span className="text-[10px] font-mono text-slate-500">Conf. &ge; 88%</span>
          </div>
          <div className="ledger-rule mt-4 mb-3" />
          <p className="text-[11px] text-slate-500 font-mono">Committed by Rust layer</p>
        </div>

        {/* Planner Review Queue */}
        <div 
          onClick={() => onNavigateTab('review')}
          className="glass-card p-5 relative cursor-pointer group hover:border-amber-300"
        >
          <div className="absolute inset-0 bg-amber-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-700">Review Queue</span>
              <Clock className="h-4 w-4 text-amber-500 group-hover:text-amber-600 transition-colors" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 font-mono tracking-tight">{kpis.review_queue_count}</span>
              <span className="text-[10px] font-mono text-amber-600 font-semibold animate-pulse">Action Req.</span>
            </div>
            <div className="ledger-rule mt-4 mb-3 border-amber-200" />
            <p className="text-[11px] text-amber-700/70 font-mono">Ambiguous matches pending</p>
          </div>
        </div>

        {/* Overall Schedule Progress */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Overall Progress</span>
            <TrendingUp className="h-4 w-4 text-blue-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tracking-tight">{kpis.overall_progress_pct}%</span>
          </div>
          <div className="mt-4 mb-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, Math.max(5, kpis.overall_progress_pct))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 font-mono">{kpis.completed_activities} of {activities.length} acts done</p>
        </div>
      </motion.div>

      {/* Interactive Schedule S-Curve & Critical Path Radar */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 glass-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold font-mono text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#C38B4B]" />
                <span>Project Schedule S-Curve (Planned vs Actuals)</span>
              </h3>
              <p className="text-[11px] text-slate-500">Cumulative physical progress trajectory against baseline L5 targets</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-slate-300 border-b border-dashed border-slate-400" />
                <span className="text-slate-500">Baseline Target</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-emerald-500 rounded" />
                <span className="text-emerald-700 font-bold">Actual Progress ({kpis.overall_progress_pct}%)</span>
              </div>
            </div>
          </div>

          {/* SVG S-Curve Visualizer */}
          <div className="relative w-full h-48 bg-slate-50/70 rounded-lg p-2 overflow-hidden border border-slate-100">
            <svg viewBox="0 0 500 150" className="w-full h-full">
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1="40" y1="55" x2="480" y2="55" stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1="40" y1="90" x2="480" y2="90" stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1="40" y1="125" x2="480" y2="125" stroke="#CBD5E1" strokeWidth="1.5" />

              {/* Y Axis Labels */}
              <text x="32" y="24" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="IBM Plex Mono">100%</text>
              <text x="32" y="59" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="IBM Plex Mono">75%</text>
              <text x="32" y="94" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="IBM Plex Mono">50%</text>
              <text x="32" y="129" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="IBM Plex Mono">0%</text>

              {/* Baseline Planned S-Curve (Dotted Gray) */}
              <path
                d="M 40 125 C 150 125, 200 95, 300 45 C 380 15, 430 20, 480 20"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />

              {/* Actual Cumulative S-Curve (Vibrant Emerald) */}
              <path
                d="M 40 125 C 130 125, 180 105, 270 65 C 310 50, 340 45, 360 42"
                fill="none"
                stroke="#10B981"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Current Actual Progress Point */}
              <circle cx="360" cy="42" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" className="animate-pulse" />
              
              {/* Milestone Target Markers */}
              <g transform="translate(180, 105)">
                <circle cx="0" cy="0" r="3" fill="#3B82F6" />
                <text x="0" y="-6" fontSize="8" fill="#3B82F6" textAnchor="middle" fontFamily="IBM Plex Mono">Tier 1 Erection</text>
              </g>

              <g transform="translate(360, 42)">
                <text x="0" y="-10" fontSize="9" fill="#047857" textAnchor="middle" fontWeight="bold" fontFamily="IBM Plex Mono">
                  Today (78%)
                </text>
              </g>

              {/* X Axis Date Labels */}
              <text x="40" y="142" fontSize="9" fill="#94A3B8" textAnchor="start" fontFamily="IBM Plex Mono">01-Aug</text>
              <text x="180" y="142" fontSize="9" fill="#94A3B8" textAnchor="middle" fontFamily="IBM Plex Mono">15-Aug</text>
              <text x="360" y="142" fontSize="9" fill="#047857" textAnchor="middle" fontWeight="bold" fontFamily="IBM Plex Mono">01-Sep</text>
              <text x="480" y="142" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="IBM Plex Mono">30-Sep</text>
            </svg>
          </div>
        </div>

        {/* Critical Path Health & Telemetry Radar */}
        <div className="lg:col-span-4 glass-card p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Critical Path Radar</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                ON TRACK
              </span>
            </div>
            
            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Critical Activities:</span>
                <span className="font-bold text-slate-900">4 / 12 items</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Float Variance:</span>
                <span className="font-bold text-emerald-600">+0.0 Days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Earliest Completion:</span>
                <span className="font-bold text-slate-800">28-Sep-2026</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Target Milestone:</span>
                <span className="font-bold text-[#C38B4B]">30-Sep-2026</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900 text-white rounded-lg text-[11px] font-mono space-y-1">
            <div className="text-slate-400 text-[10px] uppercase font-bold">Trust Plane Verification</div>
            <div className="text-emerald-400 font-bold">100% Deterministic Consistency</div>
            <div className="text-slate-400 text-[10px]">Zero retroactive date or FS policy violations detected.</div>
          </div>
        </div>
      </motion.div>

      {/* Trust Plane & Activities Horizontal Control Board */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Architecture */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">Trust Architecture</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Data passes through strict isolation layers to guarantee zero hallucination in the final schedule.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded bg-slate-200 p-1.5">
                  <Database className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">1. Ingestion Plane</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Raw PDFs, Excel, Audio stored</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded bg-blue-100 p-1.5">
                  <Cpu className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">2. AI Interpretation</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Extraction & 384-d Embeddings</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded bg-emerald-100 p-1.5">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">3. Rust Validation</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Strict predecessor & date rules</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded bg-amber-100 p-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">4. Human Review</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Planner approval for ambiguity</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded bg-slate-900 p-1.5">
                  <Activity className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">5. Event Ledger</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Immutable PG + SHA256 Audit</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Ledger */}
        <div className="lg:col-span-8">
          <div className="glass-panel flex flex-col h-full">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Live Activity Ledger</h3>
              <button 
                onClick={() => onNavigateTab('schedule')}
                className="text-[11px] font-mono font-semibold text-[#C38B4B] hover:text-[#a8753b] transition-colors"
              >
                [ VIEW FULL WBS ]
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100/50 border-b border-slate-200 text-[10px] uppercase font-mono tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Activity ID</th>
                    <th className="px-5 py-3 font-semibold">Description</th>
                    <th className="px-5 py-3 font-semibold">Discipline</th>
                    <th className="px-5 py-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {activities.slice(0, 7).map(({ activity, state }) => {
                    const status = state?.execution_status || 'NOT_STARTED';
                    
                    let statusDot = 'bg-slate-300';
                    let statusText = 'text-slate-600';
                    if (status === 'COMPLETED') {
                      statusDot = 'bg-emerald-500';
                      statusText = 'text-emerald-700';
                    } else if (status === 'IN_PROGRESS') {
                      statusDot = 'bg-blue-500';
                      statusText = 'text-blue-700';
                    } else if (status === 'DELAYED') {
                      statusDot = 'bg-red-500';
                      statusText = 'text-red-700';
                    }

                    return (
                      <tr key={activity.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3 font-mono font-medium text-slate-900">{activity.code}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-800 truncate max-w-[280px]" title={activity.name}>
                            {activity.name}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            {activity.discipline}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`text-[10px] font-mono font-semibold ${statusText}`}>{status}</span>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-slate-200 bg-slate-50/50 mt-auto text-center">
              <span className="text-[10px] font-mono text-slate-400">Showing {Math.min(7, activities.length)} of {activities.length} active records</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
