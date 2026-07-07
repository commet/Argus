# Argus 컴패니언 비전 코퍼스 — 2026-07-03

> 친구가 반짝인 3기능(전제변화 alert · 미결정 nudge · 패턴메모리)을 실제 서버로 관찰. 34 스텝. locale=ko.

## 비전 검증 + 엣지 자동판정

| 항목 | 판정 | detail |
|---|---|---|
| ①drift-alert | **WORKS** | The fact under P1 changed: "기준금리 3.5%" → "기준금리 4.0%로 인상" (url). Whether to revisit this decision is your call. |
| ①fan-out | **CHECK** | The fact under P1 changed: "기준금리 3.5%" → "기준금리 4.0%" (url). Whether to revisit this decision is your call. |
| ②pending-nudge | **FIRES** | 계약 3건이 확인일을 지났습니다 — 현실과 대조할 차례입니다 (argus_settle). 전제 사실 1건이 현실 재확인 차례입니다 (argus_recheck). |
| ②open-question-tracked | **CHECK** | {} |
| ③pattern-freq | **WORKS+SPINE-OK** | No settled decisions yet — nothing to summarize. |
| edge:cap | **ERRORS(?)** |  |
| edge:recheck-oq | **ERRORS(?)** |  |
| edge:forge | **ERRORS(PROVENANCE_REQUIRED)** | source="ai" requires ai_original (the model's original wording): "모델이 지어낸 전제" |
| edge:cofound-goalpost | **ERRORS(GOALPOST_MOVED)** | Cannot move the check-by date once it has arrived. |
| locale | **EN_SURFACE_TOOLS** | {"argus_open_decision":3,"argus_seal":3,"argus_recheck":3,"argus_amend":1,"argus_dismiss":1,"argus_recall":1," |

## 스텝별 실측

### [loan] argus_open_decision — 금리결정 열기
- ok:`true`
- surface: Opened. Surface exactly ONE neutral crux question (a question, not a fork or a lean), then seal a falsifiable prediction.

### [loan] argus_premises — 전제 3개 저장(외부·load-bearing·open_question)
- ok:`true`
- surface: 3 premise(s) recorded (P1–P3). Fix anything wrong with op=amend — your correction is part of the record. 1 will be re-checked against reality once the decision is sealed.

### [loan] argus_seal — 봉인
- ok:`true`
- surface: Sealed. "고정으로 갈아타면 2년 내 총 이자가 변동유지보다 적다" — reality answers on 2026-09-01. Come back then with argus_settle. You sealed without naming the assumption it rests on — that's recorded as skipped, not hidden. You can still name it.

### [loan] argus_recheck — P1 첫 recheck = baseline(무알림 기대)
- ok:`true`
- surface: Baseline recorded for P1: "기준금리 3.5%" (user_stated). Re-check suggested again in 7 days.

### [loan] argus_recheck — P1 재recheck 3.5→4.0 = +14% DRIFT 기대
- ok:`true`
- surface: The fact under P1 changed: "기준금리 3.5%" → "기준금리 4.0%로 인상" (url). Whether to revisit this decision is your call.

### [loan] argus_recheck — P2 텍스트 recheck changed=true = DRIFT 기대
- ok:`true`
- surface: Baseline recorded for P2: "신용점수가 최근 하락했다" (user_stated). Re-check suggested again in 7 days.

### [loan] argus_premises — P3 open_question resolve(사용자 종결)
- ok:`true`
- surface: Open question P3 closed in your words: "이직 안 하기로 정함 — 현 직장 2년 더".

### [carloan] argus_open_decision — 두번째 결정(같은 금리 전제)
- ok:`true`
- surface: Opened. Surface exactly ONE neutral crux question (a question, not a fork or a lean), then seal a falsifiable prediction.

### [carloan] argus_premises — 같은 전제 저장
- ok:`true`
- surface: 1 premise(s) recorded (P1). Fix anything wrong with op=amend — your correction is part of the record. 1 will be re-checked against reality once the decision is sealed.

### [carloan] argus_seal — 봉인
- ok:`true`
- surface: Sealed. "지금 고정하면 총 할부이자가 300만원 미만" — reality answers on 2026-10-01. Come back then with argus_settle. You sealed without naming the assumption it rests on — that's recorded as skipped, not hidden. You can still name it.

### [carloan] argus_recheck — baseline
- ok:`true`
- surface: Baseline recorded for P1: "기준금리 3.5%" (user_stated). Re-check suggested again in 7 days.

### [carloan] argus_recheck — fan-out: 한 번 recheck로 매칭 결정 전부에 적용
- ok:`true`
- surface: The fact under P1 changed: "기준금리 3.5%" → "기준금리 4.0%" (url). Whether to revisit this decision is your call.

### [cofound] argus_open_decision — 동업 결정 — open_question 다수
- ok:`true`
- surface: Opened. Surface exactly ONE neutral crux question (a question, not a fork or a lean), then seal a falsifiable prediction.

### [cofound] argus_premises — 미결정 전제 저장
- ok:`true`
- surface: 2 premise(s) recorded (P1–P2). Fix anything wrong with op=amend — your correction is part of the record.

### [cofound] argus_seal — 봉인(먼 확인일)
- ok:`true`
- surface: Sealed. "3개월 내 지분 합의에 도달한다" — reality answers on 2026-10-03. Come back then with argus_settle. You sealed without naming the assumption it rests on — that's recorded as skipped, not hidden. You can still name it.

### [nudge] argus_check_in — check_in — 미결정/due가 떠서 다시 고민하라 하나 관찰
- ok:`true`
- surface: 계약 3건이 확인일을 지났습니다 — 현실과 대조할 차례입니다 (argus_settle). 전제 사실 1건이 현실 재확인 차례입니다 (argus_recheck).

### [premview] argus_recall — recall view=premises — 추적 전제 상태 관찰
- ok:`false` err:`PREMISES_NEEDS_ID`

### [cofound] argus_amend — amend: 확인일 연장(아직 불확실)
- ok:`true`
- surface: Amended. Now: "3개월 내 지분 합의에 도달한다" — check-by 2026-12-03.

### [cofound] argus_amend — amend AFTER due = GOALPOST_MOVED 기대
- ok:`false` err:`GOALPOST_MOVED`

### [irrelevant] argus_dismiss — dismiss: 무의미해진 결정 우아하게 닫기
- ok:`true`
- surface: Dismissed. Closed without a verdict.

### [launch-a] argus_open_decision — 출시타이밍 결정 1(related_to 연결)
- ok:`true`
- surface: Cheap to undo and little at stake — trying it IS the test. Leaving it as is stays a real option.

### [launch-a] argus_seal — 봉인
- ok:`?`

### [launch-a] argus_settle — 정산
- ok:`false` err:`NO_PRIOR_SEAL`

### [launch-b] argus_open_decision — 출시타이밍 결정 2(related_to 연결)
- ok:`true`
- surface: Cheap to undo and little at stake — trying it IS the test. Leaving it as is stays a real option.

### [launch-b] argus_seal — 봉인
- ok:`?`

### [launch-b] argus_settle — 정산
- ok:`false` err:`NO_PRIOR_SEAL`

### [launch-c] argus_open_decision — 출시타이밍 결정 3(related_to 연결)
- ok:`true`
- surface: Cheap to undo and little at stake — trying it IS the test. Leaving it as is stays a real option.

### [launch-c] argus_seal — 봉인
- ok:`?`

### [launch-c] argus_settle — 정산
- ok:`false` err:`NO_PRIOR_SEAL`

### [pattern] argus_recall — track_record — 패턴/빈도(등급 없어야)
- ok:`true`
- surface: No settled decisions yet — nothing to summarize.

### [cap] argus_premises — PREMISE_CAP 기대(과다 전제)
- ok:`?`

### [recheck-oq] argus_recheck — open_question recheck = NOT_RECHECKABLE 기대
- ok:`?`

### [forge] argus_premises — source=ai 인데 ai_original 없음 = 위조가드 기대
- ok:`false` err:`PROVENANCE_REQUIRED`

### [still-pending] argus_settle — settle outcome=still_pending 관찰
- ok:`true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
