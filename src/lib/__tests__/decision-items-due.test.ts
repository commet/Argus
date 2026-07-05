import { describe, it, expect } from 'vitest';
import {
  createItem,
  markRechecked,
  registerDismissal,
  recordEdit,
  isItemDueForReconsider,
  isItemDueForRecheck,
  itemReconsiderDays,
  DECISION_ITEM_REPONDER_CADENCE_DAYS,
  DECISION_ITEM_RECHECK_CADENCE_DAYS,
  type DecisionItem,
} from '../decision-items';

const DAY = 86_400_000;
const T0 = Date.parse('2026-01-01T00:00:00Z');
const daysLater = (n: number) => T0 + n * DAY;

function openQ(): DecisionItem {
  return createItem({ decision_id: 'd1', type: 'open_question', text: '지금 채용할지', source: 'user' }, T0);
}
function watchedPremise(): DecisionItem {
  // external + load_bearing → defaultAlertMode = on_change (monitored)
  return createItem({ decision_id: 'd1', type: 'premise', text: '금리가 동결된다', source: 'ai', external: true, load_bearing: true, ai_original: '금리가 동결된다' }, T0);
}

describe('#2 open_question reconsider due (pull, spine-safe)', () => {
  it('not due before the cadence elapses', () => {
    expect(isItemDueForReconsider(openQ(), daysLater(DECISION_ITEM_REPONDER_CADENCE_DAYS - 1))).toBe(false);
  });
  it('due once the cadence has elapsed', () => {
    expect(isItemDueForReconsider(openQ(), daysLater(DECISION_ITEM_REPONDER_CADENCE_DAYS))).toBe(true);
  });
  it('deferring (dismiss) resets the clock — the anchor moves forward', () => {
    let q = openQ();
    const deferAt = daysLater(DECISION_ITEM_REPONDER_CADENCE_DAYS);
    q = registerDismissal(q, deferAt);
    // right after deferring, not due again
    expect(isItemDueForReconsider(q, deferAt + DAY)).toBe(false);
    // due again one cadence after the defer
    expect(isItemDueForReconsider(q, deferAt + DECISION_ITEM_REPONDER_CADENCE_DAYS * DAY)).toBe(true);
  });
  it('backs off after 2 defers (stops nagging)', () => {
    let q = openQ();
    q = registerDismissal(q, daysLater(30));
    q = registerDismissal(q, daysLater(60));
    expect(isItemDueForReconsider(q, daysLater(200))).toBe(false); // backed off
  });
  it('a resolved/retired question is never nagged', () => {
    const q = recordEdit(openQ(), 'reject', '', daysLater(1));
    expect(isItemDueForReconsider(q, daysLater(999))).toBe(false);
  });
  it('a premise is not a reconsider target', () => {
    expect(isItemDueForReconsider(watchedPremise(), daysLater(999))).toBe(false);
  });
  it('day count for the nudge copy is sane', () => {
    expect(itemReconsiderDays(openQ(), daysLater(25))).toBe(25);
  });
});

describe('#1 premise recheck due (pull, not a cron)', () => {
  it('a brand-new premise is not nagged (under-fire)', () => {
    expect(isItemDueForRecheck(watchedPremise(), daysLater(1))).toBe(false);
  });
  it('due once the recheck cadence has elapsed', () => {
    expect(isItemDueForRecheck(watchedPremise(), daysLater(DECISION_ITEM_RECHECK_CADENCE_DAYS))).toBe(true);
  });
  it('marking rechecked resets the clock without a dismissal', () => {
    let p = watchedPremise();
    const checkAt = daysLater(DECISION_ITEM_RECHECK_CADENCE_DAYS);
    p = markRechecked(p, checkAt);
    expect(p.alert.dismissals ?? 0).toBe(0); // confirmation is not a nuisance
    expect(isItemDueForRecheck(p, checkAt + DAY)).toBe(false);
    expect(isItemDueForRecheck(p, checkAt + DECISION_ITEM_RECHECK_CADENCE_DAYS * DAY)).toBe(true);
  });
  it('a non-external / bell-off premise is never a recheck target', () => {
    const off = createItem({ decision_id: 'd1', type: 'premise', text: '내부 전제', source: 'ai', external: false, load_bearing: true }, T0);
    expect(isItemDueForRecheck(off, daysLater(999))).toBe(false);
  });
});
