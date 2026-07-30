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

  it('gap-naming stays warm, never blunt (founder polish — the pair is pinned in both locales)', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('✗ "왜 망설여지시는지는 모르겠어요" ✓ "어느 쪽 이유인지는 아직 얘기 안 하셨고요"');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('✗ "I can\'t tell why you\'re hesitating" ✓ "You haven\'t said which reason it is yet"');
    }
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

  it('KO gate prompt invites the lean+reason in one breath on a visible fork', () => {
    // The example question keeps the 왜-그런지 half but NOT "한 줄이면 돼요" —
    // that line belongs to the input placeholder alone (redundancy defect 2).
    expect(KO_GATE).toContain('지금 마음은 어느 쪽에 가 있어요? 왜 그런지도 같이요.');
    expect(KO_GATE).not.toContain('왜 그런지 한 줄이면 돼요');
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

describe('copy-redundancy rules (production capture): each line appears exactly once on screen', () => {
  it('rule 9 — the mirror never ends as a question, with the ✗/✓ pair (both locales)', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('비추기(mirror)는 서술로 끝냅니다 — 질문으로 끝내지 마세요.');
      expect(prompt).toContain('✗ "…걱정되시는 거네요. 지금 마음은 어느 쪽이에요?" ✓ "…걱정되시는 거네요. 어느 쪽인지는 아직 얘기 안 하셨고요."');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('The mirror ends as a statement — never as a question.');
    }
  });

  it('rule 10 — the question never carries "한 줄이면 돼요" (the placeholder owns it), both locales', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('질문 문장에 "한 줄이면 돼요"를 넣지 마세요');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('Never put "one line is enough" inside a question');
    }
  });

  it('rule 11 — the check moment comes AFTER the claim can be answered: principle + BOTH ✗/✓ pairs (both locales)', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('확인 시점은 문장이 답해질 수 있게 된 뒤여야 합니다');
      expect(prompt).toContain('원칙: 문장이 가리키는 일이 끝난 뒤의 첫 아침(또는 첫 순간)을 고르세요.');
      expect(prompt).toContain('✗ 주말 약속인데 when이 "tomorrow_morning" ✓ 주말 약속이면 "this_weekend"');
      expect(prompt).toContain('✗ 내일 저녁 일인데 when이 "tomorrow_morning" ✓ 내일 저녁 일이면 "in_days"에 days 2 (모레 아침)');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('The check moment must come AFTER the claim can be answered');
      expect(prompt).toContain('Principle: pick the FIRST morning (or moment) AFTER the event the sentence names.');
      expect(prompt).toContain('✗ a weekend plan with when "tomorrow_morning" ✓ a weekend plan with "this_weekend"');
      expect(prompt).toContain('✗ a tomorrow-evening event with when "tomorrow_morning" ✓ a tomorrow-evening event with "in_days", days 2');
    }
  });

  it('rule 12 — the mirror never appraises/minimizes what the user called hard (R4 capture pinned)', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('사용자가 어렵다고 말한 것을 평가하거나 축소하지 마세요');
      expect(prompt).toContain('✗ "일곱 시 반이면 그렇게 이른 것도 아니고요" ✓ "일곱 시 반이 이르게 느껴지시는 거네요"');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('Never appraise or minimize what the user called hard');
      expect(prompt).toContain('✗ "7:30 isn\'t really that early" ✓ "So 7:30 feels early to you"');
    }
  });

  it('rule 13 — one question = one plain contrast, readable in one pass (R3 capture pinned)', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('질문 하나 = 대비 하나, 한 번에 읽히게.');
      expect(prompt).toContain('✗ "눈치보이는 게 빠진다는 말 자체인지, 아니면 이유를 뭐라고 말할지인지 어느 쪽이에요?" ✓ "눈치가 보이는 건 빠지는 것 자체예요, 아니면 뭐라고 말할지예요?"');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('One question = one plain contrast, readable in one pass.');
    }
  });

  it('rule 14 — a named, deferred second decision gets its handle back at the close (R4 capture)', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('다른 결정을 이름 붙여 미뤘다면');
      expect(prompt).toContain('"부업 얘기는 언제든 따로 던져 주세요."');
      expect(prompt).toContain('버튼도 의식도 없이, 그 한 줄만.');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('If you explicitly deferred a named second decision');
      expect(prompt).toContain('No button, no ceremony');
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

  it('the light surface carries NO emoji — presence is the mascot, never a glyph (grep guard)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', 'components', 'workspace', 'light', 'LightFlow.tsx'),
      'utf8',
    );
    // Emoji/pictograph/dingbat planes (includes ✓/✗/⚡/★-adjacent symbol blocks
    // and the variation selector). The mascot image is the only allowed presence.
    expect(src).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2B50}]/u);
  });
});

describe('sim-campaign rules (2026-07-31): the light path holds the lines the sim broke', () => {
  const KO_GATE = buildLightSystemPrompt('ko', 'gate');
  const EN_GATE = buildLightSystemPrompt('en', 'gate');

  it('F2 — a question that is not a decision routes heavy (info/how-to never gets a mirror ritual)', () => {
    expect(KO_GATE).toContain('결정이 아닌 질문(뜻 풀이·방법·사실 문의)도 heavy로 분류하세요');
    expect(EN_GATE).toContain('A question that is NOT a decision (a definition, a how-to, a fact) also routes heavy');
  });

  it('F11 — the first-question example is a SHAPE, not a script, and carries one question mark', () => {
    expect(KO_GATE).toContain('형태 예시 (그대로 복사 금지 — 매번 사용자의 말로 새로 만드세요. 물음표는 한 번만)');
    expect(EN_GATE).toContain('Shape example (never copy it verbatim');
  });

  it('F7 — the anchor covers tense/state: never assert the opposite of what was written', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('시제·진행 상태도 쓴 그대로만');
      expect(prompt).toContain('✗ (상태를 안 밝혔는데) "아직 파티가 끝나지 않은 거네요"');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('never assert the opposite or an unstated state of the world');
    }
  });

  it('F10 — the leave-behind must be declarative, no interrogatives, no conditional forks', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('반드시 평서문으로');
      expect(prompt).toContain('✗ "남편 반응이 어땠는가" ✓ "남편이 선물을 마음에 들어 했다"');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('Always DECLARATIVE');
    }
  });

  it('F9 — bigger_question must be the NAME of a concrete decision, not psychological rhetoric', () => {
    for (const prompt of KO_PROMPTS) {
      expect(prompt).toContain('bigger_question은 구체적인 결정의 이름이어야 합니다');
    }
    for (const prompt of EN_PROMPTS) {
      expect(prompt).toContain('bigger_question must be the NAME of a concrete decision');
    }
  });

  it('F6 — {오늘의 정리} may hold ONLY a user-stated lean; the sim quote is pinned as ✗', () => {
    const NEXT_KO = buildLightSystemPrompt('ko', 'next', 1);
    const NEXT_EN = buildLightSystemPrompt('en', 'next', 1);
    expect(NEXT_KO).toContain('{오늘의 정리}에는 사용자가 직접 말한 기울기/결정만 넣을 수 있습니다');
    expect(NEXT_KO).toContain('✗ (사용자가 안 정했는데) "그럼 부모님 뵙고 일요일 저녁에 밀린 일 하는 걸로 하고 —"');
    expect(NEXT_EN).toContain('{today\'s call} may hold ONLY a lean/decision the user actually stated');
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
