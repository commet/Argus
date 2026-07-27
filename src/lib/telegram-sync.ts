/**
 * Best-effort bridge: mirror a web-sealed decision into the Telegram return-push
 * channel. Calls POST /api/decisions/telegram-sync, which no-ops server-side for
 * users who haven't connected Telegram. This is the web half of the seal->return
 * loop the audit found broken (channel coverage was per-table, not per-user).
 *
 * Fire-and-forget by design: it must NEVER block or throw into the seal UX. A
 * failed sync just means the on-page return (DecisionContractCard) still works —
 * the Telegram push is an additive channel, not the only one.
 */
export function syncSealToTelegram(input: {
  accessToken: string;
  projectId: string;
  decision: string;
  predicate: string;
  falsifiedIf?: string | null;
  /** The committed check-in timestamp (ISO); the server derives the KST date. */
  checkInAt: string;
}): void {
  try {
    if (!input.accessToken || !input.projectId || !input.predicate || !input.checkInAt) return;
    void fetch('/api/decisions/telegram-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        projectId: input.projectId,
        decision: input.decision,
        predicate: input.predicate,
        falsifiedIf: input.falsifiedIf ?? null,
        checkInAt: input.checkInAt,
      }),
      keepalive: true,
    }).catch(() => { /* additive channel — silence is fine */ });
  } catch { /* never block the seal */ }
}

/**
 * A witness is a first-class "keep this, never ask again" record. If the same
 * project previously had a returnable seal, disable its mirrored Telegram row
 * so an old date cannot resurrect a reminder. A later returnable correction
 * calls syncSealToTelegram again and explicitly re-arms the row.
 */
export function disableTelegramReturn(input: {
  accessToken: string;
  projectId: string;
}): void {
  try {
    if (!input.accessToken || !input.projectId) return;
    void fetch('/api/decisions/telegram-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        action: 'disable',
        projectId: input.projectId,
      }),
      keepalive: true,
    }).catch(() => { /* additive channel — the web record remains canonical */ });
  } catch { /* never block the authorial correction */ }
}
