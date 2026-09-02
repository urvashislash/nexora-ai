import React, { useState } from 'react';
import { 
  FolderPlus, 
  ArrowRight, 
  FileCode, 
  AlertCircle, 
  Building2, 
  Layers 
} from 'lucide-react';
import { createProjectInDB } from '../lib/supabase';
import type { Project, ProjectCreateInput, BaselineActivityInput, Discipline } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';

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
    location: 'Pump House',
    zone: 'Zone 2',
    equipment_tag: 'P-101A/B',
    critical_path: true,
  },
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
  const [parsedActivities, setParsedActivities] = useState<BaselineActivityInput[]>(TEMPLATE_ACTIVITIES);
  const [importSource, setImportSource] = useState<'template' | 'p6xml' | 'csv'>('template');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApplyPreset = (preset: 'refinery' | 'metro' | 'highway') => {
    if (preset === 'refinery') {
      setCode('PRD-HYD-PKG05');
      setName('Paradip Refinery Hydrocracker Expansion Unit');
      setDescription('Hydrocracker Expansion Package with High-Pressure Piping and Reactor Foundations');
    } else if (preset === 'metro') {
      setCode('MUM-METRO-03');
      setName('Mumbai Metro Line 3 Underground Section');
      setDescription('Underground Station Box and Track Laying Package');
    } else {
      setCode('DEL-MUM-EXP02');
      setName('Delhi-Mumbai Expressway Package 02');
      setDescription('Four-lane greenfield concrete pavement and culvert package');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'application/xml');
        const acts = xmlDoc.getElementsByTagName('Activity');
        const activities: BaselineActivityInput[] = [];

        for (let i = 0; i < acts.length; i++) {
          const el = acts[i];
          const actCode = el.getAttribute('Id') || `ACT-${i + 1}`;
          const actName = el.getAttribute('Name') || 'Untitled Activity';
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden font-sans">
        
        {/* Header */}
        <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/70 text-[#C38B4B]">
              <FolderPlus className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                Create New Project Package
              </DialogTitle>
              <DialogDescription className="text-[11px] text-slate-500 font-sans">
                Initialize multi-tenant package with baseline Primavera / CSV schedule
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="grid grid-cols-2 border-b border-slate-100 bg-white text-xs font-sans">
          <button
            type="button"
            aria-pressed={step === 1}
            onClick={() => setStep(1)}
            className={`flex items-center justify-center gap-2 py-3 border-b-2 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 ${
              step === 1
                ? 'border-[#C38B4B] text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>1. Package Metadata</span>
          </button>
          <button
            type="button"
            aria-pressed={step === 2}
            onClick={() => {
              if (code && name) setStep(2);
              else setErrorMsg('Please fill in Code and Name first.');
            }}
            className={`flex items-center justify-center gap-2 py-3 border-b-2 transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 ${
              step === 2
                ? 'border-[#C38B4B] text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>2. Baseline Schedule ({parsedActivities.length} Tasks)</span>
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="m-4 mb-0 flex items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50 p-3 text-xs text-rose-950 font-sans">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-800" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto font-sans">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="project-code" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1.5">
                    Project code *
                  </label>
                  <Input
                    id="project-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MUM-METRO-04"
                    required
                    className="font-mono font-bold uppercase"
                  />
                  <span className="text-[10px] text-slate-600 font-sans mt-0.5 block font-medium">Unique WBS prefix</span>
                </div>

                <div>
                  <div className="mb-1.5 flex gap-2 text-[11px] font-sans font-semibold text-slate-700">
                    <label htmlFor="project-currency" className="w-1/2">Currency</label>
                    <label htmlFor="project-timezone" className="w-1/2">Timezone</label>
                  </div>
                  <div className="flex gap-2">
                    <select
                      id="project-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-1/2 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-sans text-slate-800 focus:border-[#C38B4B] focus:outline-hidden"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AED">AED (د.إ)</option>
                    </select>
                    <select
                      id="project-timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-1/2 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-sans text-slate-800 focus:border-[#C38B4B] focus:outline-hidden"
                    >
                      <option value="Asia/Kolkata">IST (UTC+5:30)</option>
                      <option value="Asia/Dubai">GST (UTC+4)</option>
                      <option value="America/New_York">EST (UTC-5)</option>
                      <option value="Europe/London">GMT (UTC+0)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="project-name" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1.5">
                  Project name *
                </label>
                <Input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mumbai Metro Line 3 Underground Package 04"
                  required
                />
              </div>

              <div>
                <label htmlFor="project-description" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1.5">
                  Project description
                </label>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe the contractual scope, WBS boundaries, and key civil/piping milestones..."
                  rows={2}
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-sans font-semibold uppercase text-slate-600 block">
                  Quick Industrial Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => handleApplyPreset('refinery')}
                    variant="outline"
                    size="sm"
                    aria-label="Apply preset: Paradip Hydrocracker"
                  >
                    Paradip Hydrocracker
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleApplyPreset('metro')}
                    variant="outline"
                    size="sm"
                    aria-label="Apply preset: Mumbai Metro L3"
                  >
                    Mumbai Metro L3
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleApplyPreset('highway')}
                    variant="outline"
                    size="sm"
                    aria-label="Apply preset: Delhi-Mumbai Expressway"
                  >
                    Delhi-Mumbai Expressway
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-semibold text-slate-700">
                  Select Baseline Schedule Ingestion Method
                </span>
                <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/60 text-xs font-sans">
                  <button
                    type="button"
                    aria-pressed={importSource === 'template'}
                    onClick={() => { setImportSource('template'); setParsedActivities(TEMPLATE_ACTIVITIES); }}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 ${
                      importSource === 'template' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Standard Template
                  </button>
                  <button
                    type="button"
                    aria-pressed={importSource === 'p6xml'}
                    onClick={() => setImportSource('p6xml')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 ${
                      importSource === 'p6xml' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    P6 XML Import
                  </button>
                </div>
              </div>

              {importSource === 'p6xml' && (
                <div className="p-4 rounded-xl border-2 border-dashed border-slate-200/90 text-center space-y-2 bg-slate-50/50">
                  <FileCode className="h-6 w-6 text-amber-800 mx-auto" aria-hidden="true" />
                  <p className="text-xs font-semibold text-slate-800 font-sans">
                    Upload Primavera P6 XML Schedule (.xml)
                  </p>
                  <input
                    type="file"
                    accept=".xml"
                    aria-label="Primavera P6 XML Schedule File"
                    onChange={handleFileUpload}
                    className="text-xs font-sans text-slate-600"
                  />
                </div>
              )}

              {/* Task Preview Table */}
              <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Activity Name</TableHead>
                      <TableHead>Discipline</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedActivities.slice(0, 5).map((act, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono font-bold text-slate-900">{act.code}</TableCell>
                        <TableCell className="truncate max-w-xs font-medium text-slate-900">{act.name}</TableCell>
                        <TableCell><Badge variant="secondary">{act.discipline}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-slate-900 font-medium">{act.planned_duration_days}d</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between sm:justify-between">
          {step === 2 ? (
            <Button
              type="button"
              onClick={() => setStep(1)}
              variant="outline"
              size="sm"
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
            {step === 1 ? (
              <Button
                type="button"
                onClick={() => {
                  if (code && name) setStep(2);
                  else setErrorMsg('Please fill in Code and Name first.');
                }}
                variant="default"
                size="sm"
                className="flex items-center gap-1.5"
              >
                <span>Continue to Schedule</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                variant="bronze"
                size="sm"
              >
                {isLoading ? 'Creating Package...' : 'Create Project Package'}
              </Button>
            )}
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};
