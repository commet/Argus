import { describe, expect, it } from 'vitest';
import { CHECK_IN_MS, DEFAULT_CHECK_IN_INTERVAL } from '@/lib/decision-contract';
import { DEMO_SCENARIOS } from '@/lib/demo-data';
import { DEMO_SCENARIOS_EN } from '@/lib/demo-data-en';

const DAY_MS = 86_400_000;

describe('process 4 demo settle-latency contract', () => {
  it('keeps every onboarding demo scenario on a return signal within 7 days', () => {
    const scenarios = [
      ...DEMO_SCENARIOS.map((s) => ({ locale: 'ko', ...s })),
      ...DEMO_SCENARIOS_EN.map((s) => ({ locale: 'en', ...s })),
    ];

    expect(scenarios.length).toBeGreaterThan(0);
    for (const scenario of scenarios) {
      expect(
        scenario.checkInDays,
        `${scenario.locale}/${scenario.id} must return quickly enough for onboarding`,
      ).toBeLessThanOrEqual(7);
    }
  });

  it('keeps the default first seal check-in at 7 days or sooner', () => {
    expect(CHECK_IN_MS[DEFAULT_CHECK_IN_INTERVAL]).toBeLessThanOrEqual(7 * DAY_MS);
  });
});
