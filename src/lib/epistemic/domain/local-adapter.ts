import { authorityChecksum } from './checksum';
import type {
  AuthorityCommand,
  AuthorityCommandReceipt,
  AuthorityCommandRejection,
} from './commands';
import { AuthorityDecisionError, decideAuthorityCommand } from './decide';
import type { AuthorityEvent } from './events';
import type { EpistemicAuthorityGateway } from './ports';
import { foldAuthorityEvents } from './reducer';
import type { AccountContinuityPolicy, ClaimAuthorityState } from './types';

export interface LocalSafetyTombstone {
  claim_id: string;
  grant_id?: string;
  command_id: string;
  reason: 'contest' | 'revoke' | 'forget';
  created_at: string;
  canonical_status: 'pending' | 'acknowledged';
}

interface StoredCommandReceipt {
  semantic_fingerprint: string;
  receipt: AuthorityCommandReceipt;
}

export interface LocalAuthorityAdapterOptions {
  user_id: string;
  account_id?: string;
  erasure_epoch?: number;
  allowed_origins?: readonly string[];
  blocked_origins?: readonly string[];
  clock?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const COMMAND_TYPES = new Set([
  'ProposeClaim',
  'ReviewClaim',
  'RewordClaim',
  'ContestClaim',
  'AddCounterexample',
  'GrantInfluence',
  'RevokeInfluence',
  'RearmAskOnce',
  'ForgetClaim',
]);

function commandShape(value: unknown): value is AuthorityCommand {
  if (!isRecord(value) || !COMMAND_TYPES.has(String(value.type))) return false;
  return value.schema_version === 1
    && typeof value.command_id === 'string'
    && typeof value.idempotency_key === 'string'
    && typeof value.semantic_fingerprint === 'string'
    && typeof value.user_id === 'string'
    && typeof value.claim_id === 'string'
    && Number.isInteger(value.expected_aggregate_version)
    && Number.isInteger(value.expected_authority_epoch)
    && Number.isInteger(value.account_erasure_epoch)
    && ['user', 'system', 'migration', 'imported_unverified'].includes(String(value.actor_type))
    && typeof value.origin_id === 'string'
    && typeof value.occurred_at === 'string';
}

function blankReceipt(value: unknown, rejection: AuthorityCommandRejection): AuthorityCommandReceipt {
  const record = isRecord(value) ? value : {};
  return {
    command_id: typeof record.command_id === 'string' ? record.command_id : 'invalid-command',
    claim_id: typeof record.claim_id === 'string' ? record.claim_id : 'unknown-claim',
    status: 'rejected',
    event_ids: [],
    aggregate_version: 0,
    authority_epoch: 0,
    rejection,
    current_state_checksum: authorityChecksum(null),
  };
}

export class LocalAuthorityAdapter implements EpistemicAuthorityGateway {
  private readonly events = new Map<string, AuthorityEvent[]>();
  private readonly receipts = new Map<string, StoredCommandReceipt>();
  private readonly tombstones = new Map<string, LocalSafetyTombstone>();
  private readonly clock: () => string;
  private policy: AccountContinuityPolicy;

  constructor(private readonly options: LocalAuthorityAdapterOptions) {
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.policy = {
      account_id: options.account_id ?? options.user_id,
      erasure_epoch: options.erasure_epoch ?? 0,
      retention_policy: 'local_default',
      sync_origins: [...(options.allowed_origins ?? [])],
      blocked_origins: [...(options.blocked_origins ?? [])],
    };
  }

  private state(claimId: string): ClaimAuthorityState {
    return foldAuthorityEvents(claimId, this.events.get(claimId) ?? []);
  }

  private reject(command: AuthorityCommand, rejection: AuthorityCommandRejection): AuthorityCommandReceipt {
    const state = this.state(command.claim_id);
    return {
      command_id: command.command_id,
      claim_id: command.claim_id,
      status: 'rejected',
      event_ids: [],
      aggregate_version: state.aggregate_version,
      authority_epoch: state.authority_epoch,
      rejection,
      current_state_checksum: authorityChecksum(state),
    };
  }

  private recordLocalSafety(command: AuthorityCommand): void {
    let reason: LocalSafetyTombstone['reason'] | undefined;
    let grantId: string | undefined;
    if (command.type === 'ContestClaim') reason = 'contest';
    if (command.type === 'ForgetClaim') reason = 'forget';
    if (command.type === 'RevokeInfluence') {
      reason = 'revoke';
      grantId = command.grant_id;
    }
    if (!reason) return;
    const key = grantId ? `grant:${grantId}` : `claim:${command.claim_id}`;
    this.tombstones.set(key, {
      claim_id: command.claim_id,
      grant_id: grantId,
      command_id: command.command_id,
      reason,
      created_at: this.clock(),
      canonical_status: 'pending',
    });
  }

  execute(value: unknown): AuthorityCommandReceipt {
    if (!commandShape(value)) return blankReceipt(value, 'invalid_command');
    const command = value;

    if (command.user_id !== this.options.user_id) return this.reject(command, 'wrong_owner');
    if (this.policy.blocked_origins.includes(command.origin_id)
      || (this.policy.sync_origins.length > 0 && !this.policy.sync_origins.includes(command.origin_id))) {
      return this.reject(command, 'blocked_origin');
    }
    if (command.account_erasure_epoch !== this.policy.erasure_epoch) {
      return this.reject(command, 'stale_erasure_epoch');
    }

    // Safety intent is effective on this authenticated local origin before
    // canonical append. A stale/offline rejection must not revive influence.
    this.recordLocalSafety(command);

    const receiptKey = `${command.origin_id}:${command.idempotency_key}`;
    const prior = this.receipts.get(receiptKey);
    if (prior) {
      if (prior.semantic_fingerprint !== command.semantic_fingerprint) {
        return this.reject(command, 'idempotency_conflict');
      }
      return { ...prior.receipt, status: 'exact_retry' };
    }

    const state = this.state(command.claim_id);
    if (command.expected_aggregate_version !== state.aggregate_version) {
      return this.reject(command, 'stale_aggregate_version');
    }
    if (command.expected_authority_epoch !== state.authority_epoch) {
      return this.reject(command, 'stale_authority_epoch');
    }
    if (state.lifecycle === 'forgotten') return this.reject(command, 'claim_forgotten');

    let batch: AuthorityEvent[];
    try {
      batch = decideAuthorityCommand({
        state,
        command,
        recorded_at: this.clock(),
        origin_sequence_start: state.aggregate_version + 1,
      });
      // Fold the complete prospective stream before mutating local canonical
      // storage. This models all-or-nothing append for the reference adapter.
      foldAuthorityEvents(command.claim_id, [...(this.events.get(command.claim_id) ?? []), ...batch]);
    } catch (error) {
      return this.reject(
        command,
        error instanceof AuthorityDecisionError ? 'illegal_transition' : 'invalid_command',
      );
    }

    const nextEvents = [...(this.events.get(command.claim_id) ?? []), ...batch];
    this.events.set(command.claim_id, nextEvents);
    const nextState = foldAuthorityEvents(command.claim_id, nextEvents);
    const receipt: AuthorityCommandReceipt = {
      command_id: command.command_id,
      claim_id: command.claim_id,
      status: 'applied',
      event_ids: batch.map((event) => event.event_id),
      aggregate_version: nextState.aggregate_version,
      authority_epoch: nextState.authority_epoch,
      current_state_checksum: authorityChecksum(nextState),
    };
    this.receipts.set(receiptKey, {
      semantic_fingerprint: command.semantic_fingerprint,
      receipt,
    });
    for (const tombstone of this.tombstones.values()) {
      if (tombstone.command_id === command.command_id) tombstone.canonical_status = 'acknowledged';
    }
    return { ...receipt };
  }

  readEvents(claimId: string): readonly AuthorityEvent[] {
    return [...(this.events.get(claimId) ?? [])];
  }

  readState(claimId: string): ClaimAuthorityState {
    return this.state(claimId);
  }

  readPolicy(): AccountContinuityPolicy {
    return { ...this.policy, sync_origins: [...this.policy.sync_origins], blocked_origins: [...this.policy.blocked_origins] };
  }

  advanceErasureEpoch(nextEpoch: number): void {
    if (!Number.isInteger(nextEpoch) || nextEpoch <= this.policy.erasure_epoch) {
      throw new Error('erasure epoch must increase monotonically');
    }
    this.policy = { ...this.policy, erasure_epoch: nextEpoch };
  }

  blockOrigin(originId: string): void {
    if (!this.policy.blocked_origins.includes(originId)) {
      this.policy = { ...this.policy, blocked_origins: [...this.policy.blocked_origins, originId] };
    }
  }

  isLocallyBlocked(claimId: string, grantId?: string): boolean {
    return this.tombstones.has(`claim:${claimId}`)
      || (!!grantId && this.tombstones.has(`grant:${grantId}`));
  }

  listSafetyTombstones(): LocalSafetyTombstone[] {
    return [...this.tombstones.values()].map((value) => ({ ...value }));
  }
}
