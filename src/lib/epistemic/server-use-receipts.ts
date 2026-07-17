import type { InfluenceUseReceiptPort } from './domain/ports';
import type {
  InfluenceUseReceipt,
  InfluenceUseReservation,
  ReserveInfluenceUse,
} from './domain/use-receipts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function receipt(value: Record<string, unknown>): InfluenceUseReceipt {
  return {
    user_id: String(value.user_id),
    receipt_id: String(value.receipt_id),
    claim_id: String(value.claim_id),
    grant_id: String(value.grant_id),
    authority_epoch: Number(value.authority_epoch),
    grant_revision: Number(value.grant_revision),
    call_id: String(value.call_id),
    use_slot: String(value.use_slot),
    effect: value.effect as InfluenceUseReceipt['effect'],
    surface: value.surface as InfluenceUseReceipt['surface'],
    scope_hash: String(value.scope_hash),
    capsule_hash: String(value.capsule_hash),
    reserved_at: String(value.reserved_at),
    dispatch_state: value.dispatch_state as InfluenceUseReceipt['dispatch_state'],
  };
}

/** Server adapter; the RPC locks and re-folds current grant eligibility. */
export class ServerInfluenceUseReceiptGateway implements InfluenceUseReceiptPort {
  constructor(
    private readonly admin: AdminClient,
    private readonly userId: string,
  ) {}

  async reserve(input: ReserveInfluenceUse): Promise<InfluenceUseReservation> {
    if (input.user_id !== this.userId) return { status: 'conflict' };
    const { data, error } = await this.admin.rpc('reserve_epistemic_influence_use', {
      p_user_id: input.user_id,
      p_erasure_epoch: input.account_erasure_epoch,
      p_receipt_id: input.receipt_id,
      p_claim_id: input.claim_id,
      p_grant_id: input.grant_id,
      p_authority_epoch: input.authority_epoch,
      p_grant_revision: input.grant_revision,
      p_call_id: input.call_id,
      p_effect: input.effect,
      p_surface: input.surface,
      p_scope: input.scope,
      p_scope_hash: input.scope_hash,
      p_capsule_hash: input.capsule_hash,
      p_reserved_at: input.reserved_at,
    });
    if (error) {
      const message = String(error.message ?? '');
      if (message.includes('ASK_ONCE_ALREADY_USED')) {
        return {
          status: 'already_used',
          receipt: {
            ...input,
            use_slot: `once:${input.grant_id}:${input.authority_epoch}:${input.grant_revision}`,
            dispatch_state: 'reserved',
          },
        };
      }
      return { status: 'conflict' };
    }
    if (!isRecord(data)) return { status: 'conflict' };
    return {
      status: data.status === 'exact_retry' ? 'exact_retry' : 'reserved',
      receipt: receipt(data),
    };
  }

  async markDispatch(receiptId: string, state: 'dispatched' | 'provider_failed'): Promise<boolean> {
    const { data, error } = await this.admin.rpc('mark_epistemic_use_dispatch', {
      p_user_id: this.userId,
      p_receipt_id: receiptId,
      p_state: state,
    });
    return !error && data === true;
  }
}
