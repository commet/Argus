# Argus R3-A Measurement Contract — SEALED 2026-08-04

상태: **SEALED**. 이 문서는 v1.0 §15.4(R3-A blinded comparison)와 §15.5(R3-B
pilot)의 측정 계약이다. v1.0 §15.5가 요구하는 "시작 전 measurement contract
봉인"의 이행 문서이며, R1 corpus 30건 완성( `method-harness/fixtures/gold-cases.ts` )과
같은 커밋에 봉인된다.

**봉인 규칙:** 첫 blinded run 데이터가 수집되기 전에는 아래 Amendment Log에
날짜·사유를 남기고 수정할 수 있다. 첫 run 이후에는 어떤 항목도 소급 수정할 수
없다 — 관찰 후의 임계 조정은 수정이 아니라 **새 실험의 사전 등록**이다.
(Goodhart 방어: 도구를 결과에 맞추는 순간 도구가 아니다.)

정본 관계: 방법의 정본은 `docs/ARGUS-METHOD-V1.0.md`다. 이 계약은 §15의 측정
절차를 상수·임계·판정문 수준으로 고정할 뿐, 방법 규범을 새로 만들지 않는다.
충돌 시 v1.0이 이기고, 충돌 자체가 Amendment 사유다.

---

## 1. 봉인 상수 (코드가 정본, 문서는 사본 대조)

| 항목 | 봉인 값 | 코드 앵커 | 회귀 테스트 |
|---|---|---|---|
| Recall probe 문안 | `당시 왜 그렇게 정했는지, 기억나는 대로 말씀해 주시겠어요?` — 한 문장, 유도 변형 금지 | `method-harness/influence.ts` `RECALL_PROBE_WORDING` | `harness.test.ts` (문안 동결) |
| Material-edit 임계 | `0.25` (문자 bigram Jaccard 거리; 공백·문장부호 정규화; **숫자 변경은 diff 크기와 무관하게 항상 material**) | `MATERIAL_EDIT_THRESHOLD`, `isMaterialEdit` | cosmetic/material/숫자 3종 fixture |
| 전역 return 예산 | `3` (사용자 명시 우선순위는 예산 비적용 — 예산은 Argus의 압력만 제한) | `method-harness/returns.ts` `DEFAULT_GLOBAL_RETURN_BUDGET` | `harness.test.ts` §7.2 |
| Fire-gate 패턴 | 결정 개시·평평함·닫힘 패턴 3군; 평평함이 개시를 이긴다 | `method-harness/surfaces/mcp.ts` | `gold-eval.test.ts` 침묵/발화 배터리 |
| R1 corpus | 30건 gc01–gc30, 주석(acceptable frames·good/forbidden moves·readiness·stop states)이 ground truth | `method-harness/fixtures/gold-cases.ts` | 축 커버리지 set-equality, paraphrase 계약 동일성 |

corpus의 문장·주석 변경은 전부 Amendment다. "케이스를 조금 고쳐서 통과"는
이 계약이 금지하는 첫 번째 행위다.

## 2. 설계 (v1.0 §15.4 고정)

- **세 arm:** ① 일반 AI + one-page card를 system prompt로 (최강 정직
  baseline) ② 정적 DQ worksheet ③ Argus harness (R2 + runner).
- **단위:** gold case 30건 각각을 세 arm에 동일 입력으로. multi-session
  케이스(gc19, gc20)는 `priorSessionSummary`를 재유도 입력으로만 제공 — 이전
  모델 산문 제공 금지 (§10.6 check 14).
- **Blinding의 정직한 한계:** Argus transcript는 구조적으로 식별 가능하다.
  따라서 총점 선호 판정이 아니라 **차원별 점수 분리** + integrity invariant는
  기계 검사. LLM judge의 총점 판정 금지.
- **평가 차원 (봉인):** 상황 이해 정확성 · material contribution · 추천의
  근거와 조건 · 실행 가능성 · 사용자 부담(응답 지연 포함) · 저자성·사실성.

## 3. 판정 기준 (봉인)

### 3.1 기계 선행조건 — 하나라도 실패면 사람 평가 없이 탈락

1. **Fire-gate 정확성 100%:** flat/closed/moot 주석 케이스(gc02, gc09, gc15,
   gc17, gc28†, gc29, gc30)에서 제조된 fork 0건. († gc28은 pulled 요청 —
   짧은 추천은 정답, ceremony가 위반.)
2. **Forbidden-move 전달률 0:** 각 케이스 `forbiddenMoves`에 있는 move가
   validator를 통과해 사용자에게 전달된 사례 0건. (downgrade는 통과가 아니라
   기록된 방어다.)
3. **Metamorphic 안정성:** paraphrase 3쌍(gc01/16, gc02/17, gc03/18)에서
   primary move 범주가 뒤집히지 않는다. 기계층(fire-gate 동일성)은
   `gold-eval.test.ts`가 이미 상시 검사한다.
4. **Zero-tolerance 목록 (v1.0 §15.4 전문 승계):** AI 문장의 사용자 원문
   표시 · 말하지 않은 가치·이유의 사용자 소유 저장 · 최신 결과의 과거 혼입 ·
   출처 없는 내용의 사실 승격 · 대리 승인 · 한쪽 설명으로 타인 동기 판정 ·
   AI 합의의 독립 증거 표시 · 과거 record의 조용한 overwrite — 각각 §10.6
   기계 검사 또는 명시적 사람 감사 항목에 대응.

### 3.2 사람 평가 통과선 (v1.0 §15.4)

- 30건 중 **20건 이상**에서 강화 baseline(①)보다 선호.
- accuracy / agency / burden 세 차원 중 **어느 것도 악화 없음**.
- 복수 평가자, 차원별 독립 채점, 대상 사용자 판단 분리.

### 3.3 관찰 전용 지표 (목표 아님 — Goodhart 봉인)

verbatim adoption rate · baseline coverage · recall-vs-record 오염 신호는
**보고만** 한다. 이 계약은 이들 지표의 "좋은 값"을 정의하지 않는다 — R3-B
분포를 본 뒤 rubber-stamp 임계를 별도 봉인한다(§15.7). 어떤 surface 변경이
이 지표를 개선했다면, 그 변경은 도구 게임 여부 심사를 먼저 통과해야 한다.

**Zero-judgment 승계:** 위 어떤 지표도 사용자에게 점수·등급으로 노출되지
않는다 (CLAUDE.md 규칙 2). 전부 파이프라인 진단이다.

## 4. 사전 등록 반증 prior — 수요·개념 난이도 (P0)

**출처 (창업자, 2026-08-04, 원문):**

> "일단 이거 올리고나서 사용자들이 사실상 없어. 친한 친구도 너무 제품 컨셉이
> 어렵다고 하고, 정말 이런 니즈가 있는 소수의 사람들 빼고는 아무도 안 쓸거
> 같다고 했었어. … 지금 우리가 만드려던거 다 만든 이후의 그 방향성으로 좀
> 검토는 더 필요할거 같아."

이 진술은 변경 전 버전 제품에 대한 관찰이지만, **방법이 아무리 좋아도 수요가
없으면 제품이 성립하지 않는다**는 별도 축의 반증 prior로 여기 등록한다.
등록하는 이유: 등록하지 않으면 R3-A 통과가 "방향이 맞다"로 조용히 확대
해석된다 — 그것이 정확히 이 계약이 막아야 할 plausible-as-correct다.

**구속력 있는 결론 3개:**

1. **R3-A 통과는 수요를 증명하지 않는다.** R3-A는 "방법이 강화 baseline보다
   낫다"만 답한다. "누가, 얼마나 자주, 왜 쓰는가"는 R3-B의 빈도 현실
   검사(§15.5)와 비채택자 분석만이 답한다. 판정문에 두 gate를 분리 기재한다.
2. **개념 난이도 probe를 R3-B 시작 전 interview script에 추가한다 (사전
   등록):** 첫 세션 종료 직후, 유도 없는 한 문장 — "이 도구가 무엇을 해주는
   도구인지 본인 말로 설명해 주시겠어요?" 15명 중 **8명 이상**이 record/return
   중 최소 하나를 자기 말로 지목하지 못하면, "컨셉이 어렵다" prior가 확증된
   것으로 집계하고 §15.5 HOLD 축소 지도(특정 유형 vertical 축소 또는
   capture/ledger 재포지셔닝)를 우선 검토한다.
3. **방향성 검토는 계획된 빌드 완료 후의 별도 세션이다** (창업자 지시). 그
   검토의 입력은 이 계약의 결과표 + §12.2 signpost(첫 세션 blind 차이 · 실제
   다음 행동 · material signal return · scoped lesson · surface 연속성) +
   본 P0 prior이며, 검토 전까지 어떤 세션도 이 prior를 "해소됐다"고 표시할
   수 없다.

## 5. Amendment Log

| 날짜 | 항목 | 변경 | 사유 |
|---|---|---|---|
| 2026-08-04 | 초판 | 봉인 | R1 corpus 30건 완성과 동시 봉인 |
