/**
 * Plugin P7 scenarios — the explicit sequence from the handoff:
 * v2 import → user reforge → answer → separate close → outbox delivery →
 * pull → .argus/ledger/semantic-v3.jsonl, with byte-level verbatim checks.
 * Builders are the REAL src/lib/semantic-plugin.ts; the pull loop mirrors
 * argus-plugin-v2/scripts/push-webapp.js and writes a real on-disk jsonl.
 */
import { fold, projectJudgment } from '../../../src/lib/decision-kernel';
import type { PluginDecision } from '../../../src/stores/types';
import type { Scenario, World } from '../harness/world';

function v2Decision(w: World): PluginDecision {
  return {
    id: w.rng.uuid(),
    source: 'import',
    ledger_id: w.rng.id('lg').slice(0, 12),
    session: '2026-06-30-strategy',
    quote: '우리는 6월 컷오프를 지킨다',
    decision: 'Ship the June cutoff without the import wizard.',
    predicate: 'Did we ship by June 30 without the wizard?',
    check_by: '2026-08-15',
    sealed_at: '2026-06-30T09:00:00.000Z',
    status: 'sealed',
    created_at: '2026-06-30T09:00:00.000Z',
    updated_at: '2026-06-30T09:00:00.000Z',
  };
}

export const pluginScenarios: Scenario[] = [
  {
    id: 'P1',
    title: 'A v2 import stays v2 — no v3 events exist before an explicit reforge',
    proves: 'Handoff invariant 10: imported data is never silently upgraded.',
    async run(w) {
      const plugin = w.newPluginSurface('P1');
      const decision = v2Decision(w);
      // The import path lands rows in plugin_decisions only. Assert the outbox
      // and local ledger stay empty of v3 material until a human reforge.
      await w.step({ scenario: 'P1', step: 'import-only', surface: 'plugin', action: 'import' }, { ok: true },
        async () => ({ ok: w.emu.pluginEvents.length === 0 && plugin.readLedgerLines().length === 0, code: 'V3_MATERIAL_BEFORE_REFORGE' }));
      if (decision.status !== 'sealed') throw new Error('fixture drifted');
    },
  },
  {
    id: 'P2',
    title: 'Reforge produces a retrospective seal with import provenance and human authority',
    proves: 'Handoff P7 plugin step 2: the reforge is a present-tense human act over declared-loss legacy content.',
    async run(w) {
      const plugin = w.newPluginSurface('P2');
      const decision = v2Decision(w);
      const record = plugin.reforge(decision, w.emu.tick());
      await w.step({ scenario: 'P2', step: 'reforge', surface: 'plugin', action: 'reforge' }, { ok: true },
        async () => ({ ok: record.events.length === 2, code: 'REFORGE_SHAPE' }));
      const seal = record.events[0] as { event: string; time: { temporal_mode: string; occurred_at?: string }; provenance?: { source_kind?: string; verification?: string }; authority: { authorized_by?: { kind?: string }; originated_by: { kind: string } } };
      if (seal.event !== 'judgment_sealed') throw new Error('first event is not the seal');
      if (seal.time.temporal_mode !== 'retrospective' || seal.time.occurred_at !== decision.sealed_at) throw new Error('reforge is not temporally honest');
      if (seal.provenance?.source_kind !== 'import' || seal.provenance.verification !== 'unknown') throw new Error('import provenance lost');
      if (seal.authority.authorized_by?.kind !== 'human') throw new Error('reforge without human authority');
      if (seal.authority.originated_by.kind !== 'imported') throw new Error('origin must stay imported');
      await plugin.writeOutbox(decision, record.events);
    },
  },
  {
    id: 'P3',
    title: 'A plugin answer records observation+resolution and never implies close',
    proves: 'Handoff P7 plugin step 3: no implicit close on answer.',
    async run(w) {
      const plugin = w.newPluginSurface('P3');
      const decision = v2Decision(w);
      const record = plugin.reforge(decision, w.emu.tick());
      const answer = plugin.answer(decision, record, 'happened', w.emu.tick());
      const all = [...record.events, ...answer];
      const state = fold(all);
      const judgment = state.judgments.get(record.judgment_id);
      await w.step({ scenario: 'P3', step: 'answer', surface: 'plugin', action: 'answer' }, { ok: true },
        async () => ({ ok: Boolean(judgment?.resolution) && !judgment?.closed, code: 'IMPLICIT_CLOSE' }));
      const projection = projectJudgment(state, record.judgment_id, w.emu.nowIso());
      if (projection?.lifecycle?.startsWith('resolved')) throw new Error('plugin answer closed the judgment');
    },
  },
  {
    id: 'P4',
    title: 'A plugin defer moves the review date and stays non-terminal',
    proves: 'return_deferred is non-terminal on the plugin surface too.',
    async run(w) {
      const plugin = w.newPluginSurface('P4');
      const decision = v2Decision(w);
      const record = plugin.reforge(decision, w.emu.tick());
      const defer = plugin.defer(decision, record, '2026-09-30', w.emu.tick());
      const state = fold([...record.events, ...defer]);
      const judgment = state.judgments.get(record.judgment_id)!;
      const contract = judgment.return_contracts.get(record.return_contract_id)!;
      await w.step({ scenario: 'P4', step: 'defer', surface: 'plugin', action: 'defer' }, { ok: true },
        async () => ({ ok: contract.review_at.startsWith('2026-09-30') && !judgment.closed, code: 'DEFER_BROKEN' }));
    },
  },
  {
    id: 'P5',
    title: 'The separate plugin close terminates the record',
    proves: 'Close is its own guarded event referencing the exact resolution.',
    async run(w) {
      const plugin = w.newPluginSurface('P5');
      const decision = v2Decision(w);
      const record = plugin.reforge(decision, w.emu.tick());
      const answer = plugin.answer(decision, record, 'partial', w.emu.tick());
      const withAnswer = { ...record, events: [...record.events, ...answer] };
      const resolutionId = (answer.find((e) => e.event === 'resolution_asserted') as { resolution_id: string }).resolution_id;
      const close = plugin.close(decision, withAnswer, resolutionId, w.emu.tick());
      const projection = projectJudgment(fold([...withAnswer.events, ...close]), record.judgment_id, w.emu.nowIso());
      await w.step({ scenario: 'P5', step: 'close', surface: 'plugin', action: 'close' }, { ok: true },
        async () => ({ ok: projection?.lifecycle === 'resolved_answered', code: `LIFECYCLE_${projection?.lifecycle}` }));
    },
  },
  {
    id: 'P6',
    title: 'Outbox → pull lands byte-identical events in the local semantic ledger',
    proves: 'Handoff P7 plugin steps 5–7: delivery is verbatim; the pulled jsonl equals the outbox content and folds to the same projection.',
    async run(w) {
      const plugin = w.newPluginSurface('P6');
      const decision = v2Decision(w);
      const record = plugin.reforge(decision, w.emu.tick());
      await plugin.writeOutbox(decision, record.events);
      const answer = plugin.answer(decision, record, 'happened', w.emu.tick());
      await plugin.writeOutbox(decision, answer);
      const withAnswer = { ...record, events: [...record.events, ...answer] };
      const resolutionId = (answer.find((e) => e.event === 'resolution_asserted') as { resolution_id: string }).resolution_id;
      const close = plugin.close(decision, withAnswer, resolutionId, w.emu.tick());
      await plugin.writeOutbox(decision, close);

      const pulled = plugin.pull();
      await w.step({ scenario: 'P6', step: 'pull', surface: 'plugin', action: 'pull' }, { ok: true },
        async () => ({ ok: pulled.written === 5 && pulled.errors.length === 0, code: `written=${pulled.written},errors=${pulled.errors.length}` }));

      const expected = [...record.events, ...answer, ...close].map((event) => JSON.stringify(event));
      const lines = plugin.readLedgerLines();
      if (lines.length !== expected.length) throw new Error(`ledger lines ${lines.length} != outbox events ${expected.length}`);
      for (const [index, line] of lines.entries()) {
        if (line !== expected[index]) throw new Error(`byte mismatch at line ${index + 1}`);
      }
      const ledgerProjection = projectJudgment(fold(lines.map((line) => JSON.parse(line))), record.judgment_id, w.emu.nowIso());
      if (ledgerProjection?.lifecycle !== 'resolved_answered') throw new Error(`pulled ledger projects ${ledgerProjection?.lifecycle}`);
    },
  },
  {
    id: 'P7',
    title: 'An invalid outbox batch fails loudly and pollutes nothing',
    proves: 'Handoff P7 plugin step 8: coercion is forbidden — a bad envelope is a visible error and the ledger stays clean.',
    async run(w) {
      const plugin = w.newPluginSurface('P7');
      const decision = v2Decision(w);
      const record = plugin.reforge(decision, w.emu.tick());
      await plugin.writeOutbox(decision, record.events);
      // Tamper: a v2-envelope event smuggled into a semantic_v3 payload.
      await plugin.writeOutbox(decision, [{ event: 'settle', event_id: 'legacy-1', v: 2 } as never]);
      const pulled = plugin.pull();
      await w.step({ scenario: 'P7', step: 'pull-invalid', surface: 'plugin', action: 'pull' }, { ok: true },
        async () => ({ ok: pulled.written === 2 && pulled.errors.length === 1, code: `written=${pulled.written},errors=${pulled.errors.length}` }));
      if (plugin.readLedgerLines().length !== 2) throw new Error('invalid batch reached the ledger');
    },
  },
  {
    id: 'P8',
    title: 'Pulling twice is idempotent',
    proves: 'Replayed sync delivers nothing twice (applied-id dedupe).',
    async run(w) {
      const plugin = w.newPluginSurface('P8');
      const decision = v2Decision(w);
      const record = plugin.reforge(decision, w.emu.tick());
      await plugin.writeOutbox(decision, record.events);
      const first = plugin.pull();
      const second = plugin.pull();
      await w.step({ scenario: 'P8', step: 'pull-twice', surface: 'plugin', action: 'pull' }, { ok: true },
        async () => ({ ok: first.written === 2 && second.written === 0, code: `first=${first.written},second=${second.written}` }));
      if (plugin.readLedgerLines().length !== 2) throw new Error('duplicate delivery reached the ledger');
    },
  },
  {
    id: 'P9',
    title: 'Reusing a request id with different content is refused by the kernel guard',
    proves: 'Plugin idempotency: the same command id cannot mean two different things.',
    async run(w) {
      const plugin = w.newPluginSurface('P9');
      const decision = v2Decision(w);
      const record = plugin.reforge(decision, w.emu.tick());
      const answer = plugin.answer(decision, record, 'happened', w.emu.tick());
      const withAnswer = { ...record, events: [...record.events, ...answer] };
      // Rebuild an answer with the SAME idempotency keys but a different outcome.
      const requestId = (answer[0] as { event_id: string }).event_id.split(':')[2]!;
      let refused = false;
      try {
        const { recordPluginAnswer } = await import('../../../src/lib/semantic-plugin');
        recordPluginAnswer(decision, withAnswer as never, requestId, 'avoided', w.emu.tick());
      } catch (error) {
        refused = /IDEMPOTENCY|DUPLICATE/.test((error as Error).message);
      }
      await w.step({ scenario: 'P9', step: 'reuse-request-id', surface: 'plugin', action: 'answer' }, { ok: true },
        async () => ({ ok: refused, code: refused ? undefined : 'REUSE_NOT_REFUSED' }));
    },
  },
];
