import { describe, expect, it } from 'vitest';
import { loopPulse, EXPECTED_DAILY_CRONS } from '../loop-pulse';

/**
 * 루프 맥박 가드 (2026-07-30) — "루프가 꺼지면 알게 된다"의 기계 반쪽.
 *
 * 빨간불 조건:
 *   · 빠진 크론이 missing 에 안 잡히는 것 (심장이 멎었는데 정상 보고)
 *   · 기대 목록이 vercel.json 의 크론 실체와 어긋나는 것
 */

describe('loopPulse', () => {
  it('어제 다 돌았으면 ok — 다른 이벤트가 섞여 있어도', () => {
    const p = loopPulse([...EXPECTED_DAILY_CRONS, 'session_start', 'seal_committed']);
    expect(p.ok).toBe(true);
    expect(p.missing).toEqual([]);
    expect(p.seen).toHaveLength(EXPECTED_DAILY_CRONS.length);
  });

  it('하나라도 흔적이 없으면 그 이름이 missing 에 잡힌다', () => {
    const names = EXPECTED_DAILY_CRONS.filter((n) => n !== 'cron_premise_watch');
    const p = loopPulse(names);
    expect(p.ok).toBe(false);
    expect(p.missing).toEqual(['cron_premise_watch']);
  });

  it('아무 흔적도 없으면 전부 missing (앱은 살았는데 크론만 죽은 날)', () => {
    const p = loopPulse(['session_start']);
    expect(p.ok).toBe(false);
    expect(p.missing).toHaveLength(EXPECTED_DAILY_CRONS.length);
  });

  it('기대 목록은 vercel.json 의 일일 크론 + anon_cleanup 과 짝이다', () => {
    // 크론을 새로 달면 여기와 vercel.json 을 같이 고쳐야 한다 — 한쪽만 고치면
    // 새 크론이 죽어도 맥박이 정상이라 말한다.
    expect([...EXPECTED_DAILY_CRONS].sort()).toEqual([
      'anon_cleanup',
      'cron_checkin_due',
      'cron_companion_brief',
      'cron_premise_watch',
      'cron_telegram_reminders',
    ]);
  });
});
