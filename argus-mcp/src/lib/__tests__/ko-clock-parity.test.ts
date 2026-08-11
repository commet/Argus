/**
 * 거절이 오늘을 말하는 것은 **언어와 무관해야 한다.**
 *
 * WHY. 한국어 페르소나로 처음 여정을 돌려서 발견했다 (KOC8, 2026-08-11).
 * 영어 BAD_CHECK_BY 메시지는 "(today is 2026-08-11)"로 끝난다. 그런데
 * `KO_ERRORS`는 코드별 **정적 문자열**이라 메시지를 통째로 갈아끼우고, 그
 * 과정에서 날짜가 사라졌다. 그래서 한국어 호출자는 "날짜가 틀렸다"는 말만
 * 듣고 오늘이 언제인지는 끝내 듣지 못했다.
 *
 * 그 어시스턴트는 학습 연도에서 하루씩 더듬었다 —
 * 2025-06-17 → 2025-06-18 → 2025-06-24 → 2026-06-01 — **네 번 연속 실패**했고,
 * 그 여정은 기록 0건으로 끝났다. 날짜는 전체 거절의 44%로 1위인 실패이고,
 * 한국어 사용자는 그 1위 실패에서 영어 사용자보다 **엄격히 나쁜 안내**를
 * 받고 있었다. 언어를 바꿔 돌려보기 전에는 아무도 볼 수 없는 종류의 결함이다.
 *
 * 무엇이 이걸 빨간불로 만드는가: 어느 한 언어의 거절이 오늘을 말하지 않게
 * 되는 것. 지역화 맵은 문구를 바꿔도 되지만 **복구에 필요한 사실을 지울 수는
 * 없다.**
 */
import { describe, expect, it } from 'vitest';
import { localizeToolResult } from '../localize-result.js';
import { seal } from '../../tools/seal.js';
import { tmpArgusDir } from '../../test-helpers.js';

const TODAY = '2026-08-11';
const PAST = '2025-06-17'; // KOC8이 실제로 보낸 값 (모델의 학습 연도)

async function refuse(predicate: string) {
  const dir = tmpArgusDir();
  const args = {
    argus_dir: dir, id: 'clock', predicate,
    check_by: PAST, predicate_owner: 'user', today_override: TODAY,
  };
  const raw = await seal.handler(args);
  return localizeToolResult(args, raw).structuredContent as Record<string, unknown>;
}

describe('BAD_CHECK_BY는 두 언어 모두에서 오늘을 말한다', () => {
  it('영어 예측문', async () => {
    const sc = await refuse('the cutover finishes with no data loss');
    expect(sc['error_code']).toBe('BAD_CHECK_BY');
    expect(String(sc['message'])).toContain(TODAY);
  });

  it('한국어 예측문 — 지역화가 날짜를 지우지 못한다', async () => {
    const sc = await refuse('컷오버가 데이터 유실 없이 끝난다');
    expect(sc['error_code']).toBe('BAD_CHECK_BY');
    expect(String(sc['message'])).toMatch(/[가-힣]/); // 한국어로 답하고
    expect(String(sc['message'])).toContain(TODAY);   // 오늘도 함께
  });

  it('시계는 별도 필드로도 실려 문구가 바뀌어도 남는다', async () => {
    const sc = await refuse('컷오버가 데이터 유실 없이 끝난다');
    expect(sc['today']).toBe(TODAY);
  });

  it('날짜를 두 번 말하지 않는다', async () => {
    const sc = await refuse('the cutover finishes with no data loss');
    expect(String(sc['message']).split(TODAY).length - 1).toBe(1);
  });
});
