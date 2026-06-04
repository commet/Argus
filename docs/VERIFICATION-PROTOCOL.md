# ARGUS — Claim Verification Protocol

> Standing law for any plan, audit, or change that makes a **load-bearing claim** about the codebase.
> Born from a root-cause of 26 precision errors in the master-plan synthesis (16 imprecise / 5 unverifiable / 4 wrong / 1 stale). Root cause: **assert-at-a-distance** — citing `file:line`, counts, locations, "already exists", and fix mechanisms without opening the full source, single-pass, with no independent re-read.
> Every workflow/agent that touches the plan MUST obey this. Reviewers reject any load-bearing claim that violates a rule below.

---

## 0. Definitions

- **Load-bearing claim** = any statement the plan's decisions depend on: a `file:line` assertion, a count, a "X exists / is empty / is reused", a symbol's location, a bug mechanism, a proposed fix mechanism, a coupling/dependency set, a test-coverage claim.
- **Claim tag** — every load-bearing statement carries one:
  - `[VERIFIED: <file:line + quoted source>]` — opened and read this turn.
  - `[INTENT]` — a design choice/desire, NOT a fact about current code.
  - `[ASSUMPTION: <how to verify>]` — not yet checked; names the check needed. **Never** load-bearing until upgraded to VERIFIED.

---

## 1. The Seven Error Classes (and the rule that kills each)

| # | Error class | What went wrong | RULE |
|---|---|---|---|
| **E1** | Line asserted at a distance | cited `file:line` without opening it | **Quote it.** No `file:line` is load-bearing unless the exact lines were read this turn and the relevant source is quoted in the evidence. Inherited line numbers are `[ASSUMPTION]` until re-opened. |
| **E2** | Cited-line-only read | read the one line, missed the enclosing guard / other branch | **Read the whole block.** Read the entire function/branch and trace every enclosing guard before claiming a crash, a guard, or "safe". State which branch fires **in production** (find the real caller). |
| **E3** | "Reuse / already exists" unproven | claimed reuse without checking the data actually flows | **Prove producer AND consumer.** For any "already exists / half-built / just repoint it", grep and name BOTH the writer and the reader, and confirm they are wired in a production path. If one side is missing, it is **net-new**, not reuse. |
| **E4** | Name-association attribution | assumed a symbol's file by its name | **Grep the definition.** Never attribute a symbol's location by association — grep its definition site and cite it. |
| **E5** | Counts/sets from memory | asserted a count or a member list without enumerating | **Enumerate fresh.** Every count or set (callsites, imports, coupled stores, usages) = a fresh exhaustive grep this turn, with the command/result shown. Never inherit a count; never reuse a prior count without re-running it. |
| **E6** | Mechanism unchecked | proposed a fix using an API without checking its semantics/ownership | **Verify the mechanism's contract.** For any proposed fix, confirm the API/ownership it relies on supports it (who owns the AbortSignal? is the value nullable? is the table soft-deletable?). Cite the contract. |
| **E7** | Intent stated as fact | wrote a desire ("is a maintainability gate", "all tokens exist") as verified | **Tag intent vs fact.** Blanket "all X exist / X is Y" claims must either enumerate every member or be tagged `[INTENT]`/`[ASSUMPTION]`. Only facts carry `[VERIFIED]`. |

---

## 2. Per-claim checklist (run before any claim is load-bearing)

1. Did I open the exact `file:line` **this turn** and quote it? (E1)
2. Did I read the full enclosing block + all branches, and name the production path? (E2)
3. If I said "reuse/exists/half-built": did I grep and name **both** producer and consumer? (E3)
4. If I named a location: did I grep the **definition site**? (E4)
5. If I gave a count/set: did I run a **fresh exhaustive grep** and show it? (E5)
6. If I proposed a fix mechanism: did I verify the **API/ownership contract**? (E6)
7. Is this a **fact** or an **intent/assumption**? Tagged accordingly? (E7)

## 3. Process rules

- **Two-pass on high-risk classes.** Counts (E5), reuse claims (E3), attributions (E4), and mechanisms (E6) get an independent **second reader** — these are where errors cluster.
- **Class sweeps, not just spot-fixes.** When one error of a class is found, sweep the *whole document* for that class — the failure is systemic, not local.
- **Direction vs specifics.** When a claim's direction is right but a specific is wrong, keep the direction, fix the specific, and mark `(corrected: …)`. Do not discard the finding.
- **No silent inheritance.** A claim carried over from a prior workflow without re-verification this turn is `[ASSUMPTION]`, never `[VERIFIED]`.

---

## 4. Acceptance for any "verified plan"

A plan may be called *verified* only when: every load-bearing claim is `[VERIFIED]` with quoted source OR explicitly tagged `[INTENT]`/`[ASSUMPTION]`; every count/set was freshly grepped; every reuse claim names producer+consumer; every mechanism names its contract; and a final adversarial pass found no un-evidenced load-bearing claim.
