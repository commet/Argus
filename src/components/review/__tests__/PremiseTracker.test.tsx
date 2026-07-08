import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PremiseTracker } from '../PremiseTracker';
import type { JudgmentReceipt } from '@/lib/review';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: null, session: null, loading: false }),
}));

describe('PremiseTracker', () => {
  it('shows sealed value, current value, source, and confidence for a watched premise', () => {
    const receipt = {
      receipt_id: 'r1',
      state: 'sealed',
      falsifiable_followups: [],
      hidden_assumptions: [],
      claim_ledger: [],
      tracked_premises: [{
        premise_id: 'p_rate',
        ordinal: 2,
        kind: 'premise',
        text: '기준금리가 3.5% 근처에 머문다',
        external: true,
        load_bearing: true,
        source: 'user_stated',
        status: 'active',
        amend_history: [],
        recheck_count: 2,
        auto_watch: true,
        last_recheck: {
          finding: '기준금리 4.0%',
          numeric_value: 4,
          baseline_finding: '기준금리 3.5%',
          baseline_numeric_value: 3.5,
          drifted: true,
          baseline_only: false,
          source: 'url',
          source_detail: 'https://bok.example/current (2026-07-07)',
          confidence: 'high',
          auto: true,
          ts: '2026-07-07T09:00:00.000Z',
        },
      }],
    } as unknown as JudgmentReceipt;

    const html = renderToStaticMarkup(<PremiseTracker receipt={receipt} />);

    expect(html).toContain('Sealed value');
    expect(html).toContain('3.5');
    expect(html).toContain('Current value');
    expect(html).toContain('4');
    expect(html).toContain('Source');
    expect(html).toContain('https://bok.example/current');
    expect(html).toContain('Confidence');
    expect(html).toContain('High');
  });
});
