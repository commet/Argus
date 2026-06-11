import { create } from 'zustand';
import type { ProbeSample, Fork, AblationFinding, ProbeCallLog } from '@/lib/probe-engine';

/**
 * Probe store (W2.1) — transient state for the trial-sail theater.
 *
 * Deliberately SMALL and SEPARATE: the plan forbids touching the 1800-line
 * useProgressiveStore. This store holds only the in-flight probe of the
 * current session; whatever the arc decides to persist (forks chosen into
 * questions, etc.) is the session's business (W2.3 wiring), not this store's.
 * Not persisted — a reload simply re-probes or proceeds without.
 */

export type ProbeStatus = 'idle' | 'sampling' | 'merging' | 'done' | 'error';

interface ProbeState {
  status: ProbeStatus;
  /** Executor samples in arrival order (the theater fills these in live). */
  samples: ProbeSample[];
  /** Expected sample count for the current run (skeleton slots in the UI). */
  expected: number;
  forks: Fork[];
  /** D-lever findings (primary measurement — G0). */
  findings: AblationFinding[];
  /** True when both probes came back quiet — the 침묵 카드 renders. */
  silent: boolean;
  /** 경량 재탐침 used so far this session (cap ≤2 — W2.3 rule, enforced here). */
  reprobeCount: number;
  callLog: ProbeCallLog[];
  error: string | null;

  begin: (expected: number) => void;
  sampleArrived: (sample: ProbeSample) => void;
  merging: () => void;
  completed: (r: { forks: Fork[]; findings: AblationFinding[]; calls: ProbeCallLog[] }) => void;
  failed: (message: string) => void;
  /** Returns false when the ≤2 re-probe budget is spent (caller must respect). */
  tryConsumeReprobe: () => boolean;
  /** Replace the measured forks (경량 재탐침 result — drives the reverse
   *  convergence gauge: 갈림 3 → 1). */
  setForks: (forks: Fork[]) => void;
  reset: () => void;
}

const MAX_REPROBES = 2;

export const useProbeStore = create<ProbeState>((set, get) => ({
  status: 'idle',
  samples: [],
  expected: 0,
  forks: [],
  findings: [],
  silent: false,
  reprobeCount: 0,
  callLog: [],
  error: null,

  begin: (expected) =>
    set({ status: 'sampling', expected, samples: [], forks: [], findings: [], silent: false, error: null }),

  sampleArrived: (sample) => set((s) => ({ samples: [...s.samples, sample] })),

  merging: () => set({ status: 'merging' }),

  completed: ({ forks, findings, calls }) =>
    set((s) => ({
      status: 'done',
      forks,
      findings,
      // Silence = a real measurement that converged. Requires actual samples —
      // an empty run must NEVER render the convergence card (G-W1 #1 bug).
      silent: s.samples.length >= 2 && forks.length === 0 && findings.length === 0,
      callLog: [...s.callLog, ...calls],
    })),

  failed: (message) => set({ status: 'error', error: message }),

  tryConsumeReprobe: () => {
    if (get().reprobeCount >= MAX_REPROBES) return false;
    set((s) => ({ reprobeCount: s.reprobeCount + 1 }));
    return true;
  },

  setForks: (forks) => set({ forks }),

  reset: () =>
    set({
      status: 'idle',
      samples: [],
      expected: 0,
      forks: [],
      findings: [],
      silent: false,
      reprobeCount: 0,
      callLog: [],
      error: null,
    }),
}));
