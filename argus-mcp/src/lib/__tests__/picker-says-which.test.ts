import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { outcomeEnumNames, OUTCOME_VALUES } from '../outcome-labels.js';

/**
 * Two things a confirm picker owes the person reading it.
 *
 * (1) WHICH record is on screen. Found 2026-07-28 by dumping what a host
 *     actually renders: the settle picker opened with a bare "현실이 어떻게
 *     답했나요?" — no prediction, no date. The seal picker quotes the sentence;
 *     the settle picker did not, and settling is exactly the moment a user with
 *     several open bets cannot tell which one they are answering.
 *
 * (2) ONE vocabulary. The five outcomes were written out by hand in two files
 *     (with a comment asking editors to keep them in lockstep) and a third,
 *     different wording lived in the settle card. The same user can meet all
 *     three in a week.
 *
 * 무엇이 이걸 빨간불로 만드나: 픽커 메시지에서 예측 문장을 빼거나, enumNames를
 * 손으로 다시 적는다.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');

describe('픽커는 무엇에 대한 물음인지 말한다', () => {
  it('정산 픽커 메시지가 예측 문장과 확인일을 담는다', () => {
    const settle = read('tools/settle.ts');
    const ask = settle.slice(settle.indexOf('const asked = await elicitDetailed(pickerLocale'), settle.indexOf("properties: {\n            outcome:"));
    expect(ask, '픽커가 어떤 예측인지 안 보여준다').toMatch(/\$\{q\}/);
    expect(ask, '확인일이 빠졌다').toMatch(/\$\{due\}/);
    // and the quoted text goes through the line sanitizer, not raw
    expect(settle).toMatch(/const q = sanitizeLine\(current\.predicate/);
  });

  it('봉인 픽커도 여전히 예측 문장을 담는다 (회귀 방지)', () => {
    const seal = read('tools/seal.ts');
    expect(seal).toMatch(/이 예측으로 기록할까요\?\\n"\$\{predicate\}"/);
  });

  it('두 픽커가 같은 한 곳에서 선택지 문구를 가져온다', () => {
    for (const file of ['tools/settle.ts', 'lib/ambient-elicit.ts']) {
      const text = read(file);
      expect(text, `${file}: 공유 모듈을 쓰지 않는다`).toMatch(/outcomeEnumNames\(/);
      // no hand-written label list may survive next to it
      expect(text, `${file}: 라벨을 손으로 다시 적었다`).not.toMatch(/enumNames:\s*\w+\s*\?\s*\[/);
    }
  });

  it('선택지 문구에 enum 값이 그대로 노출되지 않는다', () => {
    for (const locale of ['ko', 'en'] as const) {
      const names = outcomeEnumNames(locale);
      expect(names).toHaveLength(OUTCOME_VALUES.length);
      for (const [i, n] of names.entries()) {
        expect(n.trim().length, `${locale}[${i}] 라벨이 비었다`).toBeGreaterThan(1);
        expect(n, `${locale}[${i}]가 enum 값 그대로다`).not.toBe(OUTCOME_VALUES[i]);
      }
      // "still_pending" must read as an escape, not a fifth verdict
      const pending = names[OUTCOME_VALUES.indexOf('still_pending')];
      expect(pending, `${locale}: 아직-모름이 결과처럼 읽힌다`).toMatch(locale === 'ko' ? /기록 안 함/ : /records nothing/i);
    }
  });
});
