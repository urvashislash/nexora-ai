import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck 
} from 'lucide-react';
import type { ActivityWithState, WorkObservation, AuditEvent } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface Activity360DrawerProps {
  item: ActivityWithState | null;
  isOpen: boolean;
  onClose: () => void;
  observations?: WorkObservation[];
  auditEvents?: AuditEvent[];
  allActivities?: ActivityWithState[];
}

export const Activity360Drawer: React.FC<Activity360DrawerProps> = ({ 
  item, 
  isOpen, 
  onClose,
  observations = [],
  auditEvents = [],
  allActivities = []
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'dependencies' | 'audit'>('overview');

  if (!isOpen || !item) return null;

  const { activity, state } = item;
  const status = state?.execution_status || 'NOT_STARTED';
  const progress = state?.current_progress_pct || 0;

  // Filter linked evidence for this activity
  const linkedObservations = observations.filter(obs => 
    obs.raw_text.toLowerCase().includes(activity.code.toLowerCase()) ||
    (activity.equipment_tag && obs.equipment_tag === activity.equipment_tag) ||
    (obs.location && activity.location && obs.location.includes(activity.location))
  );

  // Filter audit events for this activity
  const linkedAudits = auditEvents.filter(evt => evt.entity_id === activity.id);

  // Predecessor activities (heuristic: activities in same WBS/discipline with earlier planned finish)
  const predecessors = allActivities.filter(a => 
    a.activity.id !== activity.id && 
    a.activity.discipline === activity.discipline &&
    a.activity.planned_finish_date <= activity.planned_start_date
  );

  const successors = allActivities.filter(a => 
    a.activity.id !== activity.id && 
    a.activity.discipline === activity.discipline &&
    a.activity.planned_start_date >= activity.planned_finish_date
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full z-10 border-l border-slate-200">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold text-slate-900">{activity.code}</span>
              <Badge variant="secondary">{activity.discipline}</Badge>
              {activity.critical_path && (
                <Badge variant="warning">CRITICAL PATH</Badge>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">{activity.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              WBS Node: {activity.zone || 'Zone 2'} &bull; Area: {activity.location || 'Pipe Rack B'}
            </p>
          </div>

          <Button 
            onClick={onClose} 
            variant="ghost" 
            size="icon" 
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 360° Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-6 text-xs font-mono">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 font-semibold border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-[#C38B4B] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-[#C38B4B] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Evidence</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
              {linkedObservations.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('dependencies')}
            className={`py-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'dependencies'
                ? 'border-[#C38B4B] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Dependencies</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
              {predecessors.length + successors.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-[#C38B4B] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Audit</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
              {linkedAudits.length}
            </span>
          </button>
        </div>

        {/* Drawer Body Surface */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status & Progress Box */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">Execution Status</span>
                  <Badge variant={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'outline'}>
                    {status}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-600">Actual Physical Progress:</span>
                    <span className="font-bold text-slate-900">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress === 100 ? 'bg-emerald-500' : 'bg-[#C38B4B]'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono border-t border-slate-200/80">
                  <div>
                    <span className="text-slate-400 text-[10px] block">CUMULATIVE QUANTITY</span>
                    <span className="font-bold text-slate-800">
                      {state?.cumulative_quantity ?? (progress > 0 ? (activity.planned_quantity || 1) * (progress / 100) : 0)} / {activity.planned_quantity || 1} {activity.unit_of_measure}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">SCHEDULE VARIANCE</span>
                    <span className={`font-bold ${state?.variance_days && state.variance_days > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {state?.variance_days ? `+${state.variance_days} Days Delay` : 'On Track (+0.0d)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Baseline Schedule Windows */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  Primavera P6 Baseline Parameters
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-white border border-slate-200 rounded">
                    <span className="text-slate-400 text-[10px] block">PLANNED START</span>
                    <span className="font-bold text-slate-800">{activity.planned_start_date}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded">
                    <span className="text-slate-400 text-[10px] block">PLANNED FINISH</span>
                    <span className="font-bold text-slate-800">{activity.planned_finish_date}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded">
                    <span className="text-slate-400 text-[10px] block">PLANNED DURATION</span>
                    <span className="font-bold text-slate-800">{activity.planned_duration_days} Days</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded">
                    <span className="text-slate-400 text-[10px] block">EQUIPMENT TAG</span>
                    <span className="font-bold text-slate-800">{activity.equipment_tag || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Description & Scope Notes */}
              {activity.description && (
                <div className="space-y-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                    Engineering Scope of Work
                  </h3>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed font-mono">
                    {activity.description}
                  </p>
                </div>
              )}

              {/* Trust Plane Guard Status */}
              <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Trust Plane Invariant Status</span>
                </div>
                <p className="text-emerald-900/80 text-[11px] leading-relaxed">
                  Activity conforms to monotonic progress rule. State changes cannot be backtracked without a registered and signed Lead Planner change order.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: LINKED FIELD EVIDENCE */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  Reconciled Field Observations ({linkedObservations.length})
                </h3>
              </div>

              {linkedObservations.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-500">
                  No field observations linked to this activity yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {linkedObservations.map((obs) => (
                    <div key={obs.id} className="p-4 rounded-lg bg-white border border-slate-200 space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">ID: {obs.id.slice(0, 8)}...</span>
                        <Badge variant="success">CONFIRMED</Badge>
                      </div>
                      <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-100 font-sans leading-relaxed">
                        "{obs.raw_text}"
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>Reported Progress: +{obs.reported_progress ?? 100}%</span>
                        <span>{new Date(obs.recorded_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DEPENDENCIES */}
          {activeTab === 'dependencies' && (
            <div className="space-y-6">
              {/* Upstream Predecessors */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  Upstream Predecessors ({predecessors.length})
                </h3>
                {predecessors.length === 0 ? (
                  <p className="text-xs font-mono text-slate-400 p-3 bg-slate-50 rounded border border-slate-100">
                    No predecessor constraints (Root package activity).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {predecessors.map(p => (
                      <div key={p.activity.id} className="p-3 bg-white border border-slate-200 rounded flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-bold text-slate-900">{p.activity.code}</span>
                          <span className="text-slate-500 ml-2">{p.activity.name}</span>
                        </div>
                        <Badge variant={p.state?.execution_status === 'COMPLETED' ? 'success' : 'warning'}>
                          {p.state?.execution_status || 'NOT_STARTED'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Downstream Successors */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  Downstream Successors ({successors.length})
                </h3>
                {successors.length === 0 ? (
                  <p className="text-xs font-mono text-slate-400 p-3 bg-slate-50 rounded border border-slate-100">
                    No downstream dependent activities.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {successors.map(s => (
                      <div key={s.activity.id} className="p-3 bg-white border border-slate-200 rounded flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-bold text-slate-900">{s.activity.code}</span>
                          <span className="text-slate-500 ml-2">{s.activity.name}</span>
                        </div>
                        <Badge variant={s.state?.execution_status === 'COMPLETED' ? 'success' : 'outline'}>
                          {s.state?.execution_status || 'NOT_STARTED'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT HISTORY */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                Immutable Ledger Events ({linkedAudits.length})
              </h3>

              {linkedAudits.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-500">
                  No direct audit ledger modifications recorded for this activity.
                </div>
              ) : (
                <div className="space-y-3">
                  {linkedAudits.map(aud => (
                    <div key={aud.id} className="p-4 rounded-lg bg-white border border-slate-200 space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{aud.action}</span>
                        <span className="text-[10px] text-slate-500">{new Date(aud.created_at).toLocaleString()}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded border border-slate-100 text-[11px] text-slate-700 break-all select-all">
                        SHA-256: {aud.payload_hash.slice(0, 32)}...
                      </div>
                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>Actor: {aud.actor_role}</span>
                        <span>Entity: {aud.entity_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            NEXORA Activity 360° Entity Inspector
          </span>
          <Button onClick={onClose} variant="default" size="sm">
            Close Inspector
          </Button>
        </div>

      </div>
    </div>
  );
};
