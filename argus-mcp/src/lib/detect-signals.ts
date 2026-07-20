/**
 * Layer-2 deterministic signal detection (blueprint continuation of the plugin's
 * `decision-signals.js`, whose comment reads "Layer 2 widens precision — later").
 *
 * WHY THIS EXISTS (the trust answer, 2026-07-20). In an MCP the *noticing* of a
 * passing prediction / a surfacing outcome / a load-bearing assumption is, by the
 * protocol, the host model's act — the server never sees the conversation, and
 * Claude does not yet support server-driven `sampling` (feature req #1785). So
 * "the model will notice" is a goodwill dependency, not a guarantee. This module
 * turns the part that CAN be code into code: a pure, dependency-free, unit-tested
 * RULE scan of a turn's text. It does not replace the model — it RAISES RECALL so
 * the model is handed a specific candidate in the user's own words instead of
 * being trusted to spot it from scratch.
 *
 * LLM-glue invariant: because this is rules (not a model), a test can pin it —
 * "plausible" cannot masquerade as "correct". Every detected span is the user's
 * OWN words (a verbatim slice), never a fabricated stand-in.
 *
 * SPINE (mirror clause — max detect, min fire): this detector leans HIGH-RECALL.
 * Restraint lives in the FIRING gate around it (the hook's once-per-session +
 * cooldown, and the model's freedom to stay silent on a flat case), NOT here.
 * Detection ≠ interruption: a caller may detect and still choose to say nothing.
 */

export type SignalKind = 'prediction' | 'outcome' | 'assumption';

export interface DetectedSignal {
  kind: SignalKind;
  /** The user's own words — the clause the cue fired in, verbatim. Never invented. */
  span: string;
  /** Which named cue groups matched — provenance for the caller and the tests. */
  cues: string[];
}

export interface DetectOptions {
  /** Open (sealed, unsettled) prediction texts. Outcome detection stays SILENT
   *  without these: a bare past-tense sentence is not an outcome unless it
   *  plausibly resolves a KNOWN open prediction (the floor against firing on
   *  ordinary "it went fine" chatter). */
  openPredicates?: string[];
  /** Cap on returned signals (default 4) — a turn is not a form to harvest. */
  max?: number;
}

/* ── Cue groups (named so tests + the plugin mirror can pin them) ──────────── */

/** Future / modal markers: the claim points at a not-yet-settled state. */
const FUTURE = [
  /\bwill\b/i, /\bwon'?t\b/i, /\bgoing to\b/i, /\bgonna\b/i, /\bshall\b/i,
  /\bexpect(s|ed|ing)?\b/i, /\bshould\b/i, /\blikely\b/i, /\bplan(ning)? to\b/i,
  /\bby (mon|tue|wed|thu|fri|sat|sun)\w*/i,
  /\bby (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i,
  /\bby \d/i, /\bwithin \d+\s*(day|week|month|quarter)/i,
  /\bnext (week|month|quarter|year|sprint)\b/i,
  // Korean futures / commitments / thresholds-as-future
  /(할|될|갈|낼|올|줄)\s*(것|거|게|걸)/, /하겠|되겠|시키겠/, /(ㄹ|를|을)\s*거(다|예요|야|임)/,
  /예상|전망|목표|계획|할 예정|될 예정/, /까지(는|\b|\s)/, /안에|이내(에)?/,
  /다음\s*(주|달|분기|해|스프린트)/, /(유지|달성|돌파|출시|완료)(할|될|하겠|되겠|한다|된다)/,
  // Korean prospective endings — "-ㄹ 거예요 / -ㄹ 겁니다 / -ㄹ 것으로": the ㄹ is
  // fused into a composed syllable (빨라질) so match the trailing marker itself.
  /(거예요|거에요|거야|겁니다|거고|건데|건가|것으로|것입니다|것이다|것\s*같)/, /(ㄹ|을|를)\s*것\b/,
];

/** Measurable checkpoints: a number, percent, money, date, threshold, comparison. */
const MEASURABLE = [
  /\d/, /%|percent|퍼센트|프로/i, /\$|원\b|달러|억|만원|USD|KRW/i,
  /\b(faster|slower|lower|higher|cheaper|under|over|below|above|less than|more than|at least|no more than)\b/i,
  /이하|이상|미만|초과|아래|위(로)?|밑(으로)?|이내|보다\s*(빠|느|싸|비|많|적|높|낮)/,
  /\b(mon|tue|wed|thu|fri|sat|sun)\w*/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i, /\d{4}-\d{2}-\d{2}/,
];

/** Completion verbs: a discrete event reality can confirm happened or not. */
const COMPLETION = [
  /\b(ship|launch|release|deliver|deploy|close|hire|sign|land|finish|complete|onboard|migrate|cut over)\b/i,
  /출시|배포|출고|런칭|납품|마감|채용|계약|체결|완료|오픈|이전|전환|성사|입사|합류/,
];

/** Past-tense resolution markers: reality has spoken about something. */
const RESOLVED = [
  /\bturn(s|ed)? out\b/i, /\bended up\b/i, /\bcame in at\b/i, /\bended at\b/i,
  /\bwe (shipped|launched|missed|hit|closed|hired|signed|landed|deployed)\b/i,
  /\bit (went|held|worked|failed|slipped|held up)\b/i,
  /\bdidn'?t (happen|work|ship|hold|land)\b/i, /\b(hit|missed|beat|met) (the|our) (target|number|deadline|goal)\b/i,
  /됐(어|다|고|는데|네|음)|됐다|성사(됐|했)|끝났|출시했|배포했|이전했|전환했/,
  /안\s*(됐|나|됐어|됐다)|못\s*(했|했다|해서|이룬)|실패(했|함)|무산(됐|됨)/,
  /결국|실제로(는)?|막상|나왔(다|어|고)|나온|드러났|밝혀졌|판명/,
];

/** Causal / conditional markers: the reasoning rests on a stated premise. */
const CONDITIONAL = [
  /\bbecause\b/i, /\bsince\b/i, /\bassuming\b/i, /\bas long as\b/i, /\bdepends on\b/i,
  /\bonly if\b/i, /\bprovided that\b/i, /\bbanking on\b/i, /\bhinges? on\b/i,
  /\bcontingent on\b/i, /\bthe (key|whole thing) (is|hinges|rests|depends)\b/i,
  /니까|때문에|덕분에|탓에/, /(라|다)면\b|(으|)ㄴ다면|는다면/, /는\s*한(에서)?|한(에서만)?/,
  /(에|에게)\s*달렸|달려\s*있|전제로|가정하(면|고)|관건은|핵심은|믿고\s*있/,
];

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const anyMatch = (groups: RegExp[], s: string): boolean => groups.some((re) => re.test(s));
const whichMatch = (name: string, groups: RegExp[], s: string): string | null =>
  groups.some((re) => re.test(s)) ? name : null;

/** Split into sentence-ish spans on terminators + newlines; keep the user's text. */
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 6 && c.length <= 400);
}

/** Cheap token overlap for outcome↔open-predicate. Prefix-aware so Korean josa
 *  ("이전은" vs "이전", "다운타임은" vs "다운타임") still counts as the same word —
 *  naive exact-token overlap silently under-fires on every particle-attached noun. */
function overlaps(a: string, b: string): boolean {
  const tok = (s: string) =>
    s.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);
  const A = tok(a);
  const B = tok(b);
  if (A.length === 0 || B.length === 0) return false;
  let hit = 0;
  for (const x of A) {
    for (const y of B) {
      if (x === y || x.startsWith(y) || y.startsWith(x)) { hit++; break; }
    }
  }
  return hit >= 2; // two salient shared/overlapping tokens — the floor against chatter
}

/* ── The detector ─────────────────────────────────────────────────────────── */

/**
 * Scan a turn's text for the three senses. Pure and deterministic. Returns each
 * detected signal with the user's own span and the cues that fired. High recall
 * by design; the caller owns the firing gate (see module header).
 */
export function detectSignals(text: string, opts: DetectOptions = {}): DetectedSignal[] {
  if (typeof text !== 'string' || text.trim().length < 6) return [];
  const openPredicates = (opts.openPredicates ?? []).filter((p) => typeof p === 'string' && p.trim());
  const max = typeof opts.max === 'number' && opts.max > 0 ? opts.max : 4;

  const out: DetectedSignal[] = [];
  const seen = new Set<string>();
  const push = (kind: SignalKind, span: string, cues: string[]) => {
    const key = `${kind}:${span}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, span, cues });
  };

  for (const c of clauses(text)) {
    // 1) PREDICTION — a claim reality can later check: FUTURE ∧ (MEASURABLE ∨ COMPLETION).
    const future = whichMatch('future', FUTURE, c);
    const measurable = whichMatch('measurable', MEASURABLE, c);
    const completion = whichMatch('completion', COMPLETION, c);
    if (future && (measurable || completion)) {
      push('prediction', c, [future, measurable, completion].filter((x): x is string => !!x));
    }

    // 3) ASSUMPTION — reasoning that rests on a stated premise. Conservative: the
    //    clause must ALSO carry a checkable/consequential cue, so a throwaway
    //    "because I'm tired" does not register as a load-bearing assumption.
    const conditional = whichMatch('conditional', CONDITIONAL, c);
    if (conditional && (measurable || completion || future)) {
      push('assumption', c, [conditional, measurable, completion, future].filter((x): x is string => !!x));
    }

    // 2) OUTCOME — reality answering a KNOWN open prediction. Needs a resolution
    //    cue AND overlap with an open predicate (the floor against past-tense chatter).
    const resolved = whichMatch('resolved', RESOLVED, c);
    if (resolved && openPredicates.some((p) => overlaps(c, p))) {
      push('outcome', c, [resolved, 'matches-open-prediction']);
    }
  }

  return out.slice(0, max);
}

/** The named cue groups, exported so the plugin mirror + a drift guard can pin
 *  that the two surfaces detect the SAME things (single-source-of-truth rule). */
export const CUE_GROUPS = { FUTURE, MEASURABLE, COMPLETION, RESOLVED, CONDITIONAL } as const;
