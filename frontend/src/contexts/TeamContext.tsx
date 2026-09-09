import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Team, TeamMember, TeamInvitation, TeamRole } from '../types';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

interface TeamContextType {
  teamsList: Team[];
  activeTeam: Team | null;
  teamMembers: TeamMember[];
  teamInvitations: TeamInvitation[];
  currentTeamRole: TeamRole | null;
  isLoading: boolean;
  isCreateTeamModalOpen: boolean;
  openCreateTeamModal: () => void;
  closeCreateTeamModal: () => void;
  selectTeam: (team: Team) => void;
  createTeam: (name: string, slug?: string) => Promise<Team>;
  updateTeam: (teamId: string, name: string) => Promise<void>;
  deleteTeam: (teamId: string, confirmName?: string) => Promise<void>;
  loadMembers: (teamId: string) => Promise<void>;
  inviteMember: (teamId: string, email: string, role: string) => Promise<TeamInvitation>;
  updateMemberRole: (teamId: string, userId: string, role: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  transferOwnership: (teamId: string, newOwnerId: string) => Promise<void>;
  revokeInvitation: (teamId: string, invitationId: string) => Promise<void>;
  acceptInvitation: (token: string) => Promise<void>;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

const TEAM_STORAGE_KEY = 'nexora:active_team_id';

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [teamsList, setTeamsList] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState<boolean>(false);

  // Load user's teams
  const refreshTeams = useCallback(async () => {
    if (!user) {
      setTeamsList([]);
      setActiveTeam(null);
      setTeamMembers([]);
      setTeamInvitations([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const teams = await api.listTeams();
      setTeamsList(teams || []);

      if (teams && teams.length > 0) {
        // Restore previously selected team if valid, otherwise select the first one
        const savedId = localStorage.getItem(TEAM_STORAGE_KEY);
        const match = teams.find((t) => t.id === savedId) || teams[0];
        setActiveTeam(match);
        localStorage.setItem(TEAM_STORAGE_KEY, match.id);
      } else {
        setActiveTeam(null);
        localStorage.removeItem(TEAM_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[NEXORA] Error loading teams:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial load and whenever auth user changes
  useEffect(() => {
    void refreshTeams();
  }, [refreshTeams]);

  // Load active team members and invitations
  const loadMembers = useCallback(async (teamId: string) => {
    try {
      const [members, invites] = await Promise.all([
        api.listTeamMembers(teamId),
        api.listTeamInvitations(teamId),
      ]);
      setTeamMembers(members || []);
      setTeamInvitations(invites || []);
    } catch (err) {
      console.warn('[NEXORA] Error loading team members/invitations:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTeam?.id) {
      void loadMembers(activeTeam.id);
    } else {
      setTeamMembers([]);
      setTeamInvitations([]);
    }
  }, [activeTeam?.id, loadMembers]);

  // Compute active user's role in the active team
  const currentTeamRole = React.useMemo<TeamRole | null>(() => {
    if (!user || !activeTeam) return null;
    const member = teamMembers.find((m) => m.user_id === user.id && m.is_active);
    return (member?.role as TeamRole) || null;
  }, [user, activeTeam, teamMembers]);

  // Select team
  const selectTeam = (team: Team) => {
    setActiveTeam(team);
    localStorage.setItem(TEAM_STORAGE_KEY, team.id);
  };

  // Create team
  const createTeam = async (name: string, slug?: string): Promise<Team> => {
    const newTeam = await api.createTeam(name, slug);
    if (!newTeam) {
      throw new Error('Failed to create team');
    }
    setTeamsList((prev) => [newTeam, ...prev]);
    setActiveTeam(newTeam);
    localStorage.setItem(TEAM_STORAGE_KEY, newTeam.id);
    await loadMembers(newTeam.id);
    return newTeam;
  };

  // Update team
  const updateTeam = async (teamId: string, name: string): Promise<void> => {
    const updated = await api.updateTeam(teamId, name);
    if (updated) {
      setTeamsList((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
      if (activeTeam?.id === teamId) {
        setActiveTeam(updated);
      }
    }
  };

  // Delete team
  const deleteTeam = async (teamId: string, confirmName?: string): Promise<void> => {
    const targetTeam = teamsList.find(t => t.id === teamId) || activeTeam;
    const nameToConfirm = confirmName || targetTeam?.name || '';
    await api.deleteTeam(teamId, nameToConfirm);
    setTeamsList((prev) => prev.filter((t) => t.id !== teamId));
    if (activeTeam?.id === teamId) {
      const remaining = teamsList.filter((t) => t.id !== teamId);
      const next = remaining[0] || null;
      setActiveTeam(next);
      if (next) {
        localStorage.setItem(TEAM_STORAGE_KEY, next.id);
      } else {
        localStorage.removeItem(TEAM_STORAGE_KEY);
      }
    }
  };

  // Invite member
  const inviteMember = async (teamId: string, email: string, role: string): Promise<TeamInvitation> => {
    const inv = await api.createTeamInvitation(teamId, email, role);
    setTeamInvitations((prev) => [inv, ...prev]);
    return inv;
  };

  // Update member role
  const updateMemberRole = async (teamId: string, userId: string, role: string): Promise<void> => {
    await api.updateTeamMemberRole(teamId, userId, role as TeamRole);
    setTeamMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: role as TeamRole } : m)));
  };

  // Remove member
  const removeMember = async (teamId: string, userId: string): Promise<void> => {
    await api.removeTeamMember(teamId, userId);
    setTeamMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  // Transfer ownership
  const transferOwnership = async (teamId: string, newOwnerId: string): Promise<void> => {
    await api.transferTeamOwnership(teamId, newOwnerId);
    await loadMembers(teamId);
  };

  // Revoke invitation
  const revokeInvitation = async (teamId: string, invitationId: string): Promise<void> => {
    await api.revokeTeamInvitation(teamId, invitationId);
    setTeamInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  };

  // Accept invitation token
  const acceptInvitation = async (token: string): Promise<void> => {
    await api.acceptTeamInvitation(token);
    await refreshTeams();
  };

  return (
    <TeamContext.Provider
      value={{
        teamsList,
        activeTeam,
        teamMembers,
        teamInvitations,
        currentTeamRole,
        isLoading,
        isCreateTeamModalOpen,
        openCreateTeamModal: () => setIsCreateTeamModalOpen(true),
        closeCreateTeamModal: () => setIsCreateTeamModalOpen(false),
        selectTeam,
        createTeam,
        updateTeam,
        deleteTeam,
        loadMembers,
        inviteMember,
        updateMemberRole,
        removeMember,
        transferOwnership,
        revokeInvitation,
        acceptInvitation,
        refreshTeams,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam(): TeamContextType {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
