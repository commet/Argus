import type { Receipt } from './receipt.js';
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
export interface ReceiptPremisesInfo {
  headline?: string;
  tracked: number;
  changed_at_recheck: number;
}

export function renderReceipt(r: Receipt, premises?: ReceiptPremisesInfo): string {
  const L: string[] = [];
  const sealed = r.created_at ? r.created_at.slice(0, 10) : '—';
  const settled = r.settled_at ? r.settled_at.slice(0, 10) : '(open)';

  L.push('┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐');
  L.push(`  Sealed ${sealed}      Settled ${settled}`);
  const skipped = new Set(r.skipped ?? []);
  const show = (v: string, field: string): string => (skipped.has(field) ? '— (you skipped naming this)' : wrap(v));

  L.push('');
  L.push('  THE REAL QUESTION');
  L.push(`    ${show(r.real_question, 'real_question')}`);
  L.push('  THE UNVERIFIED ASSUMPTION');
  const assumptionSkipped = skipped.has('unverified_assumption');
  if (assumptionSkipped && premises?.headline) {
    // The premise set is canonical — a tracked load-bearing premise stands in
    // for a skipped seal-time field (plan v5 §5.4).
    L.push(`    ${wrap(premises.headline)}`);
  } else {
    L.push(`    ${show(r.unverified_assumption, 'unverified_assumption')}`);
  }
  if (premises && premises.tracked > 0) {
    L.push(`    (+${premises.tracked} premise(s) tracked · ${premises.changed_at_recheck} changed at re-check — argus_recall view=premises)`);
  }
  L.push(`  HUMAN-ONLY CALL   ${show(r.human_only, 'human_only')}`);
  L.push('  …made by          Me. (not the model)');
  if (r.basis) {
    L.push(`  …called as        ${r.basis}`);
  }
  L.push('');
  L.push(`  YOU PREDICTED   "${r.predicate}"   (check-by ${r.check_by})`);
  if (r.what_happened) {
    L.push(`  WHAT HAPPENED   ${wrap(r.what_happened)}`);
  }
  L.push('  ─────────────────────────────────────────────────────────');
  L.push('  AI VERDICT ON THIS DECISION ······················  NONE');
  L.push('  The model never graded you. Reality did.');
  L.push('└──────────────────────────────────  argus · seal → settle ─┘');
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
 *  - zero emoji, zero hype — "anchor down" is the only worldbuilding flourish.
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

  const top = '┌─ ' + S.header + ' ' + '─'.repeat(Math.max(2, 56 - S.header.length)) + '┐';
  const bottom = '└' + '─'.repeat(Math.max(2, 54 - S.footer.length)) + '  ' + S.footer + ' ─┘';

  L.push(top);
  L.push('');
  // the quote block — the user's own falsifiable sentence (continuation lines
  // sit inside the opening quote)
  L.push(`  "${wrap(opts.predicate, 50).split('\n    ').join('\n   ')}"`);
  L.push('');
  const ownerLine = `  ${opts.predicate_owner === 'user' ? S.owner_user : S.owner_ai}`;
  const ownerTag = `(predicate_owner: ${opts.predicate_owner})`;
  L.push(ownerLine.length >= 40 ? `${ownerLine}   ${ownerTag}` : ownerLine.padEnd(40) + ownerTag);
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
