import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  X, 
  AlertCircle, 
  HardHat, 
  Briefcase, 
  FileCheck 
} from 'lucide-react';
import { signInWithEmail, signUpWithEmail } from '../lib/supabase';
import type { UserRole, AuthUser } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

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

  const handleDemoLogin = (role: UserRole, demoEmail: string, name: string) => {
    const demoUser: AuthUser = {
      id: `demo-${role.toLowerCase()}-${Date.now()}`,
      email: demoEmail,
      full_name: name,
      role,
    };
    onAuthSuccess(demoUser, 'demo-jwt-token-claims');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 sm:p-7 z-10 space-y-5 font-sans">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="signal-tick bg-[#C38B4B]" />
              <Badge variant="bronze">SECURE ACCESS</Badge>
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-sans tracking-tight">
              {tab === 'demo' ? 'Switch Enterprise Persona' :
               tab === 'signin' ? 'Sign In to NEXORA AI' : 'Create Enterprise Account'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">
              Role-based access control with cryptographic JWT authorization
            </p>
          </div>

          <Button 
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs font-sans">
          <button
            onClick={() => { setTab('demo'); setErrorMsg(null); }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              tab === 'demo' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Demo Personas
          </button>
          <button
            onClick={() => { setTab('signin'); setErrorMsg(null); }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              tab === 'signin' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setErrorMsg(null); }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              tab === 'signup' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-900 text-xs font-sans flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-[#FF3B30] shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content */}
        <div>
          {tab === 'demo' && (
            <div className="space-y-2.5">
              <button
                onClick={() => handleDemoLogin('PLANNER', 'planner@nexora.ai', 'Vikram Singh (Lead Planner)')}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/70 p-3.5 text-left transition group cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-[#C38B4B] border border-amber-200/70">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 font-sans">Lead Project Planner</span>
                      <Badge variant="bronze">PLANNER</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">Full review queue approval, override, and baseline export</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#C38B4B] group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => handleDemoLogin('ENGINEER', 'engineer@nexora.ai', 'Rajesh Sharma (Site Engineer)')}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/70 p-3.5 text-left transition group cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-200/70">
                    <HardHat className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 font-sans">Site Execution Engineer</span>
                      <Badge variant="cyan">ENGINEER</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">Evidence ingestion, DPR upload, and voice memos</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => handleDemoLogin('AUDITOR', 'auditor@nexora.ai', 'Sunita Rao (Quality Auditor)')}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/70 p-3.5 text-left transition group cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#34C759] border border-emerald-200/70">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 font-sans">Quality & Safety Auditor</span>
                      <Badge variant="success">AUDITOR</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">Cryptographic audit trail inspection & legal holds</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#34C759] group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          )}

          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-[11px] font-sans font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@enterprise.com"
                    required
                    className="w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#C38B4B] focus:outline-hidden font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-sans font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#C38B4B] focus:outline-hidden font-sans"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                variant="default"
                className="w-full flex items-center justify-center gap-2"
              >
                {isLoading ? 'Authenticating...' : 'Sign In to NEXORA'}
              </Button>
            </form>
          )}

          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-sans font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Priya Sharma"
                    required
                    className="w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#C38B4B] focus:outline-hidden font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-sans font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya@enterprise.com"
                    required
                    className="w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#C38B4B] focus:outline-hidden font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-sans font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#C38B4B] focus:outline-hidden font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-sans font-semibold text-slate-700 mb-1">
                  Assigned Project Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#C38B4B] focus:outline-hidden font-sans"
                >
                  <option value="PLANNER">PLANNER (Lead Project Planner)</option>
                  <option value="ENGINEER">ENGINEER (Site Execution Engineer)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Field Supervisor)</option>
                  <option value="AUDITOR">AUDITOR (Quality / Safety Auditor)</option>
                  <option value="VIEWER">VIEWER (Read-Only Observer)</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                variant="default"
                className="w-full flex items-center justify-center gap-2"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
