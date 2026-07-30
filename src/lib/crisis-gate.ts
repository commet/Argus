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

/** Single source of truth for the crisis category set. The webapp crisis-gate
 *  AND the plugin clarify Axis-0 screen must agree on this set; the parity test
 *  (crisis-taxonomy-parity.test.ts) fails CI if they drift apart. Add/rename a
 *  category here only, then update the plugin Axis-0 list in the same change. */
export const CRISIS_CATEGORIES = [
  'self_harm',
  'dangerous_medical',
  'abuse_coercion',
  'legal_jeopardy',
  'financial_ruin',
  'minor_at_risk',
  'irreversible_harm_to_others',
] as const;
export type CrisisCategory = typeof CRISIS_CATEGORIES[number];

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
      // 완곡어 (sim F1, heavy-09): 빚/채무 맥락의 "(그냥) 다/전부 정리해버리다" —
      // 재정 파탄 화면에서 흔한 자해 완곡 표현. 채무 앵커 없이 "책상 다 정리"류는
      // 잡지 않는다 (정밀 우선). 활용형(버릴까/버렸/버려)은 조합 음절이라 '버리'
      // 리터럴로는 못 잡는다 — 음절 클래스로 매칭 (플러그인 낱자모 죽은 규칙 교훈).
      /(빚|채무|대출|이자).{0,60}(그냥\s*)?(다|전부|모두|싹)\s*정리해\s*버[리려렸릴린]/,
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
      // KO (sim F1 정적 감사: 이 카테고리는 한국어 패턴 0개였다 — 주 사용 언어가
      // 한국어인 제품의 백스톱이 영어에 편향). EN 패턴의 거울: 양육권 절차 앞의
      // 은닉 이동만 — 평범한 양육권 상담은 잡지 않는다 (정밀 우선).
      /(양육권|친권).{0,30}(소송|재판|심판|심리|조정).{0,40}(몰래|말\s*없이|숨기)/,
      /(아이|애들?|자녀)\s*(를|들을)?\s*데리고.{0,30}(몰래|말\s*없이).{0,30}(떠나|이사|출국|가\s*버리)/,
    ],
  },
  {
    category: 'financial_ruin',
    res: [
      // Total-stake phrase + speculative signal, both required (precision). Broadened
      // so "life savings ... 50x" and "all my savings ... guaranteed" fire too, not
      // just "401k ... 100x" (F20). \d{2,3}x covers 20x/50x/100x. Split savings vs
      // 401k/retirement so the optional "my" doesn't double-require a space.
      /(life|all\s+(of\s+)?(my\s+)?|entire|whole|my\s+(life|entire))\s*savings\b.{0,45}(crypto|coin|meme|\d{2,3}x|guaranteed)/i,
      /(entire|whole|all\s+(of\s+)?(my\s+)?|my)\s*(401k|retirement)\b.{0,45}(crypto|coin|meme|\d{2,3}x|guaranteed)/i,
      /second\s+mortgage.{0,30}(crypto|coin|bet|\d{2,3}x)/i,
      // KO (sim F1): 전 재산급 판돈 + 투기 신호의 2중 요건 — EN과 같은 정밀 편향.
      // "주식 조금 사볼까" 같은 일상 투자 결정은 판돈 앵커가 없어 잡히지 않는다.
      /(전\s*재산|전세\s*(보증)?금|노후\s*자금|퇴직금).{0,40}(코인|크립토|가상\s*화폐|주식|선물|레버리지|몰빵|올인)/,
      /(대출|빚)\s*(을|를)?\s*(내서|받아서|끌어다|당겨서).{0,30}(코인|주식|선물|도박)/,
      /(집|아파트)\s*담보.{0,30}(코인|주식|도박)/,
    ],
  },
  {
    category: 'minor_at_risk',
    res: [
      /\bi['’ ]?a?m\s+1[0-7]\b/i,
      // An online stranger + a meeting, in EITHER order and varied phrasing (F19).
      // The online-stranger anchor is kept on purpose — a bare "meet"/"come over"
      // with no stranger signal would over-fire on any adult (the mirror clause).
      /(meet|see)\s+(up\s+with\s+)?(a\s+)?(guy|man|girl|person)\s+I\s+met\s+online/i,
      /(guy|man|girl|person|someone)\s+(I\s+)?(met\s+)?online\b.{0,50}(wants?\s+(to\s+)?(meet|see)|come\s+over|meet\s+up|see\s+me)/i,
      /(meet\s+up|come\s+over|meet|see)\b.{0,40}(guy|man|girl|person|someone)\b.{0,20}(from|met)\s+online/i,
      // KO (sim F1 정적 감사). EN과 같은 앵커: 미성년 자기 선언, 또는 온라인에서
      // 만난 낯선 사람 + 만남 제안. 앵커 없는 일상 약속은 잡지 않는다.
      /(저|전|나)\s*(이제\s*)?1[0-7]\s*살인데/,
      /(인터넷|온라인|채팅|앱|게임)에서\s*만난\s*(사람|남자|여자|오빠|형|언니|누나).{0,40}(만나자|만나기로|보자|보재|오라|나오라|나오래)/,
    ],
  },
  {
    category: 'irreversible_harm_to_others',
    res: [
      /send(ing)?\s+the\s+(private\s+)?(screenshots?|photos?|nudes?|messages?|pictures?)\b.{0,60}(coworkers?|family|everyone|all\s+(her|his|their))/i,
      /\b(revenge\s+porn|expose\s+(her|him|them)\s+to\s+(everyone|all))\b/i,
      // KO (sim F1 정적 감사). EN의 거울: 사적 자료 + 유포 의도. 복수 의도가
      // 명확한 동사(유포/뿌리/퍼뜨리/폭로/박제)만 — "사진 보내달래"류는 제외.
      /(전\s*남친|전\s*여친|전\s*남편|전\s*아내|헤어진\s*(남친|여친|애인)).{0,40}(사진|영상|캡처|대화\s*내용).{0,30}(유포|뿌리|퍼뜨리|폭로|박제)/,
      /(나체|알몸|은밀한)\s*(사진|영상).{0,30}(회사|가족|지인|단톡|모두에게|다\s*보내|뿌리)/,
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
