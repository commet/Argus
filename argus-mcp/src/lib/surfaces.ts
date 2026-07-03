import fs from 'fs';
import { configPath } from './layout.js';

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
  if (!argusDir) return 'en';
  try {
    const cfg = fs.readFileSync(configPath(argusDir), 'utf8');
    const m = cfg.match(/^locale:\s*(ko|en)\b/m);
    if (m) return m[1] as SurfaceLocale;
  } catch { /* no config yet → base voice */ }
  return 'en';
}

/** Shape shared by both locales — a key added to one MUST exist in the other
 *  (TypeScript enforces the parity; no drift between the two voices). */
export interface SurfaceStrings {
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
    due_premises: (n: number) => string;
    /** ledger-corruption disclosure (11 P2-8): counted silently before — say it. */
    dropped_lines: (n: number) => string;
  };
  sync: {
    live_with_due: (total: number, due: number) => string;
    live_no_due: (total: number) => string;
    settled_on_web: (n: number) => string;
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
}

export const SURFACES: Record<SurfaceLocale, SurfaceStrings> = {
  en: {
    checkin: {
      nothing_due: 'Nothing is due. Nothing to nudge.',
      account_hint: ' This reads the local ledger only — judgments sealed in your account: argus_sync shows them.',
      upcoming: (n, days) => ` ${n} coming due within ${days} day(s) — informational, nothing to settle yet.`,
      due_contracts: (n) => `${n} decision contract(s) past check-by — time to check them against reality (argus_settle).`,
      anchor_mirror: (days, n, words) =>
        `${days} day(s) since you sealed — ${n} contract(s) past check-by. Your words then: '${words}' All that's left is to record what reality did (argus_settle).`,
      due_premises: (n) => `${n} premise fact(s) due for a reality re-check (argus_recheck).`,
      dropped_lines: (n) =>
        ` ${n} ledger line(s) could not be read (possibly a crash artifact). The record is append-only, so the rest is intact — keep a backup of ledger.jsonl.`,
    },
    sync: {
      live_with_due: (total, due) =>
        `${total} live judgment(s) in your account · ${due} past check-by. ` +
        'Terminal-sealed ones settle here via argus_settle with local_id; web-sealed ones settle in the web dashboard.',
      live_no_due: (total) => `${total} live judgment(s) in your account. Nothing past its check-by.`,
      settled_on_web: (n) => ` ${n} already settled on the web — to keep them in this ledger too, record the same outcome with argus_settle.`,
      truncation: (shown, matched) => `Showing ${shown} of ${matched}. Raise limit or narrow with due_only.`,
    },
    seal: {
      header: 'ARGUS · SEALED',
      owner_user: 'These words are yours.',
      owner_ai: 'Argus drafted these words — you have not yet made them yours.',
      sealed_label: 'Sealed',
      answers_label: 'Reality answers',
      days_out: (n) => `(${n} day${n === 1 ? '' : 's'} out)`,
      closing: [
        'This stays shut until then. What gets written next is not',
        'a grade — it is what actually happened.',
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
      settled_group: (n, held, avoided, partial) => `settled (${n}) — held ${held} · avoided ${avoided} · partial ${partial}`,
      more: (n) => `… (+${n})`,
      record_since: (date) => `on record since ${date}`,
    },
  },
  ko: {
    checkin: {
      nothing_due: '확인할 차례가 된 것은 없습니다. 조를 것도 없습니다.',
      account_hint: ' 이건 로컬 원장만 읽습니다 — 계정에 봉인한 판단은 argus_sync로 볼 수 있습니다.',
      upcoming: (n, days) => ` ${days}일 안에 확인일이 오는 것 ${n}건 — 참고용이고, 아직 정산할 건 아닙니다.`,
      due_contracts: (n) => `계약 ${n}건이 확인일을 지났습니다 — 현실과 대조할 차례입니다 (argus_settle).`,
      anchor_mirror: (days, n, words) =>
        `봉인 후 ${days}일 — 계약 ${n}건이 확인일을 지났습니다. 그때 당신은 이렇게 적었습니다: '${words}' 현실이 어떻게 답했는지만 기록하면 됩니다 (argus_settle).`,
      due_premises: (n) => `전제 사실 ${n}건이 현실 재확인 차례입니다 (argus_recheck).`,
      dropped_lines: (n) =>
        ` 원장에서 읽지 못한 줄이 ${n}개 있습니다(크래시 흔적일 수 있음). 기록은 append-only라 나머지는 안전합니다 — ledger.jsonl을 백업해 두세요.`,
    },
    sync: {
      live_with_due: (total, due) =>
        `계정에 살아 있는 판단 ${total}개 · 확인할 차례 ${due}개. ` +
        '이 터미널에서 봉인한 것은 local_id로 argus_settle, 웹에서 봉인한 것은 웹 대시보드에서 정산하세요.',
      live_no_due: (total) => `계정에 살아 있는 판단 ${total}개. 확인할 차례가 된 것은 없습니다.`,
      settled_on_web: (n) => ` 웹에서 이미 정산된 것 ${n}건 — 로컬 원장에도 남기려면 argus_settle로 같은 outcome을 기록하세요.`,
      truncation: (shown, matched) => `${matched}개 중 ${shown}개만 표시. limit을 올리거나 due_only로 좁히세요.`,
    },
    seal: {
      header: 'ARGUS · 봉인',
      owner_user: '이 문장은 당신의 것입니다.',
      owner_ai: 'Argus가 초안한 문장입니다 — 아직 당신이 확언하지 않았습니다.',
      sealed_label: '봉인',
      answers_label: '현실의 답',
      days_out: (n) => `(${n}일 뒤)`,
      closing: [
        '그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될',
        '것은 평가가 아니라 — 실제로 일어난 일입니다.',
      ],
      footer: 'argus · 닻 내림 ⚓',
    },
    wake: {
      header: 'ARGUS · 항적',
      counts: (total, sealed, settled) => `결정 ${total} · 봉인 중 ${sealed} · 정산 ${settled}`,
      overdue_group: (n) => `확인일 지남 (${n})`,
      overdue_hint: '← argus_settle',
      days_past: (n) => `${n}일 경과`,
      waiting_group: (n) => `현실을 기다리는 중 (${n})`,
      answer_on: (date) => `답 ${date}`,
      settled_group: (n, held, avoided, partial) => `정산됨 (${n}) — held ${held} · avoided ${avoided} · partial ${partial}`,
      more: (n) => `… (+${n})`,
      record_since: (date) => `기록 시작 ${date} 부터`,
    },
  },
};

/** Convenience: resolve the dictionary for a dir in one call. */
export function surfacesFor(argusDir?: string | null): SurfaceStrings {
  return SURFACES[surfaceLocale(argusDir)];
}
