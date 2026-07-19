// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  reviewState: {
    receipts: [] as Array<Record<string, unknown>>,
    loaded: true,
    synced: false,
    load: vi.fn(),
    markObligationSealed: vi.fn(),
    settleFollowup: vi.fn(),
    reviseFollowup: vi.fn(),
  },
  extractFile: vi.fn(),
  ingest: vi.fn(),
}));

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/stores/useReviewStore', () => {
  const useReviewStore = () => mocks.reviewState;
  useReviewStore.getState = () => mocks.reviewState;
  return { useReviewStore };
});
vi.mock('@/stores/useSettingsStore', () => {
  const useSettingsStore = (selector: (state: { settings: Record<string, unknown> }) => unknown) => selector({ settings: {} });
  useSettingsStore.getState = () => ({ loadSettings: vi.fn() });
  return { useSettingsStore, hasOwnApiKey: () => true };
});
vi.mock('@/lib/storage', () => ({
  STORAGE_KEYS: { REVIEW_FREE_USED: 'review-free-used' },
  getStorage: () => false,
  setStorage: vi.fn(),
}));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/llm', () => ({ visionCapable: () => false }));
vi.mock('@/lib/review-seal', () => ({ sealReviewObligation: vi.fn() }));
vi.mock('@/lib/review/extract-file', () => ({ extractFile: mocks.extractFile }));
vi.mock('@/lib/review', () => ({
  DEFAULT_BUDGET: {},
  ingest: mocks.ingest,
  runDocumentReview: vi.fn(),
  diffReceipts: vi.fn(),
}));
vi.mock('@/components/review/ReceiptView', () => ({
  ReceiptView: ({ receipt, onReReview }: { receipt: { receipt_id: string }; onReReview?: () => void }) => createElement('div', null,
    createElement('div', { 'data-testid': 'receipt-view' }, receipt.receipt_id),
    createElement('button', { type: 'button', onClick: onReReview }, '다시 검수'),
  ),
}));
vi.mock('@/components/review/ReceiptList', () => ({ ReceiptList: () => createElement('div', null, 'receipt-list') }));
vi.mock('@/components/review/PremiseTracker', () => ({
  PremiseTracker: () => createElement('div', { id: 'premise-premise-cloud', tabIndex: -1 }, 'cloud premise'),
}));
vi.mock('@/components/review/SourceEvidencePane', () => ({
  SourceEvidencePane: () => createElement('div', { 'data-testid': 'source-pane' }, 'source pane'),
  countEvidenceByPage: () => ({}),
}));
vi.mock('@/components/review/SealModal', () => ({ SealModal: () => null }));
vi.mock('@/components/review/SettleModal', () => ({ SettleModal: () => null }));
vi.mock('@/components/workspace/progressive/SealStamp', () => ({ SealStamp: () => null }));

import { ReviewFlow } from '@/components/review/ReviewFlow';

const cloudReceipt = {
  receipt_id: 'receipt-cloud',
  state: 'reviewed',
  source_kind: 'paste',
  source_title: 'cloud review',
  source_fingerprint: 'fp-cloud',
  findings: [],
  judgment_obligations: [],
  claim_ledger: [],
  hidden_assumptions: [],
  forks: [],
  falsifiable_followups: [],
  source_text: '이번 분기 예산 승인안을 다시 검수할 수 있도록 충분히 긴 원문입니다.',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  mocks.reviewState.receipts = [];
  mocks.extractFile.mockReset();
  mocks.ingest.mockReset();
  window.history.replaceState(null, '', '/ko/tools/review?receipt=receipt-cloud&premise=premise-cloud');
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('ReviewFlow deep links', () => {
  it('opens and focuses a receipt premise even when cloud merge arrives after mount', () => {
    act(() => root.render(createElement(ReviewFlow)));
    expect(container.querySelector('[data-testid="receipt-view"]')).toBeNull();

    mocks.reviewState.receipts = [cloudReceipt];
    act(() => root.render(createElement(ReviewFlow)));
    act(() => vi.runAllTimers());

    expect(container.querySelector('[data-testid="receipt-view"]')?.textContent).toBe('receipt-cloud');
    expect(document.activeElement?.id).toBe('premise-premise-cloud');
    expect(document.getElementById('premise-premise-cloud')?.scrollIntoView).toHaveBeenCalled();
  });

  it('restores the receipt source when starting a re-review', () => {
    mocks.reviewState.receipts = [cloudReceipt];
    act(() => root.render(createElement(ReviewFlow)));
    act(() => vi.runAllTimers());

    const reReview = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '다시 검수')!;
    act(() => reReview.click());

    const source = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(source.value).toBe(cloudReceipt.source_text);
  });

  it('reconnects only a source whose fingerprint matches the saved PDF receipt', async () => {
    const pdfReceipt = { ...cloudReceipt, source_kind: 'pdf', source_text: undefined, source_fingerprint: 'fp-pdf' };
    mocks.reviewState.receipts = [pdfReceipt];
    mocks.extractFile.mockResolvedValue({
      text: '검수 당시와 같은 PDF 원문입니다.',
      units: [],
      previews: [],
      pdf_data: new Uint8Array([1, 2, 3]),
      pages_total: 2,
      quality: 'high',
    });
    mocks.ingest.mockReturnValue({ source_fingerprint: 'fp-pdf' });
    act(() => root.render(createElement(ReviewFlow)));

    const input = container.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['pdf'], 'cloud review.pdf', { type: 'application/pdf' })] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="source-pane"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();

    mocks.extractFile.mockResolvedValue({ text: '전혀 다른 PDF 원문입니다.', units: [], quality: 'high' });
    mocks.ingest.mockReturnValue({ source_fingerprint: 'other-fingerprint' });
    const reconnect = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('원문 다시 연결'));
    expect(reconnect).toBeUndefined();
  });

  it('rejects a different PDF instead of attaching it to the receipt', async () => {
    const pdfReceipt = { ...cloudReceipt, source_kind: 'pdf', source_text: undefined, source_fingerprint: 'fp-pdf' };
    mocks.reviewState.receipts = [pdfReceipt];
    mocks.extractFile.mockResolvedValue({ text: '전혀 다른 PDF 원문입니다.', units: [], quality: 'high' });
    mocks.ingest.mockReturnValue({ source_fingerprint: 'other-fingerprint' });
    act(() => root.render(createElement(ReviewFlow)));

    const input = container.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['pdf'], 'different.pdf', { type: 'application/pdf' })] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="source-pane"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('내용이 달라요');
  });
});
