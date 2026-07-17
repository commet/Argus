import type { InfluenceEffect, InfluenceSurface } from './types';

export type InfluenceDispatchState = 'reserved' | 'dispatched' | 'provider_failed';

export interface InfluenceUseReceipt {
  user_id: string;
  receipt_id: string;
  claim_id: string;
  grant_id: string;
  authority_epoch: number;
  grant_revision: number;
  call_id: string;
  use_slot: string;
  effect: InfluenceEffect;
  surface: InfluenceSurface;
  scope_hash: string;
  capsule_hash: string;
  reserved_at: string;
  dispatch_state: InfluenceDispatchState;
}

export interface ReserveInfluenceUse {
  user_id: string;
  receipt_id: string;
  claim_id: string;
  grant_id: string;
  authority_epoch: number;
  grant_revision: number;
  call_id: string;
  effect: InfluenceEffect;
  surface: InfluenceSurface;
  scope_hash: string;
  capsule_hash: string;
  reserved_at: string;
}

export type InfluenceUseReservation =
  | { status: 'reserved'; receipt: InfluenceUseReceipt }
  | { status: 'exact_retry'; receipt: InfluenceUseReceipt }
  | { status: 'already_used'; receipt: InfluenceUseReceipt }
  | { status: 'conflict'; receipt?: InfluenceUseReceipt };

function computeUseSlot(input: ReserveInfluenceUse): string {
  return input.effect === 'ask_once'
    ? `once:${input.grant_id}:${input.authority_epoch}:${input.grant_revision}`
    : `call:${input.call_id}:${input.grant_id}`;
}

function sameReservation(receipt: InfluenceUseReceipt, input: ReserveInfluenceUse): boolean {
  return receipt.user_id === input.user_id
    && receipt.claim_id === input.claim_id
    && receipt.grant_id === input.grant_id
    && receipt.authority_epoch === input.authority_epoch
    && receipt.grant_revision === input.grant_revision
    && receipt.call_id === input.call_id
    && receipt.effect === input.effect
    && receipt.surface === input.surface
    && receipt.scope_hash === input.scope_hash
    && receipt.capsule_hash === input.capsule_hash;
}

/** In-memory reference adapter used by local and fault tests. */
export class LocalInfluenceUseReceiptStore {
  private readonly receiptsById = new Map<string, InfluenceUseReceipt>();
  private readonly receiptsBySlot = new Map<string, InfluenceUseReceipt>();

  reserve(input: ReserveInfluenceUse): InfluenceUseReservation {
    const existingById = this.receiptsById.get(input.receipt_id);
    if (existingById) {
      return sameReservation(existingById, input)
        ? { status: 'exact_retry', receipt: { ...existingById } }
        : { status: 'conflict', receipt: { ...existingById } };
    }
    const slot = computeUseSlot(input);
    const existingBySlot = this.receiptsBySlot.get(`${input.user_id}:${slot}`);
    if (existingBySlot) {
      if (sameReservation(existingBySlot, input)) {
        return { status: 'exact_retry', receipt: { ...existingBySlot } };
      }
      return input.effect === 'ask_once'
        ? { status: 'already_used', receipt: { ...existingBySlot } }
        : { status: 'conflict', receipt: { ...existingBySlot } };
    }
    const receipt: InfluenceUseReceipt = {
      ...input,
      use_slot: slot,
      dispatch_state: 'reserved',
    };
    this.receiptsById.set(receipt.receipt_id, receipt);
    this.receiptsBySlot.set(`${receipt.user_id}:${slot}`, receipt);
    return { status: 'reserved', receipt: { ...receipt } };
  }

  markDispatch(receiptId: string, state: Exclude<InfluenceDispatchState, 'reserved'>): boolean {
    const receipt = this.receiptsById.get(receiptId);
    if (!receipt) return false;
    receipt.dispatch_state = state;
    return true;
  }

  list(): InfluenceUseReceipt[] {
    return [...this.receiptsById.values()].map((receipt) => ({ ...receipt }));
  }
}
