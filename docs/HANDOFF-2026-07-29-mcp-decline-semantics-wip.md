# MCP decline semantics — WIP handoff (2026-07-29)

## Resume from another computer

```powershell
git fetch origin
git switch codex/audit-mcp-209
git pull --ff-only
Set-Location argus-mcp
```

The working branch is `codex/audit-mcp-209`. Its base at the time of this
handoff is `914fa9ab` (`origin/main`, "Merge pull request #326").

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

## Files changed in this WIP

- `argus-mcp/src/lib/elicit.ts`: removes the elapsed-time threshold, streak,
  and synthetic `unattributable` outcome.
- `argus-mcp/src/lib/ambient-elicit.ts`, `picker-fallback.ts`, and
  `src/tools/check-in.ts`: remove behavior and wording that depended on that
  synthetic outcome.
- `argus-mcp/src/lib/__tests__/decline-semantics.test.ts`: replacement tests
  for decline semantics; obsolete unreadable-decline tests are removed.
- `argus-mcp/evals/gate-coverage.mjs`: new coverage gate; obsolete
  `evals/elicit.mjs` and its package script are removed.
- `argus-mcp/evals/{battery,codex-app-server,host-matrix,verify-all,verify-published}.mjs`
  plus `INDEPENDENT-VERIFICATION.md`: align the verification harness and
  written protocol claims with the same rule.
- `argus-mcp/src/tools/__tests__/protocol-roundtrip.test.ts`: run against the
  real server source rather than a shared generated distribution directory.

## Verification status — do not overstate

The resumed Codex session had started targeted and full test commands, but its
final exit summaries were not captured in this handoff. Treat this commit as a
checkpoint, **not a verified release candidate**. Re-run from `argus-mcp`:

```powershell
npm run typecheck
npm test
node evals/gate-coverage.mjs
node evals/host-matrix.mjs
node evals/codex-app-server.mjs
```

Then inspect the changed verification commands and documentation together:

```powershell
git diff origin/main -- argus-mcp
```

## Required follow-up decisions/checks

1. Confirm that the project policy accepts preserving protocol `decline` even
   when a restrictive Codex policy may have generated it without rendering UI.
   The alternative needs an explicit host-provided provenance marker; response
   time is not sufficient evidence.
2. Ensure every removed `unattributable` reference is intentional:

   ```powershell
   rg -n "unattributable|UNREADABLE_DECLINE|elicitationLikelyBlocked|resetElicitObservations" argus-mcp
   ```

3. If all verification passes, open a PR from `codex/audit-mcp-209`; do not
   publish or tag an npm release as part of this checkpoint.

## Deliberately excluded

`.claude/hookify.block-claude-process-kill.local.md` is a machine-local helper
file. It is not product code and was intentionally left uncommitted.
