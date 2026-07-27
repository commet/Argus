import { resolveArgusDirForResource } from './lib/argus-dir.js';
import { resolveToday } from './lib/resolve-today.js';
import { replayLedger, bearingContracts } from './lib/ledger-replay.js';
import { readReceipt } from './lib/receipt.js';
import { safeSegment } from './lib/safe-path.js';
import { logDebug } from './lib/log.js';
import { duePremises, groupDuePremises, isMonitored, isDueForRecheck } from './lib/premises.js';
import { sanitizeOutput } from './lib/untrusted.js';
import { appsResourceListEntry, readAppsResource } from './lib/apps-ui.js';

/**
 * MCP Resources (blueprint §4.3). Read-only context the host can auto-inject —
 * the ledger, the due contracts, a receipt, the current bearing. They are
 * resources (not read-tools) because they are app-injected context, and being
 * read-only is itself the proof that the reading surface cannot write a verdict.
 *
 * No per-call argument channel exists, so the dir resolves like a tool call
 * without an arg: ARGUS_DIR env, else the zero-config ~/.argus default —
 * tools and resources must see the same ledger (§9.7 O1 방2). Unbound now
 * means exactly one thing — ARGUS_DIR is set but invalid — and every resource
 * degrades cleanly to an {unbound} payload rather than throwing.
 */
const JSON_MIME = 'application/json';

export const STATIC_RESOURCES = [
  { uri: 'argus://ledger', name: 'Argus 판단 기록 · Decision record', description: '모든 결정의 현재 상태와 이력 · Current state and history of all decisions (stats, contracts, integrity).', mimeType: JSON_MIME },
  { uri: 'argus://contracts/due', name: '결과를 확인할 예측 · Predictions due', description: '확인일이 지난 예측 · Saved predictions past their check date.', mimeType: JSON_MIME },
  { uri: 'argus://bearing/current', name: '결과를 기다리는 예측 · Predictions awaiting results', description: '저장됐고 아직 실제 결과가 기록되지 않은 예측 · Saved predictions with no recorded result yet.', mimeType: JSON_MIME },
  { uri: 'argus://premises/due', name: '재확인할 전제 · Premises due', description: '현실과 다시 확인할 때가 된 추적 전제 · Monitored premises due for a reality re-check.', mimeType: JSON_MIME },
] as const;

/** One purpose-led resource for new clients. The legacy URIs below remain
 * readable for cached hosts, but are no longer advertised as separate parts. */
export const PUBLIC_RESOURCES = [
  {
    uri: 'argus://attention',
    name: '지금 확인할 것 · Attention now',
    description: '확인일이 지났거나 전제가 달라졌는지 확인할 기록 · Decisions and facts that need attention now.',
    mimeType: JSON_MIME,
  },
] as const;

export const RESOURCE_TEMPLATES = [
  { uriTemplate: 'argus://receipts/{id}', name: '판단 영수증 · Judgment Receipt', description: '결정 하나의 판단 영수증 · The receipt for one decision id.', mimeType: JSON_MIME },
  { uriTemplate: 'argus://premises/{id}', name: '결정 전제 · Decision premises', description: '결정 하나의 추적 전제와 미결 질문 · Tracked facts and open questions with provenance and staleness.', mimeType: JSON_MIME },
] as const;

function unbound(uri: string) {
  // Reached only when ARGUS_DIR is set but invalid (unexpanded ${...}/%...% or
  // a relative path) — with no env at all, resources read ~/.argus like tools.
  return { uri, mimeType: JSON_MIME, text: JSON.stringify({ unbound: true, hint: 'ARGUS_DIR is set but is not an expanded absolute path. Fix it in your MCP config (e.g. "C:\\Users\\you\\.argus" or "/Users/you/.argus"), or remove it entirely to use the default ~/.argus.' }) };
}

export function listResources() {
  // The settle card (MCP Apps) is listed unconditionally — a listing is inert
  // data; rendering only happens on hosts that follow a tool's _meta.ui link.
  return { resources: [...PUBLIC_RESOURCES.map((r) => ({ ...r })), appsResourceListEntry()] };
}

export function listResourceTemplates() {
  return { resourceTemplates: [] };
}

export function readResource(uri: string): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  // ui:// resources are static HTML (no ledger dir needed) — served before the
  // dir resolution so an unbound ARGUS_DIR can never break the settle card.
  const app = readAppsResource(uri);
  if (app) return app;
  const dir = resolveArgusDirForResource();
  if (!dir) {
    logDebug(`resource ${uri} requested while unbound`);
    return { contents: [unbound(uri)] };
  }
  const today = resolveToday({});
  // Resources are model-facing (auto-injected context) and bypass the envelope()
  // sanitizer. JSON.stringify escapes C0/ANSI but NOT bidi (U+202E) / zero-width
  // (U+200B) — the "human and model see different strings" gap. Run the same
  // chokepoint sanitizer over the payload first.
  const payload = sanitizeOutput(computePayload(uri, dir, today));
  return { contents: [{ uri, mimeType: JSON_MIME, text: JSON.stringify(payload, null, 2) }] };
}

function computePayload(uri: string, dir: string, today: string): unknown {
  if (uri === 'argus://attention') {
    const l = replayLedger(dir, today);
    const seeds = bearingContracts(dir, today, l);
    const decisions = [
      ...l.overdue.map((c) => ({ id: c.id, prediction: c.text, check_by: c.date })),
      ...seeds.filter((s) => !l.contracts.has(s.id)).map((s) => ({ id: s.id, prediction: s.predicate, check_by: s.check_by })),
    ];
    const groups = groupDuePremises(duePremises(l));
    const facts = groups.slice(0, 5).map((g) => ({
      fact: g.text,
      decisions: g.premises.map((p) => ({ decision_id: p.decision_id, ref: `P${p.ordinal}` })),
    }));
    return {
      today,
      decisions: decisions.slice(0, 20),
      decision_count: decisions.length,
      facts,
      fact_count: groups.length,
      next_actions: [
        ...(decisions.length ? ['argus_resolve'] : []),
        ...(groups.length ? ['argus_capture'] : []),
      ],
    };
  }

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
    return { today, due, due_count: due.length, next_action: due.length ? 'argus_resolve' : null };
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
      next_action: groups.length ? 'argus_capture' : null,
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
