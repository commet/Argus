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
  /** The paragraph this run measured. The store is global, so without this a
   *  NEW session would inherit the previous session's samples/forks (the
   *  `status !== 'idle'` guard can't tell sessions apart) — stale forks would
   *  even inject questions about the old text. Identity, not content. */
  paragraph: string | null;
  /** Executor samples in arrival order (the theater fills these in live). */
  samples: ProbeSample[];
  /** Expected sample count for the current run (skeleton slots in the UI). */
  expected: number;
  forks: Fork[];
  /** D-lever findings (primary measurement — G0). */
  findings: AblationFinding[];
  /** True when both probes came back quiet — the 침묵 카드 renders. */
  silent: boolean;
  /** D lever (the PRIMARY measurement) failed while C succeeded. Disqualifies
   *  the silence card — a half-failed measurement is not a quiet one (P3). */
  ablationFailed: boolean;
  /** 경량 재탐침 used so far this session (cap ≤2 — W2.3 rule, enforced here). */
  reprobeCount: number;
  /** 측정-정박 질문 injected so far this session (cap ≤2 — v4.1 W2.2 수용
   *  기준. Per-conversion slicing alone leaks: a re-probe replaces forks with
   *  new ids, so without a session counter up to 4 could be asked). */
  questionsInjected: number;
  callLog: ProbeCallLog[];
  error: string | null;

  begin: (expected: number, paragraph: string) => void;
  sampleArrived: (sample: ProbeSample) => void;
  merging: () => void;
  completed: (r: { forks: Fork[]; findings: AblationFinding[]; calls: ProbeCallLog[]; ablationFailed?: boolean }) => void;
  failed: (message: string) => void;
  /** Returns false when the ≤2 re-probe budget is spent (caller must respect). */
  tryConsumeReprobe: () => boolean;
  /** Returns false when the ≤2 measurement-anchor question budget is spent. */
  tryConsumeQuestion: () => boolean;
  /** Replace the measured forks (경량 재탐침 result — drives the reverse
   *  convergence gauge: 갈림 3 → 1). */
  setForks: (forks: Fork[]) => void;
  reset: () => void;
}

const MAX_REPROBES = 2;
const MAX_PROBE_QUESTIONS = 2;

export const useProbeStore = create<ProbeState>((set, get) => ({
  status: 'idle',
  paragraph: null,
  samples: [],
  expected: 0,
  forks: [],
  findings: [],
  silent: false,
  ablationFailed: false,
  reprobeCount: 0,
  questionsInjected: 0,
  callLog: [],
  error: null,

  // A fresh run = a fresh session budget: re-probe/question counters and the
  // call log start over (StrictMode re-begin with the same paragraph is fine —
  // nothing was consumed yet when cleanup reset us back to idle).
  begin: (expected, paragraph) =>
    set({
      status: 'sampling', paragraph, expected,
      samples: [], forks: [], findings: [], silent: false, ablationFailed: false, error: null,
      reprobeCount: 0, questionsInjected: 0, callLog: [],
    }),

  sampleArrived: (sample) => set((s) => ({ samples: [...s.samples, sample] })),

  merging: () => set({ status: 'merging' }),

  completed: ({ forks, findings, calls, ablationFailed = false }) =>
    set((s) => ({
      status: 'done',
      forks,
      findings,
      ablationFailed,
      // Silence = a real measurement that converged. Requires actual samples —
      // an empty run must NEVER render the convergence card (G-W1 #1 bug) —
      // and BOTH levers to have actually measured: zero findings from a FAILED
      // D probe is absence of measurement, not convergence.
      silent: s.samples.length >= 2 && forks.length === 0 && findings.length === 0 && !ablationFailed,
      callLog: [...s.callLog, ...calls],
    })),

  failed: (message) => set({ status: 'error', error: message }),

  tryConsumeReprobe: () => {
    if (get().reprobeCount >= MAX_REPROBES) return false;
    set((s) => ({ reprobeCount: s.reprobeCount + 1 }));
    return true;
  },

  tryConsumeQuestion: () => {
    if (get().questionsInjected >= MAX_PROBE_QUESTIONS) return false;
    set((s) => ({ questionsInjected: s.questionsInjected + 1 }));
    return true;
  },

  setForks: (forks) => set({ forks }),

  reset: () =>
    set({
      status: 'idle',
      paragraph: null,
      samples: [],
      expected: 0,
      forks: [],
      findings: [],
      silent: false,
      ablationFailed: false,
      reprobeCount: 0,
      questionsInjected: 0,
      callLog: [],
      error: null,
    }),
}));
