import React, { useEffect, useRef } from 'react';
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
import { animateCounter, animateSvgDraw } from '../lib/animations';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

interface DashboardProps {
  kpis: DashboardKPIs;
  activities: ActivityWithState[];
  onNavigateTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ kpis, activities, onNavigateTab }) => {
  const obsCounterRef = useRef<HTMLSpanElement>(null);
  const autoLinkedRef = useRef<HTMLSpanElement>(null);
  const reviewQueueRef = useRef<HTMLSpanElement>(null);
  const overallProgRef = useRef<HTMLSpanElement>(null);
  const sCurvePathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    animateCounter(obsCounterRef.current, kpis.total_observations, { duration: 900 });
    animateCounter(autoLinkedRef.current, kpis.auto_linked_events, { duration: 900 });
    animateCounter(reviewQueueRef.current, kpis.review_queue_count, { duration: 700 });
    animateCounter(overallProgRef.current, kpis.overall_progress_pct, { duration: 1100, suffix: '%' });
    if (sCurvePathRef.current) {
      animateSvgDraw(sCurvePathRef.current, 1400);
    }
  }, [kpis]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } }
  };

  return (
    <motion.div 
      className="space-y-8 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Top Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="signal-tick bg-emerald-500" />
            <Badge variant="bronze">LIVE TRUST PLANE</Badge>
            <span className="text-[10px] font-mono text-slate-400">PostgreSQL + Rust Verification Layer</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-none">
            Project Ground Truth
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-[65ch]">
            Verified field operations and automated schedule reconciliation. Extracted evidence is staged for planner review before committing to the immutable event ledger.
          </p>
        </div>
        <Button 
          onClick={() => onNavigateTab('upload')}
          variant="default"
          size="default"
          className="flex items-center gap-2"
        >
          <span>Ingest Field Report</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* KPI Cards Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingested Observations */}
        <Card className="hover:border-slate-300 transition-all">
          <CardHeader className="p-5 pb-0 flex flex-row items-center justify-between space-y-0">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Field Extractions</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="p-5 pt-3">
            <div className="flex items-baseline gap-2">
              <span ref={obsCounterRef} className="text-3xl font-bold text-slate-900 font-mono tracking-tight">
                {kpis.total_observations}
              </span>
              <Badge variant="success">100% PROCESSED</Badge>
            </div>
            <div className="ledger-rule mt-4 mb-3" />
            <p className="text-[11px] text-slate-500 font-mono">From PDF, Excel & Voice Memos</p>
          </CardContent>
        </Card>

        {/* Auto-Linked Events */}
        <Card className="hover:border-slate-300 transition-all">
          <CardHeader className="p-5 pb-0 flex flex-row items-center justify-between space-y-0">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Auto-Linked Events</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-5 pt-3">
            <div className="flex items-baseline gap-2">
              <span ref={autoLinkedRef} className="text-3xl font-bold text-slate-900 font-mono tracking-tight">
                {kpis.auto_linked_events}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Conf. &ge; 88%</span>
            </div>
            <div className="ledger-rule mt-4 mb-3" />
            <p className="text-[11px] text-slate-500 font-mono">Committed by Rust layer</p>
          </CardContent>
        </Card>

        {/* Planner Review Queue */}
        <Card 
          onClick={() => onNavigateTab('review')}
          className="cursor-pointer group hover:border-amber-300 hover:shadow-md transition-all relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-amber-50/40 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="p-5 pb-0 flex flex-row items-center justify-between space-y-0 relative">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-800">Review Queue</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-5 pt-3 relative">
            <div className="flex items-baseline gap-2">
              <span ref={reviewQueueRef} className="text-3xl font-bold text-slate-900 font-mono tracking-tight">
                {kpis.review_queue_count}
              </span>
              <Badge variant="warning">ACTION REQ.</Badge>
            </div>
            <div className="ledger-rule mt-4 mb-3 border-amber-200" />
            <p className="text-[11px] text-amber-800/80 font-mono">Ambiguous matches pending</p>
          </CardContent>
        </Card>

        {/* Overall Schedule Progress */}
        <Card className="hover:border-slate-300 transition-all">
          <CardHeader className="p-5 pb-0 flex flex-row items-center justify-between space-y-0">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Overall Progress</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-5 pt-3">
            <div className="flex items-baseline gap-2">
              <span ref={overallProgRef} className="text-3xl font-bold text-slate-900 font-mono tracking-tight">
                {kpis.overall_progress_pct}%
              </span>
            </div>
            <div className="mt-4 mb-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, Math.max(5, kpis.overall_progress_pct))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 font-mono">{kpis.completed_activities} of {activities.length} activities done</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Interactive Schedule S-Curve & Critical Path Radar */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <CardTitle className="text-sm font-bold font-mono text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#C38B4B]" />
                <span>Project Schedule S-Curve (Planned vs Actuals)</span>
              </CardTitle>
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

          {/* SVG S-Curve Visualizer with anime.js drawing */}
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

              {/* Actual Cumulative S-Curve (Vibrant Emerald, AnimeJS drawn) */}
              <path
                ref={sCurvePathRef}
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
                  Today ({kpis.overall_progress_pct}%)
                </text>
              </g>

              {/* X Axis Date Labels */}
              <text x="40" y="142" fontSize="9" fill="#94A3B8" textAnchor="start" fontFamily="IBM Plex Mono">01-Aug</text>
              <text x="180" y="142" fontSize="9" fill="#94A3B8" textAnchor="middle" fontFamily="IBM Plex Mono">15-Aug</text>
              <text x="360" y="142" fontSize="9" fill="#047857" textAnchor="middle" fontWeight="bold" fontFamily="IBM Plex Mono">Today</text>
              <text x="480" y="142" fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily="IBM Plex Mono">30-Sep</text>
            </svg>
          </div>
        </Card>

        {/* Critical Path Health & Telemetry Radar */}
        <Card className="lg:col-span-4 p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Critical Path Radar</span>
              <Badge variant="success">ON TRACK</Badge>
            </div>
            
            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Critical Activities:</span>
                <span className="font-bold text-slate-900">{activities.filter(a => a.activity.critical_path).length} / {activities.length} items</span>
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

          <div className="p-3 bg-slate-950 text-white rounded-lg text-[11px] font-mono space-y-1 border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Trust Plane Verification</span>
            </div>
            <div className="text-emerald-400 font-bold">100% Deterministic Consistency</div>
            <div className="text-slate-400 text-[10px]">Zero retroactive date or FS policy violations detected.</div>
          </div>
        </Card>
      </motion.div>

      {/* System Architecture Pipeline Status */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-[#C38B4B]" />
            <span>Operational Architecture Pipeline</span>
          </h2>
          <Badge variant="outline">RFC 7519 + SHA-256 LEDGER</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Cpu className="h-4 w-4 text-purple-600" />
              <span>1. Python AI Ingestion</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              FastAPI + MiniLM 384-d semantic & token jaccard hybrid candidate ranker.
            </p>
          </Card>

          <Card className="p-4 bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Lock className="h-4 w-4 text-emerald-600" />
              <span>2. Rust Trust Plane</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              Enforces date bounds, FS dependency rules, and non-backward state machine.
            </p>
          </Card>

          <Card className="p-4 bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <UserCheck className="h-4 w-4 text-amber-600" />
              <span>3. Planner Review Guard</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              Candidate proposals below 88% confidence staged with diff & reasoning explanation.
            </p>
          </Card>

          <Card className="p-4 bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Activity className="h-4 w-4 text-blue-600" />
              <span>4. PostgreSQL Ledger</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              Row-Level Security, append-only chained audit trail, and Oracle P6 exporter.
            </p>
          </Card>
        </div>
      </motion.div>
    </motion.div>
  );
};
