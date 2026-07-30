import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { validateMessages, validateSystemPrompt, validateRequest, normalizeMaxTokens, MAX_LLM_BODY_BYTES } from '@/lib/llm-validation';
import { DAILY_LIMIT, ANON_LIMIT, GLOBAL_LIMIT } from '@/lib/quota-config';
import { logServerEvent } from '@/lib/server-events';
import { verifyTurnstile, TURNSTILE_HEADER } from '@/lib/turnstile';
import { classifyProviderFailure } from '@/lib/llm-provider-errors';

// The review pipeline is the one NON-streaming consumer: a large-document
// extraction can generate for 60–100s with no bytes until done. Without an
// explicit ceiling the platform's default function timeout can 504 mid-call
// (and the client retries the doomed call). Give non-streaming calls real room.
export const maxDuration = 300;

/**
 * Verify Supabase auth token from request.
 * Returns { userId, token } if valid, null otherwise.
 */
async function verifyAuth(req: NextRequest): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { userId: user.id, token };
}

/**
 * A rate check has THREE honest answers, not two (2026-07-30 incident lesson:
 * an RPC permission error was relayed as "quota used up" — never tell a user
 * they are out of quota because of our own check failing):
 *   { ok: true, allowed }  — the RPC answered; `allowed:false` is a REAL quota no.
 *   { ok: false, code }    — the RPC itself errored; still fail-closed (the model
 *                            is not called), but surfaced as a temporary 503,
 *                            never as the quota message.
 */
type RateCheck = { ok: true; allowed: boolean } | { ok: false; code: string };

/** The 503 body for an RPC-errored check — "일시적인 확인 문제", not a quota lie. */
const RATE_CHECK_UNAVAILABLE =
  'A temporary problem on our side while checking your quota. Your quota was not used. Please try again in a moment.';

function rpcErrorCode(error: { code?: string; message?: string }): string {
  return error.code || error.message || 'unknown';
}

/**
 * Atomic rate limiter via Supabase RPC.
 * - Runs as SECURITY DEFINER (user cannot tamper with the table)
 * - Single INSERT ... ON CONFLICT with WHERE count < limit (no race condition)
 */
async function checkRateLimit(userId: string, token: string): Promise<RateCheck> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
    p_user_id: userId,
    p_limit: DAILY_LIMIT,
  });

  if (error) {
    // RPC error — fail closed, but distinguished from an honest quota "no"
    console.error('[rate-limit] RPC error:', error.message);
    return { ok: false, code: rpcErrorCode(error) };
  }

  return { ok: true, allowed: data === true };
}


/**
 * Anonymous rate limiting via Supabase (persistent across serverless instances).
 * Uses a dedicated RPC that doesn't require auth — takes a hashed IP instead.
 */
async function checkAnonRateLimit(ip: string): Promise<RateCheck> {
  // Hash IP so raw addresses aren't stored in the rate_limits table
  const encoder = new TextEncoder();
  const data = encoder.encode(`anon:${ip}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Only need first 32 hex chars (RPC converts to UUID internally)
  const ipHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: allowed, error } = await supabase.rpc('check_anon_rate_limit', {
    p_ip_hash: ipHash,
    p_limit: ANON_LIMIT,
  });

  if (error) {
    // RPC error — fail closed, but distinguished from an honest quota "no"
    console.error('[rate-limit] anon RPC error:', error.message);
    return { ok: false, code: rpcErrorCode(error) };
  }

  return { ok: true, allowed: allowed === true };
}

/**
 * Global cost circuit breaker: one shared daily counter across ALL requests
 * (auth + anon). Reuses the anon rate-limit RPC with a fixed sentinel key —
 * no real IP can collide with it (real keys are SHA-256 prefixes of `anon:ip`).
 * Fail-closed like the other limits: if the RPC errors, the model is not called.
 */
const GLOBAL_SENTINEL_HASH = '00000000000000000000000000000001';

async function checkGlobalRateLimit(): Promise<RateCheck> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: allowed, error } = await supabase.rpc('check_anon_rate_limit', {
    p_ip_hash: GLOBAL_SENTINEL_HASH,
    p_limit: GLOBAL_LIMIT,
  });

  if (error) {
    console.error('[rate-limit] global RPC error:', error.message);
    return { ok: false, code: rpcErrorCode(error) };
  }

  return { ok: true, allowed: allowed === true };
}

export async function POST(req: NextRequest) {
  // 0. Request validation
  const reqError = validateRequest(req, MAX_LLM_BODY_BYTES);
  if (reqError) return reqError;

  // Invalid JSON or payloads are not model attempts and must not consume quota.
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { messages, system } = body;
  if (!validateSystemPrompt(system) || !validateMessages(messages)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const maxTokens = normalizeMaxTokens(body.maxTokens);

  // 1. Authenticate (optional — anonymous trial allowed)
  const auth = await verifyAuth(req);

  // 2. Check server API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Service unavailable. Please enter your own API key in Settings.' },
      { status: 503 }
    );
  }

  // 3. Rate limiting — authenticated vs anonymous
  // Always resolve IP for anon rate limiting (prevents double-dip: auth 5 + anon 3)
  const ip = req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  // Local-dev escape hatch: with a placeholder Supabase the rate-limit RPCs
  // fail closed (correct in prod) and every request 429s, which blocks any
  // local end-to-end run. Explicit opt-in AND development-only — this can
  // never relax production limits (NODE_ENV is 'production' on Vercel).
  const devSkipRateLimit =
    process.env.NODE_ENV === 'development' && process.env.ARGUS_DEV_SKIP_RATE_LIMIT === '1';

  if (devSkipRateLimit) {
    // fall through to the model call — quotas are a prod-abuse concern.
  } else if (auth) {
    // Logged-in user: DAILY_LIMIT/day via Supabase RPC
    const check = await checkRateLimit(auth.userId, auth.token);
    if (!check.ok) {
      // RPC ERROR is not a quota "no" — never tell the user their quota is used
      // up because our permission/config broke (2026-07-30 incident lesson).
      logServerEvent('server_rate_limit_rpc_error', { fn: 'check_and_increment_rate_limit', code: check.code }, { userId: auth.userId, path: '/api/llm' });
      return NextResponse.json({ error: RATE_CHECK_UNAVAILABLE }, { status: 503 });
    }
    if (!check.allowed) {
      logServerEvent('server_rate_limited', { kind: 'auth_daily', limit: DAILY_LIMIT }, { userId: auth.userId, path: '/api/llm' });
      return NextResponse.json(
        { error: `Today's free quota (${DAILY_LIMIT} calls) is used up. Enter your own API key in Settings for unlimited use.` },
        { status: 429 }
      );
    }
    // Also burn the anon quota for this IP so user can't strip auth and get extra
    // calls. Best-effort: its result is ignored, but an RPC error is still logged
    // (observability, never a user-facing 503 on this secondary burn).
    const burn = await checkAnonRateLimit(ip);
    if (!burn.ok) {
      logServerEvent('server_rate_limit_rpc_error', { fn: 'check_anon_rate_limit', code: burn.code, secondary: 'auth_ip_burn' }, { userId: auth.userId, path: '/api/llm' });
    }
  } else {
    // Bot/cost-abuse defense on the anonymous paid path (inert until
    // TURNSTILE_SECRET_KEY is set — see src/lib/turnstile.ts). Raises the cost of
    // the IP-rotation bypass that a per-IP rate limit alone can't stop.
    const captchaOk = await verifyTurnstile(req.headers.get(TURNSTILE_HEADER), ip);
    if (!captchaOk) {
      logServerEvent('server_captcha_rejected', { path: '/api/llm' }, { path: '/api/llm' });
      return NextResponse.json({ error: 'Verification required. Please try again.', needsCaptcha: true }, { status: 403 });
    }
    // Anonymous: ANON_LIMIT/day per IP
    const check = await checkAnonRateLimit(ip);
    if (!check.ok) {
      logServerEvent('server_rate_limit_rpc_error', { fn: 'check_anon_rate_limit', code: check.code }, { path: '/api/llm' });
      return NextResponse.json({ error: RATE_CHECK_UNAVAILABLE }, { status: 503 });
    }
    if (!check.allowed) {
      logServerEvent('server_rate_limited', { kind: 'anon_daily', limit: ANON_LIMIT }, { path: '/api/llm' });
      return NextResponse.json(
        { error: `Free trial quota exhausted. Log in to keep using up to ${DAILY_LIMIT} free calls per day!`, needsLogin: true },
        { status: 429 }
      );
    }
  }

  // 3.5 Global cost circuit breaker — after the individual checks so the shared
  // counter reflects calls that would actually reach the model. Per-IP limits
  // cannot bound many IPs at once; this bounds the day's total bill.
  if (!devSkipRateLimit) {
    const globalCheck = await checkGlobalRateLimit();
    if (!globalCheck.ok) {
      logServerEvent('server_rate_limit_rpc_error', { fn: 'check_anon_rate_limit', code: globalCheck.code, secondary: 'global_daily' }, { userId: auth?.userId ?? null, path: '/api/llm' });
      return NextResponse.json({ error: RATE_CHECK_UNAVAILABLE }, { status: 503 });
    }
    if (!globalCheck.allowed) {
      logServerEvent('server_rate_limited', { kind: 'global_daily', limit: GLOBAL_LIMIT }, { userId: auth?.userId ?? null, path: '/api/llm' });
      return NextResponse.json(
        { error: 'The free service hit today\'s overall capacity. Please try again tomorrow, or enter your own API key in Settings to continue now.' },
        { status: 503 }
      );
    }
  }

  // 4. Call the provider
  try {
    const client = new Anthropic({ apiKey });
    const stream = body.stream === true;

    // A user's explicit Settings choice wins. Legacy callers that only send a
    // workload tier keep the old safe fallback.
    const ALLOWED_MODELS = new Set([
      'claude-sonnet-5',
      'claude-opus-5',
      'claude-opus-4-8',
      'claude-fable-5',
    ]);
    const MODEL_MAP: Record<string, string> = {
      fast: 'claude-haiku-4-5-20251001',
      default: 'claude-sonnet-4-6',
      // Deep judgment is separately limited to one platform-funded loop per
      // rolling 24h. Its final synthesis earns the strongest model.
      strong: 'claude-opus-4-8',
    };
    const requestedAnthropicModel = typeof body.anthropicModel === 'string' ? body.anthropicModel : '';
    const modelId = ALLOWED_MODELS.has(requestedAnthropicModel)
      ? requestedAnthropicModel
      : MODEL_MAP[body.model as string] || MODEL_MAP.default;

    // Prompt caching for STATIC system prompts (client opt-in via cacheSystem).
    // The initial-analysis prompt is ~7k tokens of byte-identical instructions
    // per locale, re-prefilled from scratch on every call before this — pure
    // prefill latency + cost. Callers only set the flag for prompts that are
    // truly identical across calls; a dynamic prompt would never hit and each
    // write costs a 25% premium. Below Anthropic's per-model minimum
    // cacheable length the marker is simply ignored — safe, never an error.
    const systemParam: string | Anthropic.TextBlockParam[] | undefined =
      body.cacheSystem === true && typeof system === 'string'
        ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
        : system;

    if (stream) {
      const anthropicStream = client.messages.stream({
        model: modelId,
        max_tokens: maxTokens,
        system: systemParam,
        messages: messages as Anthropic.MessageParam[],
      });

      const encoder = new TextEncoder();
      let cancelled = false;
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of anthropicStream) {
              if (cancelled) break;
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
              }
            }
            if (!cancelled) {
              // Capture run provenance + token cost (dims 8 & 10): the model id and
              // usage were being discarded. Server-side telemetry only — no user meter.
              try {
                const final = await anthropicStream.finalMessage();
                // Truncation sensor (2026-07-31). An output cut at max_tokens is
                // not an error anywhere — the client's parse fallback recovers it
                // and everything stays green — which is exactly how a 2x-latency
                // double-call ran silently at 44% of big calls for months. Make
                // the condition itself observable so the NEXT prompt that
                // outgrows its budget turns a dial red instead of waiting to be
                // felt. stop_reason is the authoritative signal, not out==cap.
                if (final.stop_reason === 'max_tokens') {
                  logServerEvent('llm_truncation', {
                    model: final.model || modelId,
                    tier: body.model || 'default',
                    max_tokens: maxTokens,
                    input_tokens: final.usage?.input_tokens,
                    output_tokens: final.usage?.output_tokens,
                    stream: true,
                  }, { userId: auth?.userId ?? null, path: '/api/llm' });
                }
                logServerEvent('llm_usage', {
                  model: final.model || modelId,
                  tier: body.model || 'default',
                  input_tokens: final.usage?.input_tokens,
                  output_tokens: final.usage?.output_tokens,
                  // Cache observability: without these two numbers there is no
                  // way to tell from production data whether caching is
                  // actually firing (read>0) or only paying write premiums.
                  cache_read_tokens: final.usage?.cache_read_input_tokens,
                  cache_write_tokens: final.usage?.cache_creation_input_tokens,
                  stream: true,
                }, { userId: auth?.userId ?? null, path: '/api/llm' });
              } catch { /* telemetry must never break the stream */ }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          } catch (err) {
            // Log the real cause server-side — without this an Anthropic outage,
            // a 529 overload, and a code bug are indistinguishable in production.
            console.error('[api/llm] stream error:', err);
            if (!cancelled) {
              const failure = classifyProviderFailure(err);
              logServerEvent('server_llm_error', {
                code: failure.code,
                status: failure.upstreamStatus,
                retryable: failure.retryable,
              }, { userId: auth?.userId ?? null, path: '/api/llm' });
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(failure)}\n\n`));
              controller.close();
            }
          }
        },
        cancel() {
          cancelled = true;
          anthropicStream.abort();
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming path
    const response = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system: systemParam,
      messages: messages as Anthropic.MessageParam[],
    });

    const block = response.content.find((b) => b.type === 'text');
    // Same truncation sensor as the streaming branch — the non-streaming path
    // serves the retry/fallback calls, where a second cut becomes a user-facing
    // parse error, so this signal matters here even more.
    if (response.stop_reason === 'max_tokens') {
      logServerEvent('llm_truncation', {
        model: response.model || modelId,
        tier: body.model || 'default',
        max_tokens: maxTokens,
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
        stream: false,
      }, { userId: auth?.userId ?? null, path: '/api/llm' });
    }
    // Capture run provenance + token cost (dims 8 & 10) — was discarded. Telemetry only.
    logServerEvent('llm_usage', {
      model: response.model || modelId,
      tier: body.model || 'default',
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
      cache_read_tokens: response.usage?.cache_read_input_tokens,
      cache_write_tokens: response.usage?.cache_creation_input_tokens,
      stream: false,
    }, { userId: auth?.userId ?? null, path: '/api/llm' });
    const res = NextResponse.json({ text: block ? block.text : '' });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    // Log the real cause server-side (provider error type / request id) so the
    // paid Anthropic path is observable; keep the client body generic.
    console.error('[api/llm] Anthropic call failed:', err);
    const failure = classifyProviderFailure(err);
    logServerEvent('server_llm_error', {
      code: failure.code,
      status: failure.upstreamStatus,
      retryable: failure.retryable,
    }, { path: '/api/llm' });
    return NextResponse.json(
      failure,
      { status: failure.status }
    );
  }
}
