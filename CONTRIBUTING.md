# Contributing to Argus

Thanks for taking the time to contribute. This guide covers how the repository
is laid out, how to run and verify it locally, and what a reviewable pull
request looks like.

> 한국어 사용자: 핵심만 — Node 20, `npm ci`로 설치, `npm test`/`npm run lint`/
> `npx tsc --noEmit`가 통과해야 하고, 동기화 필드를 바꿀 땐 마이그레이션과
> 가드 테스트를 같은 커밋에 넣어주세요. 아래 영문 절이 상세 규약입니다.

---

## Repository layout

This repo is **open-core**: the web app and the developer tooling live side by
side but ship under different licenses.

| Path | What it is | License |
|------|-----------|---------|
| `src/` | The Next.js 16 web application (the product) | PolyForm Noncommercial 1.0.0 |
| `argus-plugin-v2/` | The Claude Code plugin — **the canonical plugin** | MIT |
| `argus-mcp/` | The MCP server (published as `argus-decision-mcp` on npm) | MIT |
| `docs/` | Design notes and architecture records. Dated files under `docs/archive/` are historical; start from `docs/README.md` | — |
| `supabase/` | SQL migrations for the hosted database | — |

Because the two halves are licensed differently, **please keep a pull request on
one side of the line**: a change to `src/` (Noncommercial) and a change to the
MIT-licensed plugins are best sent as separate PRs.

## Prerequisites

- **Node 20** (matches CI)
- npm (the repo ships a `package-lock.json`)

## Getting started

```bash
# 1. Install the web app's dependencies
npm ci

# 2. The MCP server is a separate package — install it too if you touch it
#    (its tests run from the root vitest sweep)
npm ci --prefix argus-mcp

# 3. Copy the environment template and fill in what you need.
#    The app runs offline (localStorage-first); Supabase/LLM keys are optional
#    for most UI work. See .env.example for what each var unlocks.
cp .env.example .env.local

# 4. Run the dev server
npm run dev
```

## Verifying your change

CI runs on every pull request and **must be green before review**. Run the same
checks locally first — they are fast:

```bash
npx tsc --noEmit     # types (strict mode — no `any` escape hatches)
npx eslint src/      # lint (0 errors; warnings are tolerated but don't add new ones)
npm test             # the full vitest suite (~2,800 tests)
npm run build        # optional, but catches Next.js build-time issues
```

Beyond the standard checks, CI also enforces a set of **Argus "spine" gates**
(`argus-plugin-v2/`): the zero-judgment static gate, enforcement hard-block,
generated-contract sync, and install smoke test. These are hard blocks, not
advisories. If one fails on your PR, read the job log — it names the invariant
you tripped.

## Conventions that reviewers check

These come from `CLAUDE.md` (worth reading in full before a non-trivial change):

1. **Schema sync.** If you add a field to a *synced* interface (anything in
   `stores/types.ts` that reaches Supabase), add the column via a migration **in
   the same commit** and update the guard test (`src/lib/__tests__/schema-drift.test.ts`).
   A missing column makes PostgREST silently reject the whole row — the guard
   test exists to stop that. New user-scoped tables must also be registered for
   account deletion/export coverage.
2. **Single source of truth for prompts.** Don't copy a system prompt to a
   second surface. Extract it to a shared `*-core.ts` (see `src/lib/reframe-core.ts`
   for the pattern the web app and the bot both consume).
3. **Persistence declaration.** New user-input storage keys go in `STORAGE_KEYS`
   and are declared in `persistence-contract.test.ts` as synced or local-only.
4. **Defensive data access.** Treat localStorage, LLM output, and Supabase merges
   as possibly-missing fields — optional chaining + fallbacks.
5. **Fail loud, or surface honestly — never fabricate.** A missing input or a
   no-fit result must be named, not filled in by the model. (See the "LLM-glue
   invariant" in `CLAUDE.md`.)

## Pull requests

- Branch from `main`, keep the PR focused on one concern.
- Fill in the PR template. A short "why", a "what changed", and how you verified
  it is enough.
- Make sure `npx tsc --noEmit`, `npm run lint`, and `npm test` pass locally.
- By opening a PR you agree your contribution is licensed under the license of
  the directory you changed (PolyForm Noncommercial for `src/`, MIT for the
  plugins and MCP server).

## Reporting bugs and requesting features

Use the issue templates. For **security vulnerabilities, do not open a public
issue** — follow `SECURITY.md` and contact the maintainer privately.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By
participating you are expected to uphold it.
