import { describe, expect, it } from 'vitest';
import type { DecisionContract } from '@/stores/types';
import {
  buildFirstSettlementEmail,
  buildFirstSettlementUrl,
  firstSettlementAnchor,
  isFirstSettlementInviteDue,
} from '../first-settlement';

const contract = (patch: Partial<DecisionContract> = {}): DecisionContract => ({
  id: 'c1',
  project_id: 'p1',
  created_at: '2026-07-01T10:00:00.000Z',
  check_in_at: '2026-08-01T10:00:00.000Z',
  email_reminder: true,
  predicates: [{ id: 'pred_1', source: 'user_lean', text: '8월까지 가격을 올린다' }],
  judgment_receipt: {
    real_question: '가격을 올릴까?',
    unverified_assumption: '',
    human_only: '',
    human_judgment: '8월까지 가격을 올린다',
    check_by: '2026-08-01',
  },
  ...patch,
});

describe('first settlement invitation (T4)', () => {
  it('fires once on day 7 only for long-horizon sealed decisions', () => {
    expect(isFirstSettlementInviteDue(contract(), new Date('2026-07-08T09:00:00.000Z').getTime())).toBe(true);
    expect(isFirstSettlementInviteDue(contract(), new Date('2026-07-07T09:00:00.000Z').getTime())).toBe(false);
    expect(isFirstSettlementInviteDue(contract(), new Date('2026-07-09T09:00:00.000Z').getTime())).toBe(false);
    expect(isFirstSettlementInviteDue(contract({ check_in_at: '2026-07-18T10:00:00.000Z' }), new Date('2026-07-08T09:00:00.000Z').getTime())).toBe(false);
  });

  it('does not re-invite after a stamp, mute, or recorded first settlement', () => {
    const now = new Date('2026-07-08T09:00:00.000Z').getTime();

    expect(isFirstSettlementInviteDue(contract({ first_settlement_invited_at: '2026-07-08T00:00:00.000Z' }), now)).toBe(false);
    expect(isFirstSettlementInviteDue(contract({ first_settlement_muted: true }), now)).toBe(false);
    expect(isFirstSettlementInviteDue(contract({ lean_after: { view: 'same', recorded_at: '2026-07-08T00:00:00.000Z' } }), now)).toBe(false);
  });

  it('anchors on the user sealed sentence', () => {
    expect(firstSettlementAnchor(contract(), 'fallback')).toBe('8월까지 가격을 올린다');
  });

  it('builds three one-tap deep links into the first-settlement landing', () => {
    expect(buildFirstSettlementUrl('https://argus.voyage', 'ko', 'p1', 'shifted')).toBe(
      'https://argus.voyage/ko/project?from=first-settlement&return=p1&first=shifted',
    );

    const email = buildFirstSettlementEmail({
      anchor: '8월까지 가격을 올린다',
      projectId: 'p1',
      baseUrl: 'https://argus.voyage',
      locale: 'ko',
    });

    expect(email.subject).toBe('결과는 아직이에요 — 그때의 당신만 잠깐 볼래요?');
    expect(email.html).toContain('"8월까지 가격을 올린다"');
    expect(email.html).toContain('first=same');
    expect(email.html).toContain('first=shifted');
    expect(email.html).toContain('first=unknown');
    expect(email.html).toContain('결과를 채점하는 게 아니에요');
    expect(email.html).not.toMatch(/점수|성공|실패/);
  });
});
