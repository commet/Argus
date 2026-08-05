/**
 * The front door could see people fail and never see anyone arrive.
 *
 * Measured against production on 2026-08-05:
 *
 *   login_attempt   146
 *   login_failure    94
 *   login_success     0        ← and `login_success` did not exist in the code
 *
 * That zero was not a finding. It was an unwired sensor, and it made the single
 * most important conversion in the product — does the front door open —
 * permanently uncomputable. Worse than uninstrumented: it looked instrumented.
 * Two thirds of the pair were there, so a reader had every reason to believe
 * the third number meant something.
 *
 * This is the gate-that-measures-nothing shape, sitting on the entrance, while
 * the same repo grew guards for it everywhere else.
 *
 * A second, quieter hole in the same place: signInWithEmail returned silently
 * when the anonymous-account transfer could not be prepared. The user saw an
 * error; the funnel recorded an attempt that never resolved either way. The
 * Google path reported that same failure, so the two doors disagreed about what
 * a failure was.
 *
 * Source-level, because there is no way to reach these branches in a unit test
 * without standing up Supabase auth — and a guard that cannot run is the thing
 * this whole file is about.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const auth = readFileSync(join(ROOT, 'src/lib/auth.tsx'), 'utf8');
const callback = readFileSync(join(ROOT, 'src/app/[locale]/auth/callback/page.tsx'), 'utf8');

/** The body of one exported/const arrow function, brace-matched from its own
 *  opening brace — the same care the snapshot round-trip guard needed. */
function bodyOf(src: string, decl: string): string {
  const at = src.indexOf(decl);
  expect(at, `${decl} not found — was it renamed?`).toBeGreaterThan(-1);
  const from = src.slice(at);
  const start = from.indexOf('{');
  let depth = 0;
  for (let i = start; i < from.length; i += 1) {
    if (from[i] === '{') depth += 1;
    else if (from[i] === '}') {
      depth -= 1;
      if (depth === 0) return from.slice(start, i + 1);
    }
  }
  throw new Error(`${decl} never closes`);
}

describe('every way in is counted', () => {
  it('email login reports success, not only failure', () => {
    const body = bodyOf(auth, 'const signInWithEmail =');
    expect(body).toContain("track('login_attempt'");
    expect(body).toContain("track('login_failure'");
    expect(body, 'a door that only reports failures cannot produce a conversion rate')
      .toContain("track('login_success'");
  });

  it('email login no longer returns silently when the transfer cannot be prepared', () => {
    const body = bodyOf(auth, 'const signInWithEmail =');
    const guard = body.slice(body.indexOf('transfer.ok'));
    expect(
      guard.slice(0, guard.indexOf('return')),
      'a blocked login must be reported, the way the Google path already does',
    ).toContain("track('login_failure'");
  });

  it('google login reports success where it actually completes', () => {
    // OAuth finishes after a full-page redirect, so the callback is the only
    // place a Google sign-in can be observed to have worked. Asserting it in
    // signInWithGoogle would be asserting it in the wrong file.
    expect(callback).toContain("track('login_success', { method: 'google' })");
    expect(bodyOf(auth, 'const signInWithGoogle =')).toContain("track('login_attempt'");
  });

  it('a refusal on the provider’s own page is not invisible', () => {
    expect(callback).toContain("reason: 'oauth_denied'");
    expect(callback).toContain("reason: 'code_exchange_failed'");
  });

  it('signup already had both halves, and keeps them', () => {
    // The control for this whole file: signup was instrumented correctly all
    // along, which is why nobody noticed login was not.
    expect(auth).toContain("track('signup_attempt'");
    expect(auth).toContain("track('signup_success'");
    expect(auth).toContain("track('signup_failure'");
  });

  it('names every auth event the funnel is allowed to expect', () => {
    // A reader of the daily report should be able to trust that each of these
    // can actually be emitted. Anything listed here and absent from the source
    // is another silent zero waiting to be misread.
    for (const event of [
      'login_attempt', 'login_failure', 'login_success',
      'signup_attempt', 'signup_failure', 'signup_success',
    ]) {
      expect(`${auth}${callback}`, `${event} is expected by the funnel but never emitted`)
        .toContain(`'${event}'`);
    }
  });
});
