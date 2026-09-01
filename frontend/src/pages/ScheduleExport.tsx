import React, { useState } from 'react';
import { 
  FileCode, 
  FileSpreadsheet, 
  CheckCircle2, 
  Download, 
  Server, 
  RefreshCw, 
  Code,
  FileAudio
} from 'lucide-react';
import type { ActivityWithState, WorkObservation } from '../types';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

interface ScheduleExportProps {
  activities: ActivityWithState[];
  observations?: WorkObservation[];
  onRefreshData?: () => Promise<void>;
  activeProject?: import('../types').Project;
}

export const ScheduleExport: React.FC<ScheduleExportProps> = ({ 
  activities, 
  observations = [],
  onRefreshData,
  activeProject
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentProjId = activeProject?.id || 'a0000000-0000-0000-0000-000000000001';
  const currentProjCode = activeProject?.code || 'PRD-HYD-PKG04';
  const currentProjName = activeProject?.name || 'Paradip-Hyderabad Refinery Expansion - Package 04';

  const checkHealth = async () => {
    setIsProbing(true);
    try {
      await api.checkHealth();
      setDownloadSuccess('Probed system health: All trust plane endpoints online.');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch {
      setDownloadSuccess('Probed system health: Offline / Standby mode active.');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } finally {
      setIsProbing(false);
    }
  };

  const handleManualRefresh = async () => {
    if (onRefreshData) {
      setIsRefreshing(true);
      try {
        await onRefreshData();
        setDownloadSuccess('Live data refreshed from Cloud DB successfully!');
        setTimeout(() => setDownloadSuccess(null), 3000);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const handleDownloadP6XML = async () => {
    let xmlContent = await api.getP6Export(currentProjId);

    if (!xmlContent) {
      // Local generator fallback
      xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<APBO:Project xmlns:APBO="http://xmlns.oracle.com/Primavera/P6/V24">\n  <ProjectObjectId>${currentProjCode}</ProjectObjectId>\n  <ProjectName>${currentProjName}</ProjectName>\n  <Activities>\n`;
      activities.forEach(({ activity, state }) => {
        const progress = state?.current_progress_pct || 0;
        const status = state?.execution_status || 'NOT_STARTED';
        const actualStart = state?.actual_start_date ? ` ActualStart="${state.actual_start_date}"` : '';
        const actualFinish = state?.actual_finish_date ? ` ActualFinish="${state.actual_finish_date}"` : '';
        xmlContent += `    <Activity Id="${activity.code}" Name="${activity.name}" Discipline="${activity.discipline}" PlannedStart="${activity.planned_start_date}" PlannedFinish="${activity.planned_finish_date}"${actualStart}${actualFinish} ProgressPct="${progress}" Status="${status}" />\n`;
      });
      xmlContent += `  </Activities>\n</APBO:Project>`;
    }

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_${currentProjCode}_P6_Export_${new Date().toISOString().slice(0,10)}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess('Primavera P6 XML Export downloaded successfully.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadCSV = () => {
    // Robust Local CSV Generator with UTF-8 BOM
    const headers = ['ActivityCode', 'ActivityName', 'Discipline', 'PlannedStart', 'PlannedFinish', 'ActualStart', 'ActualFinish', 'ProgressPct', 'ExecutionStatus', 'CriticalPath', 'VarianceDays'];
    const rows = activities.map(({ activity, state }) => [
      `"${activity.code}"`,
      `"${activity.name.replace(/"/g, '""')}"`,
      `"${activity.discipline}"`,
      `"${activity.planned_start_date}"`,
      `"${activity.planned_finish_date}"`,
      `"${state?.actual_start_date || ''}"`,
      `"${state?.actual_finish_date || ''}"`,
      state?.current_progress_pct || 0,
      `"${state?.execution_status || 'NOT_STARTED'}"`,
      activity.critical_path ? 'TRUE' : 'FALSE',
      state?.variance_days || 0
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_${currentProjCode}_Schedule_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess('Schedule CSV report downloaded successfully.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadObservationsCSV = () => {
    const headers = ['ObservationID', 'ProjectID', 'Discipline', 'RecordedAt', 'ObservedAt', 'EventType', 'ReportedProgress', 'Location', 'Zone', 'EquipmentTag', 'SourceType', 'HasAudio', 'RawObservationText'];
    const rows = observations.map((obs) => [
      `"${obs.id}"`,
      `"${obs.project_id}"`,
      `"${obs.discipline || 'GENERAL'}"`,
      `"${obs.recorded_at}"`,
      `"${obs.observed_at}"`,
      `"${obs.event_type || 'FINISH'}"`,
      obs.reported_progress ?? 100,
      `"${(obs.location || '').replace(/"/g, '""')}"`,
      `"${(obs.zone || '').replace(/"/g, '""')}"`,
      `"${(obs.equipment_tag || '').replace(/"/g, '""')}"`,
      `"${obs.metadata?.source_type || 'DAILY_REPORT'}"`,
      obs.metadata?.has_audio ? 'TRUE' : 'FALSE',
      `"${(obs.raw_text || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_${currentProjCode}_Field_Observations_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess('Observations & Voice Memos CSV downloaded successfully.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadJSON = () => {
    const payload = {
      project: {
        id: currentProjId,
        code: currentProjCode,
        name: currentProjName,
        export_timestamp: new Date().toISOString(),
        total_activities: activities.length,
      },
      schedule_actuals: activities.map(({ activity, state }) => ({
        activity_code: activity.code,
        name: activity.name,
        discipline: activity.discipline,
        planned_start: activity.planned_start_date,
        planned_finish: activity.planned_finish_date,
        actual_start: state?.actual_start_date || null,
        actual_finish: state?.actual_finish_date || null,
        progress_pct: state?.current_progress_pct || 0,
        status: state?.execution_status || 'NOT_STARTED',
        critical_path: !!activity.critical_path,
        variance_days: state?.variance_days || 0,
      })),
      field_observations_count: observations.length,
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_${currentProjCode}_PMIS_Sync_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess('PMIS JSON payload downloaded successfully.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-[#007AFF]" />
            <Badge variant="secondary">Enterprise Integrations</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-none font-sans">
            Schedule Export & PMIS Sync
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-[65ch] font-sans">
            Export reconciled progress and actualized start/finish dates into Oracle Primavera P6 XML, Excel spreadsheets, Field Observation logs, or PMIS JSON streams.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onRefreshData && (
            <Button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="default"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Cloud DB'}</span>
            </Button>
          )}

          <Button
            onClick={checkHealth}
            disabled={isProbing}
            variant="default"
            size="default"
            className="flex items-center gap-2"
          >
            <Server className={`h-3.5 w-3.5 ${isProbing ? 'animate-pulse' : ''}`} />
            <span>Probe Health</span>
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {downloadSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-4 flex items-center space-x-3 text-emerald-950 text-xs font-sans shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-[#34C759] shrink-0" />
          <span className="font-semibold">{downloadSuccess}</span>
        </div>
      )}

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Primavera P6 XML Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="rounded-xl p-2.5 bg-blue-50 text-[#007AFF] border border-blue-200/70">
                <FileCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 font-sans">Primavera P6 (XML)</h3>
                <span className="text-[10px] font-sans text-slate-500 font-medium">Oracle Schema v24</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Export actualized start/finish dates, percent completions, and activity codes compatible with Oracle Primavera P6 Enterprise.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Button
              onClick={handleDownloadP6XML}
              variant="default"
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export P6 XML</span>
            </Button>
          </div>
        </div>

        {/* Schedule CSV Spreadsheet Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="rounded-xl p-2.5 bg-emerald-50 text-[#34C759] border border-emerald-200/70">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 font-sans">Schedule CSV Report</h3>
                <span className="text-[10px] font-sans text-slate-500 font-medium">Excel / PowerBI (UTF-8)</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Comma-separated table containing all {activities.length} schedule activities, variance days, progress %, and critical path flags.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Button
              onClick={handleDownloadCSV}
              variant="default"
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Schedule CSV</span>
            </Button>
          </div>
        </div>

        {/* Observations & Voice Memos CSV Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="rounded-xl p-2.5 bg-purple-50 text-purple-600 border border-purple-200/70">
                <FileAudio className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 font-sans">Observations CSV</h3>
                <span className="text-[10px] font-sans text-slate-500 font-medium">Field Voice & Reports</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Full ledger of {observations.length} field observations, audio memo links, disciplines, timestamps, and progress actualizations.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Button
              onClick={handleDownloadObservationsCSV}
              variant="default"
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Observations CSV</span>
            </Button>
          </div>
        </div>

        {/* JSON PMIS Payload Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="rounded-xl p-2.5 bg-amber-50 text-amber-700 border border-amber-200/70">
                <Code className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 font-sans">PMIS JSON Sync</h3>
                <span className="text-[10px] font-sans text-slate-500 font-medium">REST / Kafka Event</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Machine-readable structured JSON payload containing full activity states, metadata, and timestamps for ERP/PMIS synchronization.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Button
              onClick={handleDownloadJSON}
              variant="default"
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download JSON</span>
            </Button>
          </div>
        </div>

      </div>

    </div>
  );
};
