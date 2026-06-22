/**
 * Pure parsers for the Argus plugin's local files — NO IO, NO supabase import,
 * so they are trivially unit-testable. The importer (lib/plugin-import.ts) adds
 * the Supabase IO on top of these.
 *
 *  - parseLedger: folds .argus/ledger/ledger.jsonl (harvest→seal→amend→settle/
 *    dismiss) into one decision per id. Direct port of loadLedger in
 *    tools/argus-watch/lib/ledger.mjs — keep in sync if that fold changes.
 *  - parseBearing: a current_bearing.json object → bearing row.
 *  - classify: decide whether a file is a ledger, a bearing, or neither.
 */
import type { PluginDecision, PluginBearing, PluginAmendment } from '@/stores/types';

export type FoldedDecision = Omit<PluginDecision, 'id' | 'source' | 'created_at' | 'updated_at' | 'imported_at'>;
export type FoldedBearing = Omit<PluginBearing, 'id' | 'source' | 'created_at' | 'updated_at' | 'imported_at'>;

/** Replay ledger.jsonl text → folded decisions (one per ledger id). */
export function parseLedger(text: string): FoldedDecision[] {
  const map = new Map<string, FoldedDecision>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let e: Record<string, unknown>;
    try { e = JSON.parse(trimmed); } catch { continue; }
    const id = e.id as string | undefined;
    if (!id) continue;
    const cur = map.get(id);
    switch (e.event) {
      case 'harvest':
        if (!cur) map.set(id, {
          ledger_id: id,
          status: 'candidate',
          harvested_at: e.at as string,
          project: e.project as string,
          session: e.session as string,
          decided_at: e.decided_at as string,
          quote: e.quote as string,
          decision: e.decision as string,
          type: e.type as string,
          stakes: e.stakes as string,
          history: [],
        });
        break;
      case 'seal':
        if (cur) {
          cur.status = 'sealed';
          cur.sealed_at = e.at as string;
          cur.predicate = e.predicate as string;
          cur.falsified_if = e.falsified_if as string;
          cur.check_by = e.check_by as string;
        }
        break;
      case 'amend':
        if (cur) {
          const amend: PluginAmendment = {
            predicate: cur.predicate,
            falsified_if: cur.falsified_if,
            check_by: cur.check_by,
            amended_at: e.at as string,
          };
          cur.history = [...(cur.history ?? []), amend];
          cur.predicate = (e.predicate as string) ?? cur.predicate;
          cur.falsified_if = (e.falsified_if as string) ?? cur.falsified_if;
          cur.check_by = (e.check_by as string) ?? cur.check_by;
        }
        break;
      case 'dismiss':
        if (cur) {
          cur.status = 'dismissed';
          cur.dismissed_at = e.at as string;
          cur.dismiss_reason = e.reason as string;
        }
        break;
      case 'settle':
        if (cur) {
          cur.status = 'settled';
          cur.outcome = e.outcome as PluginDecision['outcome'];
          cur.settled_at = e.at as string;
          cur.settle_note = e.note as string;
        }
        break;
    }
  }
  return [...map.values()];
}

/** A current_bearing.json object → bearing row (best-effort; tolerant of shape). */
export function parseBearing(obj: Record<string, unknown>): FoldedBearing | null {
  if (!obj || typeof obj !== 'object') return null;
  if (!('current_course' in obj) && !('contract_seed' in obj) && !('next_helm' in obj)) return null;
  return {
    session: (obj.session as string) ?? undefined,
    version_label: (obj.version_label as string) ?? (obj.label as string) ?? undefined,
    label: (obj.label as string) ?? undefined,
    current_course: (obj.current_course as FoldedBearing['current_course']) ?? null,
    why_this_course: (obj.why_this_course as FoldedBearing['why_this_course']) ?? [],
    fog_or_reef: (obj.fog_or_reef as FoldedBearing['fog_or_reef']) ?? null,
    road_not_taken: (obj.road_not_taken as FoldedBearing['road_not_taken']) ?? [],
    next_helm: (obj.next_helm as string) ?? undefined,
    contract_seed: (obj.contract_seed as FoldedBearing['contract_seed']) ?? null,
    blocked: (obj.blocked as boolean) ?? undefined,
    generated_at: (obj.generated_at as string) ?? undefined,
    raw: obj,
  };
}

/** Classify a file by content: a JSONL ledger, a single/array bearing, or unknown. */
export function classify(content: string): 'ledger' | 'bearing' | 'unknown' {
  const trimmed = content.trim();
  if (!trimmed) return 'unknown';
  if (/^\s*\{[^\n]*"event"\s*:/m.test(trimmed)) return 'ledger';
  try {
    const obj = JSON.parse(trimmed);
    const probe = Array.isArray(obj) ? obj[0] : obj;
    if (probe && typeof probe === 'object' &&
        ('current_course' in probe || 'contract_seed' in probe || 'next_helm' in probe)) {
      return 'bearing';
    }
  } catch { /* not a single JSON object */ }
  return 'unknown';
}
