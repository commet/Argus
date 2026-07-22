import { describe, expect, it } from 'vitest';
import { isAnalyticsHostname, isAnalyticsMetadata } from '../analytics';
import { isServerAnalyticsEnabled } from '../server-events';

describe('analytics environment guards', () => {
  it('accepts only the configured production host and its www alias', () => {
    expect(isAnalyticsHostname('argus.voyage', 'https://argus.voyage')).toBe(true);
    expect(isAnalyticsHostname('www.argus.voyage', 'https://argus.voyage')).toBe(true);
    expect(isAnalyticsHostname('localhost', 'https://argus.voyage')).toBe(false);
    expect(isAnalyticsHostname('argus-git-feature.vercel.app', 'https://argus.voyage')).toBe(false);
  });

  it('fails closed when the canonical site URL is absent or invalid', () => {
    expect(isAnalyticsHostname('argus.voyage', undefined)).toBe(false);
    expect(isAnalyticsHostname('argus.voyage', 'not a url')).toBe(false);
  });

  it('allows server telemetry only in the Vercel production environment', () => {
    expect(isServerAnalyticsEnabled('production')).toBe(true);
    expect(isServerAnalyticsEnabled('preview')).toBe(false);
    expect(isServerAnalyticsEnabled('development')).toBe(false);
    expect(isServerAnalyticsEnabled(undefined)).toBe(false);
  });

  it('accepts only flat scalar source metadata from session storage', () => {
    expect(isAnalyticsMetadata({ utm_source: 'newsletter', returning: true, visits: 2, ref: null })).toBe(true);
    expect(isAnalyticsMetadata(null)).toBe(false);
    expect(isAnalyticsMetadata([])).toBe(false);
    expect(isAnalyticsMetadata({ nested: { unsafe: true } })).toBe(false);
  });
});
