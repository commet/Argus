import { guardAppendBatch, type Resolution, type SemanticEvent } from '@/lib/decision-kernel';
import type { PluginDecision } from '@/stores/types';

export interface PluginSemanticRecord {
  judgment_id: string;
  return_contract_id: string;
  events: SemanticEvent[];
}

function spaceId(decision: PluginDecision): string {
  return `plugin:${decision.ledger_id}`;
}

function isoFromDay(day?: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(day ?? '') ? `${day}T00:00:00.000Z` : new Date(Date.now() + 14 * 86400000).toISOString();
}

function base(decision: PluginDecision, requestId: string, suffix: string, now: string, retrospective = false) {
  const space = spaceId(decision);
  return {
    event_id: `plugin:${decision.ledger_id}:${requestId}:${suffix}`,
    v: 3 as const,
    space_id: space,
    idempotency_key: `plugin:${decision.ledger_id}:${requestId}:${suffix}`,
    ...(suffix === 'sealed' || suffix === 'return' || suffix === 'observation' || suffix === 'resolution'
      ? { atomic_batch_id: `plugin:${decision.ledger_id}:${requestId}` }
      : {}),
    time: {
      ...(retrospective && decision.sealed_at ? { occurred_at: decision.sealed_at } : { occurred_at: now }),
      recorded_at: now,
      authorized_at: now,
      temporal_mode: retrospective ? 'retrospective' as const : 'contemporaneous' as const,
    },
    authority: {
      originated_by: { kind: 'imported' as const, id: `legacy-plugin:${decision.ledger_id}` },
      recorded_by: { kind: 'system' as const, id: 'web:argus-plugin' },
      authorized_by: { kind: 'human' as const, id: `account-plugin:${decision.ledger_id}` },
      authorization_mode: 'explicit_confirmation' as const,
      authorization_ref: { kind: 'command_digest' as const, ref: `web-plugin:${requestId}` },
    },
  };
}

function observationalBase(decision: PluginDecision, requestId: string, now: string) {
  const space = spaceId(decision);
  return {
    event_id: `plugin:${decision.ledger_id}:${requestId}:observation`,
    v: 3 as const,
    space_id: space,
    idempotency_key: `plugin:${decision.ledger_id}:${requestId}:observation`,
    atomic_batch_id: `plugin:${decision.ledger_id}:${requestId}`,
    time: { occurred_at: now, recorded_at: now, temporal_mode: 'contemporaneous' as const },
    authority: {
      originated_by: { kind: 'human' as const, id: `account-plugin:${decision.ledger_id}` },
      recorded_by: { kind: 'system' as const, id: 'web:argus-plugin' },
      observed_by: { kind: 'human' as const, id: `account-plugin:${decision.ledger_id}` },
    },
    provenance: { source_kind: 'user_utterance' as const, verification: 'pasted' as const },
  };
}

function guarded(existing: readonly unknown[], candidates: SemanticEvent[]): SemanticEvent[] {
  const result = guardAppendBatch(existing, candidates) as { ok: true; events: SemanticEvent[] } | { ok: false; code: string };
  if (!result.ok) throw new Error(result.code);
  return result.events;
}

/**
 * A v2 import is never silently upgraded. This is a present-tense human
 * reforge: imported historical content is retained as provenance and the
 * current explicit confirmation is retained as authority.
 */
export function reforgePluginDecision(decision: PluginDecision, requestId: string, now = new Date().toISOString()): PluginSemanticRecord {
  const judgmentId = `plugin-judgment:${decision.ledger_id}`;
  const returnId = `${judgmentId}:return`;
  const statement = decision.decision?.trim() || decision.quote?.trim() || decision.predicate?.trim();
  const question = decision.predicate?.trim() || decision.decision?.trim();
  if (!statement || !question) throw new Error('LEGACY_RECORD_MISSING_STATEMENT');
  const events = guarded([], [
    {
      ...base(decision, requestId, 'sealed', now, true), event: 'judgment_sealed', judgment_id: judgmentId, statement,
      provenance: { source_kind: 'import', source_ref: `legacy-plugin:${decision.ledger_id}`, verification: 'unknown' },
    },
    {
      ...base(decision, requestId, 'return', now, true), event: 'return_promised', return_contract_id: returnId,
      judgment_id: judgmentId, review_at: isoFromDay(decision.check_by), review_question: question,
    },
  ]);
  return { judgment_id: judgmentId, return_contract_id: returnId, events };
}

export function recordPluginAnswer(
  decision: PluginDecision,
  record: PluginSemanticRecord,
  requestId: string,
  outcome: 'happened' | 'avoided' | 'partial',
  now = new Date().toISOString(),
): SemanticEvent[] {
  const observationId = `plugin-observation:${requestId}`;
  const text = `Account plugin user selected “${outcome}”.`;
  const resolution: Resolution = {
    kind: 'answered', answer_summary: text,
    ...(outcome === 'partial' ? { criterion_result: 'partial' as const } : {}),
    evidence_refs: [observationId],
  };
  return guarded(record.events, [
    { ...observationalBase(decision, requestId, now), event: 'observation_recorded', observation_id: observationId, text },
    {
      ...base(decision, requestId, 'resolution', now), event: 'resolution_asserted',
      resolution_id: `plugin-resolution:${requestId}`, judgment_id: record.judgment_id,
      return_contract_id: record.return_contract_id, resolution,
    },
  ]);
}

export function deferPluginReturn(decision: PluginDecision, record: PluginSemanticRecord, requestId: string, checkBy: string, now = new Date().toISOString()): SemanticEvent[] {
  return guarded(record.events, [{
    ...base(decision, requestId, 'deferred', now), event: 'return_deferred', return_contract_id: record.return_contract_id,
    review_at: isoFromDay(checkBy),
  }]);
}

export function closePluginRecord(decision: PluginDecision, record: PluginSemanticRecord, requestId: string, resolutionId: string, now = new Date().toISOString()): SemanticEvent[] {
  return guarded(record.events, [{
    ...base(decision, requestId, 'closed', now), event: 'judgment_closed', judgment_id: record.judgment_id, resolution_id: resolutionId,
  }]);
}
