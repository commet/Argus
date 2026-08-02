/**
 * What the reader is told happened to their sentence.
 *
 * `diffItems` compares membership, so a rewrite reaches the screen as a removal
 * plus an unrelated arrival — and the card renders removals in red with a strike
 * and a minus. The effect was that an answer which sharpened a premise looked
 * like an answer that destroyed one.
 *
 * `diffPremiseRows` uses the lineage the contract recorded instead of guessing
 * from similarity, and these tests pin the four cases that distinguish the two.
 */
import { describe, expect, it } from 'vitest';
import { diffItems, diffPremiseRows } from '../diffItems';

const BEFORE = '지금 팀을 떠나면 쌓아온 신뢰를 잃는다';
const AFTER = '붙잡지 않은 팀에 남는 것은 예전 자리로 돌아가는 선택이 아니다';

describe('a revision reaches the screen as a revision', () => {
  it('pairs the rewrite with what it replaced', () => {
    const rows = diffPremiseRows(
      [{ text: BEFORE }],
      [{ text: AFTER, revised_from: BEFORE }],
    );

    expect(rows).toEqual([
      { text: AFTER, status: 'revised', previousText: BEFORE },
    ]);
  });

  it('is the case the old diff could not express', () => {
    // Kept as a live comparison rather than a comment: if diffItems ever grows
    // this ability the duplication should be collapsed, and this fails loudly.
    const old = diffItems([BEFORE], [AFTER]);

    expect(old.map((d) => d.status)).toEqual(['removed', 'new']);
  });

  it('still mourns a premise that was genuinely dropped', () => {
    const rows = diffPremiseRows(
      [{ text: BEFORE }, { text: '연봉이 결정적이다' }],
      [{ text: '연봉이 결정적이다' }],
    );

    expect(rows).toEqual([
      { text: BEFORE, status: 'removed' },
      { text: '연봉이 결정적이다', status: 'same' },
    ]);
  });

  it('does not re-announce a rewrite that happened turns ago', () => {
    // Lineage is durable. Reading its mere presence as "changed just now" would
    // leave a row tagged 고쳐 씀 for the rest of the session.
    const rows = diffPremiseRows(
      [{ text: AFTER, revised_from: BEFORE }],
      [{ text: AFTER, revised_from: BEFORE }],
    );

    expect(rows).toEqual([{ text: AFTER, status: 'same' }]);
  });

  it('will not claim a rewrite while the earlier sentence is still on the list', () => {
    // Two records, one remembering the other's text. Calling this a revision
    // would tell the reader a sentence was replaced that is sitting right
    // above it.
    const rows = diffPremiseRows(
      [{ text: BEFORE }],
      [{ text: BEFORE }, { text: AFTER, revised_from: BEFORE }],
    );

    expect(rows.find((r) => r.text === AFTER)?.status).toBe('new');
    expect(rows.some((r) => r.status === 'removed')).toBe(false);
  });

  it('treats lineage pointing at nothing as a plain arrival', () => {
    const rows = diffPremiseRows(
      [{ text: '연봉이 결정적이다' }],
      [{ text: AFTER, revised_from: '이 세션에 없던 문장' }],
    );

    expect(rows).toEqual([
      { text: '연봉이 결정적이다', status: 'removed' },
      { text: AFTER, status: 'new' },
    ]);
  });

  it('ignores surrounding whitespace on both sides of the pairing', () => {
    const rows = diffPremiseRows(
      [{ text: `  ${BEFORE}  ` }],
      [{ text: AFTER, revised_from: BEFORE }],
    );

    expect(rows[0].status).toBe('revised');
  });
});
