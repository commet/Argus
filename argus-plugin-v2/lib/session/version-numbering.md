# Version Label Algorithm

Ported from webapp's `src/lib/version-numbering.ts` (2026-04-24). Plugin skills
implement this logic in Bash/Claude reasoning — no bundled JS required for MVP.

## Shapes

| Label | Meaning |
|---|---|
| `v0` | Virtual root (no actual draft). Used as `parentLabel` for the first draft. |
| `v0.1` | First iteration on the main line (root draft). |
| `v0.3` | Later main-line node. |
| `v0.1.1` | Branch off `v0.1` (happens when `v0.1` already has a main-line child). |
| `v1.0` | Promoted release from some `v0.N`. |
| `v1.1`, `v1.2`... | Main line after `v1.0` promotion. |
| `v1.2.1` | Branch off `v1.2`. |

## Algorithms

### `parseLabel(label)` → `number[]`

```
"v0.3.1" → [0, 3, 1]
"v0"     → [0]
```

### `formatLabel(parts)` → `string`

```
[0, 3, 1] → "v0.3.1"
[0]       → "v0"
```

### `incrementLastTier(label)` → `string`

```
"v0.3"    → "v0.4"
"v1.0"    → "v1.1"
"v0.3.1"  → "v0.3.2"
"v0"      → "v0.1"  (special: virtual root's first child)
```

### `nextChildLabel(parentLabel, existingChildren)` → `string`

```
if existingChildren is empty:
  return incrementLastTier(parentLabel)  # Main line continues
else:
  branchPrefix = parentLabel + "."
  branchCount = count of existingChildren where label.startsWith(branchPrefix)
  return branchPrefix + (branchCount + 1)  # New sub-tier branch
```

Note: the first (main-line) child of `v0.3` is `v0.4` — it does NOT start with `v0.3.`, so it's excluded from `branchCount`.

### `promoteToMajor(label)` → `string`

```
"v0.3"     → "v1.0"
"v0.3.1"   → "v1.0"  # The node declares itself the major regardless of depth
"v1.2"     → "v2.0"
"v1.2.1"   → "v2.0"
```

### `isPreRelease(label)` → `boolean`

```
"v0.3"  → true
"v0.1.2" → true
"v1.0"  → false
"v2.3"  → false
```

## Example walkthrough

Session starts with no drafts. Root `parentLabel` is `ROOT_LABEL = "v0"`.

1. First `the team step (review)` completes → draft added. `parentLabel = "v0"`, no existing children → `incrementLastTier("v0")` = `"v0.1"`. Draft labeled `v0.1`. This becomes the root of the draft tree (its own `parent_draft_id` is `null`).

2. User runs `the revise step (review)` with a directive → new draft child of `v0.1`. `parentLabel = "v0.1"`, no existing children of `v0.1` → `incrementLastTier("v0.1")` = `"v0.2"`. Labeled `v0.2`.

3. User explores an alternative: `/argus:versions --checkout v0.1` then `the revise step (review)`. `parentLabel = "v0.1"`, existing children = [`"v0.2"`]. Not empty. `"v0.2"` doesn't start with `"v0.1."` → branchCount = 0 → new label = `"v0.1.1"`. Labeled `v0.1.1` (branch from v0.1).

4. User continues main line: `the revise step (review)` on `v0.2` → new child. `parentLabel = "v0.2"`, no children → `"v0.3"`. Labeled `v0.3`.

5. User promotes: `/argus:versions --promote v0.3` → `promoteToMajor("v0.3") = "v1.0"`. Draft relabeled, `released_draft_id` set.

6. User continues: `the revise step (review)` on `v1.0` → `incrementLastTier("v1.0")` = `"v1.1"`. Labeled `v1.1`.

## Tree visualization

The above session produces:

```
v0.1 ─┬── v0.2 ─── v0.3 ── (promoted to v1.0) ─── v1.1
      └── v0.1.1  (branch)
```

## Rendering rules (for `/argus:versions`)

- Root node: `v0.1` always (or equivalent if session was imported).
- Main-line children: drawn horizontally with `───`.
- Branches: drawn vertically with `├─` or `└─`.
- Active draft: append `← active`.
- Released draft: append `🏷 released` after label.
- Change summary: append in parentheses after label.

Example with annotations:

```
v0.1 (첫 초안) ─┬── v0.2 (인력 추가) ─── v1.0 (🏷 released)
                └── v0.1.1 (ISTJ 우려 반영)  ← active
```
