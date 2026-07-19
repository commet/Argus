import type { Receipt } from './receipt.js';
import type { ReceiptPremisesInfo } from './premises.js';
import { SURFACES, type SurfaceLocale } from './surfaces.js';

/**
 * Renders a settled Judgment Receipt as shareable monospace text (blueprint
 * §5.2 + addendum M6). No ✗ grade stamp — a "YOU PREDICTED / WHAT HAPPENED"
 * diff. Reality is shown; the user is never graded. The AI-VERDICT … NONE line
 * is always present and always NONE.
 *
 * `premises` (optional, plan v5 §3.3): the living-premises summary computed
 * from the ledger fold at render time — the premise set is canonical, the
 * receipt renders from it. headline stands in when the seal-time assumption
 * field was skipped but a load-bearing premise exists.
 */
// The shape is core-owned (premises.ts) — renderers import it, never the
// reverse (O2 방2: a type defined here once dragged surfaces/locale into the
// core closure through premises' type-only import). Re-exported so existing
// `from './render-receipt.js'` type imports keep working.
export type { ReceiptPremisesInfo } from './premises.js';

export function renderReceipt(r: Receipt, premises?: ReceiptPremisesInfo, locale: SurfaceLocale = 'en'): string {
  const R = SURFACES[locale].receipt;
  const L: string[] = [];
  const sealed = r.created_at ? r.created_at.slice(0, 10) : '—';
  const settled = r.settled_at ? r.settled_at.slice(0, 10) : R.not_settled;

  const RW = 64; // target display columns — top and bottom derive from one width
  const top = '┌─ ' + R.header + ' ' + '─'.repeat(Math.max(2, RW - 5 - dw(R.header))) + '┐';
  const bottom = '└' + '─'.repeat(Math.max(2, RW - 6 - dw(R.footer))) + '  ' + R.footer + ' ─┘';

  L.push(top);
  L.push(`  ${R.sealed_label} ${sealed}      ${R.settled_label} ${settled}`);
  // Deferral fact (still_pending re-arms): "originally due X · deferred N×".
  // A fact about the record's timeline, not a grade of the user.
  if (r.deferred_times && r.deferred_times > 0) {
    L.push(`  ${R.deferred_fact(r.deferred_times, r.originally_due ?? sealed)}`);
  }
  const skipped = new Set(r.skipped ?? []);
  const show = (v: string, field: string): string => (skipped.has(field) ? R.skipped : wrap(v));

  L.push('');
  L.push(`  ${R.real_question}`);
  L.push(`    ${show(r.real_question, 'real_question')}`);
  L.push(`  ${R.unverified_assumption}`);
  const assumptionSkipped = skipped.has('unverified_assumption');
  if (assumptionSkipped && premises?.headline) {
    // The premise set is canonical — a tracked load-bearing premise stands in
    // for a skipped seal-time field (plan v5 §5.4).
    L.push(`    ${wrap(premises.headline)}`);
  } else {
    L.push(`    ${show(r.unverified_assumption, 'unverified_assumption')}`);
  }
  if (premises && premises.tracked > 0) {
    L.push(`    ${R.premises_note(premises.tracked, premises.changed_at_recheck)}`);
  }
  const labelWidth = Math.max(R.human_only.length, R.made_by_label.length, R.called_as.length) + 3;
  L.push(`  ${R.human_only.padEnd(labelWidth)}${show(r.human_only, 'human_only')}`);
  L.push(`  ${R.made_by_label.padEnd(labelWidth)}${R.made_by}`);
  if (r.basis) {
    L.push(`  ${R.called_as.padEnd(labelWidth)}${R.basis_label(r.basis)}`);
  }
  L.push('');
  L.push(`  ${R.you_predicted}   "${wrap(r.predicate)}"   ${R.check_by(r.check_by)}`);
  if (r.what_happened) {
    L.push(`  ${R.what_happened}   ${wrap(r.what_happened)}`);
  }
  L.push('  ─────────────────────────────────────────────────────────');
  L.push(`  ${R.verdict_line}`);
  L.push(`  ${R.closing}`);
  L.push(bottom);
  return L.join('\n');
}

/**
 * renderSeal — the sealing confirmation `data.seal_text` (P1-E2 = 12 §3.1).
 *
 * The terminal twin of the webapp's seal certificate plate (P1-A3 S4): the
 * user's predicate as a quote block, an HONEST provenance line, the two date
 * rows, and the "not a grade" closing — same copy family, text stage.
 *
 * Spine rules baked in:
 *  - provenance is a FACT statement: 'user' → "these words are yours";
 *    'ai_surfaced' → "Argus drafted these words — you have not yet made them
 *    yours". Never a false ownership narrative, and never a gate (sealing
 *    as-is stays possible).
 *  - zero hype, and one signature: the closing anchor ⚓ at the footer — the
 *    founder's "period mark" (2026-07-03), stamped only where a loop is tied
 *    (seal footer, settle receipt footer). Never sprinkled elsewhere.
 *  - the day diff comes from resolveToday's `today`, not a fresh wall clock.
 */
export function renderSeal(opts: {
  predicate: string;
  predicate_owner: 'user' | 'ai_surfaced';
  /** YYYY-MM-DD — the seal date. */
  sealed_on: string;
  /** YYYY-MM-DD — when reality answers. */
  check_by: string;
  /** YYYY-MM-DD from resolveToday (deterministic — no new Date() here). */
  today: string;
  locale: SurfaceLocale;
}): string {
  const S = SURFACES[opts.locale].seal;
  const L: string[] = [];

  const SW = 64; // target display columns — top and bottom derive from one width
  const top = '┌─ ' + S.header + ' ' + '─'.repeat(Math.max(2, SW - 5 - dw(S.header))) + '┐';
  const bottom = '└' + '─'.repeat(Math.max(2, SW - 6 - dw(S.footer))) + '  ' + S.footer + ' ─┘';

  L.push(top);
  L.push('');
  // the quote block — the user's own falsifiable sentence (continuation lines
  // sit inside the opening quote)
  L.push(`  "${wrap(opts.predicate, 50).split('\n    ').join('\n   ')}"`);
  L.push('');
  // The prose already states provenance honestly ("these words are yours" /
  // "Argus drafted these"). The raw `(predicate_owner: user)` machine tag beside
  // it was plumbing on the keepsake certificate — the honest-provenance sentence
  // carries the meaning; the token stays in `data`, off the rendered card.
  L.push(`  ${opts.predicate_owner === 'user' ? S.owner_user : S.owner_ai}`);
  L.push('');
  const labelWidth = Math.max(S.sealed_label.length, S.answers_label.length) + 4;
  const days = Math.round((Date.parse(opts.check_by) - Date.parse(opts.today)) / 86400000);
  const daysOut = Number.isFinite(days) && days > 0 ? `   ${S.days_out(days)}` : '';
  L.push(`  ${S.sealed_label.padEnd(labelWidth)}${opts.sealed_on}`);
  L.push(`  ${S.answers_label.padEnd(labelWidth)}${opts.check_by}${daysOut}`);
  L.push('');
  L.push(`  ${S.closing[0]}`);
  L.push(`  ${S.closing[1]}`);
  L.push('');
  L.push(bottom);
  return L.join('\n');
}

/**
 * renderWake — the accumulation landscape `wake_text` (P1-E7 = 12 §3.5).
 *
 * argus_recall view=bearing/contracts returns this in data: the whole record
 * on ONE time axis, three groups (past check-by → waiting → settled), five
 * lines per group + a `(+N)` fold (check_in's TOP=5 convention), and a final
 * "on record since YYYY-MM-DD" line from the oldest ledger event.
 *
 * Spine (§4, pinned by spine-drift.test.ts): counts, dates and the user's own
 * outcome words ONLY — no accuracy %, no "1/3" ratio, no tier/score/streak.
 * The overdue vocabulary ("확인일 지남 · N일 경과") is terminal-allowed per
 * master §5-6 (developer surface); importing it into the webapp stays banned.
 */
export interface WakeContractRow {
  id: string;
  status: 'candidate' | 'sealed' | 'settled' | 'dismissed';
  predicate?: string;
  text?: string;
  check_by?: string;
  outcome?: string;
  settled_on?: string;
}

const WAKE_TOP = 5; // per-group visible lines — the due_premises TOP=5 convention

export function renderWake(
  contracts: WakeContractRow[],
  stats: { held: number; avoided: number; partial: number; missed: number },
  today: string,
  locale: SurfaceLocale,
  /** YYYY-MM-DD of the oldest ledger event (LedgerState.oldest_ts). */
  recordSince?: string,
): string {
  const W = SURFACES[locale].wake;
  const WIDTH = 60;

  const byCheckBy = (a: WakeContractRow, b: WakeContractRow) =>
    (a.check_by || '9999-99-99') < (b.check_by || '9999-99-99') ? -1 : 1;
  const sealed = contracts.filter((c) => c.status === 'sealed').sort(byCheckBy);
  const settled = contracts.filter((c) => c.status === 'settled').sort(byCheckBy);
  const overdue = sealed.filter((c) => c.check_by && c.check_by <= today);
  const waiting = sealed.filter((c) => !c.check_by || c.check_by > today);

  const mmdd = (d?: string) => (d && d.length >= 10 ? d.slice(5, 10) : d || '—');
  const label = (c: WakeContractRow) => {
    const raw = (c.predicate || c.text || '').replace(/\s+/g, ' ').trim();
    return raw.length > 24 ? raw.slice(0, 23) + '…' : raw;
  };
  const idCol = (id: string) => (id.length > 10 ? id.slice(0, 9) + '…' : id).padEnd(10);

  const L: string[] = [];
  const headText = W.header + ' ';
  const countText = ' ' + W.counts(contracts.length, sealed.length, settled.length) + ' ';
  // The header+counts row can exceed WIDTH (Korean counts are wide); when it
  // does, the top must GROW rather than clamp its dashes to a floor while the
  // short footer sits at WIDTH — that was the 1-column top/bottom mismatch. Both
  // edges derive from one barWidth: WIDTH, or wider if the top needs it.
  const topFixed = 3 + dw(headText) + dw(countText) + 2; // everything but the dashes
  const barWidth = Math.max(WIDTH, topFixed + 2);
  L.push('┌─ ' + headText + '─'.repeat(barWidth - topFixed) + countText + '─┐');

  const pushGroup = (rows: WakeContractRow[], head: string, line: (c: WakeContractRow) => string, hint?: string) => {
    if (rows.length === 0) return;
    L.push('');
    L.push(hint ? `  ${head}`.padEnd(WIDTH - 2 - hint.length) + hint : `  ${head}`);
    for (const c of rows.slice(0, WAKE_TOP)) L.push(`    ${line(c)}`);
    if (rows.length > WAKE_TOP) L.push(`    ${W.more(rows.length - WAKE_TOP)}`);
  };

  // Lead with the bet, not the raw id — "s6/s3" leading forced a busy operator to
  // parse codes before the plain-English bet (experience loop, scale_juggler; same
  // "cold code label" call as the premise P-refs). The id trails as a quiet
  // reference the host can settle by; "past check-by" alone, no day-count.
  pushGroup(
    overdue,
    W.overdue_group(overdue.length),
    (c) => `"${label(c)}"   ${mmdd(c.check_by)}  ·  ${c.id}`,
    W.overdue_hint,
  );

  pushGroup(waiting, W.waiting_group(waiting.length), (c) => `"${label(c)}"   ${W.answer_on(mmdd(c.check_by))}  ·  ${c.id}`);

  pushGroup(
    settled,
    W.settled_group(settled.length, stats.held, stats.avoided, stats.partial, stats.missed),
    (c) => `"${label(c)}"   ${c.outcome ? W.outcome_label(c.outcome) : '—'}  ${mmdd(c.settled_on || c.check_by)}  ·  ${c.id}`,
  );

  L.push('');
  const foot = recordSince ? ' ' + W.record_since(recordSince) + ' ' : '';
  L.push('└' + '─'.repeat(Math.max(2, barWidth - 3 - dw(foot))) + foot + '─┘');
  return L.join('\n');
}

// Display width: Hangul/CJK/fullwidth and the ⚓ anchor render as TWO terminal
// columns while String.length counts them as one. Every box border was built
// from `.length`, so a Korean header/footer made the top and bottom edges
// disagree by several columns — the keepsake's frame did not close. Both edges
// are now derived from one target WIDTH using this measure.
const WIDE = /[ᄀ-ᇿ⺀-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦⚓]/;
function dw(s: string): number {
  let w = 0;
  for (const ch of s) w += WIDE.test(ch) ? 2 : 1;
  return w;
}

function wrap(s: string, width = 54): string {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur += ' ' + w;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.join('\n    ');
}
