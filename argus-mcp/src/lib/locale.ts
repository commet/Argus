import fs from 'fs';
import { detect } from 'tinyld/light';
import { configPath } from './layout.js';

export type Locale = 'ko' | 'en';

/** The user-authored text fields worth sniffing for the session's language.
 *  Incidental fields (ids, notes on machine actions) are excluded so a stray
 *  token can't flip a session. */
const CONTENT_FIELDS = [
  'decision', 'predicate', 'what_happened', 'finding', 'text', 'question',
  'human_judgment', 'observation_text', 'statement', 'review_question',
] as const;

/**
 * Persist a Korean locale the FIRST time the user's own words are Korean, so the
 * whole session stays Korean — including later surfaces with no text to sniff
 * (validation errors, recall, check_in). This is content-driven, never env:
 *   - only a POSITIVE Korean content signal ever writes (English never pins);
 *   - never overrides an explicit locale already in config.
 * Fixes mid-session English leaks on a Korean session (2026-07-14 locale sweep).
 */
export function learnLocaleFromContent(argusDir: string | null | undefined, args: Record<string, unknown>): void {
  if (!argusDir) return;
  if (contentLocaleFromArgs(args) !== 'ko') return;
  try {
    const p = configPath(argusDir);
    let cfg = '';
    try { cfg = fs.readFileSync(p, 'utf8'); } catch { /* no config yet → auto-init writes one before the handler returns */ }
    if (/^locale:\s*(ko|en)\b/m.test(cfg)) return; // explicit locale already set — never override
    const next = cfg
      ? `${cfg.endsWith('\n') ? cfg : `${cfg}\n`}locale: ko\n`
      : 'schema_version: 5\nlocale: ko\n';
    fs.writeFileSync(p, next);
  } catch { /* best-effort: a failed persist just means the next Korean surface re-sniffs from content */ }
}

/** The language the user is ACTUALLY speaking in this call, judged only from
 *  their own content fields (never ids/env). Null when there is no confident
 *  signal. Shared by learnLocaleFromContent (pins ko on a fresh config) and
 *  the locale-mismatch once-note (§9.7 O1 — a pinned config that contradicts
 *  the conversation language must be surfaced once, not silently obeyed
 *  forever: the 2026-06-15 locale:en contamination stayed invisible for a
 *  month precisely because nothing ever said "your config disagrees with
 *  your words"). */
export function contentLocaleFromArgs(args: Record<string, unknown>): Locale | null {
  const parts = CONTENT_FIELDS
    .map((k) => args[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  // User-authored words also arrive NESTED: a premises op=add call carries
  // them only in premises[].text, invisible to the flat sample above — so a
  // Korean add-premises call was answered in English until a later flat-field
  // call re-taught the session (content battery S06, 2026-07-27).
  const prems = args['premises'];
  if (Array.isArray(prems)) {
    for (const p of prems) {
      const t = (p as Record<string, unknown> | null)?.['text'];
      if (typeof t === 'string' && t.trim().length > 0) parts.push(t);
    }
  }
  const sample = parts.join('\n');
  return sample ? detectLocaleFromText(sample) : null;
}

/**
 * osLocaleHint — THE one OS-environment locale probe (§9.7 O1 방1: one env
 * resolver, consumed by every locale chain).
 *
 * Until 2026-07-16 this env→Intl chain lived in two copies (detectLocale here,
 * resolveResponseLocale in surfaces.ts) and both treated env as a KO-DETECTOR
 * ONLY: `LANG=en_US` didn't pin en — the chain fell through to Intl and a
 * Korean-locale OS still resolved ko. That asymmetry is why the release suite
 * was machine-dependent (4 reds on a ko OS; overhaul review §10) and why an
 * explicit English env could never assert itself.
 *
 * Rule: a NON-EMPTY LANG/LC_ALL names the user's working language explicitly —
 * ko iff it starts with ko, else en (Argus is binary ko/en). Only an EMPTY env
 * falls through to the OS Intl locale. Explicit config wins ABOVE this at
 * every call site, and Korean CONTENT re-claims ko later regardless (the text
 * step / learnLocaleFromContent) — so an en hint never locks a Korean user out.
 */
export function osLocaleHint(): Locale {
  const env = process.env['LANG'] || process.env['LC_ALL'] || '';
  if (env) return /^ko/i.test(env) ? 'ko' : 'en';
  try {
    if (/^ko/i.test(Intl.DateTimeFormat().resolvedOptions().locale)) return 'ko';
  } catch { /* Intl unavailable */ }
  return 'en';
}

/**
 * detectLocale — CONFIG/ENV detection seeded at argus_init write time.
 *
 * Chain (write-time): explicit config > osLocaleHint (env, then Intl) > 'en'.
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
  return osLocaleHint();
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
