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
