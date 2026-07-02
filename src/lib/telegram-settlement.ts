import type { DecisionContract, PredicateVerdict } from '@/stores/types';
import { amendCheckIn, gradePredicate, isResolved } from './decision-contract';
import { REMINDER_MAX_SENDS } from './checkin-reminder';

/** 'mute' = "그만 물어봐 주세요": stops the reminder cron (reminder_count → cap)
 *  while the decision stays open on every web due surface. An escape hatch, not
 *  a settlement. */
export type TelegramSettlementOutcome = Extract<PredicateVerdict, 'happened' | 'avoided' | 'partial'> | 'pending' | 'mute';

export interface TelegramSettlementIntent {
  projectId: string;
  contractId?: string;
  outcome: TelegramSettlementOutcome;
  note?: string;
  source: 'callback' | 'command' | 'reply';
}

export interface TelegramSettlementResult {
  contract: DecisionContract;
  outcome: TelegramSettlementOutcome;
  graded: number;
  alreadySettled: boolean;
  deferred: boolean;
  freeformClosed: boolean;
  /** True when the user asked to stop the reminders (nothing settled). */
  muted?: boolean;
}

const TOKEN_PREFIX = 'ARGUS_SETTLE';

const OUTCOME_ALIASES: Array<[RegExp, TelegramSettlementOutcome]> = [
  [/^(happened|hit|yes|true|held|발생(?:함|했음|했어|했다|했고)?|맞음|맞아|맞았어|됐다|됐어|성공(?:함|했어|했다)?|됨)(?=$|[\s:：,\-])/iu, 'happened'],
  [/^(avoided|prevented|no|false|회피(?:함|했어|했다)?|피함|피했어|막음|막았어|안\s*일어남|안\s*일어났어)(?=$|[\s:：,\-])/iu, 'avoided'],
  [/^(partial|partly|some|mixed|부분(?:적)?|일부|반반|애매|섞임)(?=$|[\s:：,\-])/iu, 'partial'],
  [/^(later|pending|still\s*pending|not\s*yet|아직(?:임|이야)?|나중|보류|미정)(?=$|[\s:：,\-])/iu, 'pending'],
];

export function settlementToken(projectId: string, contractId?: string): string {
  return contractId ? `${TOKEN_PREFIX}:${projectId}:${contractId}` : `${TOKEN_PREFIX}:${projectId}`;
}

const CALLBACK_PREFIX = 'stl1';
const CALLBACK_OUTCOME_CODE: Record<TelegramSettlementOutcome, string> = {
  happened: 'h',
  avoided: 'a',
  partial: 'm',
  pending: 'p',
  mute: 'u',
};
const CALLBACK_CODE_OUTCOME: Record<string, TelegramSettlementOutcome> = {
  h: 'happened',
  a: 'avoided',
  m: 'partial',
  p: 'pending',
  u: 'mute',
};

/** Locale detection for outbound settlement copy — one brain shared by the
 *  checkin-due cron and the webhook (same rule telegram-reminders uses). */
export function detectSettlementLocale(...parts: Array<string | undefined>): 'ko' | 'en' {
  return /[가-힣]/.test(parts.filter(Boolean).join(' ')) ? 'ko' : 'en';
}

export function settlementReplyMarkup(projectId: string, contractId?: string, locale: 'ko' | 'en' = 'ko') {
  const callbackTarget = contractId ? encodeCallbackTarget(projectId, contractId) : null;
  const callbackData = (outcome: TelegramSettlementOutcome) =>
    callbackTarget
      ? `${CALLBACK_PREFIX}|${CALLBACK_OUTCOME_CODE[outcome]}|${callbackTarget}`
      : `stl|${outcome}|${projectId}`;
  const ko = locale === 'ko';

  // One brain with seal-core's settleKeyboard vocabulary (잘 됐어요/안 됐어요/반반/아직).
  return {
    inline_keyboard: [
      [
        { text: ko ? '✅ 잘 됐어요' : '✅ It happened', callback_data: callbackData('happened') },
        { text: ko ? '✋ 안 됐어요' : '✋ It didn’t', callback_data: callbackData('avoided') },
      ],
      [
        { text: ko ? '〰 반반' : '〰 Partly', callback_data: callbackData('partial') },
        { text: ko ? '⏳ 아직' : '⏳ Not yet', callback_data: callbackData('pending') },
      ],
      // The escape hatch (10 S3): stops the reminders, keeps the decision open
      // on the web due surfaces. Intervention-reducing — mirror-clause aligned.
      [{ text: ko ? '🌙 그만 물어봐 주세요' : '🌙 Stop asking me', callback_data: callbackData('mute') }],
    ],
  };
}

/** The check-in question for a WEB-sealed contract. Same voice as seal-core's
 *  settleQuestionMarkdown ("그래서, 어떻게 됐어요?") — the two reminder brains
 *  must not drift apart in tone (03 S1 / 02 P0-1). The raw token stays as the
 *  LAST line only, for reply matching; the buttons are the primary path. */
export function settlementReminderText(args: {
  projectName: string;
  projectId: string;
  contractId?: string;
  predicate?: string;
  locale?: 'ko' | 'en';
  /** True on the REMINDER_MAX_SENDS-th (last) send — says so honestly. */
  isFinal?: boolean;
}): string {
  const token = settlementToken(args.projectId, args.contractId);
  const locale = args.locale ?? 'ko';
  const name = escapeTelegramHtml(args.projectName || (locale === 'ko' ? '제목 없는 결정' : 'Untitled'));
  const predicate = args.predicate ? escapeTelegramHtml(args.predicate.slice(0, 220)) : '';

  if (locale === 'ko') {
    return [
      '<b>그래서, 어떻게 됐어요?</b>',
      '',
      `「${name}」 — 봉인할 때 이날 물어봐 달라고 하셨어요.`,
      predicate ? `확인할 것: ${predicate}` : '',
      '',
      '아래 버튼으로 답하거나, 이 메시지에 답장해 주세요. 아직 모르겠으면 "아직"도 답이에요.',
      args.isFinal ? '이제 조용히 열어둘게요. 언제든 돌아오시면 그때 물어볼게요 — 프로젝트 페이지에 그대로 있어요.' : '',
      `<code>${token}</code>`,
    ].filter(Boolean).join('\n');
  }
  return [
    '<b>So — how did it go?</b>',
    '',
    `“${name}” — you asked to be asked on this day when you sealed it.`,
    predicate ? `The check: ${predicate}` : '',
    '',
    'Tap a button, or just reply to this message. “Not yet” is a valid answer too.',
    args.isFinal ? 'This is the last nudge — I’ll keep it quietly open. Whenever you come back, it’s right there on your project page.' : '',
    `<code>${token}</code>`,
  ].filter(Boolean).join('\n');
}

export function parseSettlementIntent(input: {
  text?: string;
  callbackData?: string;
  replyText?: string;
}): TelegramSettlementIntent | null {
  const callback = parseCallbackData(input.callbackData);
  if (callback) return callback;

  const command = parseCommand(input.text);
  if (command) return command;

  const replyToken = parseToken(input.replyText);
  if (!replyToken || !input.text) return null;

  const matchedOutcome = matchOutcome(input.text);
  if (!matchedOutcome) return null;

  return {
    ...replyToken,
    outcome: matchedOutcome.outcome,
    note: stripOutcome(input.text, matchedOutcome.matchedText),
    source: 'reply',
  };
}

export function applyTelegramSettlement(
  contract: DecisionContract,
  intent: Pick<TelegramSettlementIntent, 'outcome' | 'note'>,
  now: number,
): TelegramSettlementResult {
  // "그만 물어봐 주세요" — stop the reminder cron, settle nothing. check_in_at
  // stays, so every web due surface keeps showing the open decision (10 S3:
  // the reminders stop, the door stays open).
  if (intent.outcome === 'mute') {
    return {
      contract: { ...contract, reminder_count: REMINDER_MAX_SENDS },
      outcome: intent.outcome,
      graded: 0,
      alreadySettled: false,
      deferred: false,
      freeformClosed: false,
      muted: true,
    };
  }

  if (intent.outcome === 'pending') {
    return {
      contract: amendCheckIn({ ...contract, outcome_note: cleanNote(intent.note) ?? contract.outcome_note }, '1w', now),
      outcome: intent.outcome,
      graded: 0,
      alreadySettled: false,
      deferred: true,
      freeformClosed: false,
    };
  }

  const predicates = Array.isArray(contract.predicates) ? contract.predicates : [];
  if (predicates.length === 0) {
    return {
      contract: {
        ...contract,
        outcome_note: cleanNote(intent.note) ?? contract.outcome_note,
        graded_at: new Date(now).toISOString(),
        check_in_at: undefined,
        check_in_interval: undefined,
      },
      outcome: intent.outcome,
      graded: 0,
      alreadySettled: false,
      deferred: false,
      freeformClosed: true,
    };
  }

  let next: DecisionContract = { ...contract, outcome_note: cleanNote(intent.note) ?? contract.outcome_note };
  let graded = 0;
  for (const predicate of predicates) {
    if (isResolved(predicate)) continue;
    next = gradePredicate(next, predicate.id, intent.outcome, now);
    graded++;
  }

  return {
    contract: next,
    outcome: intent.outcome,
    graded,
    alreadySettled: graded === 0,
    deferred: false,
    freeformClosed: false,
  };
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseCallbackData(data?: string): TelegramSettlementIntent | null {
  if (!data) return null;
  const parts = data.split('|');
  if (parts.length === 3 && parts[0] === CALLBACK_PREFIX) {
    const outcome = CALLBACK_CODE_OUTCOME[parts[1]];
    const target = decodeCallbackTarget(parts[2]);
    if (!outcome || !target) return null;
    return { ...target, outcome, source: 'callback' };
  }
  if (parts.length !== 3 || parts[0] !== 'stl') return null;
  const outcome = parts[1] === 'mute' ? 'mute' : parseOutcome(parts[1]);
  if (!outcome || !parts[2]) return null;
  return { projectId: parts[2], outcome, source: 'callback' };
}

function parseCommand(text?: string): TelegramSettlementIntent | null {
  const match = text?.trim().match(/^\/settle(?:@\w+)?\s+(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (!match) return null;
  const target = parseToken(match[1]) ?? parseCompactTarget(match[1]);
  if (!target.projectId) return null;
  const outcome = parseOutcome(match[2]);
  if (!outcome) return null;
  return {
    ...target,
    outcome,
    note: cleanNote(match[3]),
    source: 'command',
  };
}

function parseToken(text?: string): Pick<TelegramSettlementIntent, 'projectId' | 'contractId'> | null {
  const match = text?.match(/ARGUS_SETTLE:([^:\s]+)(?::([^:\s]+))?/);
  if (!match) return null;
  return { projectId: match[1], contractId: match[2] };
}

function parseCompactTarget(text: string): Pick<TelegramSettlementIntent, 'projectId' | 'contractId'> {
  const [projectId, contractId] = text.split(':');
  return { projectId, contractId };
}

function parseOutcome(text: string): TelegramSettlementOutcome | null {
  return matchOutcome(text)?.outcome ?? null;
}

function matchOutcome(text: string): { outcome: TelegramSettlementOutcome; matchedText: string } | null {
  const normalized = text.trim();
  for (const [pattern, outcome] of OUTCOME_ALIASES) {
    const match = normalized.match(pattern);
    if (match?.[0]) return { outcome, matchedText: match[0] };
  }
  return null;
}

function stripOutcome(text: string, matchedText: string): string | undefined {
  const stripped = text.trim().slice(matchedText.length).replace(/^[:：,\-\s]+/, '').trim();
  return cleanNote(stripped);
}

function cleanNote(note?: string): string | undefined {
  const trimmed = note?.trim();
  return trimmed ? trimmed.slice(0, 1000) : undefined;
}

function encodeCallbackTarget(projectId: string, contractId: string): string | null {
  const projectBytes = uuidToBytes(projectId);
  const contractBytes = uuidToBytes(contractId);
  if (!projectBytes || !contractBytes) return null;
  return Buffer.concat([projectBytes, contractBytes]).toString('base64url');
}

function decodeCallbackTarget(token: string): Pick<TelegramSettlementIntent, 'projectId' | 'contractId'> | null {
  try {
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.length !== 32) return null;
    return {
      projectId: bytesToUuid(bytes.subarray(0, 16)),
      contractId: bytesToUuid(bytes.subarray(16, 32)),
    };
  } catch {
    return null;
  }
}

function uuidToBytes(id: string): Buffer | null {
  const hex = id.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return Buffer.from(hex, 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
