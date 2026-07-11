/**
 * Design-register contract — the two-register rule, enforced (A2 hardening).
 *
 * Argus deliberately runs two visual registers:
 *   1. logbook/blueprint (--bp-*): the landing's ceremonial voice — parchment,
 *      navy ink, gold leaf, seal-stamp drama. Root-scoped via `.bp-root`.
 *   2. concert-hall (app tokens): the working surfaces, whose posture is
 *      RESTRAINT (CLAUDE.md zero-judgment mirror clause).
 *
 * Agreed rule (internal design notes C2): the calm MATERIAL half of the
 * blueprint language (paper / ink) may be shared into the app; the CEREMONY
 * half (gold leaf, seal-stamp) must never leak — a working surface that
 * borrows the landing's celebratory gold or the wax-seal gesture imports a
 * verdict-by-styling the spine forbids.
 *
 * Physically moving --bp-* under .bp-root would break sanctioned app
 * consumers (project page, error pages, ChartPlate, VoyageElements), so the
 * boundary is enforced here instead, the same way persistence-contract.test.ts
 * blocks stray storage keys:
 *   - CEREMONY tokens/classes: banned everywhere outside src/components/landing.
 *   - MATERIAL tokens: allowed outside landing only for files on the
 *     sanctioned list below. Adding a new consumer is a deliberate act — add
 *     it here with a reason, or use the app tokens (--bg/--surface/--text-*).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..');

/** Files outside src/components/landing that may use MATERIAL bp tokens. */
const MATERIAL_SANCTIONED = new Set<string>([
  // The project page is the app-interior reference screen for the chart
  // language (empty-state 해도) — deliberate material borrow.
  'app/[locale]/project/page.tsx',
  // Failure surfaces wear the calm paper register on purpose.
  'app/error.tsx',
  'app/not-found.tsx',
  // Shared chart primitives (Graticule etc.) — material by definition.
  'components/ui/ChartPlate.tsx',
  'components/ui/VoyageElements.tsx',
  // Chart-language surfaces mounted on the (sanctioned) project page: the
  // fleet sea-chart and the voyage logbook wear the same paper/ink material
  // as ChartPlate they sit on. Material only — no ceremony (verified by the
  // ceremony test above). Deliberate borrow, same register as the page.
  'components/projects/FleetChart.tsx',
  'components/projects/Logbook.tsx',
]);

/** Ceremony vocabulary that must never appear outside the landing register. */
const CEREMONY = [/--bp-gold/, /--bp-azure/, /bp-seal-stamp/, /bp-btn-primary/];
const MATERIAL = /--bp-(paper|ink)[a-z-]*/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).filter((p) => {
  const rel = relative(SRC, p).replace(/\\/g, '/');
  return !rel.startsWith('components/landing/');
});

describe('design-register contract (two registers, one boundary)', () => {
  it('ceremony vocabulary (--bp-gold, seal-stamp, …) never leaks outside the landing register', () => {
    const offenders: string[] = [];
    for (const p of files) {
      const src = readFileSync(p, 'utf-8');
      for (const rx of CEREMONY) {
        if (rx.test(src)) {
          offenders.push(`${relative(SRC, p)} → ${rx.source}`);
          break;
        }
      }
    }
    expect(offenders, `Ceremony register leaked into working surfaces:\n${offenders.join('\n')}\n` +
      'Gold/seal drama belongs to the landing only; working surfaces stay restrained (C2).').toEqual([]);
  });

  it('material bp tokens outside landing appear only in sanctioned files', () => {
    const offenders: string[] = [];
    for (const p of files) {
      const rel = relative(SRC, p).replace(/\\/g, '/');
      if (MATERIAL_SANCTIONED.has(rel)) continue;
      const src = readFileSync(p, 'utf-8');
      if (MATERIAL.test(src)) offenders.push(rel);
    }
    expect(offenders, `Unsanctioned --bp-(paper|ink) consumers:\n${offenders.join('\n')}\n` +
      'Either use the app tokens, or add the file to MATERIAL_SANCTIONED with a reason.').toEqual([]);
  });
});
