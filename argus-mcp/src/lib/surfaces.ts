import fs from 'fs';
import { configPath } from './layout.js';
import { detectLocaleFromText } from './locale.js';

/**
 * surfaces.ts — the ONE locale brain for user-facing surface strings
 * (P1-E1, polish audit 2026-07-03; 11 S5 = 12 P2-4 merged).
 *
 * Before this file the `locale` config was a dead switch: argus_config
 * accepted 'ko'|'en' and nothing read it, while the voice was split by tool
 * (seal/settle/open spoke English regardless, sync/review spoke Korean
 * regardless). Surface strings move HERE, into one {ko,en} dictionary, and
 * each tool picks via the config — the MCP twin of the webapp's
 * "Single Source of Truth for Prompts" principle.
 *
 * Adoption policy (deliberately incremental — master P1-E1 scope guard):
 *   - Strings the NEW renders need (E2 seal_text, E3 check_in anchor mirror,
 *     E7 wake_text) enter here first.
 *   - Already-diverged voices (sync's hardcoded Korean) are unified here.
 *   - Everything else migrates tool-by-tool WHEN a tool is touched — do not
 *     bulk-move all 13 tools' strings in one pass.
 *   - `argus-mcp/src/lib/review/*` (8 files) is byte-drift-guarded against
 *     the webapp core (review-mcp-drift.test.ts) — NEVER move its strings
 *     here. tools/review.ts (a tool file) may adopt later.
 *
 * Locale resolution is CONFIG-ONLY and deterministic: argus_init seeds
 * config.yaml with detectLocale (env/Intl sniffing lives there, at write
 * time); tools read the config. No config → 'en' (the MCP's base voice),
 * so tests and fresh dirs behave the same on every machine.
 */

export type SurfaceLocale = 'ko' | 'en';

export function surfaceLocale(argusDir?: string | null): SurfaceLocale {
  return configLocale(argusDir) ?? 'en';
}

/** Turn a machine sync-failure reason (push-account.ts enum) into a human
 *  sentence fragment — the raw token ("bad_token_format") used to be spliced
 *  straight into the seal confirmation (§9.4 경계 수리). Unknown reasons pass
 *  through untranslated (honest, still short). */
export function humanizeSyncReason(reason: string, locale: SurfaceLocale): string {
  const http = /^http_(\d+)$/.exec(reason);
  if (locale === 'ko') {
    if (reason === 'bad_token_format') return '토큰 형식이 잘못됐습니다 (argus_pat_로 시작해야 합니다)';
    if (reason === 'insecure_api_url') return 'API 주소가 https가 아니라 토큰을 보내지 않았습니다';
    if (reason === 'network') return '네트워크에 닿지 못했습니다';
    if (http) return http[1] === '401' || http[1] === '403'
      ? `토큰이 거부됐습니다 (HTTP ${http[1]}) — 만료됐을 수 있으니 웹 설정에서 새 토큰을 발급하세요`
      : `서버가 ${http[1]}로 응답했습니다`;
    return reason;
  }
  if (reason === 'bad_token_format') return 'the token looks malformed (it should start with argus_pat_)';
  if (reason === 'insecure_api_url') return 'the API URL is not https, so the token was not sent';
  if (reason === 'network') return 'the network was unreachable';
  if (http) return http[1] === '401' || http[1] === '403'
    ? `the token was rejected (HTTP ${http[1]}) — it may be expired; issue a new one in web Settings`
    : `the server answered ${http[1]}`;
  return reason;
}

/** The explicit config locale, or null when no config.yaml declares one.
 *  Distinct from surfaceLocale so the response-locale chain can tell an
 *  EXPLICIT `locale: en` (config wins, never overridden) apart from the
 *  bare 'en' base voice (a mere default, which text detection may override). */
function configLocale(argusDir?: string | null): SurfaceLocale | null {
  if (!argusDir) return null;
  try {
    const cfg = fs.readFileSync(configPath(argusDir), 'utf8');
    const m = cfg.match(/^locale:\s*(ko|en)\b/m);
    if (m) return m[1] as SurfaceLocale;
  } catch { /* no config yet → base voice */ }
  return null;
}

/**
 * resolveResponseLocale — the M4 detection chain (spec §4):
 *   explicit config > input-text detection > env/Intl > 'en'.
 *
 * Each tool passes the CALL'S representative user-authored text (the decision
 * sentence, the predicate, the finding, …). If the user has pinned a locale in
 * config.yaml, that ALWAYS wins — an explicit setting is an escape hatch the
 * detector never overrides. With no explicit config, a confident text sniff
 * decides; a null/low-confidence sniff falls through to env/Intl, then 'en'.
 *
 * This never writes config. It only chooses the VOICE of one response, so a
 * bilingual user gets Korean surfaces on Korean input and English on English
 * without touching their saved preference.
 */
export function resolveResponseLocale(argusDir: string | null | undefined, text?: string | null): SurfaceLocale {
  const explicit = configLocale(argusDir);
  if (explicit) return explicit;
  const fromText = detectLocaleFromText(text);
  if (fromText) return fromText;
  const env = process.env['LANG'] || process.env['LC_ALL'] || '';
  if (/^ko/i.test(env)) return 'ko';
  try {
    if (/^ko/i.test(Intl.DateTimeFormat().resolvedOptions().locale)) return 'ko';
  } catch { /* Intl unavailable */ }
  return 'en';
}

/** Shape shared by both locales — a key added to one MUST exist in the other
 *  (TypeScript enforces the parity; no drift between the two voices). */
export interface SurfaceStrings {
  /** M1 §1.3 — the in-session ambient due-line: one FACT sentence appended to
   *  the very end of any tool's surface so a due item is never forgotten mid-
   *  session. Counts + handle only, never a directive; silent at zero (rendered
   *  by the caller only when at least one count is > 0). */
  ambient: {
    /** fragment: contracts past check-by. */
    frag_contracts: (contracts: number) => string;
    /** fragment: premise facts due for re-check. */
    frag_premises: (premises: number) => string;
    /** fragment: open questions due for reconsideration (M3). */
    frag_open_questions: (questions: number) => string;
    /** wrap the joined fragments into one appended-tail line (lead space + the
     *  argus_check_in handle). Empty fragment list is never passed. */
    wrap: (frags: string[]) => string;
  };
  checkin: {
    nothing_due: string;
    /** appended when ARGUS_TOKEN is set and nothing is due locally (P1-E4 ③). */
    account_hint: string;
    upcoming: (n: number, days: number) => string;
    /** count-only due line (fallback when no seal-time words exist). */
    due_contracts: (n: number) => string;
    /** the anchor mirror (P1-E3): date arithmetic + the user's OWN words back.
     *  Recognition is day-math only — no welcome greetings, no verdict. */
    anchor_mirror: (daysSinceSeal: number, dueCount: number, words: string) => string;
    /** staleDays / sinceAdd (single-fact case): days since the fact was last
     *  checked (null = never) and days since it was added. Without them the
     *  line was byte-identical day after day — the 75-day life loop measured a
     *  20-day verbatim streak: wallpaper that trains the eye to stop seeing
     *  it. Aging text is honest new information; a full silence-decay cap is a
     *  separate product decision (backlog). */
    due_premises: (n: number, staleDays?: number | null, sinceAdd?: number | null) => string;
    /** M3 — the open_question reconsider surface: a FACT (how long it has been
     *  open + the user's own question text) + the handle. Never a directive; the
     *  coda names that leaving it open is a valid answer (no guilt, no verdict). */
    reconsider_one: (daysOpen: number | null, questionText: string) => string;
    /** M3 — count line when more than one question is due (the single quote leads,
     *  the rest stay in data — no surface wall). */
    reconsider_more: (n: number) => string;
    /** ledger-corruption disclosure (11 P2-8): counted silently before — say it. */
    dropped_lines: (n: number) => string;
    /** 당직 미러 (§9.1): the most recent PRIOR day's anchor, mirrored back as a
     *  question. 세 문장 문법 — 인용, 사실(날짜), 손잡이. Never an evaluation,
     *  never a completion check. */
    watch_mirror: (date: string, text: string) => string;
    /** M2 fleet — due counts across OTHER projects (facts + a handle, no urgency). */
    fleet_summary: (projects: number, due: number) => string;
  };
  sync: {
    live_with_due: (total: number, due: number) => string;
    live_no_due: (total: number) => string;
    settled_on_web: (n: number) => string;
    /** M2 귀환 봉합 — web settlements mirrored into the local ledger (the
     *  user's own words, imported verbatim; a fact line, never a verdict). */
    imported: (n: number) => string;
    truncation: (shown: number, matched: number) => string;
  };
  /** seal_text — the terminal twin of the webapp's seal certificate plate
   *  (P1-E2 = 12 §3.1; same concept, same copy family as P1-A3 S4: quote +
   *  two date rows + the "not a grade" line). */
  seal: {
    header: string;
    /** honest provenance line — predicate_owner:'user' (헌법 규칙1). */
    owner_user: string;
    /** honest provenance line — 'ai_surfaced': drafted, not yet affirmed.
     *  Sealing as-is stays possible (no forced-typing gate). */
    owner_ai: string;
    sealed_label: string;
    answers_label: string;
    days_out: (n: number) => string;
    /** the closing fact: what gets recorded is reality, never a grade. */
    closing: [string, string];
    footer: string;
  };
  /** wake_text — the accumulation landscape (P1-E7 = 12 §3.5): three groups
   *  on a time axis, counts and facts ONLY. No %, no tier, no streak — the
   *  spine-drift test pins this. The overdue vocabulary ("확인일 지남 · N일
   *  경과") is the DEVELOPER-surface ruling (master §5-6): allowed in the
   *  terminal, forbidden to import into the webapp. */
  wake: {
    header: string;
    counts: (total: number, sealed: number, settled: number) => string;
    overdue_group: (n: number) => string;
    /** the settle handle, returned — never an instruction sentence. */
    overdue_hint: string;
    days_past: (n: number) => string;
    waiting_group: (n: number) => string;
    answer_on: (date: string) => string;
    /** counts-only settled header: `held 1 · avoided 1 · partial 1` — outcome
     *  words are the user's own picks (user_stated), so naming them is not a
     *  verdict; a ratio or % here would be. */
    settled_group: (n: number, held: number, avoided: number, partial: number) => string;
    more: (n: number) => string;
    record_since: (date: string) => string;
  };
  /** receipt_text — the settled Judgment Receipt, the product's keepsake
   *  artifact (FC-2: it was the ONE renderer left outside the locale brain —
   *  a Korean user sealed and settled in Korean and got an English receipt).
   *  The `AI VERDICT … NONE` line is brand DNA and stays English in every
   *  locale (it is the OG image's centerpiece, same on web). */
  receipt: {
    header: string;
    sealed_label: string;
    settled_label: string;
    not_settled: string;
    real_question: string;
    unverified_assumption: string;
    human_only: string;
    made_by_label: string;
    made_by: string;
    called_as: string;
    /** The basis enum (judgment|luck|mixed|unsure) as a word, not a raw token —
     *  "…콜한 내용  judgment" mixed EN into a KO receipt (experience-loop find). */
    basis_label: (v: string) => string;
    skipped: string;
    premises_note: (tracked: number, changed: number) => string;
    /** Neutral timeline fact when the record was deferred (still_pending re-armed)
     *  before it finally settled: "originally due X · deferred N×". Never a grade. */
    deferred_fact: (times: number, originallyDue: string) => string;
    you_predicted: string;
    check_by: (date: string) => string;
    what_happened: string;
    verdict_line: string;
    closing: string;
    footer: string;
  };
  /** happy-path one-liners for the 6 tools that still spoke English regardless
   *  of locale (dogfood FINDINGS-2 §2: open_decision/seal/settle/recheck/amend/
   *  dismiss). Rich receipts, errors and nudges were already localized; only
   *  these terminal `surface` lines remained EN. en byte-preserves the pre-M4
   *  strings (the 324-test baseline verifies them); ko is the new parity half. */
  tools: {
    open_decision: {
      /** restraint reasons — the fire-or-not gate said don't manufacture a fork.
       *  Keyed by overfireGate reason; the coda naming "leave as is" is appended
       *  by the caller. Contract (§4): a WHY sentence, never a directive. */
      reason: Record<'vent' | 'factual' | 'already_closed' | 'flat' | 'reversible_low_stakes' | 'low_stakes', string>;
      reason_fallback: string;
      /** the coda: names the status-quo option, returns the handle. */
      leave_coda: string;
      /** §9.4 절벽 제거 — the restraint verdict stands, but the user who still
       *  wants the thought KEPT gets an exit: a watch note, not an opened decision. */
      watch_exit: string;
      reconfirm: string;
      /** FIRE, crux supplied: name the one question. */
      opened_with_crux: (crux: string) => string;
      /** FIRE, no crux: instruct exactly ONE neutral crux question. */
      opened_bare: string;
    };
    seal: {
      /** the core confirmation: quote + check-by + come-back handle. */
      sealed: (predicate: string, checkBy: string) => string;
      /** appended when the assumption was skipped (recorded, not hidden). */
      nudge_assumption: string;
      /** account-sync voice (3-state): success speaks, no_token stays silent. */
      synced: string;
      sync_failed: (reason: string) => string;
    };
    settle: {
      settled: string;
      sync_failed: (reason: string) => string;
      /** still_pending re-arm (defer): honest "not settled — reality hasn't
       *  answered; I'll bring it back on {date}". Never says "settled". */
      deferred: (newDate: string) => string;
      /** the still_pending picker's escape: the prediction no longer matters, set
       *  aside instead of forcing a fake future date. */
      defer_dismissed: string;
    };
    recheck: {
      baseline: (ref: number, finding: string, source: string, cadenceDays: number) => string;
      /** material drift — the fact moved; return the handle, never a directive. */
      material: (ref: number, before: string, after: string, source: string) => string;
      /** uncertain — surface the FACT only, no handle (M2 §4). Already ko in the
       *  live code; carried here for parity + so `en` gets a real translation. */
      uncertain: (ref: number, reason: string) => string;
      uncertain_heuristic_note: string;
      unchanged: (ref: number, source: string) => string;
    };
    amend: {
      /** predicate/check-by may be undefined on an amend that only touched the
       *  other field — matches the pre-M4 template-literal tolerance. */
      amended: (predicate: string | undefined, checkBy: string | undefined) => string;
    };
    dismiss: {
      dismissed: string;
    };
    /** 당직 루프 (§9.3) — anchor/capture/list confirmations. Facts + handles
     *  only: no praise, no progress language, no streak. */
    watch: {
      anchored: string;
      captured: (kind: string) => string;
      listed: (anchors: number, captures: number) => string;
    };
  };
}

export const SURFACES: Record<SurfaceLocale, SurfaceStrings> = {
  en: {
    ambient: {
      frag_contracts: (c) => `${c} to settle`,
      frag_premises: (p) => `${p} premise fact(s) to re-check`,
      frag_open_questions: (q) => `${q} open question(s) to reconsider`,
      wrap: (frags) => ` By the way, you have ${frags.join(' · ')} when you have a moment (argus_check_in).`,
    },
    checkin: {
      nothing_due: 'Nothing is due right now.',
      account_hint: ' This screen reads the local ledger only. Judgments sealed in your account show up with argus_sync.',
      upcoming: (n, days) => ` ${n} coming due within ${days} day(s). Informational, nothing to settle yet.`,
      due_contracts: (n) => `${n} decision contract(s) past check-by. Time to check how they turned out (argus_settle).`,
      anchor_mirror: (days, n, words) =>
        `${days} day(s) since you sealed, and ${n} contract(s) are past check-by. Back then you wrote: '${words}' All that's left is to record what actually happened (argus_settle).`,
      due_premises: (n, staleDays, sinceAdd) =>
        `${n} premise fact(s) due for a re-check${n === 1 && staleDays != null ? ` (last checked ${staleDays}d ago)` : n === 1 && staleDays === null && sinceAdd != null ? ` (added ${sinceAdd}d ago, first check still open)` : ''} (argus_recheck).`,
      reconsider_one: (days, q) =>
        `${days === null ? 'You left this open a while ago' : `You left this open ${days} day(s) ago`}: '${q}' Answer it now if you can, or leave it open a while longer. Either is fine (argus_premises).`,
      reconsider_more: (n) => `${n} open question(s) you left unresolved are up for another look (argus_premises).`,
      dropped_lines: (n) =>
        ` ${n} ledger line(s) could not be read (possibly a crash artifact). The record is append-only, so the rest is intact. Keep a backup of ledger.jsonl.`,
      watch_mirror: (date, text) =>
        `On ${date} you wrote: '${text}' So how did it go? (To jot down today's line, use argus_watch.)`,
      fleet_summary: (projects, due) =>
        ` ${due} due across ${projects} other project(s). Details are in data.fleet; each one settles in its own project.`,
    },
    sync: {
      live_with_due: (total, due) =>
        `${total} live judgment(s) in your account, ${due} past check-by. ` +
        'Terminal-sealed ones settle here via argus_settle with local_id; web-sealed ones settle in the web dashboard.',
      live_no_due: (total) => `${total} live judgment(s) in your account. Nothing past its check-by.`,
      settled_on_web: (n) => ` ${n} already settled on the web. Run argus_sync with import_settlements:true to mirror your web record into this ledger, or record it yourself with argus_settle.`,
      imported: (n) => ` Mirrored ${n} web settlement(s) into this ledger, in your own recorded words.`,
      truncation: (shown, matched) => `Showing ${shown} of ${matched}. Raise limit or narrow with due_only.`,
    },
    seal: {
      header: 'ARGUS · SEALED',
      owner_user: 'These words are yours.',
      owner_ai: 'Argus drafted these words. You have not yet made them yours.',
      sealed_label: 'Sealed',
      answers_label: 'Reality answers',
      days_out: (n) => `(${n} day${n === 1 ? '' : 's'} out)`,
      closing: [
        'This stays shut until then. What gets written next',
        'is not a grade. It is what actually happened.',
      ],
      footer: 'argus · anchor down ⚓',
    },
    wake: {
      header: 'ARGUS · WAKE',
      counts: (total, sealed, settled) => `decisions ${total} · sealed ${sealed} · settled ${settled}`,
      overdue_group: (n) => `past check-by (${n})`,
      overdue_hint: '← argus_settle',
      days_past: (n) => `${n}d past`,
      waiting_group: (n) => `waiting on reality (${n})`,
      answer_on: (date) => `due ${date}`,
      settled_group: (n, held, avoided, partial) => `settled (${n}): held ${held} · avoided ${avoided} · partial ${partial}`,
      more: (n) => `… (+${n})`,
      record_since: (date) => `on record since ${date}`,
    },
    receipt: {
      header: 'ARGUS · JUDGMENT RECEIPT',
      sealed_label: 'Sealed',
      settled_label: 'Settled',
      not_settled: 'Not yet settled',
      real_question: 'THE REAL QUESTION',
      unverified_assumption: 'THE UNVERIFIED ASSUMPTION',
      human_only: 'HUMAN-ONLY CALL',
      made_by_label: '…made by',
      made_by: 'Me. (not the model)',
      called_as: '…called as',
      basis_label: (v) => ({ judgment: 'judgment', luck: 'luck', mixed: 'a mix of both', unsure: 'not sure' })[v] ?? v,
      // A blank field, stated neutrally — "you skipped naming this" read as a
      // nag about the user's completeness on a receipt they wanted plain
      // (experience loop, settler: a zero-judgment surface must not grade even
      // the act of leaving a field empty).
      skipped: '— (none)',
      premises_note: (tracked, changed) =>
        `(+${tracked} premise(s) tracked · ${changed} changed at re-check · argus_recall view=premises)`,
      deferred_fact: (times, originallyDue) =>
        `Originally due ${originallyDue} · deferred ${times}×`,
      you_predicted: 'YOU PREDICTED',
      check_by: (date) => `(check-by ${date})`,
      what_happened: 'WHAT HAPPENED',
      verdict_line: 'AI VERDICT ON THIS DECISION ······················  NONE',
      closing: 'The model never graded you. Reality did.',
      footer: 'argus · seal → settle ⚓',
    },
    tools: {
      open_decision: {
        reason: {
          vent: 'This reads like something to say out loud, not a fork to force.',
          factual: 'This is a question with an answer, not a decision to open.',
          already_closed: 'You already made this call. Argus does not reopen it.',
          flat: 'The options are close to even. There is no load-bearing question to force here.',
          reversible_low_stakes: 'Cheap to undo and little at stake, so trying it is the test.',
          low_stakes: 'Little rides on this, so the steady move is to leave it as is.',
        },
        reason_fallback: 'There is no real fork to open here.',
        leave_coda: 'Leaving it as is stays a real option.',
        watch_exit: ' If you still want this kept, argus_watch (op=anchor) records it as a note, not an opened decision.',
        reconfirm: 'These signals look contradictory (high stakes yet easily reversible). Re-confirm stakes and reversibility before going further.',
        opened_with_crux: (crux) => `Opened. The one question that decides this: ${crux}`,
        opened_bare: 'Opened. Surface exactly ONE neutral crux question (a question, not a fork or a lean), then seal a falsifiable prediction.',
      },
      seal: {
        sealed: (predicate, checkBy) => `Sealed. "${predicate}" Check-by is ${checkBy}. Come back then with argus_settle to record how it turned out.`,
        nudge_assumption: ' If you want, you can name the key assumption this rests on. It\'s optional; naming it lets Argus re-check it against reality later.',
        synced: ' Synced to your account. You\'ll get an email when it comes due.',
        sync_failed: (reason) => ` (Account sync didn't go through. ${reason}. Your seal is safe locally, but the email reminder won't fire until it syncs. Try argus_sync later.)`,
      },
      settle: {
        settled: 'Settled. The receipt records what you predicted and what actually happened. No grade.',
        sync_failed: (reason) => ` (Account sync didn't go through. ${reason}. Your settlement is safe locally, but the account may keep listing this as due until it syncs. Try argus_sync later.)`,
        deferred: (newDate) => `Not settled — reality hasn't answered yet, so nothing was graded. I'll bring this back on ${newDate}.`,
        defer_dismissed: 'Set aside — this one no longer needs an answer. Nothing was graded.',
      },
      recheck: {
        baseline: (ref, finding, source, cadenceDays) => `Baseline recorded for P${ref}: "${finding}" (${source}). Worth another check in about ${cadenceDays} days.`,
        material: (ref, before, after, source) => `The fact under P${ref} changed: "${before}" → "${after}" (${source}). Whether to revisit this decision is your call.`,
        uncertain: (ref, reason) => `P${ref}: this change is too close to call automatically under the rule (${reason}). Only the fact the host confirmed is recorded. Whether to set a rule or leave it is your call.`,
        uncertain_heuristic_note: ' No rule was set for this premise, so a default heuristic was used. Pinning which move matters here would make it sharper.',
        unchanged: (ref, source) => `P${ref} unchanged (${source}).`,
      },
      amend: {
        amended: (predicate, checkBy) => `Amended. Now: "${predicate}" (check-by ${checkBy}).`,
      },
      dismiss: {
        dismissed: 'Dismissed. Closed without a verdict.',
      },
      watch: {
        anchored: "Noted for today. Tomorrow's check_in shows this line back to you as a question, never a grade.",
        captured: (kind) => `Captured (${kind}). It sits on the watch log. Promoting it to a decision premise is your call, whenever you want (argus_premises).`,
        listed: (anchors, captures) => `Watch log: ${anchors} anchor(s) · ${captures} capture(s).`,
      },
    },
  },
  ko: {
    ambient: {
      frag_contracts: (c) => `정산할 것 ${c}건`,
      frag_premises: (p) => `재확인할 전제 사실 ${p}건`,
      frag_open_questions: (q) => `다시 볼 미결 질문 ${q}건`,
      wrap: (frags) => ` 그나저나, ${frags.join(' · ')} 있습니다. 여유 될 때 보세요 (argus_check_in).`,
    },
    checkin: {
      nothing_due: '지금 확인할 차례가 된 것은 없습니다.',
      account_hint: ' 이 화면은 로컬 원장만 읽습니다. 계정에 봉인한 판단은 argus_sync로 볼 수 있습니다.',
      upcoming: (n, days) => ` ${days}일 안에 확인일이 오는 것이 ${n}건 있습니다. 참고용이고 아직 정산할 것은 아닙니다.`,
      due_contracts: (n) => `계약 ${n}건이 확인일을 지났습니다. 결과를 확인할 차례입니다 (argus_settle).`,
      anchor_mirror: (days, n, words) =>
        `봉인한 지 ${days}일이 지났고, 계약 ${n}건이 확인일을 넘겼습니다. 그때 당신은 이렇게 적었습니다: '${words}' 실제로 어떻게 됐는지만 적으면 됩니다 (argus_settle).`,
      due_premises: (n, staleDays, sinceAdd) =>
        `전제 사실 ${n}건을 다시 확인할 차례입니다${n === 1 && staleDays != null ? ` (마지막 확인 후 ${staleDays}일)` : n === 1 && staleDays === null && sinceAdd != null ? ` (적어둔 지 ${sinceAdd}일, 아직 첫 확인 전)` : ''} (argus_recheck).`,
      reconsider_one: (days, q) =>
        `${days === null ? '얼마 전' : `${days}일 전`}에 미결로 남겨둔 질문입니다: '${q}' 지금 답할 수 있으면 답하고, 그대로 열어두어도 괜찮습니다 (argus_premises).`,
      reconsider_more: (n) => `미결로 남겨둔 질문 ${n}건을 다시 볼 차례입니다 (argus_premises).`,
      dropped_lines: (n) =>
        ` 원장에서 읽지 못한 줄이 ${n}개 있습니다 (크래시 흔적일 수 있습니다). 기록은 추가만 하는 방식이라 나머지는 안전합니다. ledger.jsonl을 백업해 두세요.`,
      watch_mirror: (date, text) =>
        `${date}에 이렇게 적으셨습니다: '${text}' 그 뒤로 어떻게 됐나요? (오늘 적어둘 것이 있으면 argus_watch.)`,
      fleet_summary: (projects, due) =>
        ` 다른 프로젝트 ${projects}곳에 확인할 차례가 ${due}건 있습니다. 자세한 내용은 data.fleet에 있고, 정산은 각 프로젝트에서 합니다.`,
    },
    sync: {
      live_with_due: (total, due) =>
        `계정에 살아 있는 판단 ${total}개 중 ${due}개가 확인할 차례입니다. ` +
        '이 터미널에서 봉인한 것은 local_id로 argus_settle, 웹에서 봉인한 것은 웹 대시보드에서 정산하세요.',
      live_no_due: (total) => `계정에 살아 있는 판단 ${total}개. 확인할 차례가 된 것은 없습니다.`,
      settled_on_web: (n) => ` 웹에서 이미 정산한 것이 ${n}건 있습니다. argus_sync에 import_settlements:true를 주면 웹에 남긴 기록을 이 원장으로 그대로 옮겨옵니다 (직접 argus_settle로 적어도 됩니다).`,
      imported: (n) => ` 웹 정산 ${n}건을 이 원장으로 옮겨왔습니다. 당신이 웹에 적은 그대로입니다.`,
      truncation: (shown, matched) => `${matched}개 중 ${shown}개만 표시합니다. limit을 올리거나 due_only로 좁히세요.`,
    },
    seal: {
      header: 'ARGUS · 봉인',
      owner_user: '이 문장은 당신의 것입니다.',
      owner_ai: 'Argus가 초안한 문장입니다. 아직 당신이 확언하지 않았습니다.',
      sealed_label: '봉인',
      answers_label: '실제 결과',
      days_out: (n) => `(${n}일 뒤)`,
      closing: [
        '그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될 것은',
        '평가가 아니라 실제로 일어난 일입니다.',
      ],
      footer: 'argus · 닻 내림 ⚓',
    },
    wake: {
      header: 'ARGUS · 항적',
      counts: (total, sealed, settled) => `결정 ${total} · 봉인 중 ${sealed} · 정산 ${settled}`,
      overdue_group: (n) => `확인일 지남 (${n})`,
      overdue_hint: '← argus_settle',
      days_past: (n) => `${n}일 경과`,
      waiting_group: (n) => `결과를 기다리는 중 (${n})`,
      answer_on: (date) => `답 ${date}`,
      settled_group: (n, held, avoided, partial) => `정산됨 (${n}): held ${held} · avoided ${avoided} · partial ${partial}`,
      more: (n) => `… (+${n})`,
      record_since: (date) => `기록 시작 ${date} 부터`,
    },
    receipt: {
      header: 'ARGUS · 판단 영수증',
      sealed_label: '봉인',
      settled_label: '정산',
      not_settled: '아직 정산 전',
      real_question: '진짜 질문',
      unverified_assumption: '검증 안 된 전제',
      human_only: '사람만의 콜',
      made_by_label: '…내린 사람',
      made_by: '나. (모델이 아니라)',
      called_as: '…콜한 내용',
      basis_label: (v) => ({ judgment: '판단', luck: '운', mixed: '반반', unsure: '모르겠음' })[v] ?? v,
      // 빈 칸을 사실 그대로. "이름 붙이지 않고 넘어갔습니다"는 사용자의 완성도를
      // 지적하는 잔소리로 읽혔다 (experience loop, settler).
      skipped: '— (없음)',
      premises_note: (tracked, changed) =>
        `(추적한 전제 ${tracked}건 · 재확인에서 바뀐 것 ${changed}건 · argus_recall view=premises)`,
      deferred_fact: (times, originallyDue) =>
        `원래 확인일 ${originallyDue} · ${times}번 미룸`,
      you_predicted: '당신의 예측',
      check_by: (date) => `(확인일 ${date})`,
      what_happened: '실제로 일어난 일',
      // 브랜드 DNA — 웹 OG 이미지와 동일하게 이 줄만은 영문 유지 (§9.3)
      verdict_line: 'AI VERDICT ON THIS DECISION ······················  NONE',
      closing: '모델은 당신을 채점하지 않았습니다. 현실이 답했습니다.',
      footer: 'argus · 봉인 → 정산 ⚓',
    },
    tools: {
      open_decision: {
        reason: {
          vent: '이건 소리 내어 말할 일이지, 억지로 만들 갈림길이 아닙니다.',
          factual: '이건 답이 있는 질문이지, 열어둘 결정이 아닙니다.',
          already_closed: '이미 내린 결정입니다. Argus는 이걸 다시 열지 않습니다.',
          flat: '선택지가 거의 대등합니다. 억지로 만들 핵심 질문이 없습니다.',
          reversible_low_stakes: '되돌리기 쉽고 걸린 것도 적습니다. 직접 해보는 것이 곧 검증입니다.',
          low_stakes: '걸린 것이 별로 없습니다. 그대로 두는 편이 무난합니다.',
        },
        reason_fallback: '여기서 지어낼 갈림길은 없습니다.',
        leave_coda: '그대로 두는 것도 여전히 진짜 선택지입니다.',
        watch_exit: ' 그래도 남겨두고 싶으면 argus_watch(op=anchor)로 메모만 적어둘 수 있습니다. 결정을 여는 것이 아니라 메모입니다.',
        reconfirm: '신호가 서로 어긋납니다 (걸린 것은 큰데 되돌리기는 쉽습니다). 더 나아가기 전에 stakes와 reversibility를 다시 확인하세요.',
        opened_with_crux: (crux) => `열었습니다. 이걸 가르는 단 하나의 질문: ${crux}`,
        opened_bare: '열었습니다. 중립적인 핵심 질문 딱 하나만 꺼내세요(갈림길도 기울임도 아닌 질문). 그다음 반증 가능한 예측을 봉인하세요.',
      },
      seal: {
        sealed: (predicate, checkBy) => `봉인했습니다. "${predicate}" 확인일은 ${checkBy}입니다. 그날 argus_settle로 돌아와 실제로 어땠는지 적으세요.`,
        nudge_assumption: ' 이 결정이 기댄 핵심 전제를 적어두고 싶으면 지금 적을 수 있어요. 선택이고, 적어두면 나중에 현실과 대조해 다시 확인해 드립니다.',
        synced: ' 계정에 동기화했습니다. 확인일이 오면 이메일로 알려드립니다.',
        sync_failed: (reason) => ` (계정 동기화가 안 됐습니다. ${reason}. 봉인은 로컬에 안전합니다. 동기화되기 전까지는 이메일 알림이 오지 않습니다. 나중에 argus_sync를 시도하세요.)`,
      },
      settle: {
        settled: '정산했습니다. 영수증에는 당신이 예측한 것과 실제로 일어난 일이 남습니다. 평가는 없습니다.',
        sync_failed: (reason) => ` (계정 동기화가 안 됐습니다. ${reason}. 정산은 로컬에 안전합니다. 동기화되기 전까지 계정은 이걸 계속 "확인 필요"로 표시할 수 있습니다. 나중에 argus_sync를 시도하세요.)`,
        deferred: (newDate) => `아직 정산하지 않았습니다 — 현실이 아직 답하지 않았으니 평가한 것도 없습니다. ${newDate}에 다시 가져오겠습니다.`,
        defer_dismissed: '접어뒀습니다 — 이건 이제 답이 필요 없어요. 평가한 것은 없습니다.',
      },
      recheck: {
        baseline: (ref, finding, source, cadenceDays) => `P${ref} 기준값을 기록했습니다: "${finding}" (${source}). ${cadenceDays}일 뒤에 다시 확인하길 권합니다.`,
        // 어휘 1벌 (공정 3 상환): 웹 T2 이메일(companion-brief)과 같은 문장 —
        // "결정을 다시 볼지는 당신의 몫" — 표면 존대만 다르고 어휘는 동일하다.
        material: (ref, before, after, source) => `P${ref}이 기댄 사실이 바뀌었습니다: "${before}" → "${after}" (${source}). 결정을 다시 볼지는 당신의 몫입니다.`,
        uncertain: (ref, reason) => `P${ref}: 규칙상 자동으로 판정하기 애매한 변화입니다 (${reason}). host가 확인한 사실만 적어두었습니다. 규칙을 정할지 그냥 둘지는 당신의 몫입니다.`,
        uncertain_heuristic_note: ' 규칙을 따로 정하지 않아 기본값(휴리스틱)으로 판단했습니다. 이 전제에서 어떤 변화가 중요한지 정해두면 더 정확해집니다.',
        unchanged: (ref, source) => `P${ref}은 그대로입니다 (${source}).`,
      },
      amend: {
        amended: (predicate, checkBy) => `수정했습니다. 이제: "${predicate}" (확인일 ${checkBy}).`,
      },
      dismiss: {
        dismissed: '접었습니다. 평결 없이 닫혔습니다.',
      },
      watch: {
        anchored: '오늘 적어두었습니다. 내일 check_in이 이 문장을 질문으로 다시 보여줍니다. 평가는 없습니다.',
        captured: (kind) => `기록했습니다 (${kind}). 당직 일지에 남아 있고, 결정의 전제로 올릴지는 당신이 정하면 됩니다 (argus_premises).`,
        listed: (anchors, captures) => `당직 일지: 항로 ${anchors}건 · 기록 ${captures}건.`,
      },
    },
  },
};

/** Convenience: resolve the dictionary for a dir in one call. */
export function surfacesFor(argusDir?: string | null): SurfaceStrings {
  return SURFACES[surfaceLocale(argusDir)];
}
