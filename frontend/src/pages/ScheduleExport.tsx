import React, { useState } from 'react';
import { 
  FileCode, 
  FileSpreadsheet, 
  CheckCircle2, 
  Download, 
  Server, 
  RefreshCw, 
  FileAudio
} from 'lucide-react';
import type { ActivityWithState, WorkObservation } from '../types';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardTitle, CardDescription } from '../components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';

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
    const headers = ['ActivityCode', 'ActivityName', 'Discipline', 'PlannedStart', 'PlannedFinish', 'ActualStart', 'ActualFinish', 'ProgressPct', 'ExecutionStatus', 'CriticalPath', 'VarianceDays'];
    const rows = activities.map(({ activity, state }) => [
      `"${activity.code}"`,
      `"${activity.name.replace(/"/g, '""')}"`,
      `"${activity.discipline}"`,
      activity.planned_start_date,
      activity.planned_finish_date,
      state?.actual_start_date || '',
      state?.actual_finish_date || '',
      state?.current_progress_pct || 0,
      state?.execution_status || 'NOT_STARTED',
      activity.critical_path ? 'TRUE' : 'FALSE',
      state?.variance_days || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_${currentProjCode}_Actuals_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess('Excel/CSV Actuals exported successfully.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadObservationsCSV = () => {
    const headers = ['ObservationId', 'RecordedAt', 'Discipline', 'Location', 'Zone', 'EquipmentTag', 'ProgressPct', 'RawFactText'];
    const rows = observations.map(obs => [
      `"${obs.id}"`,
      obs.recorded_at,
      `"${obs.discipline || 'GENERAL'}"`,
      `"${obs.location || ''}"`,
      `"${obs.zone || ''}"`,
      `"${obs.equipment_tag || ''}"`,
      obs.reported_progress ?? 100,
      `"${obs.raw_text.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_${currentProjCode}_Evidence_Stream_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess('Raw Evidence Stream exported successfully.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-[#007AFF]" />
            <Badge variant="secondary">Enterprise Integration Engine</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-none font-sans">
            Schedule & Ledger Exports
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-[65ch] font-sans">
            Export reconciled actuals and verified progress updates back into enterprise PMIS, Oracle Primavera P6 EPPM, or Excel spreadsheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshData && (
            <Button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="default"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#007AFF]' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Cloud Database'}</span>
            </Button>
          )}

          <Button
            onClick={checkHealth}
            disabled={isProbing}
            variant="ghost"
            size="default"
            className="flex items-center gap-2"
          >
            <Server className={`h-3.5 w-3.5 ${isProbing ? 'animate-spin' : ''}`} />
            <span>Probe Health</span>
          </Button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {downloadSuccess && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4 text-[#34C759]" />
          <AlertTitle className="text-emerald-950 font-bold text-xs">
            Export Generated
          </AlertTitle>
          <AlertDescription className="text-xs text-emerald-900 mt-0.5 font-sans">
            {downloadSuccess}
          </AlertDescription>
        </Alert>
      )}

      {/* Primary Export Targets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Oracle Primavera P6 XML */}
        <Card className="p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 shadow-2xs">
                <FileCode className="h-6 w-6 text-[#C38B4B]" />
              </div>
              <Badge variant="warning">ORACLE P6 XML V24</Badge>
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 font-sans">
                Primavera P6 XML Export
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">
                Native APBO schema export compatible with Primavera P6 EPPM/Professional. Contains updated actual dates, remaining duration, and progress percentages.
              </CardDescription>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-xs font-sans text-slate-500">
              <span>Target Package:</span>
              <span className="font-mono text-slate-800 font-semibold">{currentProjCode}</span>
            </div>
            <Button
              onClick={handleDownloadP6XML}
              variant="default"
              size="default"
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Download Primavera XML</span>
            </Button>
          </div>
        </Card>

        {/* Card 2: Excel / CSV Schedule Actuals */}
        <Card className="p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 shadow-2xs">
                <FileSpreadsheet className="h-6 w-6 text-[#34C759]" />
              </div>
              <Badge variant="success">EXCEL COMPATIBLE</Badge>
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 font-sans">
                Schedule Actuals (CSV / XLSX)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">
                Clean, RFC 4180 compliant CSV export containing all WBS activity codes, planned vs actual start/finish dates, percent progress, and variance days.
              </CardDescription>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-xs font-sans text-slate-500">
              <span>Total Activity Rows:</span>
              <span className="font-mono text-slate-800 font-semibold">{activities.length} Activities</span>
            </div>
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              size="default"
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Download Actuals CSV</span>
            </Button>
          </div>
        </Card>

        {/* Card 3: Raw Field Evidence Stream */}
        <Card className="p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 shadow-2xs">
                <FileAudio className="h-6 w-6 text-purple-600" />
              </div>
              <Badge variant="secondary">MULTI-MODAL LOGS</Badge>
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 font-sans">
                Raw Field Evidence Stream
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">
                Export raw site observations, supervisor voice transcripts, spatial tags, and timestamped progress facts for audit and legal compliance.
              </CardDescription>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-xs font-sans text-slate-500">
              <span>Ingested Evidence Count:</span>
              <span className="font-mono text-slate-800 font-semibold">{observations.length} Facts</span>
            </div>
            <Button
              onClick={handleDownloadObservationsCSV}
              variant="outline"
              size="default"
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Download Evidence CSV</span>
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
};
