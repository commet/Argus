import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Spine guard (mirror of the plugin's forbidden-transition gate, ported to the
 * webapp render layer): the user-facing progressive flow must surface the WORK,
 * not the MACHINERY. It must not sell "how many agents ran" or stage a named
 * agent "losing a debate" — the plugin forbids exactly these strings (sail
 * SKILL.md "Forbidden transition strings" / "do not make the user care how many
 * agents ran") and the webapp was leaking them (MixPreview "항해장의 한마디" /
 * "Team Dissent" + 💀 + agent attribution, fixed 2026-06-24).
 *
 * If you are reintroducing one of these, you are almost certainly violating the
 * zero-judgment spine — surface the synthesis impersonally instead.
 */

const DIR = join(process.cwd(), 'src', 'components', 'workspace', 'progressive');

// Machinery-persona labels that must never appear in user-facing copy.
const BANNED = [
  '항해장의 한마디',
  'Navigator Note',
  '팀 내 반론',
  'Team Dissent',
];

function collectTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue; // don't scan ourselves
      out.push(...collectTsx(full));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('progressive flow: no machinery-persona leak (spine)', () => {
  const files = collectTsx(DIR);

  it('scans the progressive component tree (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('contains no banned machinery-persona labels', () => {
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const phrase of BANNED) {
        if (text.includes(phrase)) {
          hits.push(`${f.replace(process.cwd(), '.')}: "${phrase}"`);
        }
      }
    }
    expect(hits, `machinery-persona label leaked:\n${hits.join('\n')}`).toEqual(
      [],
    );
  });
});
