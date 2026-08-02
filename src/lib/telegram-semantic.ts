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
import type { ContractSettlement, DecisionContract, DecisionKind } from '@/stores/types';
import { amendCheckIn, appendContractSettlement } from '@/lib/decision-contract';
import {
  detectSettlementLocale,
  foundationPresentStandardReplyMarkup,
  foundationSettlementReplyMarkup,
  semanticCloseReplyMarkup,
  type TelegramFoundationSettlementIntent,
  type TelegramSettlementIntent,
} from '@/lib/telegram-settlement';
import {
  axesWithPresentStandard,
  FOUNDATION_SETTLEMENT_OPTIONS,
  presentStandardLabel,
  presentStandardQuestion,
} from '@/lib/foundation-settlement';
import { buildSemanticWebCommand } from '@/lib/semantic-web';
import { appendProjectSemanticEvents, readProjectSemanticEvents } from '@/lib/semantic-ledger-gateway';
import { fold, type SemanticState } from '@/lib/decision-kernel';
import { generateId } from '@/lib/uuid';

// The gateway keeps the untyped Supabase edge in one place; mirror that here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export interface TelegramSemanticDeps {
  admin: AdminClient;
  // Semantic handlers only require the attempt to settle. The production
  // sender additionally returns whether Telegram accepted the delivery.
  send: (chatId: number | string, html: string, keyboard?: unknown) => Promise<unknown>;
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

function settlementResolution(
  option: (typeof FOUNDATION_SETTLEMENT_OPTIONS)[Exclude<DecisionKind, 'witness'>][number],
  status: NonNullable<ContractSettlement['present_standard']>['status'],
  responseText: string,
  presentResponse: string,
  observationId: string,
) {
  const axes = axesWithPresentStandard(option.axes, status);
  const present_standard = { status, response_text: presentResponse };
  if (axes.question === 'moot') {
    return {
      kind: 'moot' as const,
      reason: responseText,
      ...(axes.reality ? { criterion_result: axes.reality } : {}),
      ...(axes.commitment ? { commitment_result: axes.commitment } : {}),
      question_validity: 'moot' as const,
      present_standard,
      evidence_refs: [observationId],
    };
  }
  if (axes.question === 'indeterminate') {
    return {
      kind: 'indeterminate' as const,
      reason: responseText,
      ...(axes.reality ? { criterion_result: axes.reality } : {}),
      ...(axes.commitment ? { commitment_result: axes.commitment } : {}),
      question_validity: 'indeterminate' as const,
      present_standard,
      evidence_refs: [observationId],
    };
  }
  return {
    kind: 'answered' as const,
    answer_summary: responseText,
    ...(axes.reality ? { criterion_result: axes.reality } : {}),
    ...(axes.commitment ? { commitment_result: axes.commitment } : {}),
    question_validity: axes.question,
    present_standard,
    evidence_refs: [observationId],
  };
}

/**
 * Complete the same two-answer foundation return used by the web. The first
 * callback only asks the follow-up; the second appends both selected labels in
 * one write, so an abandoned Telegram conversation never becomes a fabricated
 * answer.
 */
export async function handleFoundationContractSettlement(
  deps: TelegramSemanticDeps,
  chatId: number | string,
  userId: string,
  row: { id: string; name?: string; decision_contract?: unknown },
  contract: DecisionContract,
  intent: TelegramFoundationSettlementIntent,
  receiptRef: string,
): Promise<boolean> {
  const { admin, send } = deps;
  const locale = detectSettlementLocale(
    row.name,
    ...(Array.isArray(contract.predicates) ? contract.predicates : []).map((predicate) => predicate?.text),
  );
  let kind = contract.kind;
  let events: unknown[] | null = null;
  let semanticState: SemanticState | null = null;
  const judgmentId = contract.semantic_judgment_id;
  if (judgmentId) {
    events = await readProjectSemanticEvents(admin, userId, row.id);
    if (!events) {
      await send(chatId, locale === 'ko'
        ? '계정 기록을 읽지 못했어요. 아무것도 바꾸지 않았습니다.'
        : 'I could not read the account record. Nothing changed.');
      return true;
    }
    semanticState = fold(events) as SemanticState;
    kind = semanticState.judgments.get(judgmentId)?.kind;
  }
  if (!kind || kind === 'witness' || intent.optionKind !== kind) {
    await send(chatId, locale === 'ko'
      ? '기록의 종류가 달라졌어요. 프로젝트에서 현재 기록을 다시 확인해 주세요.'
      : 'The record type has changed. Reopen the current record from the project.');
    return true;
  }
  const currentJudgment = judgmentId && semanticState
    ? semanticState.judgments.get(judgmentId)
    : undefined;
  if (currentJudgment?.resolution) {
    await send(
      chatId,
      locale === 'ko'
        ? '답변은 이미 기록되어 있어요. 종결은 별도 확인이 필요합니다.'
        : 'An answer is already recorded. Closing needs separate confirmation.',
      semanticCloseReplyMarkup(row.id, contract.id, locale),
    );
    return true;
  }
  const option = FOUNDATION_SETTLEMENT_OPTIONS[kind].find((candidate) => candidate.id === intent.optionId);
  if (!option) {
    await send(chatId, locale === 'ko' ? '그 답을 확인하지 못했어요.' : 'I could not verify that answer.');
    return true;
  }
  if (!intent.presentStandard) {
    await send(
      chatId,
      presentStandardQuestion(kind, locale),
      foundationPresentStandardReplyMarkup(row.id, contract.id, kind, option.id, locale),
    );
    return true;
  }

  const recordedAt = (deps.now ?? (() => new Date()))().toISOString();
  const responseText = locale === 'ko' ? option.ko : option.en;
  const presentResponse = presentStandardLabel(kind, intent.presentStandard, locale);
  const observationId = `telegram-observation:${(deps.newId ?? generateId)()}`;

  if (judgmentId && semanticState) {
    const judgment = semanticState.judgments.get(judgmentId);
    const returnContractId = judgment?.active_return_contract_id;
    if (!judgment || !returnContractId) {
      await send(chatId, locale === 'ko'
        ? '활성 확인 약속을 찾지 못했어요. 아무것도 바꾸지 않았습니다.'
        : 'I could not find an active return. Nothing changed.');
      return true;
    }
    if (judgment.resolution) {
      await send(
        chatId,
        locale === 'ko'
          ? '답변은 이미 기록되어 있어요. 종결은 별도 확인이 필요합니다.'
          : 'An answer is already recorded. Closing needs separate confirmation.',
        semanticCloseReplyMarkup(row.id, contract.id, locale),
      );
      return true;
    }
    const built = buildSemanticWebCommand({
      project_id: row.id,
      command: {
        kind: 'observe_and_resolve',
        command_id: `telegram-${(deps.newId ?? generateId)()}`,
        observation_id: observationId,
        observation_text: responseText,
        observation_source_ref: receiptRef,
        observation_source_kind: 'user_report',
        resolution_id: `telegram-resolution:${(deps.newId ?? generateId)()}`,
        judgment_id: judgmentId,
        return_contract_id: returnContractId,
        resolution: settlementResolution(
          option,
          intent.presentStandard,
          responseText,
          presentResponse,
          observationId,
        ),
      },
      recorded_at: recordedAt,
      origin: telegramSemanticOrigin(receiptRef),
    });
    if (!built.ok) {
      await send(chatId, locale === 'ko'
        ? '답변 명령이 유효하지 않았어요. 아무것도 바꾸지 않았습니다.'
        : 'The answer was invalid. Nothing changed.');
      return true;
    }
    const appended = await appendProjectSemanticEvents(admin, userId, row.id, built.events);
    if (!appended.ok) {
      await send(chatId, locale === 'ko'
        ? `답변을 기록하지 못했어요 (${appended.code}).`
        : `I could not record the answer (${appended.code}).`);
      return true;
    }
    await admin.from('telegram_decisions')
      .update({ status: 'settled', outcome: null, settled_at: recordedAt })
      .eq('id', row.id).eq('user_id', userId).eq('status', 'sealed');
    await send(
      chatId,
      locale === 'ko'
        ? '돌아온 답과 지금의 기준을 함께 기록했어요. 종결은 아래에서 따로 확인해 주세요.'
        : 'I recorded your return and present standard together. Close it separately below.',
      semanticCloseReplyMarkup(row.id, contract.id, locale),
    );
    return true;
  }

  const settlement: ContractSettlement = {
    option_id: option.id,
    response_text: responseText,
    recorded_at: recordedAt,
    axes: axesWithPresentStandard(option.axes, intent.presentStandard),
    observation_source_kind: 'user_report',
    authorization: {
      authorized_by: 'human',
      authorization_mode: 'direct_command',
      surface: 'telegram',
      authorization_ref: receiptRef,
      authorized_at: recordedAt,
    },
    present_standard: {
      status: intent.presentStandard,
      response_text: presentResponse,
      recorded_at: recordedAt,
    },
  };
  const next = appendContractSettlement(contract, settlement);
  if (next === contract) {
    await send(chatId, locale === 'ko'
      ? '이 답은 이미 기록되어 있어요.'
      : 'This answer is already recorded.');
    return true;
  }
  const { error } = await admin.from('projects')
    .update({ decision_contract: next })
    .eq('id', row.id)
    .eq('user_id', userId);
  if (error) {
    await send(chatId, locale === 'ko'
      ? '기록이 그사이 바뀌었거나 저장하지 못했어요. 프로젝트를 새로 열고 다시 시도해 주세요.'
      : 'The record changed or could not be saved. Reopen the project and try again.');
    return true;
  }
  await admin.from('telegram_decisions')
    .update({ status: 'settled', outcome: null, settled_at: recordedAt })
    .eq('id', row.id).eq('user_id', userId).eq('status', 'sealed');
  await send(chatId, locale === 'ko'
    ? '그때의 문장은 그대로 두고, 돌아온 답과 지금의 기준을 덧붙였어요.'
    : 'The original remains intact; I appended your return and present standard.');
  return true;
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
  if (judgment.kind === 'witness') {
    await send(chatId, locale === 'ko'
      ? '이 기록은 다시 묻지 않기로 한 원문 기록입니다.'
      : 'This is a preserved statement with no future return.');
    return true;
  }
  await send(
    chatId,
    locale === 'ko'
      ? '방금 답은 아직 저장하지 않았어요. 이 기록에 맞는 답 하나를 골라 주세요.'
      : 'I have not saved that reply. Choose the answer that fits this record.',
    foundationSettlementReplyMarkup(row.id, contract.id, judgment.kind, locale),
  );
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
