import React, { useEffect, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { 
  Clock, 
  ChevronRight, 
  AlertTriangle, 
  Flame,
  CheckCircle2,
  FileText,
  Calendar
} from 'lucide-react';
import type { DashboardKPIs, ActivityWithState, Project, ReviewQueueItem, WorkObservation } from '../types';
import { animateCounter, animateSvgDraw } from '../lib/animations';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardTitle, CardDescription } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

interface DashboardProps {
  kpis: DashboardKPIs;
  activities: ActivityWithState[];
  project?: Project | null;
  reviewQueue?: ReviewQueueItem[];
  observations?: WorkObservation[];
  onNavigateTab: (tab: string) => void;
  onSelectActivity?: (act: ActivityWithState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  kpis, 
  activities, 
  project,
  reviewQueue = [],
  observations = [],
  onNavigateTab,
  onSelectActivity
}) => {
  const overallProgRef = useRef<HTMLSpanElement>(null);
  const sCurvePathRef = useRef<SVGPathElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    animateCounter(overallProgRef.current, kpis.overall_progress_pct, { duration: 900, suffix: '%' });
    if (sCurvePathRef.current) {
      animateSvgDraw(sCurvePathRef.current, 1200);
    }
  }, [kpis]);

  const criticalActivities = useMemo(() => activities.filter(a => a.activity.critical_path), [activities]);
  const delayedActivities = useMemo(() => 
    activities.filter(a => (a.state?.variance_days ?? 0) > 0 || a.state?.execution_status === 'DELAYED'),
    [activities]
  );

  const maxVarianceDays = useMemo(() => {
    if (delayedActivities.length === 0) return 0;
    return Math.max(...delayedActivities.map(a => a.state?.variance_days || 0));
  }, [delayedActivities]);

  // Compute schedule date range for dynamic S-Curve
  const scheduleTimeline = useMemo(() => {
    if (activities.length === 0) {
      return null;
    }
    let minTime = Infinity;
    let maxTime = -Infinity;
    activities.forEach(item => {
      const s = new Date(item.activity.planned_start_date).getTime();
      const f = new Date(item.activity.planned_finish_date).getTime();
      if (!isNaN(s) && s < minTime) minTime = s;
      if (!isNaN(f) && f > maxTime) maxTime = f;
    });

    if (minTime === Infinity || maxTime === -Infinity) return null;
    const totalSpan = Math.max(24 * 60 * 60 * 1000, maxTime - minTime);

    // Dynamic planned progress estimation based on current date relative to planned dates
    const now = Date.now();
    let totalWeight = 0;
    let plannedWeightSum = 0;

    activities.forEach(item => {
      const s = new Date(item.activity.planned_start_date).getTime();
      const f = new Date(item.activity.planned_finish_date).getTime();
      const weight = item.activity.weightage || 1;
      totalWeight += weight;

      if (!isNaN(s) && !isNaN(f)) {
        if (now >= f) {
          plannedWeightSum += 100 * weight;
        } else if (now > s) {
          const actDuration = Math.max(1, f - s);
          const actElapsed = now - s;
          const actPlannedPct = Math.min(100, Math.max(0, (actElapsed / actDuration) * 100));
          plannedWeightSum += actPlannedPct * weight;
        }
      }
    });

    const plannedProgressPct = totalWeight > 0 ? Math.round(plannedWeightSum / totalWeight) : 0;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const tickDates = [0, 0.33, 0.66, 1.0].map(ratio => {
      const d = new Date(minTime + ratio * totalSpan);
      return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}`;
    });

    const todayRatio = Math.min(1, Math.max(0, (now - minTime) / totalSpan));
    const todayX = 40 + todayRatio * (480 - 40);

    return {
      minTime,
      maxTime,
      totalSpan,
      plannedProgressPct,
      tickDates,
      todayX,
    };
  }, [activities]);

  const plannedPct = scheduleTimeline ? scheduleTimeline.plannedProgressPct : 0;
  const variancePts = kpis.overall_progress_pct - plannedPct;

  // Project Health Narrative determination
  const projectHealth = useMemo(() => {
    if (activities.length === 0) {
      return {
        badgeVariant: 'secondary' as const,
        badgeLabel: 'NO BASELINE',
        title: 'Schedule baseline required',
        subtitle: `${project?.name || 'Project'} • Import schedule to activate Trust Plane validation`,
        isDelayed: false,
      };
    }
    if (delayedActivities.length > 0) {
      return {
        badgeVariant: 'destructive' as const,
        badgeLabel: 'BEHIND SCHEDULE',
        title: `${delayedActivities.length} ${delayedActivities.length === 1 ? 'activity' : 'activities'} delayed (-${maxVarianceDays}d max variance)`,
        subtitle: `${project?.name || 'Project'} • ${criticalActivities.length} critical path activities tracked`,
        isDelayed: true,
      };
    }
    return {
      badgeVariant: 'success' as const,
      badgeLabel: 'ON SCHEDULE',
      title: 'Project is on schedule',
      subtitle: `${project?.name || 'Project'} • All activities within baseline schedule parameters`,
      isDelayed: false,
    };
  }, [activities.length, delayedActivities.length, maxVarianceDays, criticalActivities.length, project?.name]);

  // S-Curve Actual progress curve calculation
  const sCurveActualY = useMemo(() => {
    const pct = Math.min(100, Math.max(0, kpis.overall_progress_pct));
    return 140 - (pct / 100) * (140 - 20);
  }, [kpis.overall_progress_pct]);

  const todayXCoord = scheduleTimeline ? scheduleTimeline.todayX : 260;

  return (
    <motion.div 
      className="space-y-6 pb-12"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
    >
      {/* LEVEL 1: PRIMARY DECISION HERO BANNER */}
      <Card className="p-6 sm:p-7 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`signal-tick ${projectHealth.isDelayed ? 'bg-rose-600' : 'bg-[#34C759]'}`} />
              <Badge variant={projectHealth.badgeVariant}>{projectHealth.badgeLabel}</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">
              {projectHealth.title}{' '}
              {activities.length > 0 && (
                <span className={`font-medium text-lg md:text-xl font-sans ${variancePts >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  ({variancePts >= 0 ? `+${variancePts}` : `${variancePts}`} pts vs planned)
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-600 mt-1 font-sans">
              {projectHealth.subtitle}
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
            <span className="text-slate-700">
              Actual / planned: <strong ref={overallProgRef} className="text-slate-900 font-bold text-sm font-mono">{kpis.overall_progress_pct}%</strong>
              <span className="text-slate-600"> / {plannedPct}%</span>
            </span>
            <span className={`font-semibold px-2 py-0.5 rounded-md border font-mono text-[11px] ${
              variancePts >= 0 
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200/80' 
                : 'text-rose-800 bg-rose-50 border-rose-200/80'
            }`}>
              {variancePts >= 0 ? `+${variancePts}` : `${variancePts}`} pts Variance
            </span>
          </div>

          <Progress 
            value={Math.min(100, Math.max(0, kpis.overall_progress_pct))} 
            className="h-2.5 bg-slate-100"
            indicatorClassName={variancePts >= 0 ? 'bg-[#34C759]' : 'bg-rose-500'}
          />

          {/* Decision shortcuts */}
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onNavigateTab('schedule')}
              aria-label={`View ${criticalActivities.length} critical path tasks`}
              className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-100/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
                  <Flame className="h-4 w-4 text-[#D97706]" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 font-sans block">
                    {criticalActivities.length} Critical Path Tasks
                  </span>
                  <span className="text-[11px] text-slate-600 font-sans">
                    {delayedActivities.filter(a => a.activity.critical_path).length} currently at risk
                  </span>
                </div>
              </div>
              <span aria-hidden="true" className="text-xs font-mono font-bold text-slate-900">&rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('review')}
              aria-label={`View ${kpis.review_queue_count} pending reviews requiring planner decision`}
              className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-100/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
                  <Clock className="h-4 w-4 text-amber-800" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 font-sans block">
                    {kpis.review_queue_count} Reviews Pending
                  </span>
                  <span className="text-[11px] text-slate-600 font-sans">
                    {kpis.review_queue_count > 0 ? 'Requires planner decision' : 'All proposals cleared'}
                  </span>
                </div>
              </div>
              <span aria-hidden="true" className="text-xs font-mono font-bold text-amber-800">&rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('schedule')}
              aria-label={`View ${delayedActivities.length} delayed activities`}
              className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-100/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 font-sans block">
                    {delayedActivities.length} Delayed Activities
                  </span>
                  <span className="text-[11px] text-slate-600 font-sans">
                    {maxVarianceDays > 0 ? `Max -${maxVarianceDays}d variance` : 'No variance detected'}
                  </span>
                </div>
              </div>
              <span aria-hidden="true" className="text-xs font-mono font-bold text-rose-600">&rarr;</span>
            </button>
          </div>
        </div>
      </Card>

      {/* LEVEL 2: S-CURVE ANALYTICS CANVAS */}
      <Card className="p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">Project S-Curve Tracking</CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Planned schedule baseline vs authoritative reconciled progress
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="text-slate-600 font-sans">Planned Baseline ({plannedPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
              <span className="text-emerald-800 font-semibold font-mono">Actual Progress ({kpis.overall_progress_pct}%)</span>
            </div>
          </div>
        </div>

        {/* S-Curve Chart Canvas */}
        <div className="relative w-full h-56 bg-slate-50/50 rounded-xl p-2 overflow-hidden border border-slate-100 flex items-center justify-center">
          {scheduleTimeline ? (
            <svg viewBox="0 0 500 160" className="w-full h-full" aria-label="S-Curve chart showing planned baseline versus actual reconciled progress">
              {/* Grid lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1="40" y1="60" x2="480" y2="60" stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1="40" y1="100" x2="480" y2="100" stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1="40" y1="140" x2="480" y2="140" stroke="#CBD5E1" strokeWidth="1.5" />

              {/* Y Axis Labels */}
              <text x="32" y="24" fontSize="9" fill="#64748B" textAnchor="end" fontFamily="monospace">100%</text>
              <text x="32" y="64" fontSize="9" fill="#64748B" textAnchor="end" fontFamily="monospace">66%</text>
              <text x="32" y="104" fontSize="9" fill="#64748B" textAnchor="end" fontFamily="monospace">33%</text>
              <text x="32" y="144" fontSize="9" fill="#64748B" textAnchor="end" fontFamily="monospace">0%</text>

              {/* Vertical "Today" Line */}
              <line x1={todayXCoord} y1="15" x2={todayXCoord} y2="140" stroke="#34C759" strokeDasharray="2 2" strokeWidth="1" />

              {/* Baseline Planned Path */}
              <path
                d="M 40 140 C 150 140, 200 105, 300 55 C 380 25, 430 20, 480 20"
                fill="none"
                stroke="#64748B"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Actual Progress Path derived from current progress */}
              <path
                ref={sCurvePathRef}
                d={`M 40 140 C ${40 + (todayXCoord - 40) * 0.4} 140, ${40 + (todayXCoord - 40) * 0.7} ${(140 + sCurveActualY) / 2}, ${todayXCoord} ${sCurveActualY}`}
                fill="none"
                stroke="#34C759"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Today Indicator Point */}
              <circle cx={todayXCoord} cy={sCurveActualY} r="5" fill="#34C759" stroke="#FFFFFF" strokeWidth="2" />

              {/* Today Callout */}
              <g transform={`translate(${todayXCoord}, ${Math.max(25, sCurveActualY)})`}>
                <text x="0" y="-10" fontSize="9" fill="#065F46" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                  Today ({kpis.overall_progress_pct}%)
                </text>
              </g>

              {/* X Axis Date Labels */}
              <text x="40" y="154" fontSize="9" fill="#64748B" textAnchor="start" fontFamily="monospace">{scheduleTimeline.tickDates[0]}</text>
              <text x="180" y="154" fontSize="9" fill="#64748B" textAnchor="middle" fontFamily="monospace">{scheduleTimeline.tickDates[1]}</text>
              <text x="340" y="154" fontSize="9" fill="#64748B" textAnchor="middle" fontFamily="monospace">{scheduleTimeline.tickDates[2]}</text>
              <text x="480" y="154" fontSize="9" fill="#64748B" textAnchor="end" fontFamily="monospace">{scheduleTimeline.tickDates[3]}</text>
            </svg>
          ) : (
            <div className="text-center p-6 space-y-2">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No schedule baseline data</p>
              <p className="text-[11px] text-slate-500 max-w-sm">Import your project schedule (CSV, Excel, or P6) to generate the baseline S-Curve and track variance.</p>
              <Button size="sm" variant="outline" onClick={() => onNavigateTab('import')} className="mt-2">
                Import Schedule
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* LEVEL 3: ACTION REQUIRED & RECENT FIELD DIGEST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Needs Attention Table */}
        <Card className="lg:col-span-7 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">Needs planner attention</CardTitle>
              <CardDescription className="text-xs text-slate-600">Matches awaiting approval</CardDescription>
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
            {reviewQueue.length > 0 ? (
              reviewQueue.slice(0, 3).map((item) => {
                const conf = Math.round(item.proposal.confidence_score * 100);
                return (
                  <button
                    key={item.proposal.id}
                    type="button"
                    onClick={() => {
                      if (onSelectActivity && item.activity) {
                        const matched = activities.find(a => a.activity.id === item.activity?.id);
                        if (matched) {
                          onSelectActivity(matched);
                          return;
                        }
                      }
                      onNavigateTab('review');
                    }}
                    aria-label={`Review match proposal for ${item.activity?.code || 'Activity'}`}
                    className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-left transition-all duration-150 hover:bg-slate-100/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500"
                  >
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {item.activity?.code || 'UNLINKED'}
                        </span>
                        <Badge variant={conf >= 85 ? 'success' : conf >= 65 ? 'warning' : 'secondary'}>
                          {conf}% Match
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-700 truncate mt-0.5 font-sans">
                        {item.activity?.name || item.observation?.raw_text || 'Observation'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-sans font-semibold text-amber-900 group-hover:underline">
                        Review &rarr;
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-800">All proposals reviewed</p>
                <p className="text-[11px] text-slate-500">No pending AI match proposals awaiting planner approval.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Field Digest */}
        <Card className="lg:col-span-5 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">Recent field activity</CardTitle>
              <CardDescription className="text-xs text-slate-600">Latest extracted facts</CardDescription>
            </div>
            <Badge variant="outline">{kpis.total_observations} TOTAL</Badge>
          </div>

          <div className="space-y-3 text-xs">
            {observations.length > 0 ? (
              observations.slice(0, 3).map((obs) => (
                <div key={obs.id} className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-sans">
                    <span className="font-semibold text-slate-900">
                      {obs.discipline || 'Observation'}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(obs.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-800 font-sans text-xs truncate">{obs.raw_text}</p>
                </div>
              ))
            ) : (
              <div className="py-8 text-center space-y-2">
                <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-800">No observations yet</p>
                <p className="text-[11px] text-slate-500">Upload a daily progress report or field notes to extract observations.</p>
                <Button size="sm" variant="outline" onClick={() => onNavigateTab('upload')} className="mt-2">
                  Upload DPR
                </Button>
              </div>
            )}
          </div>
        </Card>

      </div>
    </motion.div>
  );
};
