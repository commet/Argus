import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { validateMessages, validateSystemPrompt, validateRequest, normalizeMaxTokens } from '@/lib/llm-validation';
import { DAILY_LIMIT, ANON_LIMIT } from '@/lib/quota-config';
import { logServerEvent } from '@/lib/server-events';

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
 * Atomic rate limiter via Supabase RPC.
 * - Runs as SECURITY DEFINER (user cannot tamper with the table)
 * - Single INSERT ... ON CONFLICT with WHERE count < limit (no race condition)
 */
async function checkRateLimit(userId: string, token: string): Promise<boolean> {
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
    // RPC error — fail closed (deny the request)
    console.error('[rate-limit] RPC error:', error.message);
    return false;
  }

  return data === true;
}


/**
 * Anonymous rate limiting via Supabase (persistent across serverless instances).
 * Uses a dedicated RPC that doesn't require auth — takes a hashed IP instead.
 */
async function checkAnonRateLimit(ip: string): Promise<boolean> {
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
    // RPC error — fail closed (deny the request)
    console.error('[rate-limit] anon RPC error:', error.message);
    return false;
  }

  return allowed === true;
}

export async function POST(req: NextRequest) {
  // 0. Request validation
  const reqError = validateRequest(req);
  if (reqError) return reqError;

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

  if (auth) {
    // Logged-in user: DAILY_LIMIT/day via Supabase RPC
    const allowed = await checkRateLimit(auth.userId, auth.token);
    if (!allowed) {
      logServerEvent('server_rate_limited', { kind: 'auth_daily', limit: DAILY_LIMIT }, { userId: auth.userId, path: '/api/llm' });
      return NextResponse.json(
        { error: `Today's free quota (${DAILY_LIMIT} calls) is used up. Enter your own API key in Settings for unlimited use.` },
        { status: 429 }
      );
    }
    // Also burn the anon quota for this IP so user can't strip auth and get extra calls
    await checkAnonRateLimit(ip);
  } else {
    // Anonymous: ANON_LIMIT/day per IP
    const allowed = await checkAnonRateLimit(ip);
    if (!allowed) {
      logServerEvent('server_rate_limited', { kind: 'anon_daily', limit: ANON_LIMIT }, { path: '/api/llm' });
      return NextResponse.json(
        { error: `Free trial quota exhausted. Log in to keep using up to ${DAILY_LIMIT} free calls per day!`, needsLogin: true },
        { status: 429 }
      );
    }
  }

  // 4. Validate input
  try {
    const body = await req.json();
    const { messages, system } = body;
    const maxTokens = normalizeMaxTokens(body.maxTokens);

    if (!validateSystemPrompt(system)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    if (!validateMessages(messages)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    const stream = body.stream === true;

    // Model routing: fast=Haiku (cheap/fast), default=Sonnet, strong=Sonnet
    const MODEL_MAP: Record<string, string> = {
      fast: 'claude-haiku-4-5-20251001',
      default: 'claude-sonnet-4-6',
      strong: 'claude-sonnet-4-6', // Note: using Opus here would raise costs significantly
    };
    const modelId = MODEL_MAP[body.model as string] || MODEL_MAP.default;

    if (stream) {
      const anthropicStream = client.messages.stream({
        model: modelId,
        max_tokens: maxTokens,
        system,
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
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          } catch (err) {
            // Log the real cause server-side — without this an Anthropic outage,
            // a 529 overload, and a code bug are indistinguishable in production.
            console.error('[api/llm] stream error:', err);
            if (!cancelled) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
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
      system,
      messages: messages as Anthropic.MessageParam[],
    });

    const block = response.content.find((b) => b.type === 'text');
    const res = NextResponse.json({ text: block ? block.text : '' });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    // Log the real cause server-side (provider error type / request id) so the
    // paid Anthropic path is observable; keep the client body generic.
    console.error('[api/llm] Anthropic call failed:', err);
    const status = (err as { status?: number })?.status;
    logServerEvent('server_llm_error', { message: String((err as Error)?.message || err).slice(0, 300), status }, { path: '/api/llm' });
    return NextResponse.json(
      { error: 'LLM call failed. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
