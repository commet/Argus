import { describe, expect, it } from 'vitest';
import type { DecisionContract } from '@/stores/types';
import { isCheckInReminderDue, renderCheckInReminderEmail, resendEmailErrorMessage, selectOpenPredicate } from '../checkin-reminder';

const base = (patch: Partial<DecisionContract> = {}): DecisionContract => ({
  id: 'c1',
  project_id: 'p1',
  created_at: '2026-01-01T10:00:00.000Z',
  check_in_at: new Date(2026, 0, 8, 23, 59).toISOString(),
  predicates: [
    { id: 'pred_1', source: 'governing_idea', text: 'First check', verdict: 'happened' },
    { id: 'pred_2', source: 'risk', text: 'Second check' },
  ],
  ...patch,
});

describe('check-in reminder selection', () => {
  it('uses contractStatus day-level due semantics instead of exact timestamp comparison', () => {
    const morningOfPromisedDay = new Date(2026, 0, 8, 0, 1).getTime();

    expect(isCheckInReminderDue(base(), morningOfPromisedDay)).toBe(true);
  });

  it('does not remind fully resolved legacy contracts even when graded_at is missing', () => {
    const contract = base({
      graded_at: undefined,
      predicates: [
        { id: 'pred_1', source: 'governing_idea', text: 'First check', verdict: 'happened' },
        { id: 'pred_2', source: 'risk', text: 'Second check', verdict: 'avoided' },
      ],
    });

    expect(isCheckInReminderDue(contract, new Date('2026-01-09T00:00:00.000Z').getTime())).toBe(false);
  });

  it('keeps date-only ropes due so they can be closed by a look-back', () => {
    const contract = base({ predicates: [] });

    expect(isCheckInReminderDue(contract, new Date('2026-01-09T00:00:00.000Z').getTime())).toBe(true);
  });

  it('selects the unresolved predicate before falling back to the first one', () => {
    expect(selectOpenPredicate(base())?.id).toBe('pred_2');
    expect(selectOpenPredicate(base({
      predicates: [
        { id: 'pred_1', source: 'governing_idea', text: 'First check', verdict: 'happened' },
      ],
    }))?.id).toBe('pred_1');
  });

  it('renders escaped reminder email html with the actual lean text', () => {
    const html = renderCheckInReminderEmail({
      projectName: '<Launch>',
      lean: 'Use <script>alert(1)</script>',
      link: 'https://argus.voyage/project?x="quoted"',
    });

    expect(html).toContain('&lt;Launch&gt; is ready for its Argus check-in.');
    expect(html).toContain('Use &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('${');
    expect(html).not.toContain('<script>');
    expect(html).toContain('href="https://argus.voyage/project?x=&quot;quoted&quot;"');
    expect(html).toContain('</a>');
  });

  it('detects Resend error payloads so failed sends are not stamped as sent', () => {
    expect(resendEmailErrorMessage({ data: { id: 'email_1' }, error: null })).toBeNull();
    expect(resendEmailErrorMessage({ error: { message: 'domain is not verified' } })).toBe('domain is not verified');
    expect(resendEmailErrorMessage({ error: 'rate limited' })).toBe('rate limited');
    expect(resendEmailErrorMessage({ error: {} })).toBe('unknown email send error');
  });
});
