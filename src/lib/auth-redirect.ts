const REDIRECT_BASE = 'https://argus.invalid';

/** Normalize a post-auth destination to a same-origin path. */
export function safePostAuthRedirect(value: string | null | undefined, fallback = '/workspace'): string {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const target = new URL(value, REDIRECT_BASE);
    if (target.origin !== REDIRECT_BASE || !value.startsWith('/') || value.startsWith('//')) return fallback;
    const destination = `${target.pathname}${target.search}${target.hash}`;
    if (/^\/(?:en|ko)?\/?(?:login|auth\/callback)(?:\/|$|\?|#)/.test(destination)) return fallback;
    return destination;
  } catch {
    return fallback;
  }
}
