import { describe, it, expect } from 'vitest';
import { runDocumentReview } from '../pipeline';
import { ingest } from '../ingest';
import { LLMError } from '@/lib/llm';
import type { ReviewLLM } from '../llm-adapter';

const throwingLLM = (err: unknown): ReviewLLM => ({
  json: async () => { throw err; },
});

const art = () => ingest({ source_kind: 'paste', text: 'We will double marketing spend based on a 4.2% conversion assumption. '.repeat(3), locale: 'en' });

describe('runDocumentReview — error localization (locale-aware failure messages)', () => {
  it('login-required (429 needsLogin) → EN message, no LOGIN_REQUIRED prefix leak', async () => {
    const err = new LLMError('LOGIN_REQUIRED:무료 체험을 모두 사용했습니다. 로그인하면 하루 50회까지 무료로 사용할 수 있어요.', { category: 'auth', status: 429 });
    const { job } = await runDocumentReview(art(), { llm: throwingLLM(err), today: '2026-07-01', locale: 'en' });
    expect(job.status).toBe('failed');
    expect(job.error!.message).not.toContain('LOGIN_REQUIRED');
    expect(/[가-힣]/.test(job.error!.message)).toBe(false);
    expect(/[가-힣]/.test(job.error!.recovery)).toBe(false);
    expect(job.error!.message).toContain('free trial');
  });

  it('rate_limit → EN i18n message', async () => {
    const err = new LLMError('요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.', { category: 'rate_limit', status: 429, retryable: true });
    const { job } = await runDocumentReview(art(), { llm: throwingLLM(err), today: '2026-07-01', locale: 'en' });
    expect(job.status).toBe('failed');
    expect(/[가-힣]/.test(job.error!.message)).toBe(false);
    expect(job.error!.message).toContain('Request limit');
  });

  it('KO locale still Korean', async () => {
    const err = new LLMError('LOGIN_REQUIRED:...', { category: 'auth', status: 429 });
    const { job } = await runDocumentReview(art(), { llm: throwingLLM(err), today: '2026-07-01', locale: 'ko' });
    expect(/[가-힣]/.test(job.error!.message)).toBe(true);
    expect(job.error!.message).not.toContain('LOGIN_REQUIRED');
  });
});
