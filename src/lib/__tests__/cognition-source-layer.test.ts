import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 입력 계층이 무너지지 않게 지키는 가드.
 *
 * 2026-08-18: 사용자에게 `.jsonl` 파일을 직접 고르라고 하는 화면을 냈다. 이
 * 저장소에는 훅이 경로를 자동으로 넘겨주는 수집 파이프라인이 이미 있었는데도.
 * 산문으로 "자동을 먼저"라고 적어두면 다음 사람이 다시 뒤집는다.
 */
const ROOT = process.cwd();
const SOURCES = join(ROOT, 'src/lib/cognition/sources.ts');
const PAGE = join(ROOT, 'src/app/method-pilot/frames/page.tsx');

const read = (p: string) => readFileSync(p, 'utf8');

describe('입력 계층 — 마찰이 낮은 것이 먼저 온다', () => {
  it('화면은 소스 목록·순서를 스스로 정하지 않고 sources.ts 에서 받는다', () => {
    const page = read(PAGE);
    expect(page).toContain('SOURCES');
    expect(page).toContain('DEFAULT_SOURCE');
    // 화면 안에 소스 id 배열을 직접 적어두면 순서가 두 곳에 생겨 갈라진다.
    expect(page).not.toMatch(/\[\s*'plugin_auto'\s*,/);
  });

  it('파일 고르기는 기본값이 아니다', () => {
    expect(read(PAGE)).not.toMatch(/useState<SourceId>\(\s*'file'\s*\)/);
    expect(read(SOURCES)).toMatch(/id:\s*'plugin_auto',\s*\n\s*clicks:\s*0/);
  });

  it('추출기는 입력을 소유하지 않는다 — 파일·붙여넣기 개념이 extract.ts 에 없다', () => {
    const extract = read(join(ROOT, 'src/lib/cognition/extract.ts'));
    expect(extract).not.toContain('File');
    expect(extract).not.toContain('FileReader');
    expect(extract).not.toContain('input type');
  });
});

describe('세 값짜리 저자 판정을 조건문에 그냥 넣지 않는다', () => {
  /**
   * `quoted_from_ai` 는 'yes'|'no'|'unknown' 이다. 셋 다 truthy 문자열이라
   * `if (c.quoted_from_ai)` 는 항상 참이다. boolean 이던 시절의 호출부가
   * **타입 검사를 통과한 채로 조용히 뒤집힌** 실제 사례가 있었다.
   */
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '__tests__') continue;
        walk(p);
      } else if (/\.tsx?$/.test(e.name)) files.push(p);
    }
  };
  walk(join(ROOT, 'src'));

  it('extract.ts 밖에서는 반드시 === 로 비교하거나 isAiWorded/authorLine 을 쓴다', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (f.endsWith('cognition/extract.ts')) continue;
      const body = read(f);
      for (const line of body.split('\n')) {
        if (!line.includes('quoted_from_ai')) continue;
        const code = line.trim();
        // 주석은 통과.
        if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) continue;
        // **그 필드 자체**를 비교하거나, 객체 리터럴의 키로 쓰거나, 타입 선언인
        // 경우만 통과. 줄 아무 데나 === 가 있으면 봐주던 첫 판은 실제 버그 줄
        // `c.who === 'ai' || c.quoted_from_ai` 를 그냥 통과시켰다 — 가드가
        // 한 번도 빨간불이 된 적 없으면 지킨다는 증거가 없다.
        if (/quoted_from_ai\s*(===|!==)/.test(code)) continue;
        if (/quoted_from_ai\s*:/.test(code)) continue;
        offenders.push(`${f.replace(ROOT + '/', '')}: ${code}`);
      }
    }
    expect(offenders, `세 값을 조건문에 그냥 넣은 곳: ${offenders.join(' | ')}`).toEqual([]);
  });
});
