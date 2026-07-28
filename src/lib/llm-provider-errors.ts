export const PROVIDER_CREDITS_REQUIRED = 'PROVIDER_CREDITS_REQUIRED';

export type PublicProviderFailure = {
  code: typeof PROVIDER_CREDITS_REQUIRED | 'PROVIDER_ERROR';
  error: string;
  retryable: boolean;
  status: number;
  upstreamStatus?: number;
};

function providerMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const value = error as {
    message?: unknown;
    error?: { error?: { message?: unknown } | unknown } | unknown;
  };
  const nested = (
    value.error
    && typeof value.error === 'object'
    && 'error' in value.error
    && value.error.error
    && typeof value.error.error === 'object'
    && 'message' in value.error.error
  )
    ? value.error.error.message
    : undefined;
  return typeof nested === 'string'
    ? nested
    : typeof value.message === 'string'
      ? value.message
      : String(error);
}

/**
 * Convert provider failures into a small, non-secret public contract.
 * Billing exhaustion is operationally terminal: retrying cannot fix it and
 * would only spend the user's time (and another Argus quota reservation).
 */
export function classifyProviderFailure(error: unknown): PublicProviderFailure {
  const upstreamStatus = (
    error
    && typeof error === 'object'
    && 'status' in error
    && typeof error.status === 'number'
  ) ? error.status : undefined;
  const message = providerMessage(error);
  const creditsRequired = /credit balance|purchase credits|billing credits?/i.test(message);

  if (creditsRequired) {
    return {
      code: PROVIDER_CREDITS_REQUIRED,
      error: 'The analysis service is temporarily unavailable.',
      retryable: false,
      status: 503,
      upstreamStatus,
    };
  }

  return {
    code: 'PROVIDER_ERROR',
    error: 'LLM call failed. Please try again in a moment.',
    retryable: upstreamStatus === 429 || upstreamStatus === 529 || (upstreamStatus !== undefined && upstreamStatus >= 500),
    status: 500,
    upstreamStatus,
  };
}
