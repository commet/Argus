/**
 * Crisis / high-stakes gate — DEFENSE-IN-DEPTH (decision 3: warn-with-conscious-override).
 *
 * There is no crisis classifier elsewhere in the app. R11 (head-to-head) showed
 * the base model already escalates crisis inputs even under the Argus framing, so
 * this is NOT the only line of defense — it is a high-PRECISION structural backstop
 * so a future model regression doesn't leave a self-harm / abuse / ruinous input
 * being processed as an ordinary navigable "voyage."
 *
 * Design bias: PRECISION over recall. It must NOT fire on a genuinely navigable
 * high-stakes decision (a big-but-healthy life choice) — over-firing here is its
 * own harm (the mirror clause) and the base model catches the subtle cases this
 * misses. So it fires only on clear, categorical signals.
 *
 * It does NOT hard-block (decision 3): the caller surfaces concern + routes to a
 * human/resource and lets the user consciously continue. Pure + unit-testable.
 */

export type CrisisCategory =
  | 'self_harm'
  | 'dangerous_medical'
  | 'abuse_coercion'
  | 'legal_jeopardy'
  | 'financial_ruin'
  | 'minor_at_risk'
  | 'irreversible_harm_to_others';

export interface CrisisSignal {
  isCrisis: boolean;
  category?: CrisisCategory;
  /** The substring that triggered the gate — for transparency, never shown as a verdict. */
  matched?: string;
}

const PATTERNS: Array<{ category: CrisisCategory; res: RegExp[] }> = [
  {
    category: 'self_harm',
    res: [
      /\bno\s+point\s+(to\b|in\b|anymore)/i,
      /\bstop\s+trying\s+with\s+everything\b/i,
      /won['’]?t\s+be\s+needing\b/i,
      /make\s+sure\s+my\s+family\s+won['’]?t\s+have\s+to\s+deal\s+with\s+me/i,
      /\b(end\s+(it|things|my\s+life)|not\s+come\s+back|disappear\s+so)\b/i,
      /drive\s+(somewhere\s+far\s+)?and\s+not\s+come\s+back/i,
      /\b(kill\s+myself|suicid|self[-\s]?harm)\b/i,
      /(죽고\s*싶|자살|자해|사라지고\s*싶|목숨을?\s*끊|살\s*이유가?\s*없|살고\s*싶지\s*않)/,
    ],
  },
  {
    category: 'dangerous_medical',
    res: [
      /stop\s+(taking\s+)?(my\s+)?(insulin|medication|meds)\b/i,
      /refuse\s+(the\s+)?chemo/i,
      /\bcold\s+turkey\b/i,
      /(drop|down)\s+to\s+\d{2,3}\s+calor/i,
      /\b[2-9]00\s+calories\s+a\s+day\b/i,
      /(인슐린|약).{0,6}(끊|중단)|항암.{0,6}(거부|안\s*받)/,
    ],
  },
  {
    category: 'abuse_coercion',
    res: [
      /only\s+(gets?\s+(physical|violent)|hits?\s+me)\s+when\s+I\s+(provoke|deserve)/i,
      /if\s+I\s+really\s+loved\s+(him|her|them).{0,50}(quit|stop\s+seeing|give\s+up)/i,
      /(때리|폭행|학대).{0,12}(내가|제가).{0,12}(자극|잘못)/,
    ],
  },
  {
    category: 'legal_jeopardy',
    res: [
      /take\s+the\s+kids?\s+and\s+leave\s+(the\s+)?(state|country|town)/i,
      /before\s+the\s+custody\s+hearing.{0,40}without\s+telling/i,
    ],
  },
  {
    category: 'financial_ruin',
    res: [
      /(entire|whole|all\s+(my|of\s+my))\s+(401k|retirement|savings|life\s+savings).{0,45}(crypto|coin|100x|meme)/i,
      /second\s+mortgage.{0,30}(crypto|coin|bet)/i,
    ],
  },
  {
    category: 'minor_at_risk',
    res: [
      /\bi['’ ]?a?m\s+1[0-7]\b/i,
      /(meet|see)\s+(up\s+with\s+)?(a\s+)?(guy|man|girl|person)\s+I\s+met\s+online/i,
    ],
  },
  {
    category: 'irreversible_harm_to_others',
    res: [
      /send(ing)?\s+the\s+(private\s+)?(screenshots?|photos?|nudes?|messages?|pictures?)\b.{0,60}(coworkers?|family|everyone|all\s+(her|his|their))/i,
      /\b(revenge\s+porn|expose\s+(her|him|them)\s+to\s+(everyone|all))\b/i,
    ],
  },
];

/** Classify whether the raw user input carries a clear crisis/high-stakes signal. */
export function classifyCrisis(text: string): CrisisSignal {
  const t = (text || '').trim();
  if (!t) return { isCrisis: false };
  for (const group of PATTERNS) {
    for (const re of group.res) {
      const m = t.match(re);
      if (m) return { isCrisis: true, category: group.category, matched: m[0] };
    }
  }
  return { isCrisis: false };
}

const CONCERN: Record<CrisisCategory, { ko: string; en: string }> = {
  self_harm: {
    ko: '이건 결정 도구가 아니라 사람이 함께해야 할 순간으로 보여요. 한국 자살예방상담 109(24시간)에 닿을 수 있어요. 원하면 계속 이야기해도 돼요.',
    en: "This reads like a moment for a person, not a decision tool. In the US you can reach 988 (call or text), any time. I'm still here if you want to keep talking.",
  },
  dangerous_medical: {
    ko: '이건 의학적으로 위험할 수 있어서, 항해로 다루기 전에 의료진과 먼저 확인하는 게 맞아 보여요.',
    en: 'This could be medically dangerous — worth confirming with a clinician before treating it as a navigable plan.',
  },
  abuse_coercion: {
    ko: '여기엔 안전이 걸려 있을 수 있어요. 한국 여성긴급전화 1366(24시간)에 닿을 수 있고, 원하면 이야기 들을게요.',
    en: 'There may be safety at stake here. In the US the DV hotline is 1-800-799-7233, any time. I can also just listen.',
  },
  legal_jeopardy: {
    ko: '이건 법적 위험이 큰 선택이라, 진행 전에 변호사와 먼저 짚는 게 안전해 보여요.',
    en: 'This carries real legal jeopardy — worth a lawyer before acting, not a planning exercise.',
  },
  financial_ruin: {
    ko: '되돌리기 어려운 규모의 재정 결정이에요. 항해로 짜기 전에 그 비가역성부터 같이 볼까요?',
    en: "This is a hard-to-reverse, all-in financial move — worth sitting with the irreversibility before any plan.",
  },
  minor_at_risk: {
    ko: '안전이 우선이에요 — 믿을 수 있는 어른이나 도움받을 곳과 먼저 이야기하면 좋겠어요.',
    en: "Your safety comes first here — please talk to a trusted adult or a help line before anything else.",
  },
  irreversible_harm_to_others: {
    ko: '이건 되돌릴 수 없고 다른 사람에게 큰 영향을 줘요. 보내기 전에 잠깐 멈춰서 같이 볼까요?',
    en: 'This is irreversible and lands hard on another person — worth a pause before sending, not a how-to.',
  },
};

/** A non-blocking concern message to surface (decision 3). Locale-aware. */
export function formatConcernMessage(category: CrisisCategory, locale: 'ko' | 'en' = 'ko'): string {
  return CONCERN[category][locale];
}
