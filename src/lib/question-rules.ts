/**
 * Question rules as DATA — the single source of truth for banned-question
 * patterns, the global generation instruction, and option-shape constants
 * (DESIGN-clarify-question-system-v2 §6.2, §6.4, §8).
 *
 * Three surfaces (webapp prompts, argus-plugin-v2 markdown, argus-mcp) must not
 * each keep a private copy of these rules — that is the one-brain-many-bodies
 * drift this repo has been burned by. The webapp prompt builders + the
 * deterministic validator (question-validator.ts) import from here; the
 * plugin/MCP copies are pinned by a drift test (§8, Phase 6).
 *
 * A "good" Argus question is a neutral crux QUESTION that exposes the premise
 * or fork that changes the user's judgment. It is NEVER: an admin-only ask
 * (deadline, final decision-maker, format, tone), a category label, a re-ask of
 * something already known, an internal-structure ask (which section to fill), or
 * a confirmation ("does this look right"). These patterns encode that floor.
 */

export type RuleLocale = 'ko' | 'en';

export type RejectRule =
  | 'admin_only'        // R1 — logistics a good crux question never is
  | 'category_options'  // R2 — options are bare category nouns, not real forks
  | 'reask_known'       // R3 — re-asks something already in the transcript
  | 'internal_structure'// R4 — asks about the deliverable's skeleton/sections
  | 'over_fire'         // R5 — reached the validator on a non-open request (bug)
  | 'forced_checkpoint' // R6 — checkpoint_seed with no premise / non-open
  | 'confirmation_bias';// leading "is this the right direction" confirmation

/**
 * Banned-question patterns (R1 admin-only, R4 internal-structure, confirmation
 * bias). ko + en. Deliberately conservative — these match phrasings a good crux
 * question is *never* built from, so a match is a hard reject. Kept as data so
 * the validator, the Phase-0 fallback self-check, and the plugin/MCP drift test
 * all read one list.
 */
export const BANNED_QUESTION_PATTERNS: ReadonlyArray<{ rule: RejectRule; re: RegExp; note: string }> = [
  // ── R1 admin-only ────────────────────────────────────────────────────────
  { rule: 'admin_only', re: /최종\s*결정권자/, note: 'ko: final decision-maker' },
  { rule: 'admin_only', re: /누(가|구).{0,8}최종.{0,4}(판단|결정)/, note: 'ko: who makes the final call' },
  { rule: 'admin_only', re: /최종\s*(판단|결정)(은|는|을|이)?\s*누(가|구)/, note: 'ko: the final call is whose' },
  { rule: 'admin_only', re: /마감(일|이|은|을|\s*시한|\s*날짜)/, note: 'ko: deadline' },
  { rule: 'admin_only', re: /데드라인/, note: 'ko: deadline (loanword)' },
  { rule: 'admin_only', re: /어떤\s*형식/, note: 'ko: what format' },
  { rule: 'admin_only', re: /몇\s*(페이지|장|줄)/, note: 'ko: how many pages' },
  { rule: 'admin_only', re: /어떤\s*톤/, note: 'ko: what tone' },
  { rule: 'admin_only', re: /어느\s*섹션/, note: 'ko: which section' },
  { rule: 'admin_only', re: /final\s+decision[-\s]?maker/i, note: 'en: final decision-maker' },
  { rule: 'admin_only', re: /who\s+(is|will|should)\b.{0,24}\b(final|ultimately|decide|sign\s*off)/i, note: 'en: who decides' },
  { rule: 'admin_only', re: /\bdeadline\b/i, note: 'en: deadline' },
  { rule: 'admin_only', re: /what\s+(format|tone)\b/i, note: 'en: what format/tone' },
  { rule: 'admin_only', re: /how\s+many\s+pages\b/i, note: 'en: how many pages' },
  { rule: 'admin_only', re: /which\s+section\b/i, note: 'en: which section' },
  // ── R4 internal structure ────────────────────────────────────────────────
  { rule: 'internal_structure', re: /스켈레톤/, note: 'ko: skeleton' },
  { rule: 'internal_structure', re: /(섹션|항목|목차)(을|를)?\s*채/, note: 'ko: fill in the section/outline' },
  { rule: 'internal_structure', re: /\bskeleton\b/i, note: 'en: skeleton' },
  { rule: 'internal_structure', re: /fill\s+(in|out)\s+the\s+(section|outline|template)/i, note: 'en: fill in the outline' },
  // ── confirmation bias (a leading confirmation is not a crux question) ──────
  { rule: 'confirmation_bias', re: /이\s*방향(이|으로)?\s*맞(나요|습니까|죠|지요|을까요)/, note: 'ko: is this the right direction' },
  { rule: 'confirmation_bias', re: /(이게|이\s*방향이)\s*맞다고\s*보(시|나요|죠)/, note: 'ko: you think this is right, no?' },
  { rule: 'confirmation_bias', re: /(is|does)\s+this\s+(the\s+right\s+|look\s+)?direction\b/i, note: 'en: is this the right direction' },
  { rule: 'confirmation_bias', re: /does\s+this\s+look\s+right/i, note: 'en: does this look right' },
];

/**
 * Does the text hit any banned pattern? Returns the first match's rule + note,
 * or null. Pure. Normalize before comparing so Korean spacing variance doesn't
 * let a banned phrasing slip through (§6.2: normalize first).
 */
export function matchBannedPattern(text: string): { rule: RejectRule; note: string } | null {
  const t = (text ?? '').normalize('NFC');
  for (const p of BANNED_QUESTION_PATTERNS) {
    if (p.re.test(t)) return { rule: p.rule, note: p.note };
  }
  return null;
}

/**
 * The global instruction injected into every typed-question prompt (§6.4). Lifts
 * generation quality itself, independent of the validator. One string, imported
 * by every prompt builder so the three surfaces can't drift on intent.
 */
export const GLOBAL_QUESTION_INSTRUCTION: Record<RuleLocale, string> = {
  ko: [
    '당신의 임무는 정보 수집이 아닙니다. 사용자의 판단을 바꾸는 전제나 갈림길 하나를 드러내는 것입니다.',
    '절대 묻지 마세요: 최종 결정권자, 마감/형식/톤, 채울 섹션, "이게 맞나요"(확인 요구).',
    '사용자 자신의 표현을 따라가세요 — "먹힐지 모르겠다"고 했으면 "먹힌다"가 무슨 뜻인지 파고드세요. "시장 검증"으로 번역하지 마세요.',
    '질문은 중립적인 crux 질문이어야 합니다. 기울인 진술("~하는 게 낫지 않을까요")도, 태그 붙인 평결("제 판단은 아니지만 ~쪽")도 금지입니다.',
  ].join(' '),
  en: [
    'Your job is not to collect information. Your job is to expose the one premise or fork that changes the user\'s judgment.',
    'Never ask: final decision-maker, deadline/format/tone, section-to-fill, "does this look right" (confirmation).',
    'Follow the user\'s own words — if they said it "might not land", interrogate what "landing" means; don\'t translate it into "market validation".',
    'The question must be a neutral crux question. No tilted statements ("wouldn\'t it be safer to…"), and no disclaimed verdicts ("not my call, but X leans…").',
  ].join(' '),
};

/**
 * Personality-verdict patterns — the vocabulary a growth note / active feedback
 * must NEVER use (checkpoints v2 §10.2: "당신은 ~한 사람/유형/경향" is a trait
 * verdict about the user, a spine violation). Shared so the growth-note
 * generator and any future feedback surface block the same phrasings. ko + en.
 */
export const PERSONALITY_VERDICT_PATTERNS: ReadonlyArray<RegExp> = [
  /(당신|너)(은|는|이|가)?\s*[^.?!]{0,16}(사람|유형|타입|성격|스타일)(이에요|입니다|이네요|이군요|이야|이)/,
  /(당신|너)의?\s*성격/,
  /(성급|신중|낙관|비관|과감|소심|완벽주의|즉흥)(한|적인)\s*(성향|사람|유형|타입|편)/,
  /\byou(?:'re| are)\s+(a|an|the)\s+[^.?!]{0,16}(type|person|kind)\b/i,
  /\byou\s+(tend to be|are inherently|are naturally|always)\b/i,
  /\byour\s+personality\b/i,
];

/** Does the text attribute a personality trait to the user (a spine-banned
 *  verdict)? Pure; NFC-normalized. A growth note that trips this is dropped
 *  entirely (honest gap), never softened. */
export function hasPersonalityVerdict(text: string): boolean {
  const t = (text ?? '').normalize('NFC');
  return PERSONALITY_VERDICT_PATTERNS.some((re) => re.test(t));
}

/**
 * Option-shape thresholds (§6.2 R2). An option is a real fork only if it reads
 * like a decision a boss could sign, not a bare category noun. Korean is terser
 * than English, so the average-length floor differs. Tuned against the Phase-1
 * fixture set; kept here so there is one place to adjust.
 */
export const OPTION_MIN_AVG_LEN: Record<RuleLocale, number> = { ko: 12, en: 20 };

/** Single-word category nouns that, standing alone as an option, signal R2. */
export const CATEGORY_OPTION_WORDS: ReadonlyArray<string> = [
  '전략', '실행', '커뮤니케이션', '우선순위', '리스크', '품질', '속도', '비용',
  'strategy', 'execution', 'communication', 'priority', 'risk', 'quality', 'speed', 'cost',
];

/** The frame_clarify gate threshold. Tuning target (§4.3b) — kept as a named
 *  constant so the eval set can move it in one place. */
export const FRAME_CLARIFY_CONFIDENCE_GATE = 70;

/** When STEP-0 omits framing_confidence, the QUESTION-ROUTING input treats it as
 *  this (not the global 75 default) — "signal absent" must not read as "confident"
 *  at the one gate where absence should *lower* confidence (§4.3b). Scoped to
 *  routing; other consumers keep their own defaults. */
export const FRAMING_CONFIDENCE_ROUTING_FALLBACK = 50;
