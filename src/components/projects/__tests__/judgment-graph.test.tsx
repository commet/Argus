// @vitest-environment jsdom

/**
 * JudgmentGraph guard — the portfolio bipartite map (BLUEPRINT §9.9 V2).
 *
 * Why this exists: the visualization had NO test, so a broken render wire —
 * origin tag gone, recency gone, focus mode dead, restraint gate inverted —
 * would degrade SILENTLY (CLAUDE.md LLM-glue invariant). This pins the loud
 * failures: what must render, what must NOT, and the spine (facts only).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { JudgmentReceipt, SourceKind } from '@/lib/review';
import type { PremiseState } from '@/lib/premises-core';
import { JudgmentGraph } from '@/components/projects/JudgmentGraph';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let seq = 0;
function premise(text: string, over: Partial<PremiseState> = {}): PremiseState {
  seq += 1;
  return {
    premise_id: `p_${seq}`, ordinal: seq, kind: 'premise', text, external: true,
    load_bearing: true, source: 'user_stated', status: 'active', amend_history: [], recheck_count: 0, ...over,
  };
}
function receipt(id: string, title: string, premises: PremiseState[], sourceKind: SourceKind = 'paste', over: Partial<JudgmentReceipt> = {}): JudgmentReceipt {
  return {
    receipt_id: id, root_mode: 'review', state: 'sealed', artifact_id: `a_${id}`, source_kind: sourceKind,
    source_title: title, source_fingerprint: `fp_${id}`, core_question: 'q', judgment_obligations: [],
    claim_ledger: [], hidden_assumptions: [], forks: [], findings: [], current_heading: '',
    falsifiable_followups: [{ followup_id: `f_${id}`, predicate: `${title} 예상대로 된다`, predicate_owner: 'user', pass_condition: 'a', fail_condition: 'b', check_by: '2026-08-01', sealed_at: '2026-07-01T00:00:00Z' }],
    companion_thread: [], tracked_premises: premises,
    provenance: { model: 't', lens_version: 'v', prompt_fingerprint: 'pf', reviewed_at: 'now' },
    created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-20T00:00:00Z', ...over,
  } as JudgmentReceipt;
}

const RETENTION = '귀환 알림 도달률이 99% 수준을 유지한다';
const CAC = '유료 전환 CAC가 3만원 이하로 유지된다';
const RIVAL = '경쟁사 신규 진입 없음';
const drifted = (): PremiseState => premise(RETENTION, {
  last_recheck: { finding: '67%', numeric_value: 67, baseline_finding: '99%', baseline_numeric_value: 99, drifted: true, baseline_only: false, source: 'url', source_detail: 'x', ts: '2026-07-18T00:00:00Z' },
});

/** A graph WITH shared hubs: RETENTION (r1,r2) and CAC (r2,r3), varied origins. */
function sharedFixture(): JudgmentReceipt[] {
  seq = 0;
  return [
    receipt('r1', '런치 타이밍', [drifted(), premise(RIVAL)], 'mcp_file'),
    receipt('r2', '윈백 캠페인', [premise(RETENTION), premise(CAC)], 'pdf'),
    receipt('r3', '가격 재조정', [premise(CAC), premise('환불율 5% 이하')], 'pr_diff'),
  ];
}

let container: HTMLDivElement;
let root: Root;

function render(receipts: JudgmentReceipt[]) {
  act(() => {
    root.render(createElement(JudgmentGraph, { receipts, locale: 'ko' as const }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-22T00:00:00.000Z'));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('JudgmentGraph — restraint gate', () => {
  it('renders nothing when no premise is shared across ≥2 decisions', () => {
    render([receipt('r1', 'a', [premise('고유 전제 1')]), receipt('r2', 'b', [premise('고유 전제 2')])]);
    expect(container.textContent).toBe('');
  });

  it('renders the map once a ground is shared (hub exists)', () => {
    render(sharedFixture());
    expect(container.querySelector('[aria-labelledby="portfolio-map-h"]')).toBeTruthy();
    expect(container.textContent).toContain('판단 지도');
    const premiseButtons = container.querySelectorAll('button[aria-label^="전제 집중"]');
    expect(premiseButtons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('JudgmentGraph — the three V2 axes render as facts', () => {
  it('SOURCE: honest origin tags (웹 / MCP·CLI / 미상) render on decision tiles', () => {
    render(sharedFixture());
    const tags = [...container.querySelectorAll('span.font-mono')].map((s) => (s.textContent || '').trim());
    expect(tags).toContain('MCP·CLI'); // r1 = mcp_file
    expect(tags).toContain('웹'); // r2 = pdf
    expect(tags).toContain('미상'); // r3 = pr_diff → surface unknown, never guessed
  });

  it('RECENCY: the drifted hub shows "N일 전 점검" (2026-07-18 → 4일 전)', () => {
    render(sharedFixture());
    expect(container.textContent).toContain('4일 전 점검');
  });

  it('DRIFT: the moved premise shows its baseline→today delta inline', () => {
    render(sharedFixture());
    expect(container.textContent).toContain('99 → 67');
  });
});

describe('JudgmentGraph — focus mode and the shared-only filter', () => {
  it('clicking a premise enters focus mode and back returns to the whole map', () => {
    render(sharedFixture());
    const hub = [...container.querySelectorAll('button[aria-label^="전제 집중"]')].find((b) =>
      (b.getAttribute('aria-label') || '').includes(RETENTION),
    ) as HTMLButtonElement;
    expect(hub).toBeTruthy();
    act(() => hub.click());
    expect(container.textContent).toContain('전제 하나에 집중');
    const back = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('전체 지도로')) as HTMLButtonElement;
    expect(back).toBeTruthy();
    act(() => back.click());
    expect(container.textContent).toContain('전제와 결정이 서 있는 자리');
  });

  it('"공유 전제만" filter drops degree-1 leaves but keeps the hubs', () => {
    render(sharedFixture());
    expect(container.textContent).toContain(RIVAL); // a degree-1 leaf, shown by default
    const toggle = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '공유 전제만') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    act(() => toggle.click());
    expect(container.textContent).not.toContain(RIVAL); // leaf hidden
    expect(container.textContent).toContain(RETENTION); // hub kept
  });
});
