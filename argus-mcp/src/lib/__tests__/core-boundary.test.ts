import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Core 경계 게이트 (§9.7 O2 방2 — Codex의 verify_tui_core_boundary 패턴).
 *
 * "Core"는 결정론적 판단 규율의 import 폐포다: 원장 쓰기/재생, 상태 전이 가드,
 * falsifiability, 절제 게이트, 전제 도메인, 영수증 상태, v2 durable 사슬.
 * 이 게이트가 기계적으로 강제하는 것 세 가지:
 *
 *  1. 폐포 == 매니페스트 (완전성): core 모듈에 import 하나를 추가하면 그 대상이
 *     폐포에 들어온다 — 매니페스트를 같은 커밋에서 의식적으로 갱신하지 않으면
 *     여기가 빨개진다. (조사에서 실증: render-receipt의 타입 import 한 줄이
 *     surfaces/locale 표현 계층 전체를 core 폐포에 끌고 들어와 있었다.)
 *  2. 외부 의존 화이트리스트: core는 node 내장과 zod만 안다. MCP SDK·elicit
 *     (호스트 seam)·push-account(네트워크)·surfaces(표현)는 구조적으로 못 들어온다.
 *  3. canonical append 단독 writer: 원장 append의 O_APPEND 관용구는
 *     lib/ledger-append.ts 하나에만 존재한다 (O2 exit "canonical append 구현이
 *     Core 밖 0개"의 MCP 절반 — 플러그인 CLI의 수렴은 방3).
 *
 * 물리적 src/core/ 디렉터리 이동은 방3(플러그인 내장 교체) 뒤로 미룬다 — 지금
 * 옮기면 병렬 K-트랙과 열린 작업들의 경로가 전부 흔들린다. 이 매니페스트가
 * 그때까지의 경계 실체다.
 */

const SRC = path.resolve(process.cwd(), 'src');

/** 결정론 core의 진입점들 — 도구/서버가 소비하는 규율의 뿌리. */
const CORE_ROOTS = [
  'lib/ledger-append', 'lib/ledger-replay', 'lib/resolve-contract', 'lib/receipt',
  'lib/premises', 'lib/state-machine', 'lib/validate-seal', 'lib/overfire-gate',
  'lib/spine', 'lib/premises-core', 'lib/resolve-today', 'lib/numeric-drift',
];

/** 뿌리에서 도달 가능한 전체 — 여기 없는 모듈이 폐포에 나타나면 빨간불. */
const CORE_MANIFEST = [
  'lib/atomic-write', 'lib/canonical-scales', 'lib/deBom', 'lib/layout',
  'lib/ledger-append', 'lib/ledger-replay', 'lib/numeric-drift', 'lib/overfire-gate',
  'lib/package-meta', 'lib/premises', 'lib/premises-core', 'lib/receipt',
  'lib/resolve-contract', 'lib/resolve-today', 'lib/safe-path', 'lib/spine',
  'lib/state-machine', 'lib/validate-seal',
  'v2/bridge', 'v2/brief', 'v2/events', 'v2/git-discovery', 'v2/ledger',
  'v2/logbook', 'v2/mirror', 'v2/reducer', 'v2/sanitize', 'v2/v1-reader',
].sort();

/** core가 알아도 되는 바깥 세계의 전부. */
const EXTERNAL_ALLOWLIST = /^(node:.+|fs|fs\/promises|path|os|crypto|zod)$/;

const IMPORT_RE = /(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gs;

function moduleImports(mod: string): { relative: string[]; external: string[] } {
  const file = path.join(SRC, `${mod}.ts`);
  const text = fs.readFileSync(file, 'utf8');
  const relative: string[] = [];
  const external: string[] = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1]!;
    if (spec.startsWith('.')) {
      const resolved = path
        .normalize(path.join(path.dirname(mod), spec))
        .replace(/\\/g, '/')
        .replace(/\.js$/, '');
      relative.push(resolved);
    } else {
      external.push(spec);
    }
  }
  return { relative, external };
}

function computeClosure(): { closure: string[]; externals: Set<string> } {
  const seen = new Set<string>();
  const externals = new Set<string>();
  const queue = [...CORE_ROOTS];
  while (queue.length) {
    const mod = queue.pop()!;
    if (seen.has(mod)) continue;
    seen.add(mod);
    const { relative, external } = moduleImports(mod);
    relative.forEach((r) => queue.push(r));
    external.forEach((e) => externals.add(e));
  }
  return { closure: [...seen].sort(), externals };
}

describe('core 경계 게이트 (O2 방2)', () => {
  const { closure, externals } = computeClosure();

  it('폐포 == 매니페스트 — core에 새 의존을 더하면 같은 커밋에서 여기를 갱신해야 한다', () => {
    expect(closure).toEqual(CORE_MANIFEST);
  });

  it('외부 의존은 node 내장 + zod뿐 — SDK/elicit/네트워크/표현 계층은 구조적으로 차단', () => {
    const offenders = [...externals].filter((e) => !EXTERNAL_ALLOWLIST.test(e));
    expect(offenders, `core가 허용 밖 외부를 import: ${offenders.join(', ')}`).toEqual([]);
  });

  it('core는 도구/서버/호스트 seam을 이름으로도 모른다', () => {
    for (const mod of CORE_MANIFEST) {
      const text = fs.readFileSync(path.join(SRC, `${mod}.ts`), 'utf8');
      for (const banned of ['@modelcontextprotocol', "from '../tools", "from './elicit", "from '../lib/elicit", 'push-account', "from './surfaces", "from './locale.js"]) {
        expect(text.includes(banned), `${mod}가 금지 의존을 참조: ${banned}`).toBe(false);
      }
    }
  });

  it('append 관용구(O_APPEND)는 등재된 writer들뿐 (canonical ledger writer 단독 + 사유 있는 별도 store)', () => {
    // lib/ledger-append.ts — THE canonical ledger.jsonl writer.
    // v3/store.ts — v3 semantic pilot의 자기 저장소(semantic-v3.jsonl). 정본
    //   원장이 아닌 별도 파일이며 ARGUS_DKK_V6_PILOT 뒤에서 P5 HOLD로 동결
    //   상태다 (ADR-2026-07-14). 셋째 등장은 사유와 함께 여기 등재하지 않는
    //   한 빨간불이다.
    const ALLOWED_APPENDERS = ['lib/ledger-append.ts', 'v3/store.ts'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) {
          if (name === '__tests__' || name === 'node_modules') continue;
          walk(p);
          continue;
        }
        if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
        if (fs.readFileSync(p, 'utf8').includes('O_APPEND')) {
          offenders.push(path.relative(SRC, p).replace(/\\/g, '/'));
        }
      }
    };
    walk(SRC);
    expect(offenders.sort()).toEqual(ALLOWED_APPENDERS.sort());
  });
});
