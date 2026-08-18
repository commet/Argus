# MCP decline semantics — final handoff (2026-07-29)

## Resume from another computer

```powershell
git fetch origin
git switch codex/audit-mcp-209
git pull --ff-only
Set-Location argus-mcp
```

The implementation branch is `codex/audit-mcp-209` and PR #329 is the delivery
vehicle. It includes current `origin/main`; do not restart from the earlier
2.0.9 implementation.

## Current intent

This work removes the time-based inference which converted a quick MCP
`decline` into a synthetic `no_answer/unattributable` state. The MCP response
does not carry enough provenance to distinguish a policy-generated decline
from a quick intentional decline (including keyboard and accessibility use).
The server must therefore preserve the wire-level `decline` rather than make a
new decision from elapsed time.

The user-visible consequence is deliberately narrow:

- `accept` records the supplied answer.
- `decline` remains `declined`, regardless of elapsed time.
- cancellation, request failure, and unsupported elicitation remain separate
  no-answer/fallback paths.
- `check_in` reports negotiated capability, not an inferred claim that a
  client rendered a picker.

## Final structure and removals

- `argus-mcp/src/lib/elicit.ts`: removes the elapsed-time threshold, streak,
  and synthetic `unattributable` outcome.
- `argus-mcp/src/lib/ambient-elicit.ts`, `picker-fallback.ts`, and
  `src/tools/check-in.ts`: remove behavior and wording that depended on that
  synthetic outcome.
- `argus-mcp/src/lib/__tests__/decline-semantics.test.ts`: replacement tests
  for decline semantics; obsolete unreadable-decline tests are removed.
- `argus-mcp/evals/gate-coverage.mjs`: the coverage gate proves every baseline
  gate is mutation-tested or explicitly classified. The obsolete
  `evals/elicit.mjs`, its npm script, and the timing-specific
  `unreadable-decline.test.ts` are removed rather than left discoverable.
- `argus-mcp/evals/{battery,codex-app-server,host-matrix,verify-all,verify-published}.mjs`
  plus `INDEPENDENT-VERIFICATION.md`: align the verification harness and
  written protocol claims with the same rule.
- `argus-mcp/src/tools/__tests__/protocol-roundtrip.test.ts`: run against the
  real server source rather than a shared generated distribution directory.

## Verification

The focused verification passed before the release bump:

```powershell
npm run typecheck
npm test # 121 files, 1120 tests
node evals/gate-coverage.mjs
node evals/host-matrix.mjs       # 423 checks
node evals/codex-app-server.mjs  # 13 checks, real app-server
```

After the 2.0.10/3.0.10 version bump, `npm run verify` also passed end to end:
all product gates green, 26 planted regressions caught, and source-byte
restoration confirmed. `version-lockstep` reports 13 checks and zero
violations.

The actual isolated Codex TUI also rendered the live confirmation:

```text
Field 1/1
Record this prediction?
"The Codex confirmation dialog is visibly rendered"
check-by 2026-12-31

1. Allow
2. Deny
3. Cancel
```

This proves rendering, labels, content, date, and the default one-tap choice.
The desktop screenshot provider captured the wallpaper instead of the isolated
console, so no pixel screenshot is claimed. The console screen buffer was read
directly. The exact process tree, copied authentication file, isolated ledger,
and test directory were removed afterward.

## Release gate

The release is `argus-decision-mcp@2.0.10` / plugin `3.0.10`. Before merging,
run from `argus-mcp`:

```powershell
npm run typecheck
npm test
node evals/version-lockstep.mjs
node evals/gate-coverage.mjs
npm run verify
```

After PR #329 is green and merged, tag the merge commit `v2.0.10`, wait for the
publish workflow, then run:

```powershell
node evals/verify-published.mjs 2.0.10
node ..\argus-plugin-v2\scripts\install-smoke.mjs --published
```

## Boundaries

`.claude/hookify.block-claude-process-kill.local.md` is a machine-local helper
file. It is not product code and was intentionally left uncommitted.

PR #328 contains an earlier, weaker copy of `gate-coverage.mjs`. Do not merge
that file over this implementation. Its useful Codex restart instruction is
already incorporated in the README; running gate coverage twice in CI is
deliberately avoided because `npm run verify` already owns it.
