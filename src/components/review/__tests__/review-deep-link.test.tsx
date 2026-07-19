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
vi.mock('@/lib/review/extract-file', () => ({ extractFile: vi.fn() }));
vi.mock('@/lib/review', () => ({
  DEFAULT_BUDGET: {},
  ingest: vi.fn(),
  runDocumentReview: vi.fn(),
  diffReceipts: vi.fn(),
}));
vi.mock('@/components/review/ReceiptView', () => ({
  ReceiptView: ({ receipt }: { receipt: { receipt_id: string } }) => createElement('div', { 'data-testid': 'receipt-view' }, receipt.receipt_id),
}));
vi.mock('@/components/review/ReceiptList', () => ({ ReceiptList: () => createElement('div', null, 'receipt-list') }));
vi.mock('@/components/review/PremiseTracker', () => ({
  PremiseTracker: () => createElement('div', { id: 'premise-premise-cloud', tabIndex: -1 }, 'cloud premise'),
}));
vi.mock('@/components/review/SourceEvidencePane', () => ({
  SourceEvidencePane: () => null,
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
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  mocks.reviewState.receipts = [];
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
});
