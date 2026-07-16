/**
 * Web K2 adapter: elevate the legacy DecisionContract `user_lean` into a
 * semantic-v4 initial-prediction candidate without changing either legacy data
 * or the v3 ledger.
 *
 * This module deliberately does not import a v4 event schema. K1 owns that
 * schema. The injected sink is the anti-corruption boundary that will resolve
 * the web project to a DecisionCase and translate this envelope into canonical
 * v4 events once K1 is available.
 */

export const USER_LEAN_V4_SHADOW_ENV = 'ARGUS_SEMANTIC_V4_SHADOW';

export interface LegacyUserLeanPredicate {
  readonly id: string;
  readonly text: string;
  readonly source: string;
  readonly authored?: 'user' | 'ai_surfaced';
}

export interface LegacyDecisionContractForElevation {
  readonly id: string;
  readonly project_id: string;
  readonly created_at: string;
  readonly predicates: readonly LegacyUserLeanPredicate[];
}

/**
 * A user lean is a prediction by default, not necessarily a committed choice.
 * Callers may request an initial JudgmentVersion only when they hold a receipt
 * for a separate, explicit user act that authorized this exact lean as a
 * judgment. The adapter never infers that act from wording.
 */
export interface ExplicitInitialJudgmentAuthorization {
  readonly explicitly_confirmed: true;
  readonly authorization_ref: string;
  readonly authorized_at: string;
}

export interface UserLeanElevationInput {
  readonly contract: LegacyDecisionContractForElevation;
  readonly judgment_authorization?: ExplicitInitialJudgmentAuthorization;
}

export interface InitialPredictionElevation {
  readonly role: 'prediction';
  readonly proposition: string;
  readonly status: 'recorded';
  readonly authored_by: 'user';
  readonly occurred_at: string;
  readonly authorship_basis: 'explicit_marker' | 'legacy_user_lean_contract';
}

export interface InitialJudgmentElevation {
  readonly statement: string;
  readonly version: 1;
  readonly authorized_by: 'user';
  readonly authorized_at: string;
  readonly authorization_ref: string;
}

/**
 * Transitional envelope, not a canonical v4 event. It contains stable source
 * identity and an idempotency key, but intentionally leaves canonical ids to
 * K1 so this parallel slice cannot accidentally establish a second schema.
 */
export interface UserLeanElevationEnvelope {
  readonly envelope_kind: 'web_user_lean_elevation';
  readonly envelope_version: 1;
  readonly operation: 'record_initial_prediction';
  readonly idempotency_key: string;
  readonly decision_case_ref: {
    readonly namespace: 'web_project';
    readonly external_id: string;
  };
  readonly source: {
    readonly contract_id: string;
    readonly predicate_id: string;
    readonly predicate_index: number;
  };
  readonly prediction: InitialPredictionElevation;
  readonly initial_judgment?: InitialJudgmentElevation;
}

export interface UserLeanShadowSink {
  write(candidate: UserLeanElevationEnvelope): Promise<void> | void;
}

export type UserLeanShadowResult =
  | { readonly status: 'disabled' }
  | { readonly status: 'skipped'; readonly reason: 'no_user_lean' | 'invalid_contract' | 'invalid_judgment_authorization' }
  | { readonly status: 'written'; readonly candidate: UserLeanElevationEnvelope }
  | { readonly status: 'failed'; readonly candidate: UserLeanElevationEnvelope; readonly error: unknown };

type PublicEnv = Readonly<Record<string, string | undefined>>;

/** Only the K1 contract's exact opt-in value enables the shadow path. */
export function isUserLeanV4ShadowEnabled(env: PublicEnv = process.env): boolean {
  return env[USER_LEAN_V4_SHADOW_ENV] === '1';
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Derive a candidate from the first valid legacy user lean. Predicate order is
 * significant: buildEarlyContract places the pre-AI lean first and merge keeps
 * it there. We never choose a later candidate as a "cleaner" replacement.
 */
export function deriveInitialUserLeanElevation(
  input: UserLeanElevationInput,
): UserLeanElevationEnvelope | null {
  const { contract } = input;
  if (
    !isNonEmpty(contract.id) ||
    !isNonEmpty(contract.project_id) ||
    !isValidTimestamp(contract.created_at) ||
    !Array.isArray(contract.predicates)
  ) {
    return null;
  }

  const predicateIndex = contract.predicates.findIndex((predicate) =>
    predicate.source === 'user_lean' &&
    predicate.authored !== 'ai_surfaced' &&
    isNonEmpty(predicate.id) &&
    isNonEmpty(predicate.text),
  );
  if (predicateIndex < 0) return null;

  const predicate = contract.predicates[predicateIndex];
  // The contract already owns the exact normalized text accepted from the user.
  // Copy it verbatim. In particular, do not trim/rewrite it in this adapter.
  const proposition = predicate.text;
  const candidate: UserLeanElevationEnvelope = {
    envelope_kind: 'web_user_lean_elevation',
    envelope_version: 1,
    operation: 'record_initial_prediction',
    idempotency_key: `web-user-lean:${contract.id}:${predicate.id}:initial-prediction`,
    decision_case_ref: {
      namespace: 'web_project',
      external_id: contract.project_id,
    },
    source: {
      contract_id: contract.id,
      predicate_id: predicate.id,
      predicate_index: predicateIndex,
    },
    prediction: {
      role: 'prediction',
      proposition,
      status: 'recorded',
      authored_by: 'user',
      occurred_at: contract.created_at,
      authorship_basis: predicate.authored === 'user'
        ? 'explicit_marker'
        : 'legacy_user_lean_contract',
    },
  };

  const authorization = input.judgment_authorization;
  if (authorization) {
    if (
      authorization.explicitly_confirmed !== true ||
      !isNonEmpty(authorization.authorization_ref) ||
      !isValidTimestamp(authorization.authorized_at)
    ) {
      return null;
    }
    return {
      ...candidate,
      initial_judgment: {
        statement: proposition,
        version: 1,
        authorized_by: 'user',
        authorized_at: authorization.authorized_at,
        authorization_ref: authorization.authorization_ref,
      },
    };
  }

  return candidate;
}

export interface ShadowWriteOptions {
  readonly sink: UserLeanShadowSink;
  /** Tests and server adapters should inject this. Production defaults to env. */
  readonly enabled?: boolean;
  readonly env?: PublicEnv;
}

/**
 * Best-effort shadow write. A v4 outage must never block or mutate the legacy
 * DecisionContract path. Callers may log `failed`, but must not turn it into a
 * user-visible seal failure.
 */
export async function shadowWriteInitialUserLean(
  input: UserLeanElevationInput,
  options: ShadowWriteOptions,
): Promise<UserLeanShadowResult> {
  const enabled = options.enabled ?? isUserLeanV4ShadowEnabled(options.env);
  if (!enabled) return { status: 'disabled' };

  const contract = input.contract;
  const contractLooksValid = isNonEmpty(contract.id) &&
    isNonEmpty(contract.project_id) &&
    isValidTimestamp(contract.created_at) &&
    Array.isArray(contract.predicates);
  if (!contractLooksValid) {
    return {
      status: 'skipped',
      reason: 'invalid_contract',
    };
  }

  // First prove the Prediction exists independently from any optional
  // JudgmentVersion authorization. A valid receipt cannot manufacture a lean.
  const predictionOnly = deriveInitialUserLeanElevation({ contract });
  if (!predictionOnly) return { status: 'skipped', reason: 'no_user_lean' };

  const candidate = input.judgment_authorization
    ? deriveInitialUserLeanElevation(input)
    : predictionOnly;
  if (!candidate) return { status: 'skipped', reason: 'invalid_judgment_authorization' };

  try {
    await options.sink.write(candidate);
    return { status: 'written', candidate };
  } catch (error) {
    return { status: 'failed', candidate, error };
  }
}
