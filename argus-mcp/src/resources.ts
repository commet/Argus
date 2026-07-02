import { resolveArgusDirForResource } from './lib/argus-dir.js';
import { resolveToday } from './lib/resolve-today.js';
import { replayLedger, bearingContracts } from './lib/ledger-replay.js';
import { readReceipt } from './lib/receipt.js';
import { safeSegment } from './lib/safe-path.js';
import { logDebug } from './lib/log.js';
import { duePremises, groupDuePremises, isMonitored, isDueForRecheck } from './lib/premises.js';

/**
 * MCP Resources (blueprint §4.3). Read-only context the host can auto-inject —
 * the ledger, the due contracts, a receipt, the current bearing. They are
 * resources (not read-tools) because they are app-injected context, and being
 * read-only is itself the proof that the reading surface cannot write a verdict.
 *
 * No per-call argument channel exists, so the dir is resolved from ARGUS_DIR.
 * When unbound, every resource degrades cleanly to an {unbound} payload rather
 * than throwing.
 */
const JSON_MIME = 'application/json';

export const STATIC_RESOURCES = [
  { uri: 'argus://ledger', name: 'Argus ledger', description: 'Full replayed state of all decisions (stats, contracts, integrity).', mimeType: JSON_MIME },
  { uri: 'argus://contracts/due', name: 'Due contracts', description: 'Decision contracts past their check-by date — the return-loop context.', mimeType: JSON_MIME },
  { uri: 'argus://bearing/current', name: 'Current bearing', description: 'Open (sealed, not yet settled) decisions.', mimeType: JSON_MIME },
  { uri: 'argus://premises/due', name: 'Premises due for a re-check', description: 'Monitored premises of sealed decisions whose facts should be re-checked against reality (grouped: the same fact under several decisions is one re-check) — the living-premises return-loop context.', mimeType: JSON_MIME },
] as const;

export const RESOURCE_TEMPLATES = [
  { uriTemplate: 'argus://receipts/{id}', name: 'Judgment Receipt', description: 'The receipt for one decision id.', mimeType: JSON_MIME },
  { uriTemplate: 'argus://premises/{id}', name: 'Decision premises', description: 'The tracked premises (facts + open questions) of one decision id, with provenance and staleness.', mimeType: JSON_MIME },
] as const;

function unbound(uri: string) {
  return { uri, mimeType: JSON_MIME, text: JSON.stringify({ unbound: true, hint: 'Set the ARGUS_DIR env var (or call argus_init with an absolute argus_dir) so resources can resolve a project.' }) };
}

export function listResources() {
  return { resources: STATIC_RESOURCES.map((r) => ({ ...r })) };
}

export function listResourceTemplates() {
  return { resourceTemplates: RESOURCE_TEMPLATES.map((r) => ({ ...r })) };
}

export function readResource(uri: string): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  const dir = resolveArgusDirForResource();
  if (!dir) {
    logDebug(`resource ${uri} requested while unbound`);
    return { contents: [unbound(uri)] };
  }
  const today = resolveToday({});
  const payload = computePayload(uri, dir, today);
  return { contents: [{ uri, mimeType: JSON_MIME, text: JSON.stringify(payload, null, 2) }] };
}

function computePayload(uri: string, dir: string, today: string): unknown {
  if (uri === 'argus://ledger') {
    const l = replayLedger(dir, today);
    return {
      today,
      stats: l.stats,
      integrity: l.integrity,
      contracts: [...l.contracts.values()].map((c) => ({ id: c.id, status: c.status, predicate: c.predicate, check_by: c.check_by, outcome: c.outcome })),
    };
  }

  if (uri === 'argus://contracts/due') {
    const l = replayLedger(dir, today);
    const seeds = bearingContracts(dir, today, l);
    const due = [
      ...l.overdue.map((c) => ({ id: c.id, predicate: c.text, check_by: c.date, source: 'ledger' })),
      ...seeds.filter((s) => !l.contracts.has(s.id)).map((s) => ({ id: s.id, predicate: s.predicate, check_by: s.check_by, source: 'bearing' })),
    ];
    return { today, due, due_count: due.length, next_action: due.length ? 'argus_settle' : null };
  }

  if (uri === 'argus://bearing/current') {
    const l = replayLedger(dir, today);
    const open = [...l.contracts.values()].filter((c) => c.status === 'sealed').map((c) => ({ id: c.id, predicate: c.predicate, check_by: c.check_by }));
    return { today, open };
  }

  if (uri === 'argus://premises/due') {
    const l = replayLedger(dir, today);
    const groups = groupDuePremises(duePremises(l));
    const TOP = 5; // power-user cap (plan v5 P5) — counts stay honest
    return {
      today,
      groups: groups.slice(0, TOP).map((g) => ({
        fact: g.text,
        decisions: g.premises.map((p) => ({ decision_id: p.decision_id, decision: p.decision_text, ref: `P${p.ordinal}`, staleness: p.days_stale === null ? 'never re-checked' : `${p.days_stale}d` })),
      })),
      group_count: groups.length,
      has_more: groups.length > TOP,
      next_action: groups.length ? 'argus_recheck' : null,
    };
  }

  const pm = uri.match(/^argus:\/\/premises\/(.+)$/);
  if (pm && pm[1] !== 'due') {
    let id: string;
    try { id = safeSegment(decodeURIComponent(pm[1]), 'id'); } catch { return { error: 'invalid_id' }; }
    const l = replayLedger(dir, today);
    const list = l.contracts.get(id)?.premises ?? [];
    return {
      id, today,
      premises: list.map((p) => ({
        ref: `P${p.ordinal}`, kind: p.kind, text: p.text, status: p.status,
        source: p.source, ...(p.ai_original && p.ai_original !== p.text ? { ai_original: p.ai_original } : {}),
        monitored: isMonitored(p), due_for_recheck: isDueForRecheck(p, today),
        last_checked: p.last_recheck?.ts?.slice(0, 10) ?? null,
        ...(p.resolved_decision ? { resolved_decision: p.resolved_decision } : {}),
      })),
    };
  }

  const m = uri.match(/^argus:\/\/receipts\/(.+)$/);
  if (m) {
    let id: string;
    try { id = safeSegment(decodeURIComponent(m[1]), 'id'); } catch { return { error: 'invalid_id' }; }
    const r = readReceipt(dir, id);
    return r ?? { error: 'not_found', id };
  }

  return { error: 'unknown_resource', uri };
}
