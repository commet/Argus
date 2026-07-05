# Argus — Development Guidelines

## Checklist: Adding a New Field to a Type

When adding a field to any TypeScript interface (e.g., `Persona`, `RecastStep`), check ALL of these:

1. **Type definition** (`stores/types.ts`) — add the field
2. **Store creator** (e.g., `createPersona()` in `usePersonaStore.ts`) — map the field explicitly
3. **Store defaults** (e.g., `DEFAULT_PERSONAS`) — include the field with a realistic value
4. **Supabase table** — add the column via `apply_migration`
5. **All prompts that use this type** — update every system prompt that injects this data
   - `PersonaFeedbackStep.tsx` FEEDBACK_SYSTEM
   - `RefinementLoopStep.tsx` re-review prompt
   - `RecastStep.tsx` SYSTEM_PROMPT
6. **UI that displays this type** — update cards, forms, detail views
7. **Handoff/conversion functions** — `autoPersonaToFull()`, `buildDecomposeContext()`, etc.

## Principle: The Zero-Judgment Gate (every new user-facing surface)

Argus's spine is `maximum generation, zero judgment`. Before shipping any new
surface, pass it through one gate:

> **Does this feature generate, or does it judge the user's decision / narrate
> ownership in their stead? If it judges, it violates the spine.**

Three concrete rules that follow (full rationale in
`docs/ARGUS-FINAL-DIRECTION.md` → Zero-Judgment Invariant, and
`docs/ESSAY-IMPLICATIONS-judgment-ownership-2026-06-15.md`):

1. **Never lie about authorship.** A machine-surfaced sentence must not silently
   inherit a user-owned field (`real_bet`, `governing_idea`). Tag provenance
   (`user` vs `ai_surfaced`) and shade it — but **keep every friction escape**
   (skip / believe-all / use-as-is). The invariant is honest provenance, NOT a
   forced-typing gate (which ejects the tiredest user → zero ownership).
2. **No user-facing verdict about who the user is.** Do not surface an
   uncalibrated score/tier (e.g. Judgment Vitality `gamma`) to the user. Keep it
   internal-routing-only or remove it. Meaning-language to the user comes only
   from `patterns`' sample-size-scaled frequency statements.
3. **Verification is not a chat.** No conclusion is verified by debating the model
   in-frame; verification is a single-shot commitment plus reality at settlement.
   This is an internal design invariant — do NOT turn it into landing copy.
4. **Over-fire is also a spine violation (the mirror clause).** `zero judgment`
   is wider than "don't judge the user" — it also means **don't judge *whether to
   intervene* in the user's stead.** A surface over-fires when it manufactures a
   fork on a genuinely flat decision, runs ceremony on a low-stakes/reversible
   one, reopens a decision the user already closed, or pushes engagement when
   "stay / do nothing" is the right answer. The default must be *restraint*
   (name at most one load-bearing assumption + return the handle), not a weighted
   two-pole fork — never emit an engine-weighted pole to the user. Rationale and
   evidence: the 4-round engine stress test
   (`docs/STRESS-SYNTHESIS-rounds1-4-2026-06-16.md`) found a find-the-leverage
   engine over-fires on 60% of flat cases and tilts forks in ways `ai_surfaced`
   tagging cannot neutralize. Honest provenance is necessary but **not** sufficient.
   **Refinement (rounds 5–8, `docs/STRESS-SYNTHESIS-rounds5-8-2026-06-17.md`):**
   the restraint default *works* — flipping to an under-fire default killed flat
   over-fire (60%→0%) and the redesign halved total harm vs the old engine
   (11→6) — so the fix is real, but two rules fall out of it. (a) **Firing form =
   a bare neutral crux *question*, never a directional statement, never a
   two-pole fork, and NEVER a disclaimed lean** ("this leans toward X, but it's
   not my verdict" still tested as a spine violation — you cannot launder a
   verdict by tagging it; per-output tilt-tagging makes the violation *worse*).
   (b) The *fire-or-not* gate must run **before** the form — a crux-question
   template left as the default will manufacture a question on a flat case. The
   residual lean that survives all of this is irreducible (`value ∝ leverage ∝
   tilt`: the highest-leverage assumption is the one that most points at the
   flip) — so `zero judgment` is an **asymptote you approach and disclose at the
   product level**, not a state you claim. Never write "we don't judge"; write
   "we surface the one question, and name the faint lean as a known limit."

## Principle: Honest Structure over Plausible Fabrication (the LLM-glue invariant, 2026-07-05 근원 분석)

The single deepest lesson from the agent-architecture audit
(`docs/AGENT-ARCHITECTURE-FOUNDATIONAL-2026-07-05.md`): **an LLM turns a
*structural* bug into *silent quality degradation*.** A normal program with a
broken wire crashes or returns null; an LLM pipeline with a broken wire returns a
**confident, plausible, slightly-wrong** answer — because the model fills every
gap. A dropped field, a mis-assigned agent, a missing input: none error, all look
fine, and "plausible" is indistinguishable from "correct" without ground truth.
This is *why* demos are easy and products take years (Karpathy) — the LLM hides
the seams, so the gap between "looks like it works" and "works" is enormous.

The fix is **not** "make the LLM smarter" (its gap-filling is intrinsic). It is:

> **The structure must make "plausible" unable to masquerade as "correct."**
> **Every gap either fails LOUD (compile/CI/crash) or is surfaced HONEST to the
> user — it is NEVER silently filled by the model.**

Five operating rules that follow (each is a shipped fix — copy the pattern):

1. **Honest gap over fabrication.** A missing input / no-fit / no-answer must be
   *named* (block, `unfilled`, "awaiting X", abstain), never papered over with an
   invented stand-in. The model is forbidden from standing in for absent human
   input or an absent qualified agent. (Layer-0 ready-gate; F3 `unfilled`.)
2. **Type the verbs, not just the nouns.** The compiler guards data *shapes* but a
   stage hand-off is a template string it can't see — so a produced field is
   dead-on-arrival by default. Guard *consumption*: every produced field is
   consumed or explicitly waived, enforced by a test. (F2 consumption contract.)
3. **The human's judgment is load-bearing, not decoration.** The user's own call
   must reach the outcome *as theirs* (provably, `authored:'user'`), or the mirror
   is a mirror in name only. (F1.)
4. **Deterministic structure owns routing/ordering; the LLM does creative work
   inside the cells.** Don't put the LLM on the hot path as router/orchestrator —
   make wiring explicit, deterministic, testable; declare dependencies, don't
   infer them at runtime. (F3 deterministic capability router; F4 declared DAG.)
5. **Plausible ≠ verified.** In-frame LLM agreement is never verification; only
   reality at the settle date is. Don't let a fluent draft *feel* validated.

Litmus test before shipping any agent/pipeline surface: *"If a wire here silently
broke, would anything turn red — or would the LLM just produce a plausible wrong
answer and everyone move on?"* If the latter, add the loud failure or the honest
surface first. Standard patterns this rests on (not invented): Contract-Net
no-bidder escalation, DAG/topological scheduling, classification **abstention**
(reject-option), allow-list hard eligibility — apply them, don't reinvent.

## Principle: Single Source of Truth for Prompts

Never copy-paste a system prompt to a second location. Extract it to a shared
function in a lib file so the two surfaces can't drift.

Resolved: the former `FEEDBACK_SYSTEM` duplication (PersonaFeedbackStep /
RefinementLoopStep) is centralized in `src/lib/persona-prompt.ts`
(`buildFeedbackSystemPrompt`). The positive pattern to copy: `reframeSystemPrompt()`
(`src/lib/reframe-core.ts`) is the single brain shared by the web ReframeStep AND
the Telegram bot, so it can't drift.

Deliberate NON-violation (do not "fix" this): `recastSystemPrompt()`
(`src/lib/recast-core.ts`) and `RecastStep.tsx`'s prompt look like duplicates but
are intentionally separate brains — the bot emits a minimal `RecastStepLite`
(task/actor/why) sized for a chat message, while the web step emits a full
`RecastAnalysis` (storyline, suggested_reviewers, ratios, …). They share the
actor-split *thesis*, not the output shape; delegating RecastStep to the bot's
prompt would feed the rich web UI a 3-field object and break it.

## Principle: Persistence Declaration (2026-06-13 근원 분석에서 추가)

localStorage-first 아키텍처에서 UI는 로컬만 읽는다 — 서버에 안 가는 데이터도
모든 화면과 모든 테스트(경계 mock)에서 멀쩡해 보인다. 그래서:

1. **새 사용자 입력/행동 데이터를 저장할 때는 거취를 선언한다** — 키를
   `STORAGE_KEYS`에 등록하고 `persistence-contract.test.ts`의 CONTRACT에
   synced(테이블) 또는 localOnly(사유)로 적는다. 사설 키 리터럴은 CI가 막는다.
2. **경로 이주(legacy→new flow) 때는 옆줄도 같이 옮긴다** — 기능을 새 흐름으로
   옮길 때 옛 흐름의 부수 호출(recordSignal, record*, track 류)을 grep해서
   각각 이식하거나 명시적으로 포기 기록을 남긴다. (signal-recorder가 4R에만
   연결된 채 progressive가 주 경로가 되어 2.5달간 신호 0건이었던 사례)
3. **현실 접촉 후엔 행수도 본다** — 실주행 관찰에 "예상 테이블에 행이 늘었나"
   1줄을 포함한다. UI가 멀쩡한 것과 데이터가 도착한 것은 다른 사실이다.

## Principle: Defensive Data Access

All data from these sources must use optional chaining + fallbacks:
- **localStorage** — old data may lack new fields: `persona.feedback_logs || []`
- **LLM output** — may omit fields or return wrong types: `result.classified_risks || []`
- **Supabase merge** — remote data may have different shape: `item.analysis?.steps || []`

Pattern: `(data.field || fallback)` for arrays/strings, `data?.field` for optional access.

## Principle: Clean Removal

When removing a feature:
1. Delete the component/function
2. `grep -r "FeatureName"` across entire `src/` to find ALL references
3. Remove imports, state variables, i18n keys, type fields
4. Check if Supabase table has related columns (cleanup optional)

## Principle: Schema Sync (2026-06-13 강화)

`sanitizeItem` (db.ts)는 `user_id/created_at/updated_at`만 빼고 **나머지 필드를
전부 그대로 upsert로 보낸다.** 그래서 동기화되는 인터페이스(Project/Persona/…)에
컬럼 없는 필드를 추가하면 PostgREST가 PGRST204로 **행 전체를 거부**하고 — 에러는
삼켜지므로 — 그 사용자의 데이터가 조용히 서버에 안 닿는다 (2026-06-13: contact가
채워진 페르소나가 정확히 이렇게 동기화를 멈췄던 사례).

규약:
1. 동기화 인터페이스에 필드를 추가하면 **같은 커밋에서 마이그레이션으로 컬럼을
   추가**하고 `src/lib/__tests__/schema-drift.test.ts`의 `TABLE_COLUMNS`를 갱신한다.
   안 하면 그 가드 테스트가 PR을 막는다 (실DB 컬럼의 사본 대조).
2. `deleted_at` 등 soft-delete가 쓰는 컬럼이 실재하는지 확인 — 없으면 삭제가
   서버에서 no-op이 되어 삭제한 행이 reload 시 부활한다.
3. 새 동기화 테이블을 `TableName`에 추가하면 그 테이블이 실DB에 **존재하는지**
   확인 — reframe/recast/synthesize는 TableName에만 있고 테이블이 없어 전부
   localStorage-only였다 (조용히).
4. `user_id` 컬럼이 있는 새 테이블 = `user-data-tables.ts`(USER_DATA_TABLES) +
   `erasure-coverage.test.ts`(LIVE_USER_SCOPED_TABLES) **동시 갱신** — 안 하면
   계정 삭제·내보내기가 그 테이블을 영영 건너뛴다 (2026-07-03: decision_items·
   review_receipts가 정확히 이렇게 누락됐던 사례).

확인 SQL:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'TABLE_NAME';
```

## Architecture Notes

- **localStorage first, Supabase async** — app works offline, syncs when connected
- **Zustand stores** — each store has loadData (merge local+remote), mutation methods
- **Context chain** — typed data flows: decompose → recast → persona-feedback → refinement
- **Quality signals** — `signal-recorder.ts` records implicit user behavior for learning
- **Handoff store** — transient data between steps, consumed on mount via `useEffect([], [])`

## LLM Prompt Injection Guidelines

- Pattern data is **reference only**, not directive: "참고: ..." not "반드시 ..."
- Content-based judgment is always primary, user patterns are secondary
- Keep injection concise — one line per insight, not paragraphs
- Never inject blanket behavioral changes ("be conservative") — always scope to specific contexts
- User data in system prompts MUST be wrapped in `<user-data>` tags and passed through `sanitizeForPrompt()` (see `persona-prompt.ts`)

## XSS / User Input Security

- **React JSX auto-escapes** — `{variable}` in JSX is safe. This is why we have NO XSS issues currently.
- **NEVER use `dangerouslySetInnerHTML` with user data** unless it passes through `sanitizeHtml()` from `lib/sanitize.ts`
- **If adding markdown rendering** (react-markdown, marked, etc.): MUST sanitize output HTML. Use `sanitizeHtml()` or install `isomorphic-dompurify`.
- **All text inputs must have `maxLength`** — prevents oversized data in localStorage/Supabase
- **Team-visible data** (comments, reviews, names) is highest priority for sanitization
- **Supabase writes** must go through `db.ts` functions (which call `sanitizeItem`) — never call `supabase.from().insert()` directly in stores
