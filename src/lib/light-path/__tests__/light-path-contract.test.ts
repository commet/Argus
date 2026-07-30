/**
 * Light-path prompt/schema contract (the anti-술 invariant).
 *
 * The founder-approved prompt is the product here — this pins the load-bearing
 * rules so a later "improvement" cannot silently drop them:
 *   1. the anchor rule (닻): the model may only call the user's situation what
 *      the user actually wrote — the '파티'→'술' fabrication is named verbatim;
 *   2. the no-options rule: the light path NEVER generates tap choices — the
 *      user answers in their own words;
 *   3. the engine schema has NO options field: even if the model emits one,
 *      coercion drops it structurally (prompt rules alone don't survive weak
 *      model tiers — R29 measured that; the runtime must enforce).
 *
 * Reference tone/shape anchors from the approved simulation are used as fixtures.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildLightSystemPrompt,
  coerceLightGate,
  coerceLightTurn,
} from '@/lib/light-path/light-engine';

// Approved simulation anchors (shape fixtures — these exact shapes must survive coercion).
const MIRROR_ANCHOR = '더 있고 싶은 마음이 있는데, 집에 가야 하나 싶으신 거네요. 어느 쪽 이유가 큰지는 아직 얘기 안 하셨고요.';
const OFFER_ANCHOR = '케이크 자르고 나오면 내일 안 피곤하다';

const KO_PROMPTS = [
  buildLightSystemPrompt('ko', 'gate'),
  buildLightSystemPrompt('ko', 'next', 0),
  buildLightSystemPrompt('ko', 'next', 2),
];
const EN_PROMPTS = [
  buildLightSystemPrompt('en', 'gate'),
  buildLightSystemPrompt('en', 'next', 0),
  buildLightSystemPrompt('en', 'next', 2),
];

describe('the light prompt carries the approved rules verbatim', () => {
  it.each(KO_PROMPTS.map((p, i) => [i, p] as const))('KO prompt %i has the anchor (닻) rule', (_i, prompt) => {
    expect(prompt).toContain('닻: 사용자의 상황이라고 말할 수 있는 것은 사용자가 실제로 쓴 것뿐입니다.');
    // the anti-술 example is part of the rule, not decoration
    expect(prompt).toContain("'파티'에서 '술'을 연상해 언급하는 것 금지");
  });

  it.each(KO_PROMPTS.map((p, i) => [i, p] as const))('KO prompt %i has the no-options rule', (_i, prompt) => {
    expect(prompt).toContain('보기(선택지)를 만들지 않습니다. 답은 사용자가 자기 말로 씁니다.');
  });

  it.each(KO_PROMPTS.map((p, i) => [i, p] as const))('KO prompt %i keeps the no-verdict and no-fabrication rules', (_i, prompt) => {
    expect(prompt).toContain('판정 금지: 어느 쪽이 낫다고 말하지 않습니다.');
    expect(prompt).toContain('연구·통계·숫자를 지어내지 마세요.');
  });

  it.each(EN_PROMPTS.map((p, i) => [i, p] as const))('EN prompt %i has faithful anchor + no-options rules', (_i, prompt) => {
    expect(prompt).toContain('Anchor: the only things you may call the user\'s situation are things they actually wrote.');
    expect(prompt).toContain('Never create answer options');
  });

  it('the gate criterion routes unsure → heavy (deliberate reverse of the ambient default)', () => {
    expect(buildLightSystemPrompt('ko', 'gate')).toContain('확신이 없으면 heavy');
    expect(buildLightSystemPrompt('en', 'gate')).toContain('When unsure, classify heavy.');
  });

  it('the question budget rule (max 2) is stated, and the spent-budget prompt forbids asking', () => {
    expect(buildLightSystemPrompt('ko', 'next', 0)).toContain('전체 최대 2개');
    expect(buildLightSystemPrompt('ko', 'next', 2)).toContain('더 묻지 마세요');
    expect(buildLightSystemPrompt('en', 'next', 2)).toContain('Do not ask anything else');
  });
});

describe('the engine schema has NO options field (anti-술 invariant, structurally enforced)', () => {
  it('no prompt ever asks the model for an "options" field', () => {
    for (const prompt of [...KO_PROMPTS, ...EN_PROMPTS]) {
      expect(prompt).not.toContain('"options"');
    }
  });

  it('a stray options array in a turn payload is dropped by coercion', () => {
    const turn = coerceLightTurn(
      { mirror: 'm', action: 'ask', question: 'q', options: ['남는다', '간다'] },
      0,
    );
    expect('options' in turn).toBe(false);
    expect(JSON.stringify(turn)).not.toContain('남는다');
  });

  it('a stray options array in a gate payload is dropped by coercion', () => {
    const gate = coerceLightGate({ need: 'light', mirror: 'm', question: 'q', options: ['a', 'b'] });
    expect('options' in gate).toBe(false);
  });

  it('offers carry exactly sentence/when/days/ask — nothing else survives', () => {
    const turn = coerceLightTurn(
      { mirror: 'm', action: 'offer', offer: { sentence: 's', when: 'tonight', days: 3, ask: '제가 물어볼까요?', options: ['x'], verdict: '가라' } },
      1,
    );
    expect(Object.keys(turn.offer!).sort()).toEqual(['ask', 'sentence', 'when']);
  });
});

describe('첫 생각 (first-thought anchor) — conversational invite, plugin anchor rules verbatim', () => {
  const KO_GATE = buildLightSystemPrompt('ko', 'gate');
  const EN_GATE = buildLightSystemPrompt('en', 'gate');

  it('KO gate prompt invites the lean+reason in one breath on a visible fork (approved example verbatim)', () => {
    expect(KO_GATE).toContain('지금 마음은 어느 쪽에 가 있어요? 왜 그런지 한 줄이면 돼요.');
    expect(KO_GATE).toContain('갈림이 보이면');
  });

  it('KO gate prompt carries all four anchor rules', () => {
    expect(KO_GATE).toContain('기울기를 제안하지 마세요.');           // never suggest a lean
    expect(KO_GATE).toContain('답을 미리 채워주지 마세요.');          // never pre-fill
    expect(KO_GATE).toContain('건너뛰어도 잃는 것이 없습니다.');       // skipping loses nothing
    expect(KO_GATE).toContain('기울기 질문은 최대 한 번입니다.');      // ask at most once
  });

  it('KO gate prompt keeps the no-fork fallback (the reason IS the first thought)', () => {
    expect(KO_GATE).toContain('갈림이 안 보이면 평소의 열린 질문을 하세요.');
    expect(KO_GATE).toContain('이유가 곧 첫 생각입니다.');
  });

  it('EN gate prompt carries the faithful invite + all four anchor rules', () => {
    expect(EN_GATE).toContain('invite the current lean plus the reason in one breath');
    expect(EN_GATE).toContain('never suggest a lean.');
    expect(EN_GATE).toContain('Never pre-fill an answer.');
    expect(EN_GATE).toContain('Skipping loses nothing.');
    expect(EN_GATE).toContain('asked at most once.');
    expect(EN_GATE).toContain('No visible fork: ask the usual open question.');
  });

  it('subsequent turns may NEVER re-ask the lean (at-most-once, structurally restated)', () => {
    for (const n of [0, 1, 2]) {
      expect(buildLightSystemPrompt('ko', 'next', n)).toContain('기울기(첫 생각)를 다시 묻지 마세요');
      expect(buildLightSystemPrompt('en', 'next', n)).toContain('Never re-ask the lean (first thought)');
    }
  });

  it('the invite lives ONLY in the gate (first-question) prompt, never in later turns', () => {
    for (const n of [0, 1, 2]) {
      expect(buildLightSystemPrompt('ko', 'next', n)).not.toContain('지금 마음은 어느 쪽에 가 있어요?');
    }
  });
});

describe('permission-to-return (design revision): the offer asks, it never presents a contract', () => {
  const NEXT_KO = buildLightSystemPrompt('ko', 'next', 1);
  const NEXT_EN = buildLightSystemPrompt('en', 'next', 1);

  it('KO prompt carries the flowing permission pattern verbatim', () => {
    expect(NEXT_KO).toContain('허락을 구하는 순간');
    expect(NEXT_KO).toContain('그럼 {오늘의 정리}하는 걸로 하고 — {확인 시점}에 {확인할 것}, 제가 한 번만 물어볼까요?');
  });

  it('KO prompt keeps the sentence internal and bans brackets + betting vocabulary in the ask', () => {
    expect(NEXT_KO).toContain('사용자에게 이 문장을 그대로 보여주지 않습니다');
    expect(NEXT_KO).toContain('괄호 인용(「」) 금지');
    expect(NEXT_KO).toContain('내기 어휘(걸다·걸어두다·베팅) 금지');
  });

  it('EN prompt carries the faithful pattern + the same bans', () => {
    expect(NEXT_EN).toContain('permission to return, not a contract to approve');
    expect(NEXT_EN).toContain('want me to ask you just once?');
    expect(NEXT_EN).toContain('never show it verbatim to the user');
    expect(NEXT_EN).toContain('no bracketed 「quote」');
    expect(NEXT_EN).toContain('No betting vocabulary');
  });

  it('a bracketed 「clause」 in the ask is stripped structurally (prompt rules alone are not trusted)', () => {
    const turn = coerceLightTurn(
      {
        mirror: 'm',
        action: 'offer',
        offer: { sentence: 's', when: 'tonight', ask: '그럼 「케이크만 자르고」 나오는 걸로 하고, 제가 한 번만 물어볼까요?' },
      },
      1,
    );
    expect(turn.offer?.ask).toBe('그럼 케이크만 자르고 나오는 걸로 하고, 제가 한 번만 물어볼까요?');
    expect(turn.offer?.ask).not.toMatch(/[「」]/);
  });

  it('an empty/garbled ask is dropped (the UI composes a mechanical fallback — never fabricated content)', () => {
    const turn = coerceLightTurn(
      { mirror: 'm', action: 'offer', offer: { sentence: 's', when: 'tonight', ask: '  「」 ' } },
      1,
    );
    expect(turn.offer?.ask).toBeUndefined();
  });

  it('the user-facing surface carries NO betting vocabulary (grep guard)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', 'components', 'workspace', 'light', 'LightFlow.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/걸어\s*[두둘뒀]|베팅/);
    expect(src).not.toMatch(/\bbets?\b|\bbetting\b|\bwager/i);
  });
});

describe('retired vocabulary (창업자 지시): 초안/draft appears NOWHERE in the light path', () => {
  it('no light prompt uses 초안 or draft', () => {
    for (const prompt of [...KO_PROMPTS, ...EN_PROMPTS]) {
      expect(prompt).not.toContain('초안');
      expect(prompt).not.toMatch(/draft/i);
    }
  });

  it('the light surfaces carry no 초안/draft anywhere in their source (copy OR comments)', () => {
    // The light path has no document stage — the word has no honest referent here,
    // so it is banned from the whole source, not just extracted copy strings.
    const files = [
      path.resolve(__dirname, '..', 'light-engine.ts'),
      path.resolve(__dirname, '..', '..', '..', 'components', 'workspace', 'light', 'LightFlow.tsx'),
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src, `${path.basename(file)} must not contain 초안`).not.toContain('초안');
      expect(src, `${path.basename(file)} must not contain draft`).not.toMatch(/draft/i);
    }
  });
});

describe('approved simulation anchors survive the engine shape', () => {
  it('the mirror anchor passes through the gate untouched', () => {
    const gate = coerceLightGate({ need: 'light', mirror: MIRROR_ANCHOR, question: '어느 쪽 이유가 커요?' });
    expect(gate.mirror).toBe(MIRROR_ANCHOR);
  });

  it('the offer anchor seals as-written (the user\'s words are the material)', () => {
    const turn = coerceLightTurn(
      { mirror: 'm', action: 'offer', offer: { sentence: OFFER_ANCHOR, when: 'tomorrow_morning' } },
      2,
    );
    expect(turn.action).toBe('offer');
    expect(turn.offer?.sentence).toBe(OFFER_ANCHOR);
    expect(turn.offer?.when).toBe('tomorrow_morning');
  });
});
