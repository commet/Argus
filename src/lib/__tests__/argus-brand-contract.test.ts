/**
 * Argus brand contract: the dog is a product state, not ambient decoration.
 * See docs/ARGUS-BRAND-CANON.md before adding a full-illustration surface.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const source = walk(SRC).map((path) => ({
  path,
  rel: relative(SRC, path).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf-8'),
}));

const FULL_PRESENCE_SURFACES = new Set([
  'app/[locale]/project/page.tsx',
  'components/brand/ArgusCompanionNote.tsx',
  'components/landing/UseCases.tsx',
  'components/projects/SettlementModal.tsx',
  'components/ui/LoadingSteps.tsx',
  'components/workspace/InteractiveDemo.tsx',
  'components/workspace/progressive/SealMoment.tsx',
]);

describe('Argus brand canon', () => {
  it('removes legacy file-driven APIs and tiny raster usage', () => {
    const joined = source.map(({ text }) => text).join('\n');
    const mascot = source.find(({ rel }) => rel === 'components/brand/ArgusMascot.tsx')?.text;
    expect(joined).not.toContain('/images/brand/argus/');
    expect(joined).not.toMatch(/<ArgusMascot[^>]+variant=/);
    expect(joined).not.toMatch(/<ArgusMascot[^>]+size=["']xs["']/);
    expect(joined).not.toMatch(/<ArgusMascot[^>]+playful/);
    expect(mascot).toContain("sm: 'w-16 h-20'");
    expect(mascot).toContain("sm: 'w-16 h-16'");
    expect(mascot).toContain("sm: 'w-28 h-16'");
  });

  it('allows full illustration only on explicitly canonical surfaces', () => {
    const actual = source
      .filter(({ rel, text }) => rel !== 'components/brand/ArgusMascot.tsx' && /<ArgusMascot\b/.test(text))
      .map(({ rel }) => rel)
      .sort();
    expect(actual).toEqual([...FULL_PRESENCE_SURFACES].sort());
  });

  it('requires every full presence to declare a product moment', () => {
    const offenders: string[] = [];
    for (const { rel, text } of source) {
      if (rel === 'components/brand/ArgusMascot.tsx') continue;
      for (const tag of text.matchAll(/<ArgusMascot\b[\s\S]*?\/>/g)) {
        if (!/\bmoment=/.test(tag[0])) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses the small mark at identity and watch/return anchors', () => {
    for (const rel of [
      'components/brand/Logo.tsx',
      'components/landing/LandingHeader.tsx',
      'components/review/PremiseTracker.tsx',
      'app/[locale]/workspace/page.tsx',
      'app/[locale]/project/page.tsx',
    ]) {
      const file = source.find((item) => item.rel === rel);
      expect(file?.text, `${rel} must carry the small Argus mark`).toContain('<ArgusMark');
    }
  });
});
