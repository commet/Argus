import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_REGISTRY } from '../agent-registry';

/**
 * Parity guard: argus-plugin-v2/data/agents.yaml declares itself a ONE-WAY sync
 * from the webapp's AGENT_REGISTRY ("webapp is canonical"). Nothing enforced it,
 * so the two rosters could drift for weeks unnoticed — exactly the recurring
 * schema-sync failure class called out in CLAUDE.md (a synced surface looks fine
 * in the UI while it has silently diverged). This test fails the build the moment
 * the agent id/name rosters diverge, so the sync can no longer rot in silence.
 *
 * When you intentionally change the roster: update BOTH agent-registry.ts and
 * agents.yaml in the same commit, then this test passes again.
 */

const YAML_PATH = join(process.cwd(), 'argus-plugin-v2', 'data', 'agents.yaml');

interface YamlAgent {
  id: string;
  ko: string;
  en: string;
}

/**
 * Minimal, dependency-free parse of the agent blocks. Each agent block begins
 * with `- id: <id>` and its first `name: { ko: "..", en: ".." }` line is its
 * display name. We deliberately do NOT pull in a YAML library for one guard test.
 */
function parseYamlAgents(text: string): YamlAgent[] {
  const out: YamlAgent[] = [];
  const re =
    /-\s*id:\s*([A-Za-z0-9_]+)[\s\S]*?name:\s*\{\s*ko:\s*"([^"]*)"\s*,\s*en:\s*"([^"]*)"\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ id: m[1], ko: m[2], en: m[3] });
  }
  return out;
}

describe('agents.yaml ↔ AGENT_REGISTRY parity', () => {
  const text = readFileSync(YAML_PATH, 'utf8');
  const yamlAgents = parseYamlAgents(text);
  const yamlById = new Map(yamlAgents.map((a) => [a.id, a]));
  const regById = new Map(AGENT_REGISTRY.map((a) => [a.agentId, a]));

  it('parses every agent block in agents.yaml (sanity)', () => {
    // If the regex silently matched nothing, every other assertion would be a
    // false pass — anchor on a count comparable to the registry.
    expect(yamlAgents.length).toBeGreaterThanOrEqual(AGENT_REGISTRY.length);
  });

  it('every registry agent exists in agents.yaml', () => {
    const missing = AGENT_REGISTRY.filter((a) => !yamlById.has(a.agentId)).map(
      (a) => a.agentId,
    );
    expect(missing, `agents.yaml is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('every agents.yaml agent exists in the registry', () => {
    const extra = yamlAgents
      .filter((a) => !regById.has(a.id))
      .map((a) => a.id);
    expect(
      extra,
      `agents.yaml has agents absent from the registry: ${extra.join(', ')}`,
    ).toEqual([]);
  });

  it('ko + en display names match for every shared agent', () => {
    const mismatches: string[] = [];
    for (const r of AGENT_REGISTRY) {
      const y = yamlById.get(r.agentId);
      if (!y) continue; // covered by the missing-agent test above
      if (y.ko !== r.name)
        mismatches.push(`${r.agentId}.ko: registry="${r.name}" yaml="${y.ko}"`);
      if (y.en !== r.nameEn)
        mismatches.push(
          `${r.agentId}.en: registry="${r.nameEn}" yaml="${y.en}"`,
        );
    }
    expect(mismatches, mismatches.join(' ; ')).toEqual([]);
  });
});
