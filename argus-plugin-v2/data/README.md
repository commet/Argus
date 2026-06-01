# Argus Plugin Data

This directory is the **reference data** consumed by plugin skills at runtime. It is generated from the webapp's source of truth and should be regenerated when the webapp changes.

## Files

| File | Purpose | Source |
|------|---------|--------|
| `agents.yaml` | 17 agent profiles — identity, capabilities, frameworks, voice markers, worker-mode dialogues | `src/lib/agent-registry.ts`, `worker-personas.ts`, `agent-capabilities.ts`, `orchestrator-framework.ts` |
| `boss-types.yaml` | 16 MBTI boss personality types | `src/lib/boss/personality-types.ts` |
| `classification.yaml` | Task/domain/output vocab + stakes rules | `src/lib/task-classifier.ts`, `orchestrator-classify.ts` |
| `schemas/*.json` | JSON Schema contracts for plugin artifacts | `src/stores/types.ts` |

## Regenerate from webapp

When `src/lib/agent-registry.ts` or related files change:

```bash
# From the monorepo root
cd argus-plugin-v2
# (Currently manual — port updates by diffing webapp source against yaml entries.)
# Future: scripts/extract-from-webapp.ts will automate this.
```

The plugin holds **data copies**, not live references. Webapp can change independently; plugin stays frozen until regeneration.

## What's INTENTIONALLY different from webapp

1. **No experience/observation system** — agents don't level up in plugin MVP. `agents.yaml` has no `level` or `observations[]` fields.
2. **No daily mood / Saju** — boss simulation uses MBTI only. `boss-types.yaml` excludes `exampleDialogues` beyond one entry per type (space), and excludes `innerMonologueExample` entirely.
3. **Worker-mode dialogues** — agents' `worker_mode_examples[]` are NEW (written for plugin). Webapp has critic-mode persona prompts; plugin dialogues show agents PRODUCING artifacts in their voice. This is the M9 differentiator.
4. **Stakes classification at runtime** — plugin skills classify via LLM using `classification.yaml` as vocabulary reference, NOT via deterministic regex. Webapp uses regex + LLM hybrid.
5. **FinalScaffold** — plugin emits decision scaffold, NOT the markdown `final_deliverable` webapp produces. `data/schemas/final-scaffold.json` is plugin-only.

## What's EXACTLY mirrored from webapp

1. Agent canonical IDs, persona_ids, framework_keys (`agent-registry.ts`).
2. Capability profiles (`agent-capabilities.ts` — task_types/domains/output_types/anti_patterns).
3. Framework priority per decision type (`orchestrator-framework.ts`).
4. MBTI type structural fields (`personality-types.ts` — code/name/communicationStyle/feedbackStyle/triggers/speechPatterns/bossVibe/speechLevel).
5. Version numbering algorithm (`version-numbering.ts` — ported to `lib/session/version-numbering.md`).
6. Draft tree model (`stores/types.ts:Draft` + `useProgressiveStore.addDraft`).

## Drift monitoring

When regenerating, diff against:
- `src/lib/agent-registry.ts:AGENT_REGISTRY` vs `agents.yaml` agent list
- `src/lib/agent-capabilities.ts:AGENT_CAPABILITIES` vs each agent's `capabilities` block
- `src/lib/boss/personality-types.ts:PERSONALITY_TYPES` vs `boss-types.yaml`

If webapp adds a new agent, adds a capability type, or changes framework preferences, regenerate this data before the next plugin release.
