/**
 * Provider-agnostic LLM seam for the review pipeline (design doc §"모델 전략은
 * provider-agnostic이어야 한다"). The pipeline depends on this interface, not on
 * a concrete client — so tests inject a deterministic mock and the real app
 * routes through the existing /api/llm proxy. Argus's asset is the
 * lens/receipt pipeline, not which model runs it.
 */

import { callLLMJson, visionCapable, llmIdentityForProvenance, type FieldSchema, type LLMContentBlock } from '../llm';

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
  readonly model_provider: 'anthropic' | 'openai' | 'gemini' | 'local' | 'unknown';
}

/**
 * Default adapter: the webapp's LLM seam — 실제 라우팅은 설정이 정한다
 * (Anthropic 프록시 / OpenAI / Gemini / BYOK direct).
 *
 * provenance 를 getter 로 둔 이유: 예전엔 'claude-sonnet-4-6' 이 하드코딩돼
 * 있었는데 실제 기본 모델도, 사용자가 고른 제공자도 그게 아니었다 — 영수증의
 * 감사 필드가 실행되지 않은 모델을 기록했다. 지금은 호출 순간의 설정에서
 * 읽으므로 영수증에 남는 이름이 실제로 돈 (요청한) 모델과 같다.
 */
export const defaultReviewLLM: ReviewLLM = {
  get model_name() { return llmIdentityForProvenance().model_name; },
  get model_provider() { return llmIdentityForProvenance().model_provider; },
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
