import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { validateMessages, validateSystemPrompt, validateApiKey, validateRequest, normalizeMaxTokens } from '@/lib/llm-validation';

const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']);
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Gemini direct mode endpoint — uses the user's own Google AI API key.
 * No rate limiting (user pays their own bill).
 */
export async function POST(req: NextRequest) {
  const reqError = validateRequest(req);
  if (reqError) return reqError;

  try {
    const body = await req.json();
    const { apiKey, messages, system } = body;
    const maxTokens = normalizeMaxTokens(body.maxTokens);

    const keyCheck = validateApiKey(apiKey, 'gemini');
    if (!keyCheck.valid) return NextResponse.json({ error: keyCheck.error }, { status: 400 });
    if (!validateSystemPrompt(system)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    if (!validateMessages(messages)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    // Gemini here is the text-only path — attachment blocks (vision/document) are
    // Anthropic-only and must never reach it. Reject non-string content.
    const textMessages = messages as Array<{ role: string; content: unknown }>;
    if (textMessages.some((m) => typeof m.content !== 'string')) {
      return NextResponse.json({ error: 'Attachments are not supported on this provider.' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;

    // Convert to Gemini content format
    const geminiContents = textMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content as string }],
    }));

    const stream = body.stream === true;

    if (stream) {
      const abortController = new AbortController();
      const geminiStream = await ai.models.generateContentStream({
        model: modelId,
        config: { maxOutputTokens: maxTokens, systemInstruction: system, abortSignal: abortController.signal },
        contents: geminiContents,
      });

      const encoder = new TextEncoder();
      let cancelled = false;
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of geminiStream) {
              if (cancelled) break;
              const text = chunk.text;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
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
          abortController.abort();
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
    const response = await ai.models.generateContent({
      model: modelId,
      config: { maxOutputTokens: maxTokens, systemInstruction: system },
      contents: geminiContents,
    });

    const text = response.text ?? '';
    const res = NextResponse.json({ text });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Gemini call failed. Please check your API key.' },
      { status: 500 }
    );
  }
}
