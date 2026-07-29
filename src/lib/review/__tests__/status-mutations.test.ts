import { describe, expect, it } from 'vitest';
import { summarizeReceipt, sortByUrgency } from '../status';
import type { JudgmentReceipt } from '../types';

/**
 * 귀환 목록의 산수 — 뮤테이션 프로브 생존자 (2026-07-29).
 *
 * `node scripts/mutation-probe.mjs src/lib/review/status.ts …` → kill rate 70%.
 * 살아남은 것 중 사용자가 바로 보는 둘을 여기서 막는다.
 *
 * 1) `settled_count >= sealed_count` — **"이 영수증은 정산이 끝났는가"**의 판정.
 *    부등호가 뒤집히면 3개 중 1개만 정산한 영수증이 '정산 완료'로 접히고, 전부
 *    정산한 영수증은 계속 열린 채로 남는다. 귀환 루프의 완료 판정 그 자체다.
 *
 * 2) 정렬 비교자의 `next_check_by` 분기 — 대시보드가 **무엇을 먼저 보여줄지**.
 *    뒤집히면 가장 급한 것이 맨 아래로 간다. 라벨은 그대로라 화면은 멀쩡해 보인다.
 *
 * 경계 양쪽을 함께 본다. 한쪽만 보면 부등호를 뒤집어도 절반은 통과한다.
 */

const TODAY = '2026-07-29';

function receipt(over: Partial<JudgmentReceipt> = {}): JudgmentReceipt {
  return {
    receipt_id: 'r1',
    state: 'reviewed',
    source_title: '문서',
    source_kind: 'text',
    falsifiable_followups: [],
    updated_at: '2026-07-01T00:00:00.000Z',
    ...over,
  } as JudgmentReceipt;
}

/** sealed(=봉인됨) 이고, settled 여부만 다른 후속 항목. */
function followup(id: string, opts: { settled?: boolean; checkBy?: string } = {}) {
  return {
    followup_id: id,
    statement: `약속 ${id}`,
    check_by: opts.checkBy ?? '2026-08-30',
    sealed_at: '2026-07-01T00:00:00.000Z',
    ...(opts.settled ? { settled_at: '2026-07-20T00:00:00.000Z', outcome: 'happened' } : {}),
  } as never;
}

describe('정산 완료 판정 — 경계 양쪽', () => {
  it('봉인 3개 중 3개를 정산하면 settled', () => {
    const s = summarizeReceipt(receipt({
      falsifiable_followups: [
        followup('a', { settled: true }),
        followup('b', { settled: true }),
        followup('c', { settled: true }),
      ],
    }), TODAY);
    expect(s.derived).toBe('settled');
    expect(s.settled_count).toBe(3);
    expect(s.sealed_count).toBe(3);
  });

  it('봉인 3개 중 1개만 정산하면 settled 가 아니다 (아직 열려 있다)', () => {
    const s = summarizeReceipt(receipt({
      falsifiable_followups: [
        followup('a', { settled: true }),
        followup('b'),
        followup('c'),
      ],
    }), TODAY);
    expect(s.derived).not.toBe('settled');
    expect(s.open_followups).toBe(2);
  });

  it('하나 남기고 다 정산한 경우도 settled 가 아니다 (경계 바로 아래)', () => {
    const s = summarizeReceipt(receipt({
      falsifiable_followups: [followup('a', { settled: true }), followup('b')],
    }), TODAY);
    expect(s.derived).not.toBe('settled');
  });

  it('봉인이 하나도 없으면 정산 수가 0이어도 settled 로 접지 않는다', () => {
    // sealed_count > 0 조건이 지키는 것: 아무것도 안 묶은 검토가 "정산 완료"로 보이면
    // 사용자는 하지도 않은 귀환을 했다고 읽는다.
    const s = summarizeReceipt(receipt({ falsifiable_followups: [] }), TODAY);
    expect(s.derived).not.toBe('settled');
  });

  it('state 가 명시적으로 settled 면 후속 항목과 무관하게 settled', () => {
    expect(summarizeReceipt(receipt({ state: 'settled' }), TODAY).derived).toBe('settled');
  });
});

describe('대시보드 정렬 — 급한 것이 위로', () => {
  it('같은 등급 안에서는 확인일이 이른 것이 먼저다', () => {
    const later = receipt({ receipt_id: 'later', falsifiable_followups: [followup('l', { checkBy: '2026-09-30' })] });
    const sooner = receipt({ receipt_id: 'sooner', falsifiable_followups: [followup('s', { checkBy: '2026-08-05' })] });
    const order = sortByUrgency([later, sooner], TODAY).map((r) => r.receipt_id);
    expect(order).toEqual(['sooner', 'later']);
  });

  it('확인일이 지난 것(due)이 아직 안 온 것(sealed)보다 먼저다', () => {
    const notYet = receipt({ receipt_id: 'notYet', falsifiable_followups: [followup('n', { checkBy: '2026-09-30' })] });
    const overdue = receipt({ receipt_id: 'overdue', falsifiable_followups: [followup('o', { checkBy: '2026-07-01' })] });
    const order = sortByUrgency([notYet, overdue], TODAY).map((r) => r.receipt_id);
    expect(order).toEqual(['overdue', 'notYet']);
  });

  it('정산이 끝난 것은 맨 뒤다', () => {
    const done = receipt({ receipt_id: 'done', state: 'settled' });
    const open = receipt({ receipt_id: 'open', falsifiable_followups: [followup('o', { checkBy: '2026-09-30' })] });
    expect(sortByUrgency([done, open], TODAY).map((r) => r.receipt_id)).toEqual(['open', 'done']);
  });

  it('확인일이 같으면 최근에 손댄 것이 먼저다', () => {
    const old = receipt({ receipt_id: 'old', updated_at: '2026-07-01T00:00:00.000Z', falsifiable_followups: [followup('a')] });
    const fresh = receipt({ receipt_id: 'fresh', updated_at: '2026-07-28T00:00:00.000Z', falsifiable_followups: [followup('b')] });
    expect(sortByUrgency([old, fresh], TODAY).map((r) => r.receipt_id)).toEqual(['fresh', 'old']);
  });
});
