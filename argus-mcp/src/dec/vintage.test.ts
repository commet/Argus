import { describe, expect, it } from 'vitest';
import { asSigned, wasAmended } from './vintage.js';
import { sayAsk } from './review/ask.js';
import { makeRecord } from './test-helpers.js';
import type { Amendment, DecisionRecord } from './types.js';

/**
 * 빈티지 고정 — **그때 쓴 문장을 그때 쓴 대로.**
 *
 * 2026-09-10 실측: 개정된 결정을 다시 물었더니 화면 머리에 **고쳐진 문장**이
 * "그때 쓴 문장" 자리에 나왔다. 막으려던 병(기억 다시쓰기)을 화면이 거들고
 * 있었다. 규율은 주석에만 있었고 코드에는 없었다.
 */

const amend = (field: string, from: string, to: string, why = '왜'): Amendment => ({
  at: '2026-08-01T00:00:00.000Z', why, from_hand_edit: false,
  changed: [{ field, from, to }],
});

const due = (record: DecisionRecord) =>
  ({ record, reason: 'calendar' as const, days: 10 });

describe('빈티지 고정 — 그때의 문장', () => {
  it('한 번도 안 고쳤으면 지금 값이 곧 그때 값이다', () => {
    const r = makeRecord('D-0001', { decision: '무료 티어는 안 만든다', because: '전환이 안 됐다' });
    expect(asSigned(r, 'decision')).toBe('무료 티어는 안 만든다');
    expect(asSigned(r, 'because')).toBe('전환이 안 됐다');
    expect(wasAmended(r, 'decision')).toBe(false);
  });

  it('고쳤으면 **첫 개정의 from** 이 서명 당시의 값이다', () => {
    const r = makeRecord('D-0001', {
      decision: '무료 티어는 초대제로만 만든다',
      amendments: [amend('decision', '무료 티어는 안 만든다', '무료 티어는 초대제로 만든다')],
    });
    expect(asSigned(r, 'decision')).toBe('무료 티어는 안 만든다');
    expect(wasAmended(r, 'decision')).toBe(true);
  });

  it('두 번 고쳐도 **맨 처음** 값이 나온다 (개정끼리의 값이 아니다)', () => {
    const r = makeRecord('D-0001', {
      decision: '셋째 문장',
      amendments: [
        amend('decision', '첫째 문장', '둘째 문장'),
        amend('decision', '둘째 문장', '셋째 문장'),
      ],
    });
    expect(asSigned(r, 'decision')).toBe('첫째 문장');
  });

  it('다른 칸만 고친 개정은 이 칸의 그때 값을 안 건드린다', () => {
    const r = makeRecord('D-0001', {
      decision: '그대로인 문장',
      amendments: [amend('scope', 'repo', 'path:src/**')],
    });
    expect(asSigned(r, 'decision')).toBe('그대로인 문장');
    expect(wasAmended(r, 'decision')).toBe(false);
  });

  it('그때 이유가 없었으면 없는 대로 둔다 (지어내지 않는다)', () => {
    const r = makeRecord('D-0001', {
      because: '나중에 붙인 이유',
      amendments: [amend('because', '', '나중에 붙인 이유')],
    });
    expect(asSigned(r, 'because')).toBeUndefined();
  });

  // ── 화면 ────────────────────────────────────────────────────────────

  it('정산 화면 머리에 **그때 쓴 문장**이 온다 (고쳐진 것이 아니라)', () => {
    const r = makeRecord('D-0001', {
      decision: '무료 티어는 초대제로만 만든다',
      amendments: [amend('decision', '무료 티어는 안 만든다', '무료 티어는 초대제로만 만든다')],
    });
    const head = sayAsk(due(r))[0]!;
    expect(head).toContain('무료 티어는 안 만든다');
    expect(head).not.toContain('초대제');
  });

  it('지금 문장도 같이 말한다 — 그때 것만 보여주면 이번엔 반대로 속인다', () => {
    const r = makeRecord('D-0001', {
      decision: '무료 티어는 초대제로만 만든다',
      amendments: [amend('decision', '무료 티어는 안 만든다', '무료 티어는 초대제로만 만든다', '파트너 요구')],
    });
    const text = sayAsk(due(r)).join('\n');
    expect(text).toContain('지금 문장: 무료 티어는 초대제로만 만든다');
    expect(text).toContain('고친 이유: 파트너 요구');
  });

  it('그때 이유를 보여주고, 지금 이유가 다르면 그것도 말한다', () => {
    const r = makeRecord('D-0001', {
      because: '지금 이유',
      amendments: [amend('because', '그때 이유', '지금 이유')],
    });
    const text = sayAsk(due(r)).join('\n');
    expect(text).toContain('그때 쓴 이유: 그때 이유');
    expect(text).toContain('지금 적혀 있는 이유: 지금 이유');
  });

  it('안 고친 결정에는 군더더기를 안 붙인다 (과발화 금지)', () => {
    const r = makeRecord('D-0001', { decision: '그대로인 문장', because: '그대로인 이유' });
    const text = sayAsk(due(r)).join('\n');
    expect(text).not.toContain('그 뒤로 고쳤다');
    expect(text).not.toContain('지금 적혀 있는 이유');
  });
});
