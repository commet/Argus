/**
 * Web P6 scenarios — the handoff's "Web P6 production lifecycle" steps 1–10 as
 * executable cases, plus the adversarial edges around them. Every scenario
 * states what it proves; a red is a product defect at the named layer.
 */
import type { SemanticWebCommand } from '../../../src/lib/semantic-web';
import { conflictMarkers } from '../harness/invariants';
import type { Scenario, World } from '../harness/world';

const FUTURE = '2026-09-01T00:00:00.000Z';
const PAST = '2026-07-01T00:00:00.000Z';

function sealCmd(w: World, over: Partial<Extract<SemanticWebCommand, { kind: 'seal' }>> = {}): Extract<SemanticWebCommand, { kind: 'seal' }> {
  return {
    kind: 'seal',
    command_id: w.rng.id('cmd'),
    judgment_id: w.rng.id('judgment'),
    return_contract_id: w.rng.id('return'),
    statement: `We keep the current pricing until the cohort report. [${w.rng.id('s')}]`,
    review_at: FUTURE,
    review_question: 'Did weekly conversion stay above 3.2%?',
    ...over,
  };
}

/** Seal + verify pointer; returns ids for the rest of a lifecycle. */
async function sealProject(w: World, scenario: string, projectId: string) {
  const seal = sealCmd(w);
  await w.step(
    { scenario, step: 'seal', surface: 'web', action: 'seal', projectId },
    { ok: true, status: 200, appended: 2, duplicate: false },
    () => w.web.command(projectId, seal),
  );
  if (w.pointer(projectId) !== seal.judgment_id) {
    throw new Error(`pointer not set: ${w.pointer(projectId)}`);
  }
  return seal;
}

export const webScenarios: Scenario[] = [
  {
    id: 'W1',
    title: 'Full lifecycle: seal → observe → resolve → defer → close',
    proves: 'P6 steps 1–6: pointer set atomically; resolution stays open; defer is non-terminal; close is a separate act that terminates.',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W1', projectId);

      const observationId = w.rng.id('obs');
      await w.step({ scenario: 'W1', step: 'observe', surface: 'web', action: 'observe', projectId },
        { ok: true, appended: 1 },
        () => w.web.command(projectId, { kind: 'observe', command_id: w.rng.id('cmd'), observation_id: observationId, text: 'Cohort report arrived: conversion 3.4%.' }));
      let projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle !== 'sealed') throw new Error(`after observe: ${projection?.lifecycle}`);

      const resolutionId = w.rng.id('res');
      await w.step({ scenario: 'W1', step: 'resolve', surface: 'web', action: 'resolve', projectId },
        { ok: true, appended: 1 },
        () => w.web.command(projectId, {
          kind: 'resolve', command_id: w.rng.id('cmd'), resolution_id: resolutionId,
          judgment_id: seal.judgment_id, return_contract_id: seal.return_contract_id,
          resolution: { kind: 'answered', answer_summary: 'Conversion held at 3.4%.', criterion_result: 'met', evidence_refs: [observationId] },
        }));
      projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle === 'resolved_answered') throw new Error('resolution closed the judgment (I3 violation)');

      await w.step({ scenario: 'W1', step: 'defer', surface: 'web', action: 'defer', projectId },
        { ok: true, appended: 1 },
        () => w.web.command(projectId, { kind: 'defer', command_id: w.rng.id('cmd'), return_contract_id: seal.return_contract_id, review_at: '2026-10-01T00:00:00.000Z', reason: 'One more cohort.' }));
      projection = w.projection(projectId, seal.judgment_id);
      if (!projection || ['withdrawn', 'superseded', 'erased', 'conflict'].includes(projection.lifecycle) || projection.lifecycle.startsWith('resolved')) {
        throw new Error(`defer terminalized: ${projection?.lifecycle}`);
      }

      await w.step({ scenario: 'W1', step: 'close', surface: 'web', action: 'close', projectId },
        { ok: true, appended: 1 },
        () => w.web.command(projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: seal.judgment_id, resolution_id: resolutionId }));
      projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle !== 'resolved_answered') throw new Error(`after close: ${projection?.lifecycle}`);
    },
  },
  {
    id: 'W2',
    title: 'Exact duplicate retry returns a duplicate receipt',
    proves: 'P6 step 7: an identical command retry appends nothing and says duplicate=true (RPC all-exact retry branch).',
    async run(w) {
      const projectId = w.newProject();
      const seal = sealCmd(w);
      const first = await w.step({ scenario: 'W2', step: 'seal', surface: 'web', action: 'seal', projectId },
        { ok: true, appended: 2, duplicate: false },
        () => w.web.command(projectId, seal));
      await w.step({ scenario: 'W2', step: 'retry-exact', surface: 'web', action: 'replay', projectId },
        { ok: true, appended: 0, duplicate: true },
        () => w.web.replayExact(projectId, first.built!));
    },
  },
  {
    id: 'W3',
    title: 'Same idempotency key, altered content is refused',
    proves: 'P6 step 8: a retry that changed content cannot silently replace or split the original command.',
    async run(w) {
      const projectId = w.newProject();
      const seal = sealCmd(w);
      const first = await w.step({ scenario: 'W3', step: 'seal', surface: 'web', action: 'seal', projectId },
        { ok: true, appended: 2 },
        () => w.web.command(projectId, seal));
      const altered = JSON.parse(JSON.stringify(first.built)) as Array<Record<string, unknown>>;
      altered[0]!.statement = 'A different statement smuggled under the same key.';
      await w.step({ scenario: 'W3', step: 'retry-altered', surface: 'web', action: 'replay', projectId },
        { ok: false, code: 'IDEMPOTENCY_CONFLICT', status: 409, appended: 0 },
        () => w.web.replayExact(projectId, altered));
    },
  },
  {
    id: 'W4',
    title: 'Partial batch retry is refused (no implicit command split)',
    proves: 'RPC refuses a batch where only some keys already exist — accepting part would be an un-auditable half-command.',
    async run(w) {
      const projectId = w.newProject();
      const seal = sealCmd(w);
      const first = await w.step({ scenario: 'W4', step: 'seal', surface: 'web', action: 'seal', projectId },
        { ok: true, appended: 2 },
        () => w.web.command(projectId, seal));
      const sealedEvent = JSON.parse(JSON.stringify(first.built![0])) as Record<string, unknown>;
      const freshObservation = {
        event_id: w.rng.id('ev'), v: 3, space_id: sealedEvent.space_id, idempotency_key: w.rng.id('key'),
        event: 'observation_recorded', observation_id: w.rng.id('obs'), text: 'new in partial batch',
        time: { occurred_at: w.emu.nowIso(), recorded_at: w.emu.nowIso(), temporal_mode: 'contemporaneous' },
        authority: {
          originated_by: { kind: 'human', id: `account-project:${projectId}` },
          recorded_by: { kind: 'system', id: 'web:argus' },
          observed_by: { kind: 'human', id: `account-project:${projectId}` },
        },
        provenance: { source_kind: 'user_utterance', verification: 'pasted' },
      };
      await w.step({ scenario: 'W4', step: 'retry-partial', surface: 'web', action: 'raw-append', projectId },
        { ok: false, code: 'IDEMPOTENCY_CONFLICT', appended: 0 },
        () => w.web.rawAppend(projectId, [sealedEvent, freshObservation]));
    },
  },
  {
    id: 'W5',
    title: 'Concurrent defer and close: both preserved or one refused, never silently lost',
    proves: 'P6 step 9: a race between two authorized intents ends as an explicit refusal or a preserved visible conflict — no last-write-wins.',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W5', projectId);
      const observationId = w.rng.id('obs');
      await w.step({ scenario: 'W5', step: 'observe', surface: 'web', action: 'observe', projectId }, { ok: true },
        () => w.web.command(projectId, { kind: 'observe', command_id: w.rng.id('cmd'), observation_id: observationId, text: 'evidence' }));
      const resolutionId = w.rng.id('res');
      await w.step({ scenario: 'W5', step: 'resolve', surface: 'web', action: 'resolve', projectId }, { ok: true },
        () => w.web.command(projectId, {
          kind: 'resolve', command_id: w.rng.id('cmd'), resolution_id: resolutionId,
          judgment_id: seal.judgment_id, return_contract_id: seal.return_contract_id,
          resolution: { kind: 'answered', answer_summary: 'done', evidence_refs: [observationId] },
        }));

      const before = w.stream(projectId).length;
      const recordedAt = w.emu.tick();
      const [deferRes, closeRes] = await Promise.all([
        w.web.command(projectId, { kind: 'defer', command_id: w.rng.id('cmd'), return_contract_id: seal.return_contract_id, review_at: '2026-11-01T00:00:00.000Z' }, recordedAt),
        w.web.command(projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: seal.judgment_id, resolution_id: resolutionId }, recordedAt),
      ]);
      const after = w.stream(projectId).length;
      const admitted = after - before;
      const refused = [deferRes, closeRes].filter((r) => !r.ok).length;
      const markers = conflictMarkers(w.stream(projectId));
      // Legal outcomes: both admitted (conflict preserved+visible) or one
      // admitted + one refused. Illegal: an intent vanishing silently.
      const accounted = admitted + refused;
      await w.step({ scenario: 'W5', step: 'race-audit', surface: 'web', action: 'audit', projectId,
        note: `admitted=${admitted} refused=${refused} markers=${markers.length}` },
        { ok: true },
        async () => ({ ok: accounted >= 2, code: accounted >= 2 ? undefined : 'SILENT_LOSS' }));
      const projection = w.projection(projectId, seal.judgment_id);
      if (!projection) throw new Error('projection vanished after race');
      if (admitted === 2 && markers.length === 0 && projection.lifecycle !== 'resolved_answered') {
        // Both admitted with no marker is only legal when order was close-last…
        // which cannot be: defer-after-close must mark. Flag it.
        throw new Error(`both admitted, no conflict marker, lifecycle=${projection.lifecycle}`);
      }
    },
  },
  {
    id: 'W6',
    title: 'Close without any resolution is refused',
    proves: 'The kernel refuses a terminal act whose referenced resolution does not exist (no fabricated closure).',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W6', projectId);
      await w.step({ scenario: 'W6', step: 'close-unresolved', surface: 'web', action: 'close', projectId },
        { ok: false, code: 'UNKNOWN_REFERENCE', status: 409, appended: 0 },
        () => w.web.command(projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: seal.judgment_id, resolution_id: w.rng.id('res') }));
    },
  },
  {
    id: 'W7',
    title: 'Answered resolution with a missing observation is refused',
    proves: 'An "answered" resolution must cite admitted evidence; the kernel refuses dangling evidence_refs.',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W7', projectId);
      await w.step({ scenario: 'W7', step: 'resolve-dangling', surface: 'web', action: 'resolve', projectId },
        { ok: false, code: 'UNKNOWN_REFERENCE', appended: 0 },
        () => w.web.command(projectId, {
          kind: 'resolve', command_id: w.rng.id('cmd'), resolution_id: w.rng.id('res'),
          judgment_id: seal.judgment_id, return_contract_id: seal.return_contract_id,
          resolution: { kind: 'answered', answer_summary: 'says so', evidence_refs: [w.rng.id('ghost')] },
        }));
    },
  },
  {
    id: 'W8',
    title: 'Second close after close is refused as terminal',
    proves: 'A terminal judgment refuses further terminal acts instead of silently absorbing them.',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W8', projectId);
      const observationId = w.rng.id('obs');
      await w.step({ scenario: 'W8', step: 'observe+resolve', surface: 'web', action: 'observe_and_resolve', projectId }, { ok: true, appended: 2 },
        () => w.web.command(projectId, {
          kind: 'observe_and_resolve', command_id: w.rng.id('cmd'),
          observation_id: observationId, observation_text: 'observed', resolution_id: w.rng.id('res'),
          judgment_id: seal.judgment_id, return_contract_id: seal.return_contract_id,
          resolution: { kind: 'answered', answer_summary: 'ok', evidence_refs: [observationId] },
        }));
      const stream = w.stream(projectId);
      const resolutionId = (stream.find((e) => (e as { event?: string }).event === 'resolution_asserted') as { resolution_id: string }).resolution_id;
      await w.step({ scenario: 'W8', step: 'close', surface: 'web', action: 'close', projectId }, { ok: true, appended: 1 },
        () => w.web.command(projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: seal.judgment_id, resolution_id: resolutionId }));
      await w.step({ scenario: 'W8', step: 'close-again', surface: 'web', action: 'close', projectId },
        { ok: false, code: 'ILLEGAL_TRANSITION', appended: 0 },
        () => w.web.command(projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: seal.judgment_id, resolution_id: resolutionId }));
    },
  },
  {
    id: 'W9',
    title: 'Defer after close is refused (nothing reopens silently)',
    proves: 'Post-terminal authorial acts are refused at preflight; the sealed outcome is not quietly re-scheduled.',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W9', projectId);
      const observationId = w.rng.id('obs');
      await w.step({ scenario: 'W9', step: 'observe+resolve', surface: 'web', action: 'observe_and_resolve', projectId }, { ok: true },
        () => w.web.command(projectId, {
          kind: 'observe_and_resolve', command_id: w.rng.id('cmd'),
          observation_id: observationId, observation_text: 'observed', resolution_id: w.rng.id('res'),
          judgment_id: seal.judgment_id, return_contract_id: seal.return_contract_id,
          resolution: { kind: 'answered', answer_summary: 'ok', evidence_refs: [observationId] },
        }));
      const stream = w.stream(projectId);
      const resolutionId = (stream.find((e) => (e as { event?: string }).event === 'resolution_asserted') as { resolution_id: string }).resolution_id;
      await w.step({ scenario: 'W9', step: 'close', surface: 'web', action: 'close', projectId }, { ok: true },
        () => w.web.command(projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: seal.judgment_id, resolution_id: resolutionId }));
      await w.step({ scenario: 'W9', step: 'defer-after-close', surface: 'web', action: 'defer', projectId },
        { ok: false, code: 'ILLEGAL_TRANSITION', appended: 0 },
        () => w.web.command(projectId, { kind: 'defer', command_id: w.rng.id('cmd'), return_contract_id: seal.return_contract_id, review_at: '2026-12-01T00:00:00.000Z' }));
    },
  },
  {
    id: 'W10',
    title: 'Re-sealing the same judgment id is refused',
    proves: 'A sealed judgment cannot be sealed again (statement rewrite via reseal is impossible).',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W10', projectId);
      await w.step({ scenario: 'W10', step: 'reseal', surface: 'web', action: 'seal', projectId },
        { ok: false, code: 'ILLEGAL_TRANSITION', appended: 0 },
        () => w.web.command(projectId, sealCmd(w, { judgment_id: seal.judgment_id, statement: 'A rewritten history.' })));
    },
  },
  {
    id: 'W11',
    title: 'A second judgment in the same project hits the pointer guard',
    proves: 'The project pointer refuses to move to a different judgment (SEMANTIC_JUDGMENT_CONFLICT), never silently repoints.',
    async run(w) {
      const projectId = w.newProject();
      await sealProject(w, 'W11', projectId);
      await w.step({ scenario: 'W11', step: 'second-seal', surface: 'web', action: 'seal', projectId },
        { ok: false, code: 'SEMANTIC_JUDGMENT_CONFLICT', status: 409, appended: 0 },
        () => w.web.command(projectId, sealCmd(w)));
    },
  },
  {
    id: 'W12',
    title: 'A batch whose space does not match the project is refused',
    proves: 'Space integrity: events cannot land in a stream their space_id does not name.',
    async run(w) {
      const projectId = w.newProject();
      const otherProject = w.newProject('other');
      const seal = sealCmd(w);
      // Build against otherProject (its space), then aim at projectId.
      const built = await w.step({ scenario: 'W12', step: 'seal-other', surface: 'web', action: 'seal', projectId: otherProject },
        { ok: true }, () => w.web.command(otherProject, seal));
      await w.step({ scenario: 'W12', step: 'cross-space-append', surface: 'web', action: 'raw-append', projectId },
        { ok: false, code: 'SPACE_MISMATCH', appended: 0 },
        () => {
          const foreignSpace = (JSON.parse(JSON.stringify(built.built)) as Array<Record<string, unknown>>)
            .map((event) => ({ ...event, event_id: w.rng.id('ev'), idempotency_key: w.rng.id('key') }));
          return w.web.rawAppend(projectId, foreignSpace);
        });
    },
  },
  {
    id: 'W13',
    title: 'Appending to another user’s project is forbidden',
    proves: 'Ownership: the RPC refuses a (user, project) pair that does not match, regardless of payload.',
    async run(w) {
      const foreignProject = w.newForeignProject();
      const seal = sealCmd(w);
      await w.step({ scenario: 'W13', step: 'foreign-append', surface: 'web', action: 'seal' },
        { ok: false, code: 'FORBIDDEN', status: 403 },
        () => w.web.command(foreignProject, seal));
    },
  },
  {
    id: 'W14',
    title: 'Event-id collision with fresh idempotency keys is refused by name',
    proves: 'EVENT_ID_CONFLICT surfaces as itself, not as a generic unique-index error.',
    async run(w) {
      const projectId = w.newProject();
      const seal = sealCmd(w);
      const first = await w.step({ scenario: 'W14', step: 'seal', surface: 'web', action: 'seal', projectId },
        { ok: true }, () => w.web.command(projectId, seal));
      // A fresh observation (passes the reducer preflight) whose event_id
      // collides with an already-stored event — only the RPC can catch this.
      const stolenEventId = (first.built![0] as { event_id: string }).event_id;
      const collision = {
        event_id: stolenEventId, v: 3, space_id: `account-project:${projectId}`, idempotency_key: w.rng.id('key'),
        event: 'observation_recorded', observation_id: w.rng.id('obs'), text: 'colliding id',
        time: { occurred_at: w.emu.nowIso(), recorded_at: w.emu.nowIso(), temporal_mode: 'contemporaneous' },
        authority: {
          originated_by: { kind: 'human', id: `account-project:${projectId}` },
          recorded_by: { kind: 'system', id: 'web:argus' },
          observed_by: { kind: 'human', id: `account-project:${projectId}` },
        },
        provenance: { source_kind: 'user_utterance', verification: 'pasted' },
      };
      await w.step({ scenario: 'W14', step: 'event-id-collision', surface: 'web', action: 'raw-append', projectId },
        { ok: false, code: 'EVENT_ID_CONFLICT', appended: 0 },
        () => w.web.rawAppend(projectId, [collision]));
    },
  },
  {
    id: 'W15',
    title: 'Retrospective observation keeps its declared temporal mode',
    proves: 'Temporal honesty: occurred_at ≠ recorded_at is stored as retrospective, not silently normalized.',
    async run(w) {
      const projectId = w.newProject();
      await sealProject(w, 'W15', projectId);
      await w.step({ scenario: 'W15', step: 'observe-retro', surface: 'web', action: 'observe', projectId }, { ok: true, appended: 1 },
        () => w.web.command(projectId, { kind: 'observe', command_id: w.rng.id('cmd'), observation_id: w.rng.id('obs'), text: 'Found last week’s log line.', occurred_at: PAST }));
      const observation = w.stream(projectId).find((e) => (e as { event?: string }).event === 'observation_recorded') as { time: { temporal_mode: string; occurred_at: string } };
      if (observation.time.temporal_mode !== 'retrospective' || observation.time.occurred_at !== PAST) {
        throw new Error(`temporal mode lost: ${JSON.stringify(observation.time)}`);
      }
    },
  },
  {
    id: 'W16',
    title: 'Past review date projects as due; a defer moves it back to sealed',
    proves: 'The due surface derives from the active return contract; defer updates it without terminalizing.',
    async run(w) {
      const projectId = w.newProject();
      const seal = sealCmd(w, { review_at: PAST });
      await w.step({ scenario: 'W16', step: 'seal-past-review', surface: 'web', action: 'seal', projectId }, { ok: true },
        () => w.web.command(projectId, seal));
      let projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle !== 'due') throw new Error(`expected due, got ${projection?.lifecycle}`);
      await w.step({ scenario: 'W16', step: 'defer-future', surface: 'web', action: 'defer', projectId }, { ok: true },
        () => w.web.command(projectId, { kind: 'defer', command_id: w.rng.id('cmd'), return_contract_id: seal.return_contract_id, review_at: FUTURE }));
      projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle !== 'sealed') throw new Error(`expected sealed after defer, got ${projection?.lifecycle}`);
    },
  },
  {
    id: 'W17',
    title: 'Indeterminate and moot resolutions close into their own lifecycles',
    proves: 'Non-answered resolution kinds survive to the closed projection unchanged (no coercion to "answered").',
    async run(w) {
      for (const kind of ['indeterminate', 'moot'] as const) {
        const projectId = w.newProject();
        const seal = await sealProject(w, 'W17', projectId);
        const resolutionId = w.rng.id('res');
        await w.step({ scenario: 'W17', step: `resolve-${kind}`, surface: 'web', action: 'resolve', projectId }, { ok: true },
          () => w.web.command(projectId, {
            kind: 'resolve', command_id: w.rng.id('cmd'), resolution_id: resolutionId,
            judgment_id: seal.judgment_id, return_contract_id: seal.return_contract_id,
            resolution: { kind, reason: 'The metric pipeline was replaced mid-window.', evidence_refs: [] },
          }));
        await w.step({ scenario: 'W17', step: `close-${kind}`, surface: 'web', action: 'close', projectId }, { ok: true },
          () => w.web.command(projectId, { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: seal.judgment_id, resolution_id: resolutionId }));
        const projection = w.projection(projectId, seal.judgment_id);
        if (projection?.lifecycle !== `resolved_${kind}`) throw new Error(`expected resolved_${kind}, got ${projection?.lifecycle}`);
      }
    },
  },
  {
    id: 'W18',
    title: 'Malformed commands are refused before any write',
    proves: 'Command validation is a hard gate: bad shapes produce 400 and zero ledger effect.',
    async run(w) {
      const projectId = w.newProject();
      const bads: Array<Record<string, unknown>> = [
        { kind: 'seal', command_id: w.rng.id('cmd'), judgment_id: w.rng.id('j'), return_contract_id: w.rng.id('r'), statement: '', review_at: FUTURE, review_question: 'q' },
        { kind: 'seal', command_id: w.rng.id('cmd'), judgment_id: w.rng.id('j'), return_contract_id: w.rng.id('r'), statement: 's', review_at: 'tomorrow-ish', review_question: 'q' },
        { kind: 'observe', command_id: w.rng.id('cmd'), observation_id: w.rng.id('o'), text: 'x'.repeat(4001) },
        { kind: 'close', command_id: w.rng.id('cmd'), judgment_id: w.rng.id('j') },
        { kind: 'warp', command_id: w.rng.id('cmd') },
      ];
      for (const [index, bad] of bads.entries()) {
        await w.step({ scenario: 'W18', step: `bad-${index}`, surface: 'web', action: String(bad.kind), projectId },
          { ok: false, code: 'BAD_REQUEST', status: 400, appended: 0 },
          () => w.web.command(projectId, bad as never));
      }
    },
  },
  {
    id: 'W19',
    title: 'A tampered event claiming AI/system closure authority is refused',
    proves: 'The fabricated-authority probe: no candidate whose authorial act lacks a HUMAN authorized_by can be admitted.',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W19', projectId);
      const tampered = {
        event_id: w.rng.id('ev'), v: 3, space_id: `account-project:${projectId}`, idempotency_key: w.rng.id('key'),
        event: 'judgment_withdrawn', judgment_id: seal.judgment_id,
        time: { occurred_at: w.emu.nowIso(), recorded_at: w.emu.nowIso(), authorized_at: w.emu.nowIso(), temporal_mode: 'contemporaneous' },
        authority: {
          originated_by: { kind: 'ai', id: 'model:helpful' },
          recorded_by: { kind: 'system', id: 'web:argus' },
          authorized_by: { kind: 'ai', id: 'model:helpful' },
          authorization_mode: 'direct_command', authorization_ref: { kind: 'command_digest', ref: 'model says so' },
        },
      };
      await w.step({ scenario: 'W19', step: 'ai-withdraw', surface: 'web', action: 'raw-append', projectId },
        { ok: false, code: 'INVALID_EVENT', appended: 0 },
        () => w.web.rawAppend(projectId, [tampered]));
    },
  },
  {
    id: 'W20',
    title: 'Read and RPC failures surface as their own codes, ledger untouched',
    proves: 'P6 step 10 recovery: infrastructure failure names itself (READ_FAILED / APPEND_FAILED); nothing is half-written.',
    async run(w) {
      const projectId = w.newProject();
      const seal = sealCmd(w);
      w.emu.faults.failReads = 1;
      await w.step({ scenario: 'W20', step: 'read-fail', surface: 'web', action: 'seal', projectId },
        { ok: false, code: 'READ_FAILED', appended: 0 },
        () => w.web.command(projectId, seal));
      w.emu.faults.failRpc = { count: 1, message: 'connection reset by peer' };
      await w.step({ scenario: 'W20', step: 'rpc-fail', surface: 'web', action: 'seal', projectId },
        { ok: false, code: 'APPEND_FAILED', status: 500, appended: 0 },
        () => w.web.command(projectId, seal));
      await w.step({ scenario: 'W20', step: 'retry-after-recovery', surface: 'web', action: 'seal', projectId },
        { ok: true, appended: 2 },
        () => w.web.command(projectId, seal));
    },
  },
  {
    id: 'W21',
    title: 'observe_and_resolve is atomic: an invalid half refuses the whole batch',
    proves: 'One user confirmation is one batch — no partial admit when the second event cannot pass.',
    async run(w) {
      const projectId = w.newProject();
      const seal = await sealProject(w, 'W21', projectId);
      await w.step({ scenario: 'W21', step: 'atomic-refuse', surface: 'web', action: 'observe_and_resolve', projectId },
        { ok: false, appended: 0 },
        () => w.web.command(projectId, {
          kind: 'observe_and_resolve', command_id: w.rng.id('cmd'),
          observation_id: w.rng.id('obs'), observation_text: 'observed',
          resolution_id: w.rng.id('res'), judgment_id: seal.judgment_id,
          return_contract_id: w.rng.id('wrong-contract'),
          resolution: { kind: 'answered', answer_summary: 'ok', evidence_refs: [w.rng.id('obs-other')] },
        }));
      const kinds = w.stream(projectId).map((e) => (e as { event: string }).event);
      if (kinds.includes('observation_recorded')) throw new Error('half of an atomic batch was admitted');
    },
  },
];
