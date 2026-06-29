// @vitest-environment jsdom
/**
 * MirrorBeat (North-Star B) — the recognition moment at the FRONT of the voyage.
 *
 * The 2026-06-29 "pure recognition" redesign (ProgressiveFlow.tsx) deliberately
 * dropped two things this test used to assert, and the test was not updated with
 * it (it lagged the component by 6 days). Per the component's own docstring:
 *   - the "맞나요?" QUESTION form was removed — it "expected a reply the card gave
 *     nowhere to make"; the card now hands control back ("correct it below").
 *   - the explicit dismiss button / onDismiss was removed — answering below
 *     dismisses it, so the card carries no buttons at all.
 *
 * This proves the CURRENT spine-aligned shape: it names ONE AI-filled premise
 * with honest provenance and returns the handle — neutral recognition, never a
 * question, a directional verdict, or a two-pole fork.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// MirrorBeat lives in ProgressiveFlow.tsx, whose import graph touches the
// Supabase client + several heavy modules at load. Stub the same surface the
// sibling flow-interactions test does so the module imports under jsdom.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) }, channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })), removeChannel: vi.fn() },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/lib/agent-stats', () => ({ getAgentStats: () => null, getSessionDeltas: () => [] }));
vi.mock('@/components/workspace/progressive/WorkerAvatar', () => ({ WorkerAvatar: () => null, AvatarRow: () => null }));
vi.mock('@/components/ui/ShareBar', () => ({ ShareBar: () => null }));
vi.mock('@/lib/export', () => ({ voyageLogToMarkdown: () => 'LOGSTUB' }));
vi.mock('@/stores/useProgressiveStore', () => ({ useProgressiveStore: (sel: (s: unknown) => unknown) => sel({ sessions: [] }) }));

import { MirrorBeat } from '@/components/workspace/progressive/ProgressiveFlow';

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

describe('MirrorBeat — front-of-voyage recognition (North-Star B)', () => {
  it('names the AI-filled premise with honest provenance and hands control back', () => {
    act(() => root.render(createElement(MirrorBeat, { assumption: '이탈은 가격 때문이다' })));
    const text = container.textContent || '';
    // The surfaced premise itself.
    expect(text).toContain('이탈은 가격 때문이다');
    // Honest provenance — marked as the machine's read, not the user's words.
    expect(text).toContain('AI가 채운 전제');
    // Hands control back — recognition that returns the handle, not a verdict.
    expect(text).toContain('바로잡으면');
  });

  it('is neutral recognition — no question, no verdict, no fork, no buttons', () => {
    act(() => root.render(createElement(MirrorBeat, { assumption: '챗봇이 이탈을 막는다' })));
    const text = container.textContent || '';
    // The "맞나요?" question form was deliberately removed (it asked for a reply
    // the card had nowhere to capture).
    expect(text).not.toContain('맞나요');
    // No directional verdict / weighted pole creeping into the copy.
    expect(text).not.toContain('가장 위험');
    // Pure recognition is non-blocking with NO controls — answering below
    // dismisses it, so the card renders no buttons.
    expect(container.querySelectorAll('button').length).toBe(0);
  });
});
