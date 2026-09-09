import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  KeyRound, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check,
  Save,
  Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { user, currentRole, handleLogout, updatePassword, setUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty');
      return;
    }
    setIsUpdatingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.updateUser({
          data: { full_name: fullName.trim() },
        });
        if (error) throw error;
        if (data.user && user) {
          setUser({
            ...user,
            full_name: fullName.trim(),
          });
        }
      }
      setProfileSuccess('Profile name updated successfully');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      await updatePassword(newPassword);
      setPasswordSuccess('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white border border-slate-200/80 shadow-xl rounded-2xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#C38B4B]">
              <User className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900 font-sans">
                Account Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-sans">
                Manage your authenticated identity and security preferences
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Identity Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider font-sans">
                Identity & Access
              </span>
              <Badge variant="outline" className="text-[10px] font-mono border-slate-200 bg-white text-slate-700">
                {currentRole}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">Email</span>
                <div className="flex items-center space-x-1.5 text-slate-800 font-medium truncate">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{user?.email || 'Not configured'}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">User ID</span>
                <div className="flex items-center justify-between space-x-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                  <span className="font-mono text-[10px] text-slate-600 truncate">
                    {user?.id ? `${user.id.substring(0, 14)}...` : 'Unknown'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="text-slate-400 hover:text-slate-600 transition p-0.5"
                    title="Copy full User ID"
                  >
                    {copiedId ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Name Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 font-sans">
                Display Name
              </label>
              {profileSuccess && (
                <span className="text-[11px] text-emerald-600 flex items-center space-x-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{profileSuccess}</span>
                </span>
              )}
            </div>

            <div className="flex space-x-2">
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="text-xs h-9"
              />
              <Button
                type="submit"
                disabled={isUpdatingProfile || fullName === user?.full_name}
                className="h-9 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white shrink-0"
              >
                {isUpdatingProfile ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
            {profileError && (
              <p className="text-[11px] text-rose-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{profileError}</span>
              </p>
            )}
          </form>

          {/* Password Security Form */}
          <form onSubmit={handleChangePassword} className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                <label className="text-xs font-semibold text-slate-800 font-sans">
                  Change Password
                </label>
              </div>
              {passwordSuccess && (
                <span className="text-[11px] text-emerald-600 flex items-center space-x-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{passwordSuccess}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Input
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            {passwordError && (
              <p className="text-[11px] text-rose-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                variant="outline"
                className="h-8 px-3 text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                {isUpdatingPassword ? (
                  'Updating...'
                ) : (
                  <>
                    <Lock className="h-3 w-3 mr-1" />
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Logout Section */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
            <div className="text-[11px] text-slate-500">
              Sign out of this session on this browser
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                onClose();
                await handleLogout();
              }}
              className="h-8 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
            >
              <LogOut className="h-3 w-3 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
