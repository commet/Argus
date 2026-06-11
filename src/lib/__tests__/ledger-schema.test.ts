/**
 * Ledger schema convention tests (W1.2 acceptance).
 *
 * 1. Shape match — watch's ledger.mjs is plain .mjs and can't import the TS
 *    schema, so the convention is enforced HERE: every canonical field the
 *    unified decision object declares must appear in ledger.mjs's replay
 *    materialization. Rename a field on either side → this fails.
 * 2. Web → unified projection produces canonical-shaped objects.
 * 3. amendCheckIn ("아직") preserves history — never overwrites the original.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LEDGER_DECISION_FIELDS,
  WATCH_NATIVE_FIELDS,
  contractToLedgerDecisions,
  watchToLedgerDecision,
  verdictToOutcome,
} from '../ledger-schema';
import { amendCheckIn, withCheckIn, contractFromPredicates, gradePredicate } from '../decision-contract';
import type { Predicate, DecisionContract } from '@/stores/types';

const WATCH_LEDGER_SRC = readFileSync(
  join(process.cwd(), 'tools/argus-watch/lib/ledger.mjs'),
  'utf8',
);

const P = (over: Partial<Predicate> = {}): Predicate => ({
  id: 'p1',
  text: 'CFO가 가격 단계에서 비용에 반대한다',
  source: 'risk',
  ...over,
});

const sealedContract = (now: number): DecisionContract =>
  withCheckIn(contractFromPredicates('proj1', [P(), P({ id: 'p2', source: 'governing_idea' })], now)!, '2w', now);

describe('shape match: canonical fields ⇄ watch ledger.mjs', () => {
  it('every watch-native canonical field appears in the ledger.mjs replay source', () => {
    for (const field of WATCH_NATIVE_FIELDS) {
      expect(WATCH_LEDGER_SRC, `field "${field}" missing from ledger.mjs — schema drift`).toContain(field);
    }
  });

  it('watch settle vocabulary matches the canonical outcome vocabulary', () => {
    // The CLI documents its settle args; all canonical outcomes must be among them.
    const cliSrc = readFileSync(join(process.cwd(), 'tools/argus-watch/cli.mjs'), 'utf8');
    for (const outcome of ['happened', 'avoided', 'partial'] as const) {
      expect(cliSrc).toContain(outcome);
    }
  });

  it('watchToLedgerDecision stamps source and keeps native fields verbatim', () => {
    const raw = {
      id: 'abc12345',
      status: 'sealed',
      quote: '플러그인은 폐기하지 말고 포지셔닝만 바꾸자',
      decision: '플러그인 보존, 포지셔닝 피벗',
      predicate: '한 달 내 플러그인 코드가 새 포지셔닝에 재사용된다',
      falsified_if: '새 레포를 파거나 플러그인 디렉토리를 삭제한다',
      check_by: '2026-07-01',
      history: [{ check_by: '2026-06-20', amended_at: '2026-06-15T00:00:00Z' }],
    };
    const d = watchToLedgerDecision(raw);
    expect(d.source).toBe('watch');
    expect(d.quote).toBe(raw.quote);
    expect(d.predicate).toBe(raw.predicate);
    expect(d.falsified_if).toBe(raw.falsified_if);
    expect(d.check_by).toBe(raw.check_by);
    expect(d.status).toBe('sealed');
    expect(d.history).toHaveLength(1);
    // Every canonical field present (outcome optional — absent pre-settle).
    for (const f of LEDGER_DECISION_FIELDS) {
      if (f === 'outcome') continue;
      expect(d, `canonical field "${f}" missing`).toHaveProperty(f);
    }
  });

  it('watchToLedgerDecision survives malformed lines (defensive)', () => {
    const d = watchToLedgerDecision({ id: 42, status: 'weird', history: 'nope' });
    expect(d.id).toBe('');
    expect(d.status).toBe('candidate');
    expect(d.history).toEqual([]);
  });
});

describe('web → unified projection', () => {
  const NOW = Date.parse('2026-06-11T00:00:00Z');

  it('fans a contract out to one canonical decision per predicate', () => {
    const c = sealedContract(NOW);
    const out = contractToLedgerDecisions({ id: 'proj1', name: '가격 인상 결정' }, c, '이번엔 비용이 아니라 가치로 설득한다');
    expect(out).toHaveLength(2);
    for (const d of out) {
      for (const f of LEDGER_DECISION_FIELDS) {
        if (f === 'outcome') continue;
        expect(d, `canonical field "${f}" missing`).toHaveProperty(f);
      }
      expect(d.source).toBe('web');
      expect(d.quote).toBe('이번엔 비용이 아니라 가치로 설득한다');
      expect(d.check_by).toBe(c.check_in_at);
      expect(d.status).toBe('sealed');
    }
    // ids are unique per predicate and stable (contract id + predicate id).
    expect(new Set(out.map((d) => d.id)).size).toBe(2);
  });

  it('a graded predicate projects as settled with the shared outcome vocab', () => {
    let c = sealedContract(NOW);
    c = gradePredicate(c, 'p1', 'happened', NOW + 1000);
    const out = contractToLedgerDecisions({ id: 'proj1', name: 'x' }, c);
    const settled = out.find((d) => d.id.endsWith(':p1'))!;
    expect(settled.status).toBe('settled');
    expect(settled.outcome).toBe('happened');
  });

  it('unknown/pending verdicts never become outcomes', () => {
    expect(verdictToOutcome('unknown')).toBeNull();
    expect(verdictToOutcome('pending')).toBeNull();
    expect(verdictToOutcome(undefined)).toBeNull();
    expect(verdictToOutcome('partial')).toBe('partial');
  });

  it('null/legacy contracts project to empty (no crash)', () => {
    expect(contractToLedgerDecisions({ id: 'p', name: 'x' }, null)).toEqual([]);
    expect(contractToLedgerDecisions({ id: 'p', name: 'x' }, undefined)).toEqual([]);
    // legacy contract without predicates array
    const legacy = { id: 'c', project_id: 'p', created_at: 'x' } as unknown as DecisionContract;
    expect(contractToLedgerDecisions({ id: 'p', name: 'x' }, legacy)).toEqual([]);
  });
});

describe('amendCheckIn — "아직" extends, never overwrites (W1.2 acceptance)', () => {
  const NOW = Date.parse('2026-06-11T00:00:00Z');

  it('pushes the superseded check-in to history and sets the new date', () => {
    const c = sealedContract(NOW);
    const originalCheckIn = c.check_in_at!;
    const LATER = NOW + 14 * 86_400_000; // the check-in day
    const amended = amendCheckIn(c, '1w', LATER);

    // New date is in the future of the amend moment.
    expect(amended.check_in_at).toBe(new Date(LATER + 7 * 86_400_000).toISOString());
    expect(amended.check_in_interval).toBe('1w');
    // The original is preserved verbatim in history — not overwritten.
    expect(amended.history).toHaveLength(1);
    expect(amended.history![0].check_in_at).toBe(originalCheckIn);
    expect(amended.history![0].check_in_interval).toBe('2w');
    expect(amended.history![0].amended_at).toBe(new Date(LATER).toISOString());
    // Pure: the input contract was not mutated.
    expect(c.history).toBeUndefined();
    expect(c.check_in_at).toBe(originalCheckIn);
  });

  it('repeated amends accumulate history oldest-first', () => {
    const c = sealedContract(NOW);
    const a1 = amendCheckIn(c, '1w', NOW + 1);
    const a2 = amendCheckIn(a1, '1m', NOW + 2);
    expect(a2.history).toHaveLength(2);
    expect(a2.history![0].check_in_interval).toBe('2w'); // original
    expect(a2.history![1].check_in_interval).toBe('1w'); // first amend
    expect(a2.check_in_interval).toBe('1m');
  });

  it('amends survive a legacy contract with no history field', () => {
    const c = { ...sealedContract(NOW), history: undefined };
    const amended = amendCheckIn(c, '2w', NOW + 5);
    expect(amended.history).toHaveLength(1);
  });

  it('verdicts already given are untouched by an amend', () => {
    let c = sealedContract(NOW);
    c = gradePredicate(c, 'p1', 'avoided', NOW + 1);
    const amended = amendCheckIn(c, '1w', NOW + 2);
    expect(amended.predicates.find((p) => p.id === 'p1')!.verdict).toBe('avoided');
  });
});
