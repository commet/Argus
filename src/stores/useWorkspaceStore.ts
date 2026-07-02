import { create } from 'zustand';

export type StepId = 'reframe' | 'recast' | 'rehearse' | 'refine' | 'synthesize';

interface WorkspaceState {
  activeStep: StepId;
  navigatorOpen: boolean;
  setActiveStep: (step: StepId) => void;
  toggleNavigator: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeStep: 'reframe',
  navigatorOpen: false,
  setActiveStep: (step) => set({ activeStep: step }),
  toggleNavigator: () => set((s) => ({ navigatorOpen: !s.navigatorOpen })),
}));
