import type { 
  ActivityWithState, 
  AuditEvent, 
  DashboardKPIs, 
  Project,
  ProjectCreateInput,
  ReviewQueueItem, 
  WorkObservation
} from '../types';
import { supabase } from './supabase';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<{ data: T | null; error: string | null; isLive: boolean }> {
  const url = `${API_BASE_URL}${path}`;

  // Automatically attach active Supabase JWT session token or stored auth token if present
  let token: string | undefined;
  try {
    const sessionRes = await supabase.auth.getSession();
    token = sessionRes?.data?.session?.access_token;
  } catch {
    // Supabase auth client not configured or session unavailable
  }

  if (!token) {
    try {
      const stored = localStorage.getItem('nexora_field_ledger_sih:jwt');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'string' && parsed.length > 0) {
          token = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for cloud/cold-start backends

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
      return { data: null, error: errorBody.error || `HTTP ${response.status}`, isLive: true };
    }

    const data = await response.json();
    return { data, error: null, isLive: true };
  } catch (err: any) {
    // Backend offline / unreachable
    return { data: null, error: err.message || 'Backend unreachable', isLive: false };
  }
}

export const api = {
  /**
   * Health Check
   */
  async checkHealth(): Promise<{ status: string; service?: string; version?: string } | null> {
    const { data } = await request<{ status: string; service: string; version: string }>('/api/v1/health');
    return data;
  },

  /**
   * Create a new project via Trust Plane
   */
  async createProject(input: ProjectCreateInput): Promise<Project | null> {
    const { data, error } = await request<Project>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (error) {
      console.error('[NEXORA] Error creating project via API:', error);
      return null;
    }
    return data;
  },

  /**
   * Fetch all projects via Trust Plane
   */
  async getProjects(): Promise<Project[]> {
    const { data } = await request<Project[]>('/api/v1/projects');
    return data || [];
  },

  /**
   * Fetch Dashboard Data & KPIs
   */
  async getDashboard(projectId: string): Promise<DashboardKPIs | null> {
    const { data, isLive } = await request<any>(`/api/v1/projects/${projectId}/dashboard`);
    if (isLive && data) {
      return {
        total_observations: data.total_observations ?? data.summary?.total_observations ?? 0,
        extracted_events: data.extracted_events ?? data.summary?.extracted_events ?? 0,
        auto_linked_events: data.auto_linked_events ?? data.summary?.auto_linked_events ?? 0,
        review_queue_count: data.review_queue_count ?? data.summary?.pending_reviews ?? 0,
        unmatched_count: data.unmatched_count ?? data.summary?.unmatched_observations ?? 0,
        completed_activities: data.completed_activities ?? data.summary?.completed_activities ?? 0,
        in_progress_activities: data.in_progress_activities ?? data.summary?.in_progress_activities ?? 0,
        overall_progress_pct: data.overall_progress_pct ?? data.summary?.overall_progress_pct ?? 0,
      };
    }
    return null;
  },

  /**
   * Fetch Activities with Current State
   */
  async getActivities(projectId: string): Promise<ActivityWithState[] | null> {
    const { data, isLive } = await request<any>(`/api/v1/projects/${projectId}/activities`);
    if (isLive && data) {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.activities)) return data.activities;
    }
    return null;
  },

  /**
   * Fetch Observations
   */
  async getObservations(projectId: string): Promise<WorkObservation[] | null> {
    const { data, isLive } = await request<any>(`/api/v1/projects/${projectId}/observations`);
    if (isLive && data) {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.observations)) return data.observations;
    }
    return null;
  },

  /**
   * Ingest an observation via Rust Trust Plane API
   */
  async createObservation(projectId: string, obs: Partial<WorkObservation>): Promise<WorkObservation | null> {
    const { data, error } = await request<WorkObservation>(`/api/v1/projects/${projectId}/observations`, {
      method: 'POST',
      body: JSON.stringify(obs),
    });
    if (error) {
      console.error('[NEXORA] Error creating observation via Trust Plane API:', error);
      return null;
    }
    return data;
  },

  /**
   * Fetch Review Queue
   */
  async getReviewQueue(projectId: string): Promise<ReviewQueueItem[] | null> {
    const { data, isLive } = await request<any>(`/api/v1/projects/${projectId}/review-queue`);
    if (isLive && data) {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.items)) return data.items;
    }
    return null;
  },

  /**
   * Approve a proposal via Trust Plane API (actor identity derived from verified JWT)
   */
  async approveProposal(proposalId: string, payload: { selected_activity_id?: string; comments?: string } = {}): Promise<{ success: boolean; event_id?: string; error?: string }> {
    const body: Record<string, any> = {
      comments: payload.comments || 'Approved via Field Ledger console',
    };
    if (payload.selected_activity_id && payload.selected_activity_id.trim().length > 0) {
      body.selected_activity_id = payload.selected_activity_id.trim();
    }

    const { data, error } = await request<{ success: boolean; event_id: string }>(`/api/v1/proposals/${proposalId}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (error) {
      return { success: false, error };
    }
    return { success: true, event_id: data?.event_id };
  },

  /**
   * Reject a proposal via Trust Plane API (actor identity derived from verified JWT)
   */
  async rejectProposal(proposalId: string, payload: { reason: string }): Promise<{ success: boolean; error?: string }> {
    const body: Record<string, any> = {
      comments: payload.reason,
      reason: payload.reason,
    };
    const { error } = await request<{ success: boolean }>(`/api/v1/proposals/${proposalId}/reject`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (error) {
      return { success: false, error };
    }
    return { success: true };
  },

  /**
   * Override a proposal with another activity via Trust Plane API (actor identity derived from verified JWT)
   */
  async overrideProposal(proposalId: string, payload: { new_activity_id: string; reason: string }): Promise<{ success: boolean; event_id?: string; error?: string }> {
    const body: Record<string, any> = {
      comments: payload.reason,
    };
    if (payload.new_activity_id && payload.new_activity_id.trim().length > 0) {
      body.selected_activity_id = payload.new_activity_id.trim();
    }

    const { data, error } = await request<{ success: boolean; event_id: string }>(`/api/v1/proposals/${proposalId}/override`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (error) {
      return { success: false, error };
    }
    return { success: true, event_id: data?.event_id };
  },

  /**
   * Batch approve proposals
   */
  async batchApproveProposals(proposalIds: string[]): Promise<{ approved_count: number; errors?: string[] }> {
    const { data, error } = await request<{ approved_count: number; errors: string[] }>('/api/v1/proposals/batch-approve', {
      method: 'POST',
      body: JSON.stringify({ proposal_ids: proposalIds }),
    });

    if (error) {
      return { approved_count: 0, errors: [error] };
    }
    return { approved_count: data?.approved_count ?? 0, errors: data?.errors };
  },

  /**
   * Fetch Audit Trail
   */
  async getAuditTrail(projectId: string): Promise<AuditEvent[] | null> {
    const { data, isLive } = await request<any>(`/api/v1/projects/${projectId}/audit-trail`);
    if (isLive && data) {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.events)) return data.events;
    }
    return null;
  },

  /**
   * Verify SHA-256 Audit Chain Integrity
   */
  async verifyAuditChain(projectId: string): Promise<{ valid: boolean; verified_count: number; message: string }> {
    const { data, isLive, error } = await request<{ valid: boolean; verified_count: number; message: string }>(`/api/v1/projects/${projectId}/audit-trail/verify`);
    if (isLive && data) {
      return data;
    }

    return {
      valid: false,
      verified_count: 0,
      message: error ? `Audit chain verification failed: ${error}` : 'Trust Plane unreachable. Cryptographic audit chain integrity cannot be verified.',
    };
  },

  /**
   * Fetch P6 Schedule Export XML
   */
  async getP6Export(projectId: string): Promise<string | null> {
    const { data } = await request<{ xml: string }>(`/api/v1/projects/${projectId}/export/p6`);
    return data?.xml || null;
  },

  /**
   * Fetch Authenticated User Identity & Memberships
   */
  async getMe(): Promise<{ user_id: string; sub: string; global_role: string; full_name?: string; projects: any[] } | null> {
    const { data } = await request<any>('/api/v1/auth/me');
    return data || null;
  },

  /**
   * List Project Members
   */
  async getProjectMembers(projectId: string): Promise<any[] | null> {
    const { data } = await request<any[]>(`/api/v1/projects/${projectId}/members`);
    return data || null;
  },

  /**
   * Add / Assign Project Member
   */
  async addProjectMember(projectId: string, member: { email: string; full_name: string; role: string; user_id?: string }): Promise<any> {
    const { data } = await request<any>(`/api/v1/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(member),
    });
    return data;
  },

  /**
   * Remove / Deactivate Project Member
   */
  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    await request<void>(`/api/v1/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Preview Schedule Import
   */
  async previewScheduleImport(projectId: string, input: any): Promise<any> {
    const { data } = await request<any>(`/api/v1/projects/${projectId}/import/preview`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data;
  },

  /**
   * Commit Schedule Import
   */
  async commitScheduleImport(projectId: string, input: any): Promise<any> {
    const { data } = await request<any>(`/api/v1/projects/${projectId}/import/commit`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data;
  }
};
