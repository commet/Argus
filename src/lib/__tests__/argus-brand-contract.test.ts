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
  'components/review/SettleModal.tsx',
  'components/ui/LoadingSteps.tsx',
  'components/workspace/InteractiveDemo.tsx',
  // 가벼운 길 (light path): the gating/in-flow reading wait is canon state
  // `watching` (a task underway — same state LoadingSteps wears), and the
  // after-accept keepsake carries the `witness` mark (seal completion).
  // Both are product states per docs/ARGUS-BRAND-CANON.md, not decoration.
  'app/[locale]/workspace/page.tsx',
  'components/workspace/light/LightFlow.tsx',
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
    expect(joined).not.toContain('ArgusMark');
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

  it('uses the canonical face crop only for identity, never status controls', () => {
    const logo = source.find((item) => item.rel === 'components/brand/Logo.tsx')?.text;
    const landing = source.find((item) => item.rel === 'components/landing/LandingHeader.tsx')?.text;
    const premise = source.find((item) => item.rel === 'components/review/PremiseTracker.tsx')?.text;
    const project = source.find((item) => item.rel === 'app/[locale]/project/page.tsx')?.text;
    const workspace = source.find((item) => item.rel === 'app/[locale]/workspace/page.tsx')?.text;
    expect(logo).toContain('<ArgusFaceMark');
    expect(landing).toContain('<ArgusFaceMark');
    expect(landing).not.toContain('<ArgusMascot');
    expect(premise).toContain('<Eye');
    expect(project).toContain('<ProjectAttentionList');
    expect(workspace).toContain('<BellRing');
    expect(premise).not.toContain('<ArgusFaceMark');
    expect(project).not.toContain('<ArgusFaceMark');
    expect(workspace).not.toContain('<ArgusFaceMark');
  });
});
