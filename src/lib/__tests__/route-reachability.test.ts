/**
 * 도달 가능성 — 링크 없는 방을 만들지 못하게 한다.
 *
 * 이 리포가 이미 겪은 실패다: 안내 페이지(`/connect`)를 다 지어 놓고 **어디서도
 * 링크하지 않아** 아무도 들어갈 수 없었다. 그 실패가 조용한 이유는 페이지가
 * 멀쩡히 렌더되기 때문이다 — 라우트를 직접 치면 열리므로 개발자에게는 완성으로
 * 보이고, 사용자에게는 존재하지 않는 것과 같다.
 *
 * 규칙: `src/app/[locale]/` 아래 사용자향 라우트는 **다른 화면에서 링크**되거나,
 * 왜 링크가 없는지 사유와 함께 등재돼야 한다.
 *
 * 이 테스트가 잡지 못하는 것도 적어 둔다: 링크가 존재하는지만 보고, 그 링크가
 * 눈에 띄는지·정상 동작하는지는 보지 않는다. 도달 가능성의 **필요조건**이지
 * 충분조건이 아니다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = 'src/app/[locale]';

/**
 * 링크가 없어도 되는 라우트 — 각 항목은 **왜 없는가**에 답해야 한다.
 * "아직 안 붙였다"는 사유가 아니다. 그건 그냥 위에서 말한 그 실패다.
 */
const NO_LINK_NEEDED: Record<string, string> = {
  login: '인증 흐름의 목적지 — 미들웨어·리다이렉트가 보내는 곳이지 사람이 눌러 가는 문이 아니다',
  auth: '콜백 전용 (OAuth·디바이스 코드). 링크할 대상이 아니라 브라우저가 돌아오는 주소다',
  design: '디자인 참조 카탈로그 — noindex, 제품 표면이 아니다 (팀이 주소를 직접 친다)',
  layout: '라우트가 아님 (파일)',
  loading: '라우트가 아님 (파일)',
  page: '라우트가 아님 (파일)',
};

function routeSegments(): string[] {
  return readdirSync(ROUTES_DIR)
    .filter((name) => statSync(join(ROUTES_DIR, name)).isDirectory())
    .sort();
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const ALL_SRC = walk('src').filter((f) => !f.includes('__tests__') && !f.endsWith('.test.ts'));
const TEXT = new Map(ALL_SRC.map((f) => [f, readFileSync(f, 'utf8')]));

/** 이 세그먼트를 가리키는 링크가 **자기 자신 밖에** 있는가. */
function linkedFrom(segment: string): string[] {
  const own = join(ROUTES_DIR, segment);
  // `href="/twin"` · `href='/twin'` · withLocale(x, '/twin') 전부 잡는다.
  const re = new RegExp(`['"\`]/${segment}(?:[/'"\`?]|$)`);
  return ALL_SRC.filter((f) => !f.startsWith(own) && re.test(TEXT.get(f) ?? ''));
}

describe('라우트 도달 가능성', () => {
  const segments = routeSegments();

  it('스캐너가 실제로 라우트를 찾았다 (경로가 바뀌면 조용히 무력해지는 것을 막는다)', () => {
    expect(segments.length).toBeGreaterThan(10);
    expect(segments).toContain('workspace');
  });

  it('모든 사용자향 라우트는 어딘가에서 링크되거나 사유와 함께 등재된다', () => {
    const orphans = segments
      .filter((seg) => !NO_LINK_NEEDED[seg])
      .filter((seg) => linkedFrom(seg).length === 0);
    expect(
      orphans,
      `어디서도 링크되지 않는 라우트입니다. 링크를 붙이거나 NO_LINK_NEEDED 에 사유를 적으십시오:\n${orphans.join('\n')}`,
    ).toEqual([]);
  });

  it('죽은 면제가 없다 — 등재된 세그먼트는 실존해야 한다', () => {
    const real = new Set(segments);
    const stale = Object.keys(NO_LINK_NEEDED)
      .filter((seg) => !['layout', 'loading', 'page'].includes(seg))
      .filter((seg) => !real.has(seg));
    expect(stale, `그런 라우트가 없습니다 (이름이 바뀌었거나 삭제됨):\n${stale.join('\n')}`).toEqual([]);
  });

  it('면제 사유가 실질적이다 (한 줄 변명 금지)', () => {
    for (const [seg, reason] of Object.entries(NO_LINK_NEEDED)) {
      if (['layout', 'loading', 'page'].includes(seg)) continue;
      expect(reason.length, `${seg} 의 사유가 너무 짧습니다`).toBeGreaterThan(25);
    }
  });

  it('분신의 집이 실제로 링크돼 있다 (이번에 지은 방)', () => {
    const from = linkedFrom('twin');
    expect(from.length, '분신 페이지로 가는 링크가 없습니다').toBeGreaterThan(0);
    // 헤더(오버플로 메뉴 + 커맨드 팔레트)에서 닿아야 한다 — 설정 안에서만
    // 닿으면 "설정에 들어간 사람만 아는 화면"이 된다.
    expect(from.some((f) => f.includes('layout/Header'))).toBe(true);
  });
});
