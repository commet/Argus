import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateMessages, validateSystemPrompt, validateApiKey, validateRequest, normalizeMaxTokens } from '@/lib/llm-validation';

/**
 * Direct mode endpoint — uses the user's own API key (sent from client).
 * No rate limiting (user pays their own bill).
 * No auth required (the API key itself is the credential).
 * The key is only used server-side and never stored.
 */
export async function POST(req: NextRequest) {
  const reqError = validateRequest(req);
  if (reqError) return reqError;

  try {
    const body = await req.json();
    const { apiKey, messages, system } = body;
    const maxTokens = normalizeMaxTokens(body.maxTokens);

    const keyCheck = validateApiKey(apiKey, 'anthropic');
    if (!keyCheck.valid) return NextResponse.json({ error: keyCheck.error }, { status: 400 });
    if (!validateSystemPrompt(system)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    if (!validateMessages(messages)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

    const client = new Anthropic({ apiKey });
    const stream = body.stream === true;

    const MODEL_MAP: Record<string, string> = {
      fast: 'claude-haiku-4-5-20251001',
      default: 'claude-sonnet-4-6',
      strong: 'claude-sonnet-4-6',
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
          } catch {
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
    console.error('[api/llm/direct] Anthropic call failed:', err);
    return NextResponse.json(
      { error: 'LLM call failed. Please check your API key.' },
      { status: 500 }
    );
  }
}
