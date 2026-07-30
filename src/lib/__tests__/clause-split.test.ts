/**
 * The landing line-break contract.
 *
 * Guards the rule that ends the recurring "왜 이상한 데서 잘려?" report: a line
 * may only break where a reader would break it. Three halves are checked —
 *   1. splitClauses puts the clause boundaries where punctuation says they are
 *   2. modifier binding covers the Korean sentences that HAVE no punctuation,
 *      which is where the browser used to tear "다른 | 본부로" apart
 *   3. the landing surfaces actually render through ClauseText, so nobody
 *      re-introduces a raw `text.split('\n')` renderer next to it
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { splitClauses, splitLines } from '../clause-split';

const SRC = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf-8');

/** Binding uses U+00A0; it is a rendering hint, not a change to the text. */
const NB = ' ';
const plain = (s: string) => s.replace(/ /g, ' ');

describe('splitClauses', () => {
  it('breaks after a comma, keeping the comma with its clause', () => {
    expect(splitClauses('세이렌은 모든 것을 알려주겠다고 노래했고, 항해자들은 그 확신에 이끌렸습니다.').map(plain))
      .toEqual(['세이렌은 모든 것을 알려주겠다고 노래했고,', '항해자들은 그 확신에 이끌렸습니다.']);
  });

  it('breaks after a sentence end', () => {
    expect(splitClauses('그때 Argus가 먼저 당신에게 돌아옵니다. 실제로 이런 순간들이에요.').map(plain))
      .toEqual(['그때 Argus가 먼저 당신에게 돌아옵니다.', '실제로 이런 순간들이에요.']);
  });

  it('opens the next unit with a free-standing dash, never dangles it', () => {
    const units = splitClauses('기다리던 때가 오는 순간 — 대개는 아무도 알려주지 않죠.').map(plain);
    expect(units).toEqual(['기다리던 때가 오는 순간', '— 대개는 아무도 알려주지 않죠.']);
    expect(units.some((u) => /[—–]$/.test(u))).toBe(false);
  });

  it('never emits a fragment too short to hold a line', () => {
    for (const u of splitClauses('갔다, 봤다, 이겼다. 그리고 남은 건 기록뿐이었습니다.')) {
      expect(u.replace(/\s/g, '').length).toBeGreaterThanOrEqual(6);
    }
  });

  it('merges a short clause FORWARD, into what it reads with', () => {
    // Backward merging welded "이 결정," onto the sentence BEFORE it, making an
    // atom wider than the card column — which then broke mid-phrase anyway.
    expect(splitClauses('가려던 이유가 달라졌어요. 이 결정, 다시 볼까요?').map(plain))
      .toEqual(['가려던 이유가 달라졌어요.', '이 결정, 다시 볼까요?']);
  });

  it('never lets a line end on a 관형사 — the half punctuation cannot reach', () => {
    // This sentence has no comma anywhere, so clause splitting alone leaves it
    // whole and the browser broke it at "…다른 | 본부로", tearing a determiner
    // off its noun.
    expect(splitClauses('그 팀장이 조직 개편으로 다른 본부로 옮겼습니다.'))
      .toEqual([`그${NB}팀장이 조직 개편으로 다른${NB}본부로 옮겼습니다.`]);
    for (const w of ['그', '이', '저', '다른', '새', '한', '두', '모든', '여러']) {
      expect(splitClauses(`앞말 ${w} 뒷말입니다.`)).toEqual([`앞말 ${w}${NB}뒷말입니다.`]);
    }
  });

  it('leaves a punctuation-free line as one unit (nothing to guess at)', () => {
    const line = '오늘 우리가 AI의 유창한 답을 대하는 모습과 닮았습니다';
    expect(splitClauses(line).map(plain)).toEqual([line]);
  });

  it('is lossless — units rejoin to the original line', () => {
    const lines = [
      '믿고 정했던 것이 흔들리거나, 기다리던 때가 오는 순간 — 대개는 아무도 알려주지 않죠.',
      'What your decision rested on shifts — or the moment you were waiting for lands. Usually no one tells you.',
      '“나를 돛대에 묶어라. 풀어달라 빌어도, 더 단단히.”',
      '그 팀장이 조직 개편으로 다른 본부로 옮겼습니다.',
    ];
    for (const line of lines) expect(plain(splitClauses(line).join(' '))).toBe(line);
  });

  it('keeps authored hard breaks as separate lines', () => {
    expect(splitLines('첫 줄입니다.\n둘째 줄, 이어집니다.').map((u) => u.map(plain))).toEqual([
      ['첫 줄입니다.'],
      ['둘째 줄, 이어집니다.'],
    ]);
  });
});

describe('landing copy renders through the contract', () => {
  const SURFACES = [
    'components/landing/UseCases.tsx',
    'components/landing/films/VoyageFilm.tsx',
    'components/landing/voyage/Act2DecisionVoyage.tsx',
    'components/landing/SirenHero.tsx',
  ];

  it('every landing surface imports ClauseText', () => {
    for (const rel of SURFACES) {
      expect(read(rel), rel).toContain("from '@/components/landing/ClauseText'");
    }
  });

  it('nobody re-rolls a raw newline renderer beside it', () => {
    for (const rel of SURFACES) {
      // The exact pattern ClauseText replaced: split on "\n", map to <br />.
      expect(read(rel), rel).not.toMatch(/\.split\(\s*['"]\\n['"]\s*\)[\s\S]{0,160}<br\s*\/>/);
    }
  });
});
