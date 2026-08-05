# Argus — Development Guidelines

## Commands

```bash
npm test                  # vitest run (전체) · npm test -- <경로>로 좁힌다
npx tsc --noEmit          # 타입 체크 (CI의 check 잡이 돌리는 것과 동일)
npm run lint              # eslint src --max-warnings=145 (임계 초과 시 실패)
npm run dev               # next dev — predev가 argus-mcp를 먼저 빌드한다
npm run build             # next build (prebuild도 kernel:build 경유)
```

게이트·검증 (2026-08-05 전부 실행 확인):

```bash
npm run preflight:dogfood      # 배포 전 전체 관문 (build+test+lint+gates+eval+plugin)
npm run gates                  # 플러그인 gate      npm run eval:static  # 정적 eval
npm run dogfood                # 커널 도그푸드 (모델 없이 300+ 스텝 시뮬레이션)
npm run experience:web:selftest # 브라우저 엔진 자체검사 — 로컬 서버라 네트워크 무관
ARGUS_BASE_URL=http://localhost:3000 npm run e2e:loop   # 결정 루프 E2E
```

- PR을 막는 것은 CI의 **check** 잡이고, 그 잡은 위 셋보다 훨씬 넓다:
  argus-mcp 패키지(빌드·타입·타르볼 E2E·호스트 적합성)와 argus-plugin-v2
  게이트 20여 개까지 같이 돈다. 앱 쪽 스텝만 로컬과 대응된다.
  - CI: `npx tsc --noEmit` · `npx eslint src/` · **`npx vitest run --coverage`**
  - **CI의 테스트는 커버리지 ratchet이 걸려 있다** (`vitest.config.ts` thresholds:
    lines 30 / stmts 29 / funcs 24 / branches 22). `npm test`는 커버리지를 안 재므로
    **로컬 초록 → CI 빨강**이 가능하다. 커버리지를 낮출 만한 변경(테스트 없는 큰
    파일 추가 등)은 `npx vitest run --coverage`로 먼저 확인한다.
  - lint는 반대로 로컬이 더 엄하다 (로컬 `--max-warnings=145`, CI는 무제한).
  - argus-mcp / argus-plugin-v2를 건드렸다면 로컬 `npm test`로는 아무것도 검증되지
    않는다 — 그 존은 자체 하네스를 갖고 있고 CI에서만 돈다.
- **`e2e:loop`·`e2e:surfaces`는 기본 대상이 프로덕션(`https://argus.voyage`)이다.**
  `ARGUS_BASE_URL`을 주지 않으면 로컬 변경분이 아니라 배포본을 검사한다. 클라우드
  세션에서는 외부 접속이 막혀 `ERR_TUNNEL_CONNECTION_FAILED`로 죽는다 — 앱 결함이
  아니다. 네트워크 없이 브라우저 경로를 확인하려면 `experience:web:selftest`.
- **브라우저 실행 경로는 `scripts/lib/playwright-executable.mjs`가 단일 출처다.**
  새 Playwright 스크립트는 `chromium.launch({ executablePath: playwrightExecutablePath() })`로
  띄운다. 빠뜨리면 샌드박스에서만 죽고 창업자 기기에서는 멀쩡해 재현이 안 된다.
- **웹앱은 Supabase 환경변수 없이 로컬 기동하면 `/[locale]` 경로가 500이다.** 키 없는
  환경에서 UI를 확인해야 하면 localStorage-only 화면(`/method-pilot`)만 뜬다 — 코드
  결함으로 오진하지 말 것.

## 저장소 지도

| 경로 | 무엇 | 라이선스 존 |
|---|---|---|
| `src/` | Next.js 16 앱 (App Router, `[locale]` 라우팅은 `src/proxy.ts`가 처리) | 앱 |
| `src/lib/__tests__/` | **가드 테스트 276개** — 아래 원칙 대부분을 기계로 강제 | 앱 |
| `method-harness/` | Track R 오프라인 하네스. `src/`와 상호 import 금지 (테스트가 차단) | 앱 |
| `docs/` | 정본 문서 (BLUEPRINT = 빌드 순서, ARGUS-METHOD-V1.0 = 방법 정본) | — |
| `argus-mcp/`, `argus-plugin-v2/` | MIT 존 — **PR은 앱 존과 섞지 않는다** | MIT |

## 빌드 정본 (모든 세션의 첫 규칙, 2026-07-07)

빌드 순서의 정본은 `docs/ARGUS-BLUEPRINT.md`다. 세션 시작 시 그 문서의
§6 공정표에서 **현재 공정**을 확인하고, 그 공정의 항목만 진행한다.
새 설계 문서(DESIGN-*, 감사, 계획서) 작성 금지 — 새 아이디어는 BLUEPRINT
§8 대기 목록에 한 줄로 추가하고 짓지 않는다. 단, **창업자가 독립 병렬 트랙과
기존 공정 무접촉 경계를 명시적으로 승인하고 BLUEPRINT에 등록한 단일 정본 문서**는
예외다. 예외 문서는 새 기능 표면을 곧바로 여는 허가가 아니다. 모든 PR 본문 첫 줄:
`공정 N · 겨냥 퍼널 단계 X→Y`.

exit 체크박스 `[x]`는 같은 커밋에서 `blueprint-exit-evidence.test.ts`의
EVIDENCE 맵 갱신과 함께만 (개수·파일 실존을 CI가 대조). 시공과 완료 판정을
분리한다 — exit 문구를 "무엇이 이걸 빨간불로 만드는가"로 검증한 뒤 체크한다.

## Checklist: Adding a New Field to a Type

When adding a field to any TypeScript interface (e.g., `Persona`, `RecastStep`), check ALL of these:

1. **Type definition** (`src/stores/types.ts`) — add the field
2. **Store creator** (e.g., `createPersona()` in `usePersonaStore.ts`) — map the field explicitly
3. **Store defaults** (e.g., `DEFAULT_PERSONAS`) — include the field with a realistic value
4. **Supabase table** — add the column via `apply_migration` (아래 Schema Sync 규약)
5. **All prompts that use this type** — 프롬프트 위치는 리팩터링으로 계속 움직인다.
   파일명을 외우지 말고 그때그때 찾는다:
   `grep -rn "SYSTEM_PROMPT\|SystemPrompt\|<user-data>" src/lib src/components`
6. **UI that displays this type** — update cards, forms, detail views
7. **Handoff/conversion functions** — `autoPersonaToFull()`, `buildDecomposeContext()`, etc.

## Principle: The Zero-Judgment Gate (every new user-facing surface)

> **Planning amendment — Track R (2026-08-03, founder-directed):** the runtime
> rules below remain binding on the currently shipped product until an explicit
> R4 migration, but they are **not a constraint on R0–R3 method research**.
> A fresh Track R reviewer must read `docs/ARGUS-METHOD-CONTEXT-2026-08-04.md`
> for the decision history, then the current method canon for the normative
> proposal. The context document explains; it does not override the canon.
> `docs/ARGUS-METHOD-V1.0.md` (STABLE; supersedes v0.1–v0.8) reopens the broad
> prohibition on directional coaching. The planning-canon replacement is `honest
> agency`: Argus may actively analyze, challenge, generate alternatives, research,
> simulate, and make conditional recommendations, while never laundering AI advice
> into the user's decision or inference into reality. v1.0 reconciles this with
> the over-fire stress-test evidence below: the fire-or-not gate and the
> no-verdict-about-the-person rule survive unchanged in every regime; within
> user-hired decision work, influence is controlled by structure (pre-advice
> baselines, falsifiable reframes, ledger-checked recommendation grounding, a
> stakes-by-initiative hierarchy that forbids AI-pushed directional
> recommendations at major/one-way stakes, observation-first returns, and sealed
> adoption metrics) — not by provenance tags or disclaimers, which the stress
> test showed cannot neutralize tilt. R1 (method manual) and R2 (offline
> harness under `method-harness/`) are authorized; do not implement any of this
> in a live surface before the R3 evidence gate and the corresponding
> Blueprint/runtime amendment.

Argus's spine is `maximum generation, zero judgment`. Before shipping any new
surface, pass it through one gate:

> **Does this feature generate, or does it judge the user's decision / narrate
> ownership in their stead? If it judges, it violates the spine.**

Three concrete rules that follow (full rationale in the Zero-Judgment
Invariant design notes, kept privately):

1. **Never lie about authorship.** A machine-surfaced sentence must not silently
   inherit a user-owned field (`real_bet`, `governing_idea`). Tag provenance
   (`user` vs `ai_surfaced`) and shade it — but **keep every friction escape**
   (skip / believe-all / use-as-is). The invariant is honest provenance, NOT a
   forced-typing gate (which ejects the tiredest user → zero ownership).
2. **No user-facing verdict about who the user is.** Do not surface an
   uncalibrated score/tier (e.g. Judgment Vitality `gamma`) to the user. Such
   metrics may diagnose the product pipeline, but must not route coaching,
   personalize prompts, or become self-knowledge. Meaning-language about the
   user must pass BLUEPRINT §9.8/E: provenance + independent cases + scope +
   counterexample + user review; sample size alone is not permission.
3. **Verification is not a chat.** No conclusion is verified by debating the model
   in-frame; verification is a single-shot commitment plus reality at settlement.
   This is an internal design invariant — do NOT turn it into landing copy.
4. **Over-fire is also a spine violation (the mirror clause).** `zero judgment`
   is wider than "don't judge the user" — it also means **don't judge *whether to
   intervene* in the user's stead.** A surface over-fires when it manufactures a
   fork on a genuinely flat decision, runs ceremony on a low-stakes/reversible
   one, reopens a decision the user already closed, or pushes engagement when
   "stay / do nothing" is the right answer. Three rules follow:
   - **Default = restraint.** Name at most one load-bearing assumption and return
     the handle. Never emit an engine-weighted pole to the user.
   - **Firing form = a bare neutral crux *question*.** Never a directional
     statement, never a two-pole fork, and **never a disclaimed lean** ("this
     leans toward X, but it's not my verdict" tested as a spine violation — you
     cannot launder a verdict by tagging it; per-output tilt-tagging makes it
     *worse*). Honest provenance is necessary but **not** sufficient.
   - **The fire-or-not gate runs BEFORE the form.** A crux-question template left
     as the default will manufacture a question on a flat case.

   The residual lean that survives all of this is irreducible (`value ∝ leverage
   ∝ tilt`) — so `zero judgment` is an **asymptote you approach and disclose at
   the product level**, not a state you claim. Never write "we don't judge";
   write "we surface the one question, and name the faint lean as a known limit."
   (Evidence: the 8-round engine stress test — flat-case over-fire 60%→0% under a
   restraint default, total harm 11→6. Numbers live in the internal design notes,
   not here.)

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

The positive pattern to copy: `reframeSystemPrompt()` (`src/lib/reframe-core.ts`)
is the single brain shared by the web ReframeStep AND the Telegram bot, so it
can't drift. `src/lib/persona-prompt.ts` (`buildFeedbackSystemPrompt`)는 같은
방식으로 중앙화된 페르소나 프롬프트다 — 현재 직접 소비자는 테스트뿐이므로,
페르소나 피드백 표면을 다시 열 때 새로 쓰지 말고 이것을 부른다.

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

## 실기기 검증 안전 규칙 (2026-07-27 터미널 사고 — 위반 금지)

1. **claude 프로세스를 절대 죽이지 않는다.** `Stop-Process -Name claude`,
   `taskkill /IM claude*`, `pkill claude` 등 이름 기반 킬 전면 금지 — 다른
   워크트리의 모든 세션까지 동시에 죽고, 강제 종료된 CLI는 터미널 모드(마우스
   추적)를 복원하지 못해 이후 셸에 `[555;..M` 이스케이프 시퀀스가 쏟아진다.
   재시작이 필요하면 사용자에게 요청하거나, **자신이 띄운 특정 PID만** 종료.
2. **기존 사용자 세션 창에 키 입력·클릭을 시뮬레이션하지 않는다.** 실기기
   검증(computer-use)은 새로 띄운 전용 창에서만; 기존 창은 관찰(읽기)만.
3. 위 1은 `.claude/hookify.block-claude-process-kill.local.md` 훅이 기계로도
   차단한다 — 훅이 없는 환경에서도 이 규칙은 그대로 적용된다.

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

- **localStorage first, Supabase async** — app works offline, syncs when connected.
  이것이 아래 Persistence·Schema Sync 규약이 존재하는 이유다: 로컬만 읽는 UI는
  서버에 데이터가 안 닿아도 멀쩡해 보인다.
- **Zustand stores** — each store has loadData (merge local+remote), mutation methods
- **Context chain** — typed data flows: decompose → recast → persona-feedback → refinement
- **Quality signals** — `signal-recorder.ts` records implicit user behavior for learning
- **Handoff store** — transient data between steps, consumed on mount via `useEffect([], [])`
- **Track R (`method-harness/`)** — 이벤트 소싱 원장 + 결정론 validator. `src/`와
  무접촉이 원칙이며, 유일한 예외는 `src/app/method-pilot/`(R3-B 파일럿 통로)다.
  이 경계는 `method-harness/__tests__/harness.test.ts`가 기계로 지킨다.

## LLM Prompt Injection Guidelines

- Derived pattern data is **excluded by default**. Calling it "참고" does not
  neutralize its influence; BLUEPRINT §9.8 requires an active scoped grant.
- Current-task content and user-authored in-scope constraints are primary. A
  granted memory stays secondary and must produce an `InfluenceTrace`.
- `src/lib/epistemic/control-plane.ts` is the sole derived-memory authority.
  Endorsement is not a grant; scope, expiry, revoke, counterexamples, and
  `ask_once` reuse are checked there. If the trace cannot be persisted, influence
  must fail closed to zero — never add a second prompt-side bypass.
- Keep injection concise — one line per insight, not paragraphs
- Never inject blanket behavioral changes ("be conservative") — always scope to specific contexts
- User data in system prompts MUST be wrapped in `<user-data>` tags and passed through `sanitizeForPrompt()` (see `persona-prompt.ts`)

## Design: Banned Patterns (창업자 확정, 모든 세션 적용)

- **왼쪽 세로 악센트 바 금지** (2026-07-08): 텍스트 블록 왼쪽의 `border-l-[Npx]
  border-[var(--accent)]` 세로 바(인용 바, "손톱 모양") 영구 금지 — 화면마다
  반복되며 싸구려 장치가 됨. 인용/강조는 배경 틴트 블록(`rounded-lg
  bg-[var(--accent)]/[0.04] px-4 py-3`, 테두리 없음)이나 활자 위계로.
  `no-left-accent-bar.test.ts`가 CI에서 재등장을 막는다.

## XSS / User Input Security

- **React JSX auto-escapes** — `{variable}` in JSX is safe. This is why we have NO XSS issues currently.
- **NEVER use `dangerouslySetInnerHTML` with user data** unless it passes through `sanitizeHtml()` from `lib/sanitize.ts`
- **If adding markdown rendering** (react-markdown, marked, etc.): MUST sanitize output HTML. Use `sanitizeHtml()` or install `isomorphic-dompurify`.
- **All text inputs must have `maxLength`** — prevents oversized data in localStorage/Supabase
- **Team-visible data** (comments, reviews, names) is highest priority for sanitization
- **Supabase writes** (synced records) must go through `db.ts` functions — never call `supabase.from().insert()` directly in stores. NOTE: `sanitizeItem` is a **sync-correctness gate, NOT a security sanitizer** — it only strips `user_id/created_at/updated_at` so RLS `WITH CHECK` isn't violated and timestamps aren't clobbered. It does **no** HTML-escaping and enforces **no** `maxLength`. The real XSS defense is React JSX auto-escaping at the render layer; length limits live on the inputs (`maxLength`). Do not treat db.ts as an injection/length boundary — if you ever add `dangerouslySetInnerHTML`/markdown on a synced field, sanitize at render via `sanitizeHtml()`. (Server-only tables written from API routes with the service role correctly bypass db.ts by design.)
