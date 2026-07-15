import { NextRequest, NextResponse } from 'next/server';
import { validateOrigin, validateContentType, validateContentLength } from '@/lib/api-security';

/**
 * Shared LLM request validation — used by all /api/llm/* routes.
 */

// 8192 (was 4096): the final draft/mix is a full multi-section document that
// legitimately needs more than 4096 output tokens. At 4096 the document JSON
// truncated mid-structure → "JSON 파싱 실패" after minutes of streaming. Only
// calls that REQUEST >4096 (runMix / runFinalDeliverable) are affected; every
// other call requests ≤4000, so their cost is unchanged. Sonnet supports well
// beyond 8192 output, so this is safe model-side.
export const MAX_TOKENS_CAP = 8192;
export const MAX_MESSAGE_LENGTH = 50_000;
// The initial-analysis system prompt (buildInitialAnalysisPrompt) is legitimately
// ~13k chars after the R36–R60 STEP-0 / BREADTH gate accumulation — the 10k cap
// was silently rejecting EVERY initial analysis with a 400 "Invalid request"
// (the buffered run failed → "분석에 실패했어요" every time). 24k covers the real
// prompts with headroom; messages already allow 50k each, so this is not a new
// abuse vector.
export const MAX_SYSTEM_LENGTH = 24_000;
export const MAX_MESSAGES = 20;
export const MAX_TOTAL_BODY = 500_000;
const VALID_ROLES = new Set(['user', 'assistant']);

// Vision/document path (review pipeline). A message's content may be an array of
// Anthropic-shaped blocks (text/image/document) instead of a string. These caps
// bound the binary payload so a malformed or hostile request can't exhaust the
// serverless function's memory/timeout — the base64 image/PDF budget is separate
// from and stricter than the text body budget.
export const MAX_BLOCKS_PER_MESSAGE = 110;     // a long scanned PDF rendered to page images + text
export const MAX_IMAGE_BLOCKS = 100;           // per whole request (Anthropic's own page ceiling)
export const MAX_BINARY_BYTES_PER_BLOCK = 6_000_000;   // ~6 MB decoded per image/PDF
export const MAX_BINARY_BYTES_TOTAL = 24_000_000;      // ~24 MB decoded (the ~4.4MB body cap binds first)
const IMAGE_MEDIA = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** Decoded byte size of a base64 string (≈ len * 3/4, minus padding). */
function base64Bytes(data: string): number {
  const len = data.length;
  const pad = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - pad;
}

/** Accumulator so caps span the whole request, not just one message. */
interface SizeAcc { text: number; binary: number; images: number }

/** Validate one message's block-array content. Mutates `acc` with running totals. */
function validateContentBlocks(content: unknown[], acc: SizeAcc): boolean {
  if (content.length === 0 || content.length > MAX_BLOCKS_PER_MESSAGE) return false;
  for (const block of content) {
    if (typeof block !== 'object' || block === null) return false;
    const type = (block as { type?: unknown }).type;
    if (type === 'text') {
      const t = (block as { text?: unknown }).text;
      if (typeof t !== 'string') return false;
      acc.text += t.length;
    } else if (type === 'image' || type === 'document') {
      const src = (block as { source?: unknown }).source as { type?: unknown; media_type?: unknown; data?: unknown } | undefined;
      if (!src || src.type !== 'base64' || typeof src.data !== 'string' || typeof src.media_type !== 'string') return false;
      if (type === 'image') {
        if (!IMAGE_MEDIA.has(src.media_type)) return false;
        acc.images += 1;
      } else if (src.media_type !== 'application/pdf') {
        return false;
      }
      const bytes = base64Bytes(src.data);
      if (bytes <= 0 || bytes > MAX_BINARY_BYTES_PER_BLOCK) return false;
      acc.binary += bytes;
    } else {
      return false; // unknown block type — reject rather than forward
    }
    if (acc.text > MAX_TOTAL_BODY || acc.binary > MAX_BINARY_BYTES_TOTAL || acc.images > MAX_IMAGE_BLOCKS) return false;
  }
  return true;
}

/** Validate messages array structure and size limits. Content may be a plain
 *  string (the common case) or an array of text/image/document blocks (vision). */
export function validateMessages(messages: unknown): messages is Array<{ role: string; content: unknown }> {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  const acc: SizeAcc = { text: 0, binary: 0, images: 0 };
  return messages.every(
    (m: unknown) => {
      if (typeof m !== 'object' || m === null) return false;
      if (!('role' in m) || !VALID_ROLES.has((m as { role: unknown }).role as string)) return false;
      if (!('content' in m)) return false;
      const content = (m as { content: unknown }).content;
      if (typeof content === 'string') {
        if (content.length > MAX_MESSAGE_LENGTH) return false;
        acc.text += content.length;
        return acc.text <= MAX_TOTAL_BODY;
      }
      if (Array.isArray(content)) return validateContentBlocks(content, acc);
      return false;
    }
  );
}

/** Normalize maxTokens with cap. */
export function normalizeMaxTokens(raw?: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 2000;
  return Math.min(Math.floor(value), MAX_TOKENS_CAP);
}

/** Validate system prompt string (undefined is allowed — SDKs treat it as optional). */
export function validateSystemPrompt(system: unknown): system is string | undefined {
  if (system === undefined) return true;
  return typeof system === 'string' && system.length <= MAX_SYSTEM_LENGTH;
}

/** Validate API key format by provider. */
export function validateApiKey(
  apiKey: unknown,
  provider: 'anthropic' | 'openai' | 'gemini',
): { valid: true } | { valid: false; error: string } {
  if (typeof apiKey !== 'string' || apiKey.length < 20 || apiKey.length > 200) {
    const labels = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Google AI' };
    return { valid: false, error: `유효한 ${labels[provider]} API 키가 아닙니다.` };
  }
  const prefixes: Record<string, string | null> = {
    anthropic: 'sk-ant-',
    openai: 'sk-',
    gemini: null,
  };
  const prefix = prefixes[provider];
  if (prefix && !apiKey.startsWith(prefix)) {
    const labels = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Google AI' };
    return { valid: false, error: `유효한 ${labels[provider]} API 키가 아닙니다.` };
  }
  return { valid: true };
}

/** Body ceiling for the LLM routes — larger than the shared 500KB default so the
 *  opt-in vision path can carry a base64 PDF / rendered deck pages, but under the
 *  serverless platform's own ~4.5MB request limit. */
export const MAX_LLM_BODY_BYTES = 4_400_000;

/**
 * Run common request validation (content-type, size, origin). `maxBytes`
 * overrides the size ceiling (the LLM routes pass MAX_LLM_BODY_BYTES for vision).
 */
export function validateRequest(req: NextRequest, maxBytes?: number): NextResponse | null {
  return validateContentType(req) || validateContentLength(req, maxBytes) || validateOrigin(req) || null;
}
