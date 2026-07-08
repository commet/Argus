# Argus daily-watch snippet (optional)

An MCP stdio server is passive — nothing wakes it between your sessions. These
two optional snippets let your *host* carry the daily-watch rhythm instead.
Nothing here is required; Argus works without them.

## 1. CLAUDE.md block (Claude Code / any CLAUDE.md-style host)

Paste into your project's `CLAUDE.md` (or your global one):

```markdown
## Argus daily watch

- At the start of a session, call `argus_check_in` once — it reports what is
  due and mirrors yesterday's watch anchor. If I state today's aim and want it
  kept, record it VERBATIM with `argus_watch` (op=anchor).
- While we work, when I ask to "note this" / "keep this as a premise" /
  "remind me to re-judge this later", record it verbatim with `argus_watch`
  (op=capture). Do NOT volunteer captures on routine work.
- Never evaluate an anchor, never report completion rates, never turn watch
  notes into scores.
```

## 2. Claude Code hook (SessionStart nudge)

Add to `.claude/settings.json` — a one-line reminder that a ledger exists, so
the session-start check-in doesn't depend on the model remembering:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node -e \"const fs=require('fs');const p=(process.env.ARGUS_DIR||require('os').homedir()+'/.argus')+'/ledger/ledger.jsonl';if(fs.existsSync(p))console.log('An Argus ledger exists here - call argus_check_in once (due items + yesterday\\'s watch anchor).')\""
          }
        ]
      }
    ]
  }
}
```

Both snippets follow the spine: the mirror is a question, never a grade;
captures are user-initiated; promotion to a real decision is always your verb.
