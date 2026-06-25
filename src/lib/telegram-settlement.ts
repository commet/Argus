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
}

const TOKEN_PREFIX = 'ARGUS_SETTLE';

const OUTCOME_ALIASES: Array<[RegExp, TelegramSettlementOutcome]> = [
  [/^(happened|hit|yes|true|held|발생|맞음|됐다|성공)\b/i, 'happened'],
  [/^(avoided|prevented|no|false|회피|피함|막음|안\s*일어남)\b/i, 'avoided'],
  [/^(partial|partly|some|mixed|부분|일부|반반)\b/i, 'partial'],
  [/^(later|pending|still\s*pending|not\s*yet|아직|나중|보류)\b/i, 'pending'],
];

export function settlementToken(projectId: string, contractId?: string): string {
  return contractId ? `${TOKEN_PREFIX}:${projectId}:${contractId}` : `${TOKEN_PREFIX}:${projectId}`;
}

export function settlementReplyMarkup(projectId: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Happened', callback_data: `stl|happened|${projectId}` },
        { text: 'Avoided', callback_data: `stl|avoided|${projectId}` },
      ],
      [
        { text: 'Partial', callback_data: `stl|partial|${projectId}` },
        { text: 'Still pending', callback_data: `stl|pending|${projectId}` },
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

  const outcome = parseOutcome(input.text);
  if (!outcome) return null;

  return {
    ...replyToken,
    outcome,
    note: stripOutcome(input.text, outcome),
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
    };
  }

  let next: DecisionContract = { ...contract, outcome_note: cleanNote(intent.note) ?? contract.outcome_note };
  let graded = 0;
  for (const predicate of Array.isArray(contract.predicates) ? contract.predicates : []) {
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
  if (parts.length !== 3 || parts[0] !== 'stl') return null;
  const outcome = parseOutcome(parts[1]);
  if (!outcome || !parts[2]) return null;
  return { projectId: parts[2], outcome, source: 'callback' };
}

function parseCommand(text?: string): TelegramSettlementIntent | null {
  const match = text?.trim().match(/^\/settle(?:@\w+)?\s+(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (!match) return null;
  const outcome = parseOutcome(match[2]);
  if (!outcome) return null;
  return {
    projectId: match[1],
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

function parseOutcome(text: string): TelegramSettlementOutcome | null {
  const normalized = text.trim();
  for (const [pattern, outcome] of OUTCOME_ALIASES) {
    if (pattern.test(normalized)) return outcome;
  }
  return null;
}

function stripOutcome(text: string, outcome: TelegramSettlementOutcome): string | undefined {
  const stripped = text.trim().replace(new RegExp(`^${outcome}\\b[:：,\\-\\s]*`, 'i'), '').trim();
  return cleanNote(stripped);
}

function cleanNote(note?: string): string | undefined {
  const trimmed = note?.trim();
  return trimmed ? trimmed.slice(0, 1000) : undefined;
}
