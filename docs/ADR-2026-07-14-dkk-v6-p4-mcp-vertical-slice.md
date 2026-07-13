# ADR — Decision Knowledge Kernel v6 P4 MCP Vertical Slice

Date: 2026-07-14
Status: **Accepted — isolated pilot, read/write local semantic ledger**
Decision owner: Decision Knowledge Kernel implementation stream

## Decision

P4 adds one deliberately isolated MCP surface, `argus_record`, behind the
`ARGUS_DKK_V6_PILOT=1` opt-in. The existing six purpose-led public tools and
their v2 write paths remain the default surface until P5 establishes value.

The pilot writes only `ledger/semantic-v3.jsonl`; it does not dual-write v2,
rewrite `ledger.jsonl`, touch account sync, or alter the web surface.

## Exact command boundary

`argus_record` is a small lifecycle command surface:

| Action | Writes | Human authorization required |
|---|---|---|
| `seal` | `judgment_sealed` + `return_promised` atomically | yes |
| `observe` | `observation_recorded` | no; recorded as an observation, never an answer |
| `defer` | `return_deferred` | yes |
| `resolve` | `resolution_asserted` | yes |
| `close` | `judgment_closed` | yes |
| `read` | none | no |

Authorial actions require this exact receipt shape:

```ts
{
  mode: 'direct_command' | 'explicit_confirmation',
  evidence_kind: 'user_utterance' | 'command_digest',
  evidence_ref: string,
}
```

`direct_command` accepts only `user_utterance`; `explicit_confirmation`
accepts only `command_digest`. The local human principal is derived as
`human:local:<space-id>`, where `space-id` is a SHA-256-derived identifier of
the canonical local `.argus` directory. The event records the actual MCP
writer separately as `system:mcp:argus-record`.

## Non-negotiable behavior

- A seal creates a Judgment and Return Contract in one guarded batch.
- An observation cannot silently resolve or close anything.
- A resolution cannot silently close anything; `close` is a distinct,
  separately authorized command referring to the resolution id.
- Each successful write response carries authority/provenance receipt fields.
- The semantic JSONL append is fsync-backed and shares the existing local
  ledger lock. A torn final line is isolated with a leading newline before the
  next append.
- Retries using the same request id return the existing receipt only when their
  semantic intent matches. Mixed or changed reuse is `IDEMPOTENCY_CONFLICT`.
- Invalid JSON already present in the semantic ledger is reported as integrity
  data; it is never deleted or silently repaired.

## Exit evidence

The P4 tests prove:

1. silent seal and silent close both fail before a file is written;
2. seal → observation → resolution → explicit close reaches
   `resolved_answered` through the shared reducer;
3. authority and observation provenance are returned in the MCP receipt;
4. exact retry does not append another batch; and
5. the pilot is absent from default discovery, present only with the explicit
   environment flag, preserving the existing public-tool regression boundary.

P5 now measures whether this explicitness is worth its interaction cost. It
must not substitute synthetic test success for user value, and P6/P7 remain
blocked until that gate has evidence.
