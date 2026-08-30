import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  FileText, 
  TrendingUp, 
  Layers, 
  ShieldCheck, 
  ArrowUpRight,
  HardHat,
  Gauge,
  Flame,
  Zap,
  Cpu
} from 'lucide-react';
import type { DashboardKPIs, ActivityWithState, Discipline } from '../types';

interface DashboardProps {
  kpis: DashboardKPIs;
  activities: ActivityWithState[];
  onNavigateTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ kpis, activities, onNavigateTab }) => {
  const disciplineIcons: Record<string, any> = {
    PIPING: Flame,
    CIVIL: HardHat,
    MECHANICAL: Gauge,
    ELECTRICAL: Zap,
    INSTRUMENTATION: Cpu,
    HSE: ShieldCheck,
  };

  const disciplines: Discipline[] = ['PIPING', 'CIVIL', 'MECHANICAL', 'ELECTRICAL', 'INSTRUMENTATION'];

  return (
    <div className="space-y-6">
      {/* Hero / Header Section */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Executive Project & Actual Progress Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Intelligent Data Capture & Schedule-Linking Layer · Real-time Actual vs Baseline Reconciliation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigateTab('upload')}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 hover:bg-sky-500 transition"
          >
            <span>Upload Field Report</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Ingested Observations */}
        <div className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Field Observations</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{kpis.total_observations}</span>
            <span className="text-xs font-medium text-emerald-400">+100% extracted</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Extracted from PDFs, Excel & Voice</p>
        </div>

        {/* Auto-Linked Events (High Confidence) */}
        <div className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Auto-Linked Events</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400">{kpis.auto_linked_events}</span>
            <span className="text-xs font-medium text-slate-400">Confidence ≥ 88%</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Validated and committed by Rust layer</p>
        </div>

        {/* Planner Review Queue */}
        <div 
          onClick={() => onNavigateTab('review')}
          className="glass-card rounded-xl p-5 relative overflow-hidden cursor-pointer border-amber-500/30 hover:border-amber-500/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Planner Review Queue</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400">{kpis.review_queue_count}</span>
            <span className="text-xs font-medium text-amber-400/80">Pending Action</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Ambiguous matches awaiting human signoff</p>
        </div>

        {/* Overall Schedule Progress */}
        <div className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall Progress</span>
            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-400">{kpis.overall_progress_pct}%</span>
            <span className="text-xs font-medium text-slate-400">{kpis.completed_activities} of {activities.length} completed</span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(5, kpis.overall_progress_pct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trust Plane Mental Model Banner */}
      <div className="glass-panel rounded-xl p-5 border border-sky-900/50 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-sky-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-300">
              Authoritative NEXORA Architecture & Trust Plane
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Zero Hallucination Guarantee</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
            <div className="text-xs font-bold text-sky-400">1. Ingestion Plane</div>
            <div className="text-[11px] text-slate-400 mt-1">PDFs, Excel & Audio stored in Supabase</div>
          </div>
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
            <div className="text-xs font-bold text-indigo-400">2. Python AI Plane</div>
            <div className="text-[11px] text-slate-400 mt-1">Extraction, Normalizer & 384-d Embeddings</div>
          </div>
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
            <div className="text-xs font-bold text-emerald-400">3. Rust Trust Layer</div>
            <div className="text-[11px] text-slate-400 mt-1">Date Rules & Predecessor Validation</div>
          </div>
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
            <div className="text-xs font-bold text-amber-400">4. Human Review</div>
            <div className="text-[11px] text-slate-400 mt-1">Planner Approval for Ambiguity</div>
          </div>
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
            <div className="text-xs font-bold text-purple-400">5. Event Ledger</div>
            <div className="text-[11px] text-slate-400 mt-1">Immutable PostgreSQL + SHA256 Audit</div>
          </div>
        </div>
      </div>

      {/* Discipline Breakdown & Activity Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Discipline Cards */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-base font-semibold text-white">Discipline Status Breakdown</h3>
          <div className="space-y-2">
            {disciplines.map((disc) => {
              const Icon = disciplineIcons[disc] || Layers;
              const discActivities = activities.filter(a => a.activity.discipline === disc);
              const completedCount = discActivities.filter(a => a.state?.execution_status === 'COMPLETED').length;
              const totalCount = discActivities.length;
              const progress = totalCount > 0 
                ? (discActivities.reduce((acc, a) => acc + (a.state?.current_progress_pct || 0), 0) / totalCount).toFixed(0)
                : 0;

              return (
                <div key={disc} className="glass-card rounded-lg p-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="rounded-lg bg-slate-800/80 p-2 text-sky-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{disc}</div>
                      <div className="text-xs text-slate-400">{completedCount} of {totalCount} activities done</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-sky-400">{progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule Activities Overview */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Critical Path Activities & Live Status</h3>
            <button 
              onClick={() => onNavigateTab('schedule')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              View Full WBS Schedule →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 font-semibold">Activity Code</th>
                  <th className="pb-3 font-semibold">Name & Description</th>
                  <th className="pb-3 font-semibold">Discipline</th>
                  <th className="pb-3 font-semibold">Planned Dates</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actual %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activities.slice(0, 5).map(({ activity, state }) => {
                  const status = state?.execution_status || 'NOT_STARTED';
                  const statusColor = 
                    status === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' :
                    status === 'IN_PROGRESS' ? 'bg-sky-950/80 text-sky-400 border-sky-800' :
                    status === 'DELAYED' ? 'bg-rose-950/80 text-rose-400 border-rose-800' :
                    'bg-slate-900 text-slate-400 border-slate-700';

                  return (
                    <tr key={activity.id} className="hover:bg-slate-800/30">
                      <td className="py-3 font-mono font-bold text-sky-400">{activity.code}</td>
                      <td className="py-3">
                        <div className="font-medium text-white">{activity.name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-xs">{activity.description}</div>
                      </td>
                      <td className="py-3">
                        <span className="rounded px-2 py-0.5 text-xs font-semibold bg-slate-800 text-slate-300">
                          {activity.discipline}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-slate-300 font-mono">
                        {activity.planned_start_date} → {activity.planned_finish_date}
                      </td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-white font-mono">
                        {state?.current_progress_pct.toFixed(0) || 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
