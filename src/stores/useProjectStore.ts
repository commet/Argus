import { create } from 'zustand';
import type { Project, ProjectRef } from '@/stores/types';
import { STORAGE_KEYS, getStorage, setStorage, removeStorage } from '@/lib/storage';
import { generateId, loadItems, addNewItem, updateItem, deleteItem, updateNestedField } from './createItemStore';
import { track } from '@/lib/analytics';

const TABLE = 'projects' as const;
const KEY = STORAGE_KEYS.PROJECTS;
/** Persisted current-project id — a mid-voyage F5 refresh shouldn't dump the
 *  user back to the idle hero. Restored in loadProjects() ONLY on a genuine
 *  page reload (see isTabReload); every other entry (cold start, new tab, typed
 *  URL, in-app navigation) lands on HeroFlow instead. (User pref: "새로고침만 유지") */
const CURRENT_PROJECT_KEY = 'argus-current-project';

/** True only for a real F5/reload of the current document — NOT a fresh
 *  navigation, new tab, typed URL, or external link. Uses the Navigation Timing
 *  Level 2 API with a legacy fallback. */
function isTabReload(): boolean {
  if (typeof performance === 'undefined') return false;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav) return nav.type === 'reload';
  // Legacy fallback for browsers without the Level 2 entry.
  const legacy = (performance as unknown as { navigation?: { type?: number } }).navigation;
  return legacy?.type === 1; // PerformanceNavigation.TYPE_RELOAD
}

/** The reload-resume is a one-shot per document load: consume it on the first
 *  restore so a later in-app nav to /workspace (navType still reads 'reload'
 *  for the whole document lifetime) doesn't resurrect a project. */
let reloadResumeAvailable = true;

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  loadProjects: () => void;
  createProject: (name: string, description?: string) => string;
  updateProject: (id: string, data: Partial<Project>) => void;
  updateDecisionContract: (
    id: string,
    updater: (contract: Project['decision_contract']) => Project['decision_contract'],
  ) => void;
  deleteProject: (id: string) => void;
  addRef: (projectId: string, ref: Omit<ProjectRef, 'linkedAt'>) => void;
  setCurrentProjectId: (id: string | null) => void;
  getProject: (id: string) => Project | undefined;
  getOrCreateProject: (name: string) => string;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,

  loadProjects: () =>
    loadItems(KEY, TABLE, () => get().projects, (projects) => {
      set({ projects });
      // Restore the persisted current project AFTER projects load — but ONLY on
      // a genuine F5 reload, and never clobber a selection made in the meantime.
      // On any other entry we drop the stale id so a subsequent reload of the
      // idle hero doesn't resurrect it. (User pref: "새로고침만 유지")
      if (get().currentProjectId === null) {
        const savedId = getStorage<string | null>(CURRENT_PROJECT_KEY, null);
        if (savedId && projects.some((p) => p.id === savedId)) {
          if (isTabReload() && reloadResumeAvailable) {
            reloadResumeAvailable = false;
            set({ currentProjectId: savedId });
          } else {
            removeStorage(CURRENT_PROJECT_KEY);
          }
        }
      }
    }),

  createProject: (name, description = '') => {
    const now = new Date().toISOString();
    const isFirst = get().projects.length === 0;
    const id = addNewItem(KEY, TABLE, () => get().projects, (projects, pid) => set({ projects, currentProjectId: pid }), {
      id: generateId(), name, description, refs: [],
      created_at: now, updated_at: now,
    });
    // Activation funnel milestone (was missing) — distinguish the very first.
    track(isFirst ? 'first_project_created' : 'project_created', { has_description: !!description });
    return id;
  },

  updateProject: (id, data) => updateItem(KEY, TABLE, () => get().projects, (projects) => set({ projects }), id, data),
  updateDecisionContract: (id, updater) =>
    updateNestedField(KEY, TABLE, () => get().projects, (projects) => set({ projects }), id, (project) => {
      const decisionContract = updater(project.decision_contract);
      return decisionContract === project.decision_contract
        ? project
        : { ...project, decision_contract: decisionContract };
    }),
  deleteProject: (id) => deleteItem(KEY, TABLE, () => get().projects, (projects) => set({ projects }), () => get().currentProjectId, (cid) => {
    set({ currentProjectId: cid });
    if (cid === null) removeStorage(CURRENT_PROJECT_KEY); // deleted the current project — clear the stored id too
  }, id),

  addRef: (projectId, ref) =>
    updateNestedField(KEY, TABLE, () => get().projects, (projects) => set({ projects }), projectId, (p) => {
      const exists = p.refs.some((r) => r.itemId === ref.itemId && r.tool === ref.tool);
      if (exists) return p;
      return { ...p, refs: [...p.refs, { ...ref, linkedAt: new Date().toISOString() }] };
    }),

  setCurrentProjectId: (id) => {
    set({ currentProjectId: id });
    if (id === null) removeStorage(CURRENT_PROJECT_KEY);
    else setStorage(CURRENT_PROJECT_KEY, id);
  },
  getProject: (id) => get().projects.find((p) => p.id === id),
  getOrCreateProject: (name) => {
    const existing = get().projects.find((p) => p.name === name);
    if (existing) return existing.id;
    return get().createProject(name);
  },
}));
