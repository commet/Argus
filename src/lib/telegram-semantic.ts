/**
 * Telegram → canonical semantic ledger brain (DKK v6 P7).
 *
 * Extracted verbatim from the webhook route so the route and the dogfood
 * runner (scripts/dogfood) exercise ONE implementation — the same
 * single-source-of-truth rule as reframe-core. The webhook binds `admin` to
 * the real service client and `send` to tgSendMessage; the runner binds an
 * in-memory ledger emulator and a captured transcript. Logic must not fork.
 *
 * Semantic invariants owned here (ADR P7):
 *  - an answer appends observation + resolution atomically and NEVER closes;
 *  - close is a separate human-authorized act with its own receipt;
 *  - pending defers (non-terminal); mute changes delivery only (no ledger write).
 */
import type { DecisionContract } from '@/stores/types';
import { amendCheckIn } from '@/lib/decision-contract';
import {
  detectSettlementLocale,
  semanticCloseReplyMarkup,
  type TelegramSettlementIntent,
} from '@/lib/telegram-settlement';
import { buildSemanticWebCommand } from '@/lib/semantic-web';
import { appendProjectSemanticEvents, readProjectSemanticEvents } from '@/lib/semantic-ledger-gateway';
import { fold, type SemanticState } from '@/lib/decision-kernel';
import { generateId } from '@/lib/uuid';

// The gateway keeps the untyped Supabase edge in one place; mirror that here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export interface TelegramSemanticDeps {
  admin: AdminClient;
  send: (chatId: number | string, html: string, keyboard?: unknown) => Promise<void>;
  /** Injectable for deterministic runs; production uses the real clock/ids. */
  now?: () => Date;
  newId?: () => string;
}

/** An ISO timestamp as a YYYY-MM-DD string in KST (matches telegram-sync's check_by). */
export function kstDateOf(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function telegramSemanticOrigin(receiptRef: string) {
  return {
    recorder_id: 'telegram:argus',
    authorization_mode: 'direct_command' as const,
    authorization_kind: 'user_utterance' as const,
    authorization_ref: receiptRef,
  };
}

export function semanticAnswerText(intent: TelegramSettlementIntent): string {
  const selected = intent.outcome === 'happened' ? 'happened'
    : intent.outcome === 'avoided' ? 'did not happen'
      : 'partly happened';
  // This is an attribution of the Telegram action, not a fabricated world fact.
  return intent.note?.trim()
    ? `Telegram user response (${selected}): ${intent.note.trim()}`
    : `Telegram user selected “${selected}”.`;
}

export async function handleSemanticContractSettlement(
  deps: TelegramSemanticDeps,
  chatId: number | string,
  userId: string,
  row: { id: string; name?: string; decision_contract?: unknown },
  contract: DecisionContract,
  intent: TelegramSettlementIntent,
  receiptRef: string,
): Promise<boolean> {
  const judgmentId = contract.semantic_judgment_id;
  if (!judgmentId) return false;
  const { admin, send } = deps;
  const nowDate = deps.now ?? (() => new Date());
  const newId = deps.newId ?? generateId;
  const locale = detectSettlementLocale(row.name, ...(Array.isArray(contract.predicates) ? contract.predicates : []).map((p) => p?.text));
  const existing = await readProjectSemanticEvents(admin, userId, row.id);
  if (!existing) {
    await send(chatId, locale === 'ko' ? '정본 기록을 읽지 못했어요. 아무것도 바꾸지 않았습니다.' : 'I could not read the canonical record. Nothing changed.');
    return true;
  }
  const state = fold(existing) as SemanticState;
  const judgment = state.judgments.get(judgmentId);
  const returnContractId = judgment?.active_return_contract_id;
  if (!judgment || !returnContractId) {
    await send(chatId, locale === 'ko' ? '이 판단의 활성 확인 약속을 찾지 못했어요.' : 'I could not find this judgment’s active return contract.');
    return true;
  }

  if (intent.outcome === 'mute') {
    const { error } = await admin.from('projects')
      .update({ decision_contract: { ...contract, reminder_count: 3 } })
      .eq('id', row.id).eq('user_id', userId);
    if (error) {
      await send(chatId, locale === 'ko' ? '알림을 멈추지 못했어요. 기록은 바뀌지 않았습니다.' : 'I could not stop reminders. The record was not changed.');
    } else {
      await send(chatId, locale === 'ko' ? '알겠어요. 알림만 멈추고 판단 기록은 열어 둘게요.' : 'Understood. I stopped reminders only; the judgment record stays open.');
    }
    return true;
  }

  const now = nowDate().toISOString();
  if (intent.outcome === 'pending') {
    const reviewAt = new Date(nowDate().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const built = buildSemanticWebCommand({
      project_id: row.id,
      command: { kind: 'defer', command_id: `telegram-${newId()}`, return_contract_id: returnContractId, review_at: reviewAt, ...(intent.note ? { reason: intent.note } : {}) },
      recorded_at: now,
      origin: telegramSemanticOrigin(receiptRef),
    });
    if (!built.ok) {
      await send(chatId, locale === 'ko' ? '미루기 명령이 유효하지 않았어요. 기록은 바뀌지 않았습니다.' : 'The defer command was invalid. The record was not changed.');
      return true;
    }
    const appended = await appendProjectSemanticEvents(admin, userId, row.id, built.events);
    if (!appended.ok) {
      await send(chatId, locale === 'ko' ? `기록을 미루지 못했어요 (${appended.code}).` : `I could not defer the record (${appended.code}).`);
      return true;
    }
    // The legacy jsonb remains a notification projection only. Its date must
    // follow the event so the existing reminder cron does not send stale mail.
    await admin.from('projects').update({ decision_contract: amendCheckIn(contract, '1w', nowDate().getTime()) }).eq('id', row.id).eq('user_id', userId);
    await admin.from('telegram_decisions').update({ check_by: kstDateOf(reviewAt), reminded_at: null }).eq('id', row.id).eq('user_id', userId).eq('status', 'sealed');
    await send(chatId, locale === 'ko' ? '종결하지 않고 다음 확인 시점으로 미뤘어요.' : 'Deferred without closing the record.');
    return true;
  }

  if (judgment.resolution) {
    await send(chatId, locale === 'ko' ? '답변은 이미 기록되어 있어요. 종결은 별도 확인이 필요합니다.' : 'An answer is already recorded. Closing needs a separate confirmation.', semanticCloseReplyMarkup(row.id, contract.id, locale));
    return true;
  }
  const outcome = intent.outcome;
  const observationId = `telegram-observation:${newId()}`;
  const built = buildSemanticWebCommand({
    project_id: row.id,
    command: {
      kind: 'observe_and_resolve', command_id: `telegram-${newId()}`,
      observation_id: observationId,
      observation_text: semanticAnswerText(intent), observation_source_ref: receiptRef,
      resolution_id: `telegram-resolution:${newId()}`, judgment_id: judgmentId, return_contract_id: returnContractId,
      resolution: {
        kind: 'answered', answer_summary: semanticAnswerText(intent),
        ...(outcome === 'partial' ? { criterion_result: 'partial' as const } : {}),
        evidence_refs: [observationId],
      },
    },
    recorded_at: now,
    origin: telegramSemanticOrigin(receiptRef),
  });
  if (!built.ok) {
    await send(chatId, locale === 'ko' ? '답변 명령이 유효하지 않았어요. 기록은 바뀌지 않았습니다.' : 'The answer command was invalid. The record was not changed.');
    return true;
  }
  const appended = await appendProjectSemanticEvents(admin, userId, row.id, built.events);
  if (!appended.ok) {
    await send(chatId, locale === 'ko' ? `답변을 기록하지 못했어요 (${appended.code}).` : `I could not record the answer (${appended.code}).`);
    return true;
  }
  await send(chatId, locale === 'ko'
    ? '답변과 그 근거를 기록했어요. 아직 종결하지는 않았습니다. 아래에서 별도로 확인해 주세요.'
    : 'I recorded the answer and its evidence. It is not closed yet; confirm separately below.', semanticCloseReplyMarkup(row.id, contract.id, locale));
  return true;
}

export async function handleSemanticContractClose(
  deps: TelegramSemanticDeps,
  chatId: number | string,
  userId: string,
  projectId: string,
  contractId: string | undefined,
  receiptRef: string,
): Promise<void> {
  const { admin, send } = deps;
  const nowDate = deps.now ?? (() => new Date());
  const newId = deps.newId ?? generateId;
  const { data: row } = await admin.from('projects').select('id, user_id, name, decision_contract').eq('id', projectId).single();
  const contract = (row?.decision_contract ?? null) as DecisionContract | null;
  if (!row || row.user_id !== userId || !contract || (contractId && contract.id && contract.id !== contractId) || !contract.semantic_judgment_id) {
    await send(chatId, 'That canonical record could not be found.');
    return;
  }
  const events = await readProjectSemanticEvents(admin, userId, row.id);
  const state = events ? fold(events) as SemanticState : undefined;
  const judgment = state?.judgments.get(contract.semantic_judgment_id);
  if (!judgment?.resolution) {
    await send(chatId, 'An answer must be recorded before this record can close.');
    return;
  }
  if (judgment.closed) {
    await send(chatId, 'This record is already closed.');
    return;
  }
  const built = buildSemanticWebCommand({
    project_id: row.id,
    command: { kind: 'close', command_id: `telegram-${newId()}`, judgment_id: contract.semantic_judgment_id, resolution_id: judgment.resolution.id },
    recorded_at: nowDate().toISOString(), origin: telegramSemanticOrigin(receiptRef),
  });
  if (!built.ok) { await send(chatId, 'The close command was invalid. The record was not changed.'); return; }
  const appended = await appendProjectSemanticEvents(admin, userId, row.id, built.events);
  if (!appended.ok) { await send(chatId, `I could not close the record (${appended.code}).`); return; }
  await admin.from('telegram_decisions').update({ status: 'settled', settled_at: nowDate().toISOString() }).eq('id', row.id).eq('user_id', userId).eq('status', 'sealed');
  await send(chatId, 'Closed with your separately confirmed answer.');
}
