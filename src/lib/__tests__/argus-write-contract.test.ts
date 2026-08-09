/**
 * service-role 쓰기 계약 — `argus_*` 에 없는 컬럼을 쓰지 못하게 한다.
 *
 * **왜 이 파일이 따로 있는가.** `schema-drift.test.ts` 는 `db.ts` 의 동기화
 * 인터페이스(`sanitizeItem` 경로)를 지킨다. 그런데 원격 MCP·TWIN·크론은
 * `adminClient()` 로 `argus_*` 에 **직접** 쓴다 — 설계상 정상이지만, 그래서
 * 기존 가드가 하나도 덮지 않는 구간이다. 그리고 대표님의 첫 결정이 지나가는
 * 길이 정확히 여기다.
 *
 * **무엇이 조용한가.** 없는 컬럼을 하나라도 끼우면 PostgREST 는 그 필드만
 * 무시하는 것이 아니라 **행 전체를 PGRST204 로 거부한다.** 그리고 이 경로들은
 * 대부분 `if (error)` 를 로그로만 넘긴다 — 정산이 이미 원장에 들어갔으므로
 * 캐시 실패를 사용자 실패로 보이게 하면 안 되기 때문이고, 그 판단 자체는
 * 옳다. 결과적으로 화면도 멀쩡하고, 테스트도 초록이고, 빌드도 통과하는데
 * **그 사용자의 데이터만 서버에 영영 안 닿는다.** CLAUDE.md 가 "네 가지 모두
 * 실제로 겪은 조용한 실패"라고 적어 둔 바로 그 부류다.
 *
 * 이 가드는 컬럼 **존재**만 본다. 타입·NOT NULL·RLS 는 보지 않는다 — 필요조건
 * 이지 충분조건이 아니라는 뜻이고, 그 경계를 여기 적어 둔다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'supabase/migrations';

// ── 1. 마이그레이션이 실제로 만드는 컬럼 ────────────────────────────────────

/**
 * `create table` 본문과 `alter table … add column` 을 모두 읽는다.
 *
 * 다중 컬럼 ALTER 를 놓치지 않는 것이 중요하다. 이 리포의 실제 마이그레이션이
 * `add column a, add column b, add column c` 형태를 쓰는데, 첫 개만 잡는
 * 스캐너는 **있는 컬럼을 없다고 보고한다** — 그런 가드는 없느니만 못하다
 * (내가 초안에서 정확히 그 오탐을 냈다).
 */
function definedColumns(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (table: string, col: string) => {
    if (!out.has(table)) out.set(table, new Set());
    out.get(table)!.add(col);
  };

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    // 줄 주석 제거 — 주석 속 DDL 예시가 실재 컬럼으로 등록되면, 없는 컬럼을
    // 있다고 믿어 **가드가 통과시키면 안 될 것을 통과시킨다**(위험한 방향의
    // 오류다). `erasure-coverage.test.ts` 가 같은 이유로 같은 처리를 한다.
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8').replace(/--[^\n]*/g, '');

    // create table … ( … );
    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(argus_[a-z_]+)\s*\(([\s\S]*?)\n\)\s*;/gi,
    )) {
      const table = m[1].toLowerCase();
      for (const raw of m[2].split('\n')) {
        const line = raw.trim();
        const cm = /^([a-z_][a-z0-9_]*)\s+/.exec(line);
        if (!cm) continue;
        if (['constraint', 'primary', 'unique', 'foreign', 'check', 'references', 'exclude'].includes(cm[1])) continue;
        add(table, cm[1]);
      }
    }

    // alter table … add column [if not exists] x …, add column y …;
    for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:public\.)?(argus_[a-z_]+)\s+([\s\S]*?);/gi)) {
      const table = m[1].toLowerCase();
      for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)) {
        add(table, c[1]);
      }
    }
  }
  return out;
}

// ── 2. 코드가 실제로 쓰는 필드 ──────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

/** 괄호 균형을 맞춰 호출 인자 원문을 떼어 낸다. */
function balanced(text: string, openIndex: number): string {
  let depth = 1;
  let i = openIndex;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    i += 1;
  }
  return text.slice(openIndex, i - 1);
}

/**
 * 객체 리터럴의 **최상위** 키만 뽑는다.
 *
 * 중첩 객체와 템플릿 문자열 안을 먼저 비운다. 안 그러면 `content: \`… ${key} …\``
 * 의 `key` 를 컬럼으로 착각한다 (초안이 낸 두 번째 오탐).
 */
function topLevelKeys(arg: string): string[] {
  const body = arg.trim();
  if (!body.startsWith('{')) return []; // 변수를 넘기는 형태는 정적으로 못 본다

  let masked = '';
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '`' || ch === "'" || ch === '"') {
      const quote = ch;
      masked += ' ';
      i += 1;
      while (i < body.length) {
        if (body[i] === '\\') { masked += '  '; i += 2; continue; }
        if (body[i] === quote) break;
        masked += ' ';
        i += 1;
      }
      masked += ' ';
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    // 최상위(= 바깥 중괄호 안, 깊이 1)의 문자만 남기고 나머지는 지운다.
    masked += depth === 1 || (depth === 0 && (ch === '{' || ch === '}')) ? ch : ' ';
    i += 1;
  }

  const keys = new Set<string>();
  for (const m of masked.matchAll(/(?:^|[{,])\s*([a-z_][a-z0-9_]*)\s*:/g)) keys.add(m[1]);
  // 축약 표기 `{ user_id, case_id }`
  for (const m of masked.matchAll(/(?:^|[{,])\s*([a-z_][a-z0-9_]*)\s*(?=[,}])/g)) keys.add(m[1]);
  return [...keys];
}

interface WriteSite {
  file: string;
  table: string;
  op: string;
  keys: string[];
}

function writeSites(sources: string[]): WriteSite[] {
  const sites: WriteSite[] = [];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/from\(\s*'(argus_[a-z_]+)'\s*\)\s*\.\s*(insert|upsert|update)\s*\(/g)) {
      const arg = balanced(text, m.index + m[0].length);
      const keys = topLevelKeys(arg);
      if (keys.length > 0) sites.push({ file, table: m[1], op: m[2], keys });
    }
  }
  return sites;
}

// ── 3. 대조 ─────────────────────────────────────────────────────────────────

const DEFINED = definedColumns();
const SOURCES = walk('src');
const SITES = writeSites(SOURCES);

describe('argus_* service-role 쓰기 계약', () => {
  it('스캐너가 실제로 무언가를 읽었다 (경로가 바뀌면 조용히 무력해지는 것을 막는다)', () => {
    expect(DEFINED.size).toBeGreaterThan(8);
    expect(DEFINED.get('argus_cases')?.has('settled_at')).toBe(true);
    // 다중 컬럼 ALTER 를 실제로 읽었는가 — 같은 문장의 네 번째 컬럼.
    expect(DEFINED.get('argus_cases')?.has('choice')).toBe(true);
    expect(SITES.length).toBeGreaterThan(15);
  });

  it('쓰는 필드가 전부 마이그레이션에 존재한다', () => {
    const bad: string[] = [];
    for (const s of SITES) {
      const known = DEFINED.get(s.table);
      if (!known) {
        bad.push(`${s.file}\n    ${s.table} — 마이그레이션에 이 테이블의 정의가 없습니다`);
        continue;
      }
      const unknown = s.keys.filter((k) => !known.has(k)).sort();
      if (unknown.length > 0) {
        bad.push(`${s.file}\n    ${s.table}.${s.op} → 없는 컬럼: ${unknown.join(', ')}`);
      }
    }
    expect(
      bad,
      '없는 컬럼에 쓰고 있습니다. PostgREST 는 그 필드만 버리는 것이 아니라 **행 전체를**\n' +
        'PGRST204 로 거부하고, 이 경로들은 에러를 로그로만 넘기므로 화면은 멀쩡한 채\n' +
        `데이터만 서버에 안 닿습니다. 같은 커밋에 마이그레이션을 추가하십시오:\n${bad.join('\n')}`,
    ).toEqual([]);
  });

  it('객체가 아니라 변수를 넘기는 쓰기는 몇 건인지 밝힌다 (이 가드가 못 보는 것)', () => {
    // 정적으로 볼 수 없는 구간을 **숫자로 드러낸다.** 침묵하면 "전부 검사됐다"로
    // 읽히고, 그것이 이 리포가 반복해서 당한 착시다.
    let opaque = 0;
    for (const file of SOURCES) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/from\(\s*'(argus_[a-z_]+)'\s*\)\s*\.\s*(insert|upsert|update)\s*\(/g)) {
        if (topLevelKeys(balanced(text, m.index + m[0].length)).length === 0) opaque += 1;
      }
    }
    // 늘어나는 것 자체는 결함이 아니지만, 늘면 이 가드의 사각지대가 넓어진다.
    expect(opaque, `정적으로 필드를 볼 수 없는 쓰기가 ${opaque}건입니다`).toBeLessThanOrEqual(6);
  });

  it('가드가 실제로 문다 — 가짜 컬럼을 넣으면 잡아낸다', () => {
    // 통과하는 가드가 **일하고 있다는 증거**는 이것뿐이다. 이 리포는 통과하지만
    // 아무것도 검사하지 않는 스캐너를 이미 여러 번 만들었다.
    const fake: WriteSite = {
      file: 'fake.ts',
      table: 'argus_cases',
      op: 'insert',
      keys: ['user_id', 'definitely_not_a_column'],
    };
    const known = DEFINED.get(fake.table)!;
    expect(fake.keys.filter((k) => !known.has(k))).toEqual(['definitely_not_a_column']);
  });

  it('키 추출이 템플릿 문자열과 중첩 객체를 컬럼으로 착각하지 않는다', () => {
    const arg = "{ user_id: userId, content: `답: ${key} · 실제: ${truth}`, meta: { nested_key: 1 } }";
    expect(topLevelKeys(arg).sort()).toEqual(['content', 'meta', 'user_id']);
  });
});
