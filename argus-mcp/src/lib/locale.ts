import fs from 'fs';
import { detect } from 'tinyld/light';
import { configPath } from './layout.js';

export type Locale = 'ko' | 'en';

/**
 * detectLocale — CONFIG/ENV detection seeded at argus_init write time.
 *
 * Chain (write-time): explicit config > env (LANG/LC_ALL) > Intl > 'en'.
 * The runtime input-text step lives in resolveResponseLocale (surfaces.ts),
 * which layers text detection on TOP of a persisted config. This function
 * stays env-only so a fresh dir on a KST machine seeds locale:ko once.
 */
export function detectLocale(argusDir: string): Locale {
  try {
    const cfg = fs.readFileSync(configPath(argusDir), 'utf8');
    const m = cfg.match(/^locale:\s*(ko|en)\b/m);
    if (m) return m[1] as Locale;
  } catch { /* no config */ }
  const env = process.env['LANG'] || process.env['LC_ALL'] || '';
  if (/^ko/i.test(env)) return 'ko';
  try {
    if (/^ko/i.test(Intl.DateTimeFormat().resolvedOptions().locale)) return 'ko';
  } catch { /* Intl unavailable */ }
  return 'en';
}

/**
 * detectLocaleFromText — the runtime language sniff (M4, spec §4).
 *
 * Argus targets exactly two locales, ko and en. Korean is written in Hangul,
 * a distinct, unambiguous Unicode block — so a Hangul PRESENCE check is 100%
 * precise for the ko side and needs no statistics. `tinyld/light` (the ~70KB
 * pure-JS n-gram profile; NO native binding, ships in the published tarball)
 * is the mature-library secondary signal the spec calls for — but on SHORT
 * strings its statistical guess misfires ("base rate stays at 3.5%" → 'no',
 * "downtime < 5 min" → 'pl'), so for our binary ko/en decision the reliable
 * rule is: any Hangul ⇒ ko, else ⇒ en. tinyld is consulted only to promote a
 * Hangul-free string to 'ko' if it somehow reads Korean (it never does for
 * Latin text) — a belt-and-suspenders that never overrides the script check.
 *
 * Returns null on empty/too-short/ambiguous input so the caller can fall
 * through to config/env — a low-confidence guess must never win.
 */
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

export function detectLocaleFromText(text?: string | null): Locale | null {
  if (!text) return null;
  const t = text.trim();
  if (t.length < 2) return null;
  // Script check dominates: Hangul is unambiguous and short-text-safe.
  if (HANGUL.test(t)) return 'ko';
  // No Hangul. Consult tinyld only to catch a would-be Korean romanization;
  // in practice Latin text returns a non-ko guess, so this stays 'en'.
  try {
    if (detect(t) === 'ko') return 'ko';
  } catch { /* detector unavailable → script check already ruled */ }
  return 'en';
}
