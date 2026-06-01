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

## Principle: Single Source of Truth for Prompts

Never copy-paste a system prompt to a second location. If the same persona prompt is needed in both PersonaFeedbackStep and RefinementLoopStep, extract it to a shared function in a lib file.

Current violation: FEEDBACK_SYSTEM exists separately in PersonaFeedbackStep and a similar version in RefinementLoopStep. These MUST be kept in sync.

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

## Principle: Schema Sync

After modifying `stores/types.ts`, immediately check if the corresponding Supabase table needs a migration:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'TABLE_NAME';
```
Compare against the TypeScript interface. Add missing columns.

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
