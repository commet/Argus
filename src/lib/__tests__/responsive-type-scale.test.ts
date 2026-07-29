import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard for the 2026-07-28 legibility sweep (1,080 edits across 112 files).
 *
 * That sweep raised every hardcoded type size one step, and its own commit message
 * warns that a chained `sed` re-bumps values it already bumped. One artifact of it
 * survived review: a chart label left at `text-[13px] sm:text-[12px]` — type that
 * SHRINKS on a wider screen, while both of its siblings in the same file grow
 * (12 → 12.5). Nobody designs that; a batch rewrite produces it, and no test could
 * see it because each half is individually plausible.
 *
 * A responsive step may hold a size or raise it. Going down is a rewrite artifact.
 * This is deliberately narrow — it does not police absolute sizes (decorative
 * badges and avatar initials legitimately sit below body text), only the direction
 * of a breakpoint step, which has exactly one correct answer.
 */

const BREAKPOINT_STEP = /text-\[([0-9.]+)px\]\s+(sm|md|lg|xl|2xl):text-\[([0-9.]+)px\]/g;

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('responsive type scale never steps down', () => {
  const files = tsxFiles(join(process.cwd(), 'src'));

  it('scans a real set of components (never passes vacuously)', () => {
    expect(files.length).toBeGreaterThan(100);
    const withSteps = files.filter((f) => new RegExp(BREAKPOINT_STEP.source).test(readFileSync(f, 'utf8')));
    expect(withSteps.length, 'the pattern stopped matching — fix the regex, not the assertion').toBeGreaterThan(3);
  });

  it('has no breakpoint that makes text smaller on a wider screen', () => {
    const inverted: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const m of line.matchAll(BREAKPOINT_STEP)) {
          if (Number(m[3]) < Number(m[1])) {
            inverted.push(`${file.replace(process.cwd(), '').replace(/\\/g, '/')}:${i + 1} — ${m[0]}`);
          }
        }
      });
    }
    expect(inverted, `type shrinks at a breakpoint:\n${inverted.join('\n')}`).toEqual([]);
  });
});
