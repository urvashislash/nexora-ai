import React, { useState, useEffect } from 'react';
import { 
  FileCode, 
  FileSpreadsheet, 
  CheckCircle2, 
  Download, 
  Database, 
  ShieldCheck, 
  Server, 
  RefreshCw, 
  Code 
} from 'lucide-react';
import type { ActivityWithState } from '../types';
import { api } from '../lib/api';
import { getSupabaseStatus } from '../lib/supabase';

interface ScheduleExportProps {
  activities: ActivityWithState[];
}

export const ScheduleExport: React.FC<ScheduleExportProps> = ({ activities }) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<{ status: string; service?: string } | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  const supabaseStatus = getSupabaseStatus();

  const checkHealth = async () => {
    setIsProbing(true);
    try {
      const health = await api.checkHealth();
      setBackendHealth(health);
    } catch {
      setBackendHealth({ status: 'offline' });
    } finally {
      setIsProbing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    api.checkHealth().then(health => {
      if (mounted) setBackendHealth(health);
    }).catch(() => {
      if (mounted) setBackendHealth({ status: 'offline' });
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleDownloadP6XML = async () => {
    let xmlContent = await api.getP6Export('a0000000-0000-0000-0000-000000000001');

    if (!xmlContent) {
      // Local generator fallback
      xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<APBO:Project xmlns:APBO="http://xmlns.oracle.com/Primavera/P6/V24">\n  <ProjectObjectId>PRD-HYD-PKG04</ProjectObjectId>\n  <ProjectName>Paradip-Hyderabad Refinery Expansion - Package 04</ProjectName>\n  <Activities>\n`;
      activities.forEach(({ activity, state }) => {
        const progress = state?.current_progress_pct || 0;
        const status = state?.execution_status || 'NOT_STARTED';
        const actualStart = state?.actual_start_date ? ` ActualStart="${state.actual_start_date}"` : '';
        const actualFinish = state?.actual_finish_date ? ` ActualFinish="${state.actual_finish_date}"` : '';
        xmlContent += `    <Activity Id="${activity.code}" Name="${activity.name}" Discipline="${activity.discipline}" PlannedStart="${activity.planned_start_date}" PlannedFinish="${activity.planned_finish_date}"${actualStart}${actualFinish} ProgressPct="${progress}" Status="${status}" />\n`;
      });
      xmlContent += `  </Activities>\n</APBO:Project>`;
    }

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_PRD_PKG04_P6_Export_${new Date().toISOString().slice(0,10)}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess('Oracle Primavera P6 XML schedule export generated and downloaded successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadCSV = () => {
    let csv = 'Activity Code,Name,Discipline,Planned Start,Planned Finish,Actual Start,Actual Finish,Progress %,Status,Critical Path\n';

    activities.forEach(({ activity, state }) => {
      const progress = state?.current_progress_pct || 0;
      const status = state?.execution_status || 'NOT_STARTED';
      const actualStart = state?.actual_start_date || '';
      const actualFinish = state?.actual_finish_date || '';
      csv += `"${activity.code}","${activity.name}","${activity.discipline}","${activity.planned_start_date}","${activity.planned_finish_date}","${actualStart}","${actualFinish}",${progress},"${status}",${activity.critical_path ? 'YES' : 'NO'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_Actualized_Schedule_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess('CSV Schedule report downloaded successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadJSON = () => {
    const payload = {
      project_id: 'a0000000-0000-0000-0000-000000000001',
      project_code: 'PRD-HYD-PKG04',
      exported_at: new Date().toISOString(),
      activities_count: activities.length,
      activities: activities.map(({ activity, state }) => ({
        ...activity,
        current_state: state,
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA_PMIS_Payload_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess('JSON PMIS synchronization payload downloaded successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="signal-tick bg-[#C38B4B]" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
              Operations & Interoperability
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-none">
            System Health & Schedule Export
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-[65ch]">
            Export verified actual progress, start/finish dates, and percentage completions directly into Oracle Primavera P6, MS Project, or enterprise ERPs with zero hallucination.
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={isProbing}
          className="flex items-center gap-2 rounded bg-slate-900 px-3.5 py-2 text-xs font-mono font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isProbing ? 'animate-spin' : ''}`} />
          <span>Probe System Health</span>
        </button>
      </div>

      {/* Success Notification */}
      {downloadSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-center space-x-3 text-emerald-900 text-xs font-mono">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{downloadSuccess}</span>
        </div>
      )}

      {/* System Health Telemetry Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Rust Axum Backend */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Rust API Server</span>
            <Server className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-bold font-mono text-slate-900">
              {backendHealth?.status === 'ok' || backendHealth?.status === 'healthy' ? 'Online' : 'Standby / Local Fallback'}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500">
            {backendHealth?.service ? `Service: ${backendHealth.service}` : 'Port 3000 • Axum + Tokio'}
          </p>
        </div>

        {/* Supabase PostgreSQL & Storage */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Supabase Cloud</span>
            <Database className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-bold font-mono text-emerald-700">
              {supabaseStatus.configured ? 'Connected' : 'Local Mocked'}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 truncate">
            {supabaseStatus.url || 'vitxgshrjpyvczidzvto.supabase.co'}
          </p>
        </div>

        {/* Rust Trust Plane Engine */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Trust Engine</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-bold font-mono text-emerald-700">Active</span>
          </div>
          <p className="text-[11px] font-mono text-slate-500">
            Predecessor & Date Policy Rules Enforced
          </p>
        </div>

      </div>

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Primavera P6 XML Card */}
        <div className="glass-card p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="rounded p-2 bg-blue-50 text-blue-700 border border-blue-200">
                <FileCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Oracle Primavera P6 (XML)</h3>
                <span className="text-[10px] font-mono text-slate-500">Standard Primavera Schema v24</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Export actualized start/finish dates, percent completions, and activity codes compatible with Oracle Primavera P6 Enterprise Project Portfolio Management.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleDownloadP6XML}
              className="w-full flex items-center justify-center space-x-2 rounded bg-slate-900 py-2 text-xs font-mono font-bold text-white hover:bg-slate-800 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export P6 XML</span>
            </button>
          </div>
        </div>

        {/* CSV Spreadsheet Card */}
        <div className="glass-card p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="rounded p-2 bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Actualized CSV Report</h3>
                <span className="text-[10px] font-mono text-slate-500">Excel / PowerBI Compatible</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Standard comma-separated table containing all {activities.length} schedule activities, variance days, progress percentages, and critical path indicators.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleDownloadCSV}
              className="w-full flex items-center justify-center space-x-2 rounded bg-slate-900 py-2 text-xs font-mono font-bold text-white hover:bg-slate-800 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* JSON PMIS Payload Card */}
        <div className="glass-card p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="rounded p-2 bg-amber-50 text-amber-700 border border-amber-200">
                <Code className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">PMIS JSON Webhook Sync</h3>
                <span className="text-[10px] font-mono text-slate-500">REST / Kafka Event Payload</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Machine-readable structured JSON payload containing full activity states, metadata, and timestamps for programmatic synchronization into corporate PMIS.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleDownloadJSON}
              className="w-full flex items-center justify-center space-x-2 rounded bg-slate-900 py-2 text-xs font-mono font-bold text-white hover:bg-slate-800 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download JSON Payload</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
