import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  Sparkles, 
  X, 
  AlertCircle,
  HardHat,
  Briefcase,
  FileCheck
} from 'lucide-react';
import { signInWithEmail, signUpWithEmail } from '../lib/supabase';
import type { UserRole, AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser, token?: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [tab, setTab] = useState<'signin' | 'signup' | 'demo'>('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('PLANNER');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await signInWithEmail(email, password);
      const user = data.user;
      const token = data.session?.access_token;
      
      const authUser: AuthUser = {
        id: user.id,
        email: user.email || email,
        full_name: (user.user_metadata as any)?.full_name || email.split('@')[0],
        role: (user.user_metadata as any)?.role || 'PLANNER',
      };

      onAuthSuccess(authUser, token);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await signUpWithEmail(email, password, fullName, selectedRole);
      const user = data.user;
      const token = data.session?.access_token;

      if (user) {
        const authUser: AuthUser = {
          id: user.id,
          email: user.email || email,
          full_name: fullName,
          role: selectedRole,
        };
        onAuthSuccess(authUser, token);
        onClose();
      } else {
        setErrorMsg('Confirmation email sent. Please verify your email.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (role: UserRole, emailPreset: string, namePreset: string) => {
    const demoUser: AuthUser = {
      id: `usr-${role.toLowerCase()}-${Date.now().toString().slice(-6)}`,
      email: emailPreset,
      full_name: namePreset,
      role: role,
    };
    onAuthSuccess(demoUser, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo_token');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C38B4B]/15 border border-[#C38B4B]/30">
              <ShieldCheck className="h-4 w-4 text-[#C38B4B]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white font-mono tracking-tight">
                NEXORA IDENTITY ACCESS
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Supabase Auth & Cryptographic JWT Engine
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

        {/* Tab Selector */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/30 p-1 text-xs font-mono font-medium">
          <button
            onClick={() => { setTab('demo'); setErrorMsg(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded transition ${
              tab === 'demo'
                ? 'bg-[#C38B4B] text-slate-950 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Quick Demo</span>
          </button>
          <button
            onClick={() => { setTab('signin'); setErrorMsg(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded transition ${
              tab === 'signin'
                ? 'bg-slate-800 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => { setTab('signup'); setErrorMsg(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded transition ${
              tab === 'signup'
                ? 'bg-slate-800 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Sign Up</span>
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="m-4 mb-0 flex items-center gap-2 rounded border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-6">
          {tab === 'demo' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 font-mono mb-4">
                Select an authorized enterprise role to evaluate permissions, review queue approvals, and Trust Plane verification:
              </p>

              <button
                onClick={() => handleDemoLogin('PLANNER', 'planner@nexora.ai', 'Vikram Singh (Lead Planner)')}
                className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-[#C38B4B]/50 p-3.5 text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-[#C38B4B]/15 text-[#C38B4B]">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">Lead Project Planner</span>
                      <span className="rounded bg-[#C38B4B]/20 px-1.5 py-0.5 text-[9px] font-mono text-[#C38B4B]">
                        PLANNER
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Full review queue approval, override, and baseline export</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-[#C38B4B] group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => handleDemoLogin('ENGINEER', 'engineer@nexora.ai', 'Rajesh Sharma (Site Engineer)')}
                className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-cyan-500/50 p-3.5 text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-cyan-500/15 text-cyan-400">
                    <HardHat className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">Site Execution Engineer</span>
                      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300">
                        ENGINEER
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Evidence ingestion, DPR upload, and voice memos</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => handleDemoLogin('AUDITOR', 'auditor@nexora.ai', 'Sunita Rao (Quality Auditor)')}
                className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-emerald-500/50 p-3.5 text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">Quality & Safety Auditor</span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300">
                        AUDITOR
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Cryptographic audit trail inspection & legal holds</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          )}

          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@enterprise.com"
                    required
                    className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-[#C38B4B] py-2.5 text-xs font-mono font-bold text-slate-950 hover:bg-[#b07d42] transition disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Nexora</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Priya Sharma"
                    required
                    className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya@enterprise.com"
                    required
                    className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-300 mb-1">
                  Primary Industrial Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-[#C38B4B] focus:outline-hidden font-mono"
                >
                  <option value="PLANNER">Lead Planner (Review & Approval)</option>
                  <option value="ENGINEER">Site Execution Engineer</option>
                  <option value="SUPERVISOR">Field Supervisor</option>
                  <option value="AUDITOR">Quality & Safety Auditor</option>
                  <option value="VIEWER">Executive Observer (Read Only)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-[#C38B4B] py-2.5 text-xs font-mono font-bold text-slate-950 hover:bg-[#b07d42] transition disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span>Registering Identity...</span>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-3 text-[10px] text-slate-500 font-mono flex items-center justify-between">
          <span>Zero-Trust Enterprise Protocol</span>
          <span className="text-emerald-400">PostgreSQL RLS Active</span>
        </div>
      </div>
    </div>
  );
};
