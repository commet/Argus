import { describe, it, expect, beforeEach, vi } from 'vitest';

// The store persists to Supabase via review-sync (which pulls in the supabase
// client). Stub it so this stays a pure store-logic unit test — anon users hit
// the same no-op path in production.
vi.mock('@/lib/review-sync', () => ({
  loadReceiptsMerged: vi.fn((local: unknown) => Promise.resolve(local)),
  pushReceipt: vi.fn(),
  deleteReceiptRemote: vi.fn(),
}));

import { useReviewStore } from '../useReviewStore';
import { ingest, runDocumentReview, type JudgmentReceipt } from '@/lib/review';
import { type ReviewLLM, type ReviewLLMArgs } from '@/lib/review';

const DOC = '# 전략\n\n온보딩을 리빌드한다.\n\n## 근거\n\n- retention이 낮다';

function mock(artifactUnitId: string): ReviewLLM {
  return {
    model_name: 'mock', model_provider: 'local',
    async json<T>(args: ReviewLLMArgs): Promise<T> {
      if (args.system.includes('"추출"')) {
        return { profile: { document_type: 'strategy_memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'working_draft', source_confidence: 0.7 },
          core_question: 'q', main_claims: [{ text: 'c', status: 'weak', unit_ids: [artifactUnitId], rationale: 'r' }],
          assumptions: [], decision_points: [{ text: '착수할지', human_only: true, unit_ids: [artifactUnitId] }],
          evidence_items: [], tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [] } as T;
      }
      if (args.system.includes('렌즈다')) return { findings: [] } as T;
      if (args.system.includes('"종합"')) {
        return { core_question: 'q', current_heading: 'h',
          judgment_obligations: [{ statement: '우선순위인가', owner: '사용자', why_human: 'x', evidence_needed: 'y', unit_ids: [artifactUnitId] }],
          followups: [{ predicate: '2주 안에 데이터 확보', pass_condition: '확보', fail_condition: '없음', check_by: '2027-01-01' }] } as T;
      }
      return {} as T;
    },
  };
}

async function makeReceipt(): Promise<JudgmentReceipt> {
  const artifact = ingest({ source_kind: 'markdown', text: DOC });
  const { receipt } = await runDocumentReview(artifact, { llm: mock(artifact.units[0].unit_id), today: '2026-07-01' });
  return receipt!;
}

beforeEach(() => {
  useReviewStore.setState({ receipts: [], loaded: false, synced: false });
});

describe('useReviewStore', () => {
  it('saves a receipt and reads it back by id', async () => {
    const r = await makeReceipt();
    useReviewStore.getState().saveReceipt(r);
    expect(useReviewStore.getState().getReceipt(r.receipt_id)?.receipt_id).toBe(r.receipt_id);
  });

  it('owning an obligation flips it and moves state reviewed→owned', async () => {
    const r = await makeReceipt();
    const s = useReviewStore.getState();
    s.saveReceipt(r);
    const oblId = r.judgment_obligations[0].obligation_id;
    s.setObligationOwned(r.receipt_id, oblId, true);
    const after = useReviewStore.getState().getReceipt(r.receipt_id)!;
    expect(after.judgment_obligations[0].owned_by_user).toBe(true);
    expect(after.state).toBe('owned');
  });

  it('sealing a follow-up makes the user own it and moves state to sealed', async () => {
    const r = await makeReceipt();
    const s = useReviewStore.getState();
    s.saveReceipt(r);
    const fu = r.falsifiable_followups[0];
    expect(fu.predicate_owner).toBe('ai_surfaced'); // drafted before seal
    s.sealFollowup(r.receipt_id, fu.followup_id, {
      predicate: '내 말로 다시 쓴 예측', pass_condition: 'p', fail_condition: 'f', check_by: '2027-02-01',
    });
    const after = useReviewStore.getState().getReceipt(r.receipt_id)!;
    const sealed = after.falsifiable_followups[0];
    expect(after.state).toBe('sealed');
    expect(sealed.predicate_owner).toBe('user'); // honest authorship transfer
    expect(sealed.predicate).toBe('내 말로 다시 쓴 예측');
    expect(sealed.sealed_at).toBeTruthy();
  });

  it('settling a sealed follow-up records reality and moves state to settled', async () => {
    const r = await makeReceipt();
    const s = useReviewStore.getState();
    s.saveReceipt(r);
    const fuId = r.falsifiable_followups[0].followup_id;
    s.sealFollowup(r.receipt_id, fuId, { predicate: 'p', pass_condition: 'a', fail_condition: 'b', check_by: '2027-02-01' });
    s.settleFollowup(r.receipt_id, fuId, 'partial', '절반만 확보됨');
    const after = useReviewStore.getState().getReceipt(r.receipt_id)!;
    const f = after.falsifiable_followups[0];
    expect(after.state).toBe('settled');
    expect(f.outcome).toBe('partial');
    expect(f.what_happened).toBe('절반만 확보됨');
    expect(f.settled_at).toBeTruthy();
  });
});
