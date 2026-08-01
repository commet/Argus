/**
 * One vocabulary, chosen by what can be DONE with each thing later.
 *
 * The same idea existed in three dialects — the web had one bucket ('premise'),
 * MCP had two ('premise' | 'open_question'), the seal had three ('prediction' |
 * 'commitment' | 'witness') — so nothing could be carried between them. Rather
 * than add a fourth scheme, the kinds are now the five distinct downstream
 * verbs, and the one attribute genuinely missing everywhere (what you would
 * OBSERVE) is added.
 *
 * The load-bearing case is `standard`: the user's own weighting. Reality never
 * settles it, and asking "그거 맞았어요?" about someone's values grades who they
 * are — the spine's first prohibition. Before this, values had nowhere to go
 * except the premise bucket, which is checked and graded.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coercePremiseCandidates } from '@/lib/judgment-state-contract';
import { extractPredicatesFromSession } from '@/lib/decision-contract';
import { carriedPremises, premisesToRevisit } from '@/lib/decisive-premises';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const candidate = (over: Record<string, unknown> = {}) => ({
  text: '18개월 안에 다음 라운드나 흑자 전환이 온다',
  anchor_quote: '런웨이가 18개월이라서 그 안에 뭔가 나와야 해요',
  support_kind: 'explicit_condition',
  if_false_changes: '재정 안정성 판단이 통째로 달라진다',
  ...over,
});
const CORPUS = '런웨이가 18개월이라서 그 안에 뭔가 나와야 해요.';

describe('a collected item knows what can be done with it', () => {
  it('keeps the declared kind and the observable', () => {
    const { records } = coercePremiseCandidates(
      [candidate({ kind: 'prediction', observable: '다음 라운드 발표' })],
      CORPUS,
    );
    expect(records[0].kind).toBe('prediction');
    expect(records[0].observable).toBe('다음 라운드 발표');
  });

  it('reads an unknown or missing kind as premise — verified, never skipped', () => {
    expect(coercePremiseCandidates([candidate()], CORPUS).records[0].kind).toBe('premise');
    expect(coercePremiseCandidates([candidate({ kind: 'vibes' })], CORPUS).records[0].kind).toBe('premise');
  });
});

describe("a person's own standard is recorded, never tested", () => {
  it('carries the kind through to the sealed predicate', () => {
    const preds = extractPredicatesFromSession({
      mix: { key_assumptions: ['돈보다 성장이 중요하다'] } as never,
      premise_records: [{ text: '돈보다 성장이 중요하다', kind: 'standard' }],
    });
    expect(preds.find((p) => p.text === '돈보다 성장이 중요하다')?.premise_kind).toBe('standard');
  });

  it('the shared rule excludes it from anything reality is asked to settle', () => {
    // The rule lives in decisive-premises.ts so the seal, the return and the
    // card cannot drift apart on what "matters" means.
    const standard = { text: '돈보다 성장이 중요하다', kind: 'standard' as const };
    const premise = { text: '승진이 문서로 확정된다', kind: 'premise' as const };
    expect(carriedPremises([standard, premise])).toEqual([premise]);
    expect(premisesToRevisit([standard, premise])).toEqual([premise]);
  });

  it('the card marks it as not something to check', () => {
    const card = read('src/components/workspace/progressive/shared/AnalysisCard.tsx');
    expect(card).toContain("record?.kind === 'standard'");
    expect(card).toContain('확인 대상 아님');
  });
});

describe('the observable reaches the day it is needed', () => {
  it('survives from the premise into the sealed predicate', () => {
    const preds = extractPredicatesFromSession({
      mix: { key_assumptions: ['승진이 문서로 확정된다'] } as never,
      premise_records: [{ text: '승진이 문서로 확정된다', kind: 'premise', observable: '승진 공문' }],
    });
    expect(preds.find((p) => p.text === '승진이 문서로 확정된다')?.observable).toBe('승진 공문');
  });

  it('is shown on the return so the question can be about the thing itself', () => {
    expect(read('src/components/projects/FoundationSettlementModal.tsx')).toContain('보기로 한 것');
  });
});
