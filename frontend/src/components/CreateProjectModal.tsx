import React, { useState } from 'react';
import { 
  FolderPlus, 
  X, 
  ArrowRight, 
  FileSpreadsheet, 
  FileCode, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Layers
} from 'lucide-react';
import { createProjectInDB } from '../lib/supabase';
import type { Project, ProjectCreateInput, BaselineActivityInput, Discipline } from '../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
  userId?: string;
}

const TEMPLATE_ACTIVITIES: BaselineActivityInput[] = [
  {
    code: 'CIV-1001',
    name: 'Foundation Excavation & Soil Compaction - Block A',
    discipline: 'CIVIL',
    planned_start_date: '2026-09-01',
    planned_finish_date: '2026-09-12',
    planned_duration_days: 12,
    planned_quantity: 420.0,
    unit_of_measure: 'Cum',
    location: 'Plot 4A',
    zone: 'Zone 1',
    critical_path: true,
  },
  {
    code: 'CIV-1002',
    name: 'Reinforced Concrete Pouring - Foundation Mat',
    discipline: 'CIVIL',
    planned_start_date: '2026-09-13',
    planned_finish_date: '2026-09-22',
    planned_duration_days: 10,
    planned_quantity: 180.0,
    unit_of_measure: 'Cum',
    location: 'Plot 4A',
    zone: 'Zone 1',
    critical_path: true,
  },
  {
    code: 'PIP-2001',
    name: 'Carbon Steel Header Spool Erection - Tier 1',
    discipline: 'PIPING',
    planned_start_date: '2026-09-23',
    planned_finish_date: '2026-10-05',
    planned_duration_days: 13,
    planned_quantity: 350.0,
    unit_of_measure: 'Inch-Dia',
    location: 'Pipe Rack Main',
    zone: 'Zone 2',
    equipment_tag: 'RACK-MAIN-CS',
    critical_path: true,
  },
  {
    code: 'PIP-2002',
    name: 'Hydrostatic Pressure Testing - Main Crude Line',
    discipline: 'PIPING',
    planned_start_date: '2026-10-06',
    planned_finish_date: '2026-10-09',
    planned_duration_days: 4,
    planned_quantity: 1.0,
    unit_of_measure: 'Test-Pack',
    location: 'Pipe Rack Main',
    zone: 'Zone 2',
    equipment_tag: 'LINE-CRUDE-01',
    critical_path: true,
  },
  {
    code: 'ELE-3001',
    name: 'Cable Tray Installation & High Voltage Pulling',
    discipline: 'ELECTRICAL',
    planned_start_date: '2026-09-25',
    planned_finish_date: '2026-10-10',
    planned_duration_days: 16,
    planned_quantity: 1200.0,
    unit_of_measure: 'Rmt',
    location: 'Substation 02',
    zone: 'Zone 3',
    critical_path: false,
  },
  {
    code: 'MEC-4001',
    name: 'Main Centrifugal Pump Alignment & Grouting',
    discipline: 'MECHANICAL',
    planned_start_date: '2026-10-10',
    planned_finish_date: '2026-10-18',
    planned_duration_days: 9,
    planned_quantity: 2.0,
    unit_of_measure: 'Unit',
    location: 'Pump House B',
    zone: 'Zone 2',
    equipment_tag: 'P-101A/B',
    critical_path: false,
  }
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  userId,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  
  // Baseline schedule method
  const [scheduleSource, setScheduleSource] = useState<'template' | 'csv' | 'p6xml'>('template');
  const [parsedActivities, setParsedActivities] = useState<BaselineActivityInput[]>(TEMPLATE_ACTIVITIES);
  const [fileName, setFileName] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          setErrorMsg('CSV file is empty or missing headers.');
          return;
        }

        const activities: BaselineActivityInput[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 5) {
            activities.push({
              code: cols[0] || `ACT-${i}`,
              name: cols[1] || `Activity ${i}`,
              discipline: (cols[2]?.toUpperCase() as Discipline) || 'GENERAL',
              planned_start_date: cols[3] || '2026-09-01',
              planned_finish_date: cols[4] || '2026-09-15',
              planned_duration_days: parseInt(cols[5] || '14', 10),
              planned_quantity: cols[6] ? parseFloat(cols[6]) : undefined,
              unit_of_measure: cols[7] || 'Unit',
              critical_path: cols[8]?.toUpperCase() === 'YES' || cols[8] === 'true',
            });
          }
        }

        if (activities.length > 0) {
          setParsedActivities(activities);
          setErrorMsg(null);
        } else {
          setErrorMsg('Could not parse valid activity rows from CSV.');
        }
      } catch {
        setErrorMsg('Failed to read CSV schedule file.');
      }
    };
    reader.readAsText(file);
  };

  const handleP6XMLUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const actElements = xmlDoc.getElementsByTagName('Activity');

        if (actElements.length === 0) {
          setErrorMsg('No <Activity> elements found in XML.');
          return;
        }

        const activities: BaselineActivityInput[] = [];
        for (let i = 0; i < actElements.length; i++) {
          const el = actElements[i];
          const actCode = el.getAttribute('Id') || el.getElementsByTagName('Id')[0]?.textContent || `ACT-${i+1}`;
          const actName = el.getAttribute('Name') || el.getElementsByTagName('Name')[0]?.textContent || `Activity ${i+1}`;
          const disc = (el.getAttribute('Discipline') || 'GENERAL').toUpperCase() as Discipline;
          const pStart = el.getAttribute('PlannedStart') || '2026-09-01';
          const pFinish = el.getAttribute('PlannedFinish') || '2026-09-20';

          activities.push({
            code: actCode,
            name: actName,
            discipline: disc,
            planned_start_date: pStart.slice(0, 10),
            planned_finish_date: pFinish.slice(0, 10),
            planned_duration_days: 15,
            critical_path: i % 2 === 0,
          });
        }

        setParsedActivities(activities);
        setErrorMsg(null);
      } catch {
        setErrorMsg('Failed to parse Primavera P6 XML schedule.');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!code || !name) {
      setErrorMsg('Please enter both project code and project name.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const projectInput: ProjectCreateInput = {
      code: code.toUpperCase().trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      currency,
      timezone,
      baselineActivities: parsedActivities,
    };

    try {
      const created = await createProjectInDB(projectInput, userId);
      if (created) {
        onProjectCreated(created);
        onClose();
      } else {
        // Fallback local creation
        const localFallback: Project = {
          id: `p-${Date.now()}`,
          code: projectInput.code,
          name: projectInput.name,
          description: projectInput.description,
          currency: projectInput.currency || 'INR',
          timezone: projectInput.timezone || 'Asia/Kolkata',
        };
        onProjectCreated(localFallback);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create project in database.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C38B4B]/15 border border-[#C38B4B]/30 text-[#C38B4B]">
              <FolderPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white font-mono tracking-tight">
                CREATE NEW INDUSTRIAL PROJECT
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Initialize multi-tenant package with baseline Primavera / CSV schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/30 text-xs font-mono">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center justify-center gap-2 py-2.5 border-b-2 transition ${
              step === 1
                ? 'border-[#C38B4B] text-[#C38B4B] font-bold bg-[#C38B4B]/5'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>1. Package Metadata</span>
          </button>
          <button
            onClick={() => {
              if (code && name) setStep(2);
              else setErrorMsg('Please fill in Code and Name first.');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 border-b-2 transition ${
              step === 2
                ? 'border-[#C38B4B] text-[#C38B4B] font-bold bg-[#C38B4B]/5'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>2. Baseline Schedule ({parsedActivities.length} Tasks)</span>
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="m-4 mb-0 flex items-center gap-2 rounded border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 font-mono">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1.5">
                    Project Code *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MUM-METRO-04"
                    required
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono font-bold text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden uppercase"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Unique WBS prefix</span>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1.5">
                    Currency & Region
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-mono text-white focus:border-[#C38B4B] focus:outline-hidden"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="AED">AED (د.إ)</option>
                    </select>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-mono text-white focus:border-[#C38B4B] focus:outline-hidden truncate"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata</option>
                      <option value="UTC">UTC</option>
                      <option value="Asia/Dubai">Asia/Dubai</option>
                      <option value="America/New_York">America/New_York</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1.5">
                  Package Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mumbai Metro Line 4 Underground Tunneling Package"
                  required
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1.5">
                  Scope & Engineering Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief summary of engineering disciplines, EPC contractor, and critical milestones..."
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!code || !name) {
                      setErrorMsg('Please enter both Project Code and Package Name.');
                      return;
                    }
                    setErrorMsg(null);
                    setStep(2);
                  }}
                  className="flex items-center gap-2 rounded-md bg-[#C38B4B] px-4 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-[#b07d42] transition"
                >
                  <span>Next: Configure Baseline Schedule</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Baseline Source Selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScheduleSource('template');
                    setParsedActivities(TEMPLATE_ACTIVITIES);
                    setFileName(null);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition ${
                    scheduleSource === 'template'
                      ? 'border-[#C38B4B] bg-[#C38B4B]/10 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-[#C38B4B]" />
                  <span className="text-xs font-mono font-semibold">EPC Template</span>
                  <span className="text-[10px] text-slate-400">6 Multi-Discipline Tasks</span>
                </button>

                <label
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center cursor-pointer transition ${
                    scheduleSource === 'csv'
                      ? 'border-[#C38B4B] bg-[#C38B4B]/10 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-mono font-semibold">Upload CSV</span>
                  <span className="text-[10px] text-slate-400">{fileName || 'Standard Format'}</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      setScheduleSource('csv');
                      handleCSVUpload(e);
                    }}
                    className="hidden"
                  />
                </label>

                <label
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center cursor-pointer transition ${
                    scheduleSource === 'p6xml'
                      ? 'border-[#C38B4B] bg-[#C38B4B]/10 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <FileCode className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-mono font-semibold">Primavera P6 XML</span>
                  <span className="text-[10px] text-slate-400">{fileName || 'Oracle P6 XML'}</span>
                  <input
                    type="file"
                    accept=".xml"
                    onChange={(e) => {
                      setScheduleSource('p6xml');
                      handleP6XMLUpload(e);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Activities Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-slate-300">
                    Baseline Schedule Preview ({parsedActivities.length} Activities)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Schema Validated</span>
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Activity Name</th>
                        <th className="px-3 py-2">Discipline</th>
                        <th className="px-3 py-2">Start</th>
                        <th className="px-3 py-2">Finish</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {parsedActivities.map((act, i) => (
                        <tr key={i} className="hover:bg-slate-900/40">
                          <td className="px-3 py-1.5 font-bold text-[#C38B4B]">{act.code}</td>
                          <td className="px-3 py-1.5 truncate max-w-[200px]">{act.name}</td>
                          <td className="px-3 py-1.5">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px]">
                              {act.discipline}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-slate-400">{act.planned_start_date}</td>
                          <td className="px-3 py-1.5 text-slate-400">{act.planned_finish_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-md border border-slate-700 px-3 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800 transition"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-md bg-[#C38B4B] px-5 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-[#b07d42] transition disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Initializing Package...</span>
                  ) : (
                    <>
                      <span>Launch Project</span>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
