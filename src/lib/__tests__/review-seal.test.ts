import { describe, it, expect } from 'vitest';
import { buildReviewSealCommand, isoFromDay } from '@/lib/review-seal';


/** 미래 날짜를 글자로 박지 않는다 — 그 날이 지나면 코드를 안 고쳐도 빨간불이 된다
 *  (2026-09 에 실제로 겪었다. `no-future-date-literals.test.ts` 가 지킨다). */
const daysFromNow = (n: number): string =>
  new Date(Date.now() + n * 86_400_000).toISOString();
/** 두 자리가 같은 날을 가리켜야 한다. */
const CHECK_BY = daysFromNow(45).slice(0, 10);

describe('buildReviewSealCommand — review obligation → DKK seal command', () => {
  const ids = { judgment_id: 'web-judgment:j1', command_id: 'cmd-1', proposal_id: 'web-proposal:p1' };

  it('maps the obligation to the sealed judgment + the return contract, with onramp provenance', () => {
    const cmd = buildReviewSealCommand(
      { receipt_id: 'rcpt-9' },
      { statement: '예산 5억을 ROI 근거 없이 승인할지 결정' },
      { predicate: '8주 내 정량 ROI가 보고서에 추가된다', check_by: CHECK_BY, pass_condition: '표로 제시됨', fail_condition: '미제시' },
      ids,
    );
    expect(cmd.kind).toBe('seal');
    expect(cmd.judgment_id).toBe('web-judgment:j1');
    expect(cmd.statement).toBe('예산 5억을 ROI 근거 없이 승인할지 결정');       // obligation → judgment statement
    expect(cmd.return_contract_id).toBe('web-judgment:j1:return');
    expect(cmd.review_at).toBe(`${CHECK_BY}T12:00:00.000Z`);                    // noon UTC, tz-safe
    expect(cmd.review_question).toBe('8주 내 정량 ROI가 보고서에 추가된다');    // predicate → return question
    expect(cmd.resolution_criterion).toBe('pass: 표로 제시됨 / fail: 미제시');
    // 2(b): the adopted proposal rides in the seal batch, tagged to the document
    expect(cmd.proposal_id).toBe('web-proposal:p1');
    expect(cmd.proposal_text).toBe('예산 5억을 ROI 근거 없이 승인할지 결정');
    expect(cmd.source_ref).toBe('review:rcpt-9');
  });

  it('omits resolution_criterion when neither pass nor fail is given', () => {
    const cmd = buildReviewSealCommand({ receipt_id: 'r' }, { statement: 's' }, { predicate: 'p', check_by: CHECK_BY }, ids);
    expect('resolution_criterion' in cmd).toBe(false);
  });

  it('isoFromDay anchors to noon UTC', () => {
    expect(isoFromDay('2026-01-02')).toBe('2026-01-02T12:00:00.000Z');
  });
});
