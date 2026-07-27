<!-- Supporting file for /argus:review. Not a standalone skill. -->

# Deep review team

Use this step only inside an explicitly requested deep review. Standard Argus
uses no team.

## Bounds

- Select at most two specialists.
- `domain-reviewer` is the default specialist.
- Add `evidence-reviewer` only when external or factual claims are load-bearing.
- Add `risk-reviewer` only for critical or hard-to-reverse decisions. It is the
  one permitted third pass.
- Run selected specialists independently, then produce one synthesis.
- Never create persona debates, majority votes, recursive review, or an
  unbounded “agent council”.

## Target

Resolve the actual artifact before dispatch. Supported `target_type` in `{pr, file, branch, issue, design_doc, plan}`. When
`target_context.kind == "plan"`, the plan text itself is the artifact under
review, not surrounding chat.

If a target cannot be resolved safely, stop and report that one blocker.

## Dispatch

Give every specialist the same neutral context:

- the user’s decision question and current course;
- exact artifact paths, refs, or extracted text;
- constraints and known facts;
- the requested output contract.

Do not reveal another reviewer’s conclusion or the orchestrator’s lean.

For code decisions, include a developer payload with:

- changed behavior and affected surface;
- relevant files, tests, and runtime constraints;
- missing test/check;
- security, privacy, migration, and rollback implications when applicable.

Each specialist returns a `worker-result.json`-compatible object containing:

```json
{
  "agent_id": "domain-reviewer",
  "summary": "one compact finding",
  "findings": [
    {
      "claim": "specific claim",
      "support": ["file:line, command result, or source URL"],
      "confidence": "high|medium|low"
    }
  ],
  "hidden_assumptions": ["at most the material assumptions"],
  "tradeoffs": ["decision-relevant trade-offs"],
  "human_required_checkpoints": ["checks AI cannot complete"]
}
```

Evidence must be inspectable. Missing evidence is an explicit limitation, not a
reason to improvise.

Synthetic output contributes zero E SupportUnits. Multiple model perspectives
are one independence unit unless grounded in distinct external evidence.

## Synthesis

The main model may synthesize directly. Use `synthesizer` only when the
findings are substantial or a targeted revision is requested.

Write one scaffold that:

1. states the current course without pretending Argus owns it;
2. separates supported, challenged, and human-required claims;
3. preserves contradictions with source attribution;
4. names one load-bearing assumption;
5. identifies the path not taken and the practical next checks;
6. proposes at most one falsifiable return condition.

Do not expose model names, worker counts, or orchestration mechanics in the
default user-facing result.

## Revision

Route a narrow correction back to its originating specialist. Route
cross-cutting synthesis changes to `synthesizer`. Run one revision pass and
re-verify materially changed claims; never loop automatically.

## Failure handling

- Missing specialist file: continue with the remaining bounded roles and state
  the limitation in the session artifact.
- Tool or source failure: preserve the failed check as human-required.
- Conflicting findings: preserve both; do not vote.
- No material finding: return the concise standard scaffold.
