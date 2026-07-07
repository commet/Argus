# Publishing runbook — argus-decision-mcp

These steps need **your npm credentials** and run irreversible external actions
(`npm publish`, git tag, optional MCP registry publish). The code can prepare the
release, but a human owner should press the publish button.

## Why the name changed

The npm name `argus-mcp` is already taken by someone else (maintainer `adesmet`,
a Playwright-based browser-automation tool). Publishing there is impossible, and
the old install command would install the wrong package.

The public package is **`argus-decision-mcp`**.

The first release under this name was `1.0.0` on 2026-07-03. The old
`argus-mcp` version numbers are pre-rename history and must not be reused for
the new package line.

## Keep versions in lockstep

There are three places a release version lives. Bump all three in the same
commit:

1. `argus-mcp/package.json` → `"version"`.
2. `argus-mcp/server.json` → `"version"` and `packages[].version`.
3. the git tag, e.g. `argus-decision-mcp-v1.1.0`.

`src/lib/__tests__/publish-metadata.test.ts` enforces the package/server
metadata and the top CHANGELOG entry.

## Preflight

```bash
cd argus-mcp
npm ci
npm run typecheck
npm test
npm audit --omit=dev
npm pack --dry-run
```

Check the dry-run output before publishing:

- package name: `argus-decision-mcp`
- binary: `argus-decision-mcp -> dist/index.js`
- no `dist/**/__tests__/**`
- no `dist/test-helpers.js`
- no local `.argus/`, token, or eval output

## Publish

```bash
cd argus-mcp
npm whoami
npm version 1.1.0 --no-git-tag-version   # or the next release version
npm install --package-lock-only
npm run typecheck && npm test && npm audit --omit=dev
npm publish                              # unscoped -> public by default
git tag argus-decision-mcp-v1.1.0
git push --tags
```

`prepack` rebuilds `dist/` from `tsconfig.build.json`, so the tarball contains
runtime files only. `prepublishOnly` gates the publish on typecheck, tests, and
production audit.

## Published-package smoke

Do this in a fresh empty folder so you test the published package, not the local
checkout:

```bash
mkdir /tmp/argus-test && cd /tmp/argus-test
npx -y argus-decision-mcp
```

Then, from an MCP host or the inspector, verify:

- tools list includes `argus_premises` and `argus_recheck`
- `argus_check_in` works
- `argus://premises/due` reads
- `argus-settle` prompt loads
- the receipt line reads `AI VERDICT ... NONE`

The automated protocol smoke is
`src/tools/__tests__/protocol-roundtrip.test.ts`.

## MCP registry

`server.json` is written for the official MCP registry:
`io.github.commet/argus-decision-mcp`, one npm package entry, stdio transport.

```bash
mcp-publisher login github
mcp-publisher publish
```

Verify afterward that `argus-decision-mcp` appears at
registry.modelcontextprotocol.io.
