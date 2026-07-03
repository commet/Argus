---
name: orchestrate
description: "Alias for /recast. Use /recast instead — it does everything /orchestrate did, plus context chaining and persona generation."
argument-hint: "[goal or reframed question]"
allowed-tools: Read, Write, AskUserQuestion
---

`/orchestrate` has been merged into `/recast`.

Run `/recast` instead — it includes everything /orchestrate did:
- Governing idea + storyline
- Execution steps with AI/human assignment
- Key assumptions
- Stakeholder/persona generation for /rehearse
- Context chaining from /reframe

If the user typed `/orchestrate`, respond:

> `/orchestrate`는 `/recast`로 통합되었습니다. `/recast`를 사용해 주세요.

Then run `/recast` with the user's argument.
