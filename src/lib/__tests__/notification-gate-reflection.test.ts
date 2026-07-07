import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function route(path: string): string {
  return readFileSync(join(process.cwd(), 'src/app/api/cron', path, 'route.ts'), 'utf8');
}

describe('notification gate reflection', () => {
  it.each([
    ['checkin-due', 'T1_RETURN'],
    ['telegram-reminders', 'T1_RETURN'],
    ['companion-brief', 'T5_WEEKLY_BRIEF'],
    ['premise-watch', 'T2_PREMISE_DRIFT'],
  ])('%s user-facing sends pass through the gate as %s', (name, type) => {
    const source = route(name);
    expect(source).toContain('@/lib/notification-gate');
    expect(source).toContain('notificationGateAllowsSend');
    expect(source).toContain(`type: '${type}'`);
  });

  it('checkin-due also routes the T4 first-settlement invitation through the gate', () => {
    const source = route('checkin-due');
    expect(source).toContain('isFirstSettlementInviteDue');
    expect(source).toContain(`type: 'T4_FIRST_SETTLEMENT'`);
  });

  it('keeps non-user-facing crons explicitly exempt instead of silently bypassing the gate', () => {
    expect(route('daily-report')).toContain('NOTIFICATION_GATE_EXEMPT_OWNER_REPORT');
    expect(route('expire-tokens')).toContain('NOTIFICATION_GATE_NO_USER_SEND');
  });
});
