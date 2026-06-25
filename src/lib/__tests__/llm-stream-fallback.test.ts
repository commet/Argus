/**
 * callLLMStreamThenParse — truncation safety net.
 *
 * The stream-then-parse pattern (used by every progressive deepening/mix call)
 * parses the streamed text at the end. If that text is a truncated JSON — the
 * exact round-3 failure — it used to reject straight to the user as
 * "JSON 파싱 실패". This proves the fallback: an unparseable stream now degrades
 * to ONE clean non-streaming retry instead of a user-facing error, while a
 * genuinely fatal error (auth) still surfaces unchanged.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn((_key: string, fallback: unknown) => fallback), // default settings → anthropic/proxy
  setStorage: vi.fn(),
  STORAGE_KEYS: { SETTINGS: 'sot_settings' },
}));
vi.mock('@/lib/db', () => ({ insertToSupabase: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) } },
}));

import { callLLMStreamThenParse, LLMError } from '@/lib/llm';

const enc = new TextEncoder();
function sseResponse(textChunks: string[]): Response {
  const body = new ReadableStream({
    start(controller) {
      for (const c of textChunks) controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: c })}\n\n`));
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('callLLMStreamThenParse falls back when the stream is unparseable', () => {
  it('recovers a TRUNCATED stream via one clean non-streaming retry (no user-facing parse error)', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call === 1) {
        // The stream truncates mid-JSON — no closing brace, every parseJSON
        // recovery strategy fails → this is the round-3 failure shape.
        return sseResponse(['{"insight": "the plan was cut off here']);
      }
      // The fallback callLLMJson re-fetches non-streaming and gets valid JSON.
      return new Response(JSON.stringify({ text: '{"insight":"recovered","ready_for_mix":false}' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    const result = await callLLMStreamThenParse<{ insight: string }>(
      [{ role: 'user', content: 'hi' }],
      { system: 'sys' },
      (t) => tokens.push(t),
    );

    expect(result.insight).toBe('recovered');     // the fallback result, not the truncated stream
    expect(call).toBe(2);                           // streamed once, then retried once
    expect(tokens.length).toBeGreaterThan(0);       // the live stream UX still ran
  });

  it('does NOT fall back on a fatal (auth) error — it surfaces unchanged', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callLLMStreamThenParse([{ role: 'user', content: 'hi' }], { system: 'sys' }, () => {}),
    ).rejects.toBeInstanceOf(LLMError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry on auth
  });
});
