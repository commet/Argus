// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/stores/types';

/**
 * The harbor card had ZERO render tests, which is exactly why the 2026-07-25
 * regression shipped with CI fully green: the domain functions were correct and
 * the only broken thing was which branch the component chose.
 *
 * Each case below is phrased as "what would make this red" — a record a user
 * really owns that must never be narrated as an unfinished baseline, and must
 * never lose its route back to settlement.
 */

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const updateProject = vi.fn();

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/stores/useProjectStore', () => ({
  useProjectStore: (sel: (s: { updateProject: typeof updateProject }) => unknown) => sel({ updateProject }),
}));
vi.mock('@/stores/usePersonaStore', () => ({
  usePersonaStore: (sel: (s: { personas: unknown[] }) => unknown) => sel({ personas: [] }),
}));
vi.mock('@/lib/storage', () => ({
  getStorage: <T,>(_k: string, fallback: T): T => fallback,
  STORAGE_KEYS: { RECAST_LIST: 'r', FEEDBACK_HISTORY: 'f' },
}));
vi.mock('@/components/ui/LocaleLink', () => ({
  LocaleLink: ({ children }: { children: React.ReactNode }) => createElement('a', {}, children),
}));

const { DecisionContractCard } = await import('@/components/projects/DecisionContractCard');

const PAST = new Date(Date.now() - 3 * 86_400_000).toISOString();
const FUTURE = new Date(Date.now() + 7 * 86_400_000).toISOString();

function project(contract: Project['decision_contract']): Project {
  return {
    id: 'p1',
    name: '가격을 올릴까',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    decision_contract: contract,
  } as unknown as Project;
}

const userLean = {
  id: 'pred_base',
  text: '지금은 올리지 않는 쪽',
  source: 'user_lean' as const,
  authored: 'user' as const,
};

describe('DecisionContractCard — lifecycle phase, not the ceremony stamp', () => {
  let container: HTMLDivElement;
  let root: Root;
  const html = () => container.textContent ?? '';

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    updateProject.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (p: Project, extra: Record<string, unknown> = {}) => {
    act(() => {
      root.render(createElement(DecisionContractCard, { project: p, sealable: false, ...extra } as never));
    });
  };

  it('a retro seal is NOT shown as an unfinished baseline', () => {
    render(project({
      id: 'c', project_id: 'p1', created_at: PAST, origin: 'retro',
      predicates: [userLean], check_in_at: FUTURE,
    }));
    expect(html()).not.toContain('검토 전 기준점이 남아 있어요');
    // and it must not offer to delete the record as if it were a stray baseline
    expect(html()).not.toContain('기준점 지우기');
  });

  it('a contract sealed with AI-extracted predicates keeps its settlement route', () => {
    render(project({
      id: 'c', project_id: 'p1', created_at: PAST, check_in_at: PAST,
      predicates: [{ id: 'r1', text: '경쟁사가 먼저 낸다', source: 'risk', authored: 'ai_surfaced' }],
    }));
    expect(html()).not.toContain('검토 전 기준점이 남아 있어요');
    // Due + no host modal ⇒ the inline grade panel IS the settlement route.
    expect(html()).toContain('실제로 일어났나요');
  });

  it('a sealed contract not yet due offers "check now" rather than a baseline screen', () => {
    render(project({
      id: 'c', project_id: 'p1', created_at: PAST, check_in_at: FUTURE,
      predicates: [{ id: 'r1', text: '경쟁사가 먼저 낸다', source: 'risk', authored: 'ai_surfaced' }],
    }));
    expect(html()).not.toContain('검토 전 기준점이 남아 있어요');
    expect(html()).toContain('지금 확인하기');
  });

  it('a genuine pre-review baseline still reads as a baseline', () => {
    render(project({
      id: 'c', project_id: 'p1', created_at: PAST,
      predicates: [userLean], check_in_at: FUTURE,
    }));
    expect(html()).toContain('검토 전 기준점이 남아 있어요');
  });

  it('a baseline whose day arrived can still close the loop', () => {
    const onCheckNow = vi.fn();
    render(
      project({ id: 'c', project_id: 'p1', created_at: PAST, predicates: [userLean], check_in_at: PAST }),
      { onCheckNow },
    );
    // Honest framing: it is not called a prediction the user made…
    expect(html()).toContain('확인일이 왔어요');
    // …but the rope is still checkable rather than silently expiring.
    const btn = [...container.querySelectorAll('button')]
      .find((b) => (b.textContent ?? '').includes('기준점 그대로 확인하기'));
    expect(btn).toBeTruthy();
    act(() => { btn!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onCheckNow).toHaveBeenCalled();
  });

  it('a date-only rope offers no settlement — there is no line to check', () => {
    render(
      project({ id: 'c', project_id: 'p1', created_at: PAST, predicates: [], check_in_at: PAST }),
      { onCheckNow: vi.fn() },
    );
    expect(html()).not.toContain('기준점 그대로 확인하기');
  });

  it('a settled record shows its verified card, not a baseline', () => {
    render(project({
      id: 'c', project_id: 'p1', created_at: PAST,
      graded_at: PAST,
      predicates: [{ ...userLean, verdict: 'happened', graded_at: PAST }],
    }));
    expect(html()).not.toContain('검토 전 기준점이 남아 있어요');
  });

  it("a broken user bet is named in the settled summary, not left blank", () => {
    render(project({
      id: 'c', project_id: 'p1', created_at: PAST,
      graded_at: PAST,
      predicates: [{ ...userLean, verdict: 'avoided', graded_at: PAST }],
    }));
    expect(html()).toContain('빗나감');
    expect(html()).not.toContain('판단 기록 확인 완료');
  });
});
