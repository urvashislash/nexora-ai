import type {
  ActivityWithState,
  AuditEvent,
  AuthUser,
  Project,
  ReviewQueueItem,
  WorkObservation,
} from '../types';

export const STORAGE_KEY = 'nexora-project-state-v2';

export function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const defaultUser: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'planner@nexora.ai',
  full_name: 'Lead Planner',
  role: 'PLANNER',
};

export const DEFAULT_PROJECTS: Project[] = [];

export const initialActivities: ActivityWithState[] = [];

export function getDefaultObservations(_projectId: string): WorkObservation[] {
  return [];
}

export function getDefaultReviewQueue(_projectId: string, _activities: ActivityWithState[]): ReviewQueueItem[] {
  return [];
}

export function getDefaultAuditEvents(_projectId: string, _userId?: string): AuditEvent[] {
  return [];
}
