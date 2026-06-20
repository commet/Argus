import { create } from 'zustand';
import type { Project, ProjectRef } from '@/stores/types';
import { STORAGE_KEYS, getStorage, setStorage, removeStorage } from '@/lib/storage';
import { generateId, loadItems, addNewItem, updateItem, deleteItem, updateNestedField } from './createItemStore';
import { track } from '@/lib/analytics';

const TABLE = 'projects' as const;
const KEY = STORAGE_KEYS.PROJECTS;
/** Persisted current-project id — a mid-voyage refresh shouldn't dump the user
 *  back to the idle hero. Restored in loadProjects() only if the id still exists. */
const CURRENT_PROJECT_KEY = 'argus-current-project';

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  loadProjects: () => void;
  createProject: (name: string, description?: string) => string;
  updateProject: (id: string, data: Partial<Project>) => void;
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
      // Restore the persisted current project AFTER projects load — only if it
      // still exists, and never clobber a selection made in the meantime.
      if (get().currentProjectId === null) {
        const savedId = getStorage<string | null>(CURRENT_PROJECT_KEY, null);
        if (savedId && projects.some((p) => p.id === savedId)) {
          set({ currentProjectId: savedId });
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
