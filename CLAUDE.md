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

## Principle: Single Source of Truth for Prompts

Never copy-paste a system prompt to a second location. If the same persona prompt is needed in both PersonaFeedbackStep and RefinementLoopStep, extract it to a shared function in a lib file.

Current violation: FEEDBACK_SYSTEM exists separately in PersonaFeedbackStep and a similar version in RefinementLoopStep. These MUST be kept in sync.

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
