# Publishing runbook — argus-decision-mcp (1.0.0, first publish under the new name)

> These steps need **your npm credentials** and run **irreversible external
> actions** (npm publish, git tag). They are a founder button — code is
> prepared, but you run the publish yourself.

## ⚠️ Why the name changed (read first)

The npm name `argus-mcp` is **already taken by someone else** (maintainer
`adesmet`, a Playwright-based browser-automation tool — verified with
`npm view argus-mcp` on 2026-07-03). We can **never** publish under `argus-mcp`
(`npm publish` → 403 not owner), and the old README install command would have
installed *their* package, not ours.

So the package is now **`argus-decision-mcp`**:

- Verified available (`npm view argus-decision-mcp` → E404).
- **Unscoped**, so there is no npm org to create and no `--access public` flag to
  remember (an unscoped name publishes public by default).
- Better search distinction — an unrelated `argus` MCP server already exists in
  the directory space.

The version resets to **1.0.0** — this is the first release under this name. The
old `1.0.0 … 1.3.0` history in the registry belongs to a different package; do
not try to continue it.

## One registry, one repo, one server.json — keep versions in lockstep

There are three places a version lives. Bump all three **in the same commit** so
they can never drift:

1. `argus-mcp/package.json` → `"version"`.
2. `argus-mcp/server.json` → `"version"` (and each `packages[].version`).
3. the `git tag` you push.

## Step 1 — one-time credentials

```bash
npm login   # 2FA; `npm whoami` must return your username (it was E401 in the build session)
```

## Step 2 — build, test, publish from current main

```bash
cd argus-mcp
npm ci
npm run build && npm test          # prepublishOnly runs these again as a gate
node evals/run-premises.mjs        # optional: needs ANTHROPIC_API_KEY

npm publish                        # unscoped → public by default, no --access needed
git tag argus-decision-mcp-v1.0.0 && git push --tags
```

## Step 3 — clean-install round-trip (the human-eyes final gate)

Do this in a **fresh empty folder** so you are testing the *published* package,
not your local checkout. This is the last gate before you tell anyone to install.

```bash
mkdir /tmp/argus-test && cd /tmp/argus-test
npx -y argus-decision-mcp          # OUR server must start — not adesmet's playwright tool
# then, from an MCP host or the inspector:
#   tools list → argus_seal (a future check_by) → argus_settle → Judgment Receipt
#   confirm the receipt line reads:  AI VERDICT … NONE
```

```bash
# optional manual poke with the inspector, against the built local tree:
npx @modelcontextprotocol/inspector node dist/index.js
# check: tools list shows argus_premises / argus_recheck; call argus_check_in;
# read resource argus://premises/due; get prompt argus-settle.
```

The automated equivalent of the protocol round-trip already runs in CI
(`src/tools/__tests__/protocol-roundtrip.test.ts` spawns the built server over
stdio and walks initialize → tools → journey → resources → prompts), but the
published-package install can only be verified by hand.

## Step 4 — official MCP registry (optional, but it's the single source many
## directories crawl)

`server.json` is already written (name `io.github.commet/argus-decision-mcp`,
one npm package entry, stdio transport). Publishing it makes Smithery / mcp.so /
glama pick us up from one place.

```bash
mcp-publisher login github          # binds the io.github.commet namespace to the commet GitHub account
mcp-publisher publish               # npm ownership is checked via the package.json `mcpName` field
```

Verify afterward: `argus-decision-mcp` shows up at
registry.modelcontextprotocol.io.
