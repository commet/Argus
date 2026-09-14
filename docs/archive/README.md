# 보관소 — 역사

**여기 있는 것은 근거가 아니다.** 그때는 맞았던 기록이고, 지금 무엇을 지을지는
[`../ARGUS-CANON.md`](../ARGUS-CANON.md)가 가리키는 문서들이 정한다.
여기 문장을 인용해 오늘의 결정을 정당화하면 안 된다.

두 종류가 있다.

| | 무엇 | 왜 |
|---|---|---|
| **지운 것** (파일 없음, git 에만) | BLUEPRINT · METHOD V0.1~V0.8 | 정본이라 **주장**해서 실제로 착각을 일으켰다 |
| **내려보낸 것** (파일 있음) | 아래 51개 | 착각을 일으키진 않지만 `docs/` 최상위를 68개로 만들어 무엇이 사는지 안 보이게 했다 |

## 회수하는 법

```bash
git show f9475a7d:docs/archive/ARGUS-BLUEPRINT.md    # 지운 것
git log --all --oneline -- docs/ARGUS-BLUEPRINT.md   # 전체 이력
cat docs/archive/<이름>.md                            # 내려보낸 것은 그냥 열면 된다
```

---

## 2026-08-18 (1) — 지운 것

**`ARGUS-BLUEPRINT.md`** (1,439줄) — 창업자 판정으로 은퇴

머리말이 *"이 리포에서 '무엇을 지을 것인가'에 대한 답은 이 문서 하나다"*라고
선언했으나 2026-07-26 판이었고 `PRODUCT.md`(2026-08-10)와 충돌했다.
**지금 정하는 것이 과거 공정표보다 우선한다**는 판정.

같이 지운 것: `src/lib/__tests__/blueprint-exit-evidence.test.ts`(431줄).
BLUEPRINT 본문에 특정 문자열이 있는지 검사하던 문서 모양 고정 테스트로,
코드 동작은 하나도 안 지키면서 문서 고치는 값만 비싸게 만들었다.

살린 것: §9.8의 실질 게이트(사용자에 대한 의미 언어의 다섯 조건 — 출처·독립
사례·범위·반례·사용자 검토)는 `CLAUDE.md` 본문으로 이식했다.

의존 정리: 테스트 둘(`jcr-j0`·`epistemic-agency-e0`)이 이 파일을 읽었으나,
확인하던 5개 단언이 전부 "이 문서가 저 문서 이름을 언급하는가"였다. e0 쪽 네
토큰은 DESIGN 문서에도 전부 있어(확인함) 그쪽만 보게 바꿨다. 32개 통과 유지.

**`ARGUS-METHOD-V0.1` ~ `V0.8`** (8,688줄) — `ARGUS-METHOD-V1.0.md`가 대체

V1.0에 도달하는 과정의 초안 여덟. 살아 있는 정본 어느 것도 참조하지 않았다
(이관 전 기계 확인). 변경 이력이 필요하면 각 판본 상단 changelog.

---

## 2026-08-18 (2) — 내려보낸 것 51개

**판정 기준은 하나였고 기계로 돌렸다**: 살아 있는 문서
(`CONTEXT`·`PRODUCT`·`DESIGN`·`CLAUDE`·`METHOD V1.0`·`ARGUS-CANON`)나 **코드**가
이 파일 이름을 부르는가. 부르는 것은 `docs/` 최상위에 남았고(17개), 아무도
부르지 않는 것이 여기로 왔다(51개). 내용 판정이 아니다 — 좋은 기록도 여기 많다.

### ADR 14 — 결정 기록
`ADR-2026-07-14-dkk-v6-*` 8건 + `total-architecture-direction` ·
`ADR-2026-07-15-dkk-review-onramp` · `ADR-2026-07-16-judgment-knowledge-core-k0` ·
`ADR-2026-07-27-one-user-judgment-dataset` ·
`ADR-2026-07-31-interactive-judgment-harness` ·
`ADR-2026-08-02-judgment-experience-value-contract`

### EVIDENCE 11 — 측정 기록
`EVIDENCE-jcr-j0` ~ `j9` (2026-07-18 판단 연속성 런타임 감사 10건) ·
`EVIDENCE-epistemic-agency-e0-baseline-2026-07-17`

### HANDOFF·SESSION 9 — 세션 인계
`HANDOFF-2026-07-27-deep-judgment-and-one-dataset` ·
`HANDOFF-2026-07-29-CODEX-HONESTY` · `-CODEX-MCP-PLUGIN-VERIFICATION` ·
`-MCP-DECLINE-SEMANTICS` · `-mcp-picker` ·
`HANDOFF-2026-07-31-agent-surfaces-status` ·
`SESSION-HANDOFF-2026-07-21` · `-2026-07-28-webapp` · `-2026-07-29-structural`

### DESIGN 4 — 설계 초안
`DESIGN-clarify-question-system-v2-2026-07-06` ·
`DESIGN-judgment-checkpoints-v2-2026-07-06` ·
`DESIGN-decision-knowledge-kernel-v6-final-2026-07-14` ·
`DESIGN-judgment-knowledge-core-and-coaching-v1-2026-07-16`

### 나머지 13
`ARGUS-KEYSTONE-2026-07-07` · `ARGUS-ONE-PAGE-CARD` ·
`ARGUS-UI-VOCABULARY-2026-07-13` · `ARGUS-REPO-MAP`(스스로 "historical
snapshot"이라 선언) · `ARGUS-R2-IMPLEMENTATION-REVIEW-2026-08-04` ·
`ARGUS-R3B-INTERVIEW-SCRIPT-2026-08-04` · `DETECTION-RESEARCH-HANDOFF-2026-07-20` ·
`IMPLEMENTATION-FABLE5-JUDGMENT-FOUNDATIONS-2026-07-26` ·
`IMPLEMENTATION-REPORT-JUDGMENT-JOURNEY-2026-07-25` ·
`MCP-COMPLIANCE-AUDIT-2026-07-05` · `PLAN-MCP-PLUGIN-TOTAL-CLEANUP-2026-07-28` ·
`PROTOCOL-e3b-comprehension-study-v1-2026-07-18` ·
`RELEASE-VERIFICATION-2026-07-27`

### 남긴 17개와 그 사유

| 문서 | 누가 부르나 |
|---|---|
| `ARGUS-CANON.md` | 지도 그 자체 |
| `ARGUS-METHOD-V1.0.md` | 정본 (CLAUDE.md·CANON) |
| `ARGUS-METHOD-CONTEXT-2026-08-04.md` | METHOD V1.0 |
| `AGENT-ARCHITECTURE-FOUNDATIONAL-2026-07-05.md` | CLAUDE.md (LLM-glue 불변식의 근원 분석) |
| `FINDINGS-2026-08-18.md` | CLAUDE.md · CANON |
| `HANDOFF-2026-08-10-DECISION-LOOP-AUDIT.md` | 웹 트랙의 유일한 완성 기준 (DLP-1~10) |
| `OPS-RUNBOOK.md` | 이미 지어진 밸브의 조작법 — 사고 나면 여는 문서 |
| `ARGUS-PRODUCT-PLAN-2026-08-05.md` 외 계획류 4 | CANON §7 |
| `ARGUS-BRAND-CANON` · `ARGUS-MCP-V2-SPEC` · `ARGUS-R3A-MEASUREMENT-CONTRACT` · `DESIGN-epistemic-agency-*` · `DESIGN-judgment-continuity-*` | 코드가 직접 참조 |
