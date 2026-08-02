/**
 * Byte-parity proves the two trees hold the same FILE. It cannot prove both
 * trees CALL it.
 *
 * premises-core-drift.test.ts is one of this repo's strongest guards: six pure
 * modules are copied byte-for-byte into argus-mcp so that a premise means the
 * same thing in a browser and in a terminal, and any divergence fails the build.
 * It has been green for weeks.
 *
 * Measured 2026-08-03, while fixing a defect it could not see:
 *
 *   · `attributesStanceToUser` — the rule that stops a model asserting what
 *     matters to someone — was called by the webapp and by nothing in the MCP.
 *     So a terminal agent could record "연봉보다 팀이 더 중요하다" as the user's
 *     own load-bearing premise, and Argus would return weeks later and ask them
 *     to re-check a belief they never expressed.
 *
 *   · `decisive-premises.ts`, which CLAUDE.md calls the single authority "read
 *     by admission, budget, display, seal, return", has ZERO importers in the
 *     MCP tree. The five-kind taxonomy sits there as dead bytes while the
 *     terminal's premise tool knows two kinds. The drift guard proves the
 *     strongest possible thing about a file that does nothing in one of the two
 *     trees it was copied into.
 *
 * A copy nobody calls is not a shared brain, it is a shared filename. This test
 * asks the question the drift guard cannot: is it wired at both ends?
 *
 * Waivers are the point, not an escape hatch. An inert module is allowed — some
 * are staged ahead of a wire change that needs founder approval — but it has to
 * be WRITTEN DOWN, so "we share this" stops being able to mean two things.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const ROOT = process.cwd();

/** Mirrors PAIRS in premises-core-drift.test.ts. Kept in sync by the test below
 *  that reads that file, so adding a pair there without adding it here fails. */
const SHARED = [
  'canonical-scales',
  'numeric-drift',
  'premises-core',
  'premise-shape',
  'decisive-premises',
  'premise-claim',
];

/**
 * Modules deliberately inert in one tree, with the reason and what would end it.
 *
 * Written 2026-08-03 from measurement, not from intent. Every line here is a
 * fact about the code today; none of them is an endorsement.
 */
const INERT: Record<string, { tree: 'mcp' | 'web'; why: string }> = {
  'decisive-premises': {
    tree: 'mcp',
    why:
      'The five-kind taxonomy is not wired into the terminal. argus_premises '
      + 'accepts kind: premise | open_question only, so KIND_POLICY has nothing '
      + 'to gate there. Expanding the MCP kind vocabulary is a change to a public '
      + 'wire, which BLUEPRINT §9.11 무접촉 경계 puts behind founder approval — so '
      + 'the file is staged for that change and reads as inert until then. What '
      + 'ends this waiver: the MCP premise schema admitting fact/standard/'
      + 'prediction, at which point policyFor gates admission in both trees.',
  },
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: string[];
    try { entries = readdirSync(d); } catch { return; }
    for (const name of entries) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules' || name === '__tests__' || name === 'dist') continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') && !/\.test\.tsx?$/.test(name)) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

const WEB_FILES = sourceFiles(join(ROOT, 'src'));
const MCP_FILES = sourceFiles(join(ROOT, 'argus-mcp/src'));

/** Files that import the module, by the specifier both trees use ('./name' or
 *  './name.js' — the only sanctioned difference between the copies). */
function importersOf(module: string, files: string[]): string[] {
  const pattern = new RegExp(`from\\s+['"][^'"]*/${module}(\\.js)?['"]`);
  return files
    .filter((f) => basename(f, '.ts') !== module)
    .filter((f) => pattern.test(readFileSync(f, 'utf8')));
}

describe('a shared module is wired at both ends, or says why not', () => {
  it('covers exactly the pairs the drift guard protects', () => {
    // If a seventh module is copied into the MCP and only the drift guard knows,
    // this test would silently stop covering it — the shape of gap it exists to
    // find, arriving in the guard itself.
    const driftSrc = readFileSync(join(ROOT, 'src/lib/__tests__/premises-core-drift.test.ts'), 'utf8');
    const pairs = [...driftSrc.matchAll(/'src\/lib\/([a-z0-9-]+)\.ts'/g)].map((m) => m[1]);
    expect([...pairs].sort()).toEqual([...SHARED].sort());
  });

  it('reads both trees (a broken walk would pass everything)', () => {
    expect(WEB_FILES.length).toBeGreaterThan(200);
    expect(MCP_FILES.length).toBeGreaterThan(50);
  });

  it.each(SHARED)('%s is imported in the webapp', (module) => {
    const waiver = INERT[module];
    if (waiver?.tree === 'web') return;
    expect(
      importersOf(module, WEB_FILES).length,
      `${module} is copied for parity but nothing in src/ imports it`,
    ).toBeGreaterThan(0);
  });

  it.each(SHARED)('%s is imported in the MCP', (module) => {
    const waiver = INERT[module];
    if (waiver?.tree === 'mcp') return;
    expect(
      importersOf(module, MCP_FILES).length,
      `${module} is copied into argus-mcp byte-for-byte and imported by nothing `
      + `there. Byte-parity then proves the two trees hold the same file while `
      + `one of them never runs it — wire it, or add it to INERT with the reason `
      + `and what would end the waiver`,
    ).toBeGreaterThan(0);
  });

  it('every waiver still names a shared module, and still tells the truth', () => {
    for (const [module, waiver] of Object.entries(INERT)) {
      expect(SHARED, `INERT names ${module}, which is not a shared module`).toContain(module);
      // A waiver that outlives its condition is worse than no waiver: it reads
      // as a considered decision while describing a state that ended.
      const files = waiver.tree === 'mcp' ? MCP_FILES : WEB_FILES;
      expect(
        importersOf(module, files),
        `${module} is waived as inert in ${waiver.tree}, but something imports it `
        + `now. Delete the waiver — the gap it described is closed`,
      ).toEqual([]);
      expect(waiver.why.length).toBeGreaterThan(80);
    }
  });
});
