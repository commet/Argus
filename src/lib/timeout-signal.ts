/**
 * Shared fetch timeout (09 S8) — a hung integration call must fail into the
 * caller's existing catch copy instead of spinning forever. Default 15s covers
 * every interactive API round-trip; pass a larger budget only for downloads.
 */
export function timeoutSignal(ms = 15_000): AbortSignal {
  return AbortSignal.timeout(ms);
}
