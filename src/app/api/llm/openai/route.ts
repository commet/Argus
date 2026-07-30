import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { validateMessages, validateSystemPrompt, validateApiKey, validateRequest, normalizeMaxTokens } from '@/lib/llm-validation';

const ALLOWED_MODELS = new Set(['gpt-5.6', 'gpt-5.6-terra', 'gpt-5.6-luna']);
const DEFAULT_MODEL = 'gpt-5.6-terra';

/**
 * OpenAI direct mode endpoint — uses the user's own OpenAI API key.
 * No rate limiting (user pays their own bill).
 */
export async function POST(req: NextRequest) {
  const reqError = validateRequest(req);
  if (reqError) return reqError;

  try {
    const body = await req.json();
    const { apiKey, messages, system } = body;
    const maxTokens = normalizeMaxTokens(body.maxTokens);

    const keyCheck = validateApiKey(apiKey, 'openai');
    if (!keyCheck.valid) return NextResponse.json({ error: keyCheck.error }, { status: 400 });
    if (!validateSystemPrompt(system)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    if (!validateMessages(messages)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    // OpenAI here is the text-only path — attachment blocks (vision/document) are
    // Anthropic-only and must never reach it. Reject non-string content.
    const textMessages = messages as Array<{ role: string; content: unknown }>;
    if (textMessages.some((m) => typeof m.content !== 'string')) {
      return NextResponse.json({ error: 'Attachments are not supported on this provider.' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const stream = body.stream === true;
    const modelId = ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;

    // Convert to OpenAI message format: system prompt as first message (skip if absent)
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      ...textMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
      })),
    ];

    const tokenBudget = { max_completion_tokens: maxTokens };

    if (stream) {
      const openaiStream = await client.chat.completions.create({
        model: modelId,
        ...tokenBudget,
        messages: openaiMessages,
        stream: true,
      });

      const encoder = new TextEncoder();
      const controller_ref = { aborted: false };
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of openaiStream) {
              if (controller_ref.aborted) break;
              const text = chunk.choices[0]?.delta?.content;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            }
            if (!controller_ref.aborted) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          } catch {
            if (!controller_ref.aborted) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
              controller.close();
            }
          }
        },
        cancel() {
          controller_ref.aborted = true;
          openaiStream.controller.abort();
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
    const response = await client.chat.completions.create({
      model: modelId,
      ...tokenBudget,
      messages: openaiMessages,
    });

    const text = response.choices[0]?.message?.content ?? '';
    const res = NextResponse.json({ text });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch {
    return NextResponse.json(
      { error: 'OpenAI call failed. Please check your API key.' },
      { status: 500 }
    );
  }
}
