import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, asDate } from '../lib/resolve-today.js';
import { replayLedger, bearingContracts } from '../lib/ledger-replay.js';
import { stuckDecisions } from '../lib/stuck-decisions.js';
import { sanitizeLine } from '../v2/sanitize.js';
import { duePremises, groupDuePremises, dueOpenQuestions } from '../lib/premises.js';
import { readReceipt, SKIPPED } from '../lib/receipt.js';
import { SURFACES, resolveResponseLocale, surfaceLocale } from '../lib/surfaces.js';
import { z } from 'zod';
import { type NextAction } from '../lib/spine.js';
import { tunedStandingSense } from '../lib/ambient-prefs.js';
import { envelope } from '../lib/envelope.js';
import { canElicit } from '../lib/elicit.js';
import { appsCapable } from '../lib/apps-ui.js';
import { packageMeta } from '../lib/package-meta.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { accountCredentialStatus } from '../a0/account-credentials.js';
import { briefDivergence, readV2Brief } from '../v2/mirror.js';
import { drainCaptureOnCheckIn } from '../v2/capture-runtime.js';

/**
 * The watch anchor is the one surface a user cannot close: a contract has
 * settle/dismiss and an open_question has still_open, but an anchor has no ack
 * event — so an unbounded mirror re-asks "so how did it go?" about the same
 * note forever (the mirror-clause nag). Bound it the way the spine describes it
 * ("TOMORROW's check_in mirrors it back"), with a small grace so an anchor
 * written on Friday still greets the user on Monday.
 */
const ANCHOR_MIRROR_MAX_AGE_DAYS = 3;

/** Session-once, per ledger+anchor — the same gate as the ambient due-line and
 *  the seal assumption nudge. Two check_in calls in one session must not re-ask
 *  the identical question. */
const anchorMirrorShownFor = new Set<string>();
export function resetCheckInSession(): void {
  anchorMirrorShownFor.clear();
}

/**
 * The wire facts a session can see about ITSELF. `picker` answers "does this host
 * show real pickers"; `server_version` answers "which build am I actually talking
 * to" — the gap that let a founder dogfood 1.2.0 for twelve days while seven
 * releases sat on npm (npx reuses a cached install whenever the spec is a RANGE,
 * so `argus-decision-mcp@^1` never upgrades on its own). CI gates the repo and
 * npm holds the latest; neither can see what a live session actually launched.
 * Reported on every check_in so `/doctor` — and the user — can compare it to the
 * version the plugin pins, instead of inferring staleness from missing behavior.
 */
function wireFacts(): { picker: 'card' | 'one_tap' | 'text_fallback'; server_version: string } {
  // Three surfaces, strongest first — the SAME order settle degrades through, so
  // this field answers "what will I actually see when I settle?" without the
  // user having to trigger one and find out (founder 2026-07-27: "does this
  // show up on Claude Code and Codex too?" must be answerable by the wire, not
  // by a blog post).
  //
  // This reports the negotiated wire capability, not a guess about whether a
  // particular client rendered its UI. MCP exposes no server-visible rendering
  // receipt, and elapsed response time cannot supply one.
  const picker = appsCapable()
    ? 'card' as const
    : canElicit()
      ? 'one_tap' as const
      : 'text_fallback' as const;
  return { picker, server_version: packageMeta().version };
}

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  // max(365), not max(30): the handler clamps the WINDOW to 30 days, but the
  // schema must not hard-refuse a model that passes 60 for "show me two months"
  // — an advertised-then-rejected argument is the 1.4.6 backlog's enum-divergence
  // class. Values above 30 are accepted and clamped.
  include_upcoming_days: z.number().int().min(0).max(365).default(0).describe('Also list sealed contracts coming due within N days (informational; nothing to settle yet). Values above 30 are clamped to 30.'),
  today_override: zDate.optional(),
});

export const checkIn: ToolModule = {
  name: 'argus_check_in',
  description:
    'Return decision contracts whose check-by date has arrived (and optionally upcoming ones). A return nudge — reads and routes to argus_settle. If nothing is due, it says so and stops; it does not manufacture engagement.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  // readOnlyHint:false — honest: the FIRST call on an un-initialized dir routes
  // through ensureInitialized, which creates .argus/ (dirs, config, .gitignore,
  // bound marker, v2 registry). "read-only" must not lie (hardening principle),
  // even though every subsequent call is a pure read.
  annotations: { title: 'Check what is due', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const captureStatus = await drainCaptureOnCheckIn(dir, today);
      const ledger = replayLedger(dir, today);
      const seeds = bearingContracts(dir, today, ledger);

      const dueMap = new Map<string, { id: string; predicate: string; check_by: string; days_overdue: number; source: string; question?: string }>();
      for (const c of ledger.overdue) {
        // 열 때의 질문(입력 깊이)을 due 항목에 태운다 — "돌아볼 때 먼저
        // 보여줍니다"의 check_in 쪽 이행. data 전용: 표면 예산은 그대로 두고,
        // 모델이 귀환을 열 때 질문부터 되비출 재료를 준다.
        const cogQ = ledger.contracts.get(c.id)?.question;
        dueMap.set(c.id, { id: c.id, predicate: c.text, check_by: c.date, days_overdue: daysBetween(c.date, today), source: 'ledger', ...(cogQ ? { question: cogQ } : {}) });
      }
      for (const s of seeds) {
        if (!dueMap.has(s.id)) dueMap.set(s.id, { id: s.id, predicate: s.predicate, check_by: s.check_by, days_overdue: daysBetween(s.date, today), source: 'bearing' });
      }
      const dueAll = Array.from(dueMap.values()).sort((x, y) => x.check_by < y.check_by ? -1 : 1);
      // Bounded output (§9.4 경계 수리): after a long gap dozens can be due at
      // once — cap what rides into the model's context (and the per-item
      // receipt reads below), disclose the rest as a count. Oldest first stays.
      const DUE_TOP = 20;
      const due = dueAll.slice(0, DUE_TOP);
      const dueTruncated = dueAll.length - due.length;

      // The full OPEN watch-list (sealed, not yet settled), so the model — once it
      // holds this from the session-start check_in — can settle a prediction the
      // MOMENT its outcome surfaces in conversation, even before the check-by date
      // (SERVER_INSTRUCTIONS §2: notice the outcome as it surfaces). Bounded; data
      // only, never surfaced — it is context for the model's noticing, not a list
      // shown to the user.
      const openWatch = [...ledger.contracts.values()]
        .filter((c) => c.status === 'sealed')
        .sort((x, y) => ((x.check_by || '') < (y.check_by || '') ? -1 : 1))
        .slice(0, 40)
        .map((c) => ({ id: c.id, predicate: c.predicate, check_by: c.check_by }));

      // 미확인 계획 단계도 같은 상설 문맥이다 (data 전용, 표면 아님). 실측:
      // 세션을 여는 유일한 표면이 이걸 안 실으면, 사용자가 단계 결과를 말하는
      // 순간 모델의 손에 계획이 없어 새 결정만 열고 지나간다 (A/B 2회 재현).
      const openPlanSteps = [...ledger.contracts.values()]
        .filter((c) => c.plan && c.status !== 'dismissed' && c.status !== 'settled')
        .flatMap((c) => (c.plan?.steps ?? []).filter((s) => !s.checked_on)
          .map((s) => ({ id: c.id, step: s.ordinal, what: s.what.slice(0, 140), ...(s.due ? { due: s.due } : {}) })))
        .slice(0, 10);

      // 당직 미러 (§9.1): the most recent PRIOR day's anchor comes back first,
      // as a question — recognition, never a completion check. Today's own
      // anchor is data-only (no need to echo what the user just wrote).
      //
      // Bounded twice, because an anchor has no close/ack handle (unlike a
      // contract's settle or an open_question's still_open) and so is the one
      // surface a user cannot silence:
      //  (a) AGE — the spine says "TOMORROW's check_in mirrors it back". An
      //      anchor written 40 days ago is not yesterday's aim; re-asking "so
      //      how did it go?" about it forever is the mirror-clause nag.
      //  (b) SESSION-ONCE — same gate as the ambient due-line and the seal
      //      assumption nudge: calling check_in twice in one session must not
      //      re-ask the identical question.
      const priorAnchors = [...ledger.watch.anchors.values()]
        .filter((x) => x.date < today)
        .sort((x, y) => (x.date < y.date ? 1 : -1));
      // The anchor stays a FACT (data.watch.last_anchor, locale sniffing); only
      // the mirrored QUESTION is bounded by age + session-once.
      const lastAnchor = priorAnchors[0];
      const anchorKey = lastAnchor ? dir + " " + lastAnchor.date : "";
      const mirrorAnchor =
        lastAnchor
        && daysBetween(lastAnchor.date, today) <= ANCHOR_MIRROR_MAX_AGE_DAYS
        && !anchorMirrorShownFor.has(anchorKey)
          ? lastAnchor
          : undefined;
      if (mirrorAnchor) anchorMirrorShownFor.add(anchorKey);

      // Locale brain (P1-E1 + §9.3 언어 고정): check_in has no user-typed input,
      // so the frame used to flip to the base voice around the user's own
      // Korean words. Detect from the LEDGER's user text instead — the anchor
      // being mirrored, else the oldest due predicate. An explicit config
      // locale still always wins inside resolveResponseLocale. With NO ledger
      // text at all, stay config-or-'en' (deterministic on every machine —
      // never the env/Intl fallback, which would make tests machine-dependent).
      // Extended (self-drive loop find): when the only due items are premise
      // facts / open questions, THOSE are the ledger user-text being surfaced —
      // without them in the chain, a Korean session whose check_in carried only
      // a due question came back framed in English around the user's own words.
      const premiseGroups = groupDuePremises(duePremises(ledger));
      const openQs = dueOpenQuestions(ledger);
      // Sniff the user's LOCALE from the ledger's own words (never env/Intl for
      // Korean users on an English OS). The old priority-OR chain silently fell
      // through to `undefined` — English — whenever every earlier slot was empty
      // AND the last resort read a field that doesn't exist on ContractEntry
      // (`.predicate`; the entry stores `.text`). A Korean session whose only due
      // item was an open question came back framed in English around its own
      // Korean quote. Fix: pool ALL available ledger user-text defensively so any
      // single Korean line is enough to detect. (Found via the check_in
      // localization yellow, 2026-07-14.)
      const ledgerVoiceSample = [
        lastAnchor?.text,
        ...ledger.overdue.map((o) => o.text),
        ...due.map((d) => d.predicate),
        ...premiseGroups.flatMap((g) => g.premises.map((p) => p.decision_text)),
        ...openQs.map((q) => q.text),
        ...[...ledger.contracts.values()].map((c) => c.text),
      ].filter((t): t is string => typeof t === 'string' && t.trim().length > 0).join(' ') || undefined;
      const S = ledgerVoiceSample
        ? SURFACES[resolveResponseLocale(dir, ledgerVoiceSample)].checkin
        : SURFACES[surfaceLocale(dir)].checkin;
      const mirrorLine = mirrorAnchor ? S.watch_mirror(mirrorAnchor.date, clip(mirrorAnchor.text, 160)) + ' ' : '';
      const todayAnchor = ledger.watch.anchors.get(today);
      const watchData = (lastAnchor || todayAnchor)
        ? { watch: { ...(lastAnchor ? { last_anchor: lastAnchor } : {}), ...(todayAnchor ? { today_anchor: todayAnchor } : {}) } }
        : {};

      // 닻 거울 (P1-E3): each due item carries its seal date + the user's OWN
      // seal-time words (receipt.human_judgment; omitted when skipped). The
      // mirror is recognition by date arithmetic, never a welcome greeting —
      // and the quote is the user's sentence, not a machine verdict.
      // A deferred bet comes back with the user's OWN reason for deferring it —
      // "the trial data doesn't land until March" — so the return reminds them
      // WHY they pushed it, not merely that time passed. Without this the note
      // was written to the ledger and never read by anything.
      const deferInfo = (id: string): { deferred_times: number; deferred_because?: string } | undefined => {
        const entry = ledger.contracts.get(id);
        const times = entry?.defer_count ?? 0;
        if (times === 0) return undefined;
        const note = entry?.defer_history?.[entry.defer_history.length - 1]?.note;
        return { deferred_times: times, ...(note ? { deferred_because: note } : {}) };
      };

      const dueEnriched: Array<typeof due[number] & { sealed_at?: string; days_since_seal?: number; your_words_then?: string; deferred_times?: number; deferred_because?: string }> =
        due.map((d) => {
          const deferred = deferInfo(d.id);
          const withDefer = deferred ? { ...d, ...deferred } : d;
          const receipt = readReceipt(dir, d.id);
          if (!receipt?.created_at) return withDefer;
          const sealed_at = String(receipt.created_at).slice(0, 10);
          const words = typeof receipt.human_judgment === 'string' &&
            receipt.human_judgment.trim().length > 0 &&
            receipt.human_judgment !== SKIPPED
            ? receipt.human_judgment.trim()
            : undefined;
          return {
            ...withDefer,
            sealed_at,
            days_since_seal: daysBetween(sealed_at, today),
            ...(words ? { your_words_then: words } : {}),
          };
        });

      // include_upcoming_days, actually implemented (11 S2 — an accepted-then-
      // discarded argument is a silent lie in the schema). Sealed contracts whose
      // check-by falls within the window: informational only, nothing to settle.
      const upDays = typeof a['include_upcoming_days'] === 'number'
        ? Math.max(0, Math.min(30, Math.floor(a['include_upcoming_days'] as number)))
        : 0;
      const upcoming: Array<{ id: string; predicate: string; check_by: string }> = [];
      if (upDays > 0) {
        const horizon = addDays(today, upDays);
        for (const [cid, entry] of ledger.contracts.entries()) {
          if (entry.status !== 'sealed' || dueMap.has(cid)) continue;
          const date = asDate(entry.check_by);
          if (date && date > today && date <= horizon) {
            upcoming.push({ id: cid, predicate: entry.text || '', check_by: date });
          }
        }
        upcoming.sort((x, y) => (x.check_by < y.check_by ? -1 : 1));
      }
      const upcomingLine = upcoming.length > 0
        ? S.upcoming(upcoming.length, upDays)
        : '';

      // STUCK RECORDS (journey D1, measured). 침묵 계약은 **봉인된** 결정이
      // 아직 확인일 전일 때의 것이다 — 그건 건강하게 기다리는 상태이고, 세는
      // 것을 읊는 것은 과발화다 (그 시도는 되돌렸다). 전제만 있고 예측이 없는
      // 결정은 다르다: 기다리는 게 아니라 **멈춰 있다.** 확인일이 없으니 영영
      // due가 되지 않고, 어떤 표면에도 뜨지 않으며, 사용자가 자기 손으로 쓴
      // 하중 가정이 현실과 대조될 기회를 잃는다. "마감이 없다"와 "그 기록은
      // 죽었다"는 다른 사실이고, 후자를 침묵으로 덮는 것은 정직한 공백이 아니다.
      // 사실만 말하고 재촉하지 않는다 — 손잡이(id)는 data에 있고, 필요 없으면
      // argus_capture action="close"로 닫으면 된다.
      const stuck = stuckDecisions(ledger);
      // 사용자 텍스트는 표면에 그대로 넣지 않는다 (집안 규칙, 규칙 19) — 길이도
      // 제어문자도 여기서 막는다. 안 하면 500자짜리 결정 문장이 화면을 삼킨다.
      const stuckLine = stuck.length > 0 ? S.stuck(stuck.length, sanitizeLine(stuck[0]!.decision, 60)) : '';

      // Fleet view (M2, §9.4): due counts across the OTHER projects the global
      // registry knows. Counts + paths only — each project settles in its own
      // dir; this is a lighthouse sweep, not a merged ledger.
      const fleetLine = '';

      // Ledger-corruption disclosure (11 P2-8): dropped_lines was counted in
      // data.integrity but never SAID. Silence is not kindness — one factual
      // sentence + the backup handle. No blame, no gate.
      const undatedIds = ledger.integrity.undated_seals ?? [];
      const integrityLine =
        (ledger.integrity.dropped_lines > 0 ? S.dropped_lines(ledger.integrity.dropped_lines) : '')
        + (undatedIds.length > 0 ? S.undated_seals(undatedIds) : '');

      // Living premises: monitored facts due for a reality re-check, grouped so
      // the same fact under several decisions is ONE re-check (plan v5 P1/P5).
      // groupDuePremises(duePremises()) is the SAME primitive the ambient
      // due-line reads via ambient-due.ts — so the "N to re-check" the session
      // sees on any tool can never disagree with check_in (M1 §1.3, single-source
      // rule; a test pins the equality).
      const TOP = 5;
      const duePrem = premiseGroups.slice(0, TOP).map((g) => ({
        fact: g.text,
        // if_false_changes: 이 전제가 틀리면 결정에서 무엇이 달라지는지, 기록될
        // 때 적힌 한 줄. 재확인을 요청하는 이 자리가 그것을 나르지 않으면
        // 공개 스키마의 약속("나중에 무엇을 확인할지가 여기서 나옵니다")이
        // 거짓이 된다. 없으면 키가 없다 (채워야 할 칸이 아니라 정직한 공백).
        decisions: g.premises.map((p) => ({ decision_id: p.decision_id, decision: p.decision_text, ref: `P${p.ordinal}`, staleness: p.days_stale === null ? 'never re-checked' : `${p.days_stale}d`, ...(p.if_false_changes ? { if_false_changes: p.if_false_changes } : {}) })),
      }));

      // M3 — open questions the user left unresolved, past their reconsider
      // cadence. Same single source (ambient-due reads dueOpenQuestions too) so
      // the ambient count and this list can never disagree. Surface is a FACT +
      // the handle; leaving it open stays a valid answer (restraint, §6).
      const dueOpenQ = openQs.slice(0, TOP).map((q) => ({
        question: q.text, ref: `P${q.ordinal}`, decision_id: q.decision_id, decision: q.decision_text,
        days_open: q.days_open,
      }));

      // 계획 확인 도래 (PRODUCT-PLAN §3): 날짜가 붙어 예약된 단계가 오늘에
      // 닿았고 아직 결과가 없는 것. 결정이 정산/기각으로 닫혔으면 그 계획의
      // 단계를 더 묻지 않는다 — 닫힌 결정을 다시 여는 과발화이기 때문이다.
      const planDueAll: Array<{ id: string; step: number; what: string; due: string; days_overdue: number }> = [];
      for (const c of ledger.contracts.values()) {
        if (!c.plan || c.status === 'dismissed' || c.status === 'settled') continue;
        for (const s of c.plan.steps) {
          if (s.scheduled && s.due && s.due <= today && !s.checked_on) {
            planDueAll.push({ id: c.id, step: s.ordinal, what: s.what, due: s.due, days_overdue: daysBetween(s.due, today) });
          }
        }
      }
      const planDue = planDueAll.sort((x, y) => (x.due < y.due ? -1 : 1)).slice(0, TOP);
      const planLine = planDueAll.length > 0 ? S.plan_due(planDueAll.length, sanitizeLine(planDueAll[0]!.what, 80)) : '';

      if (due.length === 0 && premiseGroups.length === 0 && openQs.length === 0 && planDueAll.length === 0) {
        // Static hint, no network (P1-E4 ③ / master §5-18): check_in stays a
        // local, deterministic read — but a token means the user ALSO seals in
        // their account (web), and "nothing" here must not read as "nothing
        // anywhere". One sentence, argus_sync is the one place that looks.
        // Read the SAME resolver every push path uses (audit 2026-07-27). This
        // used to peek at `process.env.ARGUS_TOKEN` alone, which is the manual /
        // CI override — so a user connected the normal way (argus_settings
        // `npx argus-decision-mcp connect`, credential on disk) was told "nothing anywhere"
        // while their account held live decisions this read never looked at.
        const accountHint = accountCredentialStatus() === 'ok'
          ? S.account_hint
          : '';
        // First-run vs caught-up: SERVER_INSTRUCTIONS routes EVERY session start
        // to check_in, so a brand-new user used to land on the same "nothing due"
        // + stop a veteran sees — a dead end at the flagship cold-start. Fire the
        // on-ramp ONLY when the surface would otherwise be a BARE "nothing due":
        // no decisions, no watch mirror, no account, no upcoming/fleet/integrity.
        // Anything else (a caught-up veteran, a watch anchor, an account seal)
        // keeps nothing_due, so the mirror/silence contracts are untouched.
        // `!ledger.oldest_ts` = the ledger has NO events at all (not just no
        // decisions — no watch anchors either), the one true "brand new" signal.
        // Excluded under ARGUS_V2_DEBUG (the v2 observation channel expects its
        // diagnostic payload even on an empty v1 ledger).
        if (!ledger.oldest_ts && !mirrorLine && !accountHint && !upcomingLine && !fleetLine && !integrityLine && process.env['ARGUS_V2_DEBUG'] !== '1') {
          return envelope({
            ok: true, tool: 'argus_check_in',
            surface: S.first_run,
            next_actions: ['argus_capture'],
            data: { due: [], due_count: 0, due_premises: [], due_premise_count: 0, due_open_questions: [], due_open_question_count: 0, first_run: true, today, ...wireFacts() },
          });
        }
        return envelope({
          ok: true, tool: 'argus_check_in',
          surface: mirrorLine + S.nothing_due + stuckLine + accountHint + upcomingLine + fleetLine + integrityLine,
          next_actions: ['stop'],
          data: { due: [], due_count: 0, due_premises: [], due_premise_count: 0, due_open_questions: [], due_open_question_count: 0, ...wireFacts(), ...(openWatch.length ? { open_predictions: openWatch, standing_sense: tunedStandingSense() } : {}), ...(openPlanSteps.length ? { open_plan_steps: openPlanSteps } : {}), ...(stuck.length ? { stuck_decisions: stuck } : {}), ...(upDays > 0 ? { upcoming } : {}), ...watchData, today, integrity: ledger.integrity, ...(process.env['ARGUS_V2_DEBUG'] === '1' ? { capture_status: captureStatus, v2_brief: readV2Brief(dir, today), v2_divergence: briefDivergence([], readV2Brief(dir, today)) } : {}) },
        });
      }

      const parts: string[] = [];
      if (due.length > 0) {
        // 닻 거울: the OLDEST due item's seal-time words lead the surface
        // (one quote only — the rest stay in data, no surface bloat). Falls
        // back to the count-only line when there are no words to mirror.
        const oldest = dueEnriched[0];
        parts.push(
          oldest?.your_words_then && typeof oldest.days_since_seal === 'number'
            ? S.anchor_mirror(oldest.days_since_seal, dueAll.length, clip(oldest.your_words_then, 200))
            : S.due_contracts(dueAll.length),
        );
      }
      if (premiseGroups.length > 0) parts.push(S.due_premises(premiseGroups.length, premiseGroups[0]?.premises[0]?.days_stale, premiseGroups[0]?.premises[0]?.days_since_add));
      // M3 — the oldest due question's own words lead (one quote only; the rest
      // stay in data). When it's the sole due thing this is the whole surface.
      if (openQs.length > 0) {
        parts.push(
          openQs.length === 1
            ? S.reconsider_one(openQs[0].days_open, clip(openQs[0].text, 200))
            : S.reconsider_more(openQs.length),
        );
      }
      if (planLine) parts.push(planLine);

      // Route to the tool that acts on whatever is due: settle a contract first,
      // else reconsider/recall. argus_premises closes or defers an open question.
      const next: NextAction[] = due.length > 0
        ? ['argus_resolve']
        : openQs.length > 0 || planDueAll.length > 0
          ? ['argus_capture', 'argus_patterns']
          : ['argus_patterns'];

      return envelope({
        ok: true, tool: 'argus_check_in',
        surface: mirrorLine + parts.join(' ') + upcomingLine + fleetLine + integrityLine,
        next_actions: next,
        data: {
          ...wireFacts(),
          due: dueEnriched, due_count: dueAll.length,
          ...(dueTruncated > 0 ? { due_truncated: `${dueAll.length} due, showing ${DUE_TOP} oldest` } : {}),
          due_premises: duePrem, due_premise_count: premiseGroups.length,
          ...(premiseGroups.length > TOP ? { due_premises_truncated: `${premiseGroups.length} groups, showing ${TOP}` } : {}),
          due_open_questions: dueOpenQ, due_open_question_count: openQs.length,
          ...(openQs.length > TOP ? { due_open_questions_truncated: `${openQs.length} questions, showing ${TOP}` } : {}),
          ...(planDueAll.length > 0 ? {
            plan_due: planDue, plan_due_count: planDueAll.length,
            ...(planDueAll.length > TOP ? { plan_due_truncated: `${planDueAll.length} steps, showing ${TOP}` } : {}),
          } : {}),
          ...(upDays > 0 ? { upcoming } : {}),
          ...watchData,
          ...(openWatch.length ? { open_predictions: openWatch, standing_sense: tunedStandingSense() } : {}),
          ...(openPlanSteps.length ? { open_plan_steps: openPlanSteps } : {}),
          // 표면은 사실만 말한다. 그것을 고칠 손잡이(id)는 여기에 둔다.
          ...(stuck.length ? { stuck_decisions: stuck } : {}),
          today, integrity: ledger.integrity,
          // v2 병기/진단은 ARGUS_V2_DEBUG=1 뒤로. 공개 payload에 싣던 v2_brief가
          // 머신-전역 durable-home 저장소를 읽어 다른 프로젝트의 결정 원문을
          // 모든 프로젝트 대화에 노출했다(교차-프로젝트 누출) — 관찰용 진단은
          // 옵트인 디버그로만. capture_status도 사용자-무의미 진단이라 동거.
          //
          // 단, harvest.ts 가 "조용한 truncation 금지"로 세는 capped **숫자만**은
          // 항상 내보낸다 — 주간 캡에 걸려 버려진 후보가 있었다는 사실이 디버그
          // 뒤에 숨으면 그 금지가 게이트에 의해 무효가 된다. 숫자 하나라 결정
          // 원문 누출(위 사건)과 무관하다.
          ...(captureStatus.last_drain && captureStatus.last_drain.capped > 0
            ? { capture_capped: captureStatus.last_drain.capped }
            : {}),
          ...(process.env['ARGUS_V2_DEBUG'] === '1' ? {
            capture_status: captureStatus,
            v2_brief: readV2Brief(dir, today),
            v2_divergence: briefDivergence(dueAll.map((d) => d.id), readV2Brief(dir, today)),
          } : {}),
        },
      });
    } catch (e) {
      return handleToolException('argus_check_in', e);
    }
  },
};

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** Keep the mirrored quote a quote, not a wall — the full text stays in data. */
function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function addDays(day: string, days: number): string {
  const t = Date.parse(day + 'T00:00:00Z');
  if (Number.isNaN(t)) return day;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}
