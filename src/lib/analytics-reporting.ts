export type AnalyticsSignalKind = 'operational_error' | 'guardrail' | 'none';

const OPERATIONAL_ERROR_EVENTS = new Set([
  'error',
  'unhandled_error',
  'unhandled_rejection',
  'llm_error',
  'server_llm_error',
  'workspace_start_error',
  'review_timeout',
  'review_failed',
]);

const GUARDRAIL_EVENTS = new Set([
  'server_rate_limited',
  'server_captcha_rejected',
]);

/** Separate real product failures from expected quota and abuse controls. */
export function classifyAnalyticsSignal(
  eventName: string,
  properties: Record<string, unknown> | null,
): AnalyticsSignalKind {
  if (GUARDRAIL_EVENTS.has(eventName)) return 'guardrail';

  // The server emits the authoritative guardrail event for these same 429s.
  // Ignoring the client companion prevents one blocked request counting twice.
  if (eventName === 'llm_error' && properties?.status === 429) return 'none';
  if (
    eventName === 'workspace_start_error'
    && (properties?.is_rate_limit === true || properties?.needs_login === true)
  ) return 'none';

  return OPERATIONAL_ERROR_EVENTS.has(eventName) ? 'operational_error' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// Traffic classification (anonymous-visit sensor)
//
// Why this lives here and not inline in the cron route: the daily report used to
// count *every* external session as a person, so referrer-spam bots and the
// founder's own anonymous QA sweeps inflated the top line — "traffic" that never
// corresponded to a real visitor. These are pure, unit-tested functions so the
// human / bot / internal split can't silently drift. Nothing is dropped without
// a rule you can read here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Referrer-spam / fake-search-engine hosts. These crawlers forge a Referer header
 * to farm backlinks; they are never real acquisition. Match is exact host or a
 * subdomain (`www.excite.com` matches `excite.com`). Extend as new ones appear.
 */
export const SPAM_REFERRER_HOSTS = [
  'excite.com',
  'jabse.com',
  'panjoy.com',
  'searchhippo.com',
  'roysearch.com',
  'cluuz.com',
  'cosmoage.com',
  'simplyhired.com',
  'semalt.com',
  'darodar.com',
  'ilovevitaly.com',
  'buttons-for-website.com',
  'social-buttons.com',
  'free-share-buttons.com',
  'best-seo-offer.com',
  'trafficmonetize.org',
  'webmonetizer.net',
  'get-free-traffic-now.com',
  'success-seo.com',
  'event-tracking.com',
  'goodsearch.com',
  'fuzzfind.com',
] as const;

/** Bare hostname from a referrer URL (protocol + path stripped, lowercased). */
export function referrerHost(referrer: string | null | undefined): string {
  if (!referrer) return '';
  return referrer
    .replace(/^https?:\/\//, '')
    .replace(/^android-app:\/\//, '')
    .split('/')[0]
    .toLowerCase()
    .trim();
}

/** True when a referrer belongs to a known referrer-spam / crawler domain. */
export function isSpamReferrer(referrer: string | null | undefined): boolean {
  const host = referrerHost(referrer);
  if (!host) return false;
  return SPAM_REFERRER_HOSTS.some(d => host === d || host.endsWith(`.${d}`));
}

/**
 * Human-readable acquisition source for a session. Adds a 'Bot/Spam' bucket on
 * top of the previous logic so crawler referrers never masquerade as a channel.
 */
export function classifySource(
  initialReferrer: string | null | undefined,
  utmSource: string | null | undefined,
): string {
  if (utmSource) {
    const u = utmSource.toLowerCase();
    if (u === 'ig' || u.includes('instagram')) return 'Instagram';
    if (u.includes('linkedin')) return 'LinkedIn';
    if (u.includes('threads')) return 'Threads';
    if (u === 'fb' || u.includes('facebook')) return 'Facebook';
    if (u.includes('kakao')) return 'KakaoTalk';
    if (u === 'x' || u.includes('twitter')) return 'X (Twitter)';
    if (u.includes('discord')) return 'Discord';
    if (u.includes('reddit')) return 'Reddit';
    if (u.includes('youtube')) return 'YouTube';
    if (u.includes('email') || u.includes('newsletter')) return 'Email';
    return utmSource;
  }
  if (isSpamReferrer(initialReferrer)) return 'Bot/Spam';
  if (!initialReferrer) return 'Direct';
  const host = referrerHost(initialReferrer);
  if (host.includes('linkedin')) return 'LinkedIn';
  if (host.includes('threads')) return 'Threads';
  if (host.includes('instagram')) return 'Instagram';
  if (host.includes('facebook') || host === 'm.facebook.com') return 'Facebook';
  if (host.includes('accounts.google')) return 'Google OAuth';
  if (host.includes('google') || host.includes('bing') || host.includes('duckduckgo')) return 'Search';
  if (host.includes('vercel')) return 'Vercel';
  if (host.includes('argus') || host.includes('localhost')) return 'Internal';
  return host;
}

/** Buckets an anonymous session into a real visitor, a bot, or internal noise. */
export type AnonBucket = 'human' | 'bot' | 'internal';

export interface AnonSessionFeatures {
  /** Total events in the session. */
  events: number;
  /** Distinct event_name count (crude engagement breadth). */
  distinctEvents: number;
  /** Distinct page_path count (route-walk detector). */
  distinctPages: number;
  /** initial_referrer (preferred) or referrer of the session. */
  referrer: string | null | undefined;
  /** Explicit campaign source. `internal_qa` is the operator opt-out. */
  utmSource?: string | null | undefined;
  /** Session touched any `/admin` route. */
  visitedAdmin: boolean;
  /** Number of distinct locale prefixes touched (/ko, /en, …). */
  localesTouched: number;
  /** Saw BOTH the privacy and terms pages (route-walker fingerprint). */
  visitedLegalPair: boolean;
  /**
   * The run declared itself automated (analytics.SYNTHETIC_RUN_KEY).
   *
   * Not a heuristic and not overridable by the ones below: a Playwright context
   * that navigates straight to the app has no referrer, one locale and few
   * pages, so every signature in this function reads it as a first-time human —
   * which behaviourally it is. Detection cannot win here; declaration can.
   */
  synthetic?: boolean;
}

/**
 * Classify an anonymous session. Order matters: internal (dev/synthetic) is
 * decided first because those sessions are also the deepest, then deterministic
 * bot detection, then everything else is treated as a real human — engagement
 * depth is reported separately, never used to hide a shallow-but-real visitor.
 *
 * Internal signatures (none of which a real external visitor produces):
 *  - referrer is localhost / 127.0.0.1 / a *.vercel.app preview / github.com
 *  - the session opened an `/admin` route
 *  - the session spans two or more locales in one sitting
 *  - a full-site route walk (≥8 distinct pages) or a legal-page sweep
 *    (saw privacy AND terms with several other pages)
 */
export function classifyAnonSession(f: AnonSessionFeatures): AnonBucket {
  // A declared machine, before any inference. Measured 2026-08-05: 64 of 88
  // production sessions in two weeks were our own e2e fixtures, all bucketed
  // 'human', because nothing here could tell them apart from a real visitor.
  if (f.synthetic) return 'internal';
  const host = referrerHost(f.referrer);
  const utmSource = (f.utmSource || '').toLowerCase();
  if (utmSource === 'internal' || utmSource === 'qa' || utmSource === 'internal_qa') return 'internal';
  if (
    host.includes('localhost')
    || host.startsWith('127.0.0.1')
    || host === 'github.com'
    || host.endsWith('.vercel.app')
  ) return 'internal';
  if (f.visitedAdmin) return 'internal';
  if (f.localesTouched >= 2) return 'internal';
  if (f.distinctPages >= 8) return 'internal';
  if (f.visitedLegalPair && f.distinctPages >= 4) return 'internal';

  if (isSpamReferrer(f.referrer)) return 'bot';

  return 'human';
}
