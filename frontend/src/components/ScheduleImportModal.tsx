import React, { useState } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Loader2, 
  X, 
  Download, 
  ArrowRight,
  FileCode
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardTitle, CardDescription } from './ui/card';
import { api } from '../lib/api';
import { useProject } from '../contexts/ProjectContext';

interface ScheduleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

interface ParsedActivity {
  code: string;
  name: string;
  discipline: string;
  planned_start_date: string;
  planned_finish_date: string;
  planned_duration_days: number;
  planned_quantity?: number;
  unit_of_measure?: string;
  critical_path: boolean;
  weightage?: number;
}

export const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({ isOpen, onClose, projectId }) => {
  const { loadData } = useProject();
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'p6'>('csv');
  const [fileName, setFileName] = useState<string | null>(null);
  const [activities, setActivities] = useState<ParsedActivity[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = useState(false);

  if (!isOpen) return null;

  const downloadSampleCsv = () => {
    const csvContent = 
`code,name,discipline,planned_start_date,planned_finish_date,planned_duration_days,planned_quantity,unit_of_measure,critical_path
PIP-2400,Spool Erection and Alignment - Pipe Rack B,PIPING,2026-09-01,2026-09-15,15,450,Inch-Dia,true
PIP-2401,Hydrostatic Pressure Testing - Pipe Rack B Header,PIPING,2026-09-16,2026-09-21,5,12,Joints,true
CIV-1100,Rebar Tying and Shuttering - Compressor Foundation,CIVIL,2026-09-05,2026-09-14,10,35.5,MT,false
CIV-1101,Concrete Pouring (M35 Grade) - Compressor Foundation C-101,CIVIL,2026-09-15,2026-09-18,3,120,Cum,false
ELE-3100,Cable Tray Installation - Substation 4 to Pipe Rack B,ELECTRICAL,2026-09-10,2026-09-24,14,800,Rmt,false`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexora_schedule_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setPreviewResult(null);
    setCommitSuccess(false);
    setIsValidating(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length < 2) {
        throw new Error('File appears empty or missing header row.');
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const parsed: ParsedActivity[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (cols.length < 5) continue;

        const row: any = {};
        headers.forEach((h, idx) => {
          row[h] = cols[idx] || '';
        });

        const start = row.planned_start_date || row.start_date || '2026-09-01';
        const finish = row.planned_finish_date || row.finish_date || '2026-09-15';
        const duration = parseInt(row.planned_duration_days || row.duration, 10) || 10;
        const qty = parseFloat(row.planned_quantity || row.quantity) || undefined;
        const isCrit = (row.critical_path || '').toLowerCase() === 'true' || row.critical === '1';

        parsed.push({
          code: row.code || `ACT-${String(i).padStart(3, '0')}`,
          name: row.name || `Activity ${i}`,
          discipline: (row.discipline || 'CIVIL').toUpperCase(),
          planned_start_date: start,
          planned_finish_date: finish,
          planned_duration_days: duration,
          planned_quantity: qty,
          unit_of_measure: row.unit_of_measure || 'Units',
          critical_path: isCrit,
          weightage: 1.0,
        });
      }

      if (parsed.length === 0) {
        throw new Error('No valid activity rows detected in schedule file.');
      }

      setActivities(parsed);

      // Validate via backend preview endpoint
      const preview = await api.previewScheduleImport(projectId, {
        activities: parsed,
        dependencies: [],
      });

      setPreviewResult(preview || {
        total_activities: parsed.length,
        total_dependencies: 0,
        critical_path_count: parsed.filter((p) => p.critical_path).length,
        start_date: parsed[0]?.planned_start_date,
        finish_date: parsed[parsed.length - 1]?.planned_finish_date,
        errors: [],
        warnings: [],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to parse schedule file');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCommit = async () => {
    if (activities.length === 0 || isCommitting) return;

    setIsCommitting(true);
    setError(null);
    try {
      await api.commitScheduleImport(projectId, {
        activities,
        dependencies: [],
      });

      setCommitSuccess(true);
      await loadData(projectId);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to commit schedule baseline');
    } finally {
      setIsCommitting(false);
    }
  };

  const hasBlockingErrors = previewResult?.errors && previewResult.errors.length > 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <Card className="w-full max-w-2xl p-6 bg-white shadow-xl border border-slate-200 rounded-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-800">
              <Upload className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 font-sans">
                Import Schedule Baseline
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-sans">
                Establish the authoritative planned timeline for progress tracking
              </CardDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {commitSuccess && (
          <div className="p-4 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">Schedule baseline committed successfully! Reloading workspace...</span>
          </div>
        )}

        {/* Format Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 block">Schedule Format</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFormat('csv')}
              className={`p-3 rounded-xl border text-left transition ${
                format === 'csv'
                  ? 'border-amber-600 bg-amber-50/50 text-slate-900'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-800" />
                <span className="text-xs font-bold">CSV</span>
                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto">P0</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Standard comma-delimited export</p>
            </button>

            <button
              type="button"
              onClick={() => setFormat('xlsx')}
              className={`p-3 rounded-xl border text-left transition ${
                format === 'xlsx'
                  ? 'border-amber-600 bg-amber-50/50 text-slate-900'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold">Excel (.xlsx)</span>
                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto">P1</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Formatted spreadsheet workbook</p>
            </button>

            <button
              type="button"
              onClick={() => setFormat('p6')}
              className={`p-3 rounded-xl border text-left transition ${
                format === 'p6'
                  ? 'border-amber-600 bg-amber-50/50 text-slate-900'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold">Primavera (.xer)</span>
                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto">P2</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Enterprise Primavera P6 export</p>
            </button>
          </div>
        </div>

        {/* Upload Box */}
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3 hover:border-slate-300 transition bg-slate-50/40">
          <Upload className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              {fileName ? fileName : 'Upload schedule export file'}
            </p>
            <p className="text-[11px] text-slate-500">
              Select or drop your CSV, Excel, or Primavera export
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 text-xs font-semibold text-slate-800 transition">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.xer"
                onChange={handleFileUpload}
                disabled={isValidating || isCommitting}
                className="hidden"
              />
              <span>Browse File</span>
            </label>

            <button
              type="button"
              onClick={downloadSampleCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sample CSV Template</span>
            </button>
          </div>

          {isValidating && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-800 pt-2 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Validating schedule activities & network integrity...</span>
            </div>
          )}
        </div>

        {/* Preview Results */}
        {previewResult && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                Validation Summary
              </span>
              <Badge variant={hasBlockingErrors ? 'destructive' : 'success'}>
                {hasBlockingErrors ? 'Validation Failed' : 'Validation Passed'}
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Activities</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {previewResult.total_activities || activities.length}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Critical Path</span>
                <span className="text-base font-bold text-amber-800 font-mono">
                  {previewResult.critical_path_count ?? activities.filter((a) => a.critical_path).length}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Start Date</span>
                <span className="text-xs font-bold text-slate-900 font-mono block truncate">
                  {previewResult.start_date || activities[0]?.planned_start_date || '—'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Finish Date</span>
                <span className="text-xs font-bold text-slate-900 font-mono block truncate">
                  {previewResult.finish_date || activities[activities.length - 1]?.planned_finish_date || '—'}
                </span>
              </div>
            </div>

            {hasBlockingErrors && (
              <div className="space-y-1.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                <span className="font-semibold block flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Errors requiring resolution before commit:
                </span>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {previewResult.errors.map((err: string, idx: number) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isCommitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCommit}
            disabled={activities.length === 0 || hasBlockingErrors || isCommitting || commitSuccess}
            className="bg-[#C38B4B] hover:bg-[#b07b3e] text-white flex items-center gap-1.5"
          >
            {isCommitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Committing Baseline...</span>
              </>
            ) : (
              <>
                <span>Commit Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
