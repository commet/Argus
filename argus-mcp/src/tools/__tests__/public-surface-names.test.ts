/**
 * 호스트-대면 표면 이름 가드 — 내부 전용 도구 이름이 사용자·모델이 보는 곳으로
 * 새지 않게 CI가 막는다. 런타임 도구 호출 결과는 rewriteResult/publicCopy가 이미
 * 공개 이름으로 번역하지만, tools/list가 내보내는 스키마·설명과 initialize의
 * instructions는 그 층을 안 거쳐 — 여기서 그 사각을 메운다.
 *
 * 규칙(창업자 확정): 원장 이벤트 이름('seal' 등)과 내부 핸들러 이름은 데이터
 * 호환을 위해 유지하되, 그것들이 호스트 표면으로 새면 안 된다. 새 이름이 생기면
 * 이 목록만 갱신한다.
 */
import { describe, expect, it } from 'vitest';
import { servedPublicTools, PUBLIC_TOOLS } from '../index.js';
import { SERVER_INSTRUCTIONS } from '../../lib/spine.js';

// 호스트가 실제로 보는 공개 이름.
const PUBLIC = new Set(PUBLIC_TOOLS.map((t) => t.name));
// 내부 전용(핸들러/레거시) 이름 — 호스트 표면엔 절대 나오면 안 된다.
const INTERNAL_ONLY = [
  'argus_seal', 'argus_settle', 'argus_open_decision', 'argus_premises', 'argus_recall',
  'argus_watch', 'argus_recheck', 'argus_amend', 'argus_dismiss', 'argus_review',
  'argus_config', 'argus_sync', 'argus_init', 'argus_candidates',
  // 통일 전 옛 공개 이름 — 이제 내부일 뿐, 표면에 다시 나오면 안 된다.
  'argus_clarify_decision', 'argus_save_prediction', 'argus_record_result',
  'argus_history', 'argus_review_document',
].filter((n) => !PUBLIC.has(n));

/** 내부 이름 뒤에 [a-z0-9_]가 오면 더 긴 공개 이름의 접두사이므로 제외
 *  (argus_review ⊂ argus_review_document, argus_seal ⊄ 아무것). */
function leaks(haystack: string, name: string): boolean {
  return new RegExp(name + '(?![a-z0-9_])').test(haystack);
}

describe('호스트-대면 표면에 내부 이름 누수 없음', () => {
  it('tools/list 산출물(이름·제목·설명·입력스키마)에 내부 이름이 없다', () => {
    const served = JSON.stringify(servedPublicTools());
    for (const name of INTERNAL_ONLY) {
      expect(leaks(served, name), `tools/list가 "${name}"을 노출함`).toBe(false);
    }
  });

  it('initialize instructions(모델이 읽는 지시)에 내부 이름이 없다', () => {
    for (const name of INTERNAL_ONLY) {
      expect(leaks(SERVER_INSTRUCTIONS, name), `instructions가 "${name}"을 노출함`).toBe(false);
    }
  });

  it('공개 표면은 정확히 목적별 7개 이름이다 (내부와 분리)', () => {
    expect([...PUBLIC].sort()).toEqual([
      'argus_capture', 'argus_check_in', 'argus_patterns',
      'argus_predict', 'argus_resolve', 'argus_settings',
    ]);
  });

  it('keeps the full MCP harness within a deterministic context budget', () => {
    expect(Buffer.byteLength(JSON.stringify(servedPublicTools()), 'utf8')).toBeLessThanOrEqual(16_000);
    expect(Buffer.byteLength(SERVER_INSTRUCTIONS, 'utf8')).toBeLessThanOrEqual(2_000);
  });

  it('종결 도구는 웹과 같은 닫는 고리 닻 아이콘을 광고한다', () => {
    const resolve = servedPublicTools().find((tool) => tool['name'] === 'argus_resolve');
    expect(resolve?.['icons']).toEqual([
      expect.objectContaining({
        src: 'https://argus.voyage/images/voyage/closing-anchor-icon-48.png',
        mimeType: 'image/png',
        sizes: ['48x48'],
      }),
      expect.objectContaining({ sizes: ['96x96'] }),
    ]);
  });
});
