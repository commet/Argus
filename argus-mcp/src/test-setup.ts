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
