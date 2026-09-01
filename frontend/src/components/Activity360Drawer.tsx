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
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full z-10 border-l border-slate-200/80 rounded-l-2xl overflow-hidden">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold text-slate-900">{activity.code}</span>
              <Badge variant="secondary">{activity.discipline}</Badge>
              {activity.critical_path && (
                <Badge variant="warning">CRITICAL PATH</Badge>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug font-sans">{activity.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">
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
        <div className="flex border-b border-slate-100 bg-white px-6 gap-6 text-xs font-sans">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[#C38B4B] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'evidence'
                ? 'border-[#C38B4B] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Evidence</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono">
              {linkedObservations.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('dependencies')}
            className={`py-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'dependencies'
                ? 'border-[#C38B4B] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Dependencies</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono">
              {predecessors.length + successors.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audit'
                ? 'border-[#C38B4B] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Audit</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono">
              {linkedAudits.length}
            </span>
          </button>
        </div>

        {/* Drawer Body Surface */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status & Progress Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-sans uppercase text-slate-500 font-semibold">Execution Status</span>
                  <Badge variant={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'outline'}>
                    {status}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-sans">
                    <span className="text-slate-600">Actual Physical Progress:</span>
                    <span className="font-mono font-bold text-slate-900">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress === 100 ? 'bg-[#34C759]' : 'bg-[#007AFF]'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-sans border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-semibold">CUMULATIVE QUANTITY</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {state?.cumulative_quantity ?? (progress > 0 ? (activity.planned_quantity || 1) * (progress / 100) : 0)} / {activity.planned_quantity || 1} {activity.unit_of_measure}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-semibold">SCHEDULE VARIANCE</span>
                    <span className={`font-mono font-bold text-xs ${state?.variance_days && state.variance_days > 0 ? 'text-[#FF3B30]' : 'text-emerald-700'}`}>
                      {state?.variance_days ? `+${state.variance_days} Days Delay` : 'On Track (+0.0d)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Baseline Schedule Windows */}
              <div className="space-y-3">
                <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500">
                  Primavera P6 Baseline Parameters
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs font-sans">
                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] block font-semibold">PLANNED START</span>
                    <span className="font-mono font-bold text-slate-900">{activity.planned_start_date}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] block font-semibold">PLANNED FINISH</span>
                    <span className="font-mono font-bold text-slate-900">{activity.planned_finish_date}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] block font-semibold">ACTUAL START</span>
                    <span className="font-mono font-bold text-slate-900">{state?.actual_start_date || '—'}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] block font-semibold">ACTUAL FINISH</span>
                    <span className="font-mono font-bold text-slate-900">{state?.actual_finish_date || '—'}</span>
                  </div>
                </div>
              </div>

              {/* WBS Metadata & Tags */}
              <div className="space-y-3">
                <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500">
                  Spatial & Equipment Identifiers
                </h3>
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2 text-xs font-sans">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Equipment Tag:</span>
                    <span className="font-mono font-semibold text-slate-900">{activity.equipment_tag || 'LINE-P-101'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Zone / Corridor:</span>
                    <span className="text-slate-800 font-medium">{activity.zone || 'Zone 2'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Area:</span>
                    <span className="text-slate-800 font-medium">{activity.location || 'Pipe Rack B Tier 2'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Scope Quantity:</span>
                    <span className="font-mono text-slate-800">{activity.planned_quantity} {activity.unit_of_measure}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FIELD EVIDENCE */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500">
                  Linked Observations ({linkedObservations.length})
                </span>
              </div>

              {linkedObservations.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
                  <p className="text-xs text-slate-500 font-sans">No field reports or voice memos linked to this activity yet.</p>
                </div>
              ) : (
                linkedObservations.map((obs) => (
                  <div key={obs.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-sans">
                      <Badge variant="secondary">{obs.discipline || 'GENERAL'}</Badge>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {new Date(obs.recorded_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-sans italic">
                      "{obs.raw_text}"
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-sans">
                      <span>Source: {obs.metadata?.source_type || 'DAILY_REPORT'}</span>
                      <span className="font-mono font-bold text-emerald-700">+{obs.reported_progress}% Progress</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: DEPENDENCIES */}
          {activeTab === 'dependencies' && (
            <div className="space-y-6">
              {/* Predecessors */}
              <div className="space-y-3">
                <span className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                  Upstream Predecessors ({predecessors.length})
                </span>
                {predecessors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic font-sans">No upstream schedule predecessors required.</p>
                ) : (
                  predecessors.map((p) => (
                    <div key={p.activity.id} className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900">{p.activity.code}</span>
                        <p className="text-xs text-slate-600 truncate font-sans">{p.activity.name}</p>
                      </div>
                      <Badge variant={p.state?.execution_status === 'COMPLETED' ? 'success' : 'outline'}>
                        {p.state?.execution_status || 'NOT_STARTED'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>

              {/* Successors */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                  Downstream Successors ({successors.length})
                </span>
                {successors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic font-sans">No dependent successor activities downstream.</p>
                ) : (
                  successors.map((s) => (
                    <div key={s.activity.id} className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900">{s.activity.code}</span>
                        <p className="text-xs text-slate-600 truncate font-sans">{s.activity.name}</p>
                      </div>
                      <Badge variant={s.state?.execution_status === 'COMPLETED' ? 'success' : 'outline'}>
                        {s.state?.execution_status || 'NOT_STARTED'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT HISTORY */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <span className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                Cryptographic Ledger Log ({linkedAudits.length})
              </span>

              {linkedAudits.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
                  <ShieldCheck className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-sans">No immutable ledger entries recorded yet for this activity.</p>
                </div>
              ) : (
                linkedAudits.map((evt) => (
                  <div key={evt.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-sans">
                      <span className="font-semibold text-slate-900">{evt.action}</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {new Date(evt.created_at || evt.timestamp || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 truncate">
                      SHA-256: {evt.payload_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
