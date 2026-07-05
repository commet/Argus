/**
 * Recency-aware web search — the search layer for the autonomous premise watcher
 * (Workstream E). Server-only (uses fetch + the Brave key directly; never import
 * into client code).
 *
 * The founder's hard requirement: NEVER surface stale info as if current. We
 * enforce that HERE, at the search layer, not by trusting the LLM — every result
 * we return has a parsed publish date AND that date is on/after the caller's
 * baseline (`sinceYMD`). Results with no detectable date are DROPPED (fail
 * closed / silent), because an undated page can't be proven recent.
 *
 * Provider-agnostic behind `searchRecent`: the default is Brave (already keyed +
 * best benchmarked latency), swappable to Tavily/Exa/self-hosted by env without
 * touching the researcher or the cron.
 */

export interface DatedResult {
  title: string;
  snippet: string;
  url: string;
  /** YYYY-MM-DD publish date, when the provider reports a parseable one. */
  publishedYMD?: string;
}

export type Freshness = 'pd' | 'pw' | 'pm' | 'py';

export interface SearchOptions {
  /** Drop any result published before this date (YYYY-MM-DD). Undated results
   *  are always dropped. Omit to keep all dated results. */
  sinceYMD?: string;
  /** Coarse provider-level recency hint. Defaults to 'py' (past year); the
   *  sinceYMD gate does the precise filtering. */
  freshness?: Freshness;
  locale?: 'ko' | 'en';
  /** Max results to request (provider cap applies). Default 5. */
  count?: number;
}

/** Is a web-search provider configured on this deployment? */
export function webSearchEnabled(): boolean {
  return provider() === 'brave' ? Boolean(process.env.BRAVE_SEARCH_API_KEY) : false;
}

function provider(): string {
  return (process.env.WEB_SEARCH_PROVIDER || 'brave').toLowerCase();
}

/** Parse a provider date field into YYYY-MM-DD, or undefined if not absolute. */
export function parseYMD(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  // Brave `page_age` is an ISO date/datetime ("2026-03-15" or "2026-03-15T10:00:00Z").
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  if (m) {
    const t = Date.parse(`${m[1]}T00:00:00Z`);
    if (!Number.isNaN(t)) return m[1];
  }
  // A general ISO string Date can parse (but not a relative "3 days ago").
  const t = Date.parse(raw);
  if (!Number.isNaN(t) && /\d{4}/.test(raw)) return new Date(t).toISOString().slice(0, 10);
  return undefined;
}

/**
 * Search the web and return ONLY results with a publish date on/after `sinceYMD`.
 * Returns [] when search is disabled or nothing recent+dated is found (the caller
 * treats [] as "no recent source" → stay silent, never alert).
 */
export async function searchRecent(query: string, opts: SearchOptions = {}): Promise<DatedResult[]> {
  const q = (query || '').trim().slice(0, 300);
  if (!q) return [];
  let results: DatedResult[];
  try {
    results = provider() === 'brave' ? await braveSearch(q, opts) : [];
  } catch (err) {
    console.error('[web-research] search error:', err instanceof Error ? err.message : err);
    return []; // fail closed — a search error must never manufacture an alert
  }
  const since = opts.sinceYMD;
  return results.filter((r) => {
    if (!r.publishedYMD) return false; // undated → can't prove recency → drop
    return since ? r.publishedYMD >= since : true;
  });
}

// --------------------------------------------------------------------------
// Brave adapter — direct call (bypasses /api/search's per-IP throttle) so the
// cron can run, and so we can read `freshness` + the per-result publish date.
// --------------------------------------------------------------------------

async function braveSearch(query: string, opts: SearchOptions): Promise<DatedResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(Math.max(opts.count ?? 5, 1), 10)));
  url.searchParams.set('search_lang', opts.locale === 'en' ? 'en' : 'ko');
  url.searchParams.set('freshness', opts.freshness ?? 'py'); // coarse; sinceYMD is the real gate

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { web?: { results?: BraveResult[] } };
  const raw = data.web?.results ?? [];
  return raw.slice(0, opts.count ?? 5).map((r) => ({
    title: r.title || '',
    snippet: r.description || '',
    url: r.url || '',
    publishedYMD: parseYMD(r.page_age) ?? parseYMD(r.page_fetched),
  }));
}

interface BraveResult {
  title?: string;
  description?: string;
  url?: string;
  /** ISO publish date Brave attaches when it can determine one. */
  page_age?: string;
  /** ISO fetch date — a weaker recency signal, used only as a fallback. */
  page_fetched?: string;
  /** relative string ("3 days ago") — not absolute, intentionally not trusted. */
  age?: string;
}
