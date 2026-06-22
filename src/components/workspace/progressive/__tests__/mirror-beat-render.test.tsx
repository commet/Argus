// @vitest-environment jsdom
/**
 * MirrorBeat (North-Star B) — the recognition moment moved to the FRONT of the
 * voyage. Proves the spine-critical shape: it surfaces the AI-filled premise,
 * frames the crux as a NEUTRAL QUESTION (never a directional verdict), tags
 * provenance honestly (AI-filled, not the user's words), and is non-blocking —
 * the dismiss fires onDismiss so the user keeps answering below.
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

const click = (el: Element | null | undefined) =>
  act(() => el?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const byText = (text: string): HTMLElement | undefined =>
  (Array.from(container.querySelectorAll('button')) as HTMLElement[])
    .find(e => (e.textContent || '').includes(text));

describe('MirrorBeat — front-of-voyage recognition (North-Star B)', () => {
  it('surfaces the AI-filled premise with honest provenance and a neutral crux question', () => {
    act(() => root.render(createElement(MirrorBeat, {
      assumption: '이탈은 가격 때문이다',
      onDismiss: vi.fn(),
    })));
    const text = container.textContent || '';
    // The surfaced premise itself.
    expect(text).toContain('이탈은 가격 때문이다');
    // Honest provenance — marked as the machine's read, not the user's words.
    expect(text).toContain('AI가 채운 전제');
    // The crux is a QUESTION, not a verdict/lean. (Spine: bare neutral question.)
    expect(text).toContain('정말 맞나요?');
    // Guard against verdict-shaped copy creeping in.
    expect(text).not.toContain('가장 위험');
    expect(text).not.toContain('틀렸');
  });

  it('is non-blocking — the dismiss fires onDismiss', () => {
    const onDismiss = vi.fn();
    act(() => root.render(createElement(MirrorBeat, {
      assumption: '챗봇이 이탈을 막는다',
      onDismiss,
    })));
    click(byText('확인했어요'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
