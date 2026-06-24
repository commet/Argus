import { NextRequest, NextResponse } from 'next/server';
import { validateOrigin, validateContentType, validateContentLength } from '@/lib/api-security';

/**
 * Shared LLM request validation — used by all /api/llm/* routes.
 */

// 64K — sonnet-4-6 / haiku-4-5 streaming output ceiling. Raised from 4096 so the
// stream-path adaptive budget + truncation retry (callLLMStreamThenParse) can
// actually request more on a max_tokens cutoff; at 4096 the engine's 4000-token
// calls were already at the ceiling and any 1.5× retry was silently clamped to ~+2%.
// Keep STREAM_MAX_TOKENS_CAP in src/lib/llm.ts in sync (client can't import this
// server-only module).
export const MAX_TOKENS_CAP = 64_000;
export const MAX_MESSAGE_LENGTH = 50_000;
export const MAX_SYSTEM_LENGTH = 10_000;
export const MAX_MESSAGES = 20;
export const MAX_TOTAL_BODY = 500_000;
const VALID_ROLES = new Set(['user', 'assistant']);

/** Validate messages array structure and size limits. */
export function validateMessages(messages: unknown): messages is Array<{ role: string; content: string }> {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  let totalSize = 0;
  return messages.every(
    (m: unknown) => {
      if (typeof m !== 'object' || m === null) return false;
      if (!('role' in m) || !VALID_ROLES.has((m as { role: unknown }).role as string)) return false;
      if (!('content' in m) || typeof (m as { content: unknown }).content !== 'string') return false;
      const content = (m as { content: string }).content;
      if (content.length > MAX_MESSAGE_LENGTH) return false;
      totalSize += content.length;
      return totalSize <= MAX_TOTAL_BODY;
    }
  );
}

/** Normalize maxTokens with cap. */
export function normalizeMaxTokens(raw?: unknown): number {
  return Math.min(Number(raw) || 2000, MAX_TOKENS_CAP);
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

/**
 * Run common request validation (content-type, size, origin).
 * Returns error response if any check fails, null if all pass.
 */
export function validateRequest(req: NextRequest): NextResponse | null {
  return validateContentType(req) || validateContentLength(req) || validateOrigin(req) || null;
}
