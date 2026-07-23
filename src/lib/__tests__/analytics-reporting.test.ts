import { describe, expect, it } from 'vitest';
import {
  classifyAnalyticsSignal,
  classifySource,
  classifyAnonSession,
  isSpamReferrer,
  referrerHost,
  type AnonSessionFeatures,
} from '../analytics-reporting';
import { elapsedSecondsSince } from '../elapsed-time';

// A real, engaged anonymous human unless a rule below overrides it.
const humanBase: AnonSessionFeatures = {
  events: 8,
  distinctEvents: 4,
  distinctPages: 2,
  referrer: 'https://l.instagram.com/',
  visitedAdmin: false,
  localesTouched: 1,
  visitedLegalPair: false,
};

describe('analytics reporting signals', () => {
  it('does not double-count expected rate limits as product failures', () => {
    expect(classifyAnalyticsSignal('server_rate_limited', { kind: 'anon_daily' })).toBe('guardrail');
    expect(classifyAnalyticsSignal('llm_error', { status: 429 })).toBe('none');
    expect(classifyAnalyticsSignal('workspace_start_error', { needs_login: true })).toBe('none');
  });

  it('keeps genuine client and server failures in the operational digest', () => {
    expect(classifyAnalyticsSignal('llm_error', { status: 503 })).toBe('operational_error');
    expect(classifyAnalyticsSignal('review_timeout', { elapsed_s: 150 })).toBe('operational_error');
    expect(classifyAnalyticsSignal('review_failed', { kind: 'model_error' })).toBe('operational_error');
    expect(classifyAnalyticsSignal('unhandled_error', {})).toBe('operational_error');
  });

  it('measures async duration from wall-clock time rather than stale render state', () => {
    expect(elapsedSecondsSince(1_000, 151_400)).toBe(150);
    expect(elapsedSecondsSince(2_000, 1_000)).toBe(0);
  });
});

describe('referrer host parsing', () => {
  it('strips protocol, path, and casing', () => {
    expect(referrerHost('https://WWW.Excite.com/foo?bar')).toBe('www.excite.com');
    expect(referrerHost('http://simplyhired.com/')).toBe('simplyhired.com');
    expect(referrerHost(null)).toBe('');
    expect(referrerHost('')).toBe('');
  });
});

describe('referrer-spam detection', () => {
  it('flags known crawler domains and their subdomains', () => {
    expect(isSpamReferrer('http://www.excite.com/')).toBe(true);
    expect(isSpamReferrer('http://searchhippo.com/')).toBe(true);
    expect(isSpamReferrer('https://roysearch.com/x')).toBe(true);
    expect(isSpamReferrer('http://cluuz.com/')).toBe(true);
  });
  it('does not flag real referrers', () => {
    expect(isSpamReferrer('https://l.instagram.com/')).toBe(false);
    expect(isSpamReferrer('https://www.facebook.com/')).toBe(false);
    expect(isSpamReferrer(null)).toBe(false);
    expect(isSpamReferrer('(direct)')).toBe(false);
  });
});

describe('acquisition source classification', () => {
  it('prefers utm over referrer and normalizes channels', () => {
    expect(classifySource(null, 'ig')).toBe('Instagram');
    expect(classifySource('https://whatever.com/', 'fb')).toBe('Facebook');
    expect(classifySource('https://l.instagram.com/', null)).toBe('Instagram');
    expect(classifySource(null, null)).toBe('Direct');
  });
  it('quarantines spam referrers into a bot bucket instead of a fake channel', () => {
    expect(classifySource('http://www.excite.com/', null)).toBe('Bot/Spam');
    expect(classifySource('http://searchhippo.com/', null)).toBe('Bot/Spam');
  });
  it('separates OAuth redirect from organic search', () => {
    expect(classifySource('https://accounts.google.com/', null)).toBe('Google OAuth');
    expect(classifySource('https://www.google.com/search', null)).toBe('Search');
  });
});

describe('anonymous session bucketing', () => {
  it('treats an engaged social visitor as a human', () => {
    expect(classifyAnonSession(humanBase)).toBe('human');
  });

  it('classifies known referrer-spam as a bot', () => {
    expect(classifyAnonSession({ ...humanBase, referrer: 'http://www.roysearch.com/', events: 2, distinctEvents: 2 }))
      .toBe('bot');
  });

  it('files developer/synthetic signatures under internal', () => {
    // localhost referrer
    expect(classifyAnonSession({ ...humanBase, referrer: 'http://localhost:3000/ko' })).toBe('internal');
    // github referrer
    expect(classifyAnonSession({ ...humanBase, referrer: 'https://github.com/' })).toBe('internal');
    // visited the admin console
    expect(classifyAnonSession({ ...humanBase, visitedAdmin: true })).toBe('internal');
    // one sitting spanning two locales
    expect(classifyAnonSession({ ...humanBase, localesTouched: 2 })).toBe('internal');
    // full-site route walk
    expect(classifyAnonSession({ ...humanBase, distinctPages: 12 })).toBe('internal');
    // legal-page sweep (privacy + terms + several others)
    expect(classifyAnonSession({ ...humanBase, visitedLegalPair: true, distinctPages: 5 })).toBe('internal');
  });

  it('does not downgrade a shallow but organic visitor to bot', () => {
    // 2 events, real referrer, no spam host → still a human (depth is reported,
    // never used to hide a real person)
    expect(classifyAnonSession({ ...humanBase, events: 2, distinctEvents: 2, referrer: 'https://www.facebook.com/' }))
      .toBe('human');
  });
});
