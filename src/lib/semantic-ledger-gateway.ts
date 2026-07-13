import { guardAppendBatch, type SemanticEvent } from '@/lib/decision-kernel';

// Supabase is intentionally untyped in this app's server routes (there is no
// generated Database type). Keep the unsafe edge here, not in every surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export type SemanticLedgerAppend =
  | { ok: true; events: unknown[]; receipt: unknown[] }
  | { ok: false; code: string };

export async function readProjectSemanticEvents(admin: AdminClient, userId: string, projectId: string): Promise<unknown[] | null> {
  const { data, error } = await admin
    .from('project_semantic_events')
    .select('event')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .order('event_id', { ascending: true });
  if (error) return null;
  return (data ?? []).map((row: { event: unknown }) => row.event);
}

/**
 * Shared server-side write gateway for web commands and trusted capture
 * adapters (Telegram/plugin). The database RPC serializes/atomically persists;
 * this layer supplies the exact same canonical reducer preflight to every
 * surface. Concurrent valid intents are retained and projected as a conflict,
 * never collapsed into a last-write-wins JSON document.
 */
export async function appendProjectSemanticEvents(
  admin: AdminClient,
  userId: string,
  projectId: string,
  candidates: readonly SemanticEvent[],
): Promise<SemanticLedgerAppend> {
  const existing = await readProjectSemanticEvents(admin, userId, projectId);
  if (!existing) return { ok: false, code: 'READ_FAILED' };

  const candidateKeys = new Set(candidates.map((event) => event.idempotency_key));
  const matching = existing.filter((raw) => {
    const key = (raw as { idempotency_key?: unknown })?.idempotency_key;
    return typeof key === 'string' && candidateKeys.has(key);
  });
  if (matching.length === 0) {
    const preflight = guardAppendBatch(existing, candidates) as { ok: true; events: SemanticEvent[] } | { ok: false; code: string };
    if (!preflight.ok) return { ok: false, code: preflight.code };
  }

  const { data, error } = await admin.rpc('append_project_semantic_events', {
    p_user_id: userId,
    p_project_id: projectId,
    p_events: candidates,
  });
  if (error) {
    const message = String(error.message ?? '');
    return {
      ok: false,
      code: message.includes('IDEMPOTENCY_CONFLICT') ? 'IDEMPOTENCY_CONFLICT'
        : message.includes('EVENT_ID_CONFLICT') ? 'EVENT_ID_CONFLICT'
          : message.includes('PROJECT_NOT_FOUND_OR_FORBIDDEN') ? 'FORBIDDEN'
            : message.includes('SPACE_MISMATCH') ? 'SPACE_MISMATCH'
              : 'APPEND_FAILED',
    };
  }
  const events = await readProjectSemanticEvents(admin, userId, projectId);
  return events ? { ok: true, events, receipt: data ?? [] } : { ok: false, code: 'RECEIPT_UNAVAILABLE' };
}
