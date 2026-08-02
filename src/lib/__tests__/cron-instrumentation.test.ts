import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 크론은 흔적을 남긴다 (2026-07-29 신설).
 *
 * 왜: 이 리포의 북극성은 **봉인 → 확인일 → 알림 → 정산 완주**인데, 2026-07-29까지
 * 크론 4개(checkin-due · companion-brief · premise-watch · telegram-reminders)가
 * **아무것도 기록하지 않았다.** `user_events` 에 `decision_sealed` 는 18건 쌓여
 * 있는데, "그래서 확인일에 알림이 갔는가"를 물으면 답할 데이터가 없었다.
 * 가운데 칸에 계기가 없으면 완주율은 영원히 추측이다.
 *
 * Vercel 런타임 로그는 대안이 아니다: 좁은 창으로만 조회되고 며칠이면 사라지며,
 * 무엇보다 `{ok:true, disabled:true}` 로 빠져나간 200 과 실제로 일한 200 을
 * 구분해주지 않는다 (전제 감시에서 실제로 겪은 혼동).
 *
 * 이 가드가 빨간불이 되는 조건: 크론 라우트가 하나 늘었는데 흔적을 안 남기는 것.
 */

const CRON_DIR = join(process.cwd(), 'src/app/api/cron');

/**
 * 흔적이 필요 없다고 판단한 크론은 여기 사유와 함께 적는다. 사유 없는 면제는 금지 —
 * 그게 이 파일이 막으려는 침묵이다.
 */
const WAIVED: Record<string, string> = {
  'expire-tokens':
    '사람에게 아무것도 보내지 않는 순수 정리 작업이고, 만료 결과는 human_agent_messages '
    + '의 status 로 그 자체가 조회 가능하다 — 별도 이벤트는 같은 사실의 두 번째 사본이 된다.',
  'daily-report':
    '이 크론의 산출물이 곧 보고서(창업자에게 가는 메일)라 실행 사실이 결과물에 이미 담긴다.',
};

function cronRoutes(): string[] {
  if (!existsSync(CRON_DIR)) return [];
  return readdirSync(CRON_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(CRON_DIR, d.name, 'route.ts')))
    .map((d) => d.name)
    .sort();
}

describe('크론은 자기가 돌았다는 흔적을 남긴다', () => {
  const routes = cronRoutes();

  it('크론 라우트를 실제로 찾는다 (빈손으로 통과하지 않는다)', () => {
    expect(routes).toContain('checkin-due');
    expect(routes.length).toBeGreaterThanOrEqual(4);
  });

  it('사람에게 무언가 보내는 크론은 모두 서버 이벤트를 남긴다', () => {
    const silent = routes.filter((name) => {
      if (name in WAIVED) return false;
      const src = readFileSync(join(CRON_DIR, name, 'route.ts'), 'utf8');
      return !src.includes('logServerEvent(') && !src.includes('persistServerEvent(');
    });
    expect(
      silent,
      `이 크론들은 돌고도 흔적을 남기지 않는다. "돌았는데 조용했다"와 "아예 안 돌았다"를 `
      + `구분할 수 없으면 완주율은 영원히 추측이다. 서버 이벤트를 남기거나, `
      + `사유와 함께 WAIVED 에 적어라: ${silent.join(', ')}`,
    ).toEqual([]);
  });

  it('면제에는 사유가 있다', () => {
    const unreasoned = Object.entries(WAIVED).filter(([, r]) => r.trim().length < 40).map(([n]) => n);
    expect(unreasoned).toEqual([]);
  });

  it('면제 목록에 유령이 없다 (사라진 크론을 계속 면제하지 않는다)', () => {
    const ghosts = Object.keys(WAIVED).filter((n) => !routes.includes(n));
    expect(ghosts, `면제 목록에 있는데 라우트가 없다: ${ghosts.join(', ')}`).toEqual([]);
  });

  it('귀환 루프의 심장(checkin-due)은 보낸 건수를 기록한다', () => {
    // 건수 없는 "돌았다"는 계기가 아니다 — 0통 보낸 밤과 5통 보낸 밤이 같아 보인다.
    const src = readFileSync(join(CRON_DIR, 'checkin-due', 'route.ts'), 'utf8');
    expect(src).toMatch(/await persistServerEvent\(\s*'cron_checkin_due'/);
    expect(src).toContain('candidates:');
    expect(src).toContain('sent');
  });

  it('귀환 알림은 성공한 프로젝트와 채널을 저장 완료까지 기다린다', () => {
    const emailBridge = readFileSync(join(CRON_DIR, 'checkin-due', 'route.ts'), 'utf8');
    const telegram = readFileSync(join(CRON_DIR, 'telegram-reminders', 'route.ts'), 'utf8');

    for (const src of [emailBridge, telegram]) {
      expect(src).toContain("await persistServerEvent('return_reminder_sent'");
      expect(src).toContain('project_id:');
      expect(src).toContain("channel: 'telegram'");
    }
    expect(emailBridge).toContain("channel: 'email'");
    expect(telegram).toContain('if (stampError) throw new Error');
  });
});
