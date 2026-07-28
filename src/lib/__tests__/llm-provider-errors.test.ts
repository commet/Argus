import { describe, expect, it } from 'vitest';
import { classifyProviderFailure, PROVIDER_CREDITS_REQUIRED } from '@/lib/llm-provider-errors';

describe('classifyProviderFailure', () => {
  it('marks exhausted provider credits as a terminal service outage', () => {
    const failure = classifyProviderFailure({
      status: 400,
      error: {
        error: {
          message: 'Your credit balance is too low to access the API. Please purchase credits.',
        },
      },
    });

    expect(failure).toEqual({
      code: PROVIDER_CREDITS_REQUIRED,
      error: 'The analysis service is temporarily unavailable.',
      retryable: false,
      status: 503,
      upstreamStatus: 400,
    });
  });

  it('does not expose an unknown upstream error message', () => {
    const failure = classifyProviderFailure(new Error('secret provider detail'));

    expect(failure.code).toBe('PROVIDER_ERROR');
    expect(failure.error).not.toContain('secret provider detail');
    expect(failure.retryable).toBe(false);
  });
});
