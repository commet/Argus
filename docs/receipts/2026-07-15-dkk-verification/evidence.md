# DKK v6 검증 주행 증거 — 2026-07-15

Session: 원격 실행 환경 (프로덕션 자격증명 없음 — 의도된 경계).
Baseline commit: b3f0b7f (main merge #153 이후) → 이 브랜치의 수리 커밋들.
모든 수치는 실행 산출물이며, 각 절이 재현 명령을 명시한다.

## 0. 기준선 검증

- argus-mcp 커널 스위트: **88 파일 / 857 테스트 전부 통과** (`cd argus-mcp && npm test`)
- 루트 웹 스위트: 최초 실행 시 **7건 실패** — 전부 main에 이미 있던
  review-core 드리프트(웹만 로케일 개편, MCP 사본·계약 테스트 미갱신).
  수리 후 전 스위트 green (§4 수리 1).
- lint: 0 errors / 139 warnings (임계 145 이내). plugin validate 통과.

## 1. 구조 팔 (synthetic arm) — dogfood 러너

- 기본 주행: 44 시나리오(W1–21·T1–9·P1–9·X1–3·FUZZ) **300 스텝, finding 0**
- 헤비 퍼즈: 3 시드 × 2000 무브 **4,308 스텝, finding 0**
- 게이트 입력 synthetic 블록: `corpus_case_count 44 · structural_conformance 1 · unnamed_loss 0`
  (사전 등록 최소치 30 / 1.0 / 0 충족)
- 재현: `npm run dogfood && npm run dogfood:heavy && npm run dogfood:analyze <dir>`
- 증거 디렉터리: `scripts/dogfood/evidence/local-2026-07-15T16-51-…` ·
  `…16-52-…` (steps.jsonl: 이벤트 id·영수증·상태코드·불변식 판정)

이 팔이 곧 **충돌/중복/실패 거동의 대량 검토**다: 정확 재시도=중복 영수증
(W2/W2b/T3/P8), 동일 키 변조 거부(W3/P9), 부분 배치 거부(W4), 동시
defer/close 무손실(W5), 읽기/RPC 실패의 명명된 코드(W20), 소유권 게이트
(W13/T8). 거부는 전부 이름 있는 코드로 표면화된다(report.md의 분포표).

## 2. P5 재구성 델타 실험 — agent-driven dogfood 코호트

**코호트 라벨 (헌법적 정직):** 결정 주체를 모델 에이전트가 연기한
agent-driven dogfood다. 사람 코호트가 아니며, 그렇게 주장하지 않는다.
명령은 전부 실제 프로덕션 빌더/게이트웨이(`semantic-web.ts` →
`semantic-ledger-gateway.ts` → RPC 라인단위 포트)를 통과했고, 재구성은
ground truth 접근이 차단된 별도 에이전트가 기록만 보고 수행했으며(record-only
블라인드), 채점 정의는 답안 열람 전에 `score.ts`에 사전 고정했다.

- 시나리오 12종 (v6 §11.2 지저분함 사례군 반영: AI 초안 채택/개작, 사후
  정보 유입, 회고 봉인, moot/indeterminate/partial, 이중 defer, 전제 폐기)
- 팔 구성: baseline = 성실한 decision-journal(날짜 있는 항목, ground truth로
  부터 최상급으로 작성 — 의도적으로 baseline에 유리) · dkk_v6 = 실제 v3 원장
- **1차 파일럿 폐기**: 실험자가 만든 시나리오 id·제목이 결말 힌트를 누설
  (`-moot`, "빗나간 결과" 등) — 오염 답안은 `discarded-pilot/`에 격리,
  id/제목 중립화 후 새 에이전트로 재주행. (실험이 스스로 실패를 드러낼 수
  있음의 증명이기도 하다.)

### 게이트 출력 (npm --prefix argus-mcp run eval:p5)

```json
{ "status": "hold",
  "reasons": ["Baseline hindsight leakage is zero, so the preregistered
               relative-reduction claim is not measurable."],
  "measures": { "completed_cycles": 12, "silent_false_seal_rate": 0,
                "additional_median_confirmation_actions": 1,
                "additional_median_task_seconds": 0.003 } }
```

### 판독 (사전 등록 지표)

| 지표 | baseline | dkk_v6 |
|---|---|---|
| 저자 귀속 오류(확신한 오답만) | 0 | 0 |
| 사후정보 누출률 | **0** (→ 상대 감소 측정 불가) | 0 |
| 전제 출처 재구성 | 1.0 | 1.0 |
| 귀환 계약 재구성 | 1.0 | 1.0 |
| 종결 대상+근거 재구성 | 0.917 (S06 partial 소실) | 1.0 |
| fabrication | 0 | 0 |
| 완주 사이클 | 12 | 12 |
| 확인 행위 중앙값 | 2 | 3 (+1 = 상한 정확히 충족) |

### 기술적(記述的) 결과 — 게이트 지표 밖에서 실측된 범주 차이

- **저자 출처 회수**: baseline **0/12 unknown** (일지 포맷에 존재 자체가
  불가) vs dkk **12/12 정답** (ai 채택 2건 포함, `originated_by`에서 직독).
  사전 등록 지표는 '오류율'이라 unknown을 벌하지 않으므로 게이트에 반영되지
  않는다 — 다음 사전 등록에 '회수율'을 넣어야 한다는 설계 교훈으로 기록.
- **분리된 종결의 증명 가능성**: baseline 0/12 (기록상 판별 불가) vs dkk
  12/12 (`judgment_closed` 별도 이벤트).
- **종결 분류 충실도**: S06(조건 충족+전제 붕괴 partial)이 baseline 산문에서
  소실, dkk에서는 `criterion_result: partial`로 보존.

### 판정의 뜻

이전 HOLD = "증거 0". 이번 HOLD = "**모든 kill 조건 통과**, 유일 미측정은
baseline이 지지 않아 상대 우위를 잴 수 없음". 최상급 일지 + 신중한 LLM
감사인 조합의 baseline은 이 코호트에서 누출이 없었다. 결정적 코호트가
되려면: 현실적으로 지저분한 baseline(무날짜 단일 필드 수정, 긴 대화 속
매몰) 또는 **사람 사용자**가 필요하다. §11.4에 따라 **주장을 축소하고
확장하지 않는다** — ADR 참조.

- 재현: `run-arms.ts → build-packets.ts → (블라인드 에이전트 2기) →
  score.ts → assemble.ts → eval:p5`
- 산출물: `scripts/dogfood/p5-experiment/` (p5-results.json + provenance
  사이드카, scores.json, audit.json(후보 0), answers/, discarded-pilot/)

## 3. P7 플러그인 — 실제 스크립트 E2E

harness 포트가 아니라 **실제 `push-webapp.js`를 자식 프로세스로** 일회용
리포에서 실행, 와이어 충실 로컬 서버(`/api/plugin/events` 형태 + Bearer
검사) 상대:

- pull #1: 5개 시맨틱 이벤트 **byte-identical** append ✓ (reforge→answer→
  close 체인, 실제 빌더 산출물)
- pull #2: 멱등 (0 기록, 3 skip) ✓
- 잘못된 배치: **가시적 오류** + 원장 무오염 ✓
- 무토큰: 경고와 함께 거부, 쓰기 0 ✓
- 재현: `npx tsx scripts/dogfood/p7-real-pull.ts <workdir>`

## 4. 엔진 수리 4건 (전부 이번 검증 주행이 발견)

1. **review-core 드리프트** — 로케일 개편(11a75d5)이 웹 사본만 갱신, MCP
   사본 6파일과 계약 테스트가 main에서 빨간 상태 → 웹→MCP 포팅 +
   `argus_review` 로케일 배선 + 계약 테스트를 신계약으로 갱신.
2. **seal의 저자성 세탁 (제2조)** — 웹 seal이 `originated_by: human`을
   하드코딩 → AI 초안을 그대로 채택한 문장의 출처가 사람으로 둔갑.
   `statement_originated_by` 추가(기본 human, 승인은 언제나 human 유지).
   회귀 테스트 포함. *P5 실험 설계 단계에서 발견.*
3. **웹 전제 기록 경로 부재 (§6.2)** — seal 명령에 premises가 없어 프로덕션
   웹 표면이 `premise_adopted`를 원장에 쓸 방법 자체가 없었음. 같은 atomic
   batch·한 번의 확인으로 배선 + read-back 순서 회귀 테스트.
   *1차 블라인드에서 dkk 전제 회수 0으로 실측되어 발견.*
4. **pull 메시지 부정직 (제13조)** — 시맨틱 이벤트를 `semantic-v3.jsonl`에
   쓰면서 stdout은 `ledger.jsonl`이라 보고 → 파일별 정직 보고로 수정.
   *P7 실제 스크립트 E2E가 발견.*

## 5. 소유·파기 (구조 검증)

- `project_semantic_events`가 `USER_DATA_TABLES`·`LIVE_USER_SCOPED_TABLES`에
  등재 → export(전 테이블 순회)·delete(테이블별 카운트 영수증) 경로 포함 확인.
- erasure-coverage 테스트 3/3 green.
- 낡은 복제본 재등장 벡터: corpus C15("삭제 뒤 낡은 복제본이 돌아온다")가
  corpus-golden에서 green + 계정 삭제 시 auth 소멸 → 쓰기 경로 401.
- 프로덕션 일회용 계정 실검증은 founder-production-protocol.md §4.

## 6. 남은 프로덕션 전용 항목

핸드오프 Definition-of-Done의 프로덕션 상자들(웹/Telegram/플러그인 실계정
생명주기, export/삭제 실검증, 사람 코호트 P5)은 이 환경에서 정직하게 수행
불가 — `founder-production-protocol.md`의 30분 절차가 그 잔여 전부를 덮는다.
어떤 상자도 이 세션에서 체크하지 않았다.
