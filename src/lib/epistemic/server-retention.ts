// Supabase remains isolated at this server-only boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export interface ContextRetentionReceipt {
  ok: boolean;
  traces_removed: number;
  artifacts_removed: number;
  objects_removed: string[];
  error_code?: string;
}

/** Purges rows whose already-recorded policy deadline has passed. The function
 * does not choose a TTL: policy must have written expires_at at capture time. */
export async function purgeExpiredServerContext(
  admin: AdminClient,
  userId: string,
  now: string,
): Promise<ContextRetentionReceipt> {
  if (!Number.isFinite(Date.parse(now))) {
    return { ok: false, traces_removed: 0, artifacts_removed: 0, objects_removed: [], error_code: 'RETENTION_NOW_INVALID' };
  }
  const { data, error } = await admin.from('epistemic_context_traces')
    .select('trace_id,capsule_artifact_id').eq('user_id', userId).lte('expires_at', now);
  if (error) {
    return { ok: false, traces_removed: 0, artifacts_removed: 0, objects_removed: [], error_code: 'RETENTION_READ_FAILED' };
  }
  const artifactIds = [...new Set((data ?? []).flatMap((row: { capsule_artifact_id?: unknown }) =>
    typeof row.capsule_artifact_id === 'string' ? [row.capsule_artifact_id] : []))];
  let descriptors: Array<{ artifact_id: string; object_locator?: string; staging_locator?: string }> = [];
  if (artifactIds.length) {
    const descriptorRead = await admin.from('epistemic_artifact_descriptors')
      .select('artifact_id,object_locator,staging_locator').eq('user_id', userId).in('artifact_id', artifactIds);
    if (descriptorRead.error) {
      return { ok: false, traces_removed: 0, artifacts_removed: 0, objects_removed: [], error_code: 'RETENTION_DESCRIPTOR_READ_FAILED' };
    }
    descriptors = descriptorRead.data ?? [];
  }
  const locators = [...new Set(descriptors.flatMap((descriptor) => [descriptor.object_locator, descriptor.staging_locator]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)))];
  if (locators.some((locator) => !locator.startsWith(`${userId}/`))) {
    return { ok: false, traces_removed: 0, artifacts_removed: 0, objects_removed: [], error_code: 'RETENTION_ARTIFACT_LOCATOR_INVALID' };
  }
  const removed: string[] = [];
  for (let index = 0; index < locators.length; index += 100) {
    const chunk = locators.slice(index, index + 100);
    const deleted = await admin.storage.from('epistemic-artifacts').remove(chunk);
    if (deleted.error) {
      return { ok: false, traces_removed: 0, artifacts_removed: 0, objects_removed: removed, error_code: 'RETENTION_OBJECT_DELETE_FAILED' };
    }
    removed.push(...chunk);
  }
  const result = await admin.rpc('purge_expired_epistemic_context', { p_user_id: userId, p_now: now });
  if (result.error) {
    return { ok: false, traces_removed: 0, artifacts_removed: 0, objects_removed: removed, error_code: 'RETENTION_DATABASE_FAILED' };
  }
  return {
    ok: true,
    traces_removed: Number(result.data?.traces_removed ?? 0),
    artifacts_removed: Number(result.data?.artifacts_removed ?? 0),
    objects_removed: removed,
  };
}
