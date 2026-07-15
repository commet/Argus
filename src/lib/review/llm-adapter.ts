/**
 * Provider-agnostic LLM seam for the review pipeline (design doc §"모델 전략은
 * provider-agnostic이어야 한다"). The pipeline depends on this interface, not on
 * a concrete client — so tests inject a deterministic mock and the real app
 * routes through the existing /api/llm proxy. Argus's asset is the
 * lens/receipt pipeline, not which model runs it.
 */

import { callLLMJson, visionCapable, type FieldSchema, type LLMContentBlock } from '../llm';

// Mirrors the (non-exported) SchemaFieldType in ../llm.
type SchemaFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface ReviewLLMArgs {
  system: string;
  user: string;
  shape?: Record<string, SchemaFieldType | FieldSchema>;
  maxTokens?: number;
  model?: 'fast' | 'default' | 'strong';
  signal?: AbortSignal;
  /** Vision/document blocks (rendered PDF pages / a whole PDF / deck images).
   *  Placed BEFORE the text per Anthropic's image-first best practice. Ignored
   *  on providers that can't take them (OpenAI/Gemini) — the text still carries
   *  the extracted content, so the call degrades to text-only rather than fails. */
  attachments?: LLMContentBlock[];
}

export interface ReviewLLM {
  json<T = Record<string, unknown>>(args: ReviewLLMArgs): Promise<T>;
  /** identifies the model for provenance. */
  readonly model_name: string;
  readonly model_provider: 'anthropic' | 'openai' | 'local' | 'unknown';
}

/** Default adapter: the webapp's authenticated proxy (Anthropic via /api/llm). */
export const defaultReviewLLM: ReviewLLM = {
  model_name: 'claude-sonnet-4-6',
  model_provider: 'anthropic',
  json<T = Record<string, unknown>>(args: ReviewLLMArgs): Promise<T> {
    const useAttachments = !!args.attachments?.length && visionCapable();
    const content = useAttachments
      ? [...args.attachments!, { type: 'text' as const, text: args.user }]
      : args.user;
    return callLLMJson<T>([{ role: 'user', content }], {
      system: args.system,
      shape: args.shape,
      maxTokens: args.maxTokens ?? 4000,
      model: args.model ?? 'default',
      signal: args.signal,
      parseRetries: 2,
    });
  },
};
