# Publishing runbook — living premises (1.2.1 → 1.3.0)

> Written 2026-07-02 while shipping the living-premises feature. Publishing
> needs YOUR npm credentials (`npm whoami` returned E401 in the build session).

## ⚠️ Registry state discovered (read first)

The npm registry already has: `1.0.0, 1.1.0, 1.1.1, 1.2.0` (latest = 1.2.0),
while this repo's `package.json` sat at `1.0.0` until now. **Publishes have been
made without bumping the version in-repo.** Two consequences:

1. The feature release is versioned **1.3.0** here (a plain 1.1.0 bump would
   collide with the already-published 1.1.0 and be rejected).
2. Going forward, bump `argus-mcp/package.json` in the same commit you publish
   from, so the repo and the registry can't drift again.

## Order matters: publish the tolerant-replay patch FIRST

Installs pinned at ≤1.2.0 count unknown ledger events as **corruption**. The
moment any 1.3.0 binary writes a `premise_*` event into a shared ledger, those
older installs report a false integrity alarm. `1.2.1` (tolerant replay only,
no premises) closes that window for anyone who takes the patch.

### Step 1 — publish 1.2.1 (tolerance only)

```bash
npm login   # once

# a clean tree at the tolerance-only commit (pre-premises):
git worktree add ../argus-121 2327f1d
cd ../argus-121/argus-mcp
npm ci
npm version 1.2.1 --no-git-tag-version
npm run build && npm test
npm publish
cd - && git worktree remove ../argus-121
```

### Step 2 — publish 1.3.0 (living premises) from current main

```bash
cd argus-mcp
npm ci
npm run build && npm test          # 156 tests, incl. the stdio protocol round-trip
node evals/run-premises.mjs        # optional: needs ANTHROPIC_API_KEY
npm publish                        # package.json is already 1.3.0
git tag argus-mcp-v1.3.0 && git push --tags
```

### Step 3 — optional manual smoke (the human-eyes pass)

```bash
npx @modelcontextprotocol/inspector node argus-mcp/dist/index.js
# check: tools list shows argus_premises / argus_recheck; call argus_check_in;
# read resource argus://premises/due; get prompt argus-settle.
```

The automated equivalent already runs in CI:
`src/tools/__tests__/protocol-roundtrip.test.ts` spawns the built server over
stdio and walks initialize → tools → journey → resources → prompts.
