# Experience testers

Two tools that answer a different question from the structural dogfood runner.
The runner (`scripts/dogfood/`) proves the *plumbing* is correct. These prove
the *lived experience* — does a real person complete the loop, does typed
content land, is the flow navigable — and hand you the raw material (screens,
transcripts) to judge UX yourself.

**Honest limit:** neither tool renders a verdict on whether the UX is *good* or
*useful*. A machine can't feel that, and an LLM grading its own product is the
"plausible ≠ verified" trap. These prove the loop *works* and surface *breakage*;
the taste call stays yours.

## 1. Browser loop walkthrough — `npm run experience:web`

Drives the real web app in a real browser like a person: logs in, types a
decision, walks the progressive loop by clicking the primary call-to-action on
each screen, and **screenshots every screen** into a timestamped folder. It also
auto-surfaces console errors, failed network requests, visible error banners,
and the case where your typed decision *disappears* from later screens.

```bash
ARGUS_BASE_URL=https://argus.voyage \
DOGFOOD_EMAIL=... DOGFOOD_PASSWORD=... \
npm run experience:web
```

Options (env): `ARGUS_LOCALE=ko|en`, `HEADLESS=false` (watch it click live),
`ARGUS_DECISION="your sentence"`, `MAX_STEPS=16`, `PW_EXECUTABLE=/path/to/chrome`.

Output → `scripts/dogfood/experience/shots/<timestamp>/`:
`NN-*.png` screens + `summary.md` (steps walked, milestone reached, whether
content landed, and every issue auto-surfaced). **Flip through the screenshots
in order — that IS the UX review.**

Uses a disposable test account (same as `dogfood:prod`). On your machine
Playwright uses its own installed browser; no path setup needed.

Engine self-test (offline, no account, proves the walker mechanics against a
fake local flow): `npm run experience:web:selftest`.

## 2. Terminal flow exercise — `npm run experience:terminal`

Drives the real `argus-watch` CLI through the decision-ledger lifecycle a
terminal user lives — **candidate → seal → due → settle → ledger** — captures
exactly what they'd see at each command, and proves the content lands in the
append-only local ledger.

```bash
npm run experience:terminal
```

Offline, no account. The only stubbed step is `scan`'s LLM decision-detection
(it needs your real Claude Code transcripts + a model); everything after the
candidate exists is the real CLI. Output →
`scripts/dogfood/experience/terminal-runs/<timestamp>/` with `transcript.txt`
(what the terminal user sees) and the resulting `ledger.jsonl`.

## What these do NOT cover

- Telegram bot taps (a human must tap a real bot; see the handoff P7 checklist).
- LLM content *quality* (a separate capture harness, not built yet).
- Whether the experience is *pleasant* — that's your call from the artifacts.
