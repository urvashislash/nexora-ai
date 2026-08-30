import React from 'react';
import { 
  X, 
  Calendar, 
  Layers, 
  MapPin, 
  Tag, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck
} from 'lucide-react';
import type { ActivityWithState } from '../types';

interface ActivityDrawerProps {
  item: ActivityWithState | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({ item, isOpen, onClose }) => {
  if (!isOpen || !item) return null;

  const { activity, state } = item;
  const status = state?.execution_status || 'NOT_STARTED';
  const progress = state?.current_progress_pct || 0;

  const getStatusBadge = () => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DELAYED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'BLOCKED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="signal-tick bg-[#C38B4B]" />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  Activity 360° Operational Sheet
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold font-mono text-slate-900">{activity.code}</h2>
                <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${getStatusBadge()}`}>
                  {status}
                </span>
                {activity.critical_path && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    CRITICAL PATH
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-700 mt-1 leading-snug">{activity.name}</p>
            </div>
            <button 
              onClick={onClose}
              className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Progress & Quantity Bar */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-slate-500 uppercase font-semibold">Actualized Progress</span>
                <span className="font-bold text-slate-900 text-sm">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-3">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 block">Planned Quantity:</span>
                  <span className="font-semibold text-slate-800">{activity.planned_quantity || '—'} {activity.unit_of_measure}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Cumulative Installed:</span>
                  <span className="font-semibold text-slate-800">{state?.cumulative_quantity ?? '—'} {activity.unit_of_measure}</span>
                </div>
              </div>
            </div>

            {/* Schedule Dates & Timeline Comparison */}
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Schedule Baseline vs Actuals
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded border border-slate-200 bg-white">
                  <span className="text-slate-400 text-[10px] uppercase block mb-1">Baseline Start / Finish</span>
                  <div className="font-semibold text-slate-800">{activity.planned_start_date}</div>
                  <div className="font-semibold text-slate-800">{activity.planned_finish_date}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Duration: {activity.planned_duration_days} days</div>
                </div>

                <div className="p-3 rounded border border-slate-200 bg-white">
                  <span className="text-slate-400 text-[10px] uppercase block mb-1">Actual Start / Finish</span>
                  <div className="font-semibold text-slate-800">{state?.actual_start_date || 'Not recorded'}</div>
                  <div className="font-semibold text-slate-800">{state?.actual_finish_date || 'Incomplete'}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Variance: <span className={state?.variance_days && state.variance_days > 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}>{state?.variance_days ?? 0} days</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Engineering & Spatial Metadata */}
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-500" />
                Engineering Attributes
              </h3>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs font-mono bg-white">
                <div className="flex justify-between p-3">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    Discipline
                  </span>
                  <span className="font-semibold text-slate-900">{activity.discipline}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    Location & Zone
                  </span>
                  <span className="font-semibold text-slate-900">{activity.location || '—'} / {activity.zone || '—'}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    Equipment Tag
                  </span>
                  <span className="font-semibold text-slate-900">{activity.equipment_tag || '—'}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                    Weightage in Schedule
                  </span>
                  <span className="font-semibold text-slate-900">{activity.weightage}%</span>
                </div>
              </div>
            </div>

            {/* Trust Plane & Validation Preconditions */}
            <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-2 text-emerald-800">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-bold font-mono uppercase">Rust Trust Validation Preconditions</span>
              </div>
              <ul className="text-xs text-emerald-900/80 space-y-1.5 font-mono">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Start Date Predecessor Rule: Verified</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Progress Monotonicity: Enforced (&Delta; &ge; 0%)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Evidence Requirement: Inspection or Daily Report tagged</span>
                </li>
              </ul>
            </div>

          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">ID: {activity.id.slice(0, 18)}...</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-slate-900 text-white font-sans font-medium text-xs hover:bg-slate-800 transition"
            >
              Close Sheet
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
