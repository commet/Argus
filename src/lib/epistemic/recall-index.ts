import { authorityChecksum } from './domain/checksum';
import type {
  RecallDocument,
  RecallExecution,
  RecallHardFilters,
  RecallQuery,
  RecallQueryPlan,
  RecallResult,
  RecallSearchHit,
  RecallSearchPort,
} from './recall-types';
import { RECALL_PROJECTION_VERSION, RECALL_RANKING_VERSION } from './recall-types';

const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 20;
const MAX_CANDIDATES = 200;

export function recallTerms(value: string): string[] {
  const normalized = value.normalize('NFKC').toLocaleLowerCase('en-US')
    // Keep a Latin technical term searchable when Korean particles are attached
    // ("Postgres로" -> "postgres 로").
    .replace(/([a-z0-9])([\p{Script=Hangul}])/gu, '$1 $2')
    .replace(/([\p{Script=Hangul}])([a-z0-9])/gu, '$1 $2');
  const raw = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const expanded = raw.flatMap((term) => {
    const chars = [...term];
    if (!/\p{Script=Hangul}/u.test(term) || chars.length <= 2) return [term];
    return [term, ...chars.slice(0, -1).map((_, index) => chars.slice(index, index + 2).join(''))];
  });
  return [...new Set(expanded)]
    .filter((term) => term.length > 1)
    .slice(0, 40);
}

export function validRecallDocument(value: unknown): value is RecallDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const d = value as Partial<RecallDocument>;
  return typeof d.document_id === 'string' && d.document_id.length > 0
    && ['judgment', 'claim', 'grant', 'observation', 'checkpoint'].includes(String(d.kind))
    && Array.isArray(d.canonical_refs) && d.canonical_refs.length > 0 && d.canonical_refs.every((x) => typeof x === 'string')
    && (d.project_id === null || typeof d.project_id === 'string')
    && ['user', 'external', 'ai_proposal', 'imported', 'legacy'].includes(String(d.authority))
    && typeof d.lifecycle_status === 'string' && d.lifecycle_status.length <= 80
    && typeof d.title === 'string' && d.title.length <= 240
    && typeof d.searchable_text === 'string' && d.searchable_text.length <= 20_000
    && d.canonical_refs.length <= 256
    && Number.isFinite(Date.parse(String(d.occurred_at)))
    && Array.isArray(d.source_hashes) && d.source_hashes.every((x) => typeof x === 'string')
    && ['normal', 'sensitive', 'highly_sensitive'].includes(String(d.sensitivity))
    && Number.isInteger(d.projection_version);
}

export function matchesRecallFilters(document: RecallDocument, filters: RecallHardFilters): boolean {
  if (!filters.authorities.includes(document.authority)) return false;
  if (!filters.lifecycle_statuses.includes(document.lifecycle_status)) return false;
  if (filters.kinds?.length && !filters.kinds.includes(document.kind)) return false;
  if (filters.project_ids?.length && (!document.project_id || !filters.project_ids.includes(document.project_id))) return false;
  if (filters.occurred_after && document.occurred_at < filters.occurred_after) return false;
  if (filters.occurred_before && document.occurred_at > filters.occurred_before) return false;
  return true;
}

interface IndexSnapshot {
  schema_version: 1;
  projection_version: number;
  document_checksum: string;
  documents: RecallDocument[];
}

function snapshotChecksum(documents: readonly RecallDocument[]): string {
  return authorityChecksum([...documents].sort((a, b) => a.document_id.localeCompare(b.document_id)));
}

/** Dependency-free reference adapter. It has no native install, open port, or
 * canonical state: a rejected/corrupt snapshot is rebuilt from source docs. */
export class PureJsLocalSearchIndex implements RecallSearchPort {
  private documents: RecallDocument[] = [];
  private postings = new Map<string, number[]>();
  private ready = false;
  private checksum = authorityChecksum([]);
  private lastError?: string;

  async replace(documents: readonly RecallDocument[]): Promise<void> {
    if (documents.length > 100_000) throw new Error('RECALL_INDEX_CAP_EXCEEDED');
    const nextDocuments: RecallDocument[] = [];
    const ids = new Set<string>();
    const nextPostings = new Map<string, number[]>();
    for (const source of documents) {
      if (!validRecallDocument(source)) throw new Error(`INVALID_RECALL_DOCUMENT:${String((source as { document_id?: unknown })?.document_id ?? 'unknown')}`);
      if (source.projection_version !== RECALL_PROJECTION_VERSION) throw new Error('UNSUPPORTED_RECALL_PROJECTION');
      if (ids.has(source.document_id)) throw new Error(`DUPLICATE_RECALL_DOCUMENT:${source.document_id}`);
      const document = structuredClone(source);
      const slot = nextDocuments.length;
      ids.add(document.document_id);
      nextDocuments.push(document);
      for (const term of recallTerms(`${document.title} ${document.searchable_text}`)) {
        const posting = nextPostings.get(term) ?? [];
        posting.push(slot);
        nextPostings.set(term, posting);
      }
    }
    this.documents = nextDocuments;
    this.postings = nextPostings;
    this.checksum = snapshotChecksum(nextDocuments);
    this.ready = true;
    this.lastError = undefined;
  }

  async search(query: RecallQuery): Promise<readonly RecallSearchHit[]> {
    if (!this.ready) return [];
    const terms = recallTerms(query.text.slice(0, MAX_QUERY_LENGTH));
    const scores = new Float64Array(this.documents.length);
    const seen = new Uint8Array(this.documents.length);
    const candidates: number[] = [];
    if (terms.length === 0) {
      for (let slot = 0; slot < this.documents.length; slot += 1) candidates.push(slot);
    }
    for (const term of terms) {
      const posting = this.postings.get(term);
      if (!posting) continue;
      const inverse = Math.log(1 + this.documents.length / Math.max(1, posting.length));
      for (const slot of posting) {
        scores[slot] += inverse;
        if (seen[slot] === 0) {
          seen[slot] = 1;
          candidates.push(slot);
        }
      }
    }
    const phrase = query.text.normalize('NFKC').toLocaleLowerCase('en-US').trim();
    const candidateLimit = Math.min(MAX_CANDIDATES, Math.max(query.limit, 1));
    const top: Array<{ slot: number; score: number }> = [];
    const better = (a: { slot: number; score: number }, b: { slot: number; score: number }): boolean => {
      if (a.score !== b.score) return a.score > b.score;
      const left = this.documents[a.slot];
      const right = this.documents[b.slot];
      if (left.occurred_at !== right.occurred_at) return left.occurred_at > right.occurred_at;
      return left.document_id < right.document_id;
    };
    for (const slot of candidates) {
      const document = this.documents[slot];
      if (!matchesRecallFilters(document, query.filters)) continue;
      const haystack = `${document.title} ${document.searchable_text}`.normalize('NFKC').toLocaleLowerCase('en-US');
      const phraseBoost = phrase.length > 1 && haystack.includes(phrase) ? 2 : 0;
      const item = { slot, score: scores[slot] + phraseBoost };
      if (top.length < candidateLimit) {
        top.push(item);
        top.sort((a, b) => better(a, b) ? 1 : -1); // worst first
      } else if (better(item, top[0])) {
        top[0] = item;
        top.sort((a, b) => better(a, b) ? 1 : -1);
      }
    }
    return top.sort((a, b) => better(a, b) ? -1 : 1).map((item) => {
      const document = this.documents[item.slot];
      const haystack = `${document.title} ${document.searchable_text}`.normalize('NFKC').toLocaleLowerCase('en-US');
      return {
        document: structuredClone(document),
        lexical_score: item.score,
        matched_terms: terms.filter((term) => haystack.includes(term)).sort(),
      };
    });
  }

  async health(): Promise<{ ready: boolean; detail?: string }> {
    return {
      ready: this.ready,
      detail: this.lastError ?? `pure-js-v1 documents=${this.documents.length} checksum=${this.checksum}`,
    };
  }

  exportSnapshot(): string {
    if (!this.ready) throw new Error('INDEX_NOT_READY');
    const documents = [...this.documents].sort((a, b) => a.document_id.localeCompare(b.document_id));
    return JSON.stringify({
      schema_version: 1,
      projection_version: RECALL_PROJECTION_VERSION,
      document_checksum: snapshotChecksum(documents),
      documents,
    } satisfies IndexSnapshot);
  }

  async restoreSnapshot(raw: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(raw) as Partial<IndexSnapshot>;
      if (parsed.schema_version !== 1 || parsed.projection_version !== RECALL_PROJECTION_VERSION
        || !Array.isArray(parsed.documents) || typeof parsed.document_checksum !== 'string'
        || parsed.documents.some((document) => !validRecallDocument(document))
        || snapshotChecksum(parsed.documents) !== parsed.document_checksum) {
        throw new Error('CORRUPT_RECALL_SNAPSHOT');
      }
      await this.replace(parsed.documents);
      return true;
    } catch (error) {
      this.documents = [];
      this.postings = new Map();
      this.ready = false;
      this.lastError = error instanceof Error ? error.message : 'CORRUPT_RECALL_SNAPSHOT';
      return false;
    }
  }
}

export function planRecallQuery(query: RecallQuery): RecallQueryPlan {
  const limit = Math.max(1, Math.min(MAX_RESULTS, Math.floor(query.limit)));
  const filters: RecallHardFilters = {
    authorities: [...new Set(query.filters.authorities)].slice(0, 10),
    lifecycle_statuses: [...new Set(query.filters.lifecycle_statuses)].slice(0, 50),
    ...(query.filters.kinds?.length ? { kinds: [...new Set(query.filters.kinds)].slice(0, 10) } : {}),
    ...(query.filters.project_ids?.length ? { project_ids: [...new Set(query.filters.project_ids)].slice(0, 50) } : {}),
    ...(query.filters.occurred_after && Number.isFinite(Date.parse(query.filters.occurred_after))
      ? { occurred_after: query.filters.occurred_after } : {}),
    ...(query.filters.occurred_before && Number.isFinite(Date.parse(query.filters.occurred_before))
      ? { occurred_before: query.filters.occurred_before } : {}),
  };
  return {
    normalized_terms: recallTerms(query.text.slice(0, MAX_QUERY_LENGTH)),
    phrase: query.text.normalize('NFKC').trim().slice(0, MAX_QUERY_LENGTH),
    hard_filters: filters,
    candidate_limit: Math.min(MAX_CANDIDATES, Math.max(limit * 5, limit)),
    result_limit: limit,
    semantic_enabled: false,
    ranking_version: RECALL_RANKING_VERSION,
  };
}

function groupedResults(hits: readonly RecallSearchHit[], limit: number): RecallResult[] {
  const trusted = hits.filter((hit) => validRecallDocument(hit.document));
  const byId = new Map(trusted.map((hit) => [hit.document.document_id, hit.document]));
  const sourceSeen = new Set<string>();
  const remaining = [...trusted];
  const selected: RecallSearchHit[] = [];
  while (selected.length < limit && remaining.length > 0) {
    remaining.sort((a, b) => {
      const aDiversity = a.document.source_hashes.some((hash) => !sourceSeen.has(hash)) ? 1 : 0;
      const bDiversity = b.document.source_hashes.some((hash) => !sourceSeen.has(hash)) ? 1 : 0;
      return (b.lexical_score + bDiversity * 0.1) - (a.lexical_score + aDiversity * 0.1)
        || b.document.occurred_at.localeCompare(a.document.occurred_at)
        || a.document.document_id.localeCompare(b.document.document_id);
    });
    const next = remaining.shift()!;
    selected.push(next);
    for (const hash of next.document.source_hashes) sourceSeen.add(hash);
  }
  return selected.map((hit) => {
    const related = [...byId.values()].filter((candidate) =>
      candidate.document_id !== hit.document.document_id
      && (candidate.superseded_by === hit.document.document_id
        || hit.document.superseded_by === candidate.document_id)).map((candidate) => candidate.document_id).sort();
    return {
      document: hit.document,
      score: hit.lexical_score,
      matched_terms: [...hit.matched_terms],
      group: { ...(hit.document.superseded_by ? { superseded_by: hit.document.superseded_by } : {}), related_document_ids: related },
    };
  });
}

/** Search adapters are projections and therefore untrusted. Hard filters and
 * current projection version are checked again after retrieval. */
export async function executeRecallQuery(
  port: RecallSearchPort,
  query: RecallQuery,
  now = new Date().toISOString(),
): Promise<RecallExecution> {
  const plan = planRecallQuery(query);
  const hits = await port.search({ ...query, text: plan.phrase, filters: plan.hard_filters, limit: plan.candidate_limit });
  const excludedStale: string[] = [];
  const allowed = hits.filter((hit) => {
    const valid = validRecallDocument(hit.document)
      && hit.document.projection_version === RECALL_PROJECTION_VERSION
      && matchesRecallFilters(hit.document, plan.hard_filters);
    if (!valid && hit.document?.document_id) excludedStale.push(hit.document.document_id);
    return valid;
  });
  const results = groupedResults(allowed, plan.result_limit);
  const queryHash = authorityChecksum({ query: plan.phrase, intent: query.intent, filters: plan.hard_filters });
  return {
    results,
    receipt: {
      receipt_id: `recall:${authorityChecksum({ query_hash: queryHash, refs: results.map((result) => result.document.canonical_refs) })}`,
      query_hash: queryHash,
      ranking_version: RECALL_RANKING_VERSION,
      projection_version: RECALL_PROJECTION_VERSION,
      plan,
      returned_refs: results.flatMap((result) => result.document.canonical_refs),
      excluded_stale: excludedStale.sort(),
      created_at: now,
    },
  };
}
