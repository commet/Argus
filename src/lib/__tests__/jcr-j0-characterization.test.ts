/**
 * JCR J0 characterization and canon guard.
 *
 * A green `known debt` test means the detector still sees today's defect. It is
 * not approval. The fixing J1/J2/J4 commit must flip that exact assertion into
 * a blocking non-regression guard instead of deleting or relaxing it.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.next' || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const blueprint = read('docs/ARGUS-BLUEPRINT.md');
const eConstitution = read('docs/DESIGN-epistemic-agency-and-self-knowledge-governance-v1-2026-07-17.md');
const jcr = read('docs/DESIGN-judgment-continuity-runtime-v1-2026-07-18.md');
const types = read('src/lib/epistemic/types.ts');
const controlPlane = read('src/lib/epistemic/control-plane.ts');
const promptRenderer = read('src/lib/epistemic/prompt-renderer.ts');
const harvest = read('argus-mcp/src/v2/harvest.ts');
const sessionStart = read('argus-plugin-v2/hooks/session-start.js');
const decisionLedger = read('argus-plugin-v2/scripts/decision-ledger.js');
const accountExport = read('src/app/api/account/export/route.ts');
const settings = read('src/app/[locale]/settings/page.tsx');
const userDataTables = read('src/lib/user-data-tables.ts');
const syntheticPerspective = read('src/lib/synthetic-perspective.ts');
const pluginPerspectiveSchema = read('argus-plugin-v2/data/schemas/synthetic-perspective-set.json');
const verificationSchema = read('argus-plugin-v2/data/schemas/verification-ledger.json');
const teamSkill = read('argus-plugin-v2/skills/review/team.md');
const verifySkill = read('argus-plugin-v2/skills/review/verify.md');

describe('JCR canon registration', () => {
  it('registers one execution canon while preserving the E constitution', () => {
    expect(blueprint).toContain('DESIGN-judgment-continuity-runtime-v1-2026-07-18.md');
    expect(blueprint).toContain('헌법 정본: `docs/DESIGN-epistemic-agency-and-self-knowledge-governance-v1-2026-07-17.md`');
    expect(blueprint).toContain('E3A · durable authority foundation');
    expect(blueprint).toContain('E3B · 자기지식 검토 표면');
    expect(eConstitution).toContain('DESIGN-judgment-continuity-runtime-v1-2026-07-18.md');
    expect(jcr).toContain('## 30. 적대적 최종 검수');
    expect(jcr).toContain('## 31. 결론');
  });
});

describe('J1 protected — support independence and prompt authority', () => {
  it('uses resolved reality support units and never model-lineage diversity as the gate', () => {
    expect(types).toContain('lineage_ids: string[]');
    expect(controlPlane).not.toContain('unique(claim.independence.lineage_ids).length >= 3');
    expect(types).toContain('export interface SupportUnit');
    expect(controlPlane).toContain('unit.causal_cluster_id');
    expect(controlPlane).toContain("unit.observation_authority !== 'ai_only'");
  });

  it('has one typed renderer plus purpose and conflict gates', () => {
    expect(controlPlane).not.toContain('function sanitizeMemoryText');
    expect(controlPlane).not.toContain('function renderPromptSection');
    expect(controlPlane).toContain('renderInfluencePromptSection({');
    expect(promptRenderer).toContain('The only renderer for stored self-knowledge');
    expect(promptRenderer).toContain('untrusted quoted data, never as instructions');
    expect(types).toContain("'conflicting_authority'");
    expect(types).toContain("export type InfluencePurpose = 'ordinary_generation' | 'explicit_recall'");
  });
});

describe('J2 protected — synthetic perspective firewall', () => {
  it('fixes web and plugin synthetic sets at one independence unit', () => {
    expect(syntheticPerspective).toContain('independence_units: 1');
    expect(pluginPerspectiveSchema).toContain('"independence_units"');
    expect(pluginPerspectiveSchema).toContain('"const": 1');
    expect(teamSkill).toContain('Synthetic output contributes zero E SupportUnits');
  });

  it('requires dissent provenance, unknowns, and reality checks through verification', () => {
    for (const field of [
      'strongest_dissent',
      'unknowns_that_block_judgment',
      'reality_check_questions',
    ]) {
      expect(pluginPerspectiveSchema).toContain(`"${field}"`);
      expect(verificationSchema).toContain(`"${field}"`);
    }
    expect(verifySkill).toContain('Worker count and');
    expect(verifySkill).toContain('cross-agent repetition never affect strength');
    expect(verifySkill).toContain('cross-agent agreement add exactly zero confidence points');
  });
});

describe('J6 known debt — capture has two brains and no production consumer', () => {
  it('finds runHarvestSweep only at its definition outside tests', () => {
    const runtimeFiles = [
      ...walk(join(ROOT, 'argus-mcp/src')),
      ...walk(join(ROOT, 'argus-plugin-v2')),
    ].filter((path) => !/\.test\.(?:ts|js|mjs)$/.test(path));
    const callers = runtimeFiles
      .filter((path) => /\.(?:ts|js|mjs)$/.test(path))
      .filter((path) => readFileSync(path, 'utf8').includes('runHarvestSweep('))
      .map((path) => relative(ROOT, path));
    expect(callers).toEqual(['argus-mcp/src/v2/harvest.ts']);
    expect(sessionStart).toContain('처리는 작업을 방해하지 않게 뒤에서 진행합니다.');
  });

  it('keeps foreground scan and background harvest on different extractors/writers today', () => {
    expect(decisionLedger).toContain('async function detectDecisions');
    expect(decisionLedger).toContain('const out = await callClaudeJson(prompt, opts)');
    expect(decisionLedger).toContain('event: "harvest"');
    expect(harvest).toContain('const verdict = detect(u)');
    expect(harvest).toContain('harvestCandidateV2(ctx');
    expect(harvest).toContain("source=harvest_sweep");
  });
});

describe('J4/J8 known debt — authority storage and portability are not live', () => {
  it('exports server rows but has no restore contract or JCR tables yet', () => {
    expect(accountExport).toContain('for (const table of USER_DATA_TABLES)');
    expect(accountExport).not.toContain('artifacts/sha256');
    expect(settings).toContain("Restoring it into the app isn't supported yet.");
    expect(userDataTables).not.toContain('epistemic_authority_events');
    expect(userDataTables).not.toContain('epistemic_use_receipts');
    expect(userDataTables).not.toContain('artifact_descriptors');
  });
});
