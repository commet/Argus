/**
 * 표면 em-dash 금지 게이트 (도그푸딩 발견 F10, 2026-07-12).
 *
 * 창업자 확정 하우스 스타일: em-dash(—) cadence 영구 금지. `npm run copy`
 * 감사는 이를 세지만 CI를 막지는 않아, 8건이 조용히 살아남아 있었다 —
 * still_pending 정산마다 뜨는 `settle.deferred` 포함. LLM-glue invariant:
 * "리포트만 하고 막지 않는 게이트"는 조용한 품질 저하 경로다. 그래서
 * 리포트를 loud한 테스트로 승격한다.
 *
 * 대조 대상은 사용자 대면 surface 값(SURFACES 트리의 잎)만이다 — 소스
 * 주석의 em-dash는 사용자에게 안 보이므로 대상이 아니다. 함수형 잎은
 * 템플릿 리터럴 본문(주석 없음)을 소스로 검사한다(copy-audit.mjs와 동일).
 */
import { describe, it, expect } from 'vitest';
import { SURFACES } from '../surfaces.js';

/** SURFACES 트리를 걸어 잎마다 [경로, 원문]을 모은다. 문자열 잎은 그대로,
 *  함수 잎은 .toString() 소스(템플릿 본문 = 실제 렌더 문자열의 정본)를 본다. */
function collectLeaves(node: unknown, prefix: string, out: Array<{ path: string; raw: string }>): void {
  if (typeof node === 'string') { out.push({ path: prefix, raw: node }); return; }
  if (typeof node === 'function') { out.push({ path: prefix, raw: (node as (...a: unknown[]) => unknown).toString() }); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      collectLeaves(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

// 금지 대상은 em-dash **cadence** — 앞선 산문에 붙어 절을 잇는 리듬 장치
// ("A 문장 — B 문장", #1 AI/hip 냄새). 앞에 내용이 있는 em-dash만 잡는다.
// receipt.skipped의 `— (none)`처럼 값의 "없음" 글리프로 쓰인 선행 em-dash는
// cadence가 아니므로 대상이 아니다(copy-audit이 receipt를 안 걷는 것과 동일
// 의도). 이 게이트는 그 대신 SURFACES 전체(영수증 포함)를 cadence로 훑어
// copy-audit 사각을 메운다.
const CADENCE = /\S[^—]*—/;

describe('표면 카피 — em-dash cadence 금지 (F10)', () => {
  it('SURFACES의 어떤 사용자 대면 잎도 em-dash cadence를 쓰지 않는다', () => {
    const leaves: Array<{ path: string; raw: string }> = [];
    collectLeaves(SURFACES, '', leaves);
    const offenders = leaves.filter((l) => CADENCE.test(l.raw)).map((l) => l.path);
    expect(offenders, `em-dash cadence가 남은 표면: ${offenders.join(', ')}`).toEqual([]);
  });
});
