// @vitest-environment jsdom
/**
 * SharedGroundCard — renders the shared-ground event when real, and NOTHING
 * on a flat day (the restraint default). Copy stays fact+handle: baseline →
 * current with source, counts only, the "yours to revisit" handle.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { JudgmentReceipt } from '@/lib/review';
import type { PremiseState } from '@/lib/premises-core';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { SharedGroundCard } from '@/components/review/SharedGroundCard';
import { useReviewStore } from '@/stores/useReviewStore';

let seq = 0;
function premise(text: string, over: Partial<PremiseState> = {}): PremiseState {
  seq += 1;
  return {
    premise_id: `p_${seq}`,
    ordinal: seq,
    kind: 'premise',
    text,
    external: true,
    load_bearing: true,
    source: 'user_stated',
    status: 'active',
    amend_history: [],
    recheck_count: 0,
    ...over,
  };
}

function receipt(id: string, title: string, premises: PremiseState[]): JudgmentReceipt {
  return {
    receipt_id: id,
    root_mode: 'review',
    state: 'sealed',
    artifact_id: `a_${id}`,
    source_kind: 'pasted_text',
    source_title: title,
    source_fingerprint: `fp_${id}`,
    core_question: 'q',
    judgment_obligations: [],
    claim_ledger: [],
    hidden_assumptions: [],
    forks: [],
    findings: [],
    current_heading: '',
    falsifiable_followups: [
      {
        followup_id: `f_${id}`,
        predicate: `${title}의 예측`,
        predicate_owner: 'user',
        pass_condition: 'a',
        fail_condition: 'b',
        check_by: '2099-08-01',
        sealed_at: '2026-07-01T00:00:00Z',
      },
    ],
    companion_thread: [],
    tracked_premises: premises,
    provenance: { model: 't', lens_version: 'v', prompt_fingerprint: 'pf', reviewed_at: 'now' },
    created_at: 'now',
    updated_at: 'now',
  } as JudgmentReceipt;
}

const GROUND = '귀환 알림 도달률이 99% 수준을 유지한다';
const DRIFTED = () =>
  premise(GROUND, {
    last_recheck: {
      finding: '도달률 67%',
      numeric_value: 67,
      baseline_finding: '도달률 99%',
      baseline_numeric_value: 99,
      drifted: true,
      baseline_only: false,
      source: 'url',
      source_detail: 'send-log (07-18)',
      ts: '2026-07-18T00:00:00Z',
    },
  });

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount() {
  act(() => root.render(createElement(SharedGroundCard)));
}

describe('SharedGroundCard', () => {
  it('renders the event: headline count, ground quote, baseline → current, source, both bets, the handle', () => {
    useReviewStore.setState({
      receipts: [receipt('r1', '공개 결정', [DRIFTED()]), receipt('r2', '재유입 결정', [premise(GROUND)])],
    });
    mount();
    const t = container.textContent ?? '';
    expect(t).toContain('전제 하나가 움직였어요');
    expect(t).toContain('살아있는 판단 2개');
    expect(t).toContain(GROUND);
    expect(t).toContain('99');
    expect(t).toContain('67');
    expect(t).toContain('send-log (07-18)');
    expect(t).toContain('공개 결정의 예측');
    expect(t).toContain('재유입 결정의 예측');
    expect(t).toContain('다시 볼지는 당신 몫이에요');
    // spine: never a % of correctness, never advice vocabulary
    expect(t).not.toMatch(/권장|추천|점수|등급|놓치지/);
  });

  it('renders NOTHING when the shared ground has not drifted (flat day = silence)', () => {
    useReviewStore.setState({
      receipts: [receipt('r1', 'a', [premise(GROUND)]), receipt('r2', 'b', [premise(GROUND)])],
    });
    mount();
    expect((container.textContent ?? '').trim()).toBe('');
  });

  it('renders NOTHING when drift exists on a single-receipt (non-shared) ground', () => {
    useReviewStore.setState({
      receipts: [receipt('r1', 'a', [DRIFTED()]), receipt('r2', 'b', [premise('무관한 전제')])],
    });
    mount();
    expect((container.textContent ?? '').trim()).toBe('');
  });
});
