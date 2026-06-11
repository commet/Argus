import { NextRequest, NextResponse } from 'next/server';
import { validateContentType, validateContentLength, validateOrigin } from '@/lib/api-security';

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;

let warnedMissingKey = false;

export async function POST(req: NextRequest) {
  const ctError = validateContentType(req);
  if (ctError) return ctError;
  const clError = validateContentLength(req);
  if (clError) return clError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  if (!BRAVE_API_KEY) {
    if (!warnedMissingKey) {
      console.warn('[api/search] BRAVE_SEARCH_API_KEY is not set — web search is disabled.');
      warnedMissingKey = true;
    }
    // disabled lets callers distinguish "no key" from "no results"
    return NextResponse.json({ results: [], disabled: true });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string' || query.length > 300) {
      return NextResponse.json({ error: '유효한 검색어가 필요합니다' }, { status: 400 });
    }

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '5');
    url.searchParams.set('search_lang', 'ko');

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (data.web?.results || []).slice(0, 5).map((r: any) => ({
      title: r.title || '',
      snippet: r.description || '',
      url: r.url || '',
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
