import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2,
  HardHat, 
  Briefcase, 
  FileCheck,
  RotateCcw
} from 'lucide-react';
import { 
  signInWithEmail, 
  signUpWithEmail, 
  resetPasswordForEmail, 
  resendVerificationEmail 
} from '../lib/supabase';
import type { UserRole, AuthUser } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

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
  const isDemoEnabled = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';

  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot' | 'demo'>(
    isDemoEnabled ? 'demo' : 'signin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('PLANNER');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowResend(false);

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
      const msg = err.message || 'Authentication failed. Please check credentials.';
      setErrorMsg(msg);
      if (msg.toLowerCase().includes('email not confirmed')) {
        setShowResend(true);
      }
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
    setSuccessMsg(null);
    setShowResend(false);

    try {
      const data = await signUpWithEmail(email, password, fullName, selectedRole);
      const user = data.user;
      const token = data.session?.access_token;

      if (token && user) {
        // Immediate session granted (auto-confirm enabled)
        const authUser: AuthUser = {
          id: user.id,
          email: user.email || email,
          full_name: fullName,
          role: selectedRole,
        };
        onAuthSuccess(authUser, token);
        onClose();
      } else {
        // Email confirmation required
        setSuccessMsg('Confirmation email sent! Please check your inbox and verify your email before signing in.');
        setShowResend(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your account email address.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await resetPasswordForEmail(email);
      setSuccessMsg(`Password recovery email sent to ${email}. Check your inbox for instructions.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send password recovery email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await resendVerificationEmail(email);
      setSuccessMsg(`Verification email resent to ${email}. Please check your spam folder if it does not arrive.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend verification email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (role: UserRole, demoEmail: string, name: string) => {
    const demoUser: AuthUser = {
      id: `demo-${role.toLowerCase()}-001`,
      email: demoEmail,
      full_name: name,
      role,
    };
    onAuthSuccess(demoUser);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-6 font-sans border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl">
        
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="signal-tick bg-[#C38B4B]" aria-hidden="true" />
            <Badge variant="bronze">SECURE ACCESS</Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white font-sans tracking-tight">
            {tab === 'demo' ? 'Switch Enterprise Persona' :
             tab === 'signin' ? 'Sign In to NEXORA' :
             tab === 'forgot' ? 'Reset Account Password' :
             'Create NEXORA Account'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-sans">
            Supabase cryptographic authentication &amp; role-based multi-tenant authorization
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <Tabs 
          value={tab} 
          onValueChange={(v) => { 
            setTab(v as any); 
            setErrorMsg(null); 
            setSuccessMsg(null);
            setShowResend(false);
          }} 
          className="w-full mt-2"
        >
          <TabsList className={`grid w-full ${isDemoEnabled ? 'grid-cols-3' : 'grid-cols-2'} h-9 mb-4`}>
            {isDemoEnabled && <TabsTrigger value="demo">Demo</TabsTrigger>}
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Register</TabsTrigger>
          </TabsList>

          {/* Success Notification */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 text-xs font-sans flex items-start gap-2 mb-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p>{successMsg}</p>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isLoading}
                    className="text-emerald-700 dark:text-emerald-300 underline font-medium hover:text-emerald-800 text-[11px] flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Resend verification email
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error Notification */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-200 text-xs font-sans flex items-start gap-2 mb-4">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p>{errorMsg}</p>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isLoading}
                    className="text-rose-700 dark:text-rose-300 underline font-medium hover:text-rose-800 text-[11px] flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Resend verification email
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Demo Personas Tab (only shown if isDemoEnabled) */}
          {isDemoEnabled && (
            <TabsContent value="demo" className="space-y-2.5 mt-0">
              <button
                type="button"
                onClick={() => handleDemoLogin('PLANNER', 'planner@nexora.ai', 'Vikram Singh (Lead Planner)')}
                aria-label="Switch persona to Lead Project Planner"
                className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/70 p-3.5 text-left transition group cursor-pointer shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#C38B4B]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-900 border border-amber-200/70">
                    <Briefcase className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 font-sans">Lead Project Planner</span>
                      <Badge variant="bronze">PLANNER</Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 font-sans mt-0.5">Full review queue approval, override, and schedule management</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-amber-900 group-hover:translate-x-0.5 transition" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('ENGINEER', 'engineer@nexora.ai', 'Rajesh Sharma (Site Engineer)')}
                aria-label="Switch persona to Site Execution Engineer"
                className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/70 p-3.5 text-left transition group cursor-pointer shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#C38B4B]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-800 border border-sky-200/70">
                    <HardHat className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 font-sans">Site Execution Engineer</span>
                      <Badge variant="cyan">ENGINEER</Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 font-sans mt-0.5">Evidence ingestion, DPR upload, and observation logging</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-sky-800 group-hover:translate-x-0.5 transition" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('AUDITOR', 'auditor@nexora.ai', 'Sunita Rao (Quality Auditor)')}
                aria-label="Switch persona to Quality & Safety Auditor"
                className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/70 p-3.5 text-left transition group cursor-pointer shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#C38B4B]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                    <FileCheck className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 font-sans">Quality &amp; Safety Auditor</span>
                      <Badge variant="success">AUDITOR</Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 font-sans mt-0.5">Audit hash-chain inspection, compliance exports, and legal holds</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition" aria-hidden="true" />
              </button>
            </TabsContent>
          )}

          {/* Sign In Tab */}
          <TabsContent value="signin" className="mt-0">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="signin-email" className="block text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@enterprise.com"
                    required
                    className="pl-9 h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="signin-password" className="block text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setErrorMsg(null); setSuccessMsg(null); }}
                    className="text-[11px] text-[#C38B4B] hover:text-[#9A6A34] font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-9 h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-xl bg-[#C38B4B] hover:bg-[#A87439] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                {isLoading ? 'Authenticating...' : 'Sign In to NEXORA'}
              </Button>
            </form>
          </TabsContent>

          {/* Sign Up Tab */}
          <TabsContent value="signup" className="mt-0">
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label htmlFor="signup-name" className="block text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <Input
                    id="signup-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Priya Sharma"
                    required
                    className="pl-9 h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya@enterprise.com"
                    required
                    className="pl-9 h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="pl-9 h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-role" className="block text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial role
                </label>
                <select
                  id="signup-role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-white focus:border-[#C38B4B] focus:outline-hidden font-sans"
                >
                  <option value="PLANNER">PLANNER — Lead Project Planner</option>
                  <option value="ENGINEER">ENGINEER — Site Execution Engineer</option>
                  <option value="SUPERVISOR">SUPERVISOR — Field Supervisor</option>
                  <option value="AUDITOR">AUDITOR — Quality / Safety Auditor</option>
                  <option value="VIEWER">VIEWER — Read-Only Observer</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-xl bg-[#C38B4B] hover:bg-[#A87439] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          </TabsContent>

          {/* Forgot Password Tab */}
          <TabsContent value="forgot" className="mt-0">
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Enter your account email below. We will send you a secure password reset link powered by Supabase Auth.
              </p>
              <div>
                <label htmlFor="forgot-email" className="block text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Account email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@enterprise.com"
                    required
                    className="pl-9 h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setTab('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                  className="flex-1 h-10 text-xs rounded-xl border-slate-200 dark:border-slate-800"
                >
                  Back to Sign In
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 h-10 rounded-xl bg-[#C38B4B] hover:bg-[#A87439] text-white font-medium text-xs shadow-sm transition"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
};
