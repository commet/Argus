import { create } from 'zustand';

export type StepId = 'reframe' | 'recast' | 'rehearse' | 'refine' | 'synthesize';

interface WorkspaceState {
  activeStep: StepId;
  sidebarOpen: boolean;
  navigatorOpen: boolean;
  setActiveStep: (step: StepId) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleNavigator: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeStep: 'reframe',
  sidebarOpen: true,
  navigatorOpen: false,
  setActiveStep: (step) => set({ activeStep: step }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleNavigator: () => set((s) => ({ navigatorOpen: !s.navigatorOpen })),
}));
