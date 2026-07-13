/**
 * 도구 참조 무결성 (도그푸딩 발견 F6, 2026-07-12).
 *
 * 도그푸딩에서 발견: 사용자 대면 문구 3곳이 `argus_snooze`를 가리켰는데
 * 그런 MCP 도구는 등록돼 있지 않았다 — 사용자/모델이 부르면 없는 도구라
 * 실패하는 깨진 배선. 실제 "미루기"는 argus_settle의 still_pending이다.
 *
 * 이 테스트가 그 부류를 영구 차단한다: 사용자 대면 surface(surfaces.ts)와
 * v2 projection이 언급하는 모든 `argus_<tool>` 이름이 실제 등록된 도구여야
 * 한다. (LLM-glue invariant: 존재하지 않는 것을 가리키는 문자열은 조용히
 * 통과하므로, 대조를 테스트로 loud하게 만든다.)
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS } from '../index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '..', '..');

const REGISTERED = new Set(TOOLS.map((t) => t.name));
// 데이터 모델·문서에만 존재하고 사용자에게 도구로 노출되지 않는 이름
// (예: v2 이벤트명, config 키)은 도구 참조가 아니므로 대조 대상이 아니다.
// 아래 목록은 "도구처럼 생겼지만 도구가 아닌, 알려진 비-도구 토큰".
const KNOWN_NON_TOOLS = new Set<string>([]);

/** 파일 텍스트에서 argus_<snake> 도구 토큰을 뽑는다. `_`로 끝나는 것은
 *  도구명이 아니라 접두사(예: PAT 형식 `argus_pat_`)이므로 제외한다. */
function toolMentions(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\bargus_[a-z]+(?:_[a-z]+)*\b/g)) {
    if (!m[0].endsWith('_')) out.add(m[0]);
  }
  return [...out];
}

describe('도구 참조 무결성 — 없는 도구를 가리키는 surface 금지 (F6)', () => {
  it('중앙 surfaces.ts가 언급하는 argus_* 도구는 전부 등록돼 있다', () => {
    const text = fs.readFileSync(path.join(SRC, 'lib', 'surfaces.ts'), 'utf8');
    const bad = toolMentions(text).filter((t) => !REGISTERED.has(t) && !KNOWN_NON_TOOLS.has(t));
    expect(bad, `등록되지 않은 도구 참조: ${bad.join(', ')}`).toEqual([]);
  });

  it('v2 projection(LOGBOOK 렌더)이 언급하는 argus_* 도구는 전부 등록돼 있다', () => {
    const text = fs.readFileSync(path.join(SRC, 'v2', 'logbook.ts'), 'utf8');
    const bad = toolMentions(text).filter((t) => !REGISTERED.has(t) && !KNOWN_NON_TOOLS.has(t));
    expect(bad, `등록되지 않은 도구 참조: ${bad.join(', ')}`).toEqual([]);
  });

  it('argus_snooze는 등록된 도구가 아니다 (F6의 근원 — 미루기는 settle still_pending)', () => {
    expect(REGISTERED.has('argus_snooze')).toBe(false);
    // 이 사실을 아는 상태로, 위 두 대조가 argus_snooze를 절대 통과시키지 않는다.
  });
});
