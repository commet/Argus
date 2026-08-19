// @vitest-environment jsdom

/**
 * 회고 연습이 끝났을 때 사용자가 **어디에 도착하는가** — 동작 테스트.
 *
 * 감사(DLP-5)가 잡은 결함이 정확히 이 자리다: 정산을 마친 화면의 버튼은
 * "연습 닫고 기록 보기"라고 말했지만, 눌렀을 때 실행된 것은 `onExit` 이었고
 * 그것은 빈 워크스페이스였다. 방금 남긴 기록은 실재했는데(연습도 진짜
 * 프로젝트를 만든다) 사용자는 그것을 볼 길이 없었고, 화면상으로는 방금 한
 * 일이 사라진 것처럼 보였다.
 *
 * 그래서 여기서 고정하는 것은 문구가 아니라 **배선**이다. RetroSeal 이
 * 정산 모달에 넘기는 기록 도착지가 (a) 존재하고 (b) 방금 만든 그 프로젝트를
 * 가리키는지 본다. 모달이 그 도착지를 어떻게 쓰는지는 모달의 테스트가 본다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Project } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  projects: [] as Project[],
  settlementProps: null as Record<string, unknown> | null,
}));

// `mode="wait"` 는 jsdom 에서 exit 애니메이션이 끝나지 않아 다음 단계를 영영
// 렌더하지 않는다 — 저장소의 다른 jsdom 테스트와 같은 방식으로 걷어낸다.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => createElement(React.Fragment, null, children),
  useReducedMotion: () => true,
  motion: new Proxy({}, {
    get: (_t, tag: string) =>
      // eslint-disable-next-line react/display-name
      React.forwardRef((props: Record<string, unknown>, ref) => {
        const { children, initial, animate, exit, transition, layout, whileHover, whileTap, ...rest } = props;
        void initial; void animate; void exit; void transition; void layout; void whileHover; void whileTap;
        return createElement(tag, { ...rest, ref }, children as React.ReactNode);
      }),
  }),
}));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/settle-align', () => ({ alignOutcome: async () => ({}) }));
vi.mock('@/components/projects/JudgmentReceipt', () => ({
  deriveReceiptFields: () => ({
    real_question: '',
    unverified_assumption: '',
    human_only: '',
    human_judgment: '',
  }),
}));

// 모달 자체는 여기서 검사 대상이 아니다 — 넘어온 props 만 잡는다.
vi.mock('@/components/projects/SettlementModal', () => ({
  SettlementModal: (props: Record<string, unknown>) => {
    mocks.settlementProps = props;
    return null;
  },
}));

vi.mock('@/stores/useProjectStore', () => {
  const state = {
    get projects() {
      return mocks.projects;
    },
    createProject: (name: string) => {
      const id = `retro-${mocks.projects.length + 1}`;
      mocks.projects = [...mocks.projects, {
        id,
        name,
        description: '',
        refs: [],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }];
      return id;
    },
    updateProject: (id: string, patch: Partial<Project>) => {
      mocks.projects = mocks.projects.map((p) => (p.id === id ? { ...p, ...patch } : p));
    },
  };
  return { useProjectStore: (selector: (s: typeof state) => unknown) => selector(state) };
});

const { RetroSeal } = await import('@/components/workspace/RetroSeal');

let container: HTMLDivElement;
let root: Root;

function type(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement | undefined;
}

beforeEach(() => {
  mocks.projects = [];
  mocks.settlementProps = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function runToSettle(props: Record<string, unknown>) {
  await act(async () => {
    root.render(createElement(RetroSeal, props as never));
  });
  await act(async () => {
    type(document.body.querySelector('textarea')!, 'I turned down that offer');
  });
  await act(async () => button('Record and continue')!.click());
  await act(async () => {
    type(document.body.querySelector('textarea')!, 'The team stayed and shipped on time.');
  });
  await act(async () => button('Check against reality')!.click());
}

describe('RetroSeal — where a finished rehearsal lands', () => {
  it('hands the settlement a record destination pointing at the project it just wrote', async () => {
    const onExit = vi.fn();
    const onViewRecord = vi.fn();
    await runToSettle({ onExit, onViewRecord });

    expect(mocks.settlementProps, '정산 단계에 도달하지 못했습니다').not.toBeNull();
    const declared = mocks.settlementProps!.onViewRecord as (() => void) | undefined;
    expect(declared, '연습이 기록 도착지 없이 정산을 엽니다').toBeTypeOf('function');

    declared!();
    // 방금 만든 그 프로젝트여야 한다. 다른 것을 가리키면 남의 기록을 연다.
    expect(onViewRecord).toHaveBeenCalledWith(mocks.projects[0].id);
    // 빈 워크스페이스로 돌아가는 옛 경로가 다시 붙으면 이 줄이 빨간불이 된다.
    expect(onExit, '기록 보기가 워크스페이스 이탈로 갔습니다').not.toHaveBeenCalled();
  });

  it('declares no destination when the page does not offer one', async () => {
    // 도착지가 없으면 약속도 없다 — 모달은 이때 "닫기"라고 말한다.
    await runToSettle({ onExit: vi.fn() });
    expect(mocks.settlementProps).not.toBeNull();
    expect(mocks.settlementProps!.onViewRecord).toBeUndefined();
  });
});
