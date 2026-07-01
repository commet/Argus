import type { AnalysisSnapshot } from '@/stores/types';

type RouteSignal = Pick<
  AnalysisSnapshot,
  'decision_density' | 'frame_status' | 'framing_confidence' | 'reversibility' | 'stakes'
>;

export function hasFlatFrame(snapshots: RouteSignal[]): boolean {
  return snapshots.some((snapshot) => snapshot.frame_status === 'flat');
}

export function shouldDefaultFastPath(snapshots: RouteSignal[]): boolean {
  const latest = snapshots[snapshots.length - 1] ?? null;
  if (!latest) return false;

  const decisionDensity = lastKnown(snapshots, 'decision_density');
  const stakes = lastKnown(snapshots, 'stakes');
  const reversibility = lastKnown(snapshots, 'reversibility');
  const framingConfidence = lastKnown(snapshots, 'framing_confidence') ?? 0;
  const confidentRoutine =
    stakes === 'routine' &&
    reversibility === 'reversible' &&
    framingConfidence >= 75;

  // critical / irreversible NEVER auto-fast-paths, even on low decision_density —
  // it must deploy the crew so the navigator/debate verify pass (and the Bind-lean
  // confirmation-bias guard) actually runs. Otherwise the whole verify/lean wiring
  // is dead on the most important decisions.
  if (stakes === 'critical' || reversibility === 'irreversible') return false;

  return hasFlatFrame(snapshots) || decisionDensity === 'low' || confidentRoutine;
}

function lastKnown<K extends keyof RouteSignal>(
  snapshots: RouteSignal[],
  key: K,
): RouteSignal[K] | undefined {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const value = snapshots[i]?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}
