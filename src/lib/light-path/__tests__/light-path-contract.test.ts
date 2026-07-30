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

  it('offers carry exactly sentence/when/days — nothing else survives', () => {
    const turn = coerceLightTurn(
      { mirror: 'm', action: 'offer', offer: { sentence: 's', when: 'tonight', days: 3, options: ['x'], verdict: '가라' } },
      1,
    );
    expect(Object.keys(turn.offer!).sort()).toEqual(['sentence', 'when']);
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
