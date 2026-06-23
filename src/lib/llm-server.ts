/**
 * Server-side LLM call for server contexts that can't use the browser
 * callLLM* helpers (e.g. the Telegram bot webhook). Uses the same Anthropic key
 * and model routing as /api/llm so cost/behavior stay consistent — the bot just
 * doesn't go through the browser-oriented auth/quota path; its own caller gates
 * abuse (connected-users-only + per-user daily cap).
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL_MAP: Record<string, string> = {
  fast: 'claude-haiku-4-5-20251001',
  default: 'claude-sonnet-4-20250514',
  strong: 'claude-sonnet-4-20250514',
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
  const resp = await client.messages.create({
    model: MODEL_MAP[opts.model ?? 'default'] ?? MODEL_MAP.default,
    max_tokens: opts.maxTokens ?? 1200,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });

  const block = resp.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}
