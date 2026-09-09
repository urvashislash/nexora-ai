import React, { useState } from 'react';
import { 
  Building2, 
  FolderGit2, 
  Upload, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  Users, 
  FileText 
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { useTeam } from '../contexts/TeamContext';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface OnboardingProps {
  onComplete: () => void;
  onNavigateTab: (tab: string) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onNavigateTab }) => {
  const { user } = useAuth();
  const { createTeam } = useTeam();
  const { handleProjectCreated } = useProject();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [teamName, setTeamName] = useState('');
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Create Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const team = await createTeam(teamName.trim());
      setCreatedTeamId(team.id);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to create team');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Create First Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectCode.trim() || !createdTeamId) return;

    setIsLoading(true);
    setError(null);
    try {
      const proj = await api.createTeamProject(createdTeamId, {
        name: projectName.trim(),
        code: projectCode.trim().toUpperCase(),
        timezone,
        currency,
        team_id: createdTeamId,
      });

      if (proj) {
        handleProjectCreated(proj);
        setStep(3);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-xl p-8 bg-white border border-slate-200 shadow-xl rounded-2xl space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  step === s 
                    ? 'w-8 bg-[#C38B4B]' 
                    : step > s 
                    ? 'w-4 bg-emerald-600' 
                    : 'w-4 bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
            Step {step} of 4
          </span>
        </div>

        {error && (
          <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        {/* STEP 1: WELCOME & CREATE TEAM */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold mb-2">
                <Building2 className="w-3.5 h-3.5 text-amber-700" />
                <span>Welcome to NEXORA Beta{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
                Set up your Organization / Team
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                Teams isolate your projects, documents, schedules, and members with strict tenant boundaries.
              </p>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Team / Company Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Acme EPC Infrastructure"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                  className="text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !teamName.trim()}
                className="w-full bg-[#C38B4B] hover:bg-[#b07b3e] text-white flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Continue to First Project</span>}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}

        {/* STEP 2: CREATE FIRST PROJECT */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold mb-2">
                <FolderGit2 className="w-3.5 h-3.5 text-blue-700" />
                <span>Project Initialization</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
                Create your first construction project
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                Enter your project metadata. You will be assigned as project Lead Planner automatically.
              </p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Paradip Refinery Expansion - Package 04"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Project Code / WBS Prefix <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="PRD-PKG04"
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  disabled={isLoading}
                  required
                  className="text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !projectName.trim() || !projectCode.trim()}
                className="w-full bg-[#C38B4B] hover:bg-[#b07b3e] text-white flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Create Project</span>}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}

        {/* STEP 3: NEXT STEPS PANEL */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Project Created</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
                Next steps to activate your workspace
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                Choose an action to populate your project baseline or invite your colleagues.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  onNavigateTab('import');
                  onComplete();
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-amber-800 shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-900 block font-sans">
                      1. Import Schedule Baseline
                    </span>
                    <span className="text-xs text-slate-500 font-sans">
                      Upload Primavera P6 (.xer), Excel (.xlsx), or CSV schedule
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateTab('upload');
                  onComplete();
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-blue-800 shadow-2xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-900 block font-sans">
                      2. Ingest Field Report (DPR)
                    </span>
                    <span className="text-xs text-slate-500 font-sans">
                      Upload PDF or image daily reports to extract facts via AI
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition" />
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-emerald-800 shadow-2xs">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-900 block font-sans">
                      3. Skip to Project Dashboard
                    </span>
                    <span className="text-xs text-slate-500 font-sans">
                      Explore the empty project workspace first
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: "YOU'RE READY" */}
        {step === 4 && (
          <div className="space-y-6 text-center py-4 animate-in fade-in duration-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
                You're all set!
              </h1>
              <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto">
                Your team and project have been provisioned in the immutable Trust Plane.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => {
                onNavigateTab('dashboard');
                onComplete();
              }}
              className="w-full bg-[#C38B4B] hover:bg-[#b07b3e] text-white"
            >
              Open Dashboard
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
