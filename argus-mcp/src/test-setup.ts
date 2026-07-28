/**
 * Tests must never reach the real account API.
 *
 * Several suites set `ARGUS_TOKEN` to exercise the sync paths, and seal / settle /
 * amend / dismiss all push to the account when a token is present. Today every
 * one of those suites mocks `fetch` — but that is a convention, not a guarantee.
 * A future test that sets a token and forgets the mock would quietly POST to
 * https://argus.voyage with a junk bearer token, from CI, from a laptop, from
 * anywhere, and nothing would turn red.
 *
 * Point the API at a closed local port instead. `resolveApiBase` allows plain
 * http for localhost (the self-host dev path), so the request is well-formed and
 * simply fails to connect: the push degrades to `{synced:false, reason:'network'}`
 * exactly as it would offline. Egress becomes impossible rather than merely
 * unintended.
 */
process.env.ARGUS_API_URL = 'http://127.0.0.1:1';

/**
 * Tests must never depend on the developer's OS locale (§9.7 O1 방1).
 *
 * The locale chain's last step is osLocaleHint (LANG/LC_ALL, else Intl). On a
 * Korean-locale Windows machine the Intl fallback resolves ko, which made 4
 * tests red locally while green on en-locale CI — the suite's "en baseline"
 * was an unstated ASSUMPTION about the machine. Pin it instead: every test
 * runs against an explicit en env unless it sets a locale env itself
 * (init-locale-seed's ko case does exactly that). Content-driven Korean
 * (Hangul text) still resolves ko through this pin — only the env/Intl
 * fallback is being made deterministic.
 */
process.env.LANG = 'en_US.UTF-8';
delete process.env.LC_ALL;

/**
 * Tests must never touch the real user home (§9.7 O1 방1 — the 2026-06-15
 * incident class: an eval run wrote locale:en into a real config and every
 * later surface spoke English; and writeBoundMarker registers every init'd
 * dir into ~/.argus/.bound, so ANY seal/init test was appending to the real
 * registry with nothing turning red).
 *
 * os.homedir() reads USERPROFILE (Windows) / HOME (POSIX) per call, so
 * redirecting both to a per-worker temp dir isolates every zero-config
 * default (~/.argus, the global .bound registry, v2 durable ledger homes)
 * without mocking. Tests that fake a home explicitly (vi.spyOn homedir)
 * keep winning over this.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
const TEST_RUN_ID = process.env['ARGUS_TEST_RUN_ID'] ?? `standalone-${process.pid}`;
const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), `argus-test-${TEST_RUN_ID}-home-`));
process.env.HOME = TEST_HOME;
process.env.USERPROFILE = TEST_HOME;
process.once('exit', () => {
  try {
    fs.rmSync(TEST_HOME, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  } catch {
    // Do not replace the actual test verdict during worker shutdown.
  }
});
afterAll(() => {
  fs.rmSync(TEST_HOME, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
});
