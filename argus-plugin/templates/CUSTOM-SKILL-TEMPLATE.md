---
name: my-skill
description: "한 줄 설명 — 이 스킬이 뭘 하는지, 언제 쓰는지"
argument-hint: "[입력 설명]"
allowed-tools: Read, Write, AskUserQuestion
---

## When to use

- ✓ [이 스킬을 쓰는 상황 1]
- ✓ [이 스킬을 쓰는 상황 2]
- ✗ [이 스킬을 쓰면 안 되는 상황]

**Always respond in the same language the user uses.**

## Step 1: [즉시 실행]

**입력을 받으면 즉시 결과를 보여준다. 인터뷰나 질문 먼저 하지 않는다.**

---

**Argus · [스킬명]**

[첫 결과물 — 사용자가 바로 쓸 수 있는 수준]

---

## Step 2: [심화] (선택)

AskUserQuestion으로 추가 정보를 수집하고 결과를 개선한다.

## Step 3: [최종 결과]

[완성된 결과물]

---

## Rendering rules

- Markdown first. Bold, blockquote, list, diff blocks.
- **No box drawing.** No `╭╮╰╯`, `┌│└`, `═══`. Use `---`, `**bold**`, whitespace.
- **diff = color.** `+` = positive (green). `-` = risk (red).
- See `RENDERING-RULES.md` for full reference.

## Context chain (선택)

이전 스킬의 결과를 읽으려면:
```
Read `.argus/reframe.md` or `.argus/last-run.md`
```

결과를 다음 스킬에 전달하려면:
```
Save to `.argus/my-skill.md`:
- Top: human-readable output
- Bottom after `---`: Context Contract (yaml)
```

See `CONTEXT-CONTRACT.md` for schema.

## Journal (선택)

```
## [date] /my-skill — [topic, ≤5 words]
- [key metric 1]
- [key metric 2]
```

## 설치

이 파일을 `~/.claude/skills/my-skill/SKILL.md`에 저장하면 바로 사용할 수 있습니다.
