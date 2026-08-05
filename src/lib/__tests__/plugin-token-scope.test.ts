// PAT 범위 가드.
//
// 이 파일이 지키는 것은 규칙 하나다: **PAT 을 발급하는 곳은 범위를 새기고,
// PAT 을 받는 곳은 필요한 범위를 명시한다.** 둘 중 하나라도 빠지면 조용히
// 넓은 권한이 흐른다 — 크게 실패하지 않고 "그럴듯하게" 동작하는 형태다.
// (근원: 2026-08-05 원격 OAuth 커넥터가 계정 전체 PAT 을 받아 가던 것.)

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { REMOTE_SCOPE } from '@/lib/mcp-discovery';
import { SCOPE_DECISIONS, SCOPE_FULL, scopeAllows } from '@/lib/plugin-token-auth';

const SRC = join(process.cwd(), 'src');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf-8');

describe('scopeAllows', () => {
  it('full 은 두 표면을 다 연다', () => {
    expect(scopeAllows(SCOPE_FULL, SCOPE_FULL)).toBe(true);
    expect(scopeAllows(SCOPE_FULL, SCOPE_DECISIONS)).toBe(true);
  });

  it('decisions 는 결정 표면만 연다 — 이것이 이 변경의 요점이다', () => {
    expect(scopeAllows(SCOPE_DECISIONS, SCOPE_DECISIONS)).toBe(true);
    expect(scopeAllows(SCOPE_DECISIONS, SCOPE_FULL)).toBe(false);
  });

  it('NULL/빈 값은 컬럼 이전 토큰 — full 로 읽는다 (호환)', () => {
    for (const legacy of [null, undefined, '', '   ']) {
      expect(scopeAllows(legacy, SCOPE_FULL)).toBe(true);
      expect(scopeAllows(legacy, SCOPE_DECISIONS)).toBe(true);
    }
  });

  it('모르는 범위 문자열은 아무것도 열지 않는다 (fail-closed)', () => {
    expect(scopeAllows('argus.everything', SCOPE_FULL)).toBe(false);
    expect(scopeAllows('argus.everything', SCOPE_DECISIONS)).toBe(false);
    expect(scopeAllows('*', SCOPE_FULL)).toBe(false);
  });
});

describe('발급 경로', () => {
  // 새 발급 경로가 생겼는데 scope 를 안 새기면, 그 토큰은 NULL → full 로 읽혀
  // 조용히 계정 전체 권한이 된다. 그래서 발급마다 범위를 요구한다.
  const FULL_ISSUERS = ['app/api/plugin/token/route.ts', 'app/api/mcp/oauth/token/route.ts'];
  const REMOTE_ISSUER = 'app/api/mcp/v2/oauth/token/route.ts';

  for (const rel of FULL_ISSUERS) {
    it(`${rel} 는 계정 전체 범위로 발급한다`, () => {
      const src = read(rel);
      expect(src).toContain('insertFullScopeToken(');
      // 범위 없이 직접 넣으면 컬럼 유무와 무관하게 NULL(=full)이 되어, 나중에
      // 이 경로를 좁히려 할 때 아무도 눈치채지 못한다.
      expect(src).not.toContain("from('plugin_tokens').insert(");
    });
  }

  it('원격 커넥터는 좁은 범위를 받고, 컬럼이 없으면 크게 실패한다', () => {
    const src = read(REMOTE_ISSUER);
    expect(src).toContain('scope: SCOPE_DECISIONS');
    // 되돌림(fallback)이 있으면 마이그레이션 미적용 환경에서 조용히 계정 전체
    // 토큰이 발급된다 — 이 변경이 막으려는 바로 그것이다.
    expect(src).not.toContain('insertFullScopeToken');
    expect(src).toContain('tokenError');
  });

  it('발급 경로는 이 셋뿐이다 — 새로 생기면 이 목록과 함께 온다', () => {
    // 목록 밖에서 plugin_tokens 에 insert 하는 파일이 있으면 위 검사를 통째로
    // 우회한다. 테스트는 자기 커버리지를 스스로 지켜야 한다.
    const found = walk(SRC).filter(
      (f) => !f.includes('__tests__') && readFileSync(f, 'utf-8').includes("from('plugin_tokens').insert("),
    );
    expect(found.map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/')).sort()).toEqual(
      [REMOTE_ISSUER, 'lib/plugin-token-auth.ts'].sort(),
    );
  });
});

describe('소비 경로', () => {
  // 계정 전체를 요구해야 하는 표면들. 여기서 SCOPE_FULL 이 빠지면 원격 커넥터
  // 토큰이 그대로 들어온다 — 동의 화면이 말하지 않은 권한이다.
  const FULL_SCOPE_SURFACES = [
    'app/api/mcp/receipts/route.ts',
    'app/api/mcp/seal/route.ts',
    'app/api/plugin/events/route.ts',
    'app/api/plugin/ingest/route.ts',
  ];

  for (const rel of FULL_SCOPE_SURFACES) {
    it(`${rel} 는 계정 전체 범위를 요구한다`, () => {
      const src = read(rel);
      expect(src).toContain('authenticatePluginToken(');
      expect(src).toContain('SCOPE_FULL');
      // 옛 인라인 검증이 남아 있으면 규칙이 두 곳으로 갈라진다.
      expect(src).not.toContain("from('plugin_tokens')");
    });
  }

  it('토큰 조회는 컬럼 이름을 명시하지 않는다 — 마이그레이션 전에도 살아야 한다', () => {
    // 컬럼을 명시하면 scope 컬럼이 없는 환경에서 조회가 실패해 **모든** PAT
    // 인증이 죽는다(기존 CLI 사용자 포함). 코드가 마이그레이션보다 먼저
    // 배포되는 것은 정상 순서이므로, 이 선택은 취향이 아니라 요구사항이다.
    const src = read('lib/plugin-token-auth.ts');
    expect(src).toContain("from('plugin_tokens')\n    .select('*')");
    expect(src).not.toMatch(/\.select\('[^*]*scope/);
  });

  it('원격 MCP 표면은 좁은 범위로 충분하다', () => {
    const src = read('app/api/mcp/v2/auth.ts');
    expect(src).toContain('SCOPE_DECISIONS');
    expect(src).not.toContain('SCOPE_FULL');
  });

  it('범위 부족은 401 이 아니라 403 이다 — 재인증해도 열리지 않는 문', () => {
    // 401 로 돌려주면 커넥터가 OAuth 흐름을 무한히 다시 돈다.
    for (const rel of [...FULL_SCOPE_SURFACES, 'app/api/mcp/v2/route.ts']) {
      const src = read(rel);
      expect(src).toContain('insufficient_scope');
      expect(src).toContain('403');
    }
  });
});

it('동의 화면이 광고하는 범위와 토큰에 새기는 범위가 같다', () => {
  // 두 상수가 갈라지면 메타데이터는 argus.decisions 를 광고하는데 토큰에는
  // 다른 문자열이 박혀 아무 표면도 열지 못한다 (또는 그 반대).
  expect(REMOTE_SCOPE).toBe(SCOPE_DECISIONS);
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}
