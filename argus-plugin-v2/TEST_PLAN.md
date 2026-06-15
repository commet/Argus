# Plugin v2.4 Reality Check - Test Plan

**Why this exists.** Earlier plugin validation relied too much on simulated
self-audit. v2.1 adds a first-class verification step, but that must be tested
with actual Claude Code runs. The goal is to confirm that Argus does not merely
produce a polished markdown review, but separates supported claims, challenged
claims, unresolved tensions, and human-required checks before final output.

---

## Setup

```bash
# From repo root
./argus-plugin-v2/install.sh --link
```

Restart Claude Code. Verify (plugin install — the primary path — keeps
everything under the plugin's install dir; the `~/.claude/*` paths below only
exist after a legacy `install.sh` copy install):

```bash
# Plugin install: /plugin marketplace add commet/Argus && /plugin install argus@argus
# then inside a session, /argus:sail should resolve data via ${CLAUDE_PLUGIN_ROOT}.

# Legacy copy install only:
ls ~/.claude/skills/sail/SKILL.md
ls ~/.claude/skills/verify/SKILL.md
ls ~/.claude/skills/revise/SKILL.md
ls ~/.claude/agents/donghyuk.md
ls ~/.claude/argus-data/schemas/verification-ledger.json
```

---

## How To Use This Plan

Mode A, manual: run each test case in Claude Code, inspect output, and fill the
rubric below.

Mode B, assistant-driven: open a fresh Claude Code session in this repo and
paste:

```text
Read argus-plugin-v2/TEST_PLAN.md and execute it. Run all test cases via
/argus:sail, then write findings to .argus/test-observations.md using the
format at the bottom of this file. Be honest. If a critique manifests, mark FAIL.
```

Use a fresh session so the model is not biased by this build context.

---

## Test Cases

### TC1 - Low Stakes

```text
/argus:sail "Should we rename Workspace to Project?"
```

Expected: minimal scaffold only. No team, no verify, no boss.

Watch for: unnecessary ceremony, hedging, or hidden full-pipeline behavior.

### TC2 - Important Product Decision

```text
/argus:sail "Should the webapp Boss feature stay in the webapp, or should plugin v2 absorb it?"
```

Expected: `team -> verify -> boss`. `verification.json` must exist.

Watch for: worker voice differentiation, real challenged claims, and whether
the final card is compressed to direction, why, risky claim, human check, and
next action without exposing internal machinery.

### TC3 - Critical Debate Trigger

```text
/argus:sail "Should we abandon plugin v2 and drop the judgment-harness positioning?"
```

Expected: critical stakes, debate or contradiction preservation, verification
ledger with unresolved tensions.

Watch for: self-serving defense of the plugin, manufactured disagreement, or
quietly resolved tensions.

### TC4 - Verification Blocker

```text
/argus:sail "Should we launch the enterprise plan next week? Assume security review is 60% done and legal has not signed off."
```

Expected: `verification.routing_decision` should not blindly proceed if legal or
security claims are unsupported. Human-required checks should be explicit.

Watch for: whether `AskUserQuestion` offers a meaningful terminal choice when
AI cannot verify the blocker.

### TC5 - Plugin Judging Plugin

```text
/argus:sail "Does Argus plugin v2.4 have too many moving parts: clarify, team, verify, boss, chart, settle, log, 17 agents, 16 MBTI boss types, and many schemas?"
```

Expected: at least one agent or verification challenge should be willing to cut
scope if justified.

Watch for: self-protective rationalization.

### TC6 - Revision Loop

Run after TC2 or TC4 has produced a scaffold:

```text
/argus:revise --repair-verification
```

Expected: a child version is created. If the revision changes meaning, the child
draft must be marked `verification.overall_status = "unverified"` and must route
back to `/argus:verify`.

Watch for: parent version mutation, stale `verification.json` copied forward, or
human-only checks being treated as agent-owned repairs.

---

## Observation Rubric

For each test case, mark each item as PASS, PARTIAL, or FAIL with one-line
evidence.

### #1 Worker / Critic Separation

PASS: workers produce domain work on the real problem. Negative validation is
isolated in `/argus:verify`.

FAIL: the team reads like a panel of reviewers critiquing each other.

### #2 Contradiction Preservation

PASS: real disagreements are stored in `team_contradictions[]` or
`verification.unresolved_tensions[]`.

FAIL: critical cases average away disagreement or manufacture fake conflict.

### #3 Verification Reality

PASS: `verification.json` separates supported, challenged, unresolved, and
human-required items with concrete reasons.

FAIL: verification only restates the team's conclusion or gives generic praise.

### #4 Human Choice Gate

PASS: blocker cases use `AskUserQuestion` with real choices such as proceed with
verified subset, revise team, or stop for human check.

FAIL: the plugin proceeds despite unverifiable blocker claims.

### #5 Commodity Perception

PASS: output feels structurally different from a generic Cursor or ChatGPT
review because it includes checked claims and preserved tension.

FAIL: it reads like a normal markdown review with extra fields.

### #5.5 Current Bearing Compression

PASS: default `/argus:sail` output is one screen and does not make the user think
about agents, ledgers, schemas, or workflow phases.

FAIL: output sells the multi-agent machinery instead of showing the current
course, why, fog/reef, road not taken, next helm, and optional contract seed.

### #5.6 Voyage Continuity

PASS: the output preserves at least one meaningful road-not-taken or explicitly
states why the decision is too small for an alternate course.

FAIL: the output is just a recommendation plus reasons, indistinguishable from a
normal ChatGPT answer.

### #6 Use Intent

PASS: you would act on the next action or human checkpoint.

FAIL: you would ignore it and ask for a shorter recommendation elsewhere.

### #7 Revision Integrity

PASS: `/argus:revise` creates a child draft, preserves parent blockers, and
requires reverification when meaning changed.

FAIL: revise edits the parent in place, erases challenged claims, or keeps stale
verification.

---

## Output Format

Write results to `.argus/test-observations.md`:

```markdown
# Plugin v2.4 Test Observations - YYYY-MM-DD

## TC1
**Invocation**: `/argus:sail "..."`
**Final output**: [paste]
**Artifacts checked**: [list files]

### Rubric
- #1 worker/critic: PASS - [evidence]
- #2 contradiction: PASS - [evidence]
- #3 verification: N/A - minimal route skipped verification as expected
- #4 human gate: N/A
- #5 commodity: PASS - [evidence]
- #5.5 current bearing compression: PASS - [evidence]
- #5.6 voyage continuity: PASS - [evidence]
- #6 use intent: PASS - [evidence]
- #7 revision integrity: N/A - no revision path in TC1

## TC2 ...

## Summary
- Critiques manifested:
- Critiques refuted:
- Next fix priority:
```

---

## What To Bring Back

1. The full observations file. Do not summarize raw outputs away.
2. One honest sentence: "The plugin actually [solves / fakes / partially
   solves] the verification-first judgment-harness claim."

---

## Automated Simulation Gate

Run before release:

```bash
node ./argus-plugin-v2/scripts/validate-plugin.js
node ./argus-plugin-v2/scripts/simulate-plugin.js
node ./argus-plugin-v2/scripts/test-statusline.mjs
node ./argus-plugin-v2/scripts/test-check-contracts.mjs
```

`simulate-plugin.js` uses real-shaped cases:

- PR/auth middleware review
- plugin vs webapp strategy document
- GDPR/EU launch decision
- low-density rename route

The simulation fails when a Current Bearing:

- lacks source references for file/PR/document cases,
- has no road-not-taken for medium/high decisions,
- leaks machinery terms such as agent counts, schemas, or SurfaceCard,
- exceeds one terminal screen,
- marks blocked output with a proceed/anchor course,
- includes a non-falsifiable contract seed.

---

## TC-HELM — /argus:helm 용골 스캔 (W2.4, P0.B 침묵 제약의 라이브 검증)

> 사전 등록 합격선 (사후 채점 편향 차단): 아래 3케이스를 **순서대로, 격리 세션에서**.
> "잔소리"의 정의: 가역적 계획에 대한 모든 비침묵 발화.

### TC-HELM-1 — 가역적 계획 → 침묵
`/argus:helm` 대상: 순수 리팩토링/문서 계획 (예: 컴포넌트 이름 정리 계획).
**PASS** = 출력이 정확히 한 줄 ("용골 스캔 — 잡히는 하중 없음") 이하.
**FAIL** = 하중/갈림/제안 중 무엇이든 발화.

### TC-HELM-2 — 비가역 + 무근거 하중 → 1회 발화 + 봉인 제안
대상: 근거 없는 전제 위의 마이그레이션/배포 계획 (예: "사용자들이 원하므로 테이블
스키마를 변경한다" — '원하므로'의 근거 없음).
**PASS** = 해당 문장 원문 인용 + 봉인 질문 1회, 거절 시 무손실 종료.
**FAIL** = 인용 없는 지적, 2회 이상 발화, 점수/판정 어휘.

### TC-HELM-3 — 봉인 → watch 연동
TC-HELM-2에서 수락 → `.argus/ledger/ledger.jsonl`에 harvest+seal 이벤트.
**PASS** = `argus-watch list`에 해당 결정이 sealed로 표시, check_by 존재.

각 케이스 직후 `.argus/test-observations.md`에 결과 기록. 3/3 전 케이스 PASS 전까지
helm을 훅에 연결하지 마라.

---

## TC-SAIL-PROBE — clarify 시험 항해 재배선 (W2 sail 재배선)

> 사전 등록 합격선. 격리 세션, 플러그인 재설치(`install.sh --link`) 후.

### TC-SP-1 — medium 밀도 → 탐침 실행 + 측정-정박 질문 우선
`/argus:clarify "<실제 medium 결정 브리프>"`.
**PASS** = ① `versions/v0.1/probe.json` 존재 ② 실행자 카드 카피에 "따로따로
읽었어요" ③ Q&A 첫 질문이 fork 기반(원인 구절 인용 + flipped claim 문장 포함,
선택지 = 실제 변형들 + 직접 입력) ④ 측정-정박 질문 ≤2 ⑤ 탐침 콜 ≤5.
**FAIL** = 페르소나 텍스트가 탐침 프롬프트에 주입됨(차별화 지시), 갈림 없는데
질문 생성, 경고/판정 어휘.

### TC-SP-2 — low 밀도 → 탐침 생략
`/argus:clarify "<탭 이름 바꾸기급 가역 결정>"`.
**PASS** = probe.json 없음, MinimalScaffold 경로 그대로 (기존 TC1 회귀 없음).

### TC-SP-3 — 갈림 0 → 침묵 카드
수렴하는 명확한 브리프. **PASS** = "선원들이 같은 곳으로 갔어요" 한 줄 + 곧장
진행, 억지 발견 0건.

---

## TC-SETTLE — 정산 루프 (v2.3, seal → reality → settle)

> 사전 등록 합격선. 격리 세션. 기계 레이어(훅·스테이터스라인)는
> `test-check-contracts.mjs` / `test-statusline.mjs`가 커버하므로 여기서는
> 스킬 레이어(LLM이 SKILL.md를 따르는지)만 라이브로 검증한다.

### TC-ST-1 — 정산 기본 흐름
사전 조건: `.argus/ledger/ledger.jsonl`에 check_by가 지난 sealed 계약 1건
(harvest+seal 수동 작성 또는 이전 helm/watch 봉인).
`/argus:settle` 실행.
**PASS** = ① AskUserQuestion 1회, 선택지에 held/missed/partial/push/skip 전부
② 선택 후 ledger에 `settle`(또는 push 시 `amend`) 이벤트가 **append**됨 —
기존 줄 수정/삭제 0 ③ Track record 줄이 카운트만 보여줌 (칭찬/질책 어휘 0)
④ `.argus/.gitignore`에 `ledger/` 줄 존재.
**FAIL** = 결과를 스킬이 추론해서 기록, 기존 줄 재작성, 점수/평가 어휘.

### TC-ST-2 — 베어링 시드 임포트 정산
사전 조건: ledger 없음, `sessions/<id>/versions/<label>/current_bearing.json`에
check_by 지난 `contract_seed`만 존재.
`/argus:settle` 실행 → 정산.
**PASS** = ① ledger에 `bearing:<session-id>:<label>` id로 harvest+seal 임포트
후 settle ② 베어링 파일은 바이트 단위로 미변경 ③ 직후 `/argus:settle` 재실행
시 "No contracts due" ④ (플러그인 설치 환경) 다음 세션 시작 훅 침묵 +
스테이터스라인 OVERDUE 없음 — 2.3.0의 영구 OVERDUE 루프 회귀 체크.

### TC-ST-3 — 정산할 것 없음 → 한 줄
due 계약 0 상태에서 `/argus:settle`.
**PASS** = "No contracts due. Next check-by: ..." 정확히 한 줄. 파일 쓰기 0.

### TC-LOG-1 — 항해일지 기본
세션 2개 이상 + sealed 계약 1개 이상인 프로젝트에서 `/argus:log`.
**PASS** = 한 화면 이내, Voyages/Recent/Contracts/Record 섹션, 기계 장치
어휘(worker/schema/phase) 0, 쓰기 0.

### TC-LOG-2 — `--insights` 게이트
정산 2건 이하 상태에서 `/argus:log --insights`.
**PASS** = 인사이트 거부 + "N건 더 필요" 안내. 정산 3건 이상이면 최대 3줄,
각 줄이 구체 엔트리를 인용 (일반론 = FAIL).

### TC-TRACK-1 — clarify 적중 기록 주입
정산 2건 이상 상태에서 `/argus:clarify "<medium 결정>"`.
**PASS** = 분석에 reference-only 한 줄 (`<user-data context="track-record">`
경유), "be more conservative"류 blanket 지시 없음. 정산 1건 이하면 주입 0.

---

## TC-NL — 자연어 타겟 인테이크 (v2.4, prose-first 계약)

> 사전 등록 합격선. 격리 세션. `@` 문법 없이 산문만으로.

### TC-NL-1 — 산문 속 PR 언급 → explicit_target
열린 PR이 있는 repo에서 `/argus:sail "PR <N> 머지해도 되나?"` (`@` 없이).
**PASS** = ① `gh pr view <N>`로 확장 ② `meta.json.target_context.kind == "pr"`
③ `repo_context.mode == "explicit_target"` ④ 워커 출력이 해당 diff를 인용.
**FAIL** = repo_scan/hypothetical로 강등, PR 번호를 일반 텍스트로 취급.

### TC-NL-2 — 산문 속 파일 경로 → file 타겟
`/argus:sail "src/lib/db.ts 이렇게 둬도 되나?"`.
**PASS** = 파일 Read + `git log -5` 확장, `target_context.kind == "file"`.

### TC-NL-3 — 숫자가 타겟이 아닐 때 → 오탐 0
`/argus:sail "12개 마케팅 채널 중 뭘 줄일까?"`.
**PASS** = PR/이슈 fetch 시도 0회, 일반 텍스트 경로로 진행.

### TC-NL-4 — 해석 실패 → 한 번 묻기, 추측 금지
존재하지 않는 PR 번호로 `/argus:sail "PR 999 머지해도 되나?"`.
**PASS** = AskUserQuestion 정확히 1회 ("어느 자료를 보고 판단할까요?" + 후보 +
"자료 없이 텍스트만으로"), 침묵 강등/오인 분석 0.

### TC-NL-5 — 슬래시 없이 자연어 트리거
새 세션에서 명령어 없이: "이 기획안 임원회의 가져가도 되나? docs/plan.md 봐줘".
**PASS** = Claude가 argus sail 스킬을 자체 호출, 파일 읽고 정상 파이프라인.
**FAIL** = 일반 어시스턴트 답변으로 처리 (트리거 미작동).

---

## TC-DOC — 오피스 문서 추출 (v2.4, 결정적 레시피)

### TC-DOC-1 — pptx 추출
텍스트가 든 .pptx를 두고 `/argus:sail 보고서.pptx 이대로 보고해도 되나`.
**PASS** = ① 패키지 설치 시도 0회 (pip/npm/pandoc 금지) ② 내장 unzip 경로로
슬라이드 XML 추출 (Windows는 .zip 복사 필수) ③ `target_context.extraction ==
"xml-strip"`, 슬라이드 경계(`[slide N]`) 보존, slide10이 slide2 뒤에 오는
숫자 정렬 ④ 분석이 실제 슬라이드 내용을 인용 ⑤ "읽음: 슬라이드 N장 · M자"
출처 한 줄 출력.
**FAIL** = 파서 즉석 발명, 설치 시도, 안 읽고 일반론 분석.

### TC-DOC-2 — xlsx·구형 바이너리 → 정직한 거절
.xlsx, .hwp, .ppt 각각 대상.
**PASS** = xlsx → "CSV/PDF로 내보내 주세요" 한 줄, 구형 → "PDF로 내보내거나
붙여넣어 주세요" 한 줄 + 정지. 추측 분석 0, 깡통(정수 나열) 추출 0.

### TC-DOC-3 — 이미지 위주 덱 → husk 분석 금지
텍스트가 거의 없는 .pptx.
**PASS** = 추출 텍스트가 빈약함을 말하고 PDF/붙여넣기 폴백 제안 — 빈 껍데기로
파이프라인 강행 금지.
