import type { Receipt } from './receipt.js';

/**
 * Renders a settled Judgment Receipt as shareable monospace text (blueprint
 * §5.2 + addendum M6). No ✗ grade stamp — a "YOU PREDICTED / WHAT HAPPENED"
 * diff. Reality is shown; the user is never graded. The AI-VERDICT … NONE line
 * is always present and always NONE.
 */
export function renderReceipt(r: Receipt): string {
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
  L.push(`    ${show(r.unverified_assumption, 'unverified_assumption')}`);
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
