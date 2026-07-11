# Argus MCP v2 — 설계 계보 (비정본)

> 이 파일은 정본이 아니다. 정본은 `docs/ARGUS-MCP-V2-SPEC.md`(Part I·II)뿐이며,
> 이 파일의 어떤 문장과 충돌하든 정본이 이긴다. 여기 담긴 것: 13-agent 합성 원본,
> 개정 R1~R5, 외부 감사(Codex/Sol 1~3차) 판정 기록 — 구현 근거와 결정의 계보.
>
> Sol 3차 판정 메모 (2026-07-11): 10개 보완 + 매트릭스 6행 + 소정정 채택, 정본에 반영
> (worktree 내구 원장, 플러그인 상태/자산 분리, 데이터 수명주기 계약, 이벤트 인벤토리,
> 멱등 정밀화, untrusted quote 경계, 링크/경로 provenance, due 공정 큐, 수확 클레임-온리,
> Part III 물리 분리). 반복된 "브랜치 대규모 무관 변경" 주장은 재검증 결과 사실 아님
> (origin/main 대비 파일 1개) — 단 클린 구현 브랜치 규칙(정본 규칙 17)은 유지.

> 아래는 본 정본이 만들어진 과정의 기록이다: 13-agent 합성 원본과 개정 R1~R5,
> 외부 감사 판정들. **규칙이 Part I·II와 다르게 읽히는 곳은 전부 Part I·II가 이긴다.**
> 여정 대본·수확 파이프라인 상세·도구별 세부는 여기 원문을 참조하되, 위 정본 규칙
> 전부를 항상 우선 적용할 것 (개수는 정본이 정한다 — 이 파일의 수치 참조는 낡았을 수 있음).

# Argus MCP v2 — 확정 스펙 (재건축 정본 후보)

> **상태**: 창업자 검토 대기 (승인 시 BLUEPRINT §9 M-트랙의 정본으로 앵커 — 앵커 커밋은 창업자 결정)
> **유래**: 2026-07-10 창업자 지시("서비스 기획 단계부터 재검토, 문서로 작성")로 작성.
> 13-agent 설계 라운드(코드 근거 고정 3 → 독립 설계 3 → 척추·현실 감사 6 → 합성 1) 산출물에
> 개정 R1(여정 최적화)·R2(Codex 외부 감사 반영)·R3(생태계 층, Osaurus 벤치마크)을 통합한 판.
> **한 줄 요약**: v1은 [모델 순종 × 사용자 기억 × 미연결 토큰]의 직렬 사슬 위에서 죽었다.
> v2는 모든 트리거를 제품이 소유한 레일(훅·파일·git) 위로 옮기고, LLM 요소는 전부
> 사용자가 당기거나(opt-in) 안전망으로 강등한다. Claude Code에서 완전한 루프,
> 그 외 호스트는 정직한 "기록·정산 컴패니언" 티어.

---

## 설계 3안에 대한 판정 (무엇을 취하고 버렸나)

**From Design 2 (systems-first)** I took the skeleton: one append-only ledger, one pure reducer, write-through projections — brief, LOGBOOK.md, statusline, check_in all render byte-identical state, which structurally satisfies the repo's LLM-glue invariant. Also adopted: the argus_candidates/argus_debrief pair (debrief as an LLM-free quote validator with loud QUOTE_NOT_FOUND rejection), the honest-gap surface, and "escorted-fragile" honesty about the settle link. Rejected: its 16-tool surface, the text/quote display split (provenance laundering), the unverified "plugin-declared statusline" claim, and keyword-triggered pattern injection into model context.

**From Design 3 (minimalist)** I took the posture: gate-first capture (keyword scan only *nominates*; argus_open_decision runs before any question is voiced), the git commit as the deterministic landing moment, server-written LOGBOOK.md (deterministic on all hosts, no hook needed), aggressive consolidation with near-zero adds, killing sync-as-tool/Stop/PreToolUse/21-skills/17-agents, silence-as-product, and the 5-real-user go/no-go gate. Rejected: its form-before-gate anchor nudge as written (the documented 60% flat-over-fire mode), killing argus_check_in (routing risk on hook-less hosts), sequencing the harvest net *after* the gate that needs it (circularity), and "당신이 쓴 문장" copy for Keep-path seals.

**From Design 1 (journey-first)** I took the discipline that every tool must have a named day-N moment, per-item once-per-calendar-day dedupe (replacing both incoherent budget readings), per-surface mutes, snooze semantics with the "identical brief never fires two consecutive days without a state change" test, candidate auto-expiry, and RetroSeal for the empty Day 0. Rejected: unconditional every-SessionEnd extraction (fork-bomb, unconsented spend, flat-day ceremony — killed by all four auditors), the Stop-hook completion mirror, and machine-edited user-owned bearing lists.

**Dead everywhere and stays dead:** background LLM harvest as a default-on, load-bearing capture channel. It returns only as an opt-in, consent-gated, abstain-default, one-candidate safety net *after* the deterministic loop passes its gate. Also dead: cross-host parity claims — v2 is Claude-Code-first; Codex/Cursor get an honestly-labeled resurface-and-settle companion tier.

**The decisive synthesis move:** capture is deterministic-first (gate-fired anchor + commit landing + an LLM-free "opened-but-unsealed" next-morning line), and every LLM element (harvest, debrief) is user-pulled or opt-in and never on the go/no-go critical path.

---

# Argus MCP v2 — Definitive Spec

## 0. Organizing thesis

V1 died before the first tool call: activation rode on host-model compliance × user memory × a token nobody configures. V2 moves every trigger onto rails the product itself owns — **one append-only ledger, one pure reducer, many cheap deterministic projections** — delivered as **one Claude Code plugin that bundles the MCP engine** (`.mcp.json`), so hooks and tools install in one command. The MCP server stays a passive, LLM-free transactor. Every LLM element is user-pulled or consent-gated and never load-bearing for the core loop. Restraint is mechanical, not aspirational: fire-or-not gates run **before** any question form, per-item dedupe caps repetition in code, and silence at zero is the designed rest state. Where a link cannot be made deterministic, it is named, measured, and hedged — never claimed closed.

Positioning (fixed): **Claude-Code-first product with a portable engine.** Codex/Cursor get an honestly-labeled "기록·정산 컴패니언" tier. Capability F (loop closure) is claimed only on Claude Code.

## 1. Architecture

```
┌─ ENGINE: argus-decision-mcp (npm, MIT, universal) ─────────────┐
│  .argus/ledger/ledger.jsonl  ← single append-only source of truth
│  ONE pure reducer → BriefState {overdue, due, candidates, bearing,
│                                  counts, honest_gaps}
│  Renderers (same state, different widths):
│    renderBrief (ko/en, ≤3 lines) · renderLogbook (LOGBOOK.md)
│    renderStatusline (1 item) · check_in envelope
│  11 MCP tools (see inventory) — LLM-free, mechanical recorders
│  LOGBOOK.md regenerated by the SERVER on every write tool call
│    → deterministic on ALL hosts, zero hooks needed
│  CLI: npx argus-decision-mcp brief|project|doctor|harvest
└────────────────────────────────────────────────────────────────┘
┌─ DRIVER: Claude Code plugin (bundles engine via .mcp.json) ────┐
│  3 hooks (SessionStart, UserPromptSubmit, PostToolUse)
│  + SessionEnd (P6, opt-in harvest only)
│  Statusline (per P0 spike outcome) · 6 slash commands
└────────────────────────────────────────────────────────────────┘
```

CI pins: projection parity test (fixture ledger → byte-identical brief/LOGBOOK/statusline from all three renderers), hook-contract smoke tests (fixture stdin JSON per event), flat-day red tests, provenance-copy matrix test.

## 2. Ledger event schema v2 (additions to v1)

- `gate_result` — fire|no_fire per argus_open_decision call (alongside existing `gate_input`). "Anchored session" is DEFINED as `gate_result:fire` recorded this session — never a raw keyword match.
- `candidate` — `{id, kind: decision|claim|open_question, quote (verbatim, byte-matched), quote_speaker: user|assistant, source: sweep|harvest|debrief|manual, session_ref, provenance: 'ai_surfaced' (always)}`
- `candidate_action` — promote|drop|snooze (first-class events → drop-rate is computable → over-extraction turns red)
- `waypoint` — at every seal: `{git_sha, branch, dirty: bool, quote}` (repo resolved from argus_dir parent, tested)
- `bearing` — set|update|arrive|abandon; `remaining[]` is user-owned; machine append/delete forbidden by code
- `snooze` — `{ref, until}` for due items (distinct from amend; no goalpost implications)
- `direction_tag` — optional, user-picked at settle (`optimistic|pessimistic|none`) — the ONLY source of direction language in patterns

## 3. The loop, link by link

**CAPTURE (deterministic-first, three layers):**
1. *Anchor (gate-first).* UserPromptSubmit hook: bilingual keyword scan **nominates only**. Injected nudge (verbatim spec): "[Argus] 결정 형태의 문장이 감지되었습니다 — 사소한(평평한) 것일 수 있습니다. 먼저 argus_open_decision을 조용히 호출해 정직한 stakes/reversibility로 게이트를 통과시키세요. 게이트가 fire를 반환한 경우에만, 반환된 질문을 **그대로** 사용자에게 전하세요. no_fire면 아무것도 하지 마세요." No pre-gate question form. No priming assertion. Once per session; suppressed if a matching open / recently-skipped / dismissed decision exists in the ledger (cooldown dedup). The gate's returned neutral question is the ONLY question — the "weave a lean question" instruction is deleted.
2. *Landing.* PostToolUse hook on `git commit|gh pr create`: fires only in anchored (gate-fired) sessions, only if zero seals this session, max once per session, never if skipped earlier that day. Nudge: offer ONE `confirm_draft` seal drafted from the user's own words → Keep/Reword/Skip elicitation (text fallback). Skip = drop.
3. *Deterministic net (LLM-free).* Next SessionStart: if yesterday had gate-fired decision(s) with zero seal, the brief may carry ONE line: "어제 열린 결정 1건이 봉인 없이 남아 있습니다: '(사용자 인용)' — 한 줄로 봉인할까요? (건너뛰면 후보로 접습니다)". Once; skip → archived candidate, never re-shown.
4. *Harvest (P6, opt-in, post-gate).* See §5.

**RESURFACE (deterministic delivery, hedged relay):** SessionStart hook runs `argus brief` (shared reducer) → stdout injected into model context. Honest rating: deterministic **to the model**; relay to the user is the residual compliance hop. Hedges: (a) imperative top-of-context phrasing — "Surface the following to the user before the task, once, then continue:"; (b) slash commands printed IN the brief text so the deterministic path is in front of the user ("/argus:settle 로 정산"); (c) LOGBOOK.md the user can open with zero model involvement; (d) statusline pixels (per P0 spike). Relay rate is a measured P2 exit metric (≥90% over 20 cold starts).

**Brief content (≤3 lines, one block, priority-ordered, silence at zero):**
1. Oldest overdue/due settle — seal-time words with provenance-conditional verb + inline escapes ("정산 / 미루기 / 접기 — /argus:settle")
2. Candidate headline — only if the live set contains never-headlined items ("후보 N건" — never "전제 N건"); candidates auto-expire to a dated archive after 14 days with one-time mention ("후보 3건이 봉인 없이 만료 — 보관됨"), then silence
3. Bearing line — only on change or every 5th session
Honest-gap lines (harvest failure, transcript-parse canary) ride in the block when present.

**Restraint mechanics (code, not prompt):** per-item once-per-calendar-day dedupe via marker files (~/.claude/argus-state/ per the legacy marker pattern); overdue settles always eligible at first session of the day; hard cap one block per SessionStart. Snooze: "미루기" = +3 days default; after 2 snoozes the brief offers explicit "접기" (dismiss). CI invariant test: **the identical brief never fires on two consecutive days without a ledger state change.** CI red test: replay of 20 flat keyword-containing prompts → zero questions emitted; flat-day full replay → all surfaces silent.

**SETTLE (escorted-fragile, named):** brief hands the model the exact ask in the user's seal-time words. Elicitation picker (그대로 됨/피했음/일부만/아직 모름/놓침) — **the tap alone settles** (the chosen label is the user's word; OUTCOME_REQUIRED guards the tap, not free text). Optional, skippable: one line `what_happened` + direction tag. No elicitation → text fallback; refusal → OUTCOME_REQUIRED honest error, item stays due (subject to snooze). Guards unchanged (NO_PRIOR_SEAL, ALREADY_SETTLED, PREMATURE_SETTLE). Receipt: `AI VERDICT: NONE` + `RETURN POINT: <sha> (<branch>)` + asymptote disclosure footer. P4 exit must pass **with elicitation disabled** — text is the tested primary, taps are the enhancement.

**PATTERNS (capability E):** record-core port; pure templates; n≥3 per category, n<10 caveat; direction language ONLY from user-picked direction tags, else taxonomy-only ("정산된 4건 중 3건이 '놓침'으로 정산됐어요"). Delivered ONLY as `pattern_note` inside argus_open_decision's fire-path output (post-gate, so it can never precede the gate) and `argus_recall view:track_record`. The UserPromptSubmit pattern injection is CUT from v2.0 (backlog): the mirror clause treats a manufactured 참고 line on a flat prompt as a spine violation, so under-fire is the launch bias.

## 4. Provenance & copy rules (spine compliance, structural)

- Ledger stores `drafted_by: user|ai` + `affirmed: none|keep|reword`. Copy renders from these fields, one template branch: typed/reworded → "당신이 쓴 문장"; Keep-path → "당신이 봉인한 문장"; unaffirmed → "AI가 건진 후보 (ai_surfaced)". "You wrote" is never a default.
- **Single provenance-flip rule, written once:** ai_surfaced→user iff the displayed text == a user-spoken verbatim quote AND the user taps Keep/Reword (Reword = user text by definition). Edit-free promotion of machine-composed text stays ai_surfaced. Decision-kind candidates REQUIRE quote_speaker==user (rejected loudly otherwise); assistant-spoken claims may enter as premises labeled "어시스턴트 발화, 미검증".
- Every user-facing candidate surface displays ONLY the validated verbatim quote; any extractor paraphrase (`text`) is internal metadata, never rendered.
- `unverified_assumption` auto-promotes to a premise ONLY if its text was displayed in the seal confirm; otherwise it lands as a candidate. Premises keep visible ai_surfaced tags through debrief/recheck until separately affirmed.
- Debrief classifications carry `classified_by:'ai'`; checkability is worded as suggestion ("확인 경로 추정: URL"), never recorded fact.
- Harvest surfaces carry completeness framing ("후보 1건 — 추출은 놓칠 수 있습니다"); cap-priority is deterministic (user-spoken > explicit commitment verb > recency).
- LOGBOOK header claims only what code enforces: "아래의 모든 문장은 검증된 인용이거나 ai_surfaced 표시가 붙어 있습니다."
- Product-level asymptote disclosure (greeting + receipt footer): "아르고스는 질문 하나만 드러냅니다 — 어떤 질문을 고르는지에 희미한 기울기가 남는 것은 알려진 한계입니다." Never "we don't judge."

## 5. Harvest pipeline (P6, opt-in — the replacement for Designs 1/2's default-on extraction)

- **Consent:** one-time elicitation at the first gate-fired session (or /argus:mute config): "세션 종료 시 하이쿠 모델로 배경 추출을 할 수 있습니다 — 당신의 Claude 구독을 사용합니다. [켜기/끄기]". Default OFF. README documents expected per-run usage; per-run token counts logged to `.argus/harvest.log`.
- **Pre-filter (deterministic):** runs ONLY on sessions where the gate fired AND zero seals happened — never scans flat sessions. Haiku abstention is the second layer, not the first.
- **Recursion/self-harvest guards:** spawn with `ARGUS_HEADLESS=1`; every hook script checks it first and exits 0; per-session processed-markers keyed by session id so sweep/harvest skip extraction transcripts; single-flight lockfile; ≤1 spawn/day; sweep enqueues at most ONE catch-up (never blocks the hook — crash-path candidates arrive by the NEXT SessionStart, stated honestly).
- **Output discipline:** AT MOST ONE candidate; quote must byte-match the transcript or be discarded (logged abstention, not silence); ≤2 candidates/week hard cap; input = user+assistant text, tail-capped tokens.
- **Red lights:** flat-transcript CI fixtures → 0 candidates is a red-build test; rolling drop-rate >2/3 over last 9 auto-quiets candidate surfacing with an honest line ("계속 버리시는 후보를 찾고 있어요 — 추출을 잠시 멈춥니다. /argus:candidates 로 재개"); failures write honest-gap lines ("어제 세션 정리 실패 — /argus:debrief 로 직접 실행 가능"). A dead extractor is visibly different from a quiet week.
- Precision harness before any default-on discussion: ≥30 labeled fixture transcripts, precision/recall assertions in CI, telemetry on fired/promoted/dropped rates.

## 6. Debrief (capability B — user-pulled, zero over-fire)

`/argus:debrief` (user command; the invocation IS the consent) → headless review over today's transcripts, reusing the webapp review engine's quote-anchoring → items handed to `argus_debrief` (LLM-free validator: verbatim quote check, QUOTE_NOT_FOUND loud, writes candidate events). Output per claim: "오늘 전제된 사실/주장: 'Stripe 수수료는 2.9%' (인용: '…') — 미확인 · 확인 경로 추정: URL (classified_by: ai)" with per-row actions 그대로 두기 / 전제로 추적 / 지금 확인 (→ argus_recheck, host researches, tool records with provenance). On Codex: `argus-debrief` MCP prompt + paste mode feed the same validator.

## 7. Destination (C) & Branch-return (D)

- **argus_bearing** `{op: set|update|arrive|abandon|status}`: destination + `remaining[]` in the user's words, user-owned (machine edit is a code-level error). Brief shows it on change or every 5th session; harvested waypoints render as counts on a separate clause with visible ai_surfaced tags — never merged into the user's list. Arrive/abandon are terminal states (no zombie heading line).
- **Return points:** every seal emits a `waypoint` (sha, branch, dirty flag, quote). `argus_recall view:'return' {id}` → capsule: receipt FIRST (basis, real_question, road-not-taken with mandatory verbatim quotes tagged "포기 이유(추정·ai)" — quoteless alternatives are dropped, not paraphrased), THEN the suggested string `git switch -c argus/return-D_012 <sha>` — printed, never executed. Marketed as "code anchor + moment capsule", not full moment-restoration, until transcript-slice attachment exists (backlog).

## 8. Degraded-host story (Codex/Cursor — honest tier)

- Resurface: server-written LOGBOOK.md (deterministic write; near-deterministic read) + conditional AGENTS.md snippet, shown-diff opt-in at init, skipped by default when git log shows other committers: "If `.argus/LOGBOOK.md` exists, read it at task start; if a check date arrived, tell the user in one line — facts only, never a verdict. If the file doesn't exist, ignore this section." Inert for teammates without Argus.
- Capture: explicitly manual/user-pulled (argus-debrief prompt, paste mode, direct tool asks). All copy says so.
- Settle: same tools, text mode, OUTCOME_REQUIRED unchanged.
- Positioning copy everywhere: "Claude Code에서 완전한 루프. Codex/Cursor에서는 기록·정산 컴패니언." Capability F is not claimed there; the P5 cohort segments Codex users onto settle-completion metrics only.

## 9. Migration, maintenance, fail-loud plumbing

- **Double registration:** argus_init detects an existing argus-decision-mcp registration (server-name collision + `.argus` lockfile marker) and prints one migration instruction; ambient due-note dedupes via per-dir marker so two servers can't double-note; uninstall documented before P3 ships.
- **Format drift:** all transcript parsing wrapped in a schema canary — parse failure or zero-events on a non-trivial file writes a loud state the next brief surfaces ("Claude Code 업데이트 이후 아르고스가 트랜스크립트를 읽지 못합니다"); `/argus:doctor` diagnoses; CI pins tested Claude Code versions with a nightly fixture parse test; plugin↔server version handshake at init.
- **Hook contract:** CI smoke test replays fixture stdin JSON per event against each script, asserting output on fire cases — a hooks-API change fails red, never degrades to permanent silence that looks like restraint.
- **Statusline:** P0 spike decides. If auto-wiring is impossible: init offers a shown-diff y/n settings patch + a compositing wrapper (exec user's existing statusLine command, append the Argus item) — never silently stealing the slot. Demoted to bonus in the loop proof either way; LOGBOOK + brief are the stated model-free/deterministic channels.
- **Escapes:** per-surface mute keys (`mute.brief`, `mute.statusline`, `mute.commit_nudge`, `mute.anchor_nudge`, `mute.candidates`, `mute.bearing_line`) + `/argus:mute <surface>`; every proactive surface names its own off-switch in its copy. Spine remains non-configurable.
- **Out-of-terminal:** .ics per seal (unchanged, zero-setup) + the already-built opt-in weekly email digest (Companion Brief builder) kept as demoted escalation — never on the activation path. A user away for weeks gets a paused loop, disclosed, not a nag.

## 10. Fragile links — complete register (every one named + mitigation)

| # | Fragile link | Mitigation |
|---|---|---|
| 1 | Model relaying SessionStart brief to user | Imperative top-of-context phrasing; measured relay rate (P2 exit ≥90%/20 cold starts); slash commands printed in the brief; LOGBOOK + statusline as model-free channels |
| 2 | Model acting on gate-first anchor nudge | Per-turn injection (strongest channel available); telemetry: keyword-fire vs gate-call ratio; under-fire bias accepted; deterministic net catches gate-fired-unsealed decisions next morning |
| 3 | Final settle/promote tool call | Elicitation one-shot where supported; text-first tested (elicitation-disabled CI path); OUTCOME_REQUIRED loud; deterministic /argus:settle advertised in the brief itself |
| 4 | Harvest extraction quality | Opt-in; gate-fired pre-filter; abstain default; byte-match; drop-rate auto-quiet; flat-fixture red tests; 30-transcript precision harness |
| 5 | Transcript JSONL format drift | Schema canary → loud brief line; /argus:doctor; pinned-version nightly CI parse test |
| 6 | Elicitation partial support | Text fallback everywhere; text path is the tested primary |
| 7 | Statusline auto-wiring unknown | P0 spike; shown-diff patch + compositing wrapper; demoted to bonus |
| 8 | Codex capture compliance | Scoped honestly as manual tier; excluded from loop-closure gate |
| 9 | User away from terminal | .ics + opt-in weekly digest; loop pauses, disclosed |
| 10 | v1/v2 double registration | Init detection + migration line + ambient dedupe marker + documented uninstall |
| 11 | Anchor keyword precision (ko/en) | Labeled corpus before P3 exit; precision-first lists; once/session cap; Keep/Reword/Skip telemetry as live over-fire metric with kill threshold |

## 11. Capabilities A–F delivery map

- **A Zero-effort capture** — gate-first anchor + commit-landing confirm_draft (one tap) + deterministic net + opt-in harvest (P3/P6)
- **B Day debrief** — /argus:debrief + argus_debrief validator + argus_recheck (P5)
- **C Destination** — argus_bearing + brief Heading line, user-owned remaining (P5)
- **D Branch-return** — waypoint-at-seal + recall view:'return' capsule + /argus:return (P5)
- **E Patterns at the moment** — pattern_note inside open_decision fire output, n≥3, taxonomy/direction-tag language (P5)
- **F Loop closes for median user** — P5 go/no-go gate with per-link funnel telemetry (§ build plan)

## 12. Killed (final)

argus_config, argus_amend, argus_dismiss (→ seal ops), argus_watch (anchor→bearing, capture→debrief/candidates), argus_review-as-tool (engine reused; → /argus:debrief + prompt), argus_sync-as-tool (silent push-if-token stays inside seal/settle; pull/import → backlog), Stop hook, PreToolUse keel, PreCompact hook, 21 skills → 6 commands, 17 agents → 0, UserPromptSubmit pattern injection (backlog), token-gated activation of anything.

---

# 최종 도구·표면 인벤토리

## Final inventory — engine + driver (one table)

| # | Surface | Type | Verdict | Trigger | Schema / behavior sketch |
|---|---|---|---|---|---|
| 1 | argus_init | MCP tool | KEEP, absorbs argus_config | Day-0 / model | `{argus_dir, set?:{locale, ambient_mute, mute.{brief,statusline,commit_nudge,anchor_nudge,candidates,bearing_line}, capture_mode: off\|manual\|auto, snooze_days}}`; no-arg = status. Adds: LOGBOOK bootstrap, shown-diff conditional AGENTS.md snippet (skipped if other committers), v1 double-registration detection + migration line, plugin↔server version handshake. Spine non-configurable. |
| 2 | argus_open_decision | MCP tool | KEEP + grow | Anchor nudge / model | v1 gate unchanged (validateCrux, gate_input logging). ADD: `gate_result` ledger event (fire\|no_fire — defines "anchored"); fire-path output gains `pattern_note` (deterministic template, n≥3 per category, taxonomy/direction-tag language only, absent below threshold). |
| 3 | argus_seal | MCP tool | KEEP, absorbs amend+dismiss+snooze | Landing nudge / brief / model | `{op: seal\|amend\|dismiss\|snooze, ...v1 seal fields, until? (snooze)}`. ADD: `return_point {git_sha, branch, dirty}` recorded at seal (repo from argus_dir parent); `destination_ref?`; `drafted_by`+`affirmed` provenance fields. confirm_draft/elicitation/.ics/premise-promotion unchanged; auto-premise only if assumption text was displayed at confirm, else → candidate. Guards (GOALPOST_MOVED etc.) preserved per op. |
| 4 | argus_settle | MCP tool | KEEP (sacred) + 2 optional fields | Brief escort / user | v1 unchanged (outcome_source literal, elicitation, OUTCOME_REQUIRED, guards). Tap alone settles; ADD optional skippable `what_happened` (already optional-ized) and `direction_tag: optimistic\|pessimistic\|none` (user-picked). |
| 5 | argus_check_in | MCP tool | KEEP, reimplemented | Model / hook-less hosts | Thin wrapper over the SAME brief reducer the SessionStart hook renders — one reducer, zero drift. Fleet flag kept. |
| 6 | argus_recall | MCP tool | KEEP + 1 view | Model / user | Views: `bearing\|contracts\|receipt\|premises\|track_record\|return`. `view:'return' {id}` → `{receipt_text (basis/real_question/roads-not-taken with mandatory quotes + '추정·ai' tags), return_point, suggested_cmd: "git switch -c argus/return-<id> <sha>"}` — never executes. judgment_tier/score stay null. |
| 7 | argus_premises | MCP tool | KEEP | Model / debrief promotions | Unchanged (add/amend/resolve/still_open, caps, provenance, from_capture now reads candidate events). ai_surfaced tag persists visibly until separately affirmed. |
| 8 | argus_recheck | MCP tool | KEEP | Debrief rows / model | Unchanged: host researches, tool records; provenance required; 3-valued materiality; first check = baseline. |
| 9 | argus_candidates | MCP tool | **ADD** | Brief headline / /argus:candidates | `{op: list\|promote\|dismiss\|snooze, ref, edited_text?, promote_as: seal\|premise\|bearing}`. Single triage surface. Displays verbatim quote ONLY. Provenance flip: →user iff displayed text == user-spoken quote AND Keep/Reword. Dismiss = permanent ledger-recorded drop, never re-shown. Auto-expiry 14d → archive. Elicitation + text fallback. |
| 10 | argus_debrief | MCP tool | **ADD** | /argus:debrief, harvest CLI, Codex paste | Record-only, LLM-free validator: `{source: transcript\|pasted\|host_reported, items:[{kind: decision\|claim\|open_question\|bearing, quote, quote_speaker}]}`; byte-validates quotes (QUOTE_NOT_FOUND loud); decision-kind requires quote_speaker==user; writes candidate events. Single write path for ALL candidate ingestion (any host). |
| 11 | argus_bearing | MCP tool | **ADD** | /argus:bearing / model | `{op: set\|update\|arrive\|abandon\|status, destination?, remaining?: string[]}`. remaining[] user-owned — machine edit is a code error. Feeds brief Heading line (change-or-5th-session cadence) + LOGBOOK. |
| — | argus_config | MCP tool | **KILL** | — | Merged into init. |
| — | argus_amend / argus_dismiss | MCP tools | **KILL** | — | Ops of seal. |
| — | argus_watch | MCP tool | **KILL** | — | anchor→bearing; capture→debrief/candidates. |
| — | argus_review | MCP tool | **KILL as tool** | — | Quote-anchoring engine reused by debrief/harvest; ritual → argus-review prompt. |
| — | argus_sync | MCP tool | **KILL as tool** | — | Silent push-if-token stays inside seal/settle; pull/import → backlog. |
| H1 | brief hook | SessionStart (startup/resume) | ADD (ports check-contracts.js) | Deterministic | Runs `argus brief` (shared reducer); injects ≤3-line block with imperative relay preamble; per-item once/calendar-day dedupe (marker files); snooze-aware; silence at zero; surfaces honest-gap lines; sweeps = enqueue-only (never blocks); checks ARGUS_HEADLESS first. |
| H2 | anchor hook | UserPromptSubmit | ADD (inverts anchor-signal.js) | Deterministic scan | Keyword scan NOMINATES only → gate-first nudge ("call argus_open_decision FIRST; relay returned question verbatim only on fire; no_fire → nothing"). Once/session; ledger dedup + cooldown; no pattern line; ARGUS_HEADLESS guard. |
| H3 | landing hook | PostToolUse (Bash: `git commit\|gh pr create`) | ADD (ports commit-signal.js) | Deterministic regex | Fires only if gate_result:fire this session AND zero seals AND not skipped today; one confirm_draft seal offer; ARGUS_HEADLESS guard. |
| H4 | harvest hook | SessionEnd | ADD in P6, opt-in only | Deterministic spawn | Only if capture_mode:auto (consented). Pre-filter: gate-fired-unsealed sessions only. Detached haiku, ARGUS_HEADLESS=1, single-flight lock, ≤1/day, ≤2 candidates/week, byte-match-or-discard, harvest.log, honest-gap on failure. |
| — | Stop / PreToolUse / PreCompact hooks | — | **KILL** | — | Over-fire risk / unspecced surfaces / not load-bearing. Backlogged. |
| S1 | statusline | every render | KEEP (demoted to bonus) | P0 spike decides wiring | One item max: overdue → due → candidates → absent. Shown-diff settings patch or compositing wrapper; never silently steals the slot. |
| C1–C6 | /argus:settle · /argus:candidates · /argus:debrief · /argus:return · /argus:bearing · /argus:mute (+/argus:doctor) | slash commands | ADD | User-typed | Deterministic manual path for every loop link; advertised inside brief copy. 21 legacy skills + 17 agents killed. |
| F1 | .argus/ledger/ledger.jsonl | file | KEEP | every write | Single source of truth, append-only, lock-guarded. |
| F2 | .argus/LOGBOOK.md | file | ADD | every write tool call (server-written) | Sections: 확인일 도착(Due) / 열린 계약(Open) / 후보(ai_surfaced 표시) / 방향(Heading) / 정산 기록(counts only). Header claims only enforced facts. THE deterministic channel on hook-less hosts. |
| F3 | AGENTS.md snippet | file | ADD (opt-in, conditional) | init, shown-diff | Inert for non-users ("If .argus/LOGBOOK.md exists…"); default-skip on multi-committer repos. |
| F4 | .ics per seal | file | KEEP | every seal | Zero-setup out-of-terminal return channel. |
| F5 | .argus/harvest.log | file | ADD (P6) | each spawn | Every spawn + outcome + token count — silent extractor failure impossible. |
| P1–P4 | argus-bind / argus-settle / argus-reframe / argus-debrief | MCP prompts | KEEP (review→debrief) | user picks | Rituals for hook-less hosts; settle prompt bakes real due items at GetPrompt time. |
| E1 | weekly email digest | channel | KEEP demoted | opt-in ARGUS_TOKEN | Existing Companion Brief builder; escalation only, never activation. |
| T1 | telemetry | plumbing | EXTEND | opt-in | Funnel counters (keyword-fire→gate-call→gate-fire→seal-offer→seal→brief-relayed→settle), Keep/Reword/Skip rates (live over-fire metric + kill threshold), candidate promote/drop rates. |

Key files: `/home/user/Argus/argus-mcp/src/tools/index.ts` (consolidation), `/home/user/Argus/argus-mcp/src/lib/spine.ts`, `/home/user/Argus/argus-mcp/src/lib/ledger-replay.ts` (reducer home), `/home/user/Argus/argus-plugin-v2/scripts/{check-contracts,anchor-signal,commit-signal}.js` (port sources), `/home/user/Argus/src/lib/{record-core,companion-brief,premises-core}.ts` + `/home/user/Argus/src/lib/review/` (webapp libs to reuse).

---

# 여정 대본 (한국어)

# 여정 대본 — 서진 (데브툴 SaaS 솔로 파운더, 하루 ~3 Claude Code 세션, 문서 안 읽음)

## Day 0 — 설치 (90초)

```
$ claude plugin install argus
```
플러그인이 MCP 서버·훅 3개·슬래시 커맨드를 한 번에 설치. 토큰 없음, 웹앱 없음, 설정 편집 없음. (v1 MCP가 이미 등록돼 있으면 init이 감지하고 마이그레이션 한 줄 안내.)

다음 세션 시작, 주입된 한 줄을 모델이 전달:

> **[Argus]** 봉인된 결정이 확인일에 돌아옵니다. 평소처럼 일하세요 — 필요할 때만 나타납니다. 질문 하나만 드러냅니다 — 어떤 질문을 고르는지에 희미한 기울기가 남는 것은 알려진 한계입니다.
> 원하시면 지난 결정 하나로 30초 연습을 해볼 수 있어요 — 과거의 결정 하나를 오늘 날짜로 봉인하고 바로 정산해 봅니다 (기록에는 안 섞입니다). 건너뛰어도 됩니다.

서진: "그래, 해보자. 지난달에 온보딩 투어 뺐던 거."

> 이대로 연습 봉인할까요? — "온보딩 투어 제거 후 첫 주 이탈률이 늘지 않는다" (확인일: 오늘 · origin: retro)
> **[그대로 / 고쳐 쓰기 / 건너뛰기]**

탭 한 번, 이어서 정산 피커 [그대로 됨/피했음/일부만/아직 모름/놓침] → "일부만" 탭. 첫 영수증이 5분 안에 출력됨: `AI VERDICT: NONE`. 연습 기록은 본 기록과 격리.

## Day 1 — 첫 실전

서진: "무료 티어 자를까 말까 고민이다. 이벤트 100개로 캡 씌우고 유지하는 쪽으로 갈까?"

(UserPromptSubmit 훅: 키워드가 **지명만** → 숨은 넛지: "게이트 먼저.") 모델이 조용히 `argus_open_decision` 호출 → 게이트 fire → 반환된 중립 질문 **그대로** 전달:

> 이 결정이 뒤집히려면 8월 1일까지 무엇이 사실이어야 하나요?

서진이 답하고 계속 작업. 두 시간 뒤 `git commit` → (PostToolUse 훅, 게이트-fire 세션에서만, 1회):

> 이대로 봉인할까요? — "무료 티어 유지(100 이벤트 캡) — 8/1까지 유료 전환율 3% 이상" (확인일 8/1 · 근거 가정: "무료 유저 대부분이 캡에 안 닿는다")
> **[그대로 / 고쳐 쓰기 / 건너뛰기]**

"그대로" 탭 → affirmed:keep 기록, 영수증 + .ics 생성, 표시됐던 가정이 전제 P1로 추적 시작(ai_surfaced 표시 유지). 하루 총 부담: 문장 하나 + 탭 두 번.

*(만약 봉인을 건너뛰었다면: 다음날 첫 세션 브리프에 딱 한 줄 — "어제 열린 결정 1건이 봉인 없이 남아 있습니다: '무료 티어 유지…' — 한 줄로 봉인할까요? (건너뛰면 후보로 접습니다)" — 한 번만, LLM 없이.)*

## Day 5 — 평범한 날 (침묵의 증명)

기한 없음, 결정 키워드 없음. SessionStart는 **아무것도 주입하지 않음**. 상태줄(있다면): `⚓ 1 · 8/1`. 그날 아르고스가 한 말: 0마디. 이 침묵이 제품이 작동하는 상태다. 하루 세 세션 모두 동일 — 같은 항목은 하루 한 번 이상 절대 안 나온다.

## Day 8 — 귀환의 순간 (확인일 도착)

주말 지나 월요일 첫 세션. 브리프 한 블록:

> **[Argus]** 확인일 도착 1건 — 7일 전 **당신이 봉인한 문장**: "무료 티어 유지 — 8/1까지 유료 전환율 3% 이상"… 은 아직이고, 지난주 것: "빌링 마이그레이션이 금요일까지 스테이징 통과". 실제로는 어땠나요? (정산 / 미루기 / 접기 — /argus:settle)

서진: "통과는 했는데 토요일에야 됐어."

정산 피커: **[그대로 됨 / 피했음 / 일부만 / 아직 모름 / 놓침]** → "일부만" 탭 (탭만으로 정산 완료). 선택 한 줄(건너뛰기 가능): "하루 늦음, 원인은 시드 데이터." 방향 태그(선택): "낙관 쪽으로 깨짐" 탭.

영수증: `AI VERDICT: NONE · RETURN POINT: a1b2c3d (main)`. 커피 전 30초. 만약 "미루기" → 3일 뒤에만 다시; 두 번 미루면 "접기(다시 안 보기)"를 제안 — 같은 브리프가 이틀 연속 반복되는 일은 코드가 막는다.

## Day 12 — 행선지

서진: `/argus:bearing "8월 말 v1 런칭 — 남은 것: 결제, 온보딩, 문서"`

이후 브리프(변경 시 또는 5세션마다 한 줄만):

> 방향: "8월 말 v1 런칭" — 남은 것(당신의 목록): 결제, 온보딩, 문서 · 기록된 경유지 3개(ai_surfaced)

남은 목록은 서진만 수정한다. 기계는 세지만 편집하지 않는다.

## Day 18 — 분기점 복귀

가격 지표가 나빠 보인다. 서진: `/argus:return D-001`

> **D-001 갈림길 (6/23)** — 봉인 문장: "무료 티어 유지(100 이벤트 캡)…"
> 당시의 진짜 질문: "전환율이 문제인가, 유입이 문제인가"
> 가지 않은 길: "무료 티어 폐지안" — 포기 이유(추정·ai) — 인용: "초기 트래픽 잃는 게 더 무섭다"
> 코드 앵커: a1b2c3d (main, 커밋 시 클린)
> 복귀하려면: `git switch -c argus/return-D-001 a1b2c3d` (실행은 직접 — 아르고스는 건네기만 합니다)

## Day 30

정산 6건 누적. 새 일정 결정이 게이트를 통과하면 fire 출력에 한 줄이 실린다:

> 참고(참고용, 지시 아님): 정산된 일정 예측 5건 중 4건을 '낙관 쪽으로 깨짐'으로 태그하셨어요.

(서진이 직접 태그한 방향만 말한다. 태그가 없으면 "5건 중 4건이 '놓침'으로 정산됐어요"처럼 분류값만.)

금요일 저녁, 서진: `/argus:debrief`

> 오늘 전제된 사실/주장 3건 (분류: ai) —
> ① "Stripe 수수료는 2.9%" (인용: "…수수료 감안하면…") · 미확인 · 확인 경로 추정: URL
> ② "경쟁사 X에는 SSO가 없다" (인용: "…걔네는 SSO도 없잖아…") · 미확인
> ③ "유저는 온보딩 2단계에서 이탈한다" (인용: "…") · 주장 — 어시스턴트 발화, 미검증
> 각 항목: 그대로 두기 / 전제로 추적 / 지금 확인

서진: "① 확인해줘" → 호스트가 조사, `argus_recheck`가 출처와 함께 기준선 기록. 판정은 어디에도 없다.

(배경 수확을 켰다면 — 켜기 전에 반드시: "세션 종료 시 하이쿠로 배경 추출을 할 수 있습니다 — 당신의 구독을 사용합니다 [켜기/끄기]" — 봉인 없이 닫힌 결정-세션에서만, 아침에 후보 최대 1건: "어제 이 문장이 결정처럼 보였어요 (AI 추정, 인용): '요금제는 3단으로 간다' — [기록 / 버리기]". 계속 버리면 아르고스가 스스로 멈추고 그렇게 말한다.)

Codex에서 여는 세션: AGENTS.md가 LOGBOOK.md를 가리키고, 모델이 Due 섹션을 읽어 한 줄로 알린다. Claude Code보다 약하고 — 그 사실을 숨기지 않는다.

---

# 시공 계획

## P0 — Spikes (3 days, week 0)
Build nothing load-bearing until these answer:
1. Statusline: can a 2026 plugin auto-wire it on a clean machine? Test the compositing-wrapper fallback.
2. Real marketplace install walkthrough: count every trust prompt; write Day-0 copy from what actually happens.
3. Capture 5 real transcript JSONL fixtures (ko+en) + 1 headless-session transcript for recursion tests.
4. Routing-eval harness skeleton (scripted utterances → expected tool).
**Exit:** written spike report answering all four; statusline promoted or demoted in the spec accordingly.
**Cut:** everything else.

## P1 — Ledger v2 + reducer + consolidation (week 1)
Event schema v2 (gate_result, candidate, candidate_action, waypoint, bearing, snooze, direction_tag); ONE shared reducer; three renderers (brief/LOGBOOK/statusline) + CLI `argus brief|project|doctor`; tools 14→11 (init absorbs config; seal absorbs amend/dismiss/snooze; watch/review/sync killed; candidates/debrief/bearing added); server-written LOGBOOK on every write; provenance fields (drafted_by/affirmed) + copy-rendering engine.
**Exit (human-verifiable):** fixture ledger → byte-identical projections from all three renderers (CI); server lists exactly 11 tools, spine drift-guard green; 20-utterance routing eval passes on Claude Code AND Codex (if `check_in` vs `recall` confuses, keep-alias decision made here); founder seals+settles via bare MCP in Codex; provenance copy matrix test green ("당신이 쓴"/"당신이 봉인한"/"후보" render from fields).
**Cut until later:** all hooks, all LLM anything.

## P2 — Driver skeleton + Day 0 (week 2)
Plugin bundling MCP via .mcp.json; SessionStart brief hook (per-item calendar-day dedupe, snooze-aware, imperative relay preamble, ARGUS_HEADLESS guard); v1 double-registration detection; greeting + RetroSeal taste; statusline per P0 outcome; /argus:settle, /argus:mute, /argus:doctor; hook-contract CI smoke tests.
**Exit:** clean-machine one-command install; nothing due → nothing injected (eyeball); seeded due contract → brief relayed to user in ≥90% of 20 cold starts; RetroSeal produces a real receipt in the first session inside 5 minutes; test proves identical brief cannot fire two consecutive days without state change.
**Cut:** anchor/landing hooks, candidates.

## P3 — Deterministic capture (week 3)
Gate-first anchor hook (nominate-only nudge, ledger dedup/cooldown); landing hook (gate-fired sessions only, once, skip-respecting); deterministic unsealed-decision net line; anchor keyword lists tuned on P0 corpus (precision-first); funnel telemetry counters.
**Exit:** scripted day-1 run produces gate-fire → ONE relayed question → commit → ONE seal offer → next-day brief; CI red test: 20 flat keyword-containing prompts → zero questions, zero anchors; full flat-day replay → every surface silent; skipped seal → exactly one net line next morning, then candidate archive.
**Cut:** harvest, debrief, patterns.

## P4 — Settle hardening (week 4)
Elicitation picker + text-first fallback (CI runs with elicitation DISABLED); tap-alone-settles; optional what_happened + direction tag; snooze/dismiss escapes wired into brief copy; receipts with RETURN POINT + disclosure footer; .ics verified; per-surface mutes.
**Exit:** seeded overdue settles in ≤2 interactions via text path alone (elicitation off), ≤2 taps with it on; receipt prints AI VERDICT: NONE; "미루기" verifiably suppresses the item for 3 days; 2 snoozes → dismiss offer appears.

## P5 — Dogfood gate ∥ capabilities B/C/D/E (weeks 5–6)
Recruit 5 real terminal-dwelling builders (Claude Code primary; Codex users segmented onto settle-only metrics). 21-day window, funnel telemetry per link. In parallel (founder+AI, low risk, user-pulled surfaces): argus_bearing + Heading line; waypoint-at-seal + recall view:'return' + /argus:return; /argus:debrief (user-pulled headless review over today's transcripts → argus_debrief validator → recheck routing); pattern_note in open_decision fire output (n≥3).
**Exit (go/no-go):** ≥3 of 5 Claude Code users close one full loop (seal→brief→settle) within 21 days without founder prompting — AND the funnel names any broken link with numbers (relay rate, gate-call rate, seal-accept rate, settle rate). /argus:return prints a capsule with a valid git command (executed by hand lands on the fork commit). Debrief on a real workday yields ≥1 byte-matched checkable claim + one recorded recheck baseline. Pattern line appears only after 3 settles (both sides of the gate verified).
**Failure protocol:** a broken-link failure (e.g., relay <90%) triggers targeted iterate + 2-week re-run, per the pre-committed rule in open decisions — not automatic kill.

## P6 — Opt-in harvest (week 7+, only after P5 passes)
Consent elicitation; SessionEnd spawn with full guard stack (ARGUS_HEADLESS, processed-markers, single-flight lock, 1/day, 2 candidates/week, byte-match-or-discard, harvest.log); SessionStart enqueue-only sweep; drop-rate auto-quiet; honest-gap lines; 30-transcript precision harness in CI.
**Exit:** flat-transcript fixtures → 0 candidates (red-build test); recursion test: extraction run produces zero hook side-effects and zero self-harvested candidates; killed-terminal decision session → candidate visible by the NEXT SessionStart; drop 6 of 9 candidates → auto-quiet line appears; harvest.log shows token counts per run.

**Deliberately cut until after P6 (backlog, BLUEPRINT §8):** UserPromptSubmit pattern injection; Stop/PreToolUse/PreCompact hooks; argus_sync pull/import; transcript-slice attachment for return capsules; retro-harvest of pre-install transcripts; any default-on harvest discussion.

---

# 창업자 결정 필요 항목

1. Harvest cost defaults (founder trust call): confirm haiku as the extraction model and the caps (1 spawn/day, 2 candidates/week, tail-capped input) — this burns users' own subscription quota, and the bar for ever revisiting default-on (e.g., measured precision ≥X on the 30-transcript corpus + real-install drop-rate <Y) should be set by you now, not negotiated later.
2. Email digest scope: keep the already-built opt-in weekly Companion Brief as the demoted away-from-terminal escalation channel (my default: keep, zero new build), or cut email entirely from v2 and accept that a user away 10+ days has only .ics.
3. Statusline install consent (pending P0 spike): if auto-wiring is impossible, is a shown-diff y/n patch to the user's settings.json during install acceptable, or must the statusline be opt-in-only polish? This decides whether the loop proof lists 2 or 3 model-free channels.
4. Naming & positioning: marketplace plugin name ("argus" vs "argus-decision") and whether public copy says "Claude Code 전용에 가까운 제품" explicitly — the spec commits to Claude-Code-first internally; how blunt the external copy is, is yours.
5. P5 failure protocol pre-commitment: agree now which funnel-link failures trigger iterate-and-rerun (relay rate, seal-accept) vs which trigger kill (users simply don't settle even when escorted) — the gate is worthless if this is decided after seeing the data.
6. Webapp sync fate: argus_sync pull/import is cut from v2 as a tool — decide whether the webapp settle-import path is backlog (revive in v2.1) or deprecated permanently, since it affects the webapp roadmap and the PolyForm/MIT split.
7. Korean-vs-English anchor corpus priority: the P0/P3 keyword-precision corpus needs a target mix — you know whether the first 5 dogfooders (and the first 100 users) are ko-primary, and precision tuning is language-specific.

---

# 개정 R1 — 여정 최적화 6건 (2026-07-10 창업자 검토 라운드)

1. **Day 0 연습 봉인의 재료를 기억이 아니라 git에서.** "지난 결정 하나 말해봐"는 빈 머리에 숙제다.
   git log에서 결정형 머지("auth 라이브러리 교체")를 골라 제안: 로컬·결정론적·실물 기반. → P2 온보딩 요구사항.
2. **앵커 어휘에 선언형·유예형 추가.** 코딩 대화의 결정은 질문형("~할까?")보다 선언형("~로 가자",
   "~하기로 했어")·유예형("일단", "임시로", "나중에 고치", "for now", "hack")이 다수. 특히 유예형은
   기술부채 약속 = 자연스러운 봉인 1순위 소재("이 임시방편이 X까지 문제 안 일으킨다" — TODO에 확인일 달기).
   → P0 말뭉치 요구사항.
3. **아침 브리프의 양보 규칙.** 사용자의 첫 메시지가 긴급 과제면 브리프를 응답 말미로 미루라는 지침 한 줄.
   전달률은 유지, 타이밍만 양보.
4. **bearing '5세션마다' 라인 삭제** — 변경 시에만. 주기 반복도 잔소리의 씨앗.
5. **P5 관문에 정성 질문 내장.** 퍼널 숫자와 별개로 5명에게 단일 질문: "Argus가 사라지면 아쉬울 순간이
   있었나? 언제였나?" 이 답이 비면 숫자가 좋아도 실패.
6. **PR 본문 영수증 통합은 백로그 명시** (`gh pr create` 시 결정 영수증 링크 옵션 첨부 — 팀 확산 벡터, v2.1).

# 개정 R2 — Codex 외부 감사 반영 (전 항목 코드 재검증 완료)

| Codex 지적 | 검증 | 반영 |
|---|---|---|
| Resources가 env 없이 unbound (`resolveArgusDirForResource`가 ARGUS_DIR만 읽음 — docstring의 .bound precedence와 불일치) | **확정** (argus-dir.ts:124 — `readGlobalBoundList()` 존재하나 미사용) | **P1 삽입**: 글로벌 `.bound` 레지스트리 폴백 추가 + resource-bind 테스트. R3 생태계 층의 전제조건 |
| zod `.default()` 필드가 tools/list JSON Schema에 required로 노출 | **확정** (`z.toJSONSchema(s)` 기본 io='output' → required:["a","b","c"]; `{io:'input'}`이면 ["a"]) | **P1 삽입**: `toolJsonSchema`에 `{io:'input'}` 1줄 + 스키마 스냅샷 테스트 (defaulted 필드 required 재발 방지) |
| install.sh v2.4/v2.6.0 vs manifest 2.7.0 버전 표류 | **확정** (install.sh:41,234) | 레거시 v2 플러그인은 어차피 킬 대상이나, 새 드라이버에 규칙 승격: **버전 문자열 단일 소스**(manifest에서 읽기, 하드코딩 금지) + CI 대조 |
| 핵심 skill이 prose에 과적 (clarify 68K·team 52K·sail 48K) — "강력하지만 깨지기 쉬운 운영 매뉴얼" | **확정** (du 실측) | v2 스펙과 **독립 수렴** — 이미 스킬 21→커맨드 6, 판단 로직의 executable validator 이전이 골자. 추가 조치 불요 |
| stdio-only는 원격 MCP 생태계에 약함 (positioning 제약) | 동의 | Codex 권고 그대로: **지금은 stdio 품질**. Streamable HTTP/OAuth는 P6 이후 백로그 (R3 참조) |

# 개정 R3 — 생태계 층 (Osaurus 벤치마크, 2026-07-10)

Osaurus(macOS 로컬 AI 런타임, GitHub 트렌딩 1위)에서 이식할 것은 아키텍처가 아니라 **생태계 참여 문법**이다.
그들의 메모리 설계(세션말 증류·salience 주입 ~800토큰·배경 통합)가 우리 v2의 브리프/수확 설계와 독립적으로
평행하다는 점은 방향 검증 신호.

**R3-1 · README 전면 개편 (argus-mcp)** — Osaurus 구조 벤치마크, P2와 병행:
- 히어로: 터미널 데모 GIF/asciinema (봉인 1탭 → 아침 브리프 → 정산 1탭, 30초)
- 정체성 한 줄: "Reality grades your decisions. The AI never will." + 철학 한 줄
- 배지 줄: release · downloads · MIT · stars / 호환: **Claude Code(full loop) · MCP hosts(companion)** — "works with X" 문법
- 액션 줄: Install(최단 1커맨드 우선) · Docs · Web · Plugin Marketplace · 원장 스키마
- 이미 있는 자산 재배치: telemetry 투명 섹션, SECURITY, 로케일
- 아키텍처 ASCII 다이어그램(엔진/드라이버/투영)

**R3-2 · 원장을 개방 표면으로** — "당신의 결정 기억을 어떤 AI든 읽는다":
- MCP Resources(`argus://ledger`, `argus://due`)를 1급 통합 표면으로 승격 — R2의 unbound 수정이 전제조건
- 원장 JSONL 스키마 문서화(docs/) = 사실상의 공개 API. "no lock-in"을 문장에서 스펙으로
- 등재: Claude Code plugin marketplace + MCP 레지스트리(mcpName 보유) + Smithery류

**R3-3 · Agentic export (이메일 너머)** — 척추 규칙: 내보내는 것은 **사실**(영수증·due·전제 상태)뿐, 판정 없음:
- `argus export` CLI (json / markdown / ics 번들) — 즉시 구현 가능, P5와 병행
- LOGBOOK.md = 이미 확정된 파일 export (모든 도구가 읽는 리포 내 투영)
- PR 영수증 첨부(R1-6, v2.1) · resource subscriptions + Streamable HTTP 구독(백로그: 어떤 에이전트든
  due를 구독 — "능동적 export"의 종착점) · 웹훅(백로그)

**R3-4 · 백로그 승격 목록(§8행)**: Streamable HTTP+OAuth · resource subscription 알림 ·
patterns의 의미 유사 결정 병합(Osaurus consolidation 차용) · Smithery/레지스트리 자동 배포


---

# 개정 R4 — 공학 헌장: 표준이 되는 코드베이스 (2026-07-11, 비평 3라운드 통과본)

> **설계 과정 공개**: 초안(6기둥 헌장)을 서로 다른 렌즈의 비평 3개(OSS 교육자 /
> 반-과잉설계 스태프 엔지니어 / MCP 생태계 저자)가 리포를 직접 열어 검증하며 공격했고,
> 세 비평이 독립 수렴한 판정으로 초안을 크게 수정했다. 죽은 항목도 아래에 남긴다 —
> 반-목록이 헌장의 일부다.

## R4-0 · 세 비평이 수렴한 대판정 (초안을 뒤집은 것)

1. **"흡수 모델"은 전복이었다.** 초안은 R4를 P1~P4의 DoD에 흡수시켰다(+30~40%).
   세 비평 전원 기각: *"레전드 리포는 읽혀서가 아니라 쓰여서 표준이 됐다. 5명 검증
   전에 관객(외부 개발자)을 위해 짓는 것은 관문의 전복이다."* → R4는 둘로 쪼갠다:
   **R4-A(제품 신뢰, P1~P4 잔류, 총 2~3일)** 와 **R4-B(표준화 웨이브, P5 통과 후)**.
   시공 기간은 6~7주로 원복된다.
2. **손으로 유지하는 문서 7종은 자기모순이었다.** 드리프트한 정직성 카탈로그야말로
   "그럴듯함이 정확함으로 위장"하는 것 — 이 코드베이스가 존재하는 이유의 위반.
   → 손문서는 3개만(LEDGER / MCP-NOTES / ARCHITECTURE), 나머지는 **생성**하거나 죽인다.
3. **읽히는 것보다 실행되는 것.** 2026년 레퍼런스가 되는 경로는 레지스트리 →
   2분 퀵스타트 → examples/ → 베낄 수 있는 스켈레톤이다. 초안엔 실행 가능한
   아티팩트가 0개였다. → R4-B의 중심을 runnable로 재편.
4. **해시 체인은 P1에서 사망.** 스태프 비평이 코드로 반박: `ledger-append.ts`의
   의도된 best-effort 락("Lock or no lock, the work proceeds")과 체인이 충돌 —
   락 없는 병행 append가 체인을 분기시키고, torn-tail 치유가 영구 오탐("변조 흔적")을
   만든다. ~50줄이 아니라 150~250줄 + 정책 + 영구 지원 표면. 위협 모델도 빈약
   (자기 소유 로컬 파일). → P1에서 제거, R4-B에서 락 설계 문제를 명명한 채 재평가.
   그 전까지 SECURITY.md의 정직한 "서명 없음"이 더 낫다.

## R4-A · P1~P4에 남는 것 (제품 신뢰 직결, 총 +2~3일)

| 항목 | 내용 | 근거 |
|---|---|---|
| **`lib/provenance.ts`** | 출처 전환 규칙(ai_surfaced→user iff 바이트-일치 인용+승인)을 단일 함수로 중앙화 + **directed 테스트 5개** (fast-check 상태머신 아님 — 비평 판정: 과잉) | 3인 만장일치 생존. CLAUDE.md 단일-소스 규칙의 적용이자 척추 임계 |
| **property test 2종만** | (c) crash-내성 fuzz: 원장을 임의 바이트에서 절단 → replay는 절대 throw 없이 drop 계상 (실존 사고 클래스) · (d) 투영 등가: 무작위 원장에서 4개 렌더가 동일 BriefState 유도 | (a)replay 결정성·(b)전이 단조성은 구현의 재진술 — 컷 |
| **MCP-NOTES.md (지뢰 지도)** | 위치: `argus-mcp/` 루트(npm 방문자가 보는 곳, docs/ 아님). 내용: zod `.default()`→required 함정(`{io:'input'}`) · Claude Desktop `${}` 미확장 · Windows `npx.cmd` · stdout 위생 · **툴 호출 직렬화**(read-replay-append 경합, server.ts의 serialize 체인) · SDK 타입 공백(ElicitCapableServer 캐스트, elicitation은 서버가 '쓰는' 클라이언트 능력) · `$schema` 노이즈 · `instructions` 무시 호스트 · `isError`+structuredContent 렌더 편차 · 레지스트리 server.json 스키마 변동 | 3인 만장일치 최강 항목. 지뢰는 write-once라 드리프트 면역 — 유지비 대비 북마크 가치 최대 |
| **스펙-버전 규율** | README+server.json에 대상 MCP 프로토콜 리비전 명시, 릴리스 체크리스트에 server.json 버전 갱신, 스펙 범프 시 재감사 노트 | "무슨 리비전을 겨냥하는지 말 못하는 구현은 레퍼런스가 아니다" |
| **모듈 헤더 규약** | 이미 우수한 문화(overfire-gate.ts, untrusted.ts 검증됨)를 CONTRIBUTING 한 문장으로 명문화 | 비용 ≈ 0 |

## R4-B · 표준화 웨이브 (P5 관문 통과 후, ~2주)

**Wave-B1 · 열린 계약**
- `docs/LEDGER.md` + `schemas/`(zod에서 생성) + **conformance corpus**: 버전화된
  골든 원장 픽스처(정상/torn-tail/미지 이벤트/변조)와 기대 replay 출력 — 서드파티가
  이 코퍼스로 자기 구현을 검증한다. 파이썬 참조 리더(~30줄)는 코퍼스 소비자 1호로
  CI에서 실행(방치 금지).
- 개방성의 주력 증명은 파일 파싱이 아니라 **`argus://` Resources** — "어떤 MCP
  클라이언트에서든 원장을 읽는다" (R2 unbound 수정이 전제).

**Wave-B2 · 실행 가능한 전파물**
- `examples/` — 호스트별 동작 설정(Claude Code/Desktop/Cursor/VS Code/Windows).
- `template/` — `tool-types.ts`의 ToolModule 패턴(zod 단일 소스 → safeParse →
  envelope → annotations, 이미 62줄짜리 교보재)을 "Argus 방식으로 MCP 툴 짓기"
  스켈레톤으로 추출. **플러그인-이-MCP-내장 패턴(.mcp.json + ${CLAUDE_PLUGIN_ROOT}
  + 버전 핸드셰이크 + 결정론 훅)이 가장 베껴질 아티팩트다** — prose가 아니라
  스켈레톤으로 전파.
- `npx argus-decision-mcp demo` — 픽스처 원장 위에서 봉인→정산→영수증 60초 재연.
  낯선 이가 설치 없이 루프를 몸으로 1회전. README 첫 화면에.

**Wave-B3 · 생성되는 문서층 (드리프트 면역)**
- **INVARIANTS.md를 CI가 생성** — 모듈 헤더 + 행동-문장 테스트 제목에서 추출.
  초안의 SPINE.md/HONEST-FAILURE.md/EVALS.md/TOUR.md 손문서 4종을 이것 하나 +
  주력 에세이로 대체. "테스트가 곧 스펙"을 기계화.
- 손문서는 `ARCHITECTURE.md`("봉인 한 건의 일생" 워크스루, 파일 링크 실존을 CI 검사)
  하나만 추가.
- **주력 에세이 1편은 자를 수 없는 산출물** (초안은 dial-down 목록에 넣었다 —
  교육자 비평: 정확히 거꾸로다. antirez/Ben Johnson은 docs/가 아니라 voice로
  정본이 됐다): *"프레임워크 없는 event sourcing 500줄 — 그리고 거짓말 못 하는
  원장"*. 코드 투어는 에세이의 부록으로.
- conformance 표(구현한 것/안 한 것과 이유 — "안 했다"를 숨기지 않는 것이 자격) ·
  상류 기여 검토.

**Wave-B4 · 재평가 항목**
- 해시 체인: 락 설계 충돌을 명명한 채 재검토 (mandatory-lock 전환 비용 vs
  tamper-evidence 가치. 기본 기대: 기각 유지).

## R4-C · 반-목록 (이번 라운드 전사자 포함 — 이 목록 자체가 헌장이다)

- 해시 체인 @P1 (락 충돌·오탐·위협모델 빈약) → B4 재평가로 강등
- property (a)(b) (구현 재진술) · provenance fast-check 상태머신 (directed 5개면 충분)
- 손문서 SPINE/HONEST-FAILURE/EVALS/TOUR (드리프트 부채) → 생성형 INVARIANTS + 에세이로
- 호스트 호환 매트릭스 문서 (주 단위 부패 — nightly 픽스처 테스트가 곧 아티팩트)
- 에러 어휘 모듈 (이미 대부분 존재 — churn) · 텔레메트리 어휘 통일 (제품 배관, 헌장 아님)
- **자기 지명 언어 전부** ("카테고리를 만드는 자가 표준이 된다", "업계 전례 없음",
  "레퍼런스 구현" 자칭) — 지위는 수여되는 것, 주장하는 순간 만장일치로 신뢰 하락.
  카테고리명 "decision harness"는 유지하되 에세이와 실물로만 민다.
- doctor 신규 제작 (플러그인에 /doctor 스킬 기실존 — v2 스펙의 이식 항목과 중복 제거)
- (기존 유지) mutation testing · 패키지 분리 · Streamable HTTP 지금 · DSL · 벤치마크 · 배지 연극

## R4-D · 수용 기준 — 내부는 DoD, 외부는 봉인

- **DoD (기계 검증)**: `argus_score` 툴 추가 PR이 3중 독립 게이트(closed union /
  금지동사 drift-guard / next_actions 검사)에서 각각 빨간불 — 이 시나리오를 테스트로
  상설화 · conformance corpus를 파이썬 리더가 CI에서 통과 · INVARIANTS.md가 CI 산물.
- **외부 채택 지표는 DoD가 아니라 우리 제품으로 봉인한다** (자기 도그푸딩):
  "MCP-NOTES가 외부 이슈/글에 인용된다 — 확인일 6개월" · "evals 구조 차용 리포 등장 —
  확인일 12개월"을 argus_seal로 기록하고 현실이 정산한다. 허영 지표를 DoD에 넣는
  대신, 우리가 파는 바로 그 규율로 우리 야망을 기록한다.


---

# 개정 R5 — Reflect 대응 + 외부 심층 감사(Codex 5.6-Sol) 수용 (2026-07-11)

## R5-0 · Reflect with Claude (2026-07-09 출시) 반영

Anthropic의 Reflect는 **사용 습관의 거울**(대화 이력 → 토픽·패턴·성찰 질문, 모델의 해석,
결과값 없음)이고 Argus는 **판단의 원장**(봉인 시점의 반증가능 약속 → 정산일의 현실)이다.
Reflect는 카테고리 수요를 검증했고(메타인지 = 제품), 대화록의 수동 분석 수용성도 증명했다
(P6 opt-in 수확의 정당화 근거). 구조적으로 Reflect가 가질 수 없는 것 세 가지가 곧 해자:
**정산 루프**(사후 분석으로 제조 불가) · **호스트 중립**(결정은 Claude 밖에서도 일어남) ·
**사용자 소유 원장**. 반영: R3-1 README 카피 방향에 포지셔닝 한 줄 추가 —
**"거울이 아니라 원장 (a ledger, not a mirror)"**. patterns는 과정 관찰이 아니라
정산된 결과의 빈도만 말한다는 척추 규칙이 이제 경쟁 차별화이기도 하다.

**정직한 현재 상태 (레이어 감사, 2026-07-11 코드 기준):** 척추(구조적 zero-judgment)·
정산·전제/재확인·출처 태깅 = **구현됨**. 무노력 캡처·결정론 복귀·MCP측 패턴·개방 계약/탈세션
= **문서에만 존재**. 8개 레이어 중 4개 미시공 — 이 간극이 P0~P5의 존재 이유다.

## R5-1 · 외부 심층 감사 수용 (Codex 5.6-Sol) — 전 항목 판정

총평 수용: *"제품 전략은 확정, 구현 명세엔 닫히지 않은 계약이 있다."* 아래 채택 항목들은
새 트랙이 아니라 **P-1 Spec Closure(신설, 2~3일, P0과 병행)**에서 확정한다.

**전면 채택 (검증됨):**
1. **Provenance 4계층.** MCP 툴 인자는 모델이 채운다 — `predicate_owner:'user'`는 증명이
   아니라 전언이다. 분리: `elicited_user`(픽커 응답) / `direct_user_command`(슬래시 명령
   직접 입력) / `host_reported`(모델이 전한 사용자 말) / `ai_surfaced`. **host_reported는
   user로 자동 승격 금지** — 승격은 elicited_user·direct_user_command만. elicitation 없는
   호스트의 텍스트 확인은 host_reported로 남고 카피도 그렇게 말한다("모델이 전한 당신의
   말"). 기존 R4-A provenance.ts의 전환 규칙을 이 4계층 위에 재정의.
2. **Debrief 증거 포인터 계약.** "byte-validate"가 대조할 원문이 스키마에 없었다. 필수:
   `source_ref + source_fingerprint(sha256) + raw_span(start,end) + raw_quote +
   normalization_version`. `pasted`/`host_reported`는 별도 신뢰 등급이지 byte-verified가
   아니다. (현 ingest가 trim() 저장·speaker 미파싱인 점 P-1에서 재확인)
3. **쓰기 락 엄격화 + 멱등성.** 현 원장은 fail-open("Lock or no lock, the work
   proceeds", 5초 락 탈취) — 두 세션 동시 settle 시 중복 정산 가능(코드 확인됨).
   v2 **의도적 설계 반전**: 책임 원장의 정합성 > 가용성. mutation은 락 실패 시 명시적
   재시도 오류(fail loud = 척추 정합), lock owner nonce+PID, 전 write tool 동일 규칙,
   이벤트에 `event_id`+`idempotency_key`, append 성공 후 LOGBOOK 실패의 dirty/rebuild
   규칙(doctor가 재생성).
4. **이벤트 공통 envelope (축소 채택).** 추가: `event_id, producer_version, project_id,
   session_id, occurred_at, logical_date+timezone(기존 resolveToday 형식화),
   actor_source, schema_version(기존 v)`. candidate/bearing/snooze **상태 전이표**를
   P-1 산출물로 명문화. 14일 만료는 **읽기 시 파생 상태**로 확정(새 이벤트 없음 —
   due-ness 파생과 일관, append-only 단순성 유지).
5. **Resource의 프로젝트 스코핑.** 글로벌 .bound 첫 항목 자동 선택은 타 프로젝트의
   사적 원장 노출 위험 — 채택: `argus://projects/{id}/ledger|due`, 무접두
   `argus://ledger`는 bound가 정확히 1개일 때만. (R2 수정안을 이 설계로 대체)
6. **"verified commit signal"로 개명 + 검증 강화.** 현 훅은 `\bgit\s+commit\b` 문자열
   매칭(코드 확인됨) — 결정론적 발화이되 분류는 휴리스틱. HEAD before/after 대조 +
   저장소 identity + anchored decision id 확인을 추가하고, IDE 커밋/-C/worktree는
   알려진 공백으로 문서화. "결정론적 착지" 표현 전량 교체.
7. **`decision_category` 신설.** 패턴의 "카테고리별 n"에 카테고리 필드가 없었다.
   seal 시 소분류(일정/채용/제품/기술/가격/기타), 분류 주체와 taxonomy_version 기록.
   사용자-facing 경향 문구는 **n≥5부터**(그 전엔 건수만), n<10 표본 주의 유지.
8. **Return capsule 계약 봉합.** 출력 스펙이 입력 스펙보다 컸다 — "가지 않은 길+포기
   이유 인용"은 seal의 선택 입력(`alternative_quote`, `reason_quote`, 증거 포인터 포함)
   으로 받고, 미입력 시 해당 줄은 **생략**(정직한 공백, 날조 금지).

**구조 결함 수정 (채택):**
- 케이던스 모순 해소: overdue 항목은 **매일 재노출이 사양**(단 snooze/dismiss 탈출구
  상시 부착), "동일 브리프 이틀 연속 금지" 인바리언트는 비-overdue 내용(후보·bearing·
  그물 줄)에만 적용.
- LOGBOOK은 "write-through 정본"이 아니라 **재생성 가능한 projection** — append와
  원자성 불가, dirty 마크 + doctor rebuild.
- .ics 표현 정정: "달력 파일 제공"이지 zero-setup 리마인더가 아니다(import는 사용자 행동).
- silent push의 발산 복구: 경량부터 — 실패 시 ledger에 `sync_pending` 표기 + 다음 툴
  호출에서 재시도 + 발산 상태 surface. 완전한 durable outbox는 백로그.
- 측정 분리: `brief_injected`(기계 관측)와 `brief_relayed`(P2의 20-cold-start 수동
  프로토콜로 표본 측정) — "전달률"을 자동 지표로 사칭하지 않는다.
- 수확 실행 모델 전환: detached 프로세스 생존에 의존하지 않고 **큐 영속화 → 다음
  SessionStart가 처리**를 기본 경로로(Windows/터미널 종료 내성).
- 플러그인 상태 저장 위치: legacy `~/.claude/argus-state` 대신 플러그인 지정 데이터
  디렉토리 사용 — 정확한 변수명은 P0 스파이크에서 공식 문서로 확정.
- renderer 수용 기준 정정: "byte-identical 출력"(폭이 다른데 불가)이 아니라 **동일
  BriefState 소비 + renderer별 골든 픽스처**.
- 슬래시 커맨드 수 정정(7: settle/candidates/debrief/return/bearing/mute/doctor) ·
  기존 4 Resources/4 Prompts의 호환·폐기 정책 1단락 추가.
- P5 문구 정직화: 5명 중 3명은 "median user 루프 닫힘"의 증명이 아니라 **프로토타입
  신호** — go/no-go 관문 문구를 그렇게 고쳐 쓴다.
- **일정 산수 정정: 총 8~9주(P5 관찰창 21일 포함), 실패-재시도 시 9~12주.** 표준화
  웨이브 별도 2주.

**정정·축소·기각 (비판적 검토 결과):**
- Sol의 telemetry 인용은 **구버전**(현 SECURITY.md:10은 "No telemetry by default" —
  #108에서 payload·opt-in·DO_NOT_TRACK·비식별 저장까지 이미 공시). 잔여 채택분:
  보존 기간(90일 정책)은 기존 open decision 그대로.
- `correlation_id/causation_id` 전체 채택 기각 — 로컬 단일 사용자 원장에 과잉.
  결정 id가 상관 축, 인과는 불요(필요 시 백로그).
- durable outbox 전체 기계 기각(위 경량안으로) · n≥10 하한 기각(5로 확정, 10 미만 주의 유지).

## R5-2 · P-1 Spec Closure (신설 단계, 2~3일, P0과 병행)

P1 착공 전 닫아야 하는 계약 5건: ① 이벤트 공통 envelope + candidate/bearing/snooze
상태 전이표 ② provenance 4계층 경계(승격 규칙 포함) ③ transcript 증거 포인터/byte-검증
계약 ④ project/worktree/resource identity 모델 ⑤ 락·멱등성·projection repair·
마이그레이션·telemetry 보존 규칙. 산출물: 본 문서의 부록 표 5장(코드 없이 계약만).
**P0(스파이크)은 즉시 착수 가능** — P-1과 병행.
