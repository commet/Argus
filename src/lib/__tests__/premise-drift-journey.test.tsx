/**
 * 공정 3 exit — 전제 드리프트 여정 fixture (BLUEPRINT §6 공정 3).
 *
 * ONE fixture walked end-to-end through the REAL wires, in cron order:
 *   감지 (isDueForRecheck / isDueForReconsider)
 *   → gate (buildPremiseWatchAlert → notification-gate)
 *   → 이메일 페이로드 (T2 standalone) 또는 T5 브리프 강등 (brief_pending 큐)
 *   → 기록 (applyWatchRecheck — cron이 실제로 persist하는 그 mutation)
 *   → 전제 화면 (PremiseTracker가 기록된 recheck를 그대로 렌더 + 딥링크 앵커).
 *
 * Segment tests exist elsewhere (premise-watch-alert / companion-brief-routing /
 * PremiseTracker); this file's job is the SEAMS — the produced field must be the
 * consumed field at every hop, so a silently dropped wire turns this red instead
 * of an LLM-plausible nothing (CLAUDE.md: honest structure over fabrication).
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { applyWatchRecheck, buildPremiseWatchAlert } from '../premise-watch-routing';
import { clearPendingBriefChanges, pendingBriefChanges } from '../companion-brief-routing';
import { buildCompanionBrief } from '../companion-brief';
import { findForbiddenNotificationVocabulary } from '../notification-copy';
import { isDueForRecheck, type PremiseState } from '../premises-core';
import { PremiseTracker } from '@/components/review/PremiseTracker';
import type { JudgmentReceipt } from '../review';
import type { InvestigationResult } from '../premise-researcher';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: null, session: null, loading: false }),
}));

const TODAY = '2026-07-08';
const NOW = `${TODAY}T09:00:00.000Z`;

function fixturePremise(): PremiseState {
  return {
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
}

function fixtureReceipt(premise: PremiseState): JudgmentReceipt {
  return {
    receipt_id: 'r_rate',
    state: 'sealed',
    source_title: '조달 시점 판단',
    core_question: '지금 조달할까?',
    falsifiable_followups: [],
    hidden_assumptions: [],
    claim_ledger: [],
    tracked_premises: [premise],
  } as unknown as JudgmentReceipt;
}

describe('전제 드리프트 여정: 감지→gate→이메일 페이로드→전제 화면', () => {
  it('material drift: 감지→send→T2 이메일→기록→화면의 출처/확신도/딥링크 앵커까지 한 줄로 잇는다', () => {
    const premise = fixturePremise();
    const receipt = fixtureReceipt(premise);

    // ── 감지: cadence가 지난 monitored 전제만 조사 대상이 된다 (cron의 due 필터).
    expect(isDueForRecheck(premise, TODAY)).toBe(true);

    const result: InvestigationResult = {
      verdict: 'material',
      fact: '기준금리 4.0%',
      current_value: 4,
      source_url: 'https://bok.example/current',
      source_date: '2026-07-07',
      confidence: 'high',
      materiality: 'material',
    };

    // ── gate: material + payload 있음 → 단독 발송 허용.
    const alert = buildPremiseWatchAlert({
      userId: 'u1', receiptId: 'row_rate', receipt, premise, result,
      checkedAt: NOW, baseUrl: 'https://argus.voyage',
    });
    expect(alert.gate.decision).toBe('send');

    // ── 이메일 페이로드: 봉인 당시 값 vs 지금 값 + 출처 + 확신도, 해석 어휘 0.
    expect(alert.email?.markdown).toContain('봉인 당시 값: 3.5');
    expect(alert.email?.markdown).toContain('오늘 확인된 값: 4');
    expect(alert.email?.markdown).toContain('https://bok.example/current');
    expect(findForbiddenNotificationVocabulary(`${alert.email?.subject}\n${alert.email?.markdown}`)).toEqual([]);

    // ── 기록: cron이 persist하는 바로 그 mutation.
    applyWatchRecheck(premise, result, { now: NOW, queueForBrief: false });
    expect(premise.last_recheck).toMatchObject({
      finding: '기준금리 4.0%',
      numeric_value: 4,
      baseline_finding: '기준금리 3.5%',
      baseline_numeric_value: 3.5,
      drifted: true,
      source: 'url',
      source_detail: 'https://bok.example/current (2026-07-07)',
      confidence: 'high',
      auto: true,
    });
    expect(premise.last_recheck?.brief_pending).toBeUndefined();

    // ── 전제 화면: 기록된 recheck가 그대로 렌더되고, 이메일 딥링크의 premise
    //    파라미터가 화면의 스크롤 앵커와 일치한다 (ReviewFlow가 소비하는 계약).
    const html = renderToStaticMarkup(<PremiseTracker receipt={receipt} />);
    expect(html).toContain('3.5');           // sealed value
    expect(html).toContain('4');             // current value
    expect(html).toContain('https://bok.example/current');
    expect(html).toContain('High');          // confidence
    const premiseParam = new URL(alert.email!.url).searchParams.get('premise');
    expect(premiseParam).toBe('p_rate');
    expect(html).toContain(`id="premise-${premiseParam}"`);
  });

  it('minor drift: 감지→강등→brief_pending 기록→T5 브리프 반영→1회 소비 후 해제', () => {
    const premise = fixturePremise();
    const receipt = fixtureReceipt(premise);
    expect(isDueForRecheck(premise, TODAY)).toBe(true);

    const result: InvestigationResult = {
      verdict: 'quiet',
      fact: '기준금리 3.51%',
      current_value: 3.51,
      source_url: 'https://bok.example/current',
      source_date: '2026-07-07',
      confidence: 'high',
      materiality: 'unchanged',
    };

    // ── gate: 사소 drift → 단독 메일 금지, 브리프 강등.
    const alert = buildPremiseWatchAlert({
      userId: 'u1', receiptId: 'row_rate', receipt, premise, result, checkedAt: NOW,
    });
    expect(alert.gate).toEqual({ decision: 'merge_into_brief', reason: 'minor_premise_to_brief' });
    expect(alert.email).toBeUndefined();

    // ── 기록: 강등 결정이 brief_pending 큐로 남는다.
    applyWatchRecheck(premise, result, {
      now: NOW,
      queueForBrief: alert.gate.decision === 'merge_into_brief' && Boolean(alert.change),
    });
    expect(premise.last_recheck).toMatchObject({
      brief_pending: true,
      brief_kind: 'premise_minor_drift',
      confidence: 'high',
    });

    // ── T5 브리프: companion-brief cron이 같은 receipt에서 큐를 꺼내 싣는다.
    const changes = pendingBriefChanges(receipt);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      premise_id: 'p_rate',
      fact: '기준금리 3.51%',
      source_url: 'https://bok.example/current',
      source_date: '2026-07-07',
      confidence: 'high',
    });
    const brief = buildCompanionBrief([{ source_title: receipt.source_title, core_question: receipt.core_question, predicates: [], changes }]);
    expect(brief.markdown).toContain('기준금리 3.51%');
    expect(brief.markdown).toContain('https://bok.example/current');
    expect(findForbiddenNotificationVocabulary(`${brief.subject}\n${brief.markdown}`)).toEqual([]);

    // ── 소비는 1회: 실은 뒤 큐가 비워져 다음 브리프에 중복 승차하지 않는다.
    const cleared = clearPendingBriefChanges(receipt);
    expect(pendingBriefChanges(cleared)).toHaveLength(0);
  });

  it('no recent source: 정직한 "새 소식 없음"으로 기록하고 시계만 전진시킨다', () => {
    const premise = fixturePremise();
    const before = premise.recheck_count;

    applyWatchRecheck(premise, { verdict: 'no_recent_source', reason: 'no recent dated source' }, { now: NOW });

    expect(premise.last_recheck).toMatchObject({
      finding: '최근 확인 — 새 소식 없음',
      numeric_value: 3.5, // 수치 기준값은 보존
      drifted: false,
      source: 'host_reported',
      auto: true,
    });
    expect(premise.recheck_count).toBe(before + 1);
    // 시계가 전진했으므로 오늘 다시 조사 대상이 되지 않는다 (비용 상한의 전제).
    expect(isDueForRecheck(premise, TODAY)).toBe(false);
  });
});
