/**
 * Cross-surface scenarios: the same canonical history read/written through
 * different surfaces must be ONE history (handoff remaining-work item 5).
 */
import { foldAsOf, fold, projectJudgment } from '../../../src/lib/decision-kernel';
import { checkCrossSurfaceProjection } from '../harness/invariants';
import type { Scenario, World } from '../harness/world';
import type { SemanticWebCommand } from '../../../src/lib/semantic-web';

const FUTURE = '2026-09-01T00:00:00.000Z';

async function sealViaWeb(w: World, scenario: string) {
  const projectId = w.newProject('cross-surface');
  const seal: Extract<SemanticWebCommand, { kind: 'seal' }> = {
    kind: 'seal', command_id: w.rng.id('cmd'), judgment_id: w.rng.id('judgment'),
    return_contract_id: w.rng.id('return'), statement: 'We migrate the billing stack this quarter.',
    review_at: FUTURE, review_question: 'Did invoice error rate stay under 0.5%?',
  };
  await w.step({ scenario, step: 'seal-web', surface: 'web', action: 'seal', projectId }, { ok: true, appended: 2 },
    () => w.web.command(projectId, seal));
  const contract = w.contract(projectId, seal.judgment_id);
  const project = w.emu.projects.find((p) => p.id === projectId)!;
  project.decision_contract = { ...contract } as never;
  w.emu.telegramDecisions.push({ id: projectId, user_id: w.userId, status: 'sealed' });
  return { projectId, seal, contract };
}

export const crossScenarios: Scenario[] = [
  {
    id: 'X1',
    title: 'Seal on web, answer on Telegram — one stream, one projection',
    proves: 'The Telegram batch lands in the SAME canonical stream the web reads; projections agree across read paths.',
    async run(w) {
      const { projectId, seal, contract } = await sealViaWeb(w, 'X1');
      const out = await w.telegram.tapSettlementButton(projectId, contract, 'partial', `telegram:update:${w.rng.int(9999)}`);
      await w.step({ scenario: 'X1', step: 'answer-telegram', surface: 'telegram', action: 'observe_and_resolve', projectId },
        { ok: true, appended: 2 }, async () => out.result);
      const webRead = await w.web.read(projectId);
      if (!webRead) throw new Error('web read failed');
      const failures = checkCrossSurfaceProjection(webRead, seal.judgment_id, w.emu.nowIso());
      if (failures.length > 0) throw new Error(failures[0]!.detail);
      const viaWeb = projectJudgment(fold(webRead), seal.judgment_id, w.emu.nowIso());
      const viaEmu = w.projection(projectId, seal.judgment_id);
      if (JSON.stringify(viaWeb) !== JSON.stringify(viaEmu)) throw new Error('web and canonical projections diverge');
      if (viaWeb?.lifecycle?.startsWith('resolved')) throw new Error('cross-surface answer closed the judgment');
    },
  },
  {
    id: 'X2',
    title: 'Full lifecycle across surfaces: web seal → telegram defer → telegram answer → web close',
    proves: 'Authorial acts from different surfaces compose into one legal history; the web can close what Telegram answered.',
    async run(w) {
      const { projectId, seal, contract } = await sealViaWeb(w, 'X2');
      const defer = await w.telegram.tapSettlementButton(projectId, contract, 'pending', `telegram:update:${w.rng.int(9999)}`);
      await w.step({ scenario: 'X2', step: 'defer-telegram', surface: 'telegram', action: 'defer', projectId },
        { ok: true, appended: 1 }, async () => defer.result);
      const answer = await w.telegram.tapSettlementButton(projectId, contract, 'happened', `telegram:update:${w.rng.int(9999)}`);
      await w.step({ scenario: 'X2', step: 'answer-telegram', surface: 'telegram', action: 'observe_and_resolve', projectId },
        { ok: true, appended: 2 }, async () => answer.result);
      const resolutionId = (w.stream(projectId).find((e) => (e as { event?: string }).event === 'resolution_asserted') as { resolution_id: string }).resolution_id;
      await w.step({ scenario: 'X2', step: 'close-web', surface: 'web', action: 'close', projectId }, { ok: true, appended: 1 },
        () => w.web.command(projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: seal.judgment_id, resolution_id: resolutionId }));
      const projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle !== 'resolved_answered') throw new Error(`cross close: ${projection?.lifecycle}`);
    },
  },
  {
    id: 'X3',
    title: 'As-of reads honor the hindsight boundary',
    proves: 'foldAsOf(t) reconstructs what was known at t: the later answer is invisible from before it was recorded.',
    async run(w) {
      const { projectId, seal, contract } = await sealViaWeb(w, 'X3');
      const cut = w.emu.nowIso();
      w.emu.tick();
      const out = await w.telegram.tapSettlementButton(projectId, contract, 'happened', `telegram:update:${w.rng.int(9999)}`);
      await w.step({ scenario: 'X3', step: 'answer-later', surface: 'telegram', action: 'observe_and_resolve', projectId },
        { ok: true, appended: 2 }, async () => out.result);
      const events = w.stream(projectId);
      // The projection hides resolution until close; the hindsight check reads
      // the folded state directly: known-then vs known-now.
      const thenState = foldAsOf(events, cut) as import('../../../src/lib/decision-kernel').SemanticState;
      const nowState = fold(events) as import('../../../src/lib/decision-kernel').SemanticState;
      const thenJudgment = thenState.judgments.get(seal.judgment_id);
      const nowJudgment = nowState.judgments.get(seal.judgment_id);
      await w.step({ scenario: 'X3', step: 'asof-audit', surface: 'cross', action: 'foldAsOf', projectId,
        note: `then.resolution=${Boolean(thenJudgment?.resolution)} now.resolution=${Boolean(nowJudgment?.resolution)}` }, { ok: true },
        async () => ({ ok: Boolean(thenJudgment) && !thenJudgment!.resolution && Boolean(nowJudgment?.resolution), code: 'HINDSIGHT_LEAK' }));
    },
  },
];
