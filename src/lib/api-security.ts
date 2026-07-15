import { NextRequest, NextResponse } from 'next/server';

const MAX_BODY_BYTES = 500_000; // 500KB

/**
 * Reject requests with unexpected Content-Type.
 * Prevents JSON parser confusion and content-type sniffing attacks.
 */
export function validateContentType(req: NextRequest): NextResponse | null {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }
  return null;
}

/**
 * Reject oversized request bodies before JSON parsing.
 * Prevents memory/CPU exhaustion from large payloads. `maxBytes` overrides the
 * default 500KB for routes that legitimately carry larger payloads (the LLM
 * vision path sends a base64 PDF/deck images — bounded by the platform's own
 * ~4.5MB limit, so callers pass a route-local ceiling under that).
 */
export function validateContentLength(req: NextRequest, maxBytes: number = MAX_BODY_BYTES): NextResponse | null {
  const cl = req.headers.get('content-length');
  if (cl && parseInt(cl, 10) > maxBytes) {
    return NextResponse.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  }
  return null;
}

/**
 * Validate that the request originates from our own domain (CSRF protection).
 *
 * Checks the Origin header (set by browsers on all POST/PUT/DELETE requests).
 * If Origin is absent (e.g. server-to-server calls), falls back to Referer.
 *
 * Returns null if valid, or a 403 NextResponse if blocked.
 */
export function validateOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // Server-to-server or non-browser clients won't send Origin/Referer.
  // We allow these only because all endpoints using this check also require
  // a valid auth token or user-provided API key.
  // Note: endpoints without auth (e.g. /api/boss/saju) should NOT rely on
  // this function alone for CSRF protection.
  if (!origin && !referer) return null;

  const host = req.headers.get('host') || '';

  // Check Origin header first (most reliable)
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return null;
    } catch {
      // Malformed origin — reject
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fallback: check Referer
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost === host) return null;
    } catch {
      // Malformed referer — reject
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}
