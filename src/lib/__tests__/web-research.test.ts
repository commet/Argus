import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseYMD, searchRecent } from '../web-research';

describe('parseYMD', () => {
  it('reads an ISO date or datetime', () => {
    expect(parseYMD('2026-03-15')).toBe('2026-03-15');
    expect(parseYMD('2026-03-15T10:30:00Z')).toBe('2026-03-15');
  });
  it('rejects relative / undated strings (can\'t prove recency)', () => {
    expect(parseYMD('3 days ago')).toBeUndefined();
    expect(parseYMD('')).toBeUndefined();
    expect(parseYMD(undefined)).toBeUndefined();
    expect(parseYMD('recently')).toBeUndefined();
  });
});

function braveResponse(results: Array<{ url: string; page_age?: string; description?: string }>) {
  return {
    ok: true,
    json: async () => ({ web: { results: results.map((r) => ({ title: r.url, description: r.description || 's', url: r.url, page_age: r.page_age })) } }),
  } as Response;
}

describe('searchRecent — recency gate', () => {
  beforeEach(() => { process.env.BRAVE_SEARCH_API_KEY = 'test-key'; process.env.WEB_SEARCH_PROVIDER = 'brave'; });
  afterEach(() => { vi.restoreAllMocks(); delete process.env.WEB_SEARCH_PROVIDER; });

  it('keeps only results dated on/after sinceYMD and drops undated ones', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(braveResponse([
      { url: 'https://fresh.example', page_age: '2026-06-01' },   // after baseline → keep
      { url: 'https://stale.example', page_age: '2024-01-01' },   // before baseline → drop
      { url: 'https://undated.example' },                          // no date → drop
      { url: 'https://onbase.example', page_age: '2026-05-01T09:00:00Z' }, // == baseline → keep
    ]));
    const out = await searchRecent('base rate now', { sinceYMD: '2026-05-01' });
    expect(out.map((r) => r.url)).toEqual(['https://fresh.example', 'https://onbase.example']);
    expect(out.every((r) => r.publishedYMD)).toBe(true);
  });

  it('returns [] (fail closed) on a search error — never manufactures a source', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    expect(await searchRecent('q', { sinceYMD: '2026-01-01' })).toEqual([]);
  });

  it('returns [] when no key is configured', async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    expect(await searchRecent('q', {})).toEqual([]);
  });
});
