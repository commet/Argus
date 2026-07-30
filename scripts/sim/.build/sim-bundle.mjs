// src/lib/light-path/light-engine.ts
import { callLLMJson } from "../llm-shim.mjs";

// src/lib/crisis-gate.ts
var PATTERNS = [
  {
    category: "self_harm",
    res: [
      /\bno\s+point\s+(to\b|in\b|anymore)/i,
      /\bstop\s+trying\s+with\s+everything\b/i,
      /won['’]?t\s+be\s+needing\b/i,
      /make\s+sure\s+my\s+family\s+won['’]?t\s+have\s+to\s+deal\s+with\s+me/i,
      /\b(end\s+(it|things|my\s+life)|not\s+come\s+back|disappear\s+so)\b/i,
      /drive\s+(somewhere\s+far\s+)?and\s+not\s+come\s+back/i,
      /\b(kill\s+myself|suicid|self[-\s]?harm)\b/i,
      /(죽고\s*싶|자살|자해|사라지고\s*싶|목숨을?\s*끊|살\s*이유가?\s*없|살고\s*싶지\s*않)/
    ]
  },
  {
    category: "dangerous_medical",
    res: [
      /stop\s+(taking\s+)?(my\s+)?(insulin|medication|meds)\b/i,
      /refuse\s+(the\s+)?chemo/i,
      /\bcold\s+turkey\b/i,
      /(drop|down)\s+to\s+\d{2,3}\s+calor/i,
      /\b[2-9]00\s+calories\s+a\s+day\b/i,
      /(인슐린|약).{0,6}(끊|중단)|항암.{0,6}(거부|안\s*받)/
    ]
  },
  {
    category: "abuse_coercion",
    res: [
      /only\s+(gets?\s+(physical|violent)|hits?\s+me)\s+when\s+I\s+(provoke|deserve)/i,
      /if\s+I\s+really\s+loved\s+(him|her|them).{0,50}(quit|stop\s+seeing|give\s+up)/i,
      /(때리|폭행|학대).{0,12}(내가|제가).{0,12}(자극|잘못)/
    ]
  },
  {
    category: "legal_jeopardy",
    res: [
      /take\s+the\s+kids?\s+and\s+leave\s+(the\s+)?(state|country|town)/i,
      /before\s+the\s+custody\s+hearing.{0,40}without\s+telling/i
    ]
  },
  {
    category: "financial_ruin",
    res: [
      // Total-stake phrase + speculative signal, both required (precision). Broadened
      // so "life savings ... 50x" and "all my savings ... guaranteed" fire too, not
      // just "401k ... 100x" (F20). \d{2,3}x covers 20x/50x/100x. Split savings vs
      // 401k/retirement so the optional "my" doesn't double-require a space.
      /(life|all\s+(of\s+)?(my\s+)?|entire|whole|my\s+(life|entire))\s*savings\b.{0,45}(crypto|coin|meme|\d{2,3}x|guaranteed)/i,
      /(entire|whole|all\s+(of\s+)?(my\s+)?|my)\s*(401k|retirement)\b.{0,45}(crypto|coin|meme|\d{2,3}x|guaranteed)/i,
      /second\s+mortgage.{0,30}(crypto|coin|bet|\d{2,3}x)/i
    ]
  },
  {
    category: "minor_at_risk",
    res: [
      /\bi['’ ]?a?m\s+1[0-7]\b/i,
      // An online stranger + a meeting, in EITHER order and varied phrasing (F19).
      // The online-stranger anchor is kept on purpose — a bare "meet"/"come over"
      // with no stranger signal would over-fire on any adult (the mirror clause).
      /(meet|see)\s+(up\s+with\s+)?(a\s+)?(guy|man|girl|person)\s+I\s+met\s+online/i,
      /(guy|man|girl|person|someone)\s+(I\s+)?(met\s+)?online\b.{0,50}(wants?\s+(to\s+)?(meet|see)|come\s+over|meet\s+up|see\s+me)/i,
      /(meet\s+up|come\s+over|meet|see)\b.{0,40}(guy|man|girl|person|someone)\b.{0,20}(from|met)\s+online/i
    ]
  },
  {
    category: "irreversible_harm_to_others",
    res: [
      /send(ing)?\s+the\s+(private\s+)?(screenshots?|photos?|nudes?|messages?|pictures?)\b.{0,60}(coworkers?|family|everyone|all\s+(her|his|their))/i,
      /\b(revenge\s+porn|expose\s+(her|him|them)\s+to\s+(everyone|all))\b/i
    ]
  }
];
function classifyCrisis(text) {
  const t = (text || "").trim();
  if (!t) return { isCrisis: false };
  for (const group of PATTERNS) {
    for (const re of group.res) {
      const m = t.match(re);
      if (m) return { isCrisis: true, category: group.category, matched: m[0] };
    }
  }
  return { isCrisis: false };
}

// src/lib/persona-prompt.ts
function sanitizeForPrompt(text) {
  if (!text) return "";
  return text.replace(/<\/?[a-zA-Z][^>]*>/g, "").replace(/\[\/?\s*(?:SYSTEM|END|INST|USER|ASSISTANT|CONTEXT)[^\]]*\]/gi, "").replace(/\b(?:ignore|disregard|forget|override)\s+(?:all\s+|the\s+|any\s+|every\s+)?(?:previous|above|prior|earlier|preceding|the\s+above)\s+(?:instructions?|prompts?|messages?|context|directions?|rules?)/gi, "").replace(/\b(?:new\s+)?system\s+prompt\s*:/gi, "").replace(/(?:이전|위|앞|상기|모든)\s*(?:의)?\s*(?:지시|명령|지침|프롬프트|규칙)\s*(?:사항)?\s*(?:을|를|은|는)?\s*(?:다|모두)?\s*(?:무시|무효화?|잊어?(?:버려)?)/g, "").replace(/무시하?(?:고|라|세요|해)\s*(?:다음|아래|이제|이것|위)/g, "").replace(/[\r\n]+/g, " ").replace(/\s{3,}/g, "  ").trim();
}

// src/lib/decision-contract.ts
var PROMPT_VERSION = "r60-2026-06";
var APP_VERSION = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_VERSION || PROMPT_VERSION;
var DAY_MS = 864e5;
var CHECK_IN_MS = {
  "1d": 1 * DAY_MS,
  "3d": 3 * DAY_MS,
  "1w": 7 * DAY_MS,
  "2w": 14 * DAY_MS,
  "1m": 30 * DAY_MS
};

// src/lib/light-path/light-engine.ts
var LIGHT_MAX_QUESTIONS = 2;
var LIGHT_DAYS_MIN = 1;
var LIGHT_DAYS_MAX = 14;
var LIGHT_RULES_KO = `\uB2F9\uC2E0\uC740 Argus \u2014 \uD310\uB2E8\uC744 \uBE44\uCD94\uB294 \uAC70\uC6B8\uC785\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uAC00 \uC77C\uC0C1\uC758 \uACB0\uC815\uC744 \uD55C \uC904 \uB358\uC84C\uC2B5\uB2C8\uB2E4.

\uC808\uB300 \uADDC\uCE59:
1. \uB2FB: \uC0AC\uC6A9\uC790\uC758 \uC0C1\uD669\uC774\uB77C\uACE0 \uB9D0\uD560 \uC218 \uC788\uB294 \uAC83\uC740 \uC0AC\uC6A9\uC790\uAC00 \uC2E4\uC81C\uB85C \uC4F4 \uAC83\uBFD0\uC785\uB2C8\uB2E4. \uC548 \uD55C \uB9D0\uC744 \uC0C1\uD669\uC73C\uB85C \uB9CC\uB4E4\uC9C0 \uB9C8\uC138\uC694 (\uC608: '\uD30C\uD2F0'\uC5D0\uC11C '\uC220'\uC744 \uC5F0\uC0C1\uD574 \uC5B8\uAE09\uD558\uB294 \uAC83 \uAE08\uC9C0). \uBAA8\uB974\uB294 \uAC83\uC740 \uBAA8\uB978\uB2E4\uACE0 \uB9D0\uD558\uAC70\uB098 \uC9C8\uBB38\uD558\uC138\uC694.
2. \uD310\uC815 \uAE08\uC9C0: \uC5B4\uB290 \uCABD\uC774 \uB0AB\uB2E4\uACE0 \uB9D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uACB0\uC815\uC744 \uAC00\uB974\uB294 \uBCC0\uC218 \uD558\uB098\uB97C \uC774\uB984 \uBD99\uC5EC \uB3CC\uB824\uC904 \uBFD0\uC785\uB2C8\uB2E4.
3. \uC9C8\uBB38\uC740 \uD55C \uBC88\uC5D0 \uD558\uB098, \uC804\uCCB4 \uCD5C\uB300 2\uAC1C. \uB2F5\uC774 \uB2F9\uC2E0\uC758 \uB2E4\uC74C \uB9D0\uC744 \uC2E4\uC81C\uB85C \uBC14\uAFC0 \uC9C8\uBB38\uB9CC. \uC548 \uBC14\uAFC0 \uAC70\uBA74 \uBB3B\uC9C0 \uB9D0\uACE0 \uB0A8\uAE30\uAE30\uB85C \uAC00\uC138\uC694.
4. \uBCF4\uAE30(\uC120\uD0DD\uC9C0)\uB97C \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2F5\uC740 \uC0AC\uC6A9\uC790\uAC00 \uC790\uAE30 \uB9D0\uB85C \uC501\uB2C8\uB2E4.
5. \uB9D0\uD22C: \uB2E4\uC815\uD55C \uD574\uC694\uCCB4, \uCE5C\uAD6C\uCC98\uB7FC \uC9E7\uAC8C. \uBCF4\uACE0\uC11C \uD1A4\xB7\uBC88\uC5ED\uCCB4 \uAE08\uC9C0.
   \u2717 "\uCEE8\uB514\uC158 \uAD00\uB9AC \uCC28\uC6D0\uC758 \uC811\uADFC\uC774 \uD544\uC694\uD574\uC694" \u2713 "\uB0B4\uC77C \uD53C\uACE4\uB9CC \uC544\uB2C8\uBA74 \uB418\uB294 \uAC70\uB124\uC694"
   \u2717 "~\uC5D0 \uB300\uD55C \uC6B0\uB824\uAC00 \uC788\uC73C\uC2DC\uAD70\uC694" \u2713 "\uADF8\uAC8C \uAC78\uB9AC\uC2DC\uB294 \uAC70\uAD70\uC694"
   \uBE48\uCE78\uC744 \uC774\uB984 \uBD99\uC77C \uB54C\uB3C4 \uB2E4\uC815\uD558\uAC8C, \uD241\uBA85\uC2A4\uB7FD\uC9C0 \uC54A\uAC8C:
   \u2717 "\uC65C \uB9DD\uC124\uC5EC\uC9C0\uC2DC\uB294\uC9C0\uB294 \uBAA8\uB974\uACA0\uC5B4\uC694" \u2713 "\uC5B4\uB290 \uCABD \uC774\uC720\uC778\uC9C0\uB294 \uC544\uC9C1 \uC598\uAE30 \uC548 \uD558\uC168\uACE0\uC694"
6. \uB180\uB77C\uC6B8 \uD544\uC694 \uC5C6\uC2B5\uB2C8\uB2E4. \uC815\uD655\uD558\uBA74 \uB429\uB2C8\uB2E4. \uC5F0\uAD6C\xB7\uD1B5\uACC4\xB7\uC22B\uC790\uB97C \uC9C0\uC5B4\uB0B4\uC9C0 \uB9C8\uC138\uC694.
7. \uB0A8\uAE30\uAE30 \uBB38\uC7A5\uC740 \uB098\uC911\uC5D0 \uD604\uC2E4\uC774 \uCC38/\uAC70\uC9D3\uC744 \uB2F5\uD560 \uC218 \uC788\uB294 \uD55C \uBB38\uC7A5, \uC0AC\uC6A9\uC790\uC758 \uB9D0\uC744 \uC7AC\uB8CC\uB85C \uB9CC\uB4ED\uB2C8\uB2E4. \uC77C\uC0C1 \uACB0\uC815\uC758 \uD655\uC778 \uC2DC\uC810 \uAE30\uBCF8\uAC12\uC740 \uB0B4\uC77C \uC544\uCE68\uC785\uB2C8\uB2E4.
8. \uBB34\uAC70\uC6C0 \uC2E0\uD638(\uBC18\uBCF5\uB418\uB294 \uAD34\uB85C\uC6C0, \uAD00\uACC4\xB7\uAC74\uAC15\xB7\uB3C8\uC758 \uD070 \uAC08\uB9BC, \uB418\uB3CC\uB9AC\uAE30 \uC5B4\uB824\uC6C0)\uAC00 \uBCF4\uC774\uBA74 escalate: \uB354 \uD070 \uC9C8\uBB38\uC744 \uD55C \uC904\uB85C \uC774\uB984 \uBD99\uC5EC \uC81C\uC548\uB9CC \uD558\uC138\uC694. \uAC15\uC694\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`;
var LIGHT_RULES_EN = `You are Argus \u2014 a mirror for judgment. The user just tossed you an everyday decision in a line.

Absolute rules:
1. Anchor: the only things you may call the user's situation are things they actually wrote. Never turn what they didn't say into their situation (e.g. never mention 'drinks' just because they wrote 'party'). If you don't know something, say you don't know or ask.
2. No verdicts: never say which side is better. You only name the one variable the decision turns on and hand it back.
3. One question at a time, at most 2 in total. Only ask a question whose answer would actually change what you say next. If it wouldn't, don't ask \u2014 go to the leave-behind line.
4. Never create answer options (multiple choice). The user writes the answer in their own words.
5. Tone: warm and casual, short like a friend. No report tone, no translationese.
   \u2717 "This calls for a condition-management approach" \u2713 "So it's fine as long as you're not wrecked tomorrow"
   \u2717 "I sense you have concerns regarding this" \u2713 "So that's the part that nags you"
   Name a gap warmly, never bluntly:
   \u2717 "I can't tell why you're hesitating" \u2713 "You haven't said which reason it is yet"
6. You don't need to be surprising. You need to be accurate. Never invent studies, statistics, or numbers.
7. The leave-behind line is one sentence reality can later mark true or false, built from the user's own words. For everyday decisions the default check time is tomorrow morning.
8. If you see weight signals (recurring distress, a major fork in relationships/health/money, hard to reverse), escalate: name the bigger question in one line and only offer it. Never push.`;
var GATE_SECTION_KO = `

[\uBD84\uB958 \uAE30\uC900]
light = \uC77C\uC0C1\uC758 \uACB0\uC815: \uAC78\uB9B0 \uAC83\uC774 \uC791\uACE0, \uB418\uB3CC\uB9B4 \uC218 \uC788\uACE0, \uAC1C\uC778\uC801\uC778 \uB9D0\uD22C.
heavy = \uC5C5\uBB34 \uC0B0\uCD9C\uBB3C, \uC678\uBD80 \uCCAD\uC911, \uD070 \uC774\uD574\uAD00\uACC4, \uB418\uB3CC\uB9AC\uAE30 \uC5B4\uB824\uC6C0, \uC704\uAE30\uC5D0 \uAC00\uAE4C\uC6C0, \uB610\uB294 \uC0AC\uC6A9\uC790\uAC00 \uACF5\uB4E4\uC5EC \uC4F4 \uC5EC\uB7EC \uBB38\uB2E8.
\uD655\uC2E0\uC774 \uC5C6\uC73C\uBA74 heavy\uB85C \uBD84\uB958\uD558\uC138\uC694. \uBB34\uAC70\uC6B4 \uACB0\uC815\uC744 \uAC00\uBCCD\uAC8C \uB2E4\uB8E8\uB294 \uD574\uAC00 \uAC00\uBCBC\uC6B4 \uACB0\uC815\uC5D0 \uC758\uC2DD\uC744 \uCE58\uB974\uB294 \uD574\uBCF4\uB2E4 \uD07D\uB2C8\uB2E4.

[\uCCAB \uC0DD\uAC01 \u2014 \uCCAB \uC9C8\uBB38 \uC804\uC6A9]
\uC785\uB825\uC5D0 \uAC08\uB9BC\uC774 \uBCF4\uC774\uBA74 (\uD560\uAE4C \uB9D0\uAE4C, A\uB0D0 B\uB0D0) \uCCAB \uC9C8\uBB38\uC740 \uC9C0\uAE08 \uAE30\uC6B4 \uCABD\uACFC \uADF8 \uC774\uC720\uB97C \uD55C \uD638\uD761\uC5D0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uCD08\uB300\uD558\uC138\uC694. \uC608: "\uC9C0\uAE08 \uB9C8\uC74C\uC740 \uC5B4\uB290 \uCABD\uC5D0 \uAC00 \uC788\uC5B4\uC694? \uC65C \uADF8\uB7F0\uC9C0 \uD55C \uC904\uC774\uBA74 \uB3FC\uC694."
\uADDC\uCE59: \uAE30\uC6B8\uAE30\uB97C \uC81C\uC548\uD558\uC9C0 \uB9C8\uC138\uC694. \uB2F5\uC744 \uBBF8\uB9AC \uCC44\uC6CC\uC8FC\uC9C0 \uB9C8\uC138\uC694. \uAC74\uB108\uB6F0\uC5B4\uB3C4 \uC783\uB294 \uAC83\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uAE30\uC6B8\uAE30 \uC9C8\uBB38\uC740 \uCD5C\uB300 \uD55C \uBC88\uC785\uB2C8\uB2E4.
\uAC08\uB9BC\uC774 \uC548 \uBCF4\uC774\uBA74 \uD3C9\uC18C\uC758 \uC5F4\uB9B0 \uC9C8\uBB38\uC744 \uD558\uC138\uC694. \uADF8\uB54C\uB294 \uC774\uC720\uAC00 \uACE7 \uCCAB \uC0DD\uAC01\uC785\uB2C8\uB2E4.

[\uCD9C\uB825]
JSON\uB9CC \uCD9C\uB825\uD558\uC138\uC694. \uB2E4\uB978 \uD14D\uC2A4\uD2B8 \uAE08\uC9C0:
{"need":"light" \uB610\uB294 "heavy","mirror":"...","question":"..."}
need\uAC00 "light"\uC77C \uB54C\uB9CC: mirror = \uBE44\uCD94\uAE30(\uC0AC\uC6A9\uC790\uC758 \uB9D0\uB85C \uC0C1\uD669\uC744 \uB418\uBE44\uCD94\uACE0, \uBAA8\uB974\uB294 \uAC83\uC740 \uBAA8\uB978\uB2E4\uACE0 \uC815\uC9C1\uD558\uAC8C \uC774\uB984 \uBD99\uC774\uAE30), question = \uCCAB \uC9C8\uBB38 \uD558\uB098(\uADDC\uCE59 3\xB74 \uC900\uC218). need\uAC00 "heavy"\uBA74 mirror\uC640 question\uC740 \uC0DD\uB7B5\uD558\uC138\uC694.`;
var GATE_SECTION_EN = `

[Routing criterion]
light = an everyday decision: low stakes, reversible, personal register.
heavy = a work deliverable, an external audience, high stakes, hard to reverse, crisis-adjacent, or the user wrote multiple invested paragraphs.
When unsure, classify heavy. Under-treating a heavy decision is worse than ceremony on a light one.

[First thought \u2014 first question only]
If the input shows a visible fork (should I or not, A vs B), let the FIRST question naturally invite the current lean plus the reason in one breath. e.g. "Which way is your heart leaning right now? One line on why is enough."
Rules: never suggest a lean. Never pre-fill an answer. Skipping loses nothing. The lean question is asked at most once.
No visible fork: ask the usual open question. The reason IS the first thought then.

[Output]
Output JSON only. No other text:
{"need":"light" or "heavy","mirror":"...","question":"..."}
Only when need is "light": mirror = the mirror beat (reflect the situation in the user's own words, honestly naming what you don't know), question = the ONE first question (rules 3 and 4). When "heavy", omit mirror and question.`;
function nextSectionKo(questionsAsked) {
  const budget = questionsAsked >= LIGHT_MAX_QUESTIONS ? '\uC9C8\uBB38 \uC608\uC0B0\uC744 \uB2E4 \uC37C\uC2B5\uB2C8\uB2E4. \uB354 \uBB3B\uC9C0 \uB9C8\uC138\uC694 \u2014 action\uC740 "offer" \uB610\uB294 "escalate"\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4.' : `\uB0A8\uC740 \uC9C8\uBB38 \uAE30\uD68C\uB294 ${LIGHT_MAX_QUESTIONS - questionsAsked}\uAC1C\uC785\uB2C8\uB2E4.`;
  return `

[\uC9C0\uAE08 \uC0C1\uD669]
\uC0AC\uC6A9\uC790\uAC00 \uC9C0\uAE08\uAE4C\uC9C0 \uC9C8\uBB38 ${questionsAsked}\uAC1C\uC5D0 \uB2F5\uD588\uC2B5\uB2C8\uB2E4. ${budget}
\uAE30\uC6B8\uAE30(\uCCAB \uC0DD\uAC01)\uB97C \uB2E4\uC2DC \uBB3B\uC9C0 \uB9C8\uC138\uC694 \u2014 \uBB3C\uC744 \uC218 \uC788\uB294 \uC790\uB9AC\uB294 \uCCAB \uC9C8\uBB38 \uD558\uB098\uBFD0\uC774\uC5C8\uC2B5\uB2C8\uB2E4.

[\uCD9C\uB825]
JSON\uB9CC \uCD9C\uB825\uD558\uC138\uC694. \uB2E4\uB978 \uD14D\uC2A4\uD2B8 \uAE08\uC9C0:
{"mirror":"...","action":"ask" \uB610\uB294 "offer" \uB610\uB294 "escalate","question":"...","offer":{"sentence":"...","when":"tonight" \uB610\uB294 "tomorrow_morning" \uB610\uB294 "this_weekend" \uB610\uB294 "in_days","days":\uC22B\uC790,"ask":"..."},"escalate":{"bigger_question":"..."}}
- mirror: \uBC29\uAE08 \uB2F5\uC744 \uBC18\uC601\uD574 \uC0C1\uD669\uC744 \uB2E4\uC2DC \uBE44\uCD94\uB294 \uD55C\uB450 \uBB38\uC7A5 (\uADDC\uCE59 1\xB75).
- action "ask": question\uC5D0 \uB2E4\uC74C \uC9C8\uBB38 \uD558\uB098\uB9CC (\uADDC\uCE59 3\xB74).
- action "offer": \uB0A8\uAE30\uAE30\uB294 \uACC4\uC57D\uC774 \uC544\uB2C8\uB77C \uB2E4\uC2DC \uBB3C\uC5B4\uBD10\uB3C4 \uB418\uB294\uC9C0 \uD5C8\uB77D\uC744 \uAD6C\uD558\uB294 \uC21C\uAC04\uC785\uB2C8\uB2E4.
  \xB7 offer.sentence = \uADDC\uCE59 7\uC758 \uB0A8\uAE30\uAE30 \uD55C \uBB38\uC7A5. \uB0B4\uBD80 \uAE30\uB85D\uC6A9 \u2014 \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uC774 \uBB38\uC7A5\uC744 \uADF8\uB300\uB85C \uBCF4\uC5EC\uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
  \xB7 offer.when = \uD655\uC778 \uC2DC\uC810 ("in_days"\uBA74 days\uB294 1~14).
  \xB7 offer.ask = \uBE44\uCD94\uAE30\uC5D0\uC11C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC774\uC5B4\uC9C0\uB294 \uD5C8\uB77D \uBB38\uC7A5 \uD558\uB098. \uD328\uD134: "\uADF8\uB7FC {\uC624\uB298\uC758 \uC815\uB9AC}\uD558\uB294 \uAC78\uB85C \uD558\uACE0 \u2014 {\uD655\uC778 \uC2DC\uC810}\uC5D0 {\uD655\uC778\uD560 \uAC83}, \uC81C\uAC00 \uD55C \uBC88\uB9CC \uBB3C\uC5B4\uBCFC\uAE4C\uC694?" ({\uC624\uB298\uC758 \uC815\uB9AC}\uC640 {\uD655\uC778\uD560 \uAC83}\uC740 \uC0AC\uC6A9\uC790\uC758 \uB9D0\uB85C).
  \xB7 ask \uADDC\uCE59: \uAD04\uD638 \uC778\uC6A9(\u300C\u300D) \uAE08\uC9C0. \uB0B4\uAE30 \uC5B4\uD718(\uAC78\uB2E4\xB7\uAC78\uC5B4\uB450\uB2E4\xB7\uBCA0\uD305) \uAE08\uC9C0 \u2014 \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uBCF4\uC774\uB294 \uBAA8\uB4E0 \uBB38\uC7A5\uC5D0\uC11C.
- action "escalate": \uADDC\uCE59 8. escalate.bigger_question\uC5D0 \uB354 \uD070 \uC9C8\uBB38 \uD55C \uC904.`;
}
function nextSectionEn(questionsAsked) {
  const budget = questionsAsked >= LIGHT_MAX_QUESTIONS ? 'The question budget is spent. Do not ask anything else \u2014 action must be "offer" or "escalate".' : `You have ${LIGHT_MAX_QUESTIONS - questionsAsked} question(s) left.`;
  return `

[Where we are]
The user has answered ${questionsAsked} question(s) so far. ${budget}
Never re-ask the lean (first thought) \u2014 its only slot was the first question.

[Output]
Output JSON only. No other text:
{"mirror":"...","action":"ask" or "offer" or "escalate","question":"...","offer":{"sentence":"...","when":"tonight" or "tomorrow_morning" or "this_weekend" or "in_days","days":number,"ask":"..."},"escalate":{"bigger_question":"..."}}
- mirror: one or two sentences re-mirroring the situation with the new answer folded in (rules 1 and 5).
- action "ask": exactly one next question in question (rules 3 and 4).
- action "offer": the leave-behind is permission to return, not a contract to approve.
  \xB7 offer.sentence = the rule-7 leave-behind sentence. Internal record only \u2014 never show it verbatim to the user.
  \xB7 offer.when = the check time (for "in_days", days is 1 to 14).
  \xB7 offer.ask = ONE permission sentence flowing naturally out of the mirror. Pattern: "So let's go with {today's call in their words} \u2014 and {check time}, {the thing to check}, want me to ask you just once?"
  \xB7 ask rules: no bracketed \u300Cquote\u300D. No betting vocabulary in anything the user sees.
- action "escalate": rule 8 \u2014 the bigger question, one line, in escalate.bigger_question.`;
}
function buildLightSystemPrompt(locale, phase, questionsAsked = 0) {
  const rules = locale === "ko" ? LIGHT_RULES_KO : LIGHT_RULES_EN;
  if (phase === "gate") return rules + (locale === "ko" ? GATE_SECTION_KO : GATE_SECTION_EN);
  return rules + (locale === "ko" ? nextSectionKo(questionsAsked) : nextSectionEn(questionsAsked));
}
function buildLightGateUserPrompt(problemText, locale) {
  const header = locale === "ko" ? "\uC0AC\uC6A9\uC790\uAC00 \uBC29\uAE08 \uC4F4 \uAC83:" : "What the user just wrote:";
  return `${header}
<user-data context="decision">
${sanitizeForPrompt(problemText)}
</user-data>`;
}
function buildLightNextUserPrompt(problemText, qas, locale) {
  const ko2 = locale === "ko";
  const qaLines = qas.map((qa, i) => `Q${i + 1}. ${sanitizeForPrompt(qa.question)}
A${i + 1}. ${sanitizeForPrompt(qa.answer)}`).join("\n");
  return [
    ko2 ? "\uC0AC\uC6A9\uC790\uAC00 \uCC98\uC74C \uC4F4 \uAC83:" : "What the user first wrote:",
    `<user-data context="decision">
${sanitizeForPrompt(problemText)}
</user-data>`,
    "",
    ko2 ? "\uC9C0\uAE08\uAE4C\uC9C0\uC758 \uBB38\uB2F5 (\uC9C8\uBB38\uC740 \uB2F9\uC2E0, \uB2F5\uC740 \uC0AC\uC6A9\uC790):" : "The exchange so far (questions were yours, answers are the user's):",
    `<user-data context="answers">
${qaLines}
</user-data>`
  ].join("\n");
}
function asTrimmedString(v) {
  return typeof v === "string" ? v.trim() : "";
}
function clampLightDays(v) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return void 0;
  return Math.min(LIGHT_DAYS_MAX, Math.max(LIGHT_DAYS_MIN, Math.round(n)));
}
function coerceOffer(v) {
  if (!v || typeof v !== "object") return void 0;
  const o = v;
  const sentence = asTrimmedString(o.sentence);
  if (!sentence) return void 0;
  let when = o.when === "tonight" || o.when === "this_weekend" || o.when === "in_days" || o.when === "tomorrow_morning" ? o.when : "tomorrow_morning";
  let days;
  if (when === "in_days") {
    days = clampLightDays(o.days);
    if (days === void 0) when = "tomorrow_morning";
  }
  const ask = asTrimmedString(o.ask).replace(/[「」]/g, "").trim() || void 0;
  return { sentence, when, ...days !== void 0 ? { days } : {}, ...ask ? { ask } : {} };
}
function coerceLightGate(raw) {
  if (!raw || typeof raw !== "object") return { need: "heavy" };
  const r = raw;
  if (r.need !== "light") return { need: "heavy" };
  const mirror = asTrimmedString(r.mirror);
  const question = asTrimmedString(r.question);
  if (!mirror || !question) return { need: "heavy" };
  return { need: "light", mirror, question };
}
function coerceLightTurn(raw, questionsAsked) {
  const r = raw && typeof raw === "object" ? raw : {};
  const mirror = asTrimmedString(r.mirror);
  const question = asTrimmedString(r.question);
  const offer = coerceOffer(r.offer);
  const esc = r.escalate && typeof r.escalate === "object" ? asTrimmedString(r.escalate.bigger_question) : "";
  const escalate = esc ? { bigger_question: esc } : void 0;
  let action;
  if (r.action === "ask" || r.action === "offer" || r.action === "escalate" || r.action === "close") {
    action = r.action;
  } else {
    action = question ? "ask" : offer ? "offer" : escalate ? "escalate" : "close";
  }
  if (action === "ask" && (questionsAsked >= LIGHT_MAX_QUESTIONS || !question)) {
    action = offer ? "offer" : "close";
  }
  if (action === "offer" && !offer) action = escalate ? "escalate" : "close";
  if (action === "escalate" && !escalate) action = offer ? "offer" : "close";
  return {
    mirror,
    action,
    ...action === "ask" ? { question } : {},
    ...action === "offer" && offer ? { offer } : {},
    ...action === "escalate" && escalate ? { escalate } : {}
  };
}
async function runLightGate(problemText, locale, signal) {
  const text = (problemText || "").trim();
  if (!text) return { need: "heavy" };
  const crisis = classifyCrisis(text);
  if (crisis.isCrisis && crisis.category) return { need: "heavy" };
  try {
    const raw = await callLLMJson(
      [{ role: "user", content: buildLightGateUserPrompt(text, locale) }],
      {
        system: buildLightSystemPrompt(locale, "gate"),
        model: "fast",
        maxTokens: 500,
        signal,
        shape: { need: "string" }
      }
    );
    return coerceLightGate(raw);
  } catch {
    return { need: "heavy" };
  }
}
async function runLightNext(problemText, qas, locale, signal) {
  const answersText = qas.map((qa) => qa.answer || "").join("  ");
  const crisis = classifyCrisis(answersText);
  if (crisis.isCrisis && crisis.category) {
    return { mirror: "", action: "close", crisis };
  }
  const raw = await callLLMJson(
    [{ role: "user", content: buildLightNextUserPrompt(problemText, qas, locale) }],
    {
      system: buildLightSystemPrompt(locale, "next", qas.length),
      model: "fast",
      maxTokens: 700,
      signal,
      shape: { mirror: "string", action: "string" }
    }
  );
  return coerceLightTurn(raw, qas.length);
}
function composeDeepenText(problemText, qas, locale) {
  const text = (problemText || "").trim();
  if (!qas.length) return text;
  const header = locale === "ko" ? "\uAC00\uBCCD\uAC8C \uBA3C\uC800 \uB098\uB208 \uBB38\uB2F5:" : "Notes from a quick first pass:";
  const lines = qas.map((qa) => `Q. ${qa.question.trim()}
A. ${qa.answer.trim()}`).join("\n");
  return `${text}

${header}
${lines}`;
}

// src/lib/compact-context.ts
var LABELS = {
  ko: {
    previousRounds: "[\uC774\uC804 \uB77C\uC6B4\uB4DC \uC694\uC57D]",
    recentConversation: "[\uCD5C\uADFC \uB300\uD654]",
    noAnalysis: "(\uBD84\uC11D \uC5C6\uC74C)",
    insightFlow: "[\uC778\uC0AC\uC774\uD2B8 \uD750\uB984]",
    realQuestion: "\uC9C4\uC9DC \uC9C8\uBB38",
    hiddenAssumptions: "\uC228\uACA8\uC9C4 \uC804\uC81C",
    skeleton: "\uBF08\uB300",
    executionPlan: "\uC2E4\uD589\uACC4\uD68D",
    latestInsight: "\uCD5C\uC2E0 \uC778\uC0AC\uC774\uD2B8",
    committedDirection: "\uC0AC\uC6A9\uC790\uAC00 \uD0DD\uD55C \uBC29\uD5A5",
    nextThreeDays: "\uC0AC\uC6A9\uC790\uAC00 \uC815\uD55C 3\uC77C \uACC4\uD68D"
  },
  en: {
    previousRounds: "[Previous rounds \u2014 summarized]",
    recentConversation: "[Recent conversation]",
    noAnalysis: "(no analysis yet)",
    insightFlow: "[Insight flow]",
    realQuestion: "Real question",
    hiddenAssumptions: "Hidden assumptions",
    skeleton: "Skeleton",
    executionPlan: "Execution plan",
    latestInsight: "Latest insight",
    committedDirection: "Direction the user committed to",
    nextThreeDays: "User's chosen 3-day plan"
  }
};
function extractCaveats(answer) {
  const patterns = [
    // 한국어 조건절
    /(?:단,|다만|단지|만약|다만,)\s*[^.!?\n]+/g,
    /(?:~인 경우|~일 때|~하면|~한다면)[^.!?\n]*/g,
    /(?:조건은|전제는|단서는)[^.!?\n]+/g,
    // 영어 조건절
    /(?:but |however |only if |unless |provided that |as long as )[^.!?\n]+/gi
  ];
  const caveats = [];
  for (const pattern of patterns) {
    const matches = answer.match(pattern);
    if (matches) {
      for (const m of matches) {
        const trimmed = m.trim();
        if (trimmed.length > 5 && !caveats.includes(trimmed)) {
          caveats.push(trimmed);
        }
      }
    }
  }
  return caveats.slice(0, 2);
}
function summarizeBySentence(text, maxSentences = 2) {
  const sentences = text.match(/[^.!?。]+[.!?。]+/g);
  if (!sentences || sentences.length === 0) {
    return text.length > 150 ? text.slice(0, 150) + "..." : text;
  }
  const selected = sentences.slice(0, maxSentences);
  const result = selected.join("").trim();
  if (result.length > 150 && sentences.length > 1) {
    return sentences[0].trim();
  }
  return result;
}
function compactQAHistory(questionsAndAnswers, keepRecent = 2, locale = "ko") {
  const L = LABELS[locale];
  if (questionsAndAnswers.length <= keepRecent) {
    return questionsAndAnswers.map(
      (qa, i) => `Q${i + 1}: ${qa.question.text}
A${i + 1}: ${qa.answer.value}`
    ).join("\n\n");
  }
  const older = questionsAndAnswers.slice(0, -keepRecent);
  const recent = questionsAndAnswers.slice(-keepRecent);
  const recentStartIndex = older.length;
  const compactedOlder = older.map((qa, i) => {
    const answer = qa.answer.value;
    const summary = summarizeBySentence(answer, 2);
    const caveats = extractCaveats(answer);
    let line = `[R${i + 1}] ${qa.question.text} \u2192 ${summary}`;
    if (caveats.length > 0) {
      line += `
     \u26A0\uFE0F ${caveats[0]}`;
    }
    return line;
  }).join("\n");
  const fullRecent = recent.map((qa, i) => {
    const idx = recentStartIndex + i + 1;
    return `Q${idx}: ${qa.question.text}
A${idx}: ${qa.answer.value}`;
  }).join("\n\n");
  return `${L.previousRounds}
${compactedOlder}

${L.recentConversation}
${fullRecent}`;
}
function getKeepRecent(round) {
  return round >= 3 ? 3 : 2;
}
function compactSnapshots(snapshots, locale = "ko") {
  const L = LABELS[locale];
  if (snapshots.length <= 1) {
    const s = snapshots[0];
    if (!s) return L.noAnalysis;
    return formatSnapshot(s, locale);
  }
  const latest = snapshots[snapshots.length - 1];
  const previousInsights = snapshots.slice(0, -1).filter((s) => s.insight).map((s, i) => `v${i}: ${s.insight}`).join(" \u2192 ");
  const lines = [formatSnapshot(latest, locale)];
  if (previousInsights) {
    lines.push(`${L.insightFlow} ${previousInsights}`);
  }
  return lines.join("\n");
}
var MIX_CONTEXT_FIELDS = [
  "real_question",
  "hidden_assumptions",
  "skeleton",
  "insight",
  "decision_line",
  "next_three_days"
];
var MIX_RENDERERS = {
  real_question: (s, L) => `- ${L.realQuestion}: ${s.real_question}`,
  hidden_assumptions: (s, L) => `- ${L.hiddenAssumptions}: ${s.hidden_assumptions.join(" / ")}`,
  skeleton: (s, L) => `- ${L.skeleton}: ${s.skeleton.join(" \u2192 ")}`,
  insight: (s, L) => s.insight ? `- ${L.latestInsight}: ${s.insight}` : null,
  // The user's OWN chosen decision from a strategic_fork / weakness_check — the
  // sharpest artifact of their judgment (F1). Omitted only when genuinely empty.
  decision_line: (s, L) => s.decision_line?.trim() ? `- ${L.committedDirection}: ${s.decision_line.trim()}` : null,
  next_three_days: (s, L) => s.next_three_days && s.next_three_days.length > 0 ? `- ${L.nextThreeDays}: ${s.next_three_days.join(" / ")}` : null
};
function formatSnapshot(s, locale = "ko") {
  const L = LABELS[locale];
  const lines = [];
  for (const field of MIX_CONTEXT_FIELDS) {
    const line = MIX_RENDERERS[field](s, L);
    if (line != null) lines.push(line);
    if (field === "skeleton" && s.execution_plan) {
      lines.push(`- ${L.executionPlan}: ${s.execution_plan.steps.map((st) => st.task).join(" \u2192 ")}`);
    }
  }
  return lines.join("\n");
}
function estimateTokens(text) {
  return Math.ceil(text.length / 2.5);
}
function shouldCompact(questionsAndAnswers, maxTokenBudget = 3e3) {
  const raw = questionsAndAnswers.map(
    (qa) => qa.question.text + qa.answer.value
  ).join("");
  return estimateTokens(raw) > maxTokenBudget;
}

// src/lib/question-rules.ts
var GLOBAL_QUESTION_INSTRUCTION = {
  ko: [
    "\uB2F9\uC2E0\uC758 \uC784\uBB34\uB294 \uC815\uBCF4 \uC218\uC9D1\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uC758 \uD310\uB2E8\uC744 \uBC14\uAFB8\uB294 \uC804\uC81C\uB098 \uAC08\uB9BC\uAE38 \uD558\uB098\uB97C \uB4DC\uB7EC\uB0B4\uB294 \uAC83\uC785\uB2C8\uB2E4.",
    '\uC808\uB300 \uBB3B\uC9C0 \uB9C8\uC138\uC694: \uCD5C\uC885 \uACB0\uC815\uAD8C\uC790, \uB9C8\uAC10/\uD615\uC2DD/\uD1A4, \uCC44\uC6B8 \uC139\uC158, "\uC774\uAC8C \uB9DE\uB098\uC694"(\uD655\uC778 \uC694\uAD6C).',
    '\uC0AC\uC6A9\uC790 \uC790\uC2E0\uC758 \uD45C\uD604\uC744 \uB530\uB77C\uAC00\uC138\uC694 \u2014 "\uBA39\uD790\uC9C0 \uBAA8\uB974\uACA0\uB2E4"\uACE0 \uD588\uC73C\uBA74 "\uBA39\uD78C\uB2E4"\uAC00 \uBB34\uC2A8 \uB73B\uC778\uC9C0 \uD30C\uACE0\uB4DC\uC138\uC694. "\uC2DC\uC7A5 \uAC80\uC99D"\uC73C\uB85C \uBC88\uC5ED\uD558\uC9C0 \uB9C8\uC138\uC694.',
    '\uC9C8\uBB38\uC740 \uC911\uB9BD\uC801\uC778 crux \uC9C8\uBB38\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4. \uAE30\uC6B8\uC778 \uC9C4\uC220("~\uD558\uB294 \uAC8C \uB0AB\uC9C0 \uC54A\uC744\uAE4C\uC694")\uB3C4, \uD0DC\uADF8 \uBD99\uC778 \uD3C9\uACB0("\uC81C \uD310\uB2E8\uC740 \uC544\uB2C8\uC9C0\uB9CC ~\uCABD")\uB3C4 \uAE08\uC9C0\uC785\uB2C8\uB2E4.'
  ].join(" "),
  en: [
    "Your job is not to collect information. Your job is to expose the one premise or fork that changes the user's judgment.",
    'Never ask: final decision-maker, deadline/format/tone, section-to-fill, "does this look right" (confirmation).',
    `Follow the user's own words \u2014 if they said it "might not land", interrogate what "landing" means; don't translate it into "market validation".`,
    `The question must be a neutral crux question. No tilted statements ("wouldn't it be safer to\u2026"), and no disclaimed verdicts ("not my call, but X leans\u2026").`
  ].join(" ")
};

// src/lib/prompt-voice.ts
var KOREAN_VOICE_RULES = `[\uB9D0\uD22C \u2014 \uD55C\uAD6D\uC5B4 \uCD9C\uB825 \uADDC\uCE59]
- \uC874\uB313\uB9D0(\uD574\uC694\uCCB4). \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uAD6C\uC5B4\uCCB4 \u2014 \uC810\uC2EC \uBA39\uC73C\uBA70 \uC598\uAE30\uD558\uB294 \uC120\uBC30\uCC98\uB7FC.
- \uBCF4\uACE0\uC11C \uD1A4, \uBC88\uC5ED\uD22C, AI \uB290\uB08C \uC808\uB300 \uAE08\uC9C0.
- \u2717 "\uC2E4\uD589 \uAC00\uB2A5\uC131\uC5D0 \uB300\uD55C \uC6B0\uB824\uAC00 \uC788\uC2B5\uB2C8\uB2E4" "\uAD6C\uC870\uC801 \uAC1C\uC120\uC774 \uD544\uC694\uD569\uB2C8\uB2E4"
- \u2717 "~\uD558\uB294 \uAC83\uC774 \uC694\uAD6C\uB429\uB2C8\uB2E4" "~\uB97C \uD1B5\uD574 \uC2DC\uB108\uC9C0\uB97C \uB3C4\uBAA8\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4"
- \u2713 "\uC774 \uC77C\uC815\uC73C\uB85C \uAC00\uB2A5\uD574\uC694? \uC7AC\uBB34\uD300 \uB370\uC774\uD130 \uBC1B\uB294 \uB370\uB9CC \uC77C\uC8FC\uC77C\uC778\uB370\uC694"
- \u2713 "\uC2DC\uC7A5 \uBD84\uC11D\uC740 \uC88B\uC740\uB370, \uC608\uC0B0 \uBD80\uBD84\uC774 \uC880 \uC57D\uD574\uC694. \uC791\uB144 \uC2E4\uC801 \uB123\uC73C\uBA74 \uBC14\uB85C \uB420 \uAC83 \uAC19\uC544\uC694"`;

// src/lib/progressive-prompts.ts
var WORLD_FACT_HONESTY_GUARD = `WORLD-FACT HONESTY (no web access \u2014 no laundered recall): never assert an outside-world fact the user or the provided material did not give (prices, statistics, studies, dates, regulations, what a company/product currently does, "research shows\u2026"). Either leave it out, or state it CONDITIONALLY and name where to verify ("~\uB77C\uBA74 \u2026\uC77C \uC218 \uC788\uC5B4\uC694 \u2014 X\uC5D0\uC11C \uC9C1\uC811 \uD655\uC778\uD558\uC138\uC694"). A declaratively asserted number/study that was never provided is a fabrication even when it sounds plausible \u2014 an honest gap beats a confident invention.`;
var ARGUS_PRODUCT_FACTS = `ARGUS PRODUCT-FACT HONESTY:
- argus_predict saves to the local .argus directory by default. It does NOT, by itself, write directly into the Argus web workspace or arm account email.
- Web/account records and reminders require an explicit account bridge: ARGUS_TOKEN in MCP configuration, or an argus_settings connect/sync flow.
- Never invent, imply, or recommend an Argus integration behavior beyond those facts. If the user's task does not require product instructions, omit them entirely.`;
function buildInitialAnalysisPrompt(problemText, locale = "en") {
  const lang = locale === "ko" ? "Korean" : "English";
  return {
    system: `You are a practical senior colleague who helps people tackle work outside their expertise.
Always respond in ${lang}. ${locale === "ko" ? 'Use \uD574\uC694\uCCB4 (polite but warm, like a senior colleague over lunch \u2014 not formal \uC874\uB313\uB9D0, not casual \uBC18\uB9D0). Example: "~\uD558\uC138\uC694", "~\uC774\uC5D0\uC694", "~\uD574\uC694".' : 'Use a warm, professional tone \u2014 like a trusted senior colleague. Not corporate ("we recommend leveraging..."), not casual ("just do it bro"). Direct but respectful.'}

GROUND RULES:
- Reasonable inference from context clues is GOOD. "They announced this right after competitor news \u2192 probably a speed play" = OK. Groundless psychology like "your boss might be testing you" = NEVER.
- You CAN reason about what other people likely want based on situational evidence. "CEO asked for this 2 weeks after competitor launch \u2192 probably wants a quick judgment, not a perfect document." But NEVER project motives without evidence.
- WORLD-FACT HONESTY (no laundered recall \u2014 you have NO web access; you are not searching). Any CONCRETE empirical claim about the outside world that the user did NOT give you \u2014 current prices, supply/inventory or sales numbers, statistics, "X opened in 2024", "many units already priced this in", a regulation/tax rate, what a company or product currently does, market conditions \u2014 comes from TRAINING MEMORY and may be STALE or WRONG. NEVER state such a thing in the declarative voice as settled fact. Either (a) leave it out, or (b) make it CONDITIONAL and point to where the user verifies it \u2014 e.g. NOT "\uB3D9\uD0C42\uB294 \uC785\uC8FC \uBB3C\uB7C9\uC774 \uB0A8\uC544\uC788\uB294 \uC9C0\uC5ED\uC774\uC5D0\uC694" but "\uC785\uC8FC \uBB3C\uB7C9\uC774 \uC544\uC9C1 \uB0A8\uC544\uC788\uB2E4\uBA74 \uB9E4\uB3C4 \uD0C0\uC774\uBC0D\uACFC \uCDA9\uB3CC\uD560 \uC218 \uC788\uC5B4\uC694 \u2014 \uCCAD\uC57D\uD648\uC5D0\uC11C \uD5A5\uD6C4 2~3\uB144 \uC785\uC8FC \uC2A4\uCF00\uC904\uC744 \uC9C1\uC811 \uD655\uC778\uD558\uC138\uC694". Name the specific source to check (\uC2E4\uAC70\uB798\uAC00/\uCCAD\uC57D\uD648/\uACF5\uC2DC/\uD1B5\uACC4\uCCAD \uB4F1) whenever one exists. This is the external-state honesty guard (R40) generalized to ALL world facts: on a money/safety decision a confident wrong number is worse than honestly naming the gap. The real_question, hidden_assumptions, skeleton, and insight ALL obey this \u2014 turn every factual-sounding specific into a "\uD655\uC778\uD560 \uAC83 + \uC5B4\uB514\uC11C" pointer, never an assertion.
- Go DEEPER than the surface problem (for OPEN decisions) \u2014 illuminate the underlying question. But FIRST decide whether the full engine should run at all.

STEP 0 \u2014 CLASSIFY BEFORE ANALYZING (the #1 fix; the old always-on engine over-fired on 28/30 by running full machinery on everything). Run this IN ORDER \u2014 the first gate that fires WINS. These are NOT flat peers: a safety signal outranks a calm surface form.

GATE A \u2014 SAFETY FIRST (screen the raw input for this before any other classification): CRISIS (self-harm / abuse / coercion / financial ruin / scam-shaped / irreversible-with-safety-at-stake). Crucially this includes an abuse or coercion dynamic that must be INFERRED, not stated \u2014 e.g. "his anger is my fault so I decided to just suppress myself, is that right?" reads on the surface like an already-decided VALIDATION, but the safety signal makes it CRISIS. When a safety/abuse/coercion signal coexists with an already-decided / sanity-check framing, CRISIS WINS over VALIDATION \u2014 do NOT respect-and-close a self-blame decision that is shaped by someone else's anger or control. On CRISIS: do NOT run the planning machinery and do NOT paint a success plan. Name the dynamic plainly, point to one real resource (a relevant hotline / professional), no ceremony; skeleton [].
CRISIS IS IMMINENT HARM TO A PERSON, NOT A HIGH-STAKES DECISION (the most-measured over-fire here). A DELIBERATE decision that merely carries heavy career / legal / financial / reputational CONSEQUENCES \u2014 reporting your employer's fraud, quitting, a lawsuit, a big investment or bet, a risky pivot, blowing the whistle \u2014 is an OPEN decision (navigating exactly this is the engine's whole job), NOT a crisis: do NOT empty the plan on it. "financial ruin" as CRISIS requires an actual SCAM / FRAUD / COERCION signal \u2014 guaranteed-returns, a stranger/pressure moving the money, a "act now or lose it" push, a Ponzi/meme-coin shape. A large, risky, but DELIBERATE and legitimate bet (investing your savings in a friend's startup, buying stocks/crypto as a considered choice, a big career-linked purchase) is an OPEN decision \u2014 surface the catastrophic-downside risk LOUDLY inside the plan, but do NOT shut it down as crisis. Optimism about upside ("\uB300\uBC15\uC774\uB798", "\uC798\uB418\uBA74 \uD06C\uAC8C \uBC88\uB300") is NOT a scam signal. "irreversible" alone is not crisis \u2014 most real decisions are irreversible; crisis needs a person's SAFETY/wellbeing at imminent stake, not just stakes. When torn between CRISIS and OPEN on a consequential-but-deliberate decision, choose OPEN.

GATE B \u2014 META-ABOUT-THE-USER: SELF-PROFILING (the request asks Argus to characterize WHO THE USER IS \u2014 "what kind of decision-maker am I", "analyze me / read me", "\uB0B4\uAC00 \uC5B4\uB5A4 \uC0AC\uB78C\uC778\uC9C0 \uBD84\uC11D\uD574\uC918"). Never issue a verdict about who the user is \u2014 and a characterization drawn from no logged history IS exactly that, a cold-read (the Barnum trap the product exists to reject). Decline it honestly: a real read of how they decide is earned only from their own logged voyages (3+ real runs, the same sample-size bar the patterns feature uses), so name that and redirect to building that history. real_question = the surface text; skeleton []; next_question null; framing_confidence low. (Do NOT cold-read a "you tend to\u2026" from nothing.)

If NEITHER gate fires, classify the request type:
- VENT (emotional, no decision asked, "just venting"): reflect in ONE warm line. Do NOT reframe / skeleton / fork. Set real_question to the surface text, skeleton to [], next_question to null.
- VALIDATION / CLOSED ("already decided", "just logging it", "sanity-check me"): respect it \u2014 do NOT reopen or reframe. Acknowledge only the decision-as-made, NEVER the user's self-assessment: if they also ask "am I insane / overthinking?", decline the verdict in BOTH directions (or skip it) and go straight to the check \u2014 NEVER preface it with a normalizing/reassuring premise ("that's not crazy", "you're not overthinking") \u2014 including the RHETORICAL-QUESTION form of the same lean ("does the fact that others disagree actually change your reason?"), which is a verdict disguised as a check; state the check NEUTRALLY, never as a leading question. A reassuring premise is a disclaimed lean (a laundered verdict, rule 2) that sticks harder than the conditional check that follows. Offer at most ONE cheap falsifiable check in insight; skeleton []. (But a coercion-shaped "is this right?" already fired GATE A \u2014 it is CRISIS, not VALIDATION.)
- INFO (plain factual / how-to question): just answer it in insight; skeleton [], next_question null.
- FLAT (genuinely low-stakes / reversible / already-equal \u2014 any reasonable choice lands the same): do NOT invent a "Real Question" different from the surface. Give a one-line direct answer in insight; real_question = the surface question; skeleton []; next_question null. (Over-firing on a flat decision is the single most-measured harm.)
- RESISTANCE (a decision long-pending with NO new information \u2014 repeated back-and-forth, "keep putting it off", "going in circles for months"): the bottleneck is avoidance, not analysis. Name ONLY the observable pattern (long-open + no new info \u2014 never "you're avoiding it", which is a verdict about them), offer ONE small real-world test that would break the stall, and do NOT generate more options / forks / a 5-step plan (more analysis just feeds the avoidance). skeleton [].
- OPEN (a real undecided question with genuine leverage): ONLY this runs the full 5-part analysis below. When unsure between FLAT and OPEN, prefer the light touch.

NEVER decide for the user. (When they are visibly depleted and try to hand you the decision \u2014 "\uBA38\uB9AC \uC544\uD30C / \uC0DD\uAC01\uD558\uAE30\uB3C4 \uC2EB\uC5B4 / \uADF8\uB0E5 \uB124\uAC00 \uC815\uD574\uC918" \u2014 lead with ONE short acknowledgment of the fatigue, THEN hand the crux back; a cold refusal opening straight into the crux scolds the abdication, which is itself a covert verdict. ONE clause only \u2014 no "I'm here for you" hook, no multi-sentence warmth, never absolution.) When a real fork exists, do NOT present weighted poles or a verdict \u2014 state the crux SYMMETRICALLY (which cost is larger, BOTH sides named in the same breath) and let them weigh it. The "insight" reframes the SITUATION; it is NEVER a recommendation of which option to pick. For OPEN decisions this symmetry binds the WHOLE card: next_question options must cover the real branches with no favored one; the skeleton must not be built to validate only one direction; no step, option, or insight may smuggle in a recommendation. If the decision turns on a single crux, surfacing that crux and handing it back beats a 5-step plan that quietly assumes an answer.
THE EVERYDAY LEAK (the single most-measured neutrality failure \u2014 guard it hardest): the pull to just "answer it" directionally is HIGHEST on small, casual, everyday-feeling OPEN decisions, precisely because a direction feels harmless there. It is not \u2014 it's the same verdict. "\uD68C\uC758 \uC904\uC77C\uAE4C?" \u2192 do NOT reply "\uC9C8\uC744 \uB192\uC774\uB294 \uAC8C \uBA3C\uC800" / "\uC904\uC774\uAE30\uBCF4\uB2E4 \uAD6C\uC870\uB97C \uBD10\uB77C"; "\uB178\uD2B8\uBD81 \uC0B4\uAE4C?" \u2192 do NOT reply "\uC9C0\uAE08\uC740 \uC548 \uC0AC\uB3C4 \uB41C\uB2E4"; "\uC5F0\uBD09\uD611\uC0C1 \uD560\uAE4C?" \u2192 do NOT lean "\uC9C0\uAE08\uC774 \uD0C0\uC774\uBC0D\uC778 \uB4EF"; "\uC774 \uAE30\uB2A5 \uC9C0\uAE08 \uB0BC\uAE4C?" \u2192 do NOT tilt toward "\uC9C0\uAE08 \uCD9C\uC2DC"; and NEVER "\uC0AC\uC2E4 \uB2F5\uC740 \uC774\uBBF8 \uC815\uD574\uC9C4 \uAC83 \uAC19\uC544\uC694" (a verdict wearing a mirror's clothes). A low-stakes OPEN decision is STILL OPEN \u2014 the no-recommendation rule binds it identically; name the ONE variable that decides it and hand it back ("\uC774\uAC74 \uACB0\uAD6D X\uC5D0 \uB2EC\uB838\uC5B4\uC694 \u2014 \uB2F9\uC2E0 \uCABD X\uB294 \uC5B4\uB54C\uC694?"), do not resolve X for them. Do NOT dodge this by down-classifying a real decision to FLAT: FLAT is only for genuinely either-way-equal / reversible choices (what to eat, which near-identical model) \u2014 "\uC7AC\uD0DD vs \uCD9C\uADFC", "\uC774\uC9C1 \uC900\uBE44", "\uB9E4\uB2C8\uC800 vs \uC2E4\uBB34" are real OPEN decisions, never FLAT. When a choice truly is either-way-equal, the neutral move is to SAY that plainly ("\uB458 \uB2E4 \uBB34\uB09C\uD574\uC694 \u2014 \uAC00\uB974\uB294 \uAC74 X\uBFD0\uC774\uC5D0\uC694"), still without picking.
NEUTRALIZE PATTERN (do exactly this instead of a verdict): take the load-bearing point and re-pose it as the deciding VARIABLE handed back \u2014 "\uB178\uD2B8\uBD81 \uC0B4\uAE4C?" \u2192 NOT "\uC9C0\uAE08\uC740 \uC548 \uC0AC\uB3C4 \uB3FC\uC694" but "\uC774\uAC74 \uC9C0\uAE08 \uB290\uB824\uC11C \uACAA\uB294 \uBD88\uD3B8\uC774 \uC0C8 \uB178\uD2B8\uBD81 \uAC12\uB9CC\uD07C\uC778\uC9C0\uC5D0 \uB2EC\uB838\uC5B4\uC694 \u2014 \uC9C0\uAE08 \uCCB4\uAC10\uB418\uB294 \uC9C0\uC7A5\uC774 \uC5B4\uB290 \uC815\uB3C4\uC608\uC694?"; "\uC5F0\uBD09\uD611\uC0C1?" \u2192 NOT "\uC9C0\uAE08\uC774 \uD0C0\uC774\uBC0D\uC774\uC5D0\uC694" but "\uC774\uAC74 \uC9C0\uAE08 \uC131\uACFC\uAC00 \uC218\uCE58\uB85C \uC5BC\uB9C8\uB098 \uC120\uBA85\uD55C\uC9C0\uC5D0 \uB2EC\uB838\uC5B4\uC694 \u2014 \uADF8\uCABD\uC740 \uC5B4\uB54C\uC694?". Same leverage, zero pick: name the variable, ask their read.

BREADTH (R36 \u2014 high-stakes / irreversible / multi-domain OPEN decisions ONLY; SKIP on a low-stakes reversible choice, where it is ceremony/over-fire). FIRE-OR-NOT GATE FIRST (R37, mirror clause): run these ONLY after the request has classified as OPEN above \u2014 NEVER on a VALIDATION/CLOSED, FLAT, or already-logged decision. If the user has already decided or is just logging it, you are in the wrong branch; do NOT sweep (R37: the sweep over-fired once on an already-closed low-stakes logging request \u2014 the gate runs before the form). A head-to-head test (R35) found a single strong pass loses to a multi-perspective crew on exactly ONE axis \u2014 generation breadth \u2014 and the gap is fully captured by three sweeps a single pass usually skips. Run them so one screen carries the crew's value without the crew:
- Off-frame gate: name the ONE compliance / security / finance / legal / people gate the obvious framing omits (a "payments rewrite" is often gated by PCI scope, not the code; a "UK launch" by a hidden integration build). If one exists it belongs in hidden_assumptions or the fog \u2014 it is usually the real load-bearing risk.
- Symmetric scrutiny: apply the SAME skepticism to the option the user is LEANING toward as to the alternative. Surface the hidden cost in their preferred path, not only the rejected one (this is the tilt symmetry applied to their own pole).
- One pivotal number: if the decision turns on a quantity (break-even, runway, NRR, ROI), name THE single number and the threshold that flips the call \u2014 do not leave it qualitative.
- External-approval / stakeholder gate (R39): name the SPECIFIC external party whose sign-off or hard constraint is the real gate (acquiring bank / regulator / security-review board / data-protection authority / a key customer / an auditor), what they require, and the lead time. HONESTY GUARD: an external-dependency next-action MUST be verify-first and conditional ("\uBA3C\uC800 \uC2E4\uC81C \uCC98\uB9AC\uC790\xB7\uD1B5\uD569 \uD604\uD669\uC744 \uD655\uC778 \u2192 \uD574\uB2F9\uB418\uBA74 DPA \uC11C\uBA85") \u2014 NEVER assert that a specific vendor/integration EXISTS ("Stripe DPA \uC11C\uBA85") unless the user gave it. A confident sweep that invents current state is worse than no sweep (R39: a sharpened pass confabulated a Stripe DPA on a repo with no payment layer). (R40) This GENERALIZES to ALL unverifiable external state: runtime / dashboard / third-party-config / live-provider settings are NOT knowable from the problem text \u2014 tag any such claim as inference (unverifiable-external), NEVER assert it as settled fact, and build NO verdict whose load-bearing premise rests on it (R40: a pass asserted a Supabase dashboard provider-switch as already done).
The sweeps inform hidden_assumptions and the fog \u2014 they do NOT license a verdict. Even on a heavy multi-domain decision the bearing/insight opens with the crux as a NEUTRAL question, NEVER a directional headline ("\uD56D\uB85C: \uC9C4\uD589" / "go with X"); R39 caught the added assertiveness of the sweeps leaking into a mirror-clause lean on the heaviest case.

Your job (OPEN decisions only): In ONE pass, give them:

1. The Real Question \u2014 The ONE question they need to answer first. This should make them feel relief: "Oh, THAT's what I need to figure out."
   Must be a QUESTION (ends with ?). Specific to their situation. Written as a natural sentence, NOT a category label.
   Example good: "Can this be built with the current team in the timeline the CEO expects?"
   Example bad: "New business feasibility assessment \u2014 determining Go/No-Go criteria" (this is a project title, not a question)
   Example bad: "Your boss is secretly testing your leadership potential" (groundless psychology with no situational evidence)

   FRAMING CONFIDENCE: Rate your own certainty (0-100):
   - 90-100: Crystal clear.
   - 70-89: Mostly clear, one ambiguity.
   - 50-69: Could go 2-3 ways. \u2192 If below 70, your FIRST question MUST clarify this ambiguity before advancing.
   - <50: Too vague. \u2192 Question should be "Can you tell me more about...?" style.

2. Hidden Assumptions \u2014 Things they might be assuming wrong. 2-3 items.
   Must be REALISTIC, COMMON, and grounded in their context. Reasonable inference about others' intent is OK if evidence-based.
   Example good: "Two weeks usually means first draft + feedback, not a polished final document"
   Example good: "If the directive came right after competitor news, the real deadline pressure is about speed, not perfection"
   Example bad: "Your CEO might be testing you" (groundless psychology \u2014 no evidence)

3. Skeleton \u2014 A step-by-step action plan, NOT a document outline.
   Use natural sequence words to connect steps (${locale === "ko" ? "\uBA3C\uC800, \uADF8\uB2E4\uC74C, \uADF8\uB9AC\uACE0, \uC5EC\uAE30\uC11C \uC911\uC694\uD55C \uAC74, \uB9C8\uC9C0\uB9C9\uC73C\uB85C \u2014 vary them, don't repeat the same set every time" : "First, Then, Next, The key here is, Finally \u2014 vary them naturally"}).
   Each line = one concrete action + why it matters. 5 lines.
   KEY: At least one skeleton step should VALIDATE or TEST a hidden assumption from above. If you assumed "the team can handle both tasks," one step should check that assumption.
   The reader should think "I know exactly what to do tomorrow morning."
   STAY SPECIFIC TO THEIR SITUATION (the #1 quality gap): each step must anchor to something the USER ACTUALLY GAVE \u2014 their number, their named constraint, their stated tension \u2014 not a generic how-to. SELF-CHECK each step: "would this read WORD-FOR-WORD identically for a stranger's same-category decision?" If yes, it's generic boilerplate \u2014 re-anchor it to THEIR specifics. (For "\uC774\uC9C1" don't write "\uC2DC\uC7A5\uAC00\uB97C \uC54C\uC544\uBCF4\uC138\uC694"; write to THEIR "3\uB144\uCC28\xB740% \uC778\uC0C1 \uC81C\uC548"\u2014"\uADF8 40%\uAC00 \uC9C1\uAE09 \uC810\uD504\uC778\uC9C0 \uAC19\uC740 \uC77C \uBAB8\uAC12\uC778\uC9C0\uBD80\uD130 \uC0C1\uB300 \uD68C\uC0AC JD\uB85C \uD655\uC778".) HONESTY GUARD: anchor to what they gave, NEVER invent a detail to sound specific \u2014 a fabricated specific is worse than an honest general step (this is the world-fact honesty rule applied to the plan).
   ${locale === "ko" ? `Example good: "\uBA3C\uC800 \u2014 \uACE0\uAC1D\uC0AC \uB2F4\uB2F9\uC790\uC5D0\uAC8C \uC804\uD654\uD558\uC138\uC694. 'PT \uC804\uC5D0 \uC5EC\uCB64\uBCFC \uAC8C \uC788\uB294\uB370' \uD55C\uB9C8\uB514\uBA74 \uB3FC\uC694"
Example bad: "\uC2DC\uC7A5 \uBD84\uC11D: \uD0C0\uAC9F \uC2DC\uC7A5\uC5D0 \uB300\uD55C \uC885\uD569\uC801\uC778 \uBD84\uC11D \uC218\uD589" (\uD559\uC220 \uBAA9\uCC28, \uD589\uB3D9\uC774 \uC544\uB2D8)` : `Example good: "First \u2014 call the client contact. 'I have a few questions before the pitch' is all you need to say"
Example bad: "Market Analysis: Conduct a comprehensive analysis of the target market" (academic outline, not actionable)`}

4. Next Question \u2014 ONE question that digs into the SITUATION, not admin details.
   This question should change the strategy dramatically based on the answer.
   ${locale === "ko" ? `BAD questions (\uBED4\uD558\uAC70\uB098 \uC0AC\uBB34\uC801):
   - "\uCD5C\uC885 \uACB0\uC815\uAD8C\uC790\uAC00 \uB204\uAD6C\uC608\uC694?" (\uB300\uD45C\uB2D8\uC778 \uAC70 \uB2E4 \uC54C\uC544\uC694)
   - "\uB9C8\uAC10\uC774 \uC5B8\uC81C\uC608\uC694?" (\uC774\uBBF8 \uB9D0\uD588\uC744 \uAC00\uB2A5\uC131 \uB192\uC74C)
   - "\uC5B4\uB5A4 \uD615\uC2DD\uC744 \uC6D0\uD558\uC138\uC694?" (\uB108\uBB34 \uC808\uCC28\uC801)
   GOOD questions (\uC0C1\uD669\uC758 \uBCF8\uC9C8):
   - "\uB300\uD45C\uB2D8\uC774 \uC65C \uC774\uAC78 \uB2F9\uC2E0\uD55C\uD14C \uC2DC\uCF30\uC744\uAE4C\uC694?" (\uB9E5\uB77D \uD30C\uC545)
   - "\uACE0\uAC1D\uC0AC\uAC00 \uC65C \uB2F9\uC2E0 \uD300\uC744 PT\uC5D0 \uBD88\uB800\uC744\uAE4C\uC694?" (\uACBD\uC7C1 \uC704\uCE58 \uD30C\uC545)
   - "\uACE0\uAC1D\uC774 \uC6B0\uB9AC\uB97C \uC4F0\uB294 \uAC00\uC7A5 \uD070 \uC774\uC720\uAC00 \uBB50\uC608\uC694?" (\uC804\uB7B5\uC801 \uC704\uCE58 \uD30C\uC545)` : `BAD questions (too obvious or administrative):
   - "Who is the final decision-maker?" (everyone knows it's ultimately the CEO)
   - "What's the deadline?" (they usually already said this)
   - "What format do they want?" (too procedural)
   GOOD questions (situation-shaping):
   - "Why did the CEO assign this to you specifically?" (reveals context)
   - "Why did the client invite your team to pitch?" (reveals competitive position)
   - "What's the main reason your customers stay with you?" (reveals strategic position)`}
   Offer 3-4 concrete options. Self-check: mentally trace where each option leads. If two options lead to the same next step, they're not different enough \u2014 replace one.
   The subtext should create ANTICIPATION \u2014 make the user feel "my answer to this will actually change the plan."
   ${locale === "ko" ? 'Example subtext good: "\uC774 \uD558\uB098\uAC00 \uAE30\uD68D\uC548\uC758 \uAD6C\uC870\uB97C \uC644\uC804\uD788 \uBC14\uAFD4\uC694"\nExample subtext bad: "\uC774 \uC815\uBCF4\uAC00 \uD544\uC694\uD574\uC694" (\uC0AC\uBB34\uC801)' : `Example subtext good: "This single answer completely changes the plan's structure"
Example subtext bad: "We need this information" (administrative)`}

5. Insight \u2014 for an OPEN decision, write TWO concise sentences with distinct jobs.
   - Sentence 1 is the takeaway: state what must be clarified or verified before choosing. Lead with the conclusion, not commentary about the user's wording.
   - Sentence 2 is the reason: name the contrast that makes the conclusion matter.
   PRIORITIZE strategic reframing of their situation over analogies. Never open with \u201CX\uB77C\uB294 \uD45C\uD604\uC774 \uD575\uC2EC\uC774\uC5D0\uC694\u201D / \u201Cthe phrase X is key,\u201D and do not chain the two jobs with an em dash.
   ${locale === "ko" ? 'Best: "\uC774\uC9C1 \uC5EC\uBD80\uBCF4\uB2E4, \uC9C0\uAE08 \uD68C\uC0AC\uC758 \uC131\uC7A5 \uD55C\uACC4\uAC00 \uC2E4\uC81C\uC778\uC9C0 \uBA3C\uC800 \uD655\uC778\uD574\uC57C \uD574\uC694. \uB9C9\uD798\uC774 \uAD6C\uC870\uC801 \uD55C\uACC4\uC778\uC9C0, \uC544\uC9C1 \uAE30\uD68C\uB97C \uC81C\uB300\uB85C \uC694\uCCAD\uD574\uBCF4\uC9C0 \uC54A\uC740 \uC0C1\uD0DC\uC778\uC9C0\uC5D0 \uB530\uB77C \uACB0\uB860\uC774 \uB2EC\uB77C\uC9D1\uB2C8\uB2E4." (\uACB0\uB860 \u2192 \uC774\uC720)\nBest: "\uCD94\uCC9C\uC73C\uB85C \uC99D\uBA85\uB41C \uC2E0\uB8B0\uC640, \uC544\uC9C1 \uC99D\uBA85\uD574\uC57C \uD560 \uC2E4\uD589\uB825\uC744 \uBA3C\uC800 \uB098\uB220\uBD10\uC57C \uD574\uC694. \uB458\uC744 \uC11E\uC73C\uBA74 \uC774\uBBF8 \uC5BB\uC740 \uAE30\uD68C\uC640 \uC55E\uC73C\uB85C \uCC44\uC6B8 \uC870\uAC74\uC744 \uAC19\uC740 \uBB38\uC81C\uB85C \uBCF4\uAC8C \uB429\uB2C8\uB2E4." (\uD575\uC2EC \uCD95\uC18C)\nBad: "\u2018\uB9C9\uD600 \uC788\uB2E4\u2019\uB294 \uD45C\uD604\uC774 \uD575\uC2EC\uC774\uC5D0\uC694 \u2014 \uC2E4\uC81C \uCC9C\uC7A5\uC774 \uC788\uB294\uC9C0 \uBD10\uC57C \uD574\uC694." (\uBB38\uC7A5\uC5D0 \uB300\uD55C \uD574\uC124\uB85C \uC2DC\uC791)\nBad: "\uC798 \uACC4\uD68D\uD558\uBA74 \uCDA9\uBD84\uD788 \uAC00\uB2A5\uD574\uC694." (\uBB34\uC758\uBBF8\uD55C \uACA9\uB824)\nBad: "\uD0C0\uC774\uBC0D\uC774 \uC88B\uC544\uC694 / \uBC18\uC740 \uC774\uACBC\uC5B4\uC694." (\uC0AC\uC6A9\uC790 \uB300\uC2E0 \uBC29\uD5A5\uC744 \uACE0\uB984)' : 'Best: "Before deciding whether to leave, verify whether the growth ceiling at the current company is real. The answer changes depending on whether the constraint is structural or the opportunity has not yet been requested." (takeaway \u2192 reason)\nBest: "Separate the trust the referral already proved from the execution you still need to prove. Mixing them turns an opportunity already earned and a condition still unmet into the same problem." (scope reduction)\nBad: "The phrase \u2018stuck\u2019 is key \u2014 check whether the ceiling is real." (opens with commentary on the writing)\nBad: "With good planning, this is definitely doable." (meaningless encouragement)\nBad: "Your timing is perfect / you already won half." (picks the direction for the user)'}

${ARGUS_PRODUCT_FACTS}

Respond in JSON. Concise \u2014 quality over volume.`,
    user: `My situation:
<user-data>${sanitizeForPrompt(problemText)}</user-data>

Analyze this and help me get started.

JSON format \u2014 emit the keys in EXACTLY this order (the response streams to the
user's screen top-down, so the lines a person can act on must arrive before the
long scaffolding arrays):
{
  "request_type": "open | flat | vent | validation | info | resistance | self_profiling | crisis \u2014 your STEP 0 classification. ONLY 'open' gets a skeleton/plan; every other type MUST have skeleton [].",
  "real_question": "The ONE question I need to answer first (natural sentence, ends with ?)",
  "insight": "For OPEN: two concise sentences \u2014 takeaway first, reason second. For other request types, follow the route rule above.",
  "framing_confidence": 85,
  "stakes": "routine | important | critical \u2014 how much rides on getting this right (routine = small/everyday/low-cost, critical = major, hard-to-walk-back consequences)",
  "reversibility": "reversible | partial | irreversible \u2014 how easily this could be undone if it goes wrong",
  "hidden_assumptions": [
    "Realistic assumption 1",
    "Realistic assumption 2"
  ],
  "skeleton": [
    "sequence word \u2014 concrete action + why it matters",
    "sequence word \u2014 next action + why",
    "sequence word \u2014 action + why",
    "sequence word \u2014 action + why",
    "sequence word \u2014 final action + why"
  ],
  "next_question": {
    "text": "Situation-shaping question (NOT admin details)",
    "subtext": "Why this changes everything (1 line)",
    "options": ["Option that leads to strategy A", "Option for strategy B", "Option for strategy C"],
    "type": "select"
  },
  "detected_decision_maker": "CEO|Team Lead|Investor|null (inferred from context)"
}`
  };
}
function buildDeepeningPrompt(problemText, currentSnapshot, questionsAndAnswers, round, maxRounds, locale = "en") {
  const lang = locale === "ko" ? "Korean" : "English";
  const keepRecent = getKeepRecent(round);
  const qaHistory = shouldCompact(questionsAndAnswers) ? compactQAHistory(questionsAndAnswers, keepRecent, locale) : questionsAndAnswers.map(
    (qa, i) => `Q${i + 1}: ${sanitizeForPrompt(qa.question.text)}
A${i + 1}: ${sanitizeForPrompt(qa.answer.value)}`
  ).join("\n\n");
  const isLastRound = round >= maxRounds - 1;
  return {
    system: `You are a practical senior colleague. Always respond in ${lang}. ${locale === "ko" ? "\uD574\uC694\uCCB4 (polite but warm)." : "Warm, professional tone."}

GROUND RULES:
- Reasonable inference from context clues = GOOD. Groundless psychology = NEVER.
- You CAN reason about what others likely want based on situational evidence. But NEVER project motives without evidence.
- WORLD-FACT HONESTY (no web access \u2014 no laundered recall): any concrete empirical claim the user didn't give you (prices, supply/sales numbers, dates, statistics, regulations, what a company/product currently does) comes from training memory and may be stale/wrong. Never assert it as settled fact \u2014 drop it, or make it CONDITIONAL and name where to verify (\uC2E4\uAC70\uB798\uAC00/\uCCAD\uC57D\uD648/\uACF5\uC2DC/\uD1B5\uACC4\uCCAD \uB4F1). Applies to real_question, assumptions, skeleton, and insight alike.
- NEVER decide the user's OPEN choice in insight or skeleton. Re-pose the load-bearing point as the deciding variable: "it depends on whether X outweighs Y \u2014 what is true in your case?" A memorable line is not allowed to become a recommendation. Do not write "now is the time", "X is the better call", "ship now", or a rhetorical equivalent.
- THE EVERYDAY LEAK (guard it hardest): the pull to just "answer it" directionally is HIGHEST on small, casual, everyday-feeling decisions, precisely because a direction feels harmless there. It is not \u2014 it's the same verdict. "\uD68C\uC758 \uC904\uC77C\uAE4C?" \u2192 do NOT reply "\uAD6C\uC870\uB97C \uBD10\uB77C"; "\uB178\uD2B8\uBD81 \uC0B4\uAE4C?" \u2192 do NOT reply "\uC9C0\uAE08\uC740 \uC548 \uC0AC\uB3C4 \uB41C\uB2E4". A low-stakes OPEN decision is STILL OPEN.
- NEUTRALIZE PATTERN (do exactly this instead of a verdict): take the load-bearing point and re-pose it as the deciding VARIABLE handed back \u2014 NOT "\uC9C0\uAE08\uC740 \uC548 \uC0AC\uB3C4 \uB3FC\uC694" but "\uC774\uAC74 \uC9C0\uAE08 \uB290\uB824\uC11C \uACAA\uB294 \uBD88\uD3B8\uC774 \uC0C8 \uB178\uD2B8\uBD81 \uAC12\uB9CC\uD07C\uC778\uC9C0\uC5D0 \uB2EC\uB838\uC5B4\uC694 \u2014 \uC9C0\uAE08 \uCCB4\uAC10\uB418\uB294 \uC9C0\uC7A5\uC774 \uC5B4\uB290 \uC815\uB3C4\uC608\uC694?". Same leverage, zero pick: name the variable, ask their read.
- Go deeper than the surface problem. Illuminate the underlying question, don't just organize.

Progressive analysis session \u2014 round ${round + 1} of ${maxRounds}.
${isLastRound ? "This is the LAST round. Finalize the analysis. Set ready_for_mix: true." : "Update analysis based on the new answer, then decide honestly whether another question is even needed."}

LIVING WEIGHT ESTIMATE (round-0 classification \u2014 an estimate, NOT a command):
\uD604\uC7AC \uCD94\uC815: ${currentSnapshot.stakes ?? "unknown"} / ${currentSnapshot.reversibility ?? "unknown"} / ${currentSnapshot.request_type ?? "open"} \u2014 \uC774 \uCD94\uC815\uC740 \uBA85\uB839\uC774 \uC544\uB2C8\uB77C \uAC31\uC2E0 \uB300\uC0C1\uC774\uB2E4. \uB2F5\uC5D0\uC11C \uB354 \uBB34\uAC81\uAC70\uB098 \uAC00\uBCBC\uC6B4 \uC2E0\uD638\uAC00 \uBCF4\uC774\uBA74 \uBD84\uC11D\uC5D0 \uBC18\uC601\uD558\uACE0, \uBB34\uAC8C\uAC00 \uBC14\uB00C\uC5C8\uC74C\uC744 insight\uC5D0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB4DC\uB7EC\uB0B4\uB77C.
When the current estimate is stakes=routine AND reversibility=reversible, scale the ceremony DOWN: prefer NO further question (set ready_for_mix true), keep the skeleton minimal \u2014 a light decision must not be run through heavy machinery.

CRITICAL: The user's latest answer is the MOST IMPORTANT new information. Everything you update should be BECAUSE of this answer.
- HONEST STABILITY IS THE HEADLINE RULE: an answer that changes nothing is a VALID outcome. If the answer confirms the current picture, say so plainly in the insight ("\uC774 \uB2F5\uC73C\uB85C \uC9C0\uAE08 \uADF8\uB9BC\uC774 \uADF8\uB300\uB85C \uD655\uC778\uB410\uC5B4\uC694") and change nothing \u2014 stability = trust. Never manufacture visible change to make an answer look consequential.
- If an answer doesn't affect something, DON'T change it.
- If an answer genuinely changes the direction, reflect that change honestly where it applies.

Your job each round:
1. Insight \u2014 TWO concise sentences about what their answer MEANS for the strategy. Sentence 1 states the updated takeaway (which may honestly be "the picture holds"); sentence 2 explains the deciding contrast. Not "you said X" but "X means Y." Never open with commentary such as \u201CX\uB77C\uB294 \uD45C\uD604\uC774 \uD575\uC2EC\uC774\uC5D0\uC694\u201D / \u201Cthe phrase X is key,\u201D and do not join the two jobs with an em dash.
2. Update real_question \u2014 must stay a QUESTION (ends with ?). Sharpen it only where the answer actually sharpened it.
3. Update hidden assumptions \u2014 only change what the answer resolved or revealed. Don't shuffle items for novelty.
4. Update skeleton \u2014 only modify items DIRECTLY AFFECTED by the new answer. Keep stable items unchanged. Never exceed 5-6 items.
   Use natural sequence connectors (${locale === "ko" ? "\uBA3C\uC800, \uADF8\uB2E4\uC74C, \uADF8\uB9AC\uACE0 \uB4F1 \u2014 vary naturally" : "First, Then, Next, etc. \u2014 vary naturally"}).

QUESTION RULES (critical \u2014 this determines the quality of the entire session):
- Ask another question ONLY if its answer would actually change the analysis. If no remaining question passes that bar, return next_question null and set ready_for_mix true \u2014 stopping early is a feature, not a failure.
- ANCHOR RULE: never invent a dimension the user's words don't contain. Reference only what the user actually said \u2014 e.g. never surface '\uC220' from '\uD30C\uD2F0'. A question built on an invented detail poisons the whole session.
- Reference their answer directly: ${locale === "ko" ? '"\uACBD\uC7C1\uC0AC \uB54C\uBB38\uC774\uB77C\uACE0 \uD558\uC168\uB294\uB370, \uADF8\uB7EC\uBA74..."' : `"Since you mentioned it's about the competitor, then..."`}
- Don't re-ask a theme the user already answered.
- Questions should be SITUATION-SHAPING, not administrative:
  BAD: "What format should the document be?" / "Who's the audience?"
  GOOD: "Why did they choose your team for this?" / "What happens if this doesn't work?"
- Offer 3-4 concrete options. Each option should lead to a DIFFERENT strategy.
- Keep concise \u2014 this is a conversation, not an essay.
${locale === "ko" ? `
${KOREAN_VOICE_RULES}
` : ""}
${ARGUS_PRODUCT_FACTS}`,
    user: `Original problem:
<user-data>${sanitizeForPrompt(problemText)}</user-data>

Current analysis (v${currentSnapshot.version}):
- Real question: ${sanitizeForPrompt(currentSnapshot.real_question)}
- Hidden assumptions: ${currentSnapshot.hidden_assumptions.map((a) => sanitizeForPrompt(a)).join(" / ")}
- Skeleton: ${currentSnapshot.skeleton.map((s) => sanitizeForPrompt(s)).join(" / ")}

Q&A:
${qaHistory}

Update the analysis honestly \u2014 change only what the answer actually changed, and say plainly when the picture holds.

JSON:
{
  "insight": "Two concise sentences: updated takeaway first, deciding reason second",
  "real_question": "Updated question (natural sentence, ends with ?) \u2014 sharpen only where the answer sharpened it",
  "hidden_assumptions": ["Realistic only, 2-3 items"],
  "skeleton": ["Only change items affected by the latest answer. Use natural sequence words. 5 items max."],
  "next_question": ${isLastRound ? "null" : '{"text": "Situation-shaping question (reference their latest answer)", "subtext": "Why this changes the strategy", "options": ["Leads to strategy A", "Strategy B", "Strategy C"], "type": "select|short"} \u2014 or null when no remaining question would change the analysis'},
  "ready_for_mix": ${isLastRound ? "true" : "true|false \u2014 true when another answer would NOT meaningfully change the analysis (honest early stop); false only when the next_question above is genuinely load-bearing"}
}`
  };
}
function buildMixPrompt(problemText, snapshots, questionsAndAnswers, decisionMaker, workerResults, locale = "en", leadSynthesis, blockedTasks) {
  const lang = locale === "ko" ? "Korean" : "English";
  const snapshotSummary = compactSnapshots(snapshots, locale);
  const qaHistory = shouldCompact(questionsAndAnswers) ? compactQAHistory(questionsAndAnswers, 2, locale) : questionsAndAnswers.map(
    (qa, i) => `Q${i + 1}: ${sanitizeForPrompt(qa.question.text)}
A${i + 1}: ${sanitizeForPrompt(qa.answer.value)}`
  ).join("\n\n");
  const dmLabel = decisionMaker || (locale === "ko" ? "\uC0AC\uC6A9\uC790 \uBCF8\uC778" : "the user themselves");
  const audienceLine = decisionMaker ? `This document will be presented to ${sanitizeForPrompt(dmLabel)}.` : `This document is for the USER THEMSELVES \u2014 ${locale === "ko" ? "\uC2A4\uC2A4\uB85C \uBCF4\uB294 \uC815\uB9AC" : "a self-directed brief"}. There is no boss to persuade: write it to sharpen their own judgment, not to sell a conclusion.`;
  const riskSectionName = locale === "ko" ? "\uB9AC\uC2A4\uD06C\uC640 \uB300\uC751" : "Risks & Mitigation";
  const systemPrompt = leadSynthesis ? `You are a professional document editor. Always respond in ${lang}.

A domain expert (${leadSynthesis.lead_agent_name}) has already synthesized the team's findings into an integrated analysis. Your job is to format this into a polished, professional document. ${audienceLine}

Rules:
- The lead expert's synthesis is your PRIMARY source. Preserve their strategic logic and the open question / unresolved tensions they surfaced. The lead does NOT pick a side \u2014 do not manufacture one.
- Executive summary: 2-3 sentences derived from the lead's integrated analysis.
- 3-5 sections. Merge adjacent ideas instead of creating a section for every source.
- Include the assumptions explicitly \u2014 this shows intellectual honesty.
- Next steps: as many as are real, at most 3 (\uD544\uC694\uD55C \uB9CC\uD07C, \uCD5C\uB300 3) \u2014 the highest-leverage actions, time-bound and assigned. Never pad to reach a count.
- Write it so the user can literally send this as-is. No "[insert here]" placeholders.
- Tone: confident but honest about uncertainties. Professional ${lang}.
- DO NOT use markdown headers in section content \u2014 just flowing text with emphasis where needed.
- Use **bold** for key terms and critical numbers.
- Include a "${riskSectionName}" section ONLY when the lead's synthesis contains real unresolved tensions or risks \u2014 include as many as are real, and never manufacture one to fill the section.
- DO NOT add a recommendation, verdict, or "what I'd do" \u2014 neither yours nor a stronger version of the lead's. You format the analysis and surface its open question; you never tell the user which option to pick.
- NARRATIVE FLOW: Each section must connect to the next. The document should read as one continuous argument, not separate blocks. Weave the lead's insights with specific worker evidence to create depth.` : `You are assembling a final draft document. Always respond in ${lang}.
${locale === "ko" ? "Tone: \uD574\uC694\uCCB4 (polite but warm). Not a formal report \u2014 more like a well-structured brief that a smart colleague would write. Confident but honest." : "Tone: warm, professional. Not a formal corporate report \u2014 more like a well-structured brief from a smart colleague. Confident but honest about uncertainties."}

${audienceLine}

STRUCTURE RULE: The analysis went through multiple Q&A rounds. The skeleton from the final analysis reflects the user's validated thinking. USE THAT SKELETON as the document's section structure. Don't invent new sections \u2014 fill in the skeleton items with worker research and your synthesis.
IMPORTANT: The skeleton contains ACTION ITEMS (e.g., "\uBA3C\uC800 \u2014 \uACBD\uC7C1\uC0AC \uC81C\uD488 \uC9C1\uC811 \uC368\uBCF4\uAE30"). Transform these into proper DOCUMENT HEADINGS (e.g., "\uC2DC\uC7A5 \uAE30\uD68C \u2014 \uACBD\uC7C1\uC0AC\uAC00 \uC5F4\uC5B4\uC900 \uC2DC\uC7A5"). The skeleton guides your structure; your headings should be topic-based, not task-based.

Rules:
- Executive summary: 2-3 sentences max. Lead with the document's most decision-relevant point; the reader should get 80% of the value from this alone. If nothing new emerged, say plainly what the analysis confirmed \u2014 never manufacture surprise to sound sharp.
- Section structure: 3-5 sections total. Follow the analysis skeleton, but merge adjacent skeleton items when needed. Each section: 2-3 sentences. Anchor every section to material actually provided (worker results, the user's answers, the analysis). NEVER invent a number, fact, or example to satisfy structure \u2014 an honest general statement beats a fabricated specific.
- Include the assumptions explicitly \u2014 this shows intellectual honesty.
- Next steps: \uD544\uC694\uD55C \uB9CC\uD07C, \uCD5C\uB300 3 (as many as are real, up to 3) \u2014 highest-leverage only; each must be time-bound and assigned (who does what by when). Never pad to reach a count.
- Write it so the user can literally send this as-is. No "[insert here]" placeholders.
- DO NOT use markdown headers in section content \u2014 flowing text with **bold** for key terms.
- The document should feel substantial but concise \u2014 no repeated rationale, duplicated caveats, or second summary.
- Include a "${riskSectionName}" section ONLY if real risks exist in the material \u2014 as many risks as are real (no fixed count), each with a specific mitigation. If no real risk emerged, omit the section entirely; never invent a risk to fill it.

NARRATIVE FLOW \u2014 this separates a good draft from a great one:
- Each section's FIRST sentence must connect to the PREVIOUS section's conclusion. If Section 1 ends with a gap in the market, Section 2 should start by addressing that gap. The reader should feel one continuous argument, not separate blocks.
- Worker findings may be woven in, but synthetic analysis is ONE lens, never independent evidence. Do NOT phrase citations to imply multiple independent verifications ("\uC5EC\uB7EC \uBD84\uC11D\uC774 \uC77C\uCE58" / "\uAC80\uD1A0 \uACB0\uACFC \uD655\uC778\uB428"), and never let persona count or agreement inflate confidence \u2014 synthetic output contributes zero support units toward any claim's certainty. The sentence-level contributor attribution is honest provenance; it must not become borrowed authority.
- Weave worker findings together \u2014 if one worker found the problem and another found the solution, connect them explicitly: "X\uB77C\uB294 \uBB38\uC81C\uAC00 \uD655\uC778\uB410\uACE0, \uC774\uB97C Y \uC804\uB7B5\uC73C\uB85C \uB4A4\uC9D1\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
- The document should read as ONE STORY: Context (why now) \u2192 Opportunity (what we found) \u2192 Strategy (how we solve it) \u2192 Evidence (proof it works) \u2192 Risks (what could go wrong) \u2192 Action (what to do next).

MULTI-PERSPECTIVE TASKS:
- A task header in the form "[task] (N perspectives \u2014 intentional team diversity)" means the user deliberately assigned multiple personas to that task. Their results are listed as sub-bullets ("\xB7 Name:" lines).
- Treat them as ONE task with multiple lenses, not as multiple unrelated tasks. Synthesize where they agree, surface where they meaningfully diverge.
- For sentence-level "contributors", list every persona whose finding genuinely informs that sentence (1-3 names is normal; padding with all members is wrong).
- Don't write a separate paragraph per persona \u2014 the user added them to enrich the analysis, not to fragment it.

ATTRIBUTION (required when worker results are provided):
- Use ONLY names from the provided worker list. Never invent or mis-spell names.
- Two levels of attribution \u2014 prefer sentence-level when possible:
  1. SENTENCE LEVEL (preferred): For each section, return a "sentences" array. Each sentence object has "text" (the exact sentence) and "contributors" (the 1-2 worker names whose findings directly support THIS sentence). Split the section into 2-3 natural sentences.
  2. SECTION LEVEL (fallback): If you can't do sentence-level for a section, omit "sentences" and use the section-level "contributors" array instead.
- A sentence usually has 1-2 contributors. A cross-cutting sentence may list more but avoid padding.
- Example sentence entry: {"text": "\uACBD\uC7C1\uC0AC \uC138\uD305 2\uC8FC\uAC00 \uC6B0\uB9AC \uAE30\uD68C\uC785\uB2C8\uB2E4.", "contributors": ["\uB2E4\uC740"]}
- When you use "sentences", OMIT "content". The application derives flat content by joining the sentences; returning both only duplicates the document.`;
  const leadBlock = leadSynthesis ? `
Lead Expert Synthesis (by ${leadSynthesis.lead_agent_name}):
${leadSynthesis.integrated_analysis}

Key findings:
${leadSynthesis.key_findings.map((f) => `- ${f}`).join("\n")}

Open question this turns on: ${leadSynthesis.open_question}
${leadSynthesis.unresolved_tensions.length > 0 ? `
Unresolved tensions:
${leadSynthesis.unresolved_tensions.map((t) => `- ${t}`).join("\n")}` : ""}` : "";
  const userCalls = (workerResults ?? []).filter((w) => w.authored === "user");
  const aiResults = (workerResults ?? []).filter((w) => w.authored !== "user");
  const blockedBlock = blockedTasks?.length ? `
MISSING HUMAN INPUTS (the user hasn't answered these yet \u2014 do NOT fabricate them):
${blockedTasks.map((t) => `- ${sanitizeForPrompt(t)}`).join("\n")}
Any section that depends on one of these must be written provisionally and say so plainly (e.g. "${locale === "ko" ? "[\uC544\uC9C1 \uC785\uB825 \uB300\uAE30 \u2014 \uD655\uC815 \uC544\uB2D8]" : "[awaiting the user's input \u2014 provisional]"}"). Never invent a stand-in for a missing human input.` : "";
  const userCallsBlock = userCalls.length ? `
THE USER'S OWN DECISIONS \u2014 the human already made these calls; they OUTRANK everything below (both the worker research AND any expert synthesis):
${userCalls.map((w) => `- On "${sanitizeForPrompt(w.task)}": ${sanitizeForPrompt(w.result)}`).join("\n")}

These are the user's own judgment, not AI findings. Build the document AROUND them: treat them as settled, attribute them to the user (never to a persona or "the team"), and never override, dilute, hedge, or quietly bury them. If the worker research or the synthesis conflicts with a user decision, surface the tension honestly \u2014 do NOT overrule the user.` : "";
  const workerBlock = aiResults.length ? (() => {
    const groupOrder = [];
    const groupMap = /* @__PURE__ */ new Map();
    for (const w of aiResults) {
      const gid = w.taskGroupId || w.task;
      if (!groupMap.has(gid)) {
        groupMap.set(gid, []);
        groupOrder.push(gid);
      }
      groupMap.get(gid).push(w);
    }
    const blocks = groupOrder.map((gid) => {
      const members = groupMap.get(gid);
      if (members.length === 1) {
        const w = members[0];
        const label = w.name ? `[${sanitizeForPrompt(w.name)} \u2014 ${sanitizeForPrompt(w.task)}]` : `[${sanitizeForPrompt(w.task)}]`;
        return `${label}
${sanitizeForPrompt(w.result)}`;
      }
      const taskHeader = `[${sanitizeForPrompt(members[0].task)}] (${members.length} perspectives \u2014 intentional team diversity)`;
      const subBullets = members.map((w) => {
        const indented = sanitizeForPrompt(w.result).split("\n").map((l) => `    ${l}`).join("\n");
        return w.name ? `  \xB7 ${sanitizeForPrompt(w.name)}:
${indented}` : `  \xB7 ${indented.trimStart()}`;
      }).join("\n");
      return `${taskHeader}
${subBullets}`;
    });
    return `
Worker research results (supporting evidence):
${blocks.join("\n\n")}

${leadSynthesis ? "Use these as supporting evidence for the lead's synthesis." : "Make sure to incorporate specific numbers/facts from the worker results into the document."}

AVAILABLE CONTRIBUTOR NAMES (cite these EXACTLY in "contributors" per section):
${aiResults.filter((w) => w.name).map((w) => `- ${sanitizeForPrompt(w.name)}`).join("\n") || "(none)"}`;
  })() : "";
  const sectionSchema = aiResults.length ? `{
      "heading": "Section heading",
      "sentences": [
        {"text": "First sentence verbatim.", "contributors": ["Exact worker name"]},
        {"text": "Second sentence verbatim.", "contributors": ["Exact worker name"]}
      ]
    }` : `{"heading": "Section heading", "content": "Section content (2-3 sentences, specific)"}`;
  const guardedSystemPrompt = `${systemPrompt}

${WORLD_FACT_HONESTY_GUARD}${locale === "ko" ? `

${KOREAN_VOICE_RULES}` : ""}

${ARGUS_PRODUCT_FACTS}`;
  return {
    system: guardedSystemPrompt,
    user: `Original problem: <user-data>${sanitizeForPrompt(problemText)}</user-data>

Final analysis:
${snapshotSummary}

Full Q&A:
${qaHistory}
${userCallsBlock}${blockedBlock}${leadBlock}${workerBlock}

${leadSynthesis ? "Format the lead expert's synthesis into a polished professional document." : "Combine all of this into a single document."}

JSON format:
{
  "title": "Document title (specific, reflects the situation)",
  "decision_read": "The single line the user reads FIRST \u2014 a neutral headline of WHERE the document lands, never a command. HARD RULES, follow all: (1) ONE short sentence, max ~18 words. (2) State either the single question this document turns on, OR the condition under which each path wins ('X\uB77C\uBA74 A\uAC00, \uC544\uB2C8\uB77C\uBA74 B\uAC00 \uB9DE\uB294 \uAD6C\uB3C4'). (3) NEVER an imperative instruction ('~\uD558\uC138\uC694'), NEVER a pick of one option, NEVER a verdict \u2014 the document informs the user's call; it does not make it. (4) No topic label, no restating the question verbatim. In the user's language. GOOD (ko): '\uC774 \uACB0\uC815\uC740 \uACB0\uAD6D \uB300\uD45C\uAC00 \uC6D0\uD558\uB294 \uAC8C \uC18D\uB3C4\uC778\uC9C0 \uC644\uC131\uB3C4\uC778\uC9C0\uC5D0 \uB2EC\uB824 \uC788\uC5B4\uC694.' GOOD (ko): '\uACB0\uC7AC\uAD8C\uC790\uAC00 \uB204\uAD6C\uC778\uC9C0 \uD655\uC778\uB418\uBA74 PT\uC758 \uAD6C\uC870\uAC00 \uC815\uD574\uC9C0\uB294 \uAD6C\uB3C4\uC608\uC694.' BAD (an engine-authored command): 'PT \uC804\uC5D0 \uC9C4\uC9DC \uACB0\uC7AC\uAD8C\uC790\uBD80\uD130 \uD655\uC778\uD558\uC138\uC694 \u2014 \uC2B9\uBD80\uCC98\uB294 \uC2AC\uB77C\uC774\uB4DC\uAC00 \uC544\uB2D9\uB2C8\uB2E4.'",
  "executive_summary": "The document's own 2-3 sentence summary (fuller than decision_read; leads the document body, not the headline).",
  "sections": [
    ${sectionSchema}
  ],
  "key_assumptions": ["Up to 4 assumptions this document rests on. Each MUST be a statement that reality can later prove true or false \u2014 never a question, never advice. Wrong: "Is the timeline realistic?" Right: "The team can finish the migration within two sprints.""],
  "next_steps": ["As many as are real, up to 3 \u2014 each a specific next action (who, by when, what). Never pad."]
}`
  };
}

// scripts/sim/sim-entry.ts
import { callLLMJson as callLLMJson2 } from "../llm-shim.mjs";
var NON_OPEN_REQUEST_TYPES = /* @__PURE__ */ new Set([
  "vent",
  "validation",
  "info",
  "self_profiling",
  "flat",
  "resistance"
]);
function applyRouteContract(result) {
  const rt = result.request_type;
  if (rt && NON_OPEN_REQUEST_TYPES.has(rt) && Array.isArray(result.skeleton) && result.skeleton.length > 0) {
    return { result: { ...result, skeleton: [] }, coerced: true };
  }
  return { result, coerced: false };
}
async function runHeavyInitial(problemText, locale) {
  const { system, user } = buildInitialAnalysisPrompt(problemText, locale);
  const raw = await callLLMJson2(
    [{ role: "user", content: user }],
    {
      system,
      maxTokens: 4096,
      cacheSystem: true,
      shape: { real_question: "string", hidden_assumptions: "array", skeleton: "array", next_question: "object" }
    }
  );
  const { result, coerced } = applyRouteContract({ ...raw });
  return { raw, result, routeCoerced: coerced };
}
async function runHeavyDeepening(problemText, currentSnapshot, questionsAndAnswers, round, maxRounds, locale) {
  const { system, user } = buildDeepeningPrompt(
    problemText,
    currentSnapshot,
    questionsAndAnswers,
    round,
    maxRounds,
    locale
  );
  return await callLLMJson2(
    [{ role: "user", content: user }],
    {
      system,
      maxTokens: 2500,
      shape: { insight: "string", real_question: "string", hidden_assumptions: "array", skeleton: "array", ready_for_mix: "boolean" }
    }
  );
}
async function runHeavyMix(problemText, snapshots, questionsAndAnswers, decisionMaker, locale) {
  const { system, user } = buildMixPrompt(
    problemText,
    snapshots,
    questionsAndAnswers,
    decisionMaker,
    void 0,
    // workerResults — express path: no crew ran
    locale,
    null,
    // leadSynthesis
    void 0
    // blockedTasks
  );
  return await callLLMJson2(
    [{ role: "user", content: user }],
    {
      system,
      maxTokens: 5500,
      model: "default",
      shape: { title: "string", executive_summary: "string", sections: "array", key_assumptions: "array", next_steps: "array" }
    }
  );
}
export {
  LIGHT_MAX_QUESTIONS,
  applyRouteContract,
  buildDeepeningPrompt,
  buildInitialAnalysisPrompt,
  buildLightSystemPrompt,
  buildMixPrompt,
  classifyCrisis,
  composeDeepenText,
  runHeavyDeepening,
  runHeavyInitial,
  runHeavyMix,
  runLightGate,
  runLightNext
};
