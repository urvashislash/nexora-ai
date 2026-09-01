import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  AlertCircle, 
  HardHat, 
  Briefcase, 
  FileCheck 
} from 'lucide-react';
import { signInWithEmail, signUpWithEmail } from '../lib/supabase';
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
  const [tab, setTab] = useState<'signin' | 'signup' | 'demo'>('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('PLANNER');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-6 font-sans">
        
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="signal-tick bg-[#C38B4B]" />
            <Badge variant="bronze">SECURE ACCESS</Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 font-sans tracking-tight">
            {tab === 'demo' ? 'Switch Enterprise Persona' :
             tab === 'signin' ? 'Sign In to NEXORA AI' : 'Create Enterprise Account'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-sans">
            Role-based access control with cryptographic JWT authorization
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setErrorMsg(null); }} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9 mb-4">
            <TabsTrigger value="demo">Demo Personas</TabsTrigger>
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Register</TabsTrigger>
          </TabsList>

          {/* Error Notification */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-900 text-xs font-sans flex items-start gap-2 mb-4">
              <AlertCircle className="h-4 w-4 text-[#FF3B30] shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Demo Tab */}
          <TabsContent value="demo" className="space-y-2.5 mt-0">
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
          </TabsContent>

          {/* Sign In Tab */}
          <TabsContent value="signin" className="mt-0">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="signin-email" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@enterprise.com"
                    required
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signin-password" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-9"
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
          </TabsContent>

          {/* Sign Up Tab */}
          <TabsContent value="signup" className="mt-0">
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label htmlFor="signup-name" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1">
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                  <Input
                    id="signup-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Priya Sharma"
                    required
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya@enterprise.com"
                    required
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-role" className="block text-[11px] font-sans font-semibold text-slate-700 mb-1">
                  Project role
                </label>
                <select
                  id="signup-role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#C38B4B] focus:outline-hidden font-sans"
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
          </TabsContent>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
};
