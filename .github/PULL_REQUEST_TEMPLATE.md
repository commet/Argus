<!--
Thanks for contributing to Argus! Keep PRs focused on one concern.
See CONTRIBUTING.md for the full guide. Delete any section that doesn't apply.
-->

## What & why

<!-- What does this change do, and why is it needed? One or two sentences. -->

## Changes

<!-- Bullet the notable changes. -->

-

## How I verified it

<!-- Which of these did you run? Paste anything surprising. -->

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes (no new warnings)
- [ ] `npm test` passes
- [ ] Exercised the affected surface manually (describe how)

## Checklist

- [ ] PR touches only one license zone (`src/` **or** the MIT plugins/MCP — not both)
- [ ] If a **synced** field changed: migration + `schema-drift` guard test updated in the same commit
- [ ] If a new **prompt** was added: it lives in a shared `*-core.ts`, not copy-pasted
- [ ] No secrets, tokens, or `.env` values committed
