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

  const confidentRoutine =
    latest.stakes === 'routine' &&
    latest.reversibility === 'reversible' &&
    (latest.framing_confidence ?? 0) >= 75;

  return hasFlatFrame(snapshots) || latest.decision_density === 'low' || confidentRoutine;
}
