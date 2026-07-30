/**
 * The landing layout contract.
 *
 * Founder, on the shipped page: "뭔가 배열이나 배치가 엉성해. 프로페셔널한
 * 디자이너의 손길이 아냐." Measured on the real page at 1280px, three things were
 * actually out of true — none of them visible in the code, all of them visible
 * to the eye:
 *
 *   1. The three use-case cards told the same story in parallel but their beats
 *      did not share a line. Card 3 opens with a one-line file chip instead of a
 *      two-line quote, which lifted its premise label and its "… 두 달 뒤 …" rule
 *      19px above the other two.
 *   2. The mascot box carried the PLATE's aspect (1.71) while the cutout is
 *      1.41, so object-contain letterboxed the dog with 17px of transparent
 *      margin per side — the drawn figure stopped short of the column edge it
 *      was meant to align with.
 *   3. `justify-between` in the header left a 234px hole between the text and
 *      the dog: leftover space, not a declared gap.
 *
 * Each fix is structural, so each can be guarded. What cannot be guarded here is
 * whether it LOOKS right — that is what the browser pass is for.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf-8');

const CSS = read('app/globals.css');
const USE_CASES = read('components/landing/UseCases.tsx');
const MASCOT = read('components/brand/ArgusMascot.tsx');
const ACT2 = read('components/landing/voyage/Act2DecisionVoyage.tsx');

describe('use-case gallery shares one baseline grid', () => {
  it('declares the six shared rows and spans them with subgrid', () => {
    expect(CSS).toMatch(/\.uc-gallery\s*\{[^}]*display:\s*flex/);
    expect(CSS).toMatch(/grid-template-rows:\s*repeat\(6,\s*auto\)/);
    expect(CSS).toMatch(/\.uc-card\s*\{[^}]*grid-template-rows:\s*subgrid[\s\S]*?grid-row:\s*span 6/);
  });

  it('only turns the grid on where three columns exist', () => {
    // Stacked in one column, subgrid buys no alignment and the row-gap needed
    // BETWEEN cards would leak into the six beats inside each one.
    const at = CSS.indexOf('.uc-card');
    expect(CSS.lastIndexOf('@media (min-width: 768px)', at)).toBeGreaterThan(-1);
  });

  it('renders each card through the contract, not a flex column', () => {
    expect(USE_CASES).toContain('uc-gallery');
    expect(USE_CASES).toContain('uc-card');
    // `margin-top: auto` was how the tap-backs used to be bottom-aligned; with
    // shared rows it is both unnecessary and wrong (it re-floats card 2's
    // one-line outcome into the middle of a gap).
    expect(USE_CASES).not.toContain("marginTop: 'auto'");
  });

  it('gives the header a declared gap instead of leftover space', () => {
    expect(USE_CASES).not.toMatch(/flex items-end justify-between/);
    expect(USE_CASES).toMatch(/grid items-end gap-x-\[clamp\(/);
  });
});

describe('a plate-less mascot box is the artwork, not the plate', () => {
  it('carries each cutout its own aspect and drops the plate width', () => {
    expect(MASCOT).toMatch(/cutAspect:\s*809 \/ 575/); // the landing dog
    expect(MASCOT).toMatch(/replace\(\/\(\^\|\\s\)w-\\S\+\/, '\$1w-auto'\)/);
    expect(MASCOT).toMatch(/aspectRatio:\s*String\(config\.cutAspect\)/);
  });
});

describe('the decision record reads as a document, not a table', () => {
  it('separates its two columns with an inset gutter, not a full-height rule', () => {
    expect(CSS).toMatch(/\.dr-cols\b/);
    expect(CSS).toMatch(/background-size:\s*1px calc\(100% - \d+px\)/);
    expect(ACT2).toContain('dr-cols');
    // The old rule ran the full band height and met the horizontal rules head-on.
    expect(ACT2).not.toContain('inset -1px 0 0 var(--bp-ink-faint)');
  });

  it('keeps the jargon out of the example record', () => {
    // Plain words were the ask; these are the two that failed it.
    expect(ACT2).not.toContain('잔존율');
    expect(ACT2).not.toContain('확인할 현실');
  });
});
