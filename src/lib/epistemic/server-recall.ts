import type { RecallDocument, RecallQuery, RecallSearchHit, RecallSearchPort } from './recall-types';
import { matchesRecallFilters, recallTerms, validRecallDocument } from './recall-index';
import { authorityChecksum } from './domain/checksum';
import { RECALL_PROJECTION_VERSION } from './recall-types';

// Supabase remains an adapter boundary in this repository.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

/** Postgres FTS is candidate retrieval only. The shared planner rechecks every
 * hard filter and deterministically reranks the returned RecallDocuments. */
export class PostgresRecallSearchPort implements RecallSearchPort {
  constructor(private readonly admin: AdminClient, private readonly userId: string) {}

  async replace(documents: readonly RecallDocument[]): Promise<void> {
    if (documents.some((document) => !validRecallDocument(document))) {
      throw new Error('INVALID_RECALL_DOCUMENT');
    }
    const { error } = await this.admin.rpc('replace_epistemic_recall_documents', {
      p_user_id: this.userId,
      p_documents: documents.map((document) => ({
        document,
        // Same tokenizer as the pure-JS adapter, including Korean bigrams and
        // Latin/Hangul boundaries. Postgres indexes this generated projection,
        // never a second canonical text.
        search_text: recallTerms(`${document.title} ${document.searchable_text}`).join(' '),
      })),
      p_projection_checksum: authorityChecksum(documents),
    });
    if (error) throw new Error(`RECALL_REPLACE_FAILED:${String(error.message ?? 'unknown')}`);
  }

  async search(query: RecallQuery): Promise<readonly RecallSearchHit[]> {
    if (query.filters.authorities.length === 0 || query.filters.lifecycle_statuses.length === 0) return [];
    let request = this.admin
      .from('epistemic_recall_documents')
      .select('document')
      .eq('user_id', this.userId)
      .in('authority', query.filters.authorities)
      .in('lifecycle_status', query.filters.lifecycle_statuses);
    if (query.filters.kinds?.length) request = request.in('kind', query.filters.kinds);
    if (query.filters.project_ids?.length) request = request.in('project_id', query.filters.project_ids);
    if (query.filters.occurred_after) request = request.gte('occurred_at', query.filters.occurred_after);
    if (query.filters.occurred_before) request = request.lte('occurred_at', query.filters.occurred_before);
    const plain = recallTerms(query.text).join(' | ');
    if (plain) request = request.textSearch('search_vector', plain, { config: 'simple' });
    const { data, error } = await request.limit(Math.max(1, Math.min(200, query.limit)));
    if (error) throw new Error(`RECALL_SEARCH_FAILED:${String(error.message ?? 'unknown')}`);
    const terms = recallTerms(query.text);
    return (data ?? []).flatMap((row: { document?: unknown }) => {
      if (!validRecallDocument(row.document) || !matchesRecallFilters(row.document, query.filters)) return [];
      const text = `${row.document.title} ${row.document.searchable_text}`.normalize('NFKC').toLocaleLowerCase('en-US');
      const matched = terms.filter((term) => text.includes(term));
      return [{ document: row.document, lexical_score: matched.length, matched_terms: matched }];
    });
  }

  async health(): Promise<{ ready: boolean; detail?: string }> {
    const { data, error } = await this.admin.from('epistemic_recall_projection_state')
      .select('status,projection_version,document_count,source_checksum')
      .eq('user_id', this.userId)
      .maybeSingle();
    return error
      ? { ready: false, detail: `postgres-fts-v1:${String(error.message ?? 'unavailable')}` }
      : data?.status === 'ready' && data?.projection_version === RECALL_PROJECTION_VERSION
        ? { ready: true, detail: `postgres-fts-v1 documents=${String(data.document_count)} checksum=${String(data.source_checksum)}` }
        : { ready: false, detail: 'postgres-fts-v1:projection-state-not-ready' };
  }
}
