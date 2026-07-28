import { describe, expect, it } from 'vitest';
import { buildPremiseWatchAlert } from '../../app/api/cron/premise-watch/route';
import { findForbiddenNotificationVocabulary } from '../notification-copy';
import type { JudgmentReceipt } from '../review';
import type { PremiseState } from '../premises-core';
import type { InvestigationResult } from '../premise-researcher';

const premise: PremiseState = {
  premise_id: 'p_rate',
  ordinal: 2,
  kind: 'premise',
  text: '기준금리가 3.5% 근처에 머문다',
  external: true,
  load_bearing: true,
  source: 'user_stated',
  status: 'active',
  amend_history: [],
  recheck_count: 1,
  auto_watch: true,
  last_recheck: {
    finding: '기준금리 3.5%',
    numeric_value: 3.5,
    drifted: false,
    baseline_only: true,
    source: 'url',
    source_detail: 'https://bok.example/base (2026-06-01)',
    confidence: 'high',
    ts: '2026-06-01T00:00:00.000Z',
  },
};

const receipt = {
  receipt_id: 'r_rate',
  source_title: '조달 시점 판단',
  core_question: '지금 조달할까?',
  tracked_premises: [premise],
} as JudgmentReceipt;

describe('premise-watch T2 alert fixture', () => {
  it('routes material drift through gate into a T2 email payload and premise-screen deeplink', () => {
    const result: InvestigationResult = {
      verdict: 'material',
      fact: '기준금리 4.0%',
      current_value: 4,
      source_url: 'https://bok.example/current',
      source_date: '2026-07-07',
      confidence: 'high',
      materiality: 'material',
    };

    const alert = buildPremiseWatchAlert({
      userId: 'u1',
      receiptId: 'row_rate',
      receipt,
      premise,
      result,
      // The check date is deliberately LATER than source_date (2026-07-07): the
      // two are different facts, and an identical-dates fixture cannot tell whether
      // the email prints the source's publish date or merely today's.
      checkedAt: '2026-07-12T09:00:00.000Z',
      baseUrl: 'https://argus.voyage',
    });

    expect(alert.materiality).toBe('material');
    expect(alert.gate).toEqual({ decision: 'send', reason: 'allowed' });
    expect(alert.email?.subject).toBe('전제가 하나 움직였어요 — "기준금리가 3.5% 근처에 머문다"');
    expect(alert.email?.markdown).toContain('봉인 당시 값: 3.5');
    expect(alert.email?.markdown).toContain('오늘 확인된 값: 4');
    expect(alert.email?.markdown).toContain('출처: https://bok.example/current, 2026-07-07 발행');
    // and the check date is reported as its own fact, never as the source's.
    expect(alert.email?.markdown).toContain('확인일: 2026-07-12');
    expect(alert.email?.markdown).toContain('확신도: 높음');
    expect(alert.email?.url).toBe('https://argus.voyage/tools/review?receipt=row_rate&premise=p_rate');
  });

  it('keeps interpretation and recommendation language out of the T2 payload', () => {
    const result: InvestigationResult = {
      verdict: 'material',
      fact: '기준금리 4.0%',
      current_value: 4,
      source_url: 'https://bok.example/current',
      source_date: '2026-07-07',
      confidence: 'medium',
      materiality: 'material',
    };

    const alert = buildPremiseWatchAlert({
      userId: 'u1',
      receiptId: 'row_rate',
      receipt,
      premise,
      result,
      checkedAt: '2026-07-07T09:00:00.000Z',
    });

    expect(alert.email?.markdown).toContain('전제가 움직였다는 사실만 전해요.');
    expect(alert.email?.markdown).toContain('결정을 다시 볼지는 당신의 몫이에요.');
    // 단일 소스 validator (notification-copy.ts) — §4.1 금지 어휘 전체를 검사.
    expect(findForbiddenNotificationVocabulary(`${alert.email?.subject}\n${alert.email?.markdown}`)).toEqual([]);
  });

  it('sends a material fact-premise alert without requiring numeric drift', () => {
    const factPremise: PremiseState = {
      ...premise,
      premise_id: 'p_competitor',
      ordinal: 1,
      text: '경쟁사는 아직 공개 출시하지 않았다',
      last_recheck: {
        finding: '경쟁사 미출시',
        drifted: false,
        baseline_only: true,
        source: 'url',
        source_detail: 'https://competitor.example/old (2026-06-01)',
        confidence: 'medium',
        ts: '2026-06-01T00:00:00.000Z',
      },
    };
    const result: InvestigationResult = {
      verdict: 'material',
      fact: '경쟁사가 공개 출시를 발표',
      source_url: 'https://competitor.example/launch',
      source_date: '2026-07-07',
      confidence: 'medium',
    };

    const alert = buildPremiseWatchAlert({
      userId: 'u1',
      receiptId: 'row_competitor',
      receipt: { ...receipt, tracked_premises: [factPremise] } as JudgmentReceipt,
      premise: factPremise,
      result,
      checkedAt: '2026-07-07T09:00:00.000Z',
      baseUrl: 'https://argus.voyage',
    });

    expect(alert.materiality).toBe('material');
    expect(alert.gate).toEqual({ decision: 'send', reason: 'allowed' });
    expect(alert.email?.markdown).toContain('봉인 당시 값: 경쟁사 미출시');
    expect(alert.email?.markdown).toContain('오늘 확인된 값: 경쟁사가 공개 출시를 발표');
    expect(alert.email?.markdown).toContain('확신도: 보통');
    expect(alert.email?.url).toBe('https://argus.voyage/tools/review?receipt=row_competitor&premise=p_competitor');
  });

  it('downgrades minor numeric drift to the weekly brief instead of standalone mail', () => {
    const result: InvestigationResult = {
      verdict: 'quiet',
      fact: '기준금리 3.51%',
      current_value: 3.51,
      source_url: 'https://bok.example/current',
      source_date: '2026-07-07',
      confidence: 'high',
      materiality: 'unchanged',
    };

    const alert = buildPremiseWatchAlert({
      userId: 'u1',
      receiptId: 'row_rate',
      receipt,
      premise,
      result,
      checkedAt: '2026-07-07T09:00:00.000Z',
    });

    expect(alert.materiality).toBe('minor');
    expect(alert.gate).toEqual({ decision: 'merge_into_brief', reason: 'minor_premise_to_brief' });
    expect(alert.change).toMatchObject({
      text: '기준금리가 3.5% 근처에 머문다',
      fact: '기준금리 3.51%',
      current_value: 3.51,
      source_url: 'https://bok.example/current',
      confidence: 'high',
    });
    expect(alert.email).toBeUndefined();
  });

  it('keeps open questions as T3 brief-only even when new info is material', () => {
    const openQuestion = { ...premise, premise_id: 'p_reg', ordinal: 1, kind: 'open_question' as const, text: '규제 완화안이 나올까?', last_recheck: undefined };
    const result: InvestigationResult = {
      verdict: 'material',
      fact: '규제당국이 완화안을 발표',
      source_url: 'https://reg.example/news',
      source_date: '2026-07-07',
      confidence: 'high',
    };

    const alert = buildPremiseWatchAlert({
      userId: 'u1',
      receiptId: 'row_reg',
      receipt: { ...receipt, tracked_premises: [openQuestion] } as JudgmentReceipt,
      premise: openQuestion,
      result,
      checkedAt: '2026-07-07T09:00:00.000Z',
    });

    expect(alert.gate).toEqual({ decision: 'merge_into_brief', reason: 't3_brief_only' });
    expect(alert.email).toBeUndefined();
  });
});
