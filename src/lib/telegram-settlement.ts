import type { DecisionContract, PredicateVerdict } from '@/stores/types';
import { amendCheckIn, gradePredicate, isResolved } from './decision-contract';

export type TelegramSettlementOutcome = Extract<PredicateVerdict, 'happened' | 'avoided' | 'partial'> | 'pending';

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
};
const CALLBACK_CODE_OUTCOME: Record<string, TelegramSettlementOutcome> = {
  h: 'happened',
  a: 'avoided',
  m: 'partial',
  p: 'pending',
};

export function settlementReplyMarkup(projectId: string, contractId?: string) {
  const callbackTarget = contractId ? encodeCallbackTarget(projectId, contractId) : null;
  const callbackData = (outcome: TelegramSettlementOutcome) =>
    callbackTarget
      ? `${CALLBACK_PREFIX}|${CALLBACK_OUTCOME_CODE[outcome]}|${callbackTarget}`
      : `stl|${outcome}|${projectId}`;

  return {
    inline_keyboard: [
      [
        { text: 'Happened', callback_data: callbackData('happened') },
        { text: 'Avoided', callback_data: callbackData('avoided') },
      ],
      [
        { text: 'Partial', callback_data: callbackData('partial') },
        { text: 'Still pending', callback_data: callbackData('pending') },
      ],
    ],
  };
}

export function settlementReminderText(args: {
  projectName: string;
  projectId: string;
  contractId?: string;
  predicate?: string;
}): string {
  const token = settlementToken(args.projectId, args.contractId);
  const predicate = args.predicate
    ? `\n\nCheck: ${args.predicate.slice(0, 220)}`
    : '';
  return [
    '<b>Argus check-in</b>',
    '',
    `Project: ${escapeTelegramHtml(args.projectName || 'Untitled')}`,
    predicate ? escapeTelegramHtml(predicate) : '',
    '',
    'Tap a button, or reply with: happened / avoided / partial / still pending.',
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
  const outcome = parseOutcome(parts[1]);
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
