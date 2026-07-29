import fs from 'fs';
import { configPath } from './layout.js';
import { detectLocaleFromText, osLocaleHint } from './locale.js';

/**
 * surfaces.ts — the ONE locale brain for user-facing surface strings
 * (P1-E1, polish audit 2026-07-03; 11 S5 = 12 P2-4 merged).
 *
 * Before this file the `locale` config was a dead switch: argus_settings
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
 *
 * Locale resolution is CONFIG-ONLY and deterministic: argus_settings seeds
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
    if (reason === 'credential_expired') return '계정 연결이 만료됐습니다. 터미널에서 `npx argus-decision-mcp connect`로 다시 연결하세요 (플러그인은 /argus:connect)';
    if (reason === 'credential_unreadable') return '계정 연결 파일을 읽지 못했습니다. 터미널에서 `npx argus-decision-mcp connect`로 다시 연결하세요 (플러그인은 /argus:connect)';
    if (reason === 'insecure_api_url') return 'API 주소가 https가 아니라 토큰을 보내지 않았습니다';
    if (reason === 'network') return '네트워크에 닿지 못했습니다';
    if (http) return http[1] === '401' || http[1] === '403'
      ? `토큰이 거부됐습니다 (HTTP ${http[1]}). 만료됐을 수 있으니 웹 설정에서 새 토큰을 발급하세요`
      : `서버가 ${http[1]}로 응답했습니다`;
    return reason;
  }
  if (reason === 'bad_token_format') return 'the token looks malformed (it should start with argus_pat_)';
  if (reason === 'credential_expired') return 'the account connection has expired; reconnect by running `npx argus-decision-mcp connect` (plugin: /argus:connect)';
  if (reason === 'credential_unreadable') return 'the account connection file could not be read; reconnect by running `npx argus-decision-mcp connect` (plugin: /argus:connect)';
  if (reason === 'insecure_api_url') return 'the API URL is not https, so the token was not sent';
  if (reason === 'network') return 'the network was unreachable';
  if (http) return http[1] === '401' || http[1] === '403'
    ? `the token was rejected (HTTP ${http[1]}); it may be expired, so issue a new one in web Settings`
    : `the server answered ${http[1]}`;
  return reason;
}

/** The explicit config locale, or null when no config.yaml declares one.
 *  Distinct from surfaceLocale so the response-locale chain can tell an
 *  EXPLICIT `locale: en` (config wins, never overridden) apart from the
 *  bare 'en' base voice (a mere default, which text detection may override).
 *  Exported for the locale-mismatch once-note (§9.7 O1), which needs to know
 *  whether a pin EXISTS — not what the resolved voice is. */
export function configLocale(argusDir?: string | null): SurfaceLocale | null {
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
  // One probe, one rule — the env→Intl chain used to be duplicated here and
  // in detectLocale, drifting independently (§9.7 O1 방1).
  return osLocaleHint();
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
    /** first-run on-ramp: shown when the ledger is EMPTY (never recorded), so a
     *  brand-new user isn't stranded on the same "nothing due" a veteran sees. */
    first_run: string;
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
    /** sealed-but-undated disclosure: a foreign-written seal with no valid
     *  check_by can never come due, so it would be silently stuck. Name it. */
    undated_seals: (ids: string[]) => string;
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
    /** The account marked these `unclear` — reality has not answered. That is a
     *  deferral, not a settlement, so nothing is imported and they stay due here.
     *  Named honestly instead of silently closing them (the sync-door twin of the
     *  still_pending → defer rule). */
    unclear_on_web: (n: number) => string;
    /** Reverse reconciliation: local changes the account never received, now sent.
     *  Until this existed, a settle/dismiss whose one push failed left the account
     *  emailing a decision the user had already closed. */
    pushed_up: (n: number) => string;
    push_up_failed: (n: number) => string;
    import_failed: (n: number) => string;
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
    settled_group: (n: number, held: number, avoided: number, partial: number, missed: number) => string;
    /** the settled row's outcome word — the user's own pick, localized. A raw
     *  enum ("missed"/"held") in a Korean box was a machine token leak. */
    outcome_label: (outcome: string) => string;
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
    /** Right-aligned date tags in the two block headers: "… 2026-07-20 저장" and
     *  "… 2026-07-25 확인". Redesign (founder-approved): predict/reality are blocks,
     *  not a cramped two-date top row. */
    saved_suffix: string;
    settled_suffix: string;
    /** One standalone ownership line ("이 판단을 내린 사람: 나 (모델 아님)") that
     *  replaces the old "…내린 사람  나. (모델이 아니라)" label+value with the ellipsis. */
    made_by_line: string;
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
    /** When real question + assumption + human-only call are ALL skipped and no
     *  premise is tracked, the three per-section "(none)" rows collapse into
     *  this ONE neutral line — a data-minimal settle should not render a
     *  receipt that is mostly placeholders. */
    nothing_recorded: string;
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
      /** The product-level disclosure of the irreducible residual lean (spine
       *  mirror clause): naming the load-bearing question faintly points at the
       *  flip. A KNOWN-LIMIT statement, never a verdict — rides in data. */
      lean_disclosure: string;
    };
    seal: {
      /** the core confirmation: quote + check-by + come-back handle. */
      sealed: (predicate: string, checkBy: string) => string;
      /** ai_surfaced predicate saved on a host WITHOUT a confirm picker: the
       *  surface must say it is a draft awaiting the user's ok, never imply the
       *  user already affirmed it (honest authorship). */
      sealed_draft: (predicate: string, checkBy: string) => string;
      /** appended when the assumption was skipped (recorded, not hidden). */
      nudge_assumption: string;
      /** account-sync voice (3-state): success speaks, no_token stays silent. */
      synced: string;
      sync_failed: (reason: string) => string;
    };
    settle: {
      settled: (outcome: 'held' | 'avoided' | 'partial' | 'missed', predicate: string) => string;
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
      /** The account still holds the OLD date, so its email would arrive on the
       *  wrong day. Silence here would be a lie by omission. */
      sync_failed: (reason: string) => string;
      /** A wording-only amend is never pushed (the account has no retitle verb,
       *  and a re-seal would overwrite premises edited on the web). The local
       *  record is right and the account is stale — say which is which. */
      wording_not_pushed: string;
    };
    dismiss: {
      dismissed: string;
      /** The account still thinks this decision is live and will keep emailing it. */
      sync_failed: (reason: string) => string;
    };
    /** 캡처 후보 정리 (P6) — 목록·연결·정리 확인. 사실+손잡이만, 무권유. */
    candidates: {
      none: string;
      header: (active: number, expired: number) => string;
      item: (id: string, kind: string, grade: string, quote: string) => string;
      promoted: (candidateId: string, decisionId: string) => string;
      dropped: (candidateId: string) => string;
      snoozed: (candidateId: string, until: string) => string;
      quote_note: string;
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
      frag_contracts: (c) => `${c} result(s) to record`,
      frag_premises: (p) => `${p} premise fact(s) to re-check`,
      frag_open_questions: (q) => `${q} open question(s) to reconsider`,
      wrap: (frags) => ` By the way, you have ${frags.join(' · ')} when you have a moment (argus_check_in).`,
    },
    checkin: {
      nothing_due: 'Nothing is due right now.',
      // Three sentences, three lines. As one run-on it was 144 characters of
      // chrome — the Korean equivalent is three short lines, and this is the
      // FIRST thing an English user ever reads (2026-07-28 surface sweep).
      first_run: 'Just talk through a decision you\'re weighing.\nI\'ll follow along, and if something is worth checking later I\'ll note it.\nNothing is tracked yet.',
      account_hint: ' This screen reads the local decision record only. Predictions saved in your account show up with argus_settings action=sync.',
      upcoming: (n, days) => ` ${n} coming due within ${days} day(s). Informational; no result is due yet.`,
      due_contracts: (n) => `${n} saved prediction(s) past check-by. Tell me how each turned out and I'll record it.`,
      anchor_mirror: (days, n, words) =>
        `${days} day(s) since you saved this, and ${n} prediction(s) are past check-by. Back then you wrote: '${words}' All that's left is to record what actually happened (argus_resolve).`,
      due_premises: (n, staleDays, sinceAdd) =>
        `${n} premise fact(s) due for a re-check${n === 1 && staleDays != null ? ` (last checked ${staleDays}d ago)` : n === 1 && staleDays === null && sinceAdd != null ? ` (added ${sinceAdd}d ago, first check still open)` : ''} (argus_capture action=update_fact).`,
      reconsider_one: (days, q) =>
        `${days === null ? 'You left this open a while ago' : `You left this open ${days} day(s) ago`}: '${q}' Answer it now if you can, or leave it open a while longer. Either is fine (argus_capture).`,
      reconsider_more: (n) => `${n} open question(s) you left unresolved are up for another look (argus_capture).`,
      dropped_lines: (n) =>
        ` ${n} ledger line(s) could not be read (possibly a crash artifact). The record is append-only, so the rest is intact. Keep a backup of ledger.jsonl.`,
      undated_seals: (ids) =>
        ` ${ids.length} saved prediction(s) have no valid check-by date, so they can't come due on their own: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ` (+${ids.length - 5} more)` : ''}. Re-save with a date, or settle directly with argus_resolve.`,
      watch_mirror: (date, text) =>
        `On ${date} you wrote: '${text}' So how did it go?`,
      fleet_summary: (projects, due) =>
        ` ${due} due across ${projects} other project(s). Details are in data.fleet; record each result in its own project.`,
    },
    sync: {
      live_with_due: (total, due) =>
        `${total} live prediction(s) in your account, ${due} past check-by. ` +
        'For terminal-saved predictions, record the result here with argus_resolve and local_id. For web-saved predictions, use the web dashboard.',
      live_no_due: (total) => `${total} live prediction(s) in your account. Nothing past its check-by.`,
      settled_on_web: (n) => ` ${n} result(s) already recorded on the web. Use argus_settings action=sync with import_settlements:true to mirror them here, or record them with argus_resolve.`,
      unclear_on_web: (n) => ` ${n} marked unclear in your account. Reality hasn't answered, so no result was imported. They stay due here until their results are recorded.`,
      pushed_up: (n) => ` Sent ${n} change(s) your account had missed: results recorded, closed, or rescheduled here. It will stop nudging what you already handled.`,
      push_up_failed: (n) => ` ${n} local change(s) still haven't reached your account, so it may keep emailing them. Your record here stands; run argus_settings action=sync again when you're online.`,
      import_failed: (n) => ` ${n} settlement(s) recorded on the web could NOT be written here (the records folder refused the write). They are still on the web, nothing was lost. Check that the .argus folder is writable, then run argus_settings action=sync again.`,
      imported: (n) => ` Mirrored ${n} web result(s) into this ledger, in your own recorded words.`,
      truncation: (shown, matched) => `Showing ${shown} of ${matched}. Raise limit or narrow with due_only.`,
    },
    seal: {
      header: 'ARGUS · PREDICTION SAVED',
      owner_user: 'These words are yours.',
      owner_ai: 'Argus drafted these words. You have not yet made them yours.',
      sealed_label: 'Saved prediction',
      answers_label: 'Reality answers',
      days_out: (n) => `(${n} day${n === 1 ? '' : 's'} out)`,
      closing: [
        'This prediction stays unchanged until then. What gets',
        'written next is not a grade. It is what actually happened.',
      ],
      footer: 'argus · prediction saved → result recorded ⚓',
    },
    wake: {
      // The logbook: what a ship keeps of its voyage — dates, positions, what
      // happened. Identity without ceremony (창업자 2026-07-27: 터미널에도
      // 항해 정체성을, 과하지 않게).
      header: 'ARGUS · LOGBOOK',
      counts: (total, sealed, settled) => `decisions ${total} · awaiting check ${sealed} · results recorded ${settled}`,
      overdue_group: (n) => `! past check-by (${n})`,
      overdue_hint: '← argus_resolve',
      days_past: (n) => `${n}d past`,
      waiting_group: (n) => `~ at sea · waiting for the outcome (${n})`,
      answer_on: (date) => `due ${date}`,
      settled_group: (n) => `⚓ anchored · answered by reality (${n})`,
      outcome_label: (o) => ({ held: 'held', avoided: 'avoided', partial: 'partial', missed: 'missed', still_pending: 'pending' })[o] ?? o,
      more: (n) => `… (+${n})`,
      record_since: (date) => `logbook since ${date}`,
    },
    receipt: {
      header: 'ARGUS · JUDGMENT RECEIPT',
      sealed_label: 'Prediction saved',
      settled_label: 'Result',
      not_settled: 'not recorded yet',
      saved_suffix: 'saved',
      settled_suffix: 'recorded',
      made_by_line: 'This call was mine. Not the model\'s.',
      real_question: 'THE REAL QUESTION',
      unverified_assumption: 'THE UNVERIFIED ASSUMPTION',
      human_only: 'HUMAN-ONLY CALL',
      made_by_label: '…made by',
      made_by: 'Me. (not the model)',
      called_as: 'Looking back,',
      basis_label: (v) => ({ judgment: 'mostly my judgment', luck: 'mostly luck', mixed: 'a mix of both', unsure: 'not sure' })[v] ?? v,
      // A blank field, stated neutrally — "you skipped naming this" read as a
      // nag about the user's completeness on a receipt they wanted plain
      // (experience loop, settler: a zero-judgment surface must not grade even
      // the act of leaving a field empty).
      skipped: '— (none)',
      nothing_recorded: 'No question or premise was recorded with this decision.',
      premises_note: (tracked, changed) =>
        `(+${tracked} ${tracked === 1 ? 'premise' : 'premises'} tracked · ${changed} changed at re-check)`,
      deferred_fact: (times, originallyDue) =>
        `Originally due ${originallyDue} · deferred ${times}×`,
      you_predicted: 'What I predicted',
      check_by: (date) => `check-by ${date}`,
      what_happened: 'What actually happened',
      verdict_line: 'AI VERDICT ON THIS DECISION ······················  NONE',
      closing: 'The model never graded you. Reality did.',
      footer: 'argus · prediction saved → result recorded ⚓',
    },
    tools: {
      open_decision: {
        reason: {
          vent: 'This reads like something to say out loud, not a fork to force.',
          factual: 'This is a question with an answer, not a decision to open.',
          already_closed: 'You already made this call. Argus does not reopen it.',
          flat: 'The options are close to even. There is no load-bearing question to force here.',
          reversible_low_stakes: 'Cheap to undo and little at stake.',
          low_stakes: 'Little rides on this, so the steady move is to leave it as is.',
        },
        reason_fallback: 'There is no real fork to open here.',
        leave_coda: 'Leaving it as is stays a real option.',
        watch_exit: ' Leaving it unrecorded is fine.',
        reconfirm: 'These signals look contradictory (high stakes yet easily reversible). Re-confirm stakes and reversibility before going further.',
        opened_with_crux: (crux) => `Opened. The one question that decides this: ${crux}`,
        opened_bare: 'This decision is on record.',
        lean_disclosure: 'Naming the load-bearing question points faintly at the flip; that residual lean is a known limit, not a verdict.',
      },
      seal: {
        // Two lines. The quoted prediction ran straight into "Check-by is …"
        // with no break, so the confirmation of the thing the user just
        // committed to was buried mid-paragraph (2026-07-28 surface sweep).
        sealed: (predicate, checkBy) => `Prediction saved: "${predicate}"\nCheck-by is ${checkBy}. I'll bring it back that day to see how it went.`,
        sealed_draft: (predicate, checkBy) => `I drafted this prediction for you: "${predicate}" Check-by is ${checkBy}. Keep it as it stands, or tell me how to reword it.`,
        nudge_assumption: '',
        synced: ' Synced to your account. You\'ll get an email when it comes due.',
        sync_failed: (reason) => ` (Account sync didn't go through. ${reason}. Your prediction is safe locally, but the email reminder won't fire until it syncs. Try argus_settings action=sync later.)`,
      },
      settle: {
        settled: (outcome, predicate) => `Result recorded: ${outcome}.${predicate ? ` (You predicted: "${predicate}".)` : ''} The receipt keeps your prediction beside what actually happened. No grade.`,
        sync_failed: (reason) => ` (Account sync didn't go through. ${reason}. Your result is safe locally, but the account may keep listing this as due until it syncs. Try argus_settings action=sync later.)`,
        deferred: (newDate) => `No result recorded. Reality hasn't answered yet, so nothing was graded. I'll bring this back on ${newDate}.`,
        defer_dismissed: 'Set aside. This one no longer needs an answer. Nothing was graded.',
      },
      recheck: {
        baseline: (ref, finding, source, cadenceDays) => `Baseline recorded for P${ref}: "${finding}" (${source}). Worth another check in about ${cadenceDays} days.`,
        material: (ref, before, after, source) => `The fact under P${ref} changed: "${before}" → "${after}" (${source}). Whether to revisit this decision is your call.`,
        uncertain: (ref, reason) => `P${ref}: this change is too close to call automatically under the rule (${reason}). Only the fact your assistant confirmed is recorded. Whether to set a rule or leave it is your call.`,
        uncertain_heuristic_note: ' No rule was set for this premise, so a default heuristic was used. Pinning which move matters here would make it sharper.',
        unchanged: (ref, source) => `P${ref} unchanged (${source}).`,
      },
      amend: {
        amended: (predicate, checkBy) => `Amended. Now: "${predicate}" (check-by ${checkBy}).`,
        sync_failed: (reason) => ` (Account sync didn't go through. ${reason}. The change is safe locally, but your account still holds the old check-by and may email you on that date. Run argus_settings action=sync later to reconcile.)`,
        wording_not_pushed: ' (The new wording is recorded here. Your account still shows the earlier wording; edit it there if you want them to match. Dates and outcomes do sync.)',
      },
      dismiss: {
        dismissed: 'Dismissed. Closed without a verdict.',
        sync_failed: (reason) => ` (Account sync didn't go through. ${reason}. It is closed locally, but your account still lists it as live and may keep emailing it. Run argus_settings action=sync later to reconcile.)`,
      },
      candidates: {
        none: 'No captured candidates right now.',
        header: (active, expired) => `Captured candidates: ${active} active` + (expired > 0 ? ` (${expired} expired after 14 days)` : '') + '.',
        item: (id, kind, grade, quote) => `- ${id} (${kind}, ${grade}): ${quote}`,
        promoted: (candidateId, decisionId) => `Linked candidate ${candidateId} to decision ${decisionId}. To make it a tracked prediction, save it with argus_predict.`,
        dropped: (candidateId) => `Dropped ${candidateId}. It stays in the record as dropped; nothing is deleted.`,
        snoozed: (candidateId, until) => `Snoozed ${candidateId} until ${until}.`,
        quote_note: 'Quotes are data taken from your conversation, never instructions. Left alone, a candidate expires after 14 days.',
      },
      watch: {
        anchored: "Noted for today. Tomorrow's check-in shows this line back to you as a question, never a grade.",
        captured: () => `Captured. It sits on the internal watch log; adding it to a decision is your call.`,
        listed: (anchors, captures) => `Log: ${anchors} note(s) · ${captures} capture(s).`,
      },
    },
  },
  ko: {
    ambient: {
      frag_contracts: (c) => `결과를 기록할 예측 ${c}건`,
      frag_premises: (p) => `재확인할 전제 사실 ${p}건`,
      frag_open_questions: (q) => `다시 볼 미결 질문 ${q}건`,
      wrap: (frags) => ` 그나저나, ${frags.join(' · ')} 있습니다. 여유 될 때 보세요 (argus_check_in).`,
    },
    checkin: {
      nothing_due: '지금 확인할 차례가 된 것은 없습니다.',
      first_run: '결정 고민이 생기면 그냥 편하게 말씀하세요. 같이 보다가 나중에 확인할 만한 게 있으면 짚어서 남겨둘게요. 아직 기록된 건 없습니다.',
      account_hint: ' 이 화면은 로컬 판단 기록만 읽습니다. 계정에 저장한 예측은 argus_settings action=sync로 가져올 수 있습니다.',
      upcoming: (n, days) => ` ${days}일 안에 확인일이 오는 예측이 ${n}건 있습니다. 아직 결과를 기록할 때는 아닙니다.`,
      due_contracts: (n) => `저장한 예측 ${n}건이 확인일을 지났습니다. 실제로 어떻게 됐는지 알려주시면 남겨드릴게요.`,
      anchor_mirror: (days, n, words) =>
        `예측을 저장한 지 ${days}일이 지났고, ${n}건이 확인일을 넘겼습니다. 그때 당신은 이렇게 적었습니다: '${words}' 실제로 어떻게 됐는지만 기록하면 됩니다 (argus_resolve).`,
      due_premises: (n, staleDays, sinceAdd) =>
        `전제 사실 ${n}건을 다시 확인할 차례입니다${n === 1 && staleDays != null ? ` (마지막 확인 후 ${staleDays}일)` : n === 1 && staleDays === null && sinceAdd != null ? ` (적어둔 지 ${sinceAdd}일, 아직 첫 확인 전)` : ''} (argus_capture action=update_fact).`,
      reconsider_one: (days, q) =>
        `${days === null ? '얼마 전' : `${days}일 전`}에 미결로 남겨둔 질문입니다: '${q}' 지금 답할 수 있으면 답하고, 그대로 열어두어도 괜찮습니다 (argus_capture).`,
      reconsider_more: (n) => `미결로 남겨둔 질문 ${n}건을 다시 볼 차례입니다 (argus_capture).`,
      dropped_lines: (n) =>
        ` 판단 기록에서 읽지 못한 줄이 ${n}개 있습니다 (크래시 흔적일 수 있습니다). 기록은 추가만 하는 방식이라 나머지는 안전합니다. ledger.jsonl을 백업해 두세요.`,
      undated_seals: (ids) =>
        ` 저장된 예측 ${ids.length}건에 확인일이 없어, 저절로 확인일이 오지 못합니다: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ` 외 ${ids.length - 5}건` : ''}. 확인일을 넣어 다시 저장하거나, argus_resolve로 바로 결과를 기록하세요.`,
      watch_mirror: (date, text) =>
        `${date}에 이렇게 적으셨습니다: '${text}' 그 뒤로 어떻게 됐나요?`,
      fleet_summary: (projects, due) =>
        ` 다른 프로젝트 ${projects}곳에 확인할 차례가 ${due}건 있습니다. 자세한 내용은 data.fleet에 있고, 결과는 각 프로젝트에서 기록합니다.`,
    },
    sync: {
      live_with_due: (total, due) =>
        `계정에 살아 있는 예측 ${total}개 중 ${due}개가 확인할 차례입니다. ` +
        '터미널에서 저장한 예측은 local_id와 argus_resolve로 결과를 기록하고, 웹에서 저장한 예측은 웹 대시보드에서 기록하세요.',
      live_no_due: (total) => `계정에 살아 있는 예측 ${total}개. 확인할 차례가 된 것은 없습니다.`,
      settled_on_web: (n) => ` 웹에서 이미 결과를 기록한 예측이 ${n}건 있습니다. argus_settings action=sync에 import_settlements:true를 주면 웹 기록을 로컬 판단 기록으로 가져옵니다 (argus_resolve로 직접 적어도 됩니다).`,
      unclear_on_web: (n) => ` 계정에서 ${n}건이 "불분명"으로 표시돼 있습니다. 현실이 아직 답하지 않아 가져오지 않았습니다. 결과가 기록되기 전까지 여기서는 계속 확인 대상입니다.`,
      pushed_up: (n) => ` 계정이 못 받은 변경 ${n}건을 올려보냈습니다. 결과를 기록했거나, 접었거나, 날짜를 옮긴 것들입니다. 이미 처리한 건에 대해 더는 알림이 오지 않습니다.`,
      push_up_failed: (n) => ` 로컬 변경 ${n}건이 아직 계정에 닿지 않았습니다. 그 건들에 대해 메일이 계속 올 수 있습니다. 여기 기록은 그대로 유효하니, 온라인일 때 argus_settings action=sync를 다시 실행하세요.`,
      import_failed: (n) => ` 웹에 기록된 정산 ${n}건을 여기로 옮기지 못했습니다 (기록 폴더가 쓰기를 거부했습니다). 웹에는 그대로 있습니다. 잃은 것은 없습니다. .argus 폴더에 쓸 수 있는지 확인한 뒤 argus_settings action=sync를 다시 실행하세요.`,
      imported: (n) => ` 웹에서 기록한 결과 ${n}건을 로컬 판단 기록으로 가져왔습니다. 당신이 적은 그대로입니다.`,
      truncation: (shown, matched) => `${matched}개 중 ${shown}개만 표시합니다. limit을 올리거나 due_only로 좁히세요.`,
    },
    seal: {
      header: 'ARGUS · 예측 저장',
      owner_user: '이 문장은 당신의 것입니다.',
      owner_ai: 'Argus가 초안한 문장입니다. 아직 당신이 확언하지 않았습니다.',
      sealed_label: '저장한 예측',
      answers_label: '확인일',
      days_out: (n) => `(${n}일 뒤)`,
      closing: [
        '확인일까지 이 예측은 바뀌지 않습니다. 그날 여기 기록될 것은',
        '평가가 아니라 실제로 일어난 일입니다.',
      ],
      footer: 'argus · 예측 저장 → 실제 결과 기록 ⚓',
    },
    wake: {
      header: 'ARGUS · 항해일지',
      // "예측 저장 0"은 정산이 끝나면 0으로 줄어 "저장한 적 없음"처럼 읽혔다
      // (1.4.6 재진단): 이 칸의 의미는 '지금 확인일을 기다리는 것'이다.
      counts: (total, sealed, settled) => `결정 ${total} · 확인 대기 ${sealed} · 결과 기록 ${settled}`,
      overdue_group: (n) => `! 확인일 지남 (${n})`,
      overdue_hint: '← argus_resolve',
      days_past: (n) => `${n}일 경과`,
      waiting_group: (n) => `~ 바다 위 · 결과를 기다리는 중 (${n})`,
      answer_on: (date) => `확인 ${date}`,
      settled_group: (n) => `⚓ 닻 내린 기록 · 현실이 답함 (${n})`,
      outcome_label: (o) => ({ held: '예측대로', avoided: '걱정 피함', partial: '일부', missed: '빗나감', still_pending: '대기' })[o] ?? o,
      more: (n) => `… (+${n})`,
      record_since: (date) => `${date}부터 항해 중`,
    },
    receipt: {
      header: 'ARGUS · 판단 영수증',
      sealed_label: '저장한 예측',
      settled_label: '실제 결과',
      not_settled: '기록 전',
      saved_suffix: '저장',
      settled_suffix: '확인',
      made_by_line: '이 판단을 내린 사람: 나 (모델 아님)',
      real_question: '진짜 질문',
      unverified_assumption: '검증 안 된 전제',
      human_only: '사람만의 판단',
      made_by_label: '…내린 사람',
      made_by: '나. (모델이 아니라)',
      called_as: '돌아보니',
      basis_label: (v) => ({ judgment: '판단이 컸다', luck: '운이 컸다', mixed: '판단 반 운 반', unsure: '잘 모르겠다' })[v] ?? v,
      // 빈 칸을 사실 그대로. "이름 붙이지 않고 넘어갔습니다"는 사용자의 완성도를
      // 지적하는 잔소리로 읽혔다 (experience loop, settler).
      skipped: '— (없음)',
      nothing_recorded: '이 결정에 함께 적어둔 질문이나 전제는 없습니다.',
      premises_note: (tracked, changed) =>
        `(추적한 전제 ${tracked}건 · 재확인에서 바뀐 것 ${changed}건)`,
      deferred_fact: (times, originallyDue) =>
        `원래 확인일 ${originallyDue} · ${times}번 미룸`,
      you_predicted: '내가 예측한 것',
      check_by: (date) => `확인일 ${date}`,
      what_happened: '실제로 일어난 일',
      // 브랜드 DNA — 웹 OG 이미지와 동일하게 이 줄만은 영문 유지 (§9.3)
      verdict_line: 'AI VERDICT ON THIS DECISION ······················  NONE',
      closing: '모델은 당신을 채점하지 않았습니다. 현실이 답했습니다.',
      footer: 'argus · 예측 저장 → 실제 결과 기록 ⚓',
    },
    tools: {
      open_decision: {
        reason: {
          vent: '이건 소리 내어 말할 일이지, 억지로 결정으로 만들 일이 아닙니다.',
          factual: '이건 답이 있는 질문이지, 열어둘 결정이 아닙니다.',
          already_closed: '이미 내린 결정입니다. Argus는 이걸 다시 열지 않습니다.',
          flat: '선택지가 거의 대등합니다. 억지로 만들 핵심 질문이 없습니다.',
          reversible_low_stakes: '되돌리기 쉽고 크게 걸린 것도 없는 결정입니다.',
          low_stakes: '걸린 것이 별로 없습니다. 그대로 두는 편이 무난합니다.',
        },
        reason_fallback: '여기서 억지로 지어낼 결정은 없습니다.',
        leave_coda: '그대로 두는 것도 여전히 진짜 선택지입니다.',
        watch_exit: ' 기록하지 않고 그대로 두어도 괜찮습니다.',
        reconfirm: '신호가 서로 어긋납니다 (걸린 것은 큰데 되돌리기는 쉽습니다). 더 나아가기 전에 이 둘을 다시 짚어 보세요.',
        opened_with_crux: (crux) => `열었습니다. 이 결정을 좌우하는 단 하나의 질문: ${crux}`,
        opened_bare: '이 결정, 기록해뒀습니다.',
        lean_disclosure: '핵심 질문을 짚는 것 자체가 뒤집히는 쪽을 희미하게 가리킬 수 있습니다. 그렇게 남는 쏠림은 알려진 한계일 뿐, 이 결정에 대한 평가가 아닙니다.',
      },
      seal: {
        sealed: (predicate, checkBy) => `예측을 저장했습니다. "${predicate}" 확인일은 ${checkBy}입니다. 그날 다시 꺼내서 어떻게 됐는지 같이 볼게요.`,
        sealed_draft: (predicate, checkBy) => `이렇게 예측을 적어봤습니다: "${predicate}" 확인일은 ${checkBy}입니다. 이대로 두셔도 되고, 고칠 문장이 있으면 말씀해 주세요.`,
        nudge_assumption: '',
        synced: ' 계정에 동기화했습니다. 확인일이 오면 이메일로 알려드립니다.',
        sync_failed: (reason) => ` (계정 동기화가 안 됐습니다. ${reason}. 예측은 로컬에 안전합니다. 동기화되기 전까지는 이메일 알림이 오지 않습니다. 나중에 argus_settings action=sync를 시도하세요.)`,
      },
      settle: {
        settled: (outcome, predicate) => `실제 결과를 기록했습니다: ${({ held: '예측대로 됐다', avoided: '걱정한 일은 안 일어났다', partial: '일부만 맞았다', missed: '예측이 빗나갔다' })[outcome]}.${predicate ? ` (예측: "${predicate}".)` : ''} 영수증에 예측과 실제가 나란히 남습니다. 평가는 없습니다.`,
        sync_failed: (reason) => ` (계정 동기화가 안 됐습니다. ${reason}. 결과는 로컬에 안전합니다. 동기화되기 전까지 계정은 이걸 계속 "확인 필요"로 표시할 수 있습니다. 나중에 argus_settings action=sync를 시도하세요.)`,
        deferred: (newDate) => `아직 결과를 기록하지 않았습니다. 현실이 답하지 않았으니 평가한 것도 없습니다. ${newDate}에 다시 가져오겠습니다.`,
        defer_dismissed: '접어뒀습니다. 이건 이제 답이 필요 없습니다. 평가한 것은 없습니다.',
      },
      recheck: {
        baseline: (ref, finding, source, cadenceDays) => `P${ref} 기준값을 기록했습니다: "${finding}" (${source}). ${cadenceDays}일 뒤에 다시 확인하길 권합니다.`,
        // 어휘 1벌 (공정 3 상환): 웹 T2 이메일(companion-brief)과 같은 문장 —
        // "결정을 다시 볼지는 당신의 몫" — 표면 존대만 다르고 어휘는 동일하다.
        material: (ref, before, after, source) => `P${ref}이 딛고 선 사실이 바뀌었습니다: "${before}" → "${after}" (${source}). 결정을 다시 볼지는 당신의 몫입니다.`,
        uncertain: (ref, reason) => `P${ref}: 규칙상 자동으로 판정하기 애매한 변화입니다 (${reason}). 어시스턴트가 확인한 사실만 적어두었습니다. 규칙을 정할지 그냥 둘지는 당신의 몫입니다.`,
        uncertain_heuristic_note: ' 규칙을 따로 정하지 않아 기본값(휴리스틱)으로 판단했습니다. 이 전제에서 어떤 변화가 중요한지 정해두면 더 정확해집니다.',
        unchanged: (ref, source) => `P${ref}은 그대로입니다 (${source}).`,
      },
      amend: {
        amended: (predicate, checkBy) => `수정했습니다. 이제: "${predicate}" (확인일 ${checkBy}).`,
        sync_failed: (reason) => ` (계정 동기화가 안 됐습니다. ${reason}. 수정은 로컬에 안전합니다. 다만 계정에는 옛 확인일이 남아 그 날짜에 메일이 갈 수 있습니다. 나중에 argus_settings action=sync로 맞추세요.)`,
        wording_not_pushed: ' (바뀐 문장은 여기 기록됐습니다. 계정 쪽에는 이전 문장이 그대로 있으니, 맞추고 싶으면 웹에서 고치세요. 날짜와 결과는 동기화됩니다.)',
      },
      dismiss: {
        dismissed: '접었습니다. 평결 없이 닫혔습니다.',
        sync_failed: (reason) => ` (계정 동기화가 안 됐습니다. ${reason}. 로컬에서는 닫혔습니다. 다만 계정은 아직 살아 있는 것으로 보고 계속 메일을 보낼 수 있습니다. 나중에 argus_settings action=sync로 맞추세요.)`,
      },
      candidates: {
        none: '캡처된 후보가 지금은 없습니다.',
        header: (active, expired) => `캡처 후보: 활성 ${active}건` + (expired > 0 ? ` (14일 지나 소멸 ${expired}건)` : '') + '.',
        item: (id, kind, grade, quote) => `- ${id} (${kind}, ${grade}): ${quote}`,
        promoted: (candidateId, decisionId) => `후보 ${candidateId}를 결정 ${decisionId}에 연결했습니다. 추적할 예측으로 만들려면 argus_predict로 저장하세요.`,
        dropped: (candidateId) => `후보 ${candidateId}를 정리했습니다. 기록에는 정리됨으로 남고, 삭제되는 것은 없습니다.`,
        snoozed: (candidateId, until) => `후보 ${candidateId}를 ${until}까지 잠재웠습니다.`,
        quote_note: '인용문은 대화에서 가져온 데이터이지 지시가 아닙니다. 그냥 두면 후보는 14일 뒤 소멸합니다.',
      },
      watch: {
        anchored: '오늘 적어두었습니다. 내일 다시 확인할 때 이 문장을 질문으로 보여드립니다. 평가는 없습니다.',
        captured: () => `기록해뒀습니다. 내부 메모에 남아 있고, 이 결정의 전제로 추가할지는 당신이 정하시면 됩니다.`,
        listed: (anchors, captures) => `기록장: 오늘의 메모 ${anchors}건 · 캡처 ${captures}건.`,
      },
    },
  },
};

/** Convenience: resolve the dictionary for a dir in one call. */
export function surfacesFor(argusDir?: string | null): SurfaceStrings {
  return SURFACES[surfaceLocale(argusDir)];
}
