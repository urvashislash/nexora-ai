import React, { useState } from 'react';
import { 
  Building2, 
  Mail, 
  UserPlus, 
  ShieldAlert, 
  Trash2, 
  Crown, 
  X, 
  Loader2, 
  Check 
} from 'lucide-react';
import { useTeam } from '../contexts/TeamContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';

const TEAM_ROLES = ['OWNER', 'ADMIN', 'PLANNER', 'ENGINEER', 'SUPERVISOR', 'AUDITOR', 'VIEWER'] as const;

export const TeamSettings: React.FC = () => {
  const { user } = useAuth();
  const { 
    activeTeam, 
    teamMembers, 
    teamInvitations, 
    currentTeamRole, 
    updateTeam, 
    deleteTeam, 
    inviteMember, 
    updateMemberRole, 
    removeMember, 
    transferOwnership, 
    revokeInvitation 
  } = useTeam();

  const [teamName, setTeamName] = useState(activeTeam?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('PLANNER');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Transfer ownership state
  const [isTransferring, setIsTransferring] = useState(false);

  if (!activeTeam) {
    return (
      <div className="p-8 text-center space-y-3">
        <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
        <h2 className="text-base font-semibold text-slate-900">No active team selected</h2>
        <p className="text-xs text-slate-500">Select or create a team to manage members and settings.</p>
      </div>
    );
  }

  const isOwner = currentTeamRole === 'OWNER';
  const isAdminOrOwner = currentTeamRole === 'OWNER' || currentTeamRole === 'ADMIN';

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !isAdminOrOwner) return;

    setIsSavingName(true);
    setNameSaveSuccess(false);
    try {
      await updateTeam(activeTeam.id, teamName.trim());
      setNameSaveSuccess(true);
      setTimeout(() => setNameSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update team name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !isAdminOrOwner) return;

    setIsInviting(true);
    setInviteError(null);
    try {
      await inviteMember(activeTeam.id, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      setIsInviteModalOpen(false);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmationText !== activeTeam.name || !isOwner) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteTeam(activeTeam.id);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete team');
      setIsDeleting(false);
    }
  };

  const handleTransfer = async (targetId: string) => {
    if (!isOwner || !window.confirm('Are you sure you want to transfer team ownership? You will become an Admin.')) {
      return;
    }
    setIsTransferring(true);
    try {
      await transferOwnership(activeTeam.id, targetId);
    } catch (err: any) {
      alert(err.message || 'Failed to transfer ownership');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="signal-tick bg-amber-700" aria-hidden="true" />
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            Team Settings &bull; {currentTeamRole}
          </Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">
          {activeTeam.name}
        </h1>
        <p className="text-xs text-slate-600 mt-1 font-sans">
          Manage team members, roles, invitations, and team-level access governance.
        </p>
      </div>

      {/* Team Details Card */}
      <Card className="p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 font-sans">
            Team Profile
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 font-sans">
            Identifier and display name for this organization
          </CardDescription>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label htmlFor="edit-team-name" className="text-xs font-semibold text-slate-700 font-sans block">
              Team Name
            </label>
            <div className="flex gap-2">
              <Input
                id="edit-team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={!isAdminOrOwner || isSavingName}
                className="text-sm"
              />
              {isAdminOrOwner && (
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={isSavingName || !teamName.trim() || teamName === activeTeam.name}
                  className="bg-[#C38B4B] hover:bg-[#b07b3e] text-white shrink-0"
                >
                  {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </Button>
              )}
            </div>
            {nameSaveSuccess && (
              <p className="text-[11px] text-emerald-600 font-sans flex items-center gap-1">
                <Check className="w-3 h-3" /> Team name saved successfully
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 font-sans block">
              Team Slug
            </label>
            <Input
              value={activeTeam.slug}
              disabled
              className="text-sm font-mono bg-slate-50 text-slate-500"
            />
          </div>
        </form>
      </Card>

      {/* Members Section */}
      <Card className="p-6 shadow-2xs space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900 font-sans">
              Team Members ({teamMembers.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-sans">
              Users with access to projects under this organization
            </CardDescription>
          </div>
          {isAdminOrOwner && (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-[#C38B4B] hover:bg-[#b07b3e] text-white flex items-center gap-1.5 self-start sm:self-auto"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Invite Member</span>
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Team Role</TableHead>
                <TableHead>Status</TableHead>
                {isAdminOrOwner && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => {
                const isMemberSelf = member.user_id === user?.id;
                const isMemberOwner = member.role === 'OWNER';

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-slate-900 font-sans">
                      <div className="flex items-center gap-2">
                        {isMemberOwner && (
                          <span title="Team Owner">
                            <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                          </span>
                        )}
                        <span>{member.full_name || 'Member'}</span>
                        {isMemberSelf && <span className="text-[10px] text-slate-400 font-mono">(You)</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {member.email || '—'}
                    </TableCell>
                    <TableCell>
                      {isAdminOrOwner && !isMemberOwner && !isMemberSelf ? (
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(activeTeam.id, member.user_id, e.target.value)}
                          className="text-xs font-mono font-semibold px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-slate-400"
                        >
                          {TEAM_ROLES.filter((r) => r !== 'OWNER').map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant={isMemberOwner ? 'warning' : 'secondary'} className="font-mono text-[10px] uppercase">
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? 'success' : 'outline'} className="text-[10px]">
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {isAdminOrOwner && (
                      <TableCell className="text-right">
                        {!isMemberOwner && !isMemberSelf && (
                          <div className="flex items-center justify-end gap-2">
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleTransfer(member.user_id)}
                                disabled={isTransferring}
                                title="Transfer Ownership"
                                className="text-[11px] text-slate-500 hover:text-slate-900 transition underline font-sans"
                              >
                                Make Owner
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Remove ${member.email || 'this member'} from the team?`)) {
                                  removeMember(activeTeam.id, member.user_id);
                                }
                              }}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded-md hover:bg-rose-50 transition"
                              title="Remove member"
                              aria-label={`Remove ${member.email || 'member'}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pending Invitations Section */}
      {isAdminOrOwner && (
        <Card className="p-6 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900 font-sans">
              Pending Invitations ({teamInvitations.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-sans">
              Invited colleagues awaiting acceptance
            </CardDescription>
          </div>

          {teamInvitations.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {teamInvitations.map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between gap-4 text-xs font-sans">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                    <span className="font-mono font-medium text-slate-900 truncate">{inv.email}</span>
                    <Badge variant="secondary" className="font-mono text-[9px] uppercase">
                      {inv.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeInvitation(activeTeam.id, inv.id)}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 h-7 text-xs"
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-2">No pending invitations for this team.</p>
          )}
        </Card>
      )}

      {/* Danger Zone */}
      {isOwner && (
        <Card className="p-6 border border-rose-200 bg-rose-50/20 shadow-2xs space-y-4">
          <div className="border-b border-rose-100 pb-3">
            <CardTitle className="text-sm font-semibold text-rose-900 font-sans flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" aria-hidden="true" />
              <span>Danger Zone</span>
            </CardTitle>
            <CardDescription className="text-xs text-rose-700 font-sans">
              Destructive actions for team organization and owned resources
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-900 font-sans">Delete this team</p>
              <p className="text-[11px] text-slate-500 font-sans">
                Permanently delete team workspace, project memberships, and uncommitted drafts.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteConfirmationText('');
                setIsDeleteModalOpen(true);
              }}
              className="shrink-0"
            >
              Delete Team
            </Button>
          </div>
        </Card>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-md p-6 bg-white shadow-xl border border-slate-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-800" aria-hidden="true" />
                <CardTitle className="text-sm font-bold text-slate-900 font-sans">Invite Team Member</CardTitle>
              </div>
              <button 
                type="button" 
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteError && (
              <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="invite-email" className="text-xs font-semibold text-slate-700 block">
                  Colleague's Email Address <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="engineer@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isInviting}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="invite-role" className="text-xs font-semibold text-slate-700 block">
                  Team Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={isInviting}
                  className="w-full text-xs font-mono font-medium px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-slate-400"
                >
                  {TEAM_ROLES.filter((r) => r !== 'OWNER').map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Members inherit project permissions according to their team and project role assignment.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsInviteModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={isInviting || !inviteEmail.trim()}
                  className="bg-[#C38B4B] hover:bg-[#b07b3e] text-white"
                >
                  {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Send Invitation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Typed Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-md p-6 bg-white shadow-xl border border-rose-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                <CardTitle className="text-sm font-bold font-sans">Confirm Team Deletion</CardTitle>
              </div>
              <button 
                type="button" 
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
                {deleteError}
              </div>
            )}

            <div className="space-y-3 text-xs text-slate-600 font-sans">
              <p>
                This action is permanent and cannot be undone. To prevent accidental loss, please type the exact team name to confirm:
              </p>
              <div className="p-2.5 bg-slate-100 rounded-lg font-mono font-bold text-slate-900 select-all">
                {activeTeam.name}
              </div>
            </div>

            <form onSubmit={handleDeleteTeam} className="space-y-4">
              <Input
                type="text"
                placeholder="Type team name here"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                disabled={isDeleting}
                required
                autoFocus
                className="text-sm"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting || deleteConfirmationText !== activeTeam.name}
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Permanently Delete
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
