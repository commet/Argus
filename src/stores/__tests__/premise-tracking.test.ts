import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pure store test — stub the Supabase sync layer (matches review-lifecycle-simulation).
vi.mock('@/lib/review-sync', () => ({
  loadReceiptsMerged: vi.fn((local: unknown) => Promise.resolve(local)),
  pushReceipt: vi.fn(),
  deleteReceiptRemote: vi.fn(),
}));

import { useReviewStore } from '../useReviewStore';
import {
  ingest,
  runDocumentReview,
  type ReviewLLM,
  type ReviewLLMArgs,
  type CanonicalArtifact,
  type JudgmentReceipt,
} from '@/lib/review';
import { isMonitored, isDueForRecheck, isReconsiderable, addDays, DEFAULT_RECHECK_CADENCE_DAYS } from '@/lib/premises-core';

function mock(artifact: CanonicalArtifact): ReviewLLM {
  const uid = artifact.units[0]?.unit_id ?? 'u0';
  return {
    model_name: 'mock', model_provider: 'local',
    async json<T>(args: ReviewLLMArgs): Promise<T> {
      if (args.system.includes('"추출"')) {
        return {
          profile: { document_type: 'strategy_memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'working_draft', source_confidence: 0.7 },
          core_question: '핵심 질문', main_claims: [{ text: 'c', status: 'weak', unit_ids: [uid], rationale: 'r' }],
          assumptions: [{ text: '금리가 3.5% 근처에 머문다', unit_ids: [uid], if_false: '조달비용이 뛴다' }],
          decision_points: [{ text: 'd', human_only: true, unit_ids: [uid] }],
          evidence_items: [], tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [],
        } as T;
      }
      if (args.system.includes('렌즈다')) return { findings: [] } as T;
      if (args.system.includes('"종합"')) {
        return {
          core_question: '핵심 질문', current_heading: '확인 뒤 정하세요', judgment_obligations: [],
          followups: [{ predicate: '2주 내 지표 상승', pass_condition: '+5%', fail_condition: '변화없음', check_by: '2027-01-01' }],
        } as T;
      }
      return {} as T;
    },
  };
}

async function reviewInto(text: string): Promise<JudgmentReceipt> {
  const artifact = ingest({ source_kind: 'markdown', text });
  const { receipt } = await runDocumentReview(artifact, { llm: mock(artifact), today: '2026-07-01' });
  return receipt!;
}

const S = () => useReviewStore.getState();
beforeEach(() => useReviewStore.setState({ receipts: [], loaded: true, synced: true }));

describe('premise tracking — promote, re-check, caps', () => {
  it('promotes a premise, records a baseline then a material numeric drift', async () => {
    const r = await reviewInto('# 전략\n\n금리가 3.5% 근처에 머문다는 가정 위에 계획을 세운다.');
    S().saveReceipt(r);
    // seal the follow-up so premises are armed
    const fid = r.falsifiable_followups[0].followup_id;
    S().sealFollowup(r.receipt_id, fid, { predicate: 'p', pass_condition: 'a', fail_condition: 'b', check_by: '2027-01-01' });

    S().promotePremise(r.receipt_id, { text: '금리가 3.5% 근처에 머문다', load_bearing: true, external: true });
    let rec = S().getReceipt(r.receipt_id)!;
    expect(rec.tracked_premises?.length).toBe(1);
    const p = rec.tracked_premises![0];
    expect(isMonitored(p)).toBe(true); // external + load-bearing + active
    // armed + never checked → NOT due the day it was added; the first re-check
    // waits one cadence from added_ts (founder decision 2026-07-10, matching the
    // open_question clock). Anchored to added_ts so the test isn't wall-clock-fragile.
    const addedDay = p.added_ts!.slice(0, 10);
    expect(isDueForRecheck(p, addedDay)).toBe(false);
    expect(isDueForRecheck(p, addDays(addedDay, DEFAULT_RECHECK_CADENCE_DAYS))).toBe(true);

    // first re-check = baseline (records, never alerts)
    const s1 = S().recheckPremise(r.receipt_id, p.premise_id, { finding: '기준금리 3.5%', numeric_value: 3.5, source: 'user_stated' });
    expect(s1).toBe('baseline');

    // second re-check with a >10% move = material
    const s2 = S().recheckPremise(r.receipt_id, p.premise_id, { finding: '기준금리 4.0%', numeric_value: 4.0, source: 'url', source_detail: 'https://x' });
    expect(s2).toBe('material');
    rec = S().getReceipt(r.receipt_id)!;
    expect(rec.tracked_premises![0].last_recheck?.drifted).toBe(true);
    expect(rec.tracked_premises![0].recheck_count).toBe(2);

    // a tiny move vs the new baseline = unchanged (below noise)
    const s3 = S().recheckPremise(r.receipt_id, p.premise_id, { finding: '기준금리 4.01%', numeric_value: 4.01, source: 'user_stated' });
    expect(s3).toBe('unchanged');
  });

  it('text premises take the user-asserted changed flag', async () => {
    const r = await reviewInto('# 전략\n\n경쟁사가 아직 이 기능을 내지 않았다는 전제.');
    S().saveReceipt(r);
    S().promotePremise(r.receipt_id, { text: '경쟁사가 아직 이 기능을 내지 않았다', load_bearing: true, external: true });
    const pid = S().getReceipt(r.receipt_id)!.tracked_premises![0].premise_id;
    expect(S().recheckPremise(r.receipt_id, pid, { finding: '동일', source: 'user_stated' })).toBe('baseline');
    expect(S().recheckPremise(r.receipt_id, pid, { finding: '경쟁사가 출시함', changed: true, source: 'user_stated' })).toBe('material');
  });

  it('promotes an item as an open_question (trigger b) — reconsiderable, not a monitored premise', async () => {
    const r = await reviewInto('# 전략\n\n규제가 어떻게 될지 아직 모름.');
    S().saveReceipt(r);
    S().promotePremise(r.receipt_id, { text: '내년 규제가 완화될지', load_bearing: false, external: true, kind: 'open_question' });
    const p = S().getReceipt(r.receipt_id)!.tracked_premises![0];
    expect(p.kind).toBe('open_question');
    expect(isReconsiderable(p)).toBe(true);   // watched for new info to decide
    expect(isMonitored(p)).toBe(false);        // not a fact-drift premise
    // same text can also be tracked as a premise (distinct kind → distinct id)
    S().promotePremise(r.receipt_id, { text: '내년 규제가 완화될지', load_bearing: true, external: true });
    expect(S().getReceipt(r.receipt_id)!.tracked_premises!.length).toBe(2);
  });

  it('setAutoWatch toggles the per-premise watcher opt-in', async () => {
    const r = await reviewInto('# 전략\n\n금리 전제.');
    S().saveReceipt(r);
    S().promotePremise(r.receipt_id, { text: '금리 3.5%', load_bearing: true, external: true });
    const pid = S().getReceipt(r.receipt_id)!.tracked_premises![0].premise_id;
    expect(S().getReceipt(r.receipt_id)!.tracked_premises![0].auto_watch).toBeFalsy(); // off by default (privacy)
    S().setAutoWatch(r.receipt_id, pid, true, '한국 기준금리 현재');
    const p = S().getReceipt(r.receipt_id)!.tracked_premises![0];
    expect(p.auto_watch).toBe(true);
    expect(p.watch_query).toBe('한국 기준금리 현재');
    S().setAutoWatch(r.receipt_id, pid, false);
    expect(S().getReceipt(r.receipt_id)!.tracked_premises![0].auto_watch).toBe(false);
  });

  it('caps active premises at 5 and load-bearing at 2', async () => {
    const r = await reviewInto('# 전략\n\n여러 전제가 있는 문서.');
    S().saveReceipt(r);
    for (let i = 0; i < 7; i++) {
      S().promotePremise(r.receipt_id, { text: `전제 ${i}`, load_bearing: true, external: true });
    }
    const rec = S().getReceipt(r.receipt_id)!;
    const active = (rec.tracked_premises ?? []).filter((p) => p.status === 'active');
    expect(active.length).toBe(5); // MAX_ACTIVE_PREMISES
    expect(active.filter((p) => p.load_bearing).length).toBe(2); // MAX_LOAD_BEARING
    // only the load-bearing ones are monitored (drive nudges)
    expect(active.filter((p) => isMonitored(p)).length).toBe(2);
  });

  it('retiring a premise frees a slot and stops monitoring it', async () => {
    const r = await reviewInto('# 전략\n\n하나의 전제.');
    S().saveReceipt(r);
    S().promotePremise(r.receipt_id, { text: '유일 전제', load_bearing: true, external: true });
    const pid = S().getReceipt(r.receipt_id)!.tracked_premises![0].premise_id;
    S().retirePremise(r.receipt_id, pid);
    const rec = S().getReceipt(r.receipt_id)!;
    const p = rec.tracked_premises![0];
    expect(p.status).toBe('retired');
    expect(isMonitored(p)).toBe(false);
  });
});
