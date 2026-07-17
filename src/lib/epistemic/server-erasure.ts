import { createHash } from 'node:crypto';

// Supabase remains isolated at this server-only boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export interface ServerForgetReceipt {
  ok: boolean;
  receipt?: Record<string, unknown>;
  objects_removed: string[];
  error_code?: string;
}

const hashConfirmation = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** Object-first selective forget. Database deletion is one locked RPC; object
 * failure leaves every row and identity intact so retry coordinates survive. */
export async function forgetServerClaim(args: {
  admin: AdminClient;
  user_id: string;
  claim_id: string;
  expected_authority_epoch: number;
  expected_account_erasure_epoch: number;
  confirmation: string;
  receipt_id: string;
}): Promise<ServerForgetReceipt> {
  if (args.confirmation !== args.claim_id) {
    return { ok: false, objects_removed: [], error_code: 'FORGET_CONFIRMATION_MISMATCH' };
  }
  const [eventRead, traceRead, descriptorRead] = await Promise.all([
    args.admin.from('epistemic_authority_events')
      .select('event_id,payload_ref').eq('user_id', args.user_id).eq('aggregate_id', args.claim_id),
    args.admin.from('epistemic_context_traces')
      .select('capsule_artifact_id,trace').eq('user_id', args.user_id),
    args.admin.from('epistemic_artifact_descriptors')
      .select('artifact_id,source_event_ref,object_locator,staging_locator').eq('user_id', args.user_id),
  ]);
  if (eventRead.error || traceRead.error || descriptorRead.error) {
    return { ok: false, objects_removed: [], error_code: 'FORGET_PREFLIGHT_READ_FAILED' };
  }
  const eventIds = new Set((eventRead.data ?? []).map((row: { event_id: string }) => row.event_id));
  const payloadIds = new Set((eventRead.data ?? []).flatMap((row: { payload_ref?: unknown }) =>
    typeof row.payload_ref === 'string' ? [row.payload_ref] : []));
  const capsuleIds = new Set((traceRead.data ?? []).flatMap((row: { capsule_artifact_id?: unknown; trace?: unknown }) => {
    const trace = row.trace as { candidates?: Array<{ claim_id?: unknown }> } | undefined;
    const related = trace?.candidates?.some((candidate) => candidate.claim_id === args.claim_id);
    return related && typeof row.capsule_artifact_id === 'string' ? [row.capsule_artifact_id] : [];
  }));
  let invalidRelatedLocator = false;
  const locators: string[] = [...new Set<string>((descriptorRead.data ?? []).flatMap((row: {
    artifact_id?: unknown; source_event_ref?: unknown; object_locator?: unknown; staging_locator?: unknown;
  }) => {
    const related = (typeof row.artifact_id === 'string' && (payloadIds.has(row.artifact_id) || capsuleIds.has(row.artifact_id)))
      || (typeof row.source_event_ref === 'string' && eventIds.has(row.source_event_ref));
    if (!related) return [];
    const present = [row.object_locator, row.staging_locator]
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    if (present.some((value) => !value.startsWith(`${args.user_id}/`))) invalidRelatedLocator = true;
    return present.filter((value) => value.startsWith(`${args.user_id}/`));
  }))];
  if (invalidRelatedLocator) {
    return { ok: false, objects_removed: [], error_code: 'FORGET_ARTIFACT_LOCATOR_INVALID' };
  }
  const removed: string[] = [];
  for (let index = 0; index < locators.length; index += 100) {
    const chunk = locators.slice(index, index + 100);
    const { error } = await args.admin.storage.from('epistemic-artifacts').remove(chunk);
    if (error) return { ok: false, objects_removed: removed, error_code: 'FORGET_OBJECT_DELETE_FAILED' };
    removed.push(...chunk);
  }
  const { data, error } = await args.admin.rpc('forget_epistemic_claim', {
    p_user_id: args.user_id,
    p_claim_id: args.claim_id,
    p_expected_authority_epoch: args.expected_authority_epoch,
    p_expected_erasure_epoch: args.expected_account_erasure_epoch,
    p_receipt_id: args.receipt_id,
    p_confirmation_fingerprint: hashConfirmation(args.confirmation),
  });
  if (error) return { ok: false, objects_removed: removed, error_code: 'FORGET_DATABASE_FAILED' };
  return { ok: true, objects_removed: removed, receipt: data as Record<string, unknown> };
}
