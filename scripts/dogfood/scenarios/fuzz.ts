/**
 * Model-based fuzz: a seeded random walk of lifecycle commands over many
 * projects, where a tiny reference model predicts what the product MUST do
 * (admit / refuse-with-code / duplicate-receipt). Any divergence between the
 * model's prediction and the observed outcome — or any invariant failure — is
 * a finding with a repro seed. This is the volume engine: hundreds of
 * lifecycles per run, interleaved across projects, with adversarial moves
 * mixed in at a fixed rate.
 */
import type { Scenario, World } from '../harness/world';
import { ScenarioAbort } from '../harness/world';
import type { SemanticWebCommand } from '../../../src/lib/semantic-web';

interface ModelProject {
  projectId: string;
  judgmentId?: string;
  returnContractId?: string;
  observations: string[];
  resolutionId?: string;
  closed: boolean;
  lastBatch?: unknown[];
  sealBuilt?: unknown[];
}

const FUTURE = '2026-10-01T00:00:00.000Z';
const PRESENT_STANDARD = {
  present_standard: {
    status: 'same' as const,
    response_text: 'I would make the same call under the same conditions',
  },
};

type Move =
  | 'seal' | 'observe' | 'resolve' | 'defer' | 'close'
  | 'retry_exact' | 'retry_altered' | 'close_unresolved' | 'reseal'
  | 'second_judgment' | 'foreign_append' | 'tamper_authority';

const WEIGHTS: Array<[Move, number]> = [
  ['seal', 18], ['observe', 16], ['resolve', 14], ['defer', 10], ['close', 12],
  ['retry_exact', 8], ['retry_altered', 5], ['close_unresolved', 4], ['reseal', 3],
  ['second_judgment', 3], ['foreign_append', 3], ['tamper_authority', 4],
];

function pickMove(w: World): Move {
  const total = WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = w.rng.next() * total;
  for (const [move, weight] of WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return move;
  }
  return 'observe';
}

export function fuzzScenario(cycles: number): Scenario {
  return {
    id: 'FUZZ',
    title: `Model-based random walk (${cycles} moves)`,
    proves: 'Under arbitrary interleavings of valid and adversarial commands, every outcome matches the reference model and every invariant holds.',
    async run(w: World) {
      const projects: ModelProject[] = [];
      const newModelProject = () => {
        const project: ModelProject = { projectId: w.newProject(`fuzz-${projects.length}`), observations: [], closed: false };
        projects.push(project);
        return project;
      };
      for (let i = 0; i < Math.max(3, Math.floor(cycles / 40)); i++) newModelProject();
      let completed = 0;

      for (let move = 0; move < cycles; move++) {
        const p = w.rng.pick(projects);
        const kind = pickMove(w);
        const step = `${move}-${kind}`;
        const meta = (action: string) => ({ scenario: 'FUZZ', step, surface: 'web' as const, action, projectId: p.projectId });
        try {
          switch (kind) {
            case 'seal': {
              if (p.judgmentId) break; // handled by reseal/second_judgment moves
              const seal: Extract<SemanticWebCommand, { kind: 'seal' }> = {
                kind: 'seal', command_id: w.rng.id('cmd'), judgment_id: w.rng.id('judgment'),
                return_contract_id: w.rng.id('return'), statement: `fuzz statement ${w.rng.id('s')}`,
                review_at: FUTURE, review_question: `fuzz question ${w.rng.id('q')}`,
              };
              const res = await w.step(meta('seal'), { ok: true, appended: 2, duplicate: false }, () => w.web.command(p.projectId, seal));
              p.judgmentId = seal.judgment_id;
              p.returnContractId = seal.return_contract_id;
              p.lastBatch = res.built;
              p.sealBuilt = res.built;
              break;
            }
            case 'observe': {
              if (!p.judgmentId) break;
              const observationId = w.rng.id('obs');
              const res = await w.step(meta('observe'), { ok: true, appended: 1 }, () =>
                w.web.command(p.projectId, { kind: 'observe', command_id: w.rng.id('cmd'), observation_id: observationId, text: `seen ${w.rng.id('t')}` }));
              p.observations.push(observationId);
              p.lastBatch = res.built;
              break;
            }
            case 'resolve': {
              if (!p.judgmentId || !p.returnContractId) break;
              const resolutionId = w.rng.id('res');
              const hasEvidence = p.observations.length > 0 && w.rng.chance(0.85);
              const evidence = hasEvidence ? [w.rng.pick(p.observations)] : [w.rng.id('ghost')];
              const expectOk = !p.closed && !p.resolutionId && hasEvidence;
              const expect = expectOk
                ? { ok: true, appended: 1 }
                : { ok: false, appended: 0, code: p.closed ? 'ILLEGAL_TRANSITION' : 'UNKNOWN_REFERENCE' };
              // A second resolve on an open judgment overwrites in-model? No:
              // reducer replaces judgment.resolution only if non-terminal; a
              // re-assert IS legal grammar (new resolution id). Model: allow.
              if (!expectOk && p.resolutionId && !p.closed && hasEvidence) {
                expect.ok = true;
                (expect as { appended: number }).appended = 1;
                delete (expect as { code?: string }).code;
              }
              const res = await w.step(meta('resolve'), expect as never, () =>
                w.web.command(p.projectId, {
                  kind: 'resolve', command_id: w.rng.id('cmd'), resolution_id: resolutionId,
                  judgment_id: p.judgmentId!, return_contract_id: p.returnContractId!,
                  resolution: { kind: 'answered', answer_summary: 'fuzz answer', evidence_refs: evidence, ...PRESENT_STANDARD },
                }));
              if (res.ok) { p.resolutionId = resolutionId; p.lastBatch = res.built; }
              break;
            }
            case 'defer': {
              if (!p.returnContractId) break;
              const expect = p.closed
                ? { ok: false, appended: 0, code: 'ILLEGAL_TRANSITION' }
                : { ok: true, appended: 1 };
              const res = await w.step(meta('defer'), expect as never, () =>
                w.web.command(p.projectId, { kind: 'defer', command_id: w.rng.id('cmd'), return_contract_id: p.returnContractId!, review_at: '2026-11-15T00:00:00.000Z' }));
              if (res.ok) p.lastBatch = res.built;
              break;
            }
            case 'close': {
              if (!p.judgmentId) break;
              const useReal = p.resolutionId !== undefined && w.rng.chance(0.9);
              const resolutionId = useReal ? p.resolutionId! : w.rng.id('ghost');
              const expect = !p.closed && useReal
                ? { ok: true, appended: 1 }
                : { ok: false, appended: 0, code: p.closed ? 'ILLEGAL_TRANSITION' : 'UNKNOWN_REFERENCE' };
              const res = await w.step(meta('close'), expect as never, () =>
                w.web.command(p.projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: p.judgmentId!, resolution_id: resolutionId }));
              if (res.ok) { p.closed = true; completed += 1; p.lastBatch = res.built; }
              break;
            }
            case 'retry_exact': {
              if (!p.lastBatch) break;
              await w.step(meta('retry-exact'), { ok: true, appended: 0, duplicate: true }, () =>
                w.web.replayExact(p.projectId, p.lastBatch!));
              break;
            }
            case 'retry_altered': {
              if (!p.lastBatch) break;
              const altered = JSON.parse(JSON.stringify(p.lastBatch)) as Array<Record<string, unknown>>;
              const target = altered[w.rng.int(altered.length)]!;
              if (typeof target.text === 'string') target.text = 'altered content';
              else if (typeof target.statement === 'string') target.statement = 'altered statement';
              else target.review_at = '2027-01-01T00:00:00.000Z';
              await w.step(meta('retry-altered'), { ok: false, appended: 0, code: 'IDEMPOTENCY_CONFLICT' }, () =>
                w.web.replayExact(p.projectId, altered));
              break;
            }
            case 'close_unresolved': {
              if (!p.judgmentId || p.resolutionId) break;
              await w.step(meta('close-unresolved'), { ok: false, appended: 0, code: 'UNKNOWN_REFERENCE' }, () =>
                w.web.command(p.projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: p.judgmentId!, resolution_id: w.rng.id('ghost') }));
              break;
            }
            case 'reseal': {
              if (!p.judgmentId) break;
              await w.step(meta('reseal'), { ok: false, appended: 0, code: 'ILLEGAL_TRANSITION' }, () =>
                w.web.command(p.projectId, {
                  kind: 'seal', command_id: w.rng.id('cmd'), judgment_id: p.judgmentId!,
                  return_contract_id: w.rng.id('return'), statement: 'rewrite attempt',
                  review_at: FUTURE, review_question: 'rewrite?',
                }));
              break;
            }
            case 'second_judgment': {
              if (!p.judgmentId) break;
              await w.step(meta('second-judgment'), { ok: false, appended: 0, code: 'SEMANTIC_JUDGMENT_CONFLICT' }, () =>
                w.web.command(p.projectId, {
                  kind: 'seal', command_id: w.rng.id('cmd'), judgment_id: w.rng.id('judgment2'),
                  return_contract_id: w.rng.id('return'), statement: 'a second judgment',
                  review_at: FUTURE, review_question: 'second?',
                }));
              break;
            }
            case 'foreign_append': {
              if (!p.sealBuilt) break;
              const foreign = (JSON.parse(JSON.stringify(p.sealBuilt)) as Array<Record<string, unknown>>)
                .map((event) => ({ ...event, event_id: w.rng.id('ev'), idempotency_key: w.rng.id('key') }));
              await w.step({ ...meta('foreign-append'), projectId: undefined }, { ok: false, code: 'FORBIDDEN' }, () =>
                w.web.rawAppend(p.projectId, foreign, w.otherUserId));
              break;
            }
            case 'tamper_authority': {
              if (!p.judgmentId) break;
              const tampered = {
                event_id: w.rng.id('ev'), v: 3, space_id: `account-project:${p.projectId}`, idempotency_key: w.rng.id('key'),
                event: w.rng.pick(['judgment_withdrawn', 'judgment_closed', 'return_deferred'] as const),
                judgment_id: p.judgmentId, resolution_id: w.rng.id('res'), return_contract_id: p.returnContractId ?? w.rng.id('r'),
                review_at: FUTURE, reason: 'model insists',
                time: { occurred_at: w.emu.nowIso(), recorded_at: w.emu.nowIso(), temporal_mode: 'contemporaneous' },
                authority: {
                  originated_by: { kind: 'ai', id: 'model:eager' },
                  recorded_by: { kind: 'system', id: 'web:argus' },
                  ...(w.rng.chance(0.5) ? { authorized_by: { kind: 'ai', id: 'model:eager' }, authorization_mode: 'direct_command', authorization_ref: { kind: 'command_digest', ref: 'self' } } : {}),
                },
              } as Record<string, unknown>;
              await w.step(meta('tamper-authority'), { ok: false, appended: 0 }, () =>
                w.web.rawAppend(p.projectId, [tampered]));
              break;
            }
          }
        } catch (error) {
          if (error instanceof ScenarioAbort) {
            // Recorded as a finding with this seed; keep walking — one fuzz
            // divergence must not hide later ones.
            continue;
          }
          throw error;
        }
        if (w.rng.chance(0.02)) newModelProject();
      }

      // Volume accounting so the analyzer can report the funnel honestly.
      await w.step({ scenario: 'FUZZ', step: 'funnel', surface: 'kernel', action: 'audit',
        note: `projects=${projects.length} sealed=${projects.filter((p) => p.judgmentId).length} resolved=${projects.filter((p) => p.resolutionId).length} closed=${completed}` },
        { ok: true }, async () => ({ ok: true }));
    },
  };
}
