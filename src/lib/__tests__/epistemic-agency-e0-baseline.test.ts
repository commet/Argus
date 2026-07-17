/**
 * E0 epistemic-agency betrayal baseline.
 *
 * IMPORTANT: a green test in a `baseline RED` case means the detector found the
 * known violation in today's source. It does NOT bless that behavior. E1 must
 * remove the violation and flip the same case to a blocking non-regression guard
 * in the fixing commit; do not merely update the expected baseline to hide it.
 *
 * This suite is deliberately source-read-only. E0 owns evaluation and evidence,
 * not runtime behavior, and must not collide with O2/O3/K/P5 implementation.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const contextBuilder = read('src/lib/context-builder.ts');
const userContext = read('src/lib/user-context.ts');
const navigator = read('src/lib/navigator.ts');
const navigatorStrip = read('src/components/workspace/NavigatorStrip.tsx');
const navigatorInline = read('src/components/workspace/NavigatorInline.tsx');
const reframeStep = read('src/components/workspace/ReframeStep.tsx');
const waypointCard = read('src/components/workspace/progressive/shared/WaypointCard.tsx');
const exportSource = read('src/lib/export.ts');
const epistemicTypes = read('src/lib/epistemic/types.ts');
const controlPlane = read('src/lib/epistemic/control-plane.ts');
const vitality = read('src/lib/judgment-vitality.ts');
const decisionQuality = read('src/lib/decision-quality.ts');
const narrate = read('src/lib/voyage-log-narrate.ts');
const voyageLog = read('src/lib/voyage-log.ts');
const rehearse = read('src/components/workspace/RehearseStep.tsx');
const progressive = read('src/components/workspace/progressive/ProgressiveFlow.tsx');
const workspacePage = read('src/app/[locale]/workspace/page.tsx');
const settingsPage = read('src/app/[locale]/settings/page.tsx');
const types = read('src/stores/types.ts');
const blueprint = read('docs/ARGUS-BLUEPRINT.md');
const design = read('docs/DESIGN-epistemic-agency-and-self-knowledge-governance-v1-2026-07-17.md');

type BaselineState = 'known_violation' | 'partial_guard' | 'missing_guard' | 'protected';

const BASELINE: ReadonlyArray<{
  id: `E-B${number}`;
  state: BaselineState;
  surface: 'default' | 'settings' | 'legacy' | 'architecture';
}> = [
  { id: 'E-B1', state: 'protected', surface: 'legacy' },
  { id: 'E-B2', state: 'protected', surface: 'legacy' },
  { id: 'E-B3', state: 'protected', surface: 'default' },
  { id: 'E-B4', state: 'known_violation', surface: 'legacy' },
  { id: 'E-B5', state: 'partial_guard', surface: 'legacy' },
  { id: 'E-B6', state: 'protected', surface: 'legacy' },
  { id: 'E-B7', state: 'protected', surface: 'legacy' },
  { id: 'E-B8', state: 'protected', surface: 'legacy' },
  { id: 'E-B9', state: 'protected', surface: 'legacy' },
  { id: 'E-B10', state: 'protected', surface: 'architecture' },
  { id: 'E-B11', state: 'protected', surface: 'architecture' },
  { id: 'E-B12', state: 'protected', surface: 'settings' },
];

function walkRuntime(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkRuntime(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const runtimeFiles = walkRuntime(join(ROOT, 'src'));

function occurrences(source: string, token: string): number {
  return source.split(token).length - 1;
}

describe('E0 baseline manifest', () => {
  it('contains exactly one classified entry for every E-B1…E-B12 fixture', () => {
    expect(BASELINE.map((item) => item.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `E-B${index + 1}`),
    );
    expect(new Set(BASELINE.map((item) => item.id)).size).toBe(12);
  });

  it('records the E2 shadow state: 1 violation, 1 partial, 0 missing, 10 protected', () => {
    const count = (state: BaselineState) => BASELINE.filter((item) => item.state === state).length;
    expect({
      known_violation: count('known_violation'),
      partial_guard: count('partial_guard'),
      missing_guard: count('missing_guard'),
      protected: count('protected'),
    }).toEqual({ known_violation: 1, partial_guard: 1, missing_guard: 0, protected: 10 });
  });
});

describe('E0 surface inventory — default and legacy are not conflated', () => {
  it('the progressive voyage is the default and ?step= explicitly opens legacy', () => {
    expect(workspacePage).toContain("const explicitStep = searchParams.get('step')");
    expect(workspacePage).toContain('const useLegacyMode = explicitStep &&');
    expect(workspacePage).toContain('if (progressiveSession && !useLegacyMode)');

    const progressiveReturn = workspacePage.indexOf('<ProgressiveLayout');
    const legacyMarker = workspacePage.indexOf('Active workspace: step content (legacy 4-tab mode)');
    const navigatorRender = workspacePage.indexOf('<NavigatorStrip />');
    expect(progressiveReturn).toBeGreaterThan(-1);
    expect(legacyMarker).toBeGreaterThan(progressiveReturn);
    expect(navigatorRender).toBeGreaterThan(legacyMarker);
  });

  it('Chronicler is mounted in the default ProgressiveFlow', () => {
    expect(progressive).toContain("import { useChronicler } from './useChronicler'");
    expect(progressive).toContain('useChronicler(session, !busy)');
  });

  it('cross-history prompt injection and persona synthesis remain legacy call paths', () => {
    expect(workspacePage).toContain("import { ReframeStep } from '@/components/workspace/ReframeStep'");
    expect(workspacePage).toContain("import { RehearseStep } from '@/components/workspace/RehearseStep'");
    expect(workspacePage).toContain("import { ProgressiveFlow } from '@/components/workspace/progressive/ProgressiveFlow'");
    expect(progressive).not.toContain('buildEnhancedSystemPrompt(');
    expect(progressive).not.toContain('common_agreements');
  });
});

describe('E-B1 protected gate — model artifacts cannot silently become a blind-spot instruction', () => {
  it('removes the legacy analyzer and routes any future derived memory through E2', () => {
    expect(contextBuilder).not.toContain('buildAdaptiveContext');
    expect(contextBuilder).not.toContain('getStageEvalSummary');
    expect(contextBuilder).toContain('const eInfluence = buildStoredPromptInfluence({');
    expect(navigatorStrip).not.toContain('buildLearningCurve');
    expect(navigatorStrip).not.toContain('axis_coverage');
    expect(navigatorInline).not.toContain('getStepCoaching');
    expect(reframeStep).not.toContain('Your last ${judgments.length} calls are factored in');
  });
});

describe('E-B2 protected gate — acceptance events cannot silently become preference or pressure', () => {
  it('removes the reframe-acceptance analyzer from the prompt builder', () => {
    expect(contextBuilder).not.toContain('acceptRate');
    expect(contextBuilder).not.toContain('first reframe');
    expect(contextBuilder).toContain('buildStoredPromptInfluence');
  });
});

describe('E-B3 protected gate — AI interpretation cannot occupy a user-reason field', () => {
  it('keeps why_abandoned out of the LLM prompt, response shape, and merge path', () => {
    expect(narrate).not.toMatch(/shape:\s*\{[^}]*why_abandoned/);
    expect(narrate).not.toMatch(/res\.why_abandoned|why_abandoned:\s*why/);
    expect(narrate).not.toContain('WaypointAlternative');
    expect(narrate).toContain("shape: { significance: 'string' }");

    // Generated strategic-fork rationale is also not a user-stated reason.
    expect(voyageLog).toContain("why_abandoned: ''");
    expect(voyageLog).not.toContain('truncate(why, 80)');

    const alternative = types.slice(
      types.indexOf('export interface WaypointAlternative'),
      types.indexOf('export interface Waypoint {', types.indexOf('export interface WaypointAlternative')),
    );
    expect(alternative).toContain('why_abandoned: string');
    expect(alternative).toContain("why_abandoned_source?: 'user' | 'legacy_unknown'");
    expect(waypointCard).toContain("alt.why_abandoned_source === 'user'");
    expect(exportSource).toContain("a.why_abandoned_source === 'user'");
  });
});

describe('E-B4 baseline RED — synthetic lenses are rendered as stakeholder consensus', () => {
  it('asks for what all stakeholders agree on and promotes high-influence concerns', () => {
    expect(rehearse).toContain('모든 이해관계자가 동의하는 포인트 1~3개');
    expect(rehearse).toContain('1-3 points all stakeholders agree on');
    expect(rehearse).toContain('영향력 높은 이해관계자의 우려를 priority "high"로');
    expect(rehearse).toContain("shape: { common_agreements: 'array', key_conflicts: 'array', priority_actions: 'array' }");
  });
});

describe('E-B5 partial guard — conflicts exist, but strongest dissent and missing evidence are not mandatory', () => {
  it('keeps a generic conflict field without a structural dissent/unknown slot', () => {
    expect(rehearse).toContain('key_conflicts');
    expect(rehearse).not.toContain('strongest_dissent');
    expect(rehearse).not.toContain('missing_evidence');
    expect(rehearse).not.toContain('unknowns_that_block_judgment');
  });
});

describe('E-B6 protected baseline — agreeing with AI is not directly penalized', () => {
  it('does not put mind-change into the DQ score or add a low-override coaching branch', () => {
    const scoreFormula = decisionQuality.slice(
      decisionQuality.indexOf('const elements = ['),
      decisionQuality.indexOf('const score: DecisionQualityScore'),
    );
    expect(scoreFormula).not.toContain('userChangedMind');
    expect(navigator).not.toContain('override_rate_low');
    expect(navigator).not.toMatch(/overrideRate\s*</);

    // The token remains in an unused threshold table, but has no detector/callsite.
    expect(occurrences(vitality, 'all_suggestions_accepted')).toBe(1);
  });
});

describe('E-B7 protected gate — changing AI output earns neither praise nor adaptation authority', () => {
  it('keeps override frequency out of insights, coaching, and the visible profile shell', () => {
    expect(navigator).not.toContain("id: 'override_rate_high'");
    expect(navigator).not.toMatch(/if \(profile\.overrideRate > 0\.4\)[\s\S]{0,260}tone: 'positive'/);
    expect(navigatorStrip).not.toContain('profile.overrideRate');
    expect(navigatorStrip).not.toContain('profile.dominantStrategy');
    expect(navigatorInline).not.toContain('getStepCoaching');
  });
});

describe('E-B8 protected gate — stale coda and retrospective text require a future grant', () => {
  it('removes both legacy sources so they cannot bypass the E2 gate', () => {
    expect(contextBuilder).not.toContain('buildCodaInsights');
    expect(contextBuilder).not.toContain('getActionableInsights');
    expect(contextBuilder).not.toContain('OUTCOME_RECORDS');
    expect(contextBuilder).toContain('buildStoredPromptInfluence');
  });
});

describe('E-B9 protected gate — global patterns without a domain boundary stay inert', () => {
  it('has no global analyzer and the E2 context requires an explicit domain', () => {
    expect(contextBuilder).toContain('const judgments = getStorage<JudgmentRecord[]>(STORAGE_KEYS.JUDGMENTS, [])');
    expect(contextBuilder).not.toContain('analyzePatterns');
    expect(contextBuilder).toContain('domain: influence?.domain');
    const judgmentRecord = types.slice(
      types.indexOf('export interface JudgmentRecord'),
      types.indexOf('export interface PersonaAccuracyRating'),
    );
    expect(judgmentRecord).not.toMatch(/domain|scope|valid_from|review_by/);
  });
});

describe('E-B10 protected gate — revoke stops influence on the next prompt attempt', () => {
  it('has explicit grant, trace, single-gate, and revoke contracts', () => {
    expect(epistemicTypes).toContain('export interface InfluenceGrant');
    expect(epistemicTypes).toContain('export interface InfluenceTrace');
    expect(epistemicTypes).toContain('grant_id: string');
    expect(controlPlane).toContain('export function revokeInfluenceGrant');
    expect(controlPlane).toContain('export function buildStoredPromptInfluence');
    expect(contextBuilder).toContain('const eInfluence = buildStoredPromptInfluence({');
  });
});

describe('E-B11 protected gate — counterexamples can contest and stop a claim', () => {
  it('has a counterexample-backed lifecycle without deleting the prior record', () => {
    expect(epistemicTypes).toContain('counterexample_refs: string[]');
    expect(epistemicTypes).toContain("'candidate' | 'endorsed' | 'contested' | 'retired'");
    expect(controlPlane).toContain('export function addClaimCounterexample');
    expect(controlPlane).toContain("lifecycle: args.material ? 'contested' : current.lifecycle");
    expect(controlPlane).toContain("reason: 'contested'");
  });
});

describe('E-B12 protected gate — process telemetry cannot become a verdict or intervention', () => {
  it('keeps DQ trend and override meaning-language out of settings', () => {
    expect(userContext).not.toMatch(/점점 나아지고|꾸준히 잘 하고|최근 좀 러프|Getting better|Been rough lately/);
    expect(userContext).not.toContain('dqTrend');
    expect(userContext).not.toContain("require('./decision-quality')");
    expect(settingsPage).toContain('판단력이나 성향을 평가하지 않아요.');
  });

  it('may retain vitality as dormant telemetry but never routes it into Navigator', () => {
    expect(types).toContain("tier: 'alive' | 'coasting' | 'performing' | 'dead'");
    expect(vitality).toContain("else if (vitalityScore > 0.2) tier = 'performing'");
    expect(vitality).toContain("else tier = 'dead'");
    expect(vitality).toContain('판단 과정이 경직되고 있습니다');
    expect(navigator).not.toContain('analyzeVitalityTrend');
    expect(navigator).not.toContain('getVitalityCoaching');
    expect(navigator).not.toContain('generateInterventions');
    expect(navigator).not.toContain('vitalityAssessments');
  });
});

describe('E1 record-preservation gate — block influence without rewriting history', () => {
  it('keeps the persisted reason contract while making new AI-derived reasons empty', () => {
    expect(types).toContain('why_abandoned: string');
    expect(voyageLog).toContain("why_abandoned: ''");
    expect(voyageLog).not.toContain('why_abandoned: truncate(o.effect.rationale');
  });

  it('the quarantine path is read-only and does not delete stored observations', () => {
    for (const source of [contextBuilder, userContext, navigator]) {
      expect(source).not.toContain('removeStorage(');
      expect(source).not.toContain('localStorage.removeItem(');
    }
    expect(contextBuilder).not.toContain('setStorage(');
  });
});

describe('E0 boundary evidence — evaluation only, no runtime owner grab', () => {
  it('the normative documents freeze O2/O3/K/P5 paths as no-touch', () => {
    for (const token of [
      'argus-plugin-v2/scripts/decision-ledger.js',
      'argus-mcp/src/v4/**',
      'src/lib/semantic-v4/**',
      '웹 공정 5',
    ]) {
      expect(`${blueprint}\n${design}`).toContain(token);
    }
  });

  it('this baseline scans runtime but lives outside the runtime corpus', () => {
    const rels = runtimeFiles.map((path) => relative(ROOT, path).replace(/\\/g, '/'));
    expect(rels.some((path) => path.includes('/__tests__/'))).toBe(false);
    expect(rels).not.toContain('src/lib/__tests__/epistemic-agency-e0-baseline.test.ts');
  });
});
