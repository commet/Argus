import { describe, expect, it } from 'vitest';
import { ArgusEventSchema, type ArgusEvent } from '../v2/events.js';
import {
  adaptV2Event,
  declaredV2EventNames,
  mappedV2EventNames,
  prepareV3Write,
  readV2Jsonl,
  readV2Legacy,
} from './legacy-v2.js';

const envelope = {
  event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B',
  v: 2 as const,
  producer_version: '2.0.0',
  repository_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
  session_id: 'session-a',
  occurred_at: '2026-07-14T18:00:00.000Z',
  logical_date: '2026-07-14',
  tz: 'Asia/Seoul',
  idempotency_key: 'legacy:fixture:1',
};
const user = <T>(value: T) => ({ value, provenance: 'direct_user_command' as const });

const parse = (payload: Record<string, unknown>): ArgusEvent => {
  const result = ArgusEventSchema.safeParse({ ...envelope, ...payload });
  if (!result.success) throw new Error(JSON.stringify(result.error.issues));
  return result.data;
};

describe('DKK v6 v2 legacy adapter', () => {
  it('classifies every declared v2 event exactly once', () => {
    expect(mappedV2EventNames()).toEqual(declaredV2EventNames());
  });

  it('splits a v2 seal without laundering it into human-authorized v3 history', () => {
    const seal = parse({
      event: 'seal', decision_id: 'pricing', predicate: user('Keep current price through September 1.'), check_by: user('2026-09-01'),
      real_question: 'Did conversion hold?',
    });
    const adapted = adaptV2Event(seal);
    expect(adapted.disposition).toBe('split');
    expect(adapted.authority_status).toBe('legacy_unknown');
    expect(adapted.hints.map((hint) => hint.kind)).toEqual(['judgment', 'return_contract']);
    expect(adapted.losses.some((loss) => loss.field === 'authority')).toBe(true);
    expect(seal.authority).toBeUndefined();
  });

  it('keeps v2 still_pending non-terminal and terminal outcomes explicitly legacy-shaped', () => {
    const deferred = parse({ event: 'settle', decision_id: 'pricing', outcome: user('still_pending' as const), note: 'Need another cohort.' });
    const held = parse({ event: 'settle', decision_id: 'pricing', outcome: user('held' as const), note: 'Condition met.' });

    expect(adaptV2Event(deferred).hints[0]?.kind).toBe('return_deferred');
    expect(adaptV2Event(held).hints.map((hint) => hint.kind)).toEqual(['resolution', 'closure']);
    expect(adaptV2Event(held).losses.some((loss) => loss.field === 'resolution.subject_ref')).toBe(true);
  });

  it('preserves opaque legacy operational events in the loss-aware report', () => {
    const sync = parse({ event: 'sync_pending', source_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B' });
    const report = readV2Legacy([sync]);
    expect(report.by_disposition.opaque).toBe(1);
    expect(report.adaptations[0]?.hints[0]?.kind).toBe('legacy_extension');
    expect(report.adaptations[0]?.raw).toBe(sync);
  });

  it('reads v2 JSONL without mutating it and makes corrupt lines visible', () => {
    const seal = parse({
      event: 'seal', decision_id: 'pricing', predicate: user('Keep current price through September 1.'), check_by: user('2026-09-01'),
      real_question: 'Did conversion hold?',
    });
    const before = JSON.stringify(seal);
    const read = readV2Jsonl(`\uFEFF${before}\n{not json}\n${JSON.stringify({ event: 'unknown' })}\n`);

    expect(read.events).toEqual([seal]);
    expect(JSON.stringify(seal)).toBe(before);
    expect(read.diagnostics.map((diagnostic) => [diagnostic.line, diagnostic.kind])).toEqual([
      [2, 'invalid_json'],
      [3, 'invalid_v2_event'],
    ]);
  });

  it('accepts a current v3 write separately from read-old data', () => {
    const prepared = prepareV3Write({
      event_id: 'v3-seal', v: 3, space_id: 'space-a', idempotency_key: 'v3-seal',
      time: { recorded_at: '2026-07-14T18:00:00.000Z', authorized_at: '2026-07-14T18:00:00.000Z', temporal_mode: 'contemporaneous' },
      authority: {
        originated_by: { kind: 'human', id: 'local:space-a' },
        recorded_by: { kind: 'system', id: 'mcp' },
        authorized_by: { kind: 'human', id: 'local:space-a' },
        authorization_mode: 'direct_command',
        authorization_ref: { kind: 'user_utterance', ref: 'turn:7' },
      },
      event: 'judgment_sealed', judgment_id: 'new-pricing', statement: 'Keep current price through September 1.',
    });
    expect(prepared.v).toBe(3);
    expect(prepared.event).toBe('judgment_sealed');
  });
});
