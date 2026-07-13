import { resolveResponseLocale } from './surfaces.js';

export interface LocalizedCopy {
  en: string;
  ko: string;
}

/**
 * Resolve one user-facing MCP sentence with the same precedence used by tool
 * surfaces: explicit config first, then representative user text, then host
 * locale. Machine tokens, ids, enum values, and tool names remain unchanged.
 */
export function localizedMessage(
  argusDir: string | null | undefined,
  sample: string | null | undefined,
  copy: LocalizedCopy,
): string {
  return resolveResponseLocale(argusDir, sample) === 'ko' ? copy.ko : copy.en;
}

/** Pair a localized error message with its actionable recovery sentence. */
export function localizedErrorCopy(
  argusDir: string | null | undefined,
  sample: string | null | undefined,
  copy: { en: { message: string; recovery?: string }; ko: { message: string; recovery?: string } },
): { message: string; recovery?: string } {
  return resolveResponseLocale(argusDir, sample) === 'ko' ? copy.ko : copy.en;
}
