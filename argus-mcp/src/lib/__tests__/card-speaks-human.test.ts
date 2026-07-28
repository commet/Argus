import { describe, it, expect } from 'vitest';
import { SETTLE_APP_HTML } from '../apps-ui-html.js';

/**
 * The card must speak to a person, not print its own database.
 *
 * Found 2026-07-28 by rendering the card and LOOKING at it — every gate was
 * green while each outcome button carried the raw enum underneath its Korean
 * label: 예측대로/held, 걱정 피함/avoided, 일부만/partial, 아직/later,
 * 빗나감/missed. System vocabulary, shown to a user who never asked for it, in
 * a language they may not read, in the one place where the product asks them to
 * commit. And it did not even help with the distinction people actually get
 * wrong (held vs avoided) — the codebase itself flags that pair as confusable.
 *
 * "the resource exists and the args are carried" is not the same claim as
 * "a person can read this". These assertions are the second claim.
 *
 * 무엇이 이걸 빨간불로 만드나: 결과 버튼의 설명 자리에 enum 값을 도로 넣는다.
 */

/** What the user-visible strings are — the T table, not the code around it. */
function localeBlock(locale: 'ko' | 'en'): string {
  const start = SETTLE_APP_HTML.indexOf(`    ${locale}: {`);
  expect(start, `T.${locale} 블록을 못 찾았다 — 이 게이트가 눈이 먼 것이다`).toBeGreaterThan(-1);
  const end = SETTLE_APP_HTML.indexOf('\n    },', start);
  return SETTLE_APP_HTML.slice(start, end);
}

const ENUM_VALUES = ['held', 'avoided', 'partial', 'missed', 'still_pending'];

describe('정산 카드는 사람의 말로 말한다', () => {
  it('결과 선택지에 enum 값이 라벨로 노출되지 않는다', () => {
    const ko = localeBlock('ko');
    // In the ko table an enum may appear ONLY as the first slot of a tuple —
    // the value we send back to the server — never as a label the user reads.
    const leaked: string[] = [];
    for (const line of ko.split('\n')) {
      if (!/\['/.test(line)) continue;
      // ['held', '예측대로', '그 일이 실제로 일어났다']  → slots 2 and 3 are read by a human
      for (const m of line.matchAll(/\[\s*'([a-z_]+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\]/g)) {
        const [, , label, hint] = m;
        for (const v of ENUM_VALUES) {
          if (label === v || hint === v) leaked.push(`${v} shown as a label`);
        }
        expect(label, '라벨이 비어 있다').not.toBe('');
        expect(/[가-힣]/.test(label), `ko 라벨이 한국어가 아니다: ${label}`).toBe(true);
        expect(/[가-힣]/.test(hint), `ko 설명이 한국어가 아니다: ${hint}`).toBe(true);
      }
    }
    expect(leaked, 'enum 값이 사용자에게 보이는 자리에 있다').toEqual([]);
  });

  it('다섯 갈래가 전부 있고, 각각 무슨 뜻인지 한 줄로 설명한다', () => {
    for (const locale of ['ko', 'en'] as const) {
      const block = localeBlock(locale);
      const values = [...block.matchAll(/\[\s*'([a-z_]+)'\s*,/g)].map((m) => m[1]);
      for (const v of ENUM_VALUES) {
        expect(values, `${locale}: ${v} 갈래가 없다`).toContain(v);
      }
      // every choice carries a meaning line — the thing that makes it pickable
      for (const m of block.matchAll(/\[\s*'[a-z_]+'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\]/g)) {
        expect(m[2].length, `${locale}: "${m[1]}"에 설명이 없다`).toBeGreaterThan(3);
      }
    }
  });

  it('"아직"은 결과 목록이 아니라 별도 손잡이다', () => {
    // still_pending records nothing; it re-arms the date. It must not be built
    // by the same `outcomes` array the four verdicts come from.
    const ko = localeBlock('ko');
    const outcomesArr = ko.slice(ko.indexOf('outcomes: ['), ko.indexOf('pending:'));
    expect(outcomesArr).not.toContain('still_pending');
    expect(ko).toContain("pending: ['still_pending'");
    // and it renders with its own class, so it cannot look like a verdict
    expect(SETTLE_APP_HTML).toContain("choice(t.pending, 'later')");
    expect(SETTLE_APP_HTML).toMatch(/button\.later\s*\{/);
  });

  it('한국어 문장은 고정폭 글꼴로 조판하지 않는다', () => {
    // Korean set in monospace breaks into evenly spaced blocks and is harder to
    // read; the predicate is the one line that must land instantly.
    expect(SETTLE_APP_HTML).toMatch(/--ui:/);
    expect(SETTLE_APP_HTML).toMatch(/font: 14px\/1\.65 var\(--ui\)/);
    // the instrument keeps the mono, on purpose
    expect(SETTLE_APP_HTML).toMatch(/\.brand \{ font: 11px\/1\.65 var\(--mono\)/);
  });

  it('빠져나갈 문은 읽을 수 있는 크기다', () => {
    const skip = SETTLE_APP_HTML.slice(SETTLE_APP_HTML.indexOf('a.skip {'), SETTLE_APP_HTML.indexOf('a.skip:hover'));
    const size = Number(/font-size:\s*(\d+)px/.exec(skip)?.[1] ?? 0);
    expect(size, '탈출구가 본문보다 작으면 안 된다').toBeGreaterThanOrEqual(13);
    expect(skip, '탈출구가 링크로 보여야 한다').toContain('text-decoration: underline');
  });
});
