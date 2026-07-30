/**
 * The landing animation contract.
 *
 * Measured on the hero film (2026-07-29, video PAUSED so only the caption is
 * moving, 4x CPU throttle, Chrome Performance.getMetrics over one reveal):
 *
 *     old reveal (mask-position sweep + a nib animating `left`)  → 188 layouts
 *     new reveal (per-word opacity + transform)                  →  25 layouts
 *
 * `left` is a layout property and `mask-position` is a paint property; neither
 * is composited, so animating them runs layout/paint on the main thread every
 * frame — on top of a decoding video and a backdrop-filter panel. That is what
 * "나오다가 중간에 끊겼다가" was. The 25 remaining layouts are mount cost, not
 * per-frame cost.
 *
 * So: on the landing film, animate ONLY compositor-owned properties. If a future
 * effect needs something else, it needs a measurement in this file, not a hope.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FILM = readFileSync(
  join(__dirname, '..', '..', 'components/landing/films/VoyageFilm.tsx'),
  'utf-8',
);

// The banned-shape checks run against CODE only. The file documents the bug it
// is guarding against — including the names of the removed knobs — and a guard
// that trips on its own explanation teaches people to delete the explanation.
const CODE = FILM.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Everything outside this set forces layout or paint per frame.
const COMPOSITED = ['opacity', 'transform', 'x', 'y', 'scale', 'rotate', 'scaleX', 'scaleY'];

// framer-motion props that drive an animation, and the properties they may name.
const ANIMATION_PROPS = /\b(?:initial|animate|exit|whileHover|whileInView)=\{\{([^}]*)\}\}/g;

describe('landing film animation contract', () => {
  it('animates only compositor-owned properties', () => {
    const offenders: string[] = [];
    for (const m of CODE.matchAll(ANIMATION_PROPS)) {
      for (const key of m[1].matchAll(/(?:^|[,{\s])([A-Za-z][A-Za-z0-9]*)\s*:/g)) {
        if (!COMPOSITED.includes(key[1])) offenders.push(key[1]);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('keeps the two properties that were measured as the regression out entirely', () => {
    // The exact pair that produced 188 layouts. Named explicitly so a rename or
    // a reintroduction under a different animation API still trips this.
    expect(CODE).not.toContain('maskPosition');
    expect(CODE).not.toMatch(/animate=\{\{[^}]*\bleft\s*:/);
  });

  it('reveals the quote on ONE constant cadence, with no pause between clauses', () => {
    // Two shapes produced "나오다가 중간에 끊겼다가", and both must stay gone:
    //  · a per-clause duration (speed jumped at every clause boundary)
    //  · CLAUSE_PAUSE_SHARE, which spent 30% of the budget as silence between
    //    clauses — a 0.99s dead stop mid-quote on chapter I. It was authored,
    //    not dropped frames, which is why "making it smoother" never touched it.
    expect(CODE).not.toContain('CLAUSE_PAUSE_SHARE');
    expect(CODE).not.toContain('pauseEach');
    expect(CODE).not.toMatch(/Math\.min\(0\.85,\s*Math\.max\(0\.46/);
    // One `step` for the whole quote, and the word index that consumes it.
    expect(CODE).toMatch(/const step = words > 1 \? budget \/ words : 0;/);
    expect(CODE).toMatch(/delay: QUOTE_START \+ \(offset \+ i\) \* step/);
  });
});
