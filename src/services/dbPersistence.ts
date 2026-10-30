import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Project, RunSession, ProjectUsageRecord } from '../types/pipeline';
import { createDefaultProjects } from '../utils/pipeline';

export interface UserPreferences {
  activeProjectId?: string | null;
  activeTab?: string;
  theme?: string;
  updatedAt?: string;
}

/**
 * Storage helpers for local caching fallback per user ID
 */
const getUserStorageKey = (userId: string, suffix: string) => `blogcraft_${userId}_${suffix}`;

/**
 * Save a single project to Firestore for the user and tenant
 */
export async function saveUserProject(
  userId: string,
  tenantId: string,
  project: Project
): Promise<void> {
  const payload = {
    ...project,
    userId,
    tenantId,
    updatedAt: new Date().toISOString(),
  };

  const tasks: Promise<any>[] = [];

  // 1. Direct User ID collection: /users/{userId}/projects/{projectId}
  tasks.push(
    setDoc(doc(db, 'users', userId, 'projects', project.id), payload, { merge: true })
  );

  // 2. Tenant collection (if tenantId available): /tenants/{tenantId}/projects/{projectId}
  if (tenantId) {
    tasks.push(
      setDoc(doc(db, 'tenants', tenantId, 'projects', project.id), payload, { merge: true })
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Save all projects for the user ID
 */
export async function saveAllUserProjects(
  userId: string,
  tenantId: string,
  projects: Project[]
): Promise<void> {
  // Update local cache immediately
  try {
    localStorage.setItem(getUserStorageKey(userId, 'projects'), JSON.stringify(projects));
  } catch {
    // ignore
  }

  // Save each project in parallel
  await Promise.all(projects.map((p) => saveUserProject(userId, tenantId, p)));
}

export const DEFAULT_STARTER_PROJECT_IDS = new Set([
  'proj-prostate-clinic-london',
  'proj-seo-guide',
  'proj-thought-leadership',
  'proj-technical-breakdown',
  'prostate-clinic-london',
  'seo-pillar-guide',
  'thought-leadership-essay',
  'technical-breakdown-tutorial',
]);

/**
 * Filter out hardcoded starter template projects so only user-created projects remain.
 */
export function filterUserOnlyProjects(projects: Project[]): Project[] {
  if (!Array.isArray(projects)) return [];
  return projects.filter((p) => p && p.id && !DEFAULT_STARTER_PROJECT_IDS.has(p.id));
}

/**
 * Automatically load projects for a user ID
 * Returns ONLY projects explicitly created by the user (no default templates auto-seeded)
 */
export async function loadUserProjects(
  userId: string,
  tenantId: string
): Promise<Project[]> {
  const projectsMap = new Map<string, Project>();

  // 1. Try loading from user's personal subcollection /users/{userId}/projects
  try {
    const userProjsSnap = await getDocs(collection(db, 'users', userId, 'projects'));
    if (!userProjsSnap.empty) {
      userProjsSnap.forEach((d) => {
        if (!DEFAULT_STARTER_PROJECT_IDS.has(d.id)) {
          projectsMap.set(d.id, d.data() as Project);
        }
      });
    }
  } catch (err) {
    console.warn('Could not query /users/{userId}/projects from Firestore:', err);
  }

  // 2. Try loading from tenant collection /tenants/{tenantId}/projects
  if (tenantId) {
    try {
      const tenantProjsSnap = await getDocs(collection(db, 'tenants', tenantId, 'projects'));
      if (!tenantProjsSnap.empty) {
        tenantProjsSnap.forEach((d) => {
          if (!DEFAULT_STARTER_PROJECT_IDS.has(d.id) && !projectsMap.has(d.id)) {
            projectsMap.set(d.id, d.data() as Project);
          }
        });
      }
    } catch (err) {
      console.warn('Could not query /tenants/{tenantId}/projects from Firestore:', err);
    }
  }

  // 3. If found in Firestore, cache filtered user projects locally and return
  if (projectsMap.size > 0) {
    const list = Array.from(projectsMap.values());
    try {
      localStorage.setItem(getUserStorageKey(userId, 'projects'), JSON.stringify(list));
    } catch {
      // ignore
    }
    return list;
  }

  // 4. Try local storage cache for this user
  try {
    const cached = localStorage.getItem(getUserStorageKey(userId, 'projects'));
    if (cached) {
      const parsed = JSON.parse(cached);
      const filtered = filterUserOnlyProjects(parsed);
      if (filtered.length > 0) {
        // Sync cached user-created projects up to Firestore in background
        saveAllUserProjects(userId, tenantId, filtered).catch(() => {});
        return filtered;
      }
    }

    // Also check and sanitize any legacy un-scoped storage key
    const legacy = localStorage.getItem('blogcraft_projects');
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      const filteredLegacy = filterUserOnlyProjects(parsedLegacy);
      localStorage.removeItem('blogcraft_projects');
      if (filteredLegacy.length > 0) {
        saveAllUserProjects(userId, tenantId, filteredLegacy).catch(() => {});
        return filteredLegacy;
      }
    }
  } catch {
    // ignore
  }

  // 5. Clean up any lingering default template cache
  try {
    localStorage.removeItem(getUserStorageKey(userId, 'projects'));
  } catch {
    // ignore
  }

  // Only user-created projects should show; return empty array if user has not created any projects yet
  return [];
}

/**
 * Delete a project from Firestore for this user ID and tenant
 */
export async function deleteUserProject(
  userId: string,
  tenantId: string,
  projectId: string
): Promise<void> {
  const tasks: Promise<any>[] = [];

  tasks.push(deleteDoc(doc(db, 'users', userId, 'projects', projectId)));
  if (tenantId) {
    tasks.push(deleteDoc(doc(db, 'tenants', tenantId, 'projects', projectId)));
  }

  await Promise.allSettled(tasks);
}

/**
 * Save generation session to Firestore for this user ID and tenant
 */
export async function saveUserSession(
  userId: string,
  tenantId: string,
  session: RunSession
): Promise<void> {
  const payload = {
    ...session,
    userId,
    tenantId,
    updatedAt: new Date().toISOString(),
  };

  const tasks: Promise<any>[] = [];
  tasks.push(
    setDoc(doc(db, 'users', userId, 'sessions', session.id), payload, { merge: true })
  );

  if (tenantId) {
    tasks.push(
      setDoc(doc(db, 'tenants', tenantId, 'sessions', session.id), payload, { merge: true })
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Load all saved generation sessions for a user ID and tenant
 */
export async function loadUserSessions(
  userId: string,
  tenantId: string
): Promise<Record<string, RunSession>> {
  const sessionsRecord: Record<string, RunSession> = {};

  // Try user collection first
  try {
    const userSessionsSnap = await getDocs(collection(db, 'users', userId, 'sessions'));
    userSessionsSnap.forEach((d) => {
      const sess = d.data() as RunSession;
      // Key by projectId or session id
      const key = sess.projectId || sess.id;
      sessionsRecord[key] = sess;
    });
  } catch (err) {
    console.warn('Could not fetch user sessions from Firestore:', err);
  }

  // Try tenant collection as fallback
  if (Object.keys(sessionsRecord).length === 0 && tenantId) {
    try {
      const tenantSessionsSnap = await getDocs(collection(db, 'tenants', tenantId, 'sessions'));
      tenantSessionsSnap.forEach((d) => {
        const sess = d.data() as RunSession;
        const key = sess.projectId || sess.id;
        sessionsRecord[key] = sess;
      });
    } catch (err) {
      console.warn('Could not fetch tenant sessions from Firestore:', err);
    }
  }

  // Fallback to local storage if empty
  if (Object.keys(sessionsRecord).length === 0) {
    try {
      const cached = localStorage.getItem(getUserStorageKey(userId, 'sessions'));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  } else {
    // Cache to local storage
    try {
      localStorage.setItem(getUserStorageKey(userId, 'sessions'), JSON.stringify(sessionsRecord));
    } catch {
      // ignore
    }
  }

  return sessionsRecord;
}

/**
 * Save API usage record to Firestore for this user ID and tenant
 */
export async function saveUserUsageRecord(
  userId: string,
  tenantId: string,
  record: ProjectUsageRecord
): Promise<void> {
  const payload = {
    ...record,
    userId,
    tenantId,
  };

  const tasks: Promise<any>[] = [];
  tasks.push(
    setDoc(doc(db, 'users', userId, 'usageRecords', record.id), payload, { merge: true })
  );

  if (tenantId) {
    tasks.push(
      setDoc(doc(db, 'tenants', tenantId, 'usageRecords', record.id), payload, { merge: true })
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Load API usage records for user ID
 */
export async function loadUserUsageRecords(
  userId: string,
  tenantId: string
): Promise<ProjectUsageRecord[]> {
  const recordsMap = new Map<string, ProjectUsageRecord>();

  try {
    const userRecSnap = await getDocs(
      query(collection(db, 'users', userId, 'usageRecords'), limit(200))
    );
    userRecSnap.forEach((d) => {
      recordsMap.set(d.id, d.data() as ProjectUsageRecord);
    });
  } catch (err) {
    console.warn('Could not query user usageRecords:', err);
  }

  if (tenantId) {
    try {
      const tenantRecSnap = await getDocs(
        query(collection(db, 'tenants', tenantId, 'usageRecords'), limit(200))
      );
      tenantRecSnap.forEach((d) => {
        if (!recordsMap.has(d.id)) {
          recordsMap.set(d.id, d.data() as ProjectUsageRecord);
        }
      });
    } catch (err) {
      console.warn('Could not query tenant usageRecords:', err);
    }
  }

  return Array.from(recordsMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Save user preferences (e.g. active project, active tab)
 */
export async function saveUserPreferences(
  userId: string,
  prefs: UserPreferences
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId, 'preferences', 'general'),
      {
        ...prefs,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not save user preferences to Firestore:', err);
  }
}

/**
 * Load user preferences
 */
export async function loadUserPreferences(
  userId: string
): Promise<UserPreferences | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'preferences', 'general'));
    if (snap.exists()) {
      return snap.data() as UserPreferences;
    }
  } catch (err) {
    console.warn('Could not load user preferences from Firestore:', err);
  }
  return null;
}
