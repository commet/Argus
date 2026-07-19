// @vitest-environment jsdom
/**
 * ReceiptView scannability — real jsdom render. Proves the default view is
 * scannable: a finding shows only its title line (detail hidden until tapped),
 * and an obligation shows its decision + own button (why/evidence hidden until
 * "왜 사람인가" is tapped).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: null, session: null, loading: false, signOut: () => {} }) }));

import { ReceiptView } from '@/components/review/ReceiptView';
import type { JudgmentReceipt } from '@/lib/review';

const RECEIPT = {
  receipt_id: 'r1', root_mode: 'review', state: 'reviewed',
  source_title: '보고서.pdf', source_kind: 'pdf', source_fingerprint: 'fp',
  coverage: { band: 'full', units_total: 40, units_reviewed: 40, pages_total: 8, pages_read: 8, notes: [] },
  reviewability: { score: 82, extraction: 100, structure: 80, decision_clarity: 70, evidence_availability: 70, anchor_coverage: 100, reasons: [] },
  routing: { selected: ['claim_evidence'], skipped: [], disclosure: '적용한 검수 렌즈: 주장-근거.' },
  profile: { document_type: 'strategy_memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'final', source_confidence: 0.7, inferred: { document_type: true, intent: true, audience: true, stakes: true } },
  core_question: '예산을 지금 승인할 것인가?',
  current_heading: '근거가 빈 주장이 있습니다.',
  judgment_obligations: [{ obligation_id: 'o1', statement: '예산 5억을 ROI 근거 없이 승인할지 결정', owner: '사용자', why_human: '재무 리스크는 사람이 감수', evidence_needed: '정량 ROI', anchors: [{ page: 6, section_path: ['6. 예산'] }], owned_by_user: false }],
  claim_ledger: [], hidden_assumptions: [], forks: [],
  findings: [{ finding_id: 'f1', lens_id: 'claim_evidence', title: '예산 ROI 근거 없음', detail: '투자 대비 효과가 정성 서술로만 갈음됨', severity: 'critical', confidence: 'high', suggested_action: '정량 ROI 제시', anchors: [{ page: 6, section_path: ['6. 예산'] }], provenance: 'ai_surfaced' }],
  falsifiable_followups: [], companion_thread: [],
  provenance: { schema_version: '1', extraction_tool: 't', extraction_version: '1', lens_versions: {}, model_provider: 'local', model_name: 'm', prompt_hash: 'h', created_at: '2026-07-15T00:00:00Z' },
  created_at: '2026-07-15T00:00:00Z', updated_at: '2026-07-15T00:00:00Z',
} as unknown as JudgmentReceipt;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

function clickButtonContaining(text: string) {
  const btn = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes(text));
  if (!btn) throw new Error(`button containing "${text}" not found`);
  act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('ReceiptView — scannable by default', () => {
  it('hides finding detail until the finding is tapped', () => {
    act(() => { root.render(createElement(ReceiptView, { receipt: RECEIPT })); });
    // title visible, detail hidden
    expect(container.textContent).toContain('예산 ROI 근거 없음');
    expect(container.textContent).not.toContain('정성 서술로만 갈음됨');
    // tap the finding → detail appears
    clickButtonContaining('예산 ROI 근거 없음');
    expect(container.textContent).toContain('정성 서술로만 갈음됨');
  });

  it('shows the obligation decision + own button, hides why/evidence until tapped', () => {
    act(() => { root.render(createElement(ReceiptView, { receipt: RECEIPT })); });
    expect(container.textContent).toContain('예산 5억을 ROI 근거 없이 승인할지 결정');
    expect(container.textContent).toContain('내 판단으로 기록하기');
    expect(container.textContent).not.toContain('재무 리스크는 사람이 감수');
    clickButtonContaining('왜 사람인가');
    expect(container.textContent).toContain('재무 리스크는 사람이 감수');
  });

  it('keeps findings synchronized with the visible source page', () => {
    act(() => { root.render(createElement(ReceiptView, { receipt: RECEIPT, activeSourcePage: 6, onAnchorSelect: vi.fn() })); });
    expect(container.querySelectorAll('[aria-current="location"]')).toHaveLength(1);

    act(() => { root.render(createElement(ReceiptView, { receipt: RECEIPT, activeSourcePage: 2, onAnchorSelect: vi.fn() })); });
    expect(container.querySelectorAll('[aria-current="location"]')).toHaveLength(0);
  });

  it('sends the exact source anchor when a finding is opened', () => {
    const onAnchorSelect = vi.fn();
    act(() => { root.render(createElement(ReceiptView, { receipt: RECEIPT, onAnchorSelect })); });
    clickButtonContaining('예산 ROI 근거 없음');
    expect(onAnchorSelect).toHaveBeenCalledWith(expect.objectContaining({
      page: 6,
      section_path: ['6. 예산'],
    }));
  });

  it('drops the redundant anchor tag on a single-image finding (never "1쪽")', () => {
    // The vision pass anchors a single-image finding to page 1. There is only one
    // image, so "(이미지)" on every line just repeats — render NO tag, and never
    // the awkward "1쪽" (which implies a paginated document).
    const imgReceipt = {
      ...RECEIPT,
      source_kind: 'image',
      source_title: 'chart.png',
      judgment_obligations: [],
      findings: [{ finding_id: 'fi', lens_id: 'claim_evidence', title: '차트 급증에 출처 없음', detail: 'd', severity: 'caution', confidence: 'medium', anchors: [{ page: 1 }], provenance: 'ai_surfaced' }],
    } as unknown as JudgmentReceipt;
    act(() => { root.render(createElement(ReceiptView, { receipt: imgReceipt })); });
    expect(container.textContent).toContain('차트 급증에 출처 없음'); // finding still shows
    expect(container.textContent).not.toContain('1쪽');
    expect(container.textContent).not.toContain('(이미지)'); // no redundant single-image tag
  });

  it('keeps a numbered tag when a finding sits on a later image ("이미지 2")', () => {
    const imgReceipt = {
      ...RECEIPT,
      source_kind: 'image',
      source_title: 'shots.png',
      judgment_obligations: [],
      findings: [{ finding_id: 'fi2', lens_id: 'claim_evidence', title: '두 번째 이미지의 수치 불일치', detail: 'd', severity: 'caution', confidence: 'medium', anchors: [{ page: 2 }], provenance: 'ai_surfaced' }],
    } as unknown as JudgmentReceipt;
    act(() => { root.render(createElement(ReceiptView, { receipt: imgReceipt })); });
    expect(container.textContent).toContain('이미지 2');
    expect(container.textContent).not.toContain('2쪽');
  });
});
