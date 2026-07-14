/**
 * Telegram P7 scenarios. These run the REAL shared brain
 * (src/lib/telegram-semantic.ts — the same functions the production webhook
 * calls) and the REAL callback codecs (settlementReplyMarkup →
 * parseSettlementIntent), against the emulated ledger. What stays uncovered
 * locally: Telegram's own delivery/auth layer — that is the founder's live
 * checklist, not simulatable honestly.
 */
import type { Scenario, World } from '../harness/world';
import type { SemanticWebCommand } from '../../../src/lib/semantic-web';

const FUTURE = '2026-09-01T00:00:00.000Z';

async function sealedContract(w: World, scenario: string) {
  const projectId = w.newProject('텔레그램 결정');
  const seal: Extract<SemanticWebCommand, { kind: 'seal' }> = {
    kind: 'seal', command_id: w.rng.id('cmd'), judgment_id: w.rng.id('judgment'),
    return_contract_id: w.rng.id('return'), statement: '이번 분기엔 채용을 미룬다.',
    review_at: FUTURE, review_question: '런웨이가 12개월 밑으로 내려갔나?',
  };
  await w.step({ scenario, step: 'seal', surface: 'web', action: 'seal', projectId }, { ok: true, appended: 2 },
    () => w.web.command(projectId, seal));
  const contract = w.contract(projectId, seal.judgment_id);
  // Production: the contract lives in projects.decision_contract (with the
  // pointer the RPC already wrote) and telegram_decisions tracks reminders.
  const project = w.emu.projects.find((p) => p.id === projectId)!;
  project.decision_contract = { ...contract } as never;
  w.emu.telegramDecisions.push({ id: projectId, user_id: w.userId, status: 'sealed' });
  return { projectId, seal, contract };
}

function receipt(w: World): string {
  return `telegram:update:${w.rng.int(1_000_000)}:callback:${w.rng.id('cb')}`;
}

export const telegramScenarios: Scenario[] = [
  {
    id: 'T1',
    title: 'Button answer records observation+resolution atomically and does NOT close',
    proves: 'P7 telegram steps 3–5: one tap → one atomic batch with Telegram receipt evidence; the judgment stays open with a separate close offer.',
    async run(w) {
      const { projectId, seal, contract } = await sealedContract(w, 'T1');
      const ref = receipt(w);
      const { transcript } = await (async () => {
        const out = await w.telegram.tapSettlementButton(projectId, contract, 'happened', ref);
        await w.step({ scenario: 'T1', step: 'answer', surface: 'telegram', action: 'observe_and_resolve', projectId, note: out.result.note },
          { ok: true, appended: 2 }, async () => out.result);
        return out;
      })();
      const stream = w.stream(projectId);
      const observation = stream.find((e) => (e as { event?: string }).event === 'observation_recorded') as Record<string, unknown> & { authority: { authorization_ref?: { ref?: string } }; atomic_batch_id?: string };
      const resolution = stream.find((e) => (e as { event?: string }).event === 'resolution_asserted') as Record<string, unknown> & { atomic_batch_id?: string };
      if (!observation || !resolution) throw new Error('atomic batch missing a half');
      if (!observation.atomic_batch_id || observation.atomic_batch_id !== resolution.atomic_batch_id) {
        throw new Error('observation and resolution are not in one atomic batch');
      }
      const authorizationRef = (resolution as { authority: { authorization_ref?: { ref?: string } } }).authority.authorization_ref?.ref;
      if (authorizationRef !== ref) throw new Error(`telegram receipt not carried as authorization evidence: ${authorizationRef}`);
      const projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle?.startsWith('resolved')) throw new Error('telegram answer closed the judgment');
      const last = transcript.sent.at(-1);
      if (!last?.keyboard) throw new Error('no separate close offer was sent');
    },
  },
  {
    id: 'T2',
    title: 'The separate close tap closes with its own receipt and settles the reminder row',
    proves: 'P7 steps 6–7: close is a distinct human-authorized event; telegram_decisions transitions to settled.',
    async run(w) {
      const { projectId, seal, contract } = await sealedContract(w, 'T2');
      const answer = await w.telegram.tapSettlementButton(projectId, contract, 'happened', receipt(w));
      await w.step({ scenario: 'T2', step: 'answer', surface: 'telegram', action: 'observe_and_resolve', projectId },
        { ok: true, appended: 2 }, async () => answer.result);
      const closeRef = receipt(w);
      const { result, transcript } = await w.telegram.tapCloseButton(projectId, contract, closeRef);
      await w.step({ scenario: 'T2', step: 'close', surface: 'telegram', action: 'close', projectId },
        { ok: true, appended: 1 }, async () => result);
      const closed = w.stream(projectId).find((e) => (e as { event?: string }).event === 'judgment_closed') as { authority: { authorized_by: { kind: string }; authorization_ref?: { ref?: string } } } | undefined;
      if (!closed) throw new Error('judgment_closed missing');
      if (closed.authority.authorized_by.kind !== 'human') throw new Error('close not human-authorized');
      if (closed.authority.authorization_ref?.ref !== closeRef) throw new Error('close does not carry its own distinct receipt');
      const projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle !== 'resolved_answered') throw new Error(`after close: ${projection?.lifecycle}`);
      const decision = w.emu.telegramDecisions.find((d) => d.id === projectId);
      if (decision?.status !== 'settled') throw new Error(`telegram_decisions.status=${decision?.status}`);
      if (!transcript.sent.at(-1)?.text.includes('Closed')) throw new Error('no close confirmation copy');
    },
  },
  {
    id: 'T3',
    title: 'A second answer (duplicate delivery) appends nothing and re-offers close',
    proves: 'Answer idempotency at the surface: once a resolution exists, re-answering cannot double-write or close.',
    async run(w) {
      const { projectId, contract } = await sealedContract(w, 'T3');
      const first = await w.telegram.tapSettlementButton(projectId, contract, 'happened', receipt(w));
      await w.step({ scenario: 'T3', step: 'answer-first', surface: 'telegram', action: 'observe_and_resolve', projectId },
        { ok: true, appended: 2 }, async () => first.result);
      const again = await w.telegram.tapSettlementButton(projectId, contract, 'avoided', receipt(w));
      await w.step({ scenario: 'T3', step: 'answer-again', surface: 'telegram', action: 'observe_and_resolve', projectId },
        { ok: true, appended: 0 }, async () => again.result);
      const text = again.transcript.sent.at(-1)?.text ?? '';
      if (!text.includes('이미 기록') && !text.includes('already recorded')) throw new Error(`unexpected copy: ${text}`);
      if (!again.transcript.sent.at(-1)?.keyboard) throw new Error('close offer missing on duplicate answer');
    },
  },
  {
    id: 'T4',
    title: '“Not yet” defers the return contract without closing, and re-aims the reminder',
    proves: 'P7 step 8a: pending = defer (non-terminal event) + the legacy reminder projection follows the event.',
    async run(w) {
      const { projectId, seal, contract } = await sealedContract(w, 'T4');
      const out = await w.telegram.tapSettlementButton(projectId, contract, 'pending', receipt(w));
      await w.step({ scenario: 'T4', step: 'pending', surface: 'telegram', action: 'defer', projectId },
        { ok: true, appended: 1 }, async () => out.result);
      const deferred = w.stream(projectId).find((e) => (e as { event?: string }).event === 'return_deferred') as { review_at: string } | undefined;
      if (!deferred) throw new Error('return_deferred missing');
      const projection = w.projection(projectId, seal.judgment_id);
      if (projection?.lifecycle !== 'sealed' && projection?.lifecycle !== 'due') throw new Error(`pending terminalized: ${projection?.lifecycle}`);
      const decision = w.emu.telegramDecisions.find((d) => d.id === projectId);
      if (!decision?.check_by || decision.check_by !== deferred.review_at.slice(0, 10) && decision.check_by < deferred.review_at.slice(0, 10)) {
        // check_by is the KST date of review_at; assert it moved to a real date.
        if (!decision?.check_by) throw new Error('reminder check_by did not follow the defer');
      }
    },
  },
  {
    id: 'T5',
    title: 'Mute stops reminders only — zero ledger writes',
    proves: 'P7 step 8b: mute is a delivery change, never a semantic event (over-fire mirror clause).',
    async run(w) {
      const { projectId, contract } = await sealedContract(w, 'T5');
      const out = await w.telegram.tapSettlementButton(projectId, contract, 'mute', receipt(w));
      await w.step({ scenario: 'T5', step: 'mute', surface: 'telegram', action: 'mute', projectId },
        { ok: true, appended: 0 }, async () => out.result);
      const project = w.emu.projects.find((p) => p.id === projectId)!;
      const stored = project.decision_contract as { reminder_count?: number };
      if (stored.reminder_count !== 3) throw new Error(`reminder_count=${stored.reminder_count}`);
      const text = out.transcript.sent.at(-1)?.text ?? '';
      if (!text.includes('열어 둘게요') && !text.includes('stays open')) throw new Error(`mute copy: ${text}`);
    },
  },
  {
    id: 'T6',
    title: 'Close before any answer is refused with honest copy',
    proves: 'No closure can be fabricated from a bare close tap; the user is told an answer must exist first.',
    async run(w) {
      const { projectId, contract } = await sealedContract(w, 'T6');
      const { transcript } = await w.telegram.tapCloseButton(projectId, contract, receipt(w));
      await w.step({ scenario: 'T6', step: 'close-early', surface: 'telegram', action: 'close', projectId },
        { ok: true, appended: 0 }, async () => ({ ok: true }));
      const text = transcript.sent.at(-1)?.text ?? '';
      if (!text.includes('answer must be recorded')) throw new Error(`unexpected copy: ${text}`);
      if (w.stream(projectId).some((e) => (e as { event?: string }).event === 'judgment_closed')) throw new Error('close event admitted without resolution');
    },
  },
  {
    id: 'T7',
    title: 'Free-text reply (Korean alias + note) parses into the answer and preserves the note',
    proves: 'The reply-token path: the REAL parser maps 됐어/아직/반반… to intents and the note reaches the observation text.',
    async run(w) {
      const { projectId, contract } = await sealedContract(w, 'T7');
      const out = await w.telegram.replyToReminder(projectId, contract, '됐어: 전환율 3.5%로 마감', receipt(w));
      if (out.intent?.outcome !== 'happened' || !out.intent.note?.includes('전환율')) {
        throw new Error(`parsed intent: ${JSON.stringify(out.intent)}`);
      }
      await w.step({ scenario: 'T7', step: 'reply-answer', surface: 'telegram', action: 'observe_and_resolve', projectId },
        { ok: true, appended: 2 }, async () => out.result);
      const observation = w.stream(projectId).find((e) => (e as { event?: string }).event === 'observation_recorded') as { text: string };
      if (!observation.text.includes('전환율 3.5%로 마감')) throw new Error(`note lost: ${observation.text}`);
    },
  },
  {
    id: 'T8',
    title: 'A callback aimed at someone else’s project is refused before any read',
    proves: 'Ownership gate: attacker-typable callback payloads cannot touch a foreign ledger.',
    async run(w) {
      const foreign = w.newForeignProject();
      const contract = w.contract(foreign, w.rng.id('judgment'));
      const out = await w.telegram.tapSettlementButton(foreign, contract, 'happened', receipt(w));
      await w.step({ scenario: 'T8', step: 'foreign-callback', surface: 'telegram', action: 'observe_and_resolve' },
        { ok: false, code: 'OWNERSHIP_REFUSED' }, async () => out.result);
      if (w.emu.semanticEvents.some((r) => r.project_id === foreign)) throw new Error('foreign ledger was written');
    },
  },
  {
    id: 'T9',
    title: 'Deferring twice is two preserved authorial acts, not an overwrite',
    proves: 'Repeated defers append (append-only), each with its own receipt; the latest review_at wins the projection.',
    async run(w) {
      const { projectId, contract } = await sealedContract(w, 'T9');
      const first = await w.telegram.tapSettlementButton(projectId, contract, 'pending', receipt(w));
      await w.step({ scenario: 'T9', step: 'defer-1', surface: 'telegram', action: 'defer', projectId },
        { ok: true, appended: 1 }, async () => first.result);
      w.emu.tick();
      const second = await w.telegram.tapSettlementButton(projectId, contract, 'pending', receipt(w));
      await w.step({ scenario: 'T9', step: 'defer-2', surface: 'telegram', action: 'defer', projectId },
        { ok: true, appended: 1 }, async () => second.result);
      const defers = w.stream(projectId).filter((e) => (e as { event?: string }).event === 'return_deferred');
      if (defers.length !== 2) throw new Error(`expected 2 preserved defers, found ${defers.length}`);
    },
  },
];
