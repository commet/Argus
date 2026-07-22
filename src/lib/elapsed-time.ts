/** Wall-clock seconds for async telemetry; React render state can be stale. */
export function elapsedSecondsSince(startedAt: number, now = Date.now()): number {
  return Math.max(0, Math.round((now - startedAt) / 1000));
}
