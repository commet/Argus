/**
 * Server-side LLM call for server contexts that can't use the browser
 * callLLM* helpers (e.g. the Telegram bot webhook). Uses the same Anthropic key
 * and model routing as /api/llm so cost/behavior stay consistent — the bot just
 * doesn't go through the browser-oriented auth/quota path; its own caller gates
 * abuse (connected-users-only + per-user daily cap).
 */
import Anthropic from '@anthropic-ai/sdk';

/**
 * Model candidates per tier, tried newest→safest. Pinned IDs drift as Anthropic
 * deprecates models (the webapp's old map 404'd on this key), so each tier ends
 * with a stable `-latest` alias that any account can resolve — the bot always
 * gets SOME working model instead of dying on a stale pin.
 */
const MODEL_CANDIDATES: Record<string, string[]> = {
  fast: ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-latest'],
  default: ['claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-3-5-sonnet-latest'],
  strong: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-3-5-sonnet-latest'],
};

export async function callAnthropicText(opts: {
  system: string;
  user: string;
  model?: 'fast' | 'default' | 'strong';
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey });
  const candidates = MODEL_CANDIDATES[opts.model ?? 'default'] ?? MODEL_CANDIDATES.default;

  let lastErr: unknown;
  for (const model of candidates) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 1200,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      });
      const block = resp.content.find((b) => b.type === 'text');
      return block && block.type === 'text' ? block.text : '';
    } catch (err) {
      lastErr = err;
      // Only fall through when this specific model is unavailable; real failures
      // (auth, overload, rate) should surface immediately.
      const status = (err as { status?: number })?.status;
      if (status === 404) continue;
      throw err;
    }
  }
  throw lastErr;
}
