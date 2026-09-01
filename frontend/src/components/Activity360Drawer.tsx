import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Cpu
} from 'lucide-react';
import type { ActivityWithState, WorkObservation, AuditEvent } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { NexoraStatusBadge } from './NexoraStatusBadge';

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
  const [tab, setTab] = useState<'overview' | 'evidence' | 'dependencies' | 'audit'>('overview');

  if (!item) return null;

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

  // Predecessors and Successors
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
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="p-0 sm:max-w-xl md:max-w-2xl bg-white shadow-2xl">
        
        {/* Drawer Header */}
        <SheetHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-slate-900">{activity.code}</span>
            <Badge variant="secondary">{activity.discipline}</Badge>
            {activity.critical_path && (
              <Badge variant="warning">CRITICAL PATH</Badge>
            )}
          </div>
          <SheetTitle className="text-base font-bold text-slate-900 leading-snug">
            {activity.name}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            WBS Node: {activity.zone || 'Zone 2'} &bull; Area: {activity.location || 'Pipe Rack B'}
          </SheetDescription>
        </SheetHeader>

        {/* 360° Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 border-b border-slate-100 bg-white">
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="evidence">
                Evidence {linkedObservations.length > 0 && `(${linkedObservations.length})`}
              </TabsTrigger>
              <TabsTrigger value="dependencies">
                Dependencies ({predecessors.length + successors.length})
              </TabsTrigger>
              <TabsTrigger value="audit">
                Audit ({linkedAudits.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Tab 1: Overview */}
            <TabsContent value="overview" className="space-y-6 mt-0">
              {/* Progress & Status Card */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-sans text-slate-500 block">Execution Status</span>
                    <div className="mt-1">
                      <NexoraStatusBadge status={status} />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-sans text-slate-500 block">Reconciled Progress</span>
                    <span className="text-xl font-bold font-sans text-slate-900">{progress}%</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div 
                    className="bg-[#34C759] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Schedule Dates & Milestones */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[10px] font-sans font-semibold uppercase text-slate-400">Planned Start / Finish</span>
                  <div className="text-xs font-mono font-semibold text-slate-900">
                    {activity.planned_start_date} &rarr; {activity.planned_finish_date}
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans">Baseline Schedule</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[10px] font-sans font-semibold uppercase text-slate-400">Actualized Dates</span>
                  <div className="text-xs font-mono font-semibold text-slate-900">
                    {state?.actual_start_date || '—'} &rarr; {state?.actual_finish_date || '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans">
                    Variance: <span className={state?.variance_days && state.variance_days > 0 ? 'text-[#FF3B30] font-bold' : 'text-[#34C759] font-bold'}>
                      {state?.variance_days ? `${state.variance_days > 0 ? '+' : ''}${state.variance_days}d` : '0d'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Quantity & Equipment Specifications */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500">
                  Quantity & Spatial Tagging
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <span className="text-slate-500 block">Planned Quantity</span>
                    <span className="font-semibold text-slate-900">
                      {activity.planned_quantity ? `${activity.planned_quantity} ${activity.unit_of_measure || 'Units'}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cumulative Installed</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {state?.cumulative_quantity || 0} {activity.unit_of_measure || 'Units'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Equipment / Line Tag</span>
                    <span className="font-mono text-slate-900 font-medium">{activity.equipment_tag || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Schedule Weightage</span>
                    <span className="font-mono text-slate-900 font-medium">{activity.weightage || 1.0}%</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Field Evidence */}
            <TabsContent value="evidence" className="space-y-4 mt-0">
              {linkedObservations.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-2">
                  <Cpu className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 font-sans">No Linked Field Evidence Yet</p>
                  <p className="text-[11px] text-slate-500 font-sans max-w-sm mx-auto">
                    Upload site daily progress reports, Excel discipline logs, or supervisor audio notes matching {activity.code}.
                  </p>
                </div>
              ) : (
                linkedObservations.map((obs) => (
                  <div key={obs.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{obs.id}</span>
                        <Badge variant="secondary">{obs.discipline || 'GENERAL'}</Badge>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {new Date(obs.recorded_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 font-sans leading-relaxed italic">
                      "{obs.raw_text}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-sans pt-1">
                      <span>Reported Progress: <strong className="text-slate-900">{obs.reported_progress ?? 100}%</strong></span>
                      <span>Source: <strong className="text-slate-900">{obs.metadata?.source_type || 'DAILY_REPORT'}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Tab 3: Dependencies */}
            <TabsContent value="dependencies" className="space-y-5 mt-0">
              {/* Predecessors */}
              <div className="space-y-2">
                <span className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                  Predecessors ({predecessors.length}) &bull; Finish-to-Start (FS)
                </span>
                {predecessors.length === 0 ? (
                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-xs text-slate-500 font-sans">
                    No predecessor constraints. Activity can start on baseline schedule date.
                  </div>
                ) : (
                  predecessors.map((p) => (
                    <div key={p.activity.id} className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 mr-2">{p.activity.code}</span>
                        <span className="text-xs text-slate-700 font-sans">{p.activity.name}</span>
                      </div>
                      <NexoraStatusBadge status={p.state?.execution_status || 'NOT_STARTED'} />
                    </div>
                  ))
                )}
              </div>

              {/* Successors */}
              <div className="space-y-2">
                <span className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500 block">
                  Successors ({successors.length})
                </span>
                {successors.length === 0 ? (
                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-xs text-slate-500 font-sans">
                    No downstream dependent activities configured.
                  </div>
                ) : (
                  successors.map((s) => (
                    <div key={s.activity.id} className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 mr-2">{s.activity.code}</span>
                        <span className="text-xs text-slate-700 font-sans">{s.activity.name}</span>
                      </div>
                      <NexoraStatusBadge status={s.state?.execution_status || 'NOT_STARTED'} />
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Tab 4: Audit */}
            <TabsContent value="audit" className="space-y-3 mt-0">
              {linkedAudits.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-1">
                  <ShieldCheck className="h-7 w-7 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 font-sans">No Audit Ledger Entries</p>
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
            </TabsContent>
          </div>
        </Tabs>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-[11px] font-sans text-slate-500">
            NEXORA 360° Schedule Entity Inspector
          </span>
          <Button onClick={onClose} variant="default" size="sm">
            Done
          </Button>
        </div>

      </SheetContent>
    </Sheet>
  );
};
