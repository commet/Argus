/**
 * Pipeline simulation — a broad, adversarial sweep of runDocumentReview against
 * many document shapes and misbehaving model outputs. The goal is to prove the
 * invariants hold under stress, not to test one happy path:
 *   - spine: no verdict language reaches the user; ownership fields are never
 *     auto-filled; the receipt never asserts a decision.
 *   - robustness: leaked unit ids scrubbed, invalid dates repaired, high-conf
 *     findings without anchors downgraded, lens failures disclosed, malformed
 *     JSON survived, budget respected.
 *   - routing: profile + concerns select the right lenses (deck / stakes / etc.).
 */

import { describe, it, expect } from 'vitest';
import {
  ingest,
  runDocumentReview,
  receiptToMarkdown,
  summarizeReceipt,
  type ReviewLLM,
  type ReviewLLMArgs,
  type CanonicalArtifact,
  type JudgmentReceipt,
} from '@/lib/review';

// ---------------------------------------------------------------------------
// Flexible mock LLM — dispatches on the SSOT prompt markers, with knobs for
// each adversarial behavior we want to simulate.
// ---------------------------------------------------------------------------

interface MockOpts {
  stakes?: 'low' | 'medium' | 'high';
  documentType?: string;
  claimStatus?: string;
  /** inject an internal unit id into user-facing prose (should be scrubbed). */
  leakUnitIdInProse?: boolean;
  /** return a high-confidence finding with NO anchors (should downgrade). */
  highConfNoAnchor?: boolean;
  /** an impossible calendar date the pipeline must repair. */
  badCheckBy?: string;
  /** lens labels (Korean) that should throw when reviewed. */
  throwLenses?: string[];
  /** return empty everything (thin doc → drives insufficient reviewability). */
  empty?: boolean;
  /** return a non-object where an array is expected (malformed). */
  malformed?: boolean;
  /** how many followups synthesis returns. */
  followupCount?: number;
}

function mockLLM(artifact: CanonicalArtifact, opts: MockOpts = {}): ReviewLLM {
  const uid = artifact.units[0]?.unit_id ?? 'u_missing';
  const uid2 = artifact.units[1]?.unit_id ?? uid;

  return {
    model_name: 'mock-sim',
    model_provider: 'local',
    async json<T>(args: ReviewLLMArgs): Promise<T> {
      const sys = args.system;

      // Stage 1 — extraction
      if (sys.includes('"추출"')) {
        if (opts.empty) {
          return { profile: baseProfile(opts), core_question: '', main_claims: [], assumptions: [], decision_points: [], evidence_items: [], tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [] } as T;
        }
        if (opts.malformed) {
          // arrays arrive as non-arrays / objects with junk — normalizers must cope
          return { profile: baseProfile(opts), core_question: '핵심 질문', main_claims: 'not-an-array', assumptions: null, decision_points: [{ text: 42 }] } as unknown as T;
        }
        return {
          profile: baseProfile(opts),
          core_question: '지금 이 방향으로 가는 게 맞는가?',
          explicit_recommendation: '리빌드를 추천',
          main_claims: [
            { text: '경쟁사도 3단계를 쓴다', status: opts.claimStatus ?? 'weak', unit_ids: [uid], rationale: '원문에 출처가 없다', evidence_needed: '경쟁사 실제 데이터', fix_suggestion: '출처를 명시' },
            { text: '이탈률이 60%다', status: 'human_check', unit_ids: [uid2], rationale: '수치 근거 불명' },
          ],
          evidence_items: [{ text: '인터뷰 피드백', unit_ids: [uid], kind: 'internal' }],
          assumptions: [{ text: '이탈 원인이 온보딩 복잡도라는 가정', unit_ids: [uid], if_false: '리빌드가 헛수고가 된다' }],
          tradeoffs: [{ text: '속도 vs 완성도', unit_ids: [uid] }],
          stakeholders: [{ role: 'CFO', likely_objection: '예산 근거가 뭐냐', unit_ids: [uid] }],
          open_questions: [{ text: '성공 지표는?', unit_ids: [uid] }],
          decision_points: [{ text: '이번 분기에 착수할지', human_only: true, unit_ids: [uid] }],
          missing_sections: [{ label: '리스크', why_it_matters: '되돌림 비용이 안 보인다' }],
        } as T;
      }

      // Stage 3 — lens review
      if (sys.includes('렌즈다')) {
        for (const label of opts.throwLenses ?? []) {
          if (sys.includes(`"${label}"`)) throw new Error(`lens ${label} exploded`);
        }
        if (opts.empty) return { findings: [] } as T;
        const proseTitle = opts.leakUnitIdInProse
          ? `${uid}의 시장규모 주장에 근거가 없다`
          : '시장규모 주장에 근거가 없다';
        return {
          findings: [
            {
              title: proseTitle,
              detail: opts.leakUnitIdInProse ? `${uid} 문단이 출처 없이 단정한다` : '출처 없이 단정한다',
              severity: 'caution',
              confidence: opts.highConfNoAnchor ? 'high' : 'medium',
              suggested_action: '경쟁사 데이터 링크를 첨부',
              unit_ids: opts.highConfNoAnchor ? [] : [uid],
            },
          ],
        } as T;
      }

      // Stage 4 — synthesis
      if (sys.includes('"종합"')) {
        const n = opts.followupCount ?? 1;
        const followups = Array.from({ length: n }, (_, i) => ({
          predicate: `2주 안에 activation이 오른다 #${i + 1}`,
          pass_condition: '+5%p',
          fail_condition: '변화 없음',
          check_by: opts.badCheckBy ?? '2027-01-01',
        }));
        return {
          core_question: '지금 리빌드가 맞는가?',
          current_heading: '아래 항목을 확인한 뒤 방향을 정하세요.',
          judgment_obligations: [
            { statement: '리빌드 우선순위를 결정', owner: '사용자', why_human: '전략 트레이드오프', evidence_needed: 'retention 데이터', unit_ids: [uid] },
          ],
          followups,
        } as T;
      }

      return {} as T;
    },
  };
}

function baseProfile(opts: MockOpts) {
  return {
    document_type: opts.documentType ?? 'strategy_memo',
    intent: 'decide',
    audience: 'executive',
    stakes: opts.stakes ?? 'high',
    artifact_maturity: 'working_draft',
    source_confidence: 0.7,
  };
}

const MEMO = `# 온보딩 리빌드 전략

## 문제
retention이 낮다. 첫 주 이탈이 60%다.

## 제안
온보딩을 3단계로 리빌드한다.

## 근거
- 경쟁사도 3단계를 쓴다
- 인터뷰에서 복잡하다는 피드백`;

const DECK = `# 시장 기회
- TAM 10조

---

# 제품
- 3단계 온보딩

---

# Ask
- 20억 투자`;

const VERDICT_WORDS = /진행하세요|하지 마세요|틀렸습니다|맞습니다|추천합니다|이 전략은 옳|이 전략은 틀/;

/** every user-facing string on the receipt (never the internal unit_ids arrays). */
function proseOf(r: JudgmentReceipt): string {
  return [
    r.core_question,
    r.current_heading,
    r.routing.disclosure,
    ...r.findings.flatMap((f) => [f.title, f.detail, f.suggested_action ?? '']),
    ...r.judgment_obligations.flatMap((o) => [o.statement, o.why_human, o.evidence_needed ?? '']),
    ...r.claim_ledger.flatMap((c) => [c.text, c.rationale, c.evidence_needed ?? '', c.fix_suggestion ?? '']),
    ...r.hidden_assumptions.flatMap((a) => [a.text, a.if_false]),
    ...r.falsifiable_followups.map((f) => f.predicate),
    receiptToMarkdown(r),
  ].join('\n');
}

async function review(artifact: CanonicalArtifact, opts: MockOpts, today = '2026-07-01'): Promise<JudgmentReceipt> {
  const { receipt } = await runDocumentReview(artifact, { llm: mockLLM(artifact, opts), today, context: { concerns: ['full_judgment_review'] } });
  if (!receipt) throw new Error('no receipt');
  return receipt;
}

// ---------------------------------------------------------------------------

describe('pipeline simulation — spine invariants', () => {
  it('a full strategy-memo review never emits verdict language', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), {});
    expect(proseOf(r)).not.toMatch(VERDICT_WORDS);
    expect(receiptToMarkdown(r)).toContain('판단은 당신의 몫');
  });

  it('never auto-fills ownership fields (followups ai_surfaced, obligations un-owned)', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), {});
    for (const f of r.falsifiable_followups) {
      expect(f.predicate_owner).toBe('ai_surfaced'); // only the user flips this at seal
      expect(f.sealed_at).toBeUndefined();
      expect(f.lean).toBeUndefined();
      expect(f.outcome).toBeUndefined();
    }
    for (const o of r.judgment_obligations) expect(o.owned_by_user).toBe(false);
  });

  it('scrubs an internal unit id the model leaked into prose', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: MEMO });
    const r = await review(artifact, { leakUnitIdInProse: true });
    expect(proseOf(r)).not.toMatch(/\bu_[0-9a-f]{4,}/i);
    // but anchors (from the unit_ids arrays) are still resolved
    expect(r.findings.some((f) => f.anchors.length > 0)).toBe(true);
  });
});

describe('pipeline simulation — robustness', () => {
  it('downgrades a high-confidence finding that has no anchor', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), { highConfNoAnchor: true });
    const f = r.findings[0];
    expect(f.anchors.length).toBe(0);
    expect(f.confidence).not.toBe('high'); // invariant enforced
  });

  it('repairs an impossible check-by date to a real future date', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), { badCheckBy: '2026-13-45' });
    const cb = r.falsifiable_followups[0].check_by;
    expect(cb).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(cb + 'T00:00:00Z').toISOString().slice(0, 10)).toBe(cb); // real calendar date
    expect(cb > '2026-07-01').toBe(true);
  });

  it('survives malformed LLM JSON without throwing, degrades gracefully', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), { malformed: true });
    expect(Array.isArray(r.claim_ledger)).toBe(true);
    expect(Array.isArray(r.hidden_assumptions)).toBe(true);
    expect(r.state === 'reviewed' || r.state === 'draft').toBe(true);
  });

  it('caps follow-ups at 3 even if the model returns more', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), { followupCount: 8 });
    expect(r.falsifiable_followups.length).toBeLessThanOrEqual(3);
  });

  it('a lens that throws is moved from selected to skipped (honest disclosure)', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: MEMO });
    const r = await review(artifact, { throwLenses: ['핵심 질문'] });
    expect(r.routing.selected).not.toContain('core_question');
    expect(r.routing.skipped.some((s) => s.id === 'core_question')).toBe(true);
  });
});

describe('pipeline simulation — routing by document shape', () => {
  it('routes the deck-narrative lens for a pptx deck', async () => {
    const artifact = ingest({ source_kind: 'pptx', text: DECK });
    expect(artifact.detected_structure.is_deck).toBe(true);
    const r = await review(artifact, { documentType: 'pitch_deck' });
    expect(r.routing.selected).toContain('deck_narrative');
    // findings/claims should carry slide anchors
    const anchored = [...r.findings, ...r.claim_ledger].some((x) => x.anchors.some((a) => a.slide !== undefined));
    expect(anchored).toBe(true);
  });

  it('high stakes pulls in the stakeholder-objection lens', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), { stakes: 'high' });
    expect(r.routing.selected).toContain('stakeholder_objection');
  });

  it('always runs the base spine lenses', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), {});
    for (const base of ['core_question', 'claim_evidence', 'hidden_assumption', 'human_judgment']) {
      const ran = r.routing.selected.includes(base as never);
      const skippedForBudget = r.routing.skipped.find((s) => s.id === base);
      expect(ran || !!skippedForBudget).toBe(true);
    }
  });
});

describe('pipeline simulation — failure states', () => {
  it('an unsupported binary (no text) returns needs_context, not a fake receipt', async () => {
    const artifact = ingest({ source_kind: 'pdf' }); // no text, no pre_extracted
    const { job, receipt } = await runDocumentReview(artifact, { llm: mockLLM(artifact), today: '2026-07-01' });
    expect(job.status).toBe('needs_context');
    expect(receipt).toBeUndefined();
    expect(job.error?.kind).toBe('unsupported_format');
  });

  it('an empty-content doc scores no better than caveated, and goes draft when insufficient', async () => {
    // valid text but no decision / no evidence → the MAP-driven half of the
    // score collapses (decision_clarity + evidence_availability), capping it.
    const artifact = ingest({ source_kind: 'txt', text: 'x\n\ny\n\nz' });
    const r = await review(artifact, { empty: true });
    expect(r.reviewability.score).toBeLessThanOrEqual(60); // never "normal" (80+)
    expect(r.reviewability.evidence_availability).toBe(0);
    // the insufficient band is what flips the receipt to a "what's missing" draft
    if (r.reviewability.score < 40) expect(r.state).toBe('draft');
  });
});

describe('pipeline simulation — version drift + status projection', () => {
  it('re-reviewing the same source produces a stable fingerprint (drift can link)', async () => {
    const a1 = ingest({ source_kind: 'markdown', text: MEMO });
    const a2 = ingest({ source_kind: 'markdown', text: MEMO });
    expect(a1.source_fingerprint).toBe(a2.source_fingerprint); // deterministic
  });

  it('status projection: a sealed future prediction reads as sealed, a past one as due', async () => {
    const r = await review(ingest({ source_kind: 'markdown', text: MEMO }), {});
    const fu = r.falsifiable_followups[0];
    // simulate a seal in the past-due and future cases
    const dueReceipt = { ...r, state: 'sealed' as const, falsifiable_followups: [{ ...fu, sealed_at: '2026-07-01T00:00:00Z', check_by: '2026-06-20' }] };
    const futureReceipt = { ...r, state: 'sealed' as const, falsifiable_followups: [{ ...fu, sealed_at: '2026-07-01T00:00:00Z', check_by: '2026-08-20' }] };
    expect(summarizeReceipt(dueReceipt, '2026-07-01').derived).toBe('due');
    expect(summarizeReceipt(futureReceipt, '2026-07-01').derived).toBe('sealed');
  });
});
