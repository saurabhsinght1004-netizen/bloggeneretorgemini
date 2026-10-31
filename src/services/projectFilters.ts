import { Project } from '../types/pipeline';

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
