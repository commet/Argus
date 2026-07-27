/**
 * Decision-kind derivation shared by MCP and the web façade.
 *
 * This is deliberately a small, deterministic helper. It never claims to know
 * the user's inner state: it names the speech act suggested by the wording and
 * capture path, then the sealing surface lets the user correct it.
 */
import type { DecisionKind } from './types.js';

export const DECISION_KINDS = [
  'prediction',
  'commitment',
  'declaration',
  'witness',
] as const satisfies readonly DecisionKind[];

export type DecisionKindRule =
  | 'explicit_kind'
  | 'record_only_path'
  | 'commitment_wording'
  | 'declaration_wording'
  | 'prediction_wording'
  | 'return_handle'
  | 'legacy_default';

export interface DeriveDecisionKindInput {
  statement: string;
  explicit_kind?: DecisionKind;
  record_only?: boolean;
  has_return_handle?: boolean;
}

export interface DerivedDecisionKind {
  kind: DecisionKind;
  rule: DecisionKindRule;
}

const COMMITMENT_PATTERNS = [
  /\b(i\s+(?:will|commit|promise|am going to)|we\s+will)\b/i,
  /(?:하겠습니다|할게요|하기로\s*(?:했다|한다|합니다)|약속(?:한다|할게|하겠다)|(?:수락|거절|진행|실행|선택|중단|유지)합니다|(?:수락|거절|진행|실행|선택)하겠다|지키겠다|하지\s*않겠다)/u,
];

const DECLARATION_PATTERNS = [
  /\b(i\s+(?:value|prioriti[sz]e)|my\s+(?:rule|principle|standard)|we\s+(?:value|prioriti[sz]e))\b/i,
  /(?:우선(?:한다|하겠다)|중요하게\s*(?:본다|여긴다)|원칙(?:이다|으로)|기준(?:이다|으로)|가치(?:로|는))/u,
];

const PREDICTION_PATTERNS = [
  /\b(if|when|unless|expect|predict|likely|should|by\s+\w+)\b/i,
  /(?:하면|한다면|(?:을|ㄹ)\s*것|일\s*것|예상|전망|가능성|때까지|이내|이상|이하|확인하면|나오면)/u,
];

export function deriveDecisionKind(input: DeriveDecisionKindInput): DerivedDecisionKind {
  if (input.explicit_kind) return { kind: input.explicit_kind, rule: 'explicit_kind' };
  if (input.record_only) return { kind: 'witness', rule: 'record_only_path' };

  const statement = String(input.statement ?? '').trim();
  if (COMMITMENT_PATTERNS.some((pattern) => pattern.test(statement))) {
    return { kind: 'commitment', rule: 'commitment_wording' };
  }
  if (DECLARATION_PATTERNS.some((pattern) => pattern.test(statement))) {
    return { kind: 'declaration', rule: 'declaration_wording' };
  }
  if (PREDICTION_PATTERNS.some((pattern) => pattern.test(statement))) {
    return { kind: 'prediction', rule: 'prediction_wording' };
  }
  if (input.has_return_handle) return { kind: 'prediction', rule: 'return_handle' };
  return { kind: 'prediction', rule: 'legacy_default' };
}
