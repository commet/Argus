import { describe, it, expect, beforeEach, vi } from 'vitest';

// Keep this a pure store+pipeline simulation — stub the Supabase sync layer.
vi.mock('@/lib/review-sync', () => ({
  loadReceiptsMerged: vi.fn((local: unknown) => Promise.resolve(local)),
  pushReceipt: vi.fn(),
  deleteReceiptRemote: vi.fn(),
}));

import { useReviewStore } from '../useReviewStore';
import {
  ingest,
  runDocumentReview,
  sortByUrgency,
  summarizeReceipt,
  diffReceipts,
  type ReviewLLM,
  type ReviewLLMArgs,
  type CanonicalArtifact,
  type JudgmentReceipt,
} from '@/lib/review';

/** Minimal always-valid mock so we can focus on the store lifecycle. */
function mock(artifact: CanonicalArtifact, findingTitles: string[] = ['근거 약한 주장']): ReviewLLM {
  const uid = artifact.units[0]?.unit_id ?? 'u0';
  return {
    model_name: 'mock', model_provider: 'local',
    async json<T>(args: ReviewLLMArgs): Promise<T> {
      if (args.system.includes('"추출"')) {
        return {
          profile: { document_type: 'strategy_memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'working_draft', source_confidence: 0.7 },
          core_question: '핵심 질문', main_claims: [{ text: 'c', status: 'weak', unit_ids: [uid], rationale: 'r' }],
          assumptions: [{ text: 'a', unit_ids: [uid], if_false: 'x' }], decision_points: [{ text: 'd', human_only: true, unit_ids: [uid] }],
          evidence_items: [], tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [],
        } as T;
      }
      if (args.system.includes('렌즈다')) {
        return { findings: findingTitles.map((t) => ({ title: t, detail: 'd', severity: 'caution', confidence: 'medium', suggested_action: 's', unit_ids: [uid] })) } as T;
      }
      if (args.system.includes('"종합"')) {
        return {
          core_question: '핵심 질문', current_heading: '확인 뒤 정하세요',
          judgment_obligations: [{ statement: '우선순위 결정', owner: '사용자', why_human: 'x', evidence_needed: 'y', unit_ids: [uid] }],
          followups: [{ predicate: '2주 내 지표 상승', pass_condition: '+5%', fail_condition: '변화없음', check_by: '2027-01-01' }],
        } as T;
      }
      return {} as T;
    },
  };
}

async function reviewInto(text: string, titles?: string[]): Promise<JudgmentReceipt> {
  const artifact = ingest({ source_kind: 'markdown', text });
  const { receipt } = await runDocumentReview(artifact, { llm: mock(artifact, titles), today: '2026-07-01' });
  return receipt!;
}

beforeEach(() => useReviewStore.setState({ receipts: [], loaded: true, synced: true }));

describe('review lifecycle simulation — a full session', () => {
  it('drives review → own → seal → settle and lands each state', async () => {
    const s = useReviewStore.getState();
    const r = await reviewInto('# 전략\n\n온보딩을 리빌드한다\n\n## 근거\n- 낮은 retention');
    s.saveReceipt(r);
    expect(useReviewStore.getState().getReceipt(r.receipt_id)!.state).toBe('reviewed');

    // own an obligation
    const obl = r.judgment_obligations[0];
    s.setObligationOwned(r.receipt_id, obl.obligation_id, true);
    expect(useReviewStore.getState().getReceipt(r.receipt_id)!.state).toBe('owned');

    // seal with user-owned lean + assumption
    const fu = r.falsifiable_followups[0];
    s.sealFollowup(r.receipt_id, fu.followup_id, { predicate: '내 말로 쓴 예측', lean: '지금이 맞다', key_assumption: '온보딩이 원인', pass_condition: 'p', fail_condition: 'f', check_by: '2027-02-01' });
    let cur = useReviewStore.getState().getReceipt(r.receipt_id)!;
    expect(cur.state).toBe('sealed');
    expect(cur.falsifiable_followups[0].predicate_owner).toBe('user');
    expect(cur.falsifiable_followups[0].lean).toBe('지금이 맞다');

    // settle with a learning
    s.settleFollowup(r.receipt_id, fu.followup_id, 'partial', '절반만', '데이터부터 볼 것');
    cur = useReviewStore.getState().getReceipt(r.receipt_id)!;
    expect(cur.state).toBe('settled');
    expect(cur.falsifiable_followups[0].learned).toBe('데이터부터 볼 것');
  });

  it('revise pushes the date without settling, and keeps it out of "due"', async () => {
    const s = useReviewStore.getState();
    const r = await reviewInto('# 전략\n본문');
    s.saveReceipt(r);
    const fu = r.falsifiable_followups[0];
    s.sealFollowup(r.receipt_id, fu.followup_id, { predicate: 'p', pass_condition: 'a', fail_condition: 'b', check_by: '2026-06-20' });
    // past-due before revise
    expect(summarizeReceipt(useReviewStore.getState().getReceipt(r.receipt_id)!, '2026-07-01').derived).toBe('due');
    // revise into the future
    s.reviseFollowup(r.receipt_id, fu.followup_id, '2026-09-01');
    const after = useReviewStore.getState().getReceipt(r.receipt_id)!;
    expect(after.falsifiable_followups[0].revise_count).toBe(1);
    expect(summarizeReceipt(after, '2026-07-01').derived).toBe('sealed'); // no longer due
    expect(after.state).toBe('sealed'); // not settled
  });

  it('Active Course sorts due → sealed → reviewed → settled across a mixed session', async () => {
    const s = useReviewStore.getState();
    // reviewed only
    const a = await reviewInto('# A\n본문');
    s.saveReceipt(a);
    // sealed, due (past)
    const b = await reviewInto('# B\n본문');
    s.saveReceipt(b);
    s.sealFollowup(b.receipt_id, b.falsifiable_followups[0].followup_id, { predicate: 'p', pass_condition: '', fail_condition: '', check_by: '2026-06-01' });
    // sealed, future
    const c = await reviewInto('# C\n본문');
    s.saveReceipt(c);
    s.sealFollowup(c.receipt_id, c.falsifiable_followups[0].followup_id, { predicate: 'p', pass_condition: '', fail_condition: '', check_by: '2026-12-01' });
    // settled
    const d = await reviewInto('# D\n본문');
    s.saveReceipt(d);
    s.sealFollowup(d.receipt_id, d.falsifiable_followups[0].followup_id, { predicate: 'p', pass_condition: '', fail_condition: '', check_by: '2026-06-01' });
    s.settleFollowup(d.receipt_id, d.falsifiable_followups[0].followup_id, 'happened', 'done');

    const order = sortByUrgency(useReviewStore.getState().receipts, '2026-07-01').map((r) => summarizeReceipt(r, '2026-07-01').derived);
    expect(order[0]).toBe('due');
    expect(order[order.length - 1]).toBe('settled');
    // sealed(future) and reviewed sit in the middle, sealed before reviewed
    expect(order.indexOf('sealed')).toBeLessThan(order.indexOf('reviewed'));
  });

  it('re-reviewing the same source diffs cleanly (resolved vs newly-found)', async () => {
    const v1 = await reviewInto('# 전략\n본문', ['A 근거 약함', 'B 가정 위험']);
    const v2 = await reviewInto('# 전략\n본문', ['B 가정 위험', 'C 새 리스크']);
    expect(v1.source_fingerprint).toBe(v2.source_fingerprint); // same doc → linkable
    const d = diffReceipts(v1, v2);
    expect(d.resolved).toContain('A 근거 약함');
    expect(d.added).toContain('C 새 리스크');
  });
});
