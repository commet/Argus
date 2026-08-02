import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(
  new URL('../../../../app/[locale]/workspace/page.tsx', import.meta.url),
  'utf8',
);

describe('first analysis latency telemetry', () => {
  it('separates request start, first token, ready, and failure', () => {
    for (const event of [
      'first_analysis_start',
      'first_analysis_first_token',
      'first_analysis_ready',
      'first_analysis_failed',
    ]) {
      expect(page).toContain(`track('${event}'`);
    }
    expect(page.match(/track\('first_analysis_start'/g)).toHaveLength(1);
  });

  it('measures without sending the user text', () => {
    expect(page).toContain('duration_ms: Math.round(performance.now() - timing.startedAt)');
    expect(page).not.toContain("track('first_analysis_ready', {\n          text:");
  });
});
