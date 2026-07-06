/**
 * Decision Items — a decision decomposed into typed, individually-tracked objects.
 *
 * Design: docs/DESIGN-decision-items-living-premises-2026-07-01.md
 *
 * A decision is not a single conclusion; it is a list of items of different
 * TYPES (premise / phenomenon / conclusion / open_question / prediction). Each
 * item is independently editable, alertable, and tracked. The user's edits to an
 * AI-extracted item are recorded as first-class SIGNAL — overturning the AI is
 * the strongest signal (used for engine calibration + ratifiable observation,
 * NEVER a verdict about the user; see CLAUDE.md Zero-Judgment gate).
 *
 * Pure functions, `now` injected (mirrors decision-contract.ts) — never reads the
 * clock itself, so it is fully testable.
 *
 * `prediction` items are the SAME concept as decision-contract.ts Predicate; this
 * layer does not re-store them — it adds the premise / phenomenon / open_question
 * layer on top of the existing seal→settle loop.
 */

import { DEFAULT_REPONDER_CADENCE_DAYS, DEFAULT_RECHECK_CADENCE_DAYS } from './premises-core';

/** Reconsider/recheck cadences for the DecisionItem model, sourced from
 *  premises-core so the two premise surfaces (terminal PremiseState + webapp
 *  DecisionItem) can't drift on "how often" (clarify v2 §3.1b / checkpoints §9). */
export const DECISION_ITEM_REPONDER_CADENCE_DAYS = DEFAULT_REPONDER_CADENCE_DAYS;
export const DECISION_ITEM_RECHECK_CADENCE_DAYS = DEFAULT_RECHECK_CADENCE_DAYS;

export type ItemType =
  | 'premise'
  | 'phenomenon'
  | 'conclusion'
  | 'open_question'
  | 'prediction';

export type EditAction =
  | 'accept' // AI item left as-is (explicit acknowledgement)
  | 'refine' // direction right, scope/wording changed
  | 'replace' // content overturned
  | 'reject' // deleted / rejected
  | 'add' // user added a new item
  | 'split'; // one item split into two (caller creates the second)

export type AlertMode = 'off' | 'on_change' | 'weekly' | 'monthly';

export interface EditEvent {
  at: string; // ISO
  action: EditAction;
  from: string; // text before ('' for add)
  to: string; // text after ('' for reject)
  ai_original?: string; // the AI's first extraction (preserved for the override signal)
  note?: string; // optional "why" — never required (keep friction minimal)
}

export interface ItemAlert {
  mode: AlertMode;
  last_checked?: string; // last web re-check time
  last_value?: string; // last confirmed fact summary (drift comparison baseline)
  dismissals?: number; // how many times the user ignored/dismissed this alert
}

export interface DecisionItem {
  id: string;
  decision_id: string;
  type: ItemType;
  text: string;
  source: 'ai' | 'user'; // who first produced it
  authored: 'ai' | 'user' | 'ai_edited_by_user'; // current ownership
  edits: EditEvent[]; // append-only history
  external: boolean; // reality can verify it (web-monitor eligible)
  load_bearing: boolean; // user-marked importance
  alert: ItemAlert;
  status: 'active' | 'resolved' | 'retired';
  created_at: string;
  /** Sync-layer field (stamped by the store on every write) so cross-device
   *  merge keeps the latest edit. Stripped by db.ts sanitizeItem on upsert; the DB
   *  trigger is authoritative server-side. */
  updated_at?: string;
}

/** Deterministic, stable id from an item's identity (decision + type + normalized
 *  text). djb2. Decision-scoped so it is globally unique (two decisions may hold a
 *  premise with the same text) — this id IS the Supabase row key (db.ts upserts
 *  onConflict:'id'), so it must not collide across decisions. Stable across
 *  re-extraction so an edit/alert config is never orphaned. */
export function stableItemId(decisionId: string, type: ItemType, text: string): string {
  const key = `${decisionId}:${type}:${text.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return `item_${h.toString(36)}`;
}

/** After how many dismissals an on_change alert auto-quiets itself (adaptive
 *  back-off — "start helpful, go quiet if it's a nuisance"; DESIGN §5.2). */
export const ALERT_BACKOFF_DISMISSALS = 2;

export interface NewItemInput {
  decision_id: string;
  type: ItemType;
  text: string;
  source: 'ai' | 'user';
  external?: boolean;
  load_bearing?: boolean;
  ai_original?: string; // when source==='ai', the raw extraction text
}

/**
 * The opt-out default (DESIGN §5.1): monitoring is ON for the load-bearing
 * external premises (the return-loop driver), OFF for everything else. The user
 * tunes DOWN, not up. Drift materiality (whether a re-checked value ACTUALLY
 * changed) is decided by the M2 engine in numeric-drift.ts — never a crude
 * global threshold — so an enabled alert is not a nag.
 */
export function defaultAlertMode(item: {
  type: ItemType;
  external: boolean;
  load_bearing: boolean;
}): AlertMode {
  if (item.type === 'premise' && item.external && item.load_bearing) return 'on_change';
  return 'off';
}

/** Build an item (from extraction or a user-added row). Pure; `now` injected. */
export function createItem(input: NewItemInput, now: number): DecisionItem {
  const text = input.text.trim();
  const external = input.external ?? false;
  const load_bearing = input.load_bearing ?? false;
  const base = { type: input.type, external, load_bearing };
  const iso = new Date(now).toISOString();
  const edits: EditEvent[] =
    input.source === 'user'
      ? [{ at: iso, action: 'add', from: '', to: text }]
      : [];
  return {
    id: stableItemId(input.decision_id, input.type, text),
    decision_id: input.decision_id,
    type: input.type,
    text,
    source: input.source,
    authored: input.source === 'user' ? 'user' : 'ai',
    edits,
    external,
    load_bearing,
    alert: { mode: defaultAlertMode(base), dismissals: 0 },
    status: 'active',
    created_at: iso,
    updated_at: iso,
  };
}

/**
 * Record an edit to an item (immutable). Appends the EditEvent, updates text /
 * authorship / status. `accept` records an explicit acknowledgement without
 * changing the text (silence-as-consent is weaker signal than an explicit accept).
 * `reject` retires the item but keeps it on the record (变针도 기록이다).
 */
export function recordEdit(
  item: DecisionItem,
  action: EditAction,
  newText: string,
  now: number,
  note?: string,
): DecisionItem {
  const iso = new Date(now).toISOString();
  const prevAiOriginal = firstAiOriginal(item);
  const to = action === 'reject' ? '' : newText.trim();
  const edit: EditEvent = {
    at: iso,
    action,
    from: item.text,
    to,
    ...(prevAiOriginal ? { ai_original: prevAiOriginal } : {}),
    ...(note ? { note } : {}),
  };
  const edits = [...(item.edits || []), edit];

  if (action === 'reject') {
    return { ...item, edits, status: 'retired' };
  }
  if (action === 'accept') {
    // No text change; authorship unchanged. Acknowledgement is the signal.
    return { ...item, edits };
  }
  // refine / replace / add / split → text becomes newText; AI items become co-authored.
  const authored: DecisionItem['authored'] =
    item.source === 'ai' ? 'ai_edited_by_user' : 'user';
  return { ...item, text: to || item.text, authored, edits };
}

/** The AI's original extraction text for this item, if it was AI-sourced. Read
 *  from the earliest edit that carries it, else the item's current text when it
 *  is AI-sourced and unedited. */
export function firstAiOriginal(item: DecisionItem): string | undefined {
  if (item.source !== 'ai') return undefined;
  const carried = (item.edits || []).find((e) => e.ai_original)?.ai_original;
  if (carried) return carried;
  const hasUserEdit = (item.edits || []).some(
    (e) => e.action === 'refine' || e.action === 'replace' || e.action === 'reject',
  );
  return hasUserEdit ? undefined : item.text;
}

/** A user edit that overturns the AI's starting point (the strongest signal).
 *  replace/reject are HARD overrides; refine is a SOFT override. accept/add/split
 *  are not overrides. */
export function isHardOverride(edit: EditEvent): boolean {
  return edit.action === 'replace' || edit.action === 'reject';
}
export function isSoftOverride(edit: EditEvent): boolean {
  return edit.action === 'refine';
}

export interface OverrideSummary {
  /** AI items the user left as-is (explicit accept). */
  accepted: number;
  /** AI items the user refined (direction kept, scope/wording changed). */
  refined: number;
  /** AI items the user overturned (replaced or rejected). */
  overturned: number;
  /** Items the user added themselves. */
  added: number;
  /** Total AI-sourced items considered. */
  aiItems: number;
  /** overturned / aiItems, or null when there is nothing to divide by. */
  overturnRate: number | null;
}

/**
 * Aggregate the edit signal across a decision's items. This feeds ENGINE
 * calibration (a high overturn rate on a given extraction type means the prompt
 * over-reaches for this user) and a RATIFIABLE observation surface — it must
 * NEVER become a verdict about the user (CLAUDE.md Zero-Judgment; see the
 * patterns/principles fix 2026-07-01). Counts only, never a score.
 */
export function summarizeOverrides(items: DecisionItem[]): OverrideSummary {
  const list = Array.isArray(items) ? items : [];
  let accepted = 0;
  let refined = 0;
  let overturned = 0;
  let added = 0;
  let aiItems = 0;
  for (const item of list) {
    if (item.source === 'user') {
      added++;
      continue;
    }
    aiItems++;
    const edits = item.edits || [];
    if (edits.some(isHardOverride)) overturned++;
    else if (edits.some(isSoftOverride)) refined++;
    else if (edits.some((e) => e.action === 'accept')) accepted++;
  }
  return {
    accepted,
    refined,
    overturned,
    added,
    aiItems,
    overturnRate: aiItems > 0 ? overturned / aiItems : null,
  };
}

/** Set an item's alert mode (immutable). Resets the dismissal counter when the
 *  user re-enables an alert (an explicit re-enable clears prior back-off). */
export function setAlertMode(item: DecisionItem, mode: AlertMode): DecisionItem {
  const dismissals = mode === 'off' ? item.alert?.dismissals : 0;
  return { ...item, alert: { ...item.alert, mode, dismissals } };
}

/** Record that the user ignored/dismissed this item's alert (immutable). After
 *  ALERT_BACKOFF_DISMISSALS, `shouldBackOff` returns true and the alert
 *  auto-quiets — restraint learned from behavior, not a static off default. */
export function registerDismissal(item: DecisionItem, now: number): DecisionItem {
  const dismissals = (item.alert.dismissals ?? 0) + 1;
  return {
    ...item,
    alert: { ...item.alert, dismissals, last_checked: new Date(now).toISOString() },
  };
}

export function shouldBackOff(item: DecisionItem): boolean {
  return (item.alert?.dismissals ?? 0) >= ALERT_BACKOFF_DISMISSALS;
}

/** Active items only (not retired/resolved). Defensive against malformed data. */
export function activeItems(items: DecisionItem[] | undefined): DecisionItem[] {
  return (Array.isArray(items) ? items : []).filter((i) => i?.status === 'active');
}

/** The items eligible for premise monitoring right now: active premises whose
 *  alert is on_change and which have not backed off. */
export function monitoredPremises(items: DecisionItem[] | undefined): DecisionItem[] {
  return activeItems(items).filter(
    (i) => i.type === 'premise' && i.external && i.alert?.mode === 'on_change' && !shouldBackOff(i),
  );
}

// ── pull-based due surfacing (webapp gaps #1/#2) ────────────────────────────
//
// The bell was a watch mark because no recheck cron exists — and building a
// scheduled push is a deliberate founder cost/over-fire decision (checkpoints v2
// §9). What DOES fit the spine now is a PULL surface: when the user opens the
// project, show which watched premises are worth re-checking and which deferred
// open_questions can be reconsidered — a signal that appears on return, never a
// notification pushed at them. The cadence math is REUSED from premises-core so
// "how often" means the same thing here and in the terminal (no drift).

const DAY_MS = 86_400_000;

/** Whole days between an ISO timestamp and `now` (date-level). An unparseable or
 *  future anchor yields a large number → treated as long-ago (surfaces the nudge
 *  rather than hiding it; the user can always defer). Pure; `now` injected. */
export function daysSinceISO(fromISO: string | undefined, now: number): number {
  if (!fromISO) return Number.POSITIVE_INFINITY;
  const t = Date.parse(fromISO);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((now - t) / DAY_MS);
}

/** The anchor a reconsider timer runs from: the last defer/recheck touch, else
 *  the item's own last edit, else its creation. */
function reconsiderAnchorISO(item: DecisionItem): string {
  const lastEdit = (item.edits || []).length ? item.edits[item.edits.length - 1].at : undefined;
  return item.alert?.last_checked ?? lastEdit ?? item.created_at;
}

/**
 * #2 — is this open_question due to be RECONSIDERED as of `now`? Active
 * open_question, not backed off (≥2 defers → quiet), and its anchor is at least
 * the reconsider cadence old. The nudge never demands an answer — leaving it
 * open stays valid (clarify v2 §5.6); it only gates whether we resurface it.
 * Cadence reused from premises-core (DEFAULT_REPONDER_CADENCE_DAYS). Pure.
 */
export function isItemDueForReconsider(item: DecisionItem, now: number): boolean {
  if (item?.type !== 'open_question' || item.status !== 'active') return false;
  if (shouldBackOff(item)) return false;
  return daysSinceISO(reconsiderAnchorISO(item), now) >= DECISION_ITEM_REPONDER_CADENCE_DAYS;
}

/**
 * #1 — is this monitored premise due for a re-CHECK as of `now`? A pull nudge,
 * not a cron: active external on_change premise, not backed off, either never
 * checked and at least the cadence old (under-fire: a brand-new premise is not
 * nagged), or last checked ≥ the cadence ago. Gates the nudge, never the pen.
 * Cadence reused from premises-core (DEFAULT_RECHECK_CADENCE_DAYS). Pure.
 */
export function isItemDueForRecheck(item: DecisionItem, now: number): boolean {
  if (item?.type !== 'premise' || item.status !== 'active') return false;
  if (item.external !== true || item.alert?.mode !== 'on_change' || shouldBackOff(item)) return false;
  const last = item.alert?.last_checked;
  const anchor = last ?? item.created_at;
  return daysSinceISO(anchor, now) >= DECISION_ITEM_RECHECK_CADENCE_DAYS;
}

/** Days since an open_question was last touched — for the reconsider nudge copy. */
export function itemReconsiderDays(item: DecisionItem, now: number): number {
  const d = daysSinceISO(reconsiderAnchorISO(item), now);
  return Number.isFinite(d) ? d : DECISION_ITEM_REPONDER_CADENCE_DAYS;
}

/** Days since a premise was last re-checked (or created) — for the recheck nudge copy. */
export function itemRecheckDays(item: DecisionItem, now: number): number {
  const d = daysSinceISO(item.alert?.last_checked ?? item.created_at, now);
  return Number.isFinite(d) ? d : DECISION_ITEM_RECHECK_CADENCE_DAYS;
}

/** Record that the user re-checked a premise and it still holds (or record the
 *  new value) — resets the recheck clock WITHOUT counting as a dismissal (a
 *  confirmation is not a nuisance-signal). Immutable; `now` injected. */
export function markRechecked(item: DecisionItem, now: number, value?: string): DecisionItem {
  return {
    ...item,
    alert: {
      ...item.alert,
      last_checked: new Date(now).toISOString(),
      ...(value && value.trim() ? { last_value: value.trim() } : {}),
    },
  };
}
