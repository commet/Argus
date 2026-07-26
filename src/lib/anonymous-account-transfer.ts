'use client';

import { getSessionWithTimeout, isRealUser } from './supabase';

export interface AnonymousTransferResult {
  ok: boolean;
  needed: boolean;
  transferred?: boolean;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 8_000;
let prepareInFlight: Promise<AnonymousTransferResult> | null = null;
let claimInFlight: Promise<AnonymousTransferResult> | null = null;

async function timedFetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal, credentials: 'same-origin' });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Before an auth method replaces the anonymous Supabase session, exchange its
 * bearer token for a one-time HttpOnly transfer ticket. Authentication must not
 * continue when this fails: doing so would strand the server-backed voyage
 * under the old anonymous user id.
 */
export function prepareAnonymousAccountTransfer(): Promise<AnonymousTransferResult> {
  if (prepareInFlight) return prepareInFlight;
  prepareInFlight = (async () => {
    const session = await getSessionWithTimeout();
    if (!session?.user?.is_anonymous) return { ok: true, needed: false };

    try {
      const response = await timedFetch('/api/account/anonymous-transfer/prepare', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) return { ok: false, needed: true, error: 'TRANSFER_PREPARE_FAILED' };
      return { ok: true, needed: true };
    } catch {
      return { ok: false, needed: true, error: 'TRANSFER_PREPARE_FAILED' };
    }
  })().finally(() => {
    prepareInFlight = null;
  });
  return prepareInFlight;
}

/**
 * Claim a prepared anonymous voyage after permanent authentication. The server
 * consumes the ticket only after its database transaction commits, so a network
 * or database failure remains safely retryable.
 */
export function claimAnonymousAccountTransfer(): Promise<AnonymousTransferResult> {
  if (claimInFlight) return claimInFlight;
  claimInFlight = (async () => {
    const session = await getSessionWithTimeout();
    if (!session || !isRealUser(session.user)) return { ok: true, needed: false };

    try {
      const response = await timedFetch('/api/account/anonymous-transfer/claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.status === 204) return { ok: true, needed: false };
      if (!response.ok) return { ok: false, needed: true, error: 'TRANSFER_CLAIM_FAILED' };
      const body = await response.json() as { transferred?: boolean };
      return { ok: true, needed: true, transferred: body.transferred !== false };
    } catch {
      return { ok: false, needed: true, error: 'TRANSFER_CLAIM_FAILED' };
    }
  })().finally(() => {
    claimInFlight = null;
  });
  return claimInFlight;
}
