/**
 * Mojibake guard (Argus 2.0 plan, H1-A1).
 *
 * History: commit 964271c (Falsification.tsx) and merge fc4e1c7
 * (SettlementModal.tsx) were saved on a CP949-locale machine, round-tripping
 * the files' UTF-8 Korean through CP949 → every user-facing string in the two
 * spine-critical ceremony screens rendered as garbage until
 * 2026-07-02. CP949 mojibake is VALID Unicode, so a naive U+FFFD scan passes it —
 * hence two layers:
 *
 * 1. Signature scan (whole src tree): C1 control bytes, U+FFFD, and the
 *    '?'-adjacent-to-Hangul pattern the lossy round-trip leaves behind.
 * 2. Known-good fixtures (ceremony files only): key user-facing strings must
 *    appear verbatim. Editing that copy is fine — update the fixture in the
 *    same commit. A wholesale re-encode can't survive this comparison.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    // The guard skips itself: its comments/regexes discuss the very patterns
    // it hunts for.
    else if (/\.(ts|tsx|css)$/.test(name) && !name.includes('mojibake-guard')) out.push(p);
  }
  return out;
}

// C1 control bytes only appear in text when a lossy re-encode mangled a
// multibyte sequence; U+FFFD is the replacement character itself.
const CTRL_OR_FFFD = /[\u0080-\u009f\ufffd]/;
// A lossy CP949 round-trip drops bytes as literal '?' glued to Hangul.
// Legit prose never has '?' immediately followed by two Hangul syllables,
// or doubled '??' straight after Hangul (nullish coalescing sits after
// identifiers/brackets, not Hangul).
const LOSSY_HANGUL = /\?[가-힣]{2}|[가-힣]\?\?/;

describe('mojibake guard — src tree is clean UTF-8 Korean', () => {
  const files = walk(SRC);

  it('walks a non-trivial tree (sanity)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files.map((f) => [f.slice(SRC.length + 1), f] as const))(
    '%s has no mojibake signature',
    (_rel, abs) => {
      const text = readFileSync(abs, 'utf8');
      const bad = text
        .split('\n')
        .map((l, i) => ({ l, n: i + 1 }))
        .filter(({ l }) => CTRL_OR_FFFD.test(l) || LOSSY_HANGUL.test(l));
      expect(
        bad.map(({ n, l }) => `L${n}: ${l.trim().slice(0, 80)}`),
      ).toEqual([]);
    },
  );
});

/**
 * Known-good copy fixtures. These are the ceremony strings the spine depends
 * on (friction escapes, provenance disclosures, settle prompts). If you edit
 * this copy on purpose, update the fixture here IN THE SAME COMMIT — that is
 * the guard working, not the guard being in the way.
 */
const FIXTURES: Record<string, string[]> = {
  'components/workspace/progressive/Falsification.tsx': [
    '계획 시험',
    '이 계획을 한 번 시험해볼게요',
    '어디까지 믿어지는지가, 이 계획이 진짜 기대고 있는 전제를 드러내요. 30초면 돼요.',
    '아래는 일부러 점점 크게 부풀린 성공 시나리오예요. 위에서부터 읽다가, 처음으로 "에이, 이건 아니다" 싶은 줄을 눌러 주세요.',
    '전부 믿겠어요',
    '하나도 안 멈추셨네요. 그럼 하나만 같이 볼게요 — 이 계획이 기대고 있는 전제예요.',
    '여기서 멈추셨네요 — 이 줄이 기대고 있는 전제예요',
    '이게 정말 맞나요?',
    '여기까진 AI가 짚은 내용이에요. 당신 말로 적으면 확인할 예측으로 남고, 확인일에 실제 결과와 비교할 수 있어요.',
    '이 문장 그대로 쓰기',
    '직접 적지 않을게요 — AI가 짚은 내용으로만 둘게요',
  ],
  'components/projects/SettlementModal.tsx': [
    '그래서, 어떻게 됐어요?',
    '그때 건 예측을, 이제 현실과 맞춰봐요',
    '무엇이 어떻게 되었나요?',
    '결과 기록 마치기',
  ],
  'components/workspace/progressive/SealMoment.tsx': [
    '마지막으로',
    '좋아요 — 그날 프로젝트 페이지에서 제가 먼저 물어볼게요.',
    '캘린더에 약속 넣기',
    '날짜·예측 손보기',
  ],
};

describe('mojibake guard — ceremony copy matches known-good fixtures', () => {
  it.each(Object.entries(FIXTURES))('%s', (rel, strings) => {
    const text = readFileSync(join(SRC, rel), 'utf8');
    const missing = strings.filter((s) => !text.includes(s));
    expect(missing).toEqual([]);
  });
});
