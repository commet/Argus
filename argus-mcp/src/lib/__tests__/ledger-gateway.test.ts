import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 관문 단일성 — 원장에 줄을 붙이는 자리는 다섯뿐이고, 여섯째가 생기면 빨간불.
 *
 * 왜 이게 필요한가 (시공 계획 §5 단계 0). 이 저장소는 같은 `ledger.jsonl` 을
 * **두 패키지**가 쓴다. `argus-mcp`(TS)와 `argus-plugin-v2`(JS)는 별개 npm
 * 패키지라 import 이 불가능해서, 쓰기 규율(잠금 → 꼬리 치유 → O_APPEND →
 * fsync)을 **일부러 두 번 구현**하고 락 파일 규약(`${file}.lock`)으로 서로를
 * 배제한다. 그 이중 구현이 어긋나지 않는지는 `cross-surface-contract.test.ts`
 * 의 "쓰기 규율 계약" 세 항이 이미 지킨다.
 *
 * **이 파일은 다른 것을 지킨다: 여섯 번째 구현이 태어나지 않는 것.**
 * 대조 테스트는 *아는 두 writer* 가 같게 쓰는지만 보고, 새로 생긴 writer 는
 * 애초에 대조 대상이 아니라 조용히 통과한다. 2026-08-09 에 실제로 그렇게
 * 샜다 — `push-webapp.js` 가 락도 fsync 도 없이 같은 원장에 붙이고 있었고,
 * 아무 검사도 빨간불을 내지 않았다. 지금 앞으로 짓는 것(새 사건 종류·파일
 * 생성기·훅)은 전부 원장에 쓰고 싶어지는 코드라, 그 유혹을 **목록으로**
 * 못박는다: 붙이려면 이 목록에 이름과 이유를 적어야 하고, 적는 순간 사람이
 * 본다.
 *
 * 목록에 이름을 더하는 것은 금지가 아니다 — **조용히** 더하는 것이 금지다.
 */

const MCP_SRC = path.resolve(__dirname, '..', '..');            // argus-mcp/src
const REPO_ROOT = path.resolve(MCP_SRC, '..', '..');            // repo root
const PLUGIN = path.join(REPO_ROOT, 'argus-plugin-v2');

/**
 * 원장에 줄을 붙이는 자리. **이 목록이 늘어나는 것이 사건이다** — 늘리려면
 * 여기에 이름과 이유를 적어야 하고, 적는 순간 diff 에서 사람이 본다.
 * (경로는 `argus-mcp/src/` 기준 · 플러그인은 `argus-plugin-v2/` 기준)
 */
const LEDGER_WRITERS: Record<string, string> = {
  'mcp:lib/ledger-append.ts':
    'v1 원장의 유일한 관문. 잠금·꼬리 치유·fsync·디렉터리 fsync·v2 미러가 전부 여기 안에 있다.',
  'mcp:v2/ledger.ts':
    'v2 원장의 관문. reducer 의 appendEventGuarded 만 부르고, 그것을 부르는 것은 미러와 bridge 뿐이다.',
  'mcp:v3/store.ts':
    '웹앱이 읽는 semantic-v3.jsonl — v1 원장이 아니라 다른 파일이고, 자체 durableAppend 를 갖는다.',
  'plugin:scripts/decision-ledger.js':
    '플러그인 쪽 원장 쓰기의 유일한 관문. 패키지 경계로 import 이 불가능해 같은 프로토콜을 두 번째로 구현한 자리.',
  'plugin:scripts/push-webapp.js':
    '웹앱에서 끌어온 사건을 같은 원장에 붙인다. 2026-08-09 에 맨 appendFileSync 에서 락+치유+fsync 로 수리됐다.',
};

/**
 * 원장이 아닌 것에 붙이는 자리. 스캐너를 일부러 넓게 잡았기 때문에 (파일명으로
 * 고르면 변수 이름만 바꿔도 새 writer 가 빠져나간다 — 이 저장소가 두 번 당한
 * "이름으로 판단하기") 원장과 무관한 append 도 여기 걸린다. 그것도 적는다:
 * append 는 되돌릴 수 없는 쓰기라, 어디서 하는지는 셀 수 있어야 한다.
 */
const OTHER_APPENDERS: Record<string, string> = {
  'mcp:lib/privacy.ts':
    '.argus/.gitignore 에 한 줄 보탠다 (원장을 git 밖에 두는 자리). 원장 파일이 아니다.',
  'plugin:evals/detection/auto-detect-eval.mjs':
    '탐지 평가의 추세 파일(auto-detect-trend.jsonl)에 회차를 붙인다. 계측기이고 제품 경로가 아니다.',
};

const ALL_APPENDERS = { ...LEDGER_WRITERS, ...OTHER_APPENDERS };

/** 문자열·주석 안의 낱말이 아니라 실제 호출만 보려고 주석을 먼저 걷어낸다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** 파일에 append 원시 호출이 있으면 그 줄들을 돌려준다. */
function appendSites(file: string): string[] {
  const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
  const hits: string[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const isAppendOpen = /\bopenSync\s*\(/.test(line) && /(O_APPEND|,\s*['"]a\+?['"]\s*[),])/.test(line);
    const isAppendFile = /\bappendFile(Sync)?\s*\(/.test(line);
    const isAppendStream = /createWriteStream\s*\(/.test(line) && /flags\s*:\s*['"]a/.test(line);
    if (isAppendOpen || isAppendFile || isAppendStream) hits.push(`${i + 1}: ${line}`);
  });
  return hits;
}

function walk(dir: string, keep: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.claude') continue;
      out.push(...walk(full, keep));
    } else if (keep(full)) out.push(full);
  }
  return out;
}

describe('관문 단일성 — 파일에 줄을 붙이는 자리는 목록에 적힌 것뿐이다', () => {
  function scan(): Record<string, string[]> {
    const found: Record<string, string[]> = {};
    const mcpFiles = walk(MCP_SRC, (f) =>
      f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.includes(`${path.sep}__tests__${path.sep}`));
    const pluginFiles = walk(PLUGIN, (f) =>
      (f.endsWith('.js') || f.endsWith('.mjs')) && !/\.test\.(m?js)$/.test(f) && !path.basename(f).startsWith('test-'));
    // 스캐너가 빈손이면 그 자체가 실패다 — 조용히 0건을 통과로 읽지 않는다.
    expect(mcpFiles.length).toBeGreaterThan(50);
    expect(pluginFiles.length).toBeGreaterThan(10);
    for (const f of mcpFiles) {
      const sites = appendSites(f);
      if (sites.length) found[`mcp:${path.relative(MCP_SRC, f).replace(/\\/g, '/')}`] = sites;
    }
    for (const f of pluginFiles) {
      const sites = appendSites(f);
      if (sites.length) found[`plugin:${path.relative(PLUGIN, f).replace(/\\/g, '/')}`] = sites;
    }
    return found;
  }

  it('목록 밖의 파일이 append 하지 않는다 (여섯 번째 writer 가 조용히 태어나지 않는다)', () => {
    expect(Object.keys(scan()).sort()).toEqual(Object.keys(ALL_APPENDERS).sort());
  });

  it('목록에 죽은 이름이 남지 않는다 (적어놓고 지운 자리는 목록에서도 지운다)', () => {
    const found = scan();
    for (const name of Object.keys(ALL_APPENDERS)) {
      expect(found[name], `${name} 은 목록에 있는데 실제 append 가 없다`).toBeTruthy();
    }
  });

  it('원장에 쓰는 자리는 다섯이고, 그중 셋이 같은 ledger.jsonl 을 쓴다 (두 패키지 이중 구현)', () => {
    expect(Object.keys(LEDGER_WRITERS)).toHaveLength(5);
    const v1 = ['mcp:lib/ledger-append.ts', 'plugin:scripts/decision-ledger.js', 'plugin:scripts/push-webapp.js'];
    for (const w of v1) expect(LEDGER_WRITERS[w]).toBeTruthy();
  });

  it('목록의 모든 자리에 이유가 한 문장씩 적혀 있다 (이름만 더하는 것을 막는다)', () => {
    for (const [file, why] of Object.entries(ALL_APPENDERS)) {
      expect(why.length, `${file} 의 이유가 너무 짧다`).toBeGreaterThan(20);
    }
  });
});

describe('미러는 관문 안에서만 돈다 — 도구별 이중 쓰기가 되살아나지 않는다', () => {
  /**
   * 2026-08 이전에는 도구마다 v2 미러를 기억해서 불렀고, `defer` 경로가
   * 조용히 샜다. 근본 수리는 "v1 쓰기의 유일한 관문이 미러도 부른다" 였다.
   * 도구가 mirrorV1Events 를 다시 직접 부르기 시작하면 그 수리가 풀린다.
   */
  it('mirrorV1Events 를 부르는 것은 ledger-append.ts 하나뿐이다', () => {
    const files = walk(MCP_SRC, (f) =>
      f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.includes(`${path.sep}__tests__${path.sep}`));
    const importers = files
      .filter((f) => /import\s*\{[^}]*\bmirrorV1Events\b/.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(MCP_SRC, f).replace(/\\/g, '/'));
    expect(importers).toEqual(['lib/ledger-append.ts']);
  });
});

describe('새 도구는 원장에 손을 못 댄다', () => {
  it('src/tools/ 어느 파일도 append 원시 호출을 갖지 않는다 (전부 appendLedger 경유)', () => {
    const tools = walk(path.join(MCP_SRC, 'tools'), (f) =>
      f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.includes(`${path.sep}__tests__${path.sep}`));
    const offenders = tools
      .map((f) => [path.relative(MCP_SRC, f).replace(/\\/g, '/'), appendSites(f)] as const)
      .filter(([, sites]) => sites.length > 0);
    expect(offenders).toEqual([]);
  });
});
