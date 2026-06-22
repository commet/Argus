import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateContentType, validateContentLength, validateOrigin } from '@/lib/api-security';

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const SEARCH_DAILY_LIMIT = 100;

let warnedMissingKey = false;

/**
 * Per-IP daily cap on the billable Brave call. Reuses the anon rate-limit RPC
 * with a distinct "search:" namespace so it does NOT share the LLM anon bucket.
 * Without this the endpoint is unauthenticated + unthrottled paid-API access
 * (the validateOrigin CSRF check is bypassable by omitting Origin+Referer).
 */
async function checkSearchRateLimit(ip: string): Promise<boolean> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`search:${ip}`));
  const ipHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: allowed, error } = await supabase.rpc('check_anon_rate_limit', {
    p_ip_hash: ipHash,
    p_limit: SEARCH_DAILY_LIMIT,
  });
  if (error) {
    console.error('[api/search] rate-limit RPC error:', error.message);
    return false; // fail closed
  }
  return allowed === true;
}

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

  // Bound abuse of the paid Brave API (no auth on this route by design).
  const ip = req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  if (!(await checkSearchRateLimit(ip))) {
    return NextResponse.json({ error: 'Too many search requests. Please try again shortly.' }, { status: 429 });
  }

  try {
    const { query, locale } = await req.json();
    if (!query || typeof query !== 'string' || query.length > 300) {
      return NextResponse.json({ error: 'A valid search query is required.' }, { status: 400 });
    }
    // en-first product, but default 'ko' to preserve behavior when the caller omits it.
    const searchLang = locale === 'en' ? 'en' : 'ko';

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '5');
    url.searchParams.set('search_lang', searchLang);

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
