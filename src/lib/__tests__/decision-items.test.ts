import { describe, it, expect } from 'vitest';
import {
  stableItemId,
  createItem,
  defaultAlertMode,
  recordEdit,
  firstAiOriginal,
  summarizeOverrides,
  setAlertMode,
  registerDismissal,
  shouldBackOff,
  monitoredPremises,
  ALERT_BACKOFF_DISMISSALS,
  type DecisionItem,
} from '../decision-items';

const T0 = Date.parse('2026-07-01T00:00:00Z');
const D = 86_400_000;

function aiPremise(text: string, opts?: { external?: boolean; load_bearing?: boolean }): DecisionItem {
  return createItem(
    { decision_id: 'dec1', type: 'premise', text, source: 'ai', external: opts?.external, load_bearing: opts?.load_bearing },
    T0,
  );
}

describe('stableItemId', () => {
  it('is deterministic and normalizes whitespace/case', () => {
    expect(stableItemId('d', 'premise', '  Rates  stay FLAT ')).toBe(stableItemId('d', 'premise', 'rates stay flat'));
  });
  it('differs by type', () => {
    expect(stableItemId('d', 'premise', 'x')).not.toBe(stableItemId('d', 'phenomenon', 'x'));
  });
  it('is decision-scoped — same text in two decisions gets different ids', () => {
    expect(stableItemId('d1', 'premise', 'x')).not.toBe(stableItemId('d2', 'premise', 'x'));
  });
});

describe('defaultAlertMode (opt-out default)', () => {
  it('turns on_change ONLY for load-bearing external premises', () => {
    expect(defaultAlertMode({ type: 'premise', external: true, load_bearing: true })).toBe('on_change');
  });
  it('is off for non-load-bearing, non-external, or non-premise', () => {
    expect(defaultAlertMode({ type: 'premise', external: true, load_bearing: false })).toBe('off');
    expect(defaultAlertMode({ type: 'premise', external: false, load_bearing: true })).toBe('off');
    expect(defaultAlertMode({ type: 'phenomenon', external: true, load_bearing: true })).toBe('off');
  });
});

describe('createItem', () => {
  it('AI item: authored ai, no edits, alert per default', () => {
    const it0 = aiPremise('rates stay flat', { external: true, load_bearing: true });
    expect(it0.source).toBe('ai');
    expect(it0.authored).toBe('ai');
    expect(it0.edits).toEqual([]);
    expect(it0.alert.mode).toBe('on_change');
    expect(it0.status).toBe('active');
  });
  it('user item: authored user, records an add edit', () => {
    const u = createItem({ decision_id: 'dec1', type: 'premise', text: 'mine', source: 'user' }, T0);
    expect(u.authored).toBe('user');
    expect(u.edits).toHaveLength(1);
    expect(u.edits[0].action).toBe('add');
  });
});

describe('recordEdit', () => {
  it('refine: text changes, AI item becomes co-authored, edit appended, ai_original preserved', () => {
    const it0 = aiPremise('commute under 40 min', { external: true });
    const e = recordEdit(it0, 'refine', 'commute under 30 min', T0 + D);
    expect(e.text).toBe('commute under 30 min');
    expect(e.authored).toBe('ai_edited_by_user');
    expect(e.edits).toHaveLength(1);
    expect(e.edits[0].ai_original).toBe('commute under 40 min');
    expect(e.edits[0].from).toBe('commute under 40 min');
    expect(e.edits[0].to).toBe('commute under 30 min');
  });
  it('reject: retires the item and keeps the record', () => {
    const e = recordEdit(aiPremise('x'), 'reject', '', T0 + D);
    expect(e.status).toBe('retired');
    expect(e.edits[0].to).toBe('');
  });
  it('accept: no text/authorship change, but records the acknowledgement', () => {
    const it0 = aiPremise('x');
    const e = recordEdit(it0, 'accept', 'x', T0 + D);
    expect(e.text).toBe('x');
    expect(e.authored).toBe('ai');
    expect(e.edits[0].action).toBe('accept');
  });
});

describe('firstAiOriginal', () => {
  it('returns current text for an unedited AI item, undefined for user items', () => {
    expect(firstAiOriginal(aiPremise('orig'))).toBe('orig');
    const u = createItem({ decision_id: 'dec1', type: 'premise', text: 'mine', source: 'user' }, T0);
    expect(firstAiOriginal(u)).toBeUndefined();
  });
  it('recovers the AI original from the edit history after editing', () => {
    const e = recordEdit(aiPremise('orig'), 'refine', 'edited', T0 + D);
    expect(firstAiOriginal(e)).toBe('orig');
  });
});

describe('summarizeOverrides (signal, counts only)', () => {
  it('counts accepted / refined / overturned / added and the overturn rate', () => {
    const items: DecisionItem[] = [
      recordEdit(aiPremise('a'), 'accept', 'a', T0),
      recordEdit(aiPremise('b'), 'refine', 'b2', T0),
      recordEdit(aiPremise('c'), 'replace', 'c2', T0),
      recordEdit(aiPremise('d'), 'reject', '', T0),
      createItem({ decision_id: 'dec1', type: 'premise', text: 'mine', source: 'user' }, T0),
    ];
    const s = summarizeOverrides(items);
    expect(s.accepted).toBe(1);
    expect(s.refined).toBe(1);
    expect(s.overturned).toBe(2); // replace + reject
    expect(s.added).toBe(1);
    expect(s.aiItems).toBe(4);
    expect(s.overturnRate).toBeCloseTo(0.5);
  });
  it('overturnRate is null with no AI items', () => {
    expect(summarizeOverrides([]).overturnRate).toBeNull();
  });
});

describe('alerts: dismissal back-off', () => {
  it('backs off after the dismissal threshold', () => {
    let it0 = aiPremise('rates', { external: true, load_bearing: true });
    expect(shouldBackOff(it0)).toBe(false);
    for (let i = 0; i < ALERT_BACKOFF_DISMISSALS; i++) it0 = registerDismissal(it0, T0 + i * D);
    expect(shouldBackOff(it0)).toBe(true);
  });
  it('re-enabling an alert clears prior back-off', () => {
    let it0 = aiPremise('rates', { external: true, load_bearing: true });
    it0 = registerDismissal(registerDismissal(it0, T0), T0 + D);
    expect(shouldBackOff(it0)).toBe(true);
    it0 = setAlertMode(it0, 'on_change');
    expect(shouldBackOff(it0)).toBe(false);
  });
});

describe('monitoredPremises', () => {
  it('includes only active on_change external premises that have not backed off', () => {
    const on = aiPremise('rates', { external: true, load_bearing: true }); // on_change by default
    const off = aiPremise('minor', { external: true }); // off by default
    const retired = recordEdit(aiPremise('gone', { external: true, load_bearing: true }), 'reject', '', T0);
    let backed = aiPremise('noisy', { external: true, load_bearing: true });
    backed = registerDismissal(registerDismissal(backed, T0), T0 + D);
    const out = monitoredPremises([on, off, retired, backed]);
    expect(out.map((i) => i.text)).toEqual(['rates']);
  });
});
