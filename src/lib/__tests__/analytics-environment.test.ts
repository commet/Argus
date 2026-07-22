import { describe, expect, it } from 'vitest';
import { isAnalyticsHostname } from '../analytics';
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
});
