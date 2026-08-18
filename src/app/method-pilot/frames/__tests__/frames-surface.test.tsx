// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/lib/storage';
import { addElement, emptyFrame, makeElement, recordReading, sealFrame } from '@/lib/cognition/frame';
import { appendReading, makePremise, referenceFrom } from '@/lib/cognition/premise';
import { readingFrom, watchToBinding, watchToCusumPrior, watchToPortfolioPrior, type WatchSetup } from '@/lib/cognition/watch';
import { isSamePremiseText } from '@/lib/cognition/premise';
import type { CognitiveFrame, DurablePremise } from '@/lib/cognition';

/**
 * 인지 프레임 파일럿 표면 — **엔진이 낸 것이 화면에 실제로 글자로 나오는가.**
 *
 * `cognition-wiring.test.ts` 는 호출 자리가 있는지만 본다. 불리기는 하는데
 * 결과가 화면에 안 그려지거나 런타임에 죽으면 그건 못 잡는다. 이 파일은
 * 진짜로 렌더해서 사용자가 읽게 될 문장을 확인한다.
 *
 * 이 화면은 Supabase 키 없이도 뜨는 유일한 표면이다(localStorage 전용).
 * 0클릭 소스만 플러그인 스토어를 읽으므로 그것만 대역을 세운다.
 */
const pluginState = vi.hoisted(() => ({
  decisions: [] as Array<Record<string, unknown>>,
  loadError: false,
  loadData: vi.fn(async () => {}),
}));

vi.mock('@/stores/usePluginStore', () => ({
  usePluginStore: { getState: () => pluginState },
}));

const iso = (d: number) => `2026-08-${String(d).padStart(2, '0')}T00:00:00Z`;
const WATCH: WatchSetup = {
  what: '전환율', where: '대시보드 A', normal: '3%', wobble: '0.2%p', broken: '2%',
  why: '2% 밑이면 광고비가 안 빠집니다',
};
const PREMISE_TEXT = '전환율이 지금 수준으로 유지된다';

/** 봉인된 판단 하나 — 감시가 걸리고 값도 한 번 읽힌 상태. */
function seeded(): { frames: CognitiveFrame[]; premises: DurablePremise[] } {
  const at = Date.parse(iso(1));
  let f = emptyFrame({ id: 'f1', userId: null, title: '광고비를 두 배로 올린다', now: at });
  for (const [axis, text] of [
    ['frame', '지금 성장 국면이라고 보고 있다'],
    ['values', '성장이 이익보다 먼저다'],
    ['premises', PREMISE_TEXT],
    ['falsifier', '전환율이 2% 밑으로 가면 틀린 것이다'],
  ] as const) {
    f = addElement(f, makeElement({ id: `f1-${axis}`, axis, text, touched: true, now: at }), at);
  }
  const binding = watchToBinding(WATCH);
  f = { ...f, elements: f.elements.map((el) => (el.axis === 'premises' ? { ...el, bindings: [binding] } : el)) };

  const sealed = sealFrame({ frame: f, now: at });
  if (!sealed.ok) throw new Error(sealed.messages.join(' / '));

  let premise = makePremise({
    id: 'p1', userId: null, text: PREMISE_TEXT,
    bindings: [binding],
    cusumPrior: watchToCusumPrior(WATCH),
    portfolioPrior: watchToPortfolioPrior(WATCH),
    now: at,
  });
  premise = referenceFrom(premise, 'f1', at);

  let frame = sealed.frame;
  for (const [i, v] of ['2.4%', '2.1%', '1.8%', '1.6%', '1.5%'].entries()) {
    const r = readingFrom(WATCH, { value: v, observedAt: iso(i + 2) });
    premise = appendReading(premise, r, Date.parse(iso(i + 2)));
    frame = recordReading(frame, r, Date.parse(iso(i + 2)));
  }
  expect(isSamePremiseText(frame.elements.find((e) => e.axis === 'premises')!.text, premise.text)).toBe(true);
  return { frames: [frame], premises: [premise] };
}

describe('인지 프레임 파일럿 표면', () => {
  let host: HTMLDivElement;
  let root: Root;
  let Page: React.ComponentType;

  beforeEach(async () => {
    localStorage.clear();
    pluginState.decisions = [];
    pluginState.loadError = false;
    pluginState.loadData = vi.fn(async () => {});
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    Page = (await import('../page')).default;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  const render = async () => {
    await act(async () => {
      root.render(createElement(Page));
      await Promise.resolve();
    });
  };

  it('기록이 하나도 없어도 죽지 않고 뜬다', async () => {
    await render();
    expect(host.textContent).toContain('지금 내린 결정, 적어두기');
  });

  it('0클릭 소스가 기본이고, 누르지 않아도 스스로 불러온다', async () => {
    await render();
    expect(pluginState.loadData).toHaveBeenCalled();
    expect(host.textContent).toContain('할 일 없음');
  });

  it('가져온 것이 없으면 빈 목록을 말없이 보여주지 않고 이유를 적는다', async () => {
    await render();
    expect(host.textContent).toContain('아직 가져온 문장이 없습니다');
    // 설치 방법까지 함께 — 막다른 골목을 만들지 않는다.
    expect(host.textContent).toContain('/argus:settings connect');
  });

  it('불러오기가 실패하면 "없음"이 아니라 "못 불러왔다"고 말한다', async () => {
    pluginState.loadError = true;
    await render();
    expect(host.textContent).toContain('불러오지 못했습니다');
  });

  it('플러그인이 가져다 둔 문장은 후보로 올라온다', async () => {
    pluginState.decisions = [
      { id: 'd1', status: 'candidate', quote: '나는 지금 가격을 올릴 때라고 생각해', harvested_at: iso(1) },
    ];
    await render();
    expect(host.textContent).toContain('나는 지금 가격을 올릴 때라고 생각해');
    // AI 턴이 함께 오지 않는 경로임을 밝힌다 — 모르는 것을 안다고 하지 않는다.
    expect(host.textContent).toContain('확인할 수 없었습니다');
  });
});

describe('되돌아오는 절반이 화면에 그려진다', () => {
  let host: HTMLDivElement;
  let root: Root;
  let Page: React.ComponentType;

  beforeEach(async () => {
    localStorage.clear();
    pluginState.decisions = [];
    pluginState.loadError = false;
    pluginState.loadData = vi.fn(async () => {});
    const { frames, premises } = seeded();
    localStorage.setItem(STORAGE_KEYS.COGNITIVE_FRAMES, JSON.stringify(frames));
    localStorage.setItem(STORAGE_KEYS.COGNITIVE_PREMISES, JSON.stringify(premises));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    Page = (await import('../page')).default;
    await act(async () => {
      root.render(createElement(Page));
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('전제가 흔들리면 그 위에 세운 판단이 이름으로 다시 올라온다', async () => {
    expect(host.textContent).toContain('지금 흔들린 것');
    expect(host.textContent).toContain(PREMISE_TEXT);
    expect(host.textContent).toContain('광고비를 두 배로 올린다');
  });

  it('지켜보는 것에 판독 수와 판정이 함께 나온다', () => {
    expect(host.textContent).toContain('지켜보는 것');
    expect(host.textContent).toContain('본 값 5건으로 판정합니다');
  });

  it('현실에 닿은 문장임을 말하고, 무를 수 있는 자리를 준다', () => {
    expect(host.textContent).toContain('현실이 확인해 준 문장입니다');
    expect(host.textContent).toContain('무르기');
  });

  it('예측을 안 적었으면 채점 칸 자체를 만들지 않는다 — 빈 점수를 보여주지 않는다', () => {
    expect(host.textContent).not.toContain('적어둔 예측, 얼마나 맞았나');
  });

  it('사람에 대한 판정 문장이 화면에 없다', () => {
    for (const banned of ['당신은 ', '성향', '등급', '결정자']) {
      expect(host.textContent, `금지 어휘 "${banned}"`).not.toContain(banned);
    }
  });
});
