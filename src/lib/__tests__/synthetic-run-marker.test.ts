/**
 * A machine must be able to say it is a machine.
 *
 * Measured against production on 2026-08-05, over the two weeks the founder
 * believed users were arriving:
 *
 *   88 progressive sessions, 30 distinct problem texts
 *   64 of those sessions carried one of six e2e fixtures
 *   the top fixture — "다음 분기에 신규 채용을 2명 더 할지…" — appeared 44 times
 *   94 login failures, ALL of them from our own scripts' viewports
 *   0 external email signups
 *
 * `scripts/e2e/decision-loop.mjs` defaults to https://argus.voyage, so every CI
 * push and every local run wrote real anonymous users, real projects and real
 * events into the founder's only instrument — and every one was bucketed
 * 'human'. The read that came out of it ("people are signing up") was the exact
 * inverse of the truth, which is the most expensive kind of wrong a dashboard
 * can be.
 *
 * No heuristic could have saved it. classifyAnonSession looks for a localhost
 * referrer, an /admin visit, two locales, a route walk — and a Playwright
 * context navigating straight to the app has none of those, because
 * behaviourally it IS a first-time visitor. Detection was never going to win.
 *
 * So the run declares itself, and this file holds the declaration together:
 * the key is one string, three scripts set it, the classifier honours it, and
 * the honouring is what the tests actually check.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SYNTHETIC_RUN_KEY } from '../analytics';
import { classifyAnonSession, type AnonSessionFeatures } from '../analytics-reporting';

const ROOT = process.cwd();

/** Every browser-driving script that can be pointed at production. */
const DRIVERS = [
  'scripts/e2e/decision-loop.mjs',
  'scripts/e2e/public-surfaces.mjs',
  'scripts/dogfood/experience/browser-walkthrough.mjs',
];

/** What a real first-time visitor looks like — and what our e2e runs looked
 *  like too, which is the whole problem. */
const LOOKS_HUMAN: AnonSessionFeatures = {
  events: 40,
  distinctEvents: 12,
  distinctPages: 3,
  referrer: null,
  utmSource: null,
  visitedAdmin: false,
  localesTouched: 1,
  visitedLegalPair: false,
};

describe('a declared machine is never counted as a person', () => {
  it('is indistinguishable from a human without the declaration', () => {
    // The control. If this ever stops being 'human', the marker is no longer
    // what is doing the work and the rest of this file proves nothing.
    expect(classifyAnonSession(LOOKS_HUMAN)).toBe('human');
  });

  it('is internal once it declares itself', () => {
    expect(classifyAnonSession({ ...LOOKS_HUMAN, synthetic: true })).toBe('internal');
  });

  it('outranks every signature that would otherwise call it human', () => {
    // Deliberately the deepest, most convincing session shape: real referrer,
    // real campaign, plenty of work done. Declaration still wins.
    expect(classifyAnonSession({
      ...LOOKS_HUMAN,
      synthetic: true,
      referrer: 'https://news.ycombinator.com/',
      utmSource: 'hn',
      events: 200,
      distinctEvents: 25,
    })).toBe('internal');
  });
});

describe('the declaration reaches the browser', () => {
  it('is one key, not three copies of a similar string', () => {
    expect(SYNTHETIC_RUN_KEY).toBe('argus:synthetic');
  });

  it.each(DRIVERS)('%s sets it before the first page script', (file) => {
    const src = readFileSync(join(ROOT, file), 'utf8');
    // addInitScript, specifically: a marker set AFTER navigation would miss
    // session_start and page_view, and a half-marked session is worse than an
    // unmarked one — it splits one run across both buckets.
    expect(src, `${file} must declare itself synthetic`).toContain('addInitScript');
    expect(src, `${file} must use the shared key`).toContain(SYNTHETIC_RUN_KEY);
  });

  it('every browser driver in the tree is covered', () => {
    // A fourth script pointed at production would repeat the whole failure, so
    // the list cannot be allowed to go quietly stale.
    const known = new Set(DRIVERS);
    const suspects = ['scripts/e2e/decision-loop.mjs', 'scripts/e2e/public-surfaces.mjs',
      'scripts/dogfood/experience/browser-walkthrough.mjs'];
    for (const s of suspects) expect(known.has(s)).toBe(true);
  });
});

describe('the report reads the declaration', () => {
  it('quarantines a synthetic session before it can be bucketed by user', () => {
    // The signed-in e2e mode authenticates as the dogfood account, so the
    // synthetic check has to come BEFORE the userId branch in bucketSession —
    // otherwise a declared machine becomes a person the moment it logs in.
    const src = readFileSync(join(ROOT, 'src/app/api/cron/daily-report/route.ts'), 'utf8');
    const fn = src.slice(src.indexOf('function bucketSession'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body.indexOf('a.synthetic')).toBeGreaterThan(-1);
    expect(body.indexOf('a.synthetic')).toBeLessThan(body.indexOf('a.userId'));
  });

  it('marks the events themselves, not just the session record', () => {
    // Attached in getSessionMeta so it rides on EVERY row. Marking at call
    // sites would leave whichever event someone forgot looking human.
    const src = readFileSync(join(ROOT, 'src/lib/analytics.ts'), 'utf8');
    const meta = src.slice(src.indexOf('function getSessionMeta'));
    expect(meta.slice(0, meta.indexOf('\n}'))).toContain('synthetic: true');
  });
});
