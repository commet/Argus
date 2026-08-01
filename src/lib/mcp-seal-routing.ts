import type { JudgmentReceipt } from '@/lib/review';

/** Sanitize opt-in premises to the PremiseState shape premise-watch consumes. */
export function sanitizeTrackedPremises(raw: unknown): JudgmentReceipt['tracked_premises'] {
  if (!Array.isArray(raw)) return undefined;
  const output = raw.slice(0, 7).flatMap((premise) => {
    if (!premise || typeof premise !== 'object') return [];
    const record = premise as Record<string, unknown>;
    if (typeof record.text !== 'string' || !record.text.trim()) return [];
    return [{
      premise_id: typeof record.premise_id === 'string' ? record.premise_id.slice(0, 64) : `p_${Math.random().toString(36).slice(2, 10)}`,
      ordinal: typeof record.ordinal === 'number' ? record.ordinal : 0,
      kind: 'premise' as const,
      text: record.text.slice(0, 400),
      external: record.external === true,
      load_bearing: record.load_bearing === true,
      source: record.source === 'user_stated' ? ('user_stated' as const) : ('ai_surfaced' as const),
      ...(typeof record.ai_original === 'string' ? { ai_original: record.ai_original.slice(0, 400) } : {}),
      ...(typeof record.recheck_cadence_days === 'number' ? { recheck_cadence_days: record.recheck_cadence_days } : {}),
      status: 'active' as const,
      amend_history: [],
      recheck_count: 0,
      auto_watch: true,
    }];
  });
  return output.length > 0 ? (output as JudgmentReceipt['tracked_premises']) : undefined;
}
