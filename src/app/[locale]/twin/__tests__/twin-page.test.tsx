// @vitest-environment jsdom

/**
 * 분신의 집 — 렌더 테스트.
 *
 * 이 파일이 있는 이유는 정직하다: 이 화면을 **브라우저에 띄워 본 적이 없다.**
 * 개발 컨테이너에는 Supabase 키가 없어 `/[locale]` 이 500이고, 프리뷰 배포는
 * 네트워크 정책이 CONNECT 단계에서 막는다. 그래서 눈 대신 이것을 둔다.
 *
 * 각 케이스는 "무엇이 이걸 빨간불로 만드는가"로 썼다. 특히 봉인 — 이 화면이
 * 정산 전 예측의 본문을 절대 그리지 않는다는 것은 제품의 약속이지 구현
 * 디테일이 아니고, 약속은 기계가 지켜야 한다.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const authUser: { current: { id: string } | null } = { current: { id: 'u1' } };
const twinHome: { current: unknown } = { current: null };

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: authUser.current }) }));
vi.mock('@/lib/api-account', () => ({ fetchTwinHome: async () => twinHome.current }));
vi.mock('@/components/ui/LocaleLink', () => ({
  LocaleLink: ({ children, href }: { children: React.ReactNode; href: string }) =>
    createElement('a', { href }, children),
}));

/**
 * 브라우저가 RLS 아래 직접 읽는 세 테이블. 체인 길이를 고정하지 않는다 —
 * `.order()` 하나가 늘고 줄 때마다 목이 깨지면 테스트가 코드를 붙잡는 게 아니라
 * 코드가 테스트를 붙잡게 된다.
 */
const rows: Record<string, unknown[]> = {};
function chain(table: string): unknown {
  const result = Promise.resolve({ data: rows[table] ?? [], error: null });
  const proxy: Record<string, unknown> = {
    then: result.then.bind(result),
    catch: result.catch.bind(result),
    finally: result.finally.bind(result),
  };
  for (const m of ['select', 'order', 'limit', 'in', 'neq', 'eq']) proxy[m] = () => proxy;
  return proxy;
}
vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => chain(t) } }));
vi.mock('@/lib/twin/store', () => ({ TWIN_SCORE_MIN_SAMPLE: 3 }));

const TwinPage = (await import('../page')).default;

let container: HTMLDivElement;
let root: Root;

function text(): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ');
}

async function render() {
  await act(async () => {
    root.render(createElement(TwinPage));
  });
  // 마운트 이펙트의 Promise.all 이 풀리는 틱을 하나 더 준다.
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  authUser.current = { id: 'u1' };
  twinHome.current = { sealed: [], revealed: [], score: null };
  for (const k of Object.keys(rows)) delete rows[k];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('분신의 집', () => {
  it('로그인하지 않았으면 기록 대신 로그인 문을 보여준다', async () => {
    authUser.current = null;
    await render();
    expect(text()).toContain('로그인');
    // 남의 기록을 암시하는 어떤 절도 그리지 않는다.
    expect(text()).not.toContain('봉인된 예측');
  });

  it('아무것도 없으면 빈 절 다섯 개 대신 시작하는 법 하나를 보여준다', async () => {
    await render();
    const t = text();
    expect(t).toContain('아직 비어 있습니다');
    expect(container.querySelector('a[href="/connect"]')).not.toBeNull();
    // 빈 절들을 나열하지 않는다 — 첫 화면이 고장처럼 보이면 안 된다.
    expect(t).not.toContain('열린 봉인');
    expect(t).not.toContain('분신 성적');
  });

  it('봉인은 개수와 날짜만 그린다 — 본문이 화면에 닿을 경로가 없다', async () => {
    twinHome.current = {
      sealed: [
        { case_id: 'c1', target: 'outcome', sealed_at: '2026-08-01T00:00:00Z', status: 'sealed' },
        { case_id: 'c1', target: 'choice', sealed_at: '2026-08-01T00:00:00Z', status: 'sealed' },
      ],
      revealed: [],
      score: null,
    };
    rows['argus_cases'] = [
      { id: 'c1', title: '가격을 올릴까', choice: null, last_observation: null, settled_at: null },
    ];
    await render();
    const t = text();
    expect(t).toContain('2건이 잠겨 있습니다');
    expect(t).toContain('가격을 올릴까');
    expect(t).toContain('결과 예측');
    // 서버가 애초에 select 하지 않는 필드들. 화면에 나타날 수 있는 유일한
    // 경로는 누군가 API 를 넓히는 것이고, 그때 이 줄이 빨간불이 된다.
    expect(t).not.toContain('expectation');
    expect(t).not.toContain('reasoning');
  });

  it('봉인이 채택보다 늦었으면 채점에서 빠진다고 화면에 적는다', async () => {
    twinHome.current = {
      sealed: [{ case_id: 'c1', target: 'outcome', sealed_at: '2026-08-01T00:00:00Z', status: 'late' }],
      revealed: [],
      score: null,
    };
    await render();
    expect(text()).toContain('채점 제외');
  });

  it('열린 봉인은 분신이 적은 것과 사용자가 적은 현실을 나란히 놓는다', async () => {
    twinHome.current = {
      sealed: [],
      revealed: [
        {
          case_id: 'c1',
          target: 'outcome',
          expectation: '이탈이 늘 것이다',
          confidence: 0.7,
          verdict: 'contradicted',
          verdict_quote: '이탈은 그대로였다',
          revealed_at: '2026-08-05T00:00:00Z',
        },
      ],
      score: null,
    };
    rows['argus_cases'] = [
      {
        id: 'c1',
        title: '가격을 올릴까',
        choice: '올린다',
        last_observation: '한 달 뒤 이탈은 그대로였다',
        settled_at: '2026-08-05T00:00:00Z',
      },
    ];
    await render();
    const t = text();
    expect(t).toContain('이탈이 늘 것이다');
    expect(t).toContain('현실과 어긋남');
    expect(t).toContain('한 달 뒤 이탈은 그대로였다');
    // 사용자가 쓴 문장은 그의 것으로 표시된다 (저자성).
    expect(t).toContain('당신이 적은 현실');
  });

  it('표본이 임계 미달이면 퍼센트를 만들지 않는다', async () => {
    twinHome.current = {
      sealed: [],
      revealed: [
        // 확신 90% — 봉인 당시 분신이 스스로 적은 수다. 이건 성적이 아니라
        // 예측의 일부이므로 열린 뒤에는 보이는 것이 맞다. 아래 50% 검사와
        // 겹치지 않게 값을 갈라 뒀다.
        { case_id: 'c1', target: 'outcome', expectation: 'x', confidence: 0.9, verdict: 'supported', verdict_quote: null, revealed_at: '2026-08-05T00:00:00Z' },
      ],
      score: { matchRate: 0.5, matchSample: 2, outcomeRate: 1, outcomeSample: 5 },
    };
    await render();
    const t = text();
    expect(t).toContain('아직 모릅니다 · 2/3'); // 미달 — 숫자 대신 정직한 공백
    expect(t).toContain('100%'); // 충족 — 숫자를 낸다
    // matchRate 0.5 는 표본이 2건이라 절대 화면에 나오면 안 된다. 임계를
    // 무시하는 회귀가 들어오면 여기가 유일하게 빨간불이 된다.
    expect(t).not.toContain('50%');
    // 채점 대상이 분신임을 문장에서 밝힌다 (zero-judgment TWIN 수정조항).
    expect(t).toContain('당신에 대한 평가가 아닙니다');
  });

  it('서버가 봉인을 읽지 못하면 "없음"이 아니라 "못 읽음"이라고 말한다', async () => {
    twinHome.current = { sealed: null, revealed: [], score: null };
    rows['argus_cases'] = [
      { id: 'c1', title: 'x', choice: null, last_observation: null, settled_at: null },
    ];
    await render();
    // 조용한 0 은 이 제품에서 가장 나쁜 실패다 — 빈 것과 못 본 것은 다르다.
    expect(text()).toContain('읽지 못했습니다');
  });

  it('프로필의 물러난 항목은 왜 물러났는지와 함께 남는다', async () => {
    rows['argus_profile_items'] = [
      {
        id: 'p1',
        layer: 'L2',
        domain: 'pricing',
        content: '가격 인상에 보수적이다',
        evidence_case_ids: ['c1', 'c2'],
        counterexamples: ['c3', 'c4'],
        status: 'retired',
      },
    ];
    await render();
    const t = text();
    expect(t).toContain('가격 인상에 보수적이다');
    expect(t).toContain('반례 2');
    expect(t).toContain('현실이 반대로 답해서 물러남');
  });

  it('위임은 사용자의 원문을 그의 말로 인용하고, 자기 정지도 드러낸다', async () => {
    rows['argus_delegations'] = [
      {
        id: 'd1',
        policy: '3만원 이하 환불은 즉시 승인',
        scope_domain: 'refund',
        user_words: '소액은 그냥 해줘',
        expires_at: '2026-12-01T00:00:00Z',
        status: 'suspended',
        applications: 9,
        supported: 3,
        contradicted: 5,
      },
    ];
    await render();
    const t = text();
    expect(t).toContain('그때 하신 말');
    expect(t).toContain('소액은 그냥 해줘');
    expect(t).toContain('어긋남이 쌓여 스스로 멈췄습니다');
  });
});
