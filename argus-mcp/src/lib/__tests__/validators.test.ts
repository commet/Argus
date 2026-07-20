import { describe, it, expect } from 'vitest';
import { validateCrux } from '../validate-crux.js';
import { validateSeal } from '../validate-seal.js';

const TODAY = '2026-07-03';

describe('validateCrux — LEAN regex (11 P1-3 regression)', () => {
  it('does NOT flag a neutral question containing the word "id"', () => {
    // The old `i('| w)?d` alternation matched bare "id" and convicted this.
    expect(validateCrux('Will the user id migration finish before Q3?')).toBeNull();
  });

  it('still flags a real first-person lean ("I\'d")', () => {
    const err = validateCrux("Is this what I'd call the safer bet?");
    expect(err?.code).toBe('CRUX_CARRIES_LEAN');
  });

  it('still flags "I would"', () => {
    const err = validateCrux('Given the data, is option A what I would pick?');
    expect(err?.code).toBe('CRUX_CARRIES_LEAN');
  });
});

describe('validateCrux — clarify-v2 floor parity (admin-only + confirmation, ko/en)', () => {
  it('rejects admin-only asks (en): deadline / final decision-maker / format', () => {
    expect(validateCrux('Who is the final decision-maker here?')?.code).toBe('CRUX_ADMIN_ONLY');
    expect(validateCrux('What is the deadline for this?')?.code).toBe('CRUX_ADMIN_ONLY');
    expect(validateCrux('What format should the deck be?')?.code).toBe('CRUX_ADMIN_ONLY');
  });
  it('rejects admin-only asks (ko): 마감 / 결정권자 / 형식 / 스켈레톤', () => {
    expect(validateCrux('마감일은 언제인가요?')?.code).toBe('CRUX_ADMIN_ONLY');
    expect(validateCrux('최종 결정권자는 누구인가요?')?.code).toBe('CRUX_ADMIN_ONLY');
    expect(validateCrux('스켈레톤을 먼저 어떻게 채울까요?')?.code).toBe('CRUX_ADMIN_ONLY');
  });
  it('rejects a leading confirmation as CARRIES_LEAN (ko/en)', () => {
    expect(validateCrux('Does this look right?')?.code).toBe('CRUX_CARRIES_LEAN');
    expect(validateCrux('이제 이 방향이 맞나요?')?.code).toBe('CRUX_CARRIES_LEAN');
  });
  it('still passes a genuine load-bearing crux (ko/en)', () => {
    expect(validateCrux('Will the index rebuild fit inside the replication lag budget?')).toBeNull();
    expect(validateCrux('이 판단이 틀렸다면 가장 먼저 어디에서 신호가 나타날까요?')).toBeNull();
  });
});

describe('validateSeal — Korean vibe heuristic (12 P1-4)', () => {
  it('flags a Korean vibe-predicate as weak NOT_FALSIFIABLE with a ko message', () => {
    const err = validateSeal('잘 될 것 같다 아마도', '2026-08-01', TODAY);
    expect(err?.code).toBe('NOT_FALSIFIABLE');
    expect(err?.weak).toBe(true);
    expect(err?.message).toContain('막연한 느낌');
    expect(err?.recovery).toContain('예외가 있을 수');
  });

  it('passes a checkable Korean predicate', () => {
    expect(validateSeal('주간 활성 사용자가 100명을 넘는다', '2026-08-01', TODAY)).toBeNull();
  });

  it('keeps the English vibe heuristic (weak, en message)', () => {
    const err = validateSeal('things will go well for us', '2026-08-01', TODAY);
    expect(err?.code).toBe('NOT_FALSIFIABLE');
    expect(err?.weak).toBe(true);
    expect(err?.message).toContain('vibe');
  });

  it('an observable anchor defuses the vibe heuristic (over-fire fix, 1.4.7)', () => {
    // "아마도" 한 단어가 숫자 임계값이 있는 예측을 하드블록했던 케이스.
    expect(validateSeal('아마도 2월엔 월 매출이 1억을 넘는다', '2026-08-01', TODAY)).toBeNull();
    expect(validateSeal('signups will be fine, at least 1000 by March', '2026-08-01', TODAY)).toBeNull();
    // 앵커가 없는 순수 기분은 여전히 잡는다.
    expect(validateSeal('어떻게든 잘 될 것 같다', '2026-08-01', TODAY)?.code).toBe('NOT_FALSIFIABLE');
  });
});

describe('validateSeal — calendar-invalid check_by is refused (fuzz F3)', () => {
  const good = '월간 매출이 1억을 넘는다';
  it('rejects month > 12 even when it sorts as a future date', () => {
    // "2026-13-01" > today lexically, so it slid past the "must be future" gate
    // and sealed a malformed .ics (DTSTART:20261301).
    expect(validateSeal(good, '2026-13-01', TODAY)?.code).toBe('BAD_CHECK_BY');
  });
  it('rejects an impossible day-of-month in a future month', () => {
    expect(validateSeal(good, '2026-09-31', TODAY)?.code).toBe('BAD_CHECK_BY'); // Sept has 30
    expect(validateSeal(good, '2026-02-30', TODAY)?.code).toBe('BAD_CHECK_BY');
  });
  it('still accepts a real future date', () => {
    expect(validateSeal(good, '2026-08-31', TODAY)).toBeNull();
    expect(validateSeal(good, '2028-02-29', TODAY)).toBeNull(); // 2028 is a leap year
  });
});
