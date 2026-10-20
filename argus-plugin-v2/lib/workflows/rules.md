---
name: rules
user-invocable: false
description: "The signed-decision book for this repository: read the rules already written here, rehearse them against past work, sign one the user explicitly confirms, and answer the ones due for another look. Invoked through `/argus:history rules`."
argument-hint: "[rehearse [days] | sign \"<sentence>\" | due | list]"
---

# Internal rules workflow — 결정 장부

**What this is:** the place where a decision the user makes while working with AI
becomes a rule agents in this repository read and keep — **only after the user
signs it.** Signed rules are briefed to the agent at every session start, watched
where the machine can watch them, and come back on the date the user chose.

The engine is the plugin's own MCP package, called as a command. Always run it
from the repository root:

```bash
E="npx -y argus-decision-mcp"
ROOT="$(git rev-parse --show-toplevel)"
```

(The plugin's MCP server already downloaded it, so `npx` starts from cache.)

## Route by the argument

| Input | Do |
|---|---|
| (none) or `list` | **Read-only.** `$E dec-brief --argus-dir "$ROOT/.argus" --dry --max 50` if `"$ROOT/.argus/ledger/ledger.jsonl"` exists; otherwise `$E dec-hello --repo "$ROOT" --dry`. Relay `say` lines verbatim. If both are silent, say in one line that nothing is signed here and no rule files were found. |
| `rehearse` (+ optional days, default 30) | **Read-only.** `$E dec-rehearse --repo "$ROOT" --days <days>`. Relay `say` verbatim. Then offer, in one line, to sign one of the listed clauses. |
| `sign "<sentence>"`, or the user says "이거 법으로 / 이거 서명 / 앞으로 이렇게 하자" | The signing ritual below. |
| `due` | `$E dec-due --argus-dir "$ROOT/.argus"`. Relay `say`. If the user answers, run the matching command it printed with the user's own words in `--why` / `--decision`. Never pick keep / amend / sunset for them. |

## The signing ritual (the only write in this workflow)

1. **Show exactly what will be signed**, then stop and wait:

   ```text
   서명할 문장: "<the sentence, verbatim>"
   출처: <내가 방금 한 말 | 이 저장소의 CLAUDE.md 조항 <id> | 지난 대화 <date>>
   걸리는 곳: 이 저장소 (scope: repo)
   다시 볼 날: <date, default +14d — ask if the user named one>
   서명할까요? (예 / 문장 고치기 / 아니오)
   ```

2. Sign **only** on an explicit yes in the user's next message. Silence, "음",
   or a topic change is not a yes. A "yes" that edits the sentence → show the
   edited sentence again and ask once more.

3. Run one of:

   ```bash
   # a clause already written in a rule file (keeps the byte-checked quote)
   $E dec-sign --argus-dir "$ROOT/.argus" --repo "$ROOT" --from-clause "<file#clause-id>" \
     --author "$(git config user.name)" --review <YYYY-MM-DD|+14d>

   # a sentence the user said or confirmed
   $E dec-sign --argus-dir "$ROOT/.argus" --repo "$ROOT" --decision "<sentence>" \
     --author "$(git config user.name)" --provenance <user|ai_surfaced> \
     --review <YYYY-MM-DD|+14d> [--because "<the user's reason, verbatim>"] \
     [--origin-session "<session id the sentence came from>"]
   ```

   **Provenance is not a formality.** `--provenance user` only when the sentence is
   the user's own words (typed now, or quoted verbatim from their past message).
   If you drafted or tightened the wording — even slightly — it is `ai_surfaced`,
   and you say so before they sign. `--because` is only ever the user's words;
   never write a reason for them.

4. Relay the result in three lines: the id (`D-0001`), the file it wrote
   (`decisions/D-0001.md`), and the `blind_spots` line verbatim — what the
   machine will *not* catch. If the result says `exported` wrote `AGENTS.md`,
   tell the user that file now carries the signed rules for other agents.

## Non-negotiable

- Never sign in bulk. One sentence, one explicit yes, one `dec-sign`.
- Never invent a rule, a reason, a review date the user refused, or an author.
- Never describe a rehearsal hit as a violation or a judgment of the user. It is
  "where this rule would have asked" — the engine already words it that way.
- `dec-pause`, `dec-close --sunset`, and `dec-leave` change or remove the law.
  Run them only when the user asks for exactly that in this conversation.
- If the engine errors, show the error line and the command; do not retry with
  guessed flags.
