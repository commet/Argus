# PLAN v5 (final) — Living Premises for argus-decision-mcp (실행 플레이북)

- 날짜: 2026-07-02 (v5 — 미탐 경로(Resources/Prompts/Elicitation) + 축적-사용자 렌즈.
  v4=코드 직접검증 정정 4건, v3=3렌즈 리뷰, v2=적대 리뷰 10건, v1=초안)
- 상태: **실행 플레이북 확정** — 착수 트리거 대기(§10).
- 왜: decision-items/living-premises를 **`argus-decision-mcp`(MCP 서버, 모델-무관)** 에 짓는다.
- 관련: `docs/DESIGN-decision-items-living-premises-2026-07-01.md`(개념·스파인), `argus-mcp/README.md`.

## 0.5 PM 직접 검증 (v4 — 에이전트 보고를 눈으로 재확인, 오류 정정)

spine.ts·state-machine.ts·ledger-replay.ts·envelope.ts·recall.ts·sync.ts(main)를 직접 읽고
확인한 사실 — **v3까지의 오류 4건 정정 포함:**

1. **[정정] NEXT_ACTIONS·SERVER_INSTRUCTIONS는 `spine.ts`에 있다** (v3 플레이북이 envelope.ts로
   잘못 배정). 둘 다 `SPINE_INVARIANTS`로 drift-guard에 pin — 수정 시 스냅샷 갱신 동반.
2. **[정정+결정] NEXT_ACTIONS를 확장하지 않는다.** main 확인 결과 argus_review/argus_sync도
   enum 밖에 있음(전례) — 신규 툴 발견성은 SERVER_INSTRUCTIONS + 툴 description + surface의
   툴명 힌트("…argus_premises(amend)로 고치세요")로. **닫힌 enum을 안 건드리면 그 세션과의
   의미 충돌 리스크가 크게 준다.** (v2 §·v3 §2의 "NEXT_ACTIONS 2개 추가" 폐기.)
3. **[정정] 상태기계 행렬에 `absent` 열 누락.** premise_*는 self-create 금지(seal의 B1 전례와
   달리 전제는 결정 서사에 속함) — absent에서 전부 ❌ `ILLEGAL_TRANSITION` + recovery
   "argus_open_decision부터". §6.2에 반영.
4. **[정정] 툴은 9개가 아니라 11개** — argus_review(계정 영수증 검토)·argus_sync(계정 pull)가
   main에 실재(탐색 에이전트 맵이 낡았음). §10 착수-시 재맵을 의무화하는 근거.
5. **[확인] `gate_input` 전례** — replay에 "known meta event → 상태 변화 없음, corrupt 아님"
   케이스가 이미 있음(ledger-replay.ts:140). premise 이벤트도 같은 계열로 추가. 단 **구버전
   바이너리의 `default: dropped++`는 여전히 문제** → step 0 유지. 완화: `npx -y argus-decision-mcp`
   사용자는 자동 최신화되므로 위험은 고정-설치 사용자로 한정.
6. **[확인] sync는 pull 전용(readOnlyHint:true), push는 seal쪽 `ARGUS_TOKEN` opt-in** —
   **프라이버시 기본값: 이번 릴리스에서 전제 데이터는 어떤 네트워크 경로에도 싣지 않는다**
   (push-account 페이로드에 premise 필드 추가 금지; 구현 시 push-account.ts 재확인). 전제
   동기화는 별도 설계로만.
7. **[확인] 검증 스타일이 이미 혼재** — review/sync는 zod 사용, 기존 툴은 수동 가드. 원칙
   수정: "착수 시점 main의 지배적 패턴을 따른다"(재맵 때 확정, §0-3의 '수동검증 고정' 완화).
8. **[확인] `amend_history` 배열 전례**(ContractEntry) — PremiseState의 편집 이력도 같은 형태.
9. **[확인] envelope 인터페이스 변경 불필요** — due_note는 `data`(Record) 안 필드로 충분.
10. **[확인] recall의 id-필수 뷰 전례**(`RECEIPT_NEEDS_ID`) — view:'premises'도 동일 패턴.
11. **[확인] 통합 테스트 전례 실재** — `tools/__tests__/integration-simulation.test.ts` —
    신규 툴도 SDK 클라이언트 시뮬레이션 테스트 포함(§8).

## 0.6 v5 — 미탐 경로 (Resources · Prompts · Elicitation · Zod, main 직접 확인)

v4까지 **tools만** 봤다. main엔 세 개의 스펙-네이티브 표면이 이미 라이브:

- **U1. Resources 실재** — `argus://ledger`, **`argus://contracts/due`**("the return-loop
  context"라고 주석에 명시!), `argus://bearing/current`, `argus://receipts/{id}`. 읽기전용
  =구조적으로 verdict 불가. **→ 신규: `argus://premises/due`**(감시 전제 중 재확인 due,
  결정 맥락 포함) + 템플릿 `argus://premises/{id}`. 호스트가 **자동 주입**할 수 있는 가장
  수동적·가장 강한 return-loop 레버 — v4의 4경로(instructions·piggyback·staleness·문서)에
  **5번째, 최상위 레버**로 추가.
- **U2. Prompts(ritual) 실재** — argus-bind/settle/reframe/review 4종. **→ argus-settle
  ritual에 due 전제 재확인 절차 포함**(연구→provenance와 함께 argus_recheck 호출 안내) —
  "호스트가 언제 웹서치를 하나"의 choreography를 prompt가 정답으로 제공. 신규 prompt는
  안 만든다(기존 settle ritual 확장 — ritual 4종의 결이 이미 여정과 일치).
- **U3. Elicitation 실재** — `lib/elicit.ts`, settle이 이미 사용. **→ `resolve` op는 elicit
  패턴으로 사용자의 결정 문장을 직접 받는다** — v2의 "elicitation only" 설계가 프로토콜
  메커니즘을 얻음(프로즈 지시가 아니라 코드 경로).
- **U4. [정정] Zod가 이미 source of truth** — main은 `toolJsonSchema(t.inputSchema)`로 Zod에서
  JSON Schema를 생성("no hand-kept copy"). §0.5-7의 "착수 시 결정" 해소: **Zod 스키마로
  작성.** (워크트리 사본이 main보다 한참 뒤임이 재실증 — §10 재맵 의무의 세 번째 근거.)

## 0.7 v5 — 축적 사용자 렌즈 (결정을 수십 개 쌓아 고도화하려는 사람의 페인)

- **P1. 교차-결정 전제 수렴** — 실사용자의 세계관 전제("금리 동결")는 **여러 결정에 걸친다.**
  현 설계(결정-스코프 premise_id)는 같은 사실을 3번 추적·3번 재확인·3번 알림 = 축적할수록
  마찰 증가. 수정: (a) check_in·`argus://premises/due`가 **정규화 텍스트로 그룹**("이 사실에
  기대는 결정 3개"), (b) `argus_recheck`에 `apply_to_matching?: bool` — 같은 정규화 텍스트의
  감시 전제 전부에 같은 재확인을 기록(명시적 opt-in, 같은 증거·같은 provenance이므로 기계적
  fan-out — 판단 아님). 스키마 변경 없음.
- **P2. 전제-수준 캘리브레이션 (고도화의 핵심 보상)** — settle에 선택 입력
  `broken_premise_ref?`("빗나갔다면 어느 전제가 깨졌나 — 사용자 지목"). fold가 집계 →
  track_record에 빈도 진술: "빗나간 예측 4개 중 3개는 external 전제가 깨진 경우" (카운트만,
  사용자-귀속 — 스파인 합법). **축적이 복리가 되는 지점**: 세계관의 어디가 약한지 배운다.
- **P3. 재확인 캡은 due-계산만 게이트** — 명시적 recheck 쓰기는 항상 허용(잘못 입력한
  재확인을 즉시 정정하는 append-only supersede 경로). v3의 모호함 해소.
- **P4. 전제 due는 sealed|due 결정만** — open만 하고 봉인 안 한 결정의 전제는 추적·편집은
  되지만 **nag 대상 아님**(좀비 전제 방지). "봉인이 감시를 arm한다" — 제품 서사와도 일치.
- **P5. 파워유저 캡** — due 표면(check_in·리소스·due_note)은 top 5 + counts + has_more
  (main의 review/sync 페이지네이션 관행과 일치).
- **P6. 데이터 소유권 한 줄** — README: "원장은 당신 소유의 로컬 jsonl, 영수증은 텍스트로
  렌더 — 락인 없음." (축적 페르소나의 1번 공포가 락인.)
- **파킹(이름만):** 교차-결정 전문 검색/회상, 다중 argus_dir 집계, 팀 공유.

---

## 0. 원칙

1. **이식 아님 — 컨셉으로 재설계.** 순수 수치-드리프트 계산만 이식, 나머지는 argus-decision-mcp 모델
   (원장 fold·상태기계·envelope·spine drift-guard)에 맞춰 새로.
2. **겹침 회피 + 단일 소스.** 단수 `unverified_assumption`을 전제 집합으로 일반화, **전제
   엔티티가 canonical**, 영수증 헤드라인은 settle-시점 fold 렌더.
3. **기존 스타일 일치.** 저수준 `Server`+JSON Schema, 수동검증(`isOneOf`/`GuardError`),
   envelope, `argus_` snake_case, locale.ts, **spine.ts 불변식**(`ai_verdict:null`,
   `FORBIDDEN_FORK_KEYS`, 닫힌 NEXT_ACTIONS) 전부 유지.
4. **정직한 기대치.** MCP 서버는 수동적 — "재확인 안 된 전제"가 기본 상태. staleness를
   보여주고 liveness를 연기하지 않는다.

---

## 1. PM 렌즈 — 제품 적합성 · MVP · 지표

### 1.1 이 기능이 제품을 강화하는 이유 (희석이 아니라)
argus-decision-mcp의 정체성 = Judgment Receipt, 그중 가장 독특한 줄이 **"THE UNVERIFIED
ASSUMPTION"**. 지금은 seal 때 한 번 적고 끝나는 **죽은 줄**이다. Living premises는 정확히
그 줄을 **살아있는 객체**로 만든다: 여러 개가 되고, 편집되고(저작권 추적), 현실과
재확인되고, settle 때 "그 전제는 어떻게 됐나"가 영수증에 남는다. 새 제품 방향이 아니라
**영수증의 가장 강한 줄을 완성하는 것** — 이게 스코프 정당화다. 이 문장이 흔들리면 기능을
줄인다(늘리지 않는다).

### 1.2 MVP 3단 (각각 독립 배포 가능 — 한 번에 다 안 짓는다)
- **A. Trackable(정적 추적):** step 0(하위호환) + `argus_premises`(add/amend) + recall
  view:premises + seal/open 승격 + 영수증 fold 렌더. → "전제가 보이고 고쳐진다."
- **B. Living(재확인):** `argus_recheck` + check_in due 전제 + 전 툴 piggyback due_note.
  → "전제가 현실과 재확인된다."
- **C. Closure(미결·평가):** resolve op + eval-1/eval-2 + README/CHANGELOG.
A만 배포해도 가치가 성립(영수증 강화). B가 차별점. C가 완성도.

### 1.3 지표 (행수 규칙)
- `premise_add`가 있는 결정 / 전체 seal 비율 (채택).
- **`premise_recheck` / `premise_add` 비율** (write-only ceremony 감시 — §5-5).
- amend가 있는 결정 비율 (편집=신호가 실제로 쓰이나).
관찰 방법: 원장은 로컬이므로 자동 수집 없음 — README에 "행수 확인" 셀프체크 명령 제공
(`argus_recall view:track_record`에 premise 카운트 포함).

---

## 2. 사용자 여정 → 툴 (2개)

```
open_decision ─▶ argus_premises(add) ─▶ argus_premises(amend) ─▶ seal(승격 알리아스)
                                                                     │
settle(영수증=fold) ◀─ argus_premises(resolve) ◀─ argus_recheck ◀─ check_in(+due) / due_note
```

### `argus_premises` — 전제 집합 쓰기
| op | 입력 | 규칙 |
|---|---|---|
| `add` | `premises[]`{text≤400, kind(premise\|open_question), external:bool, load_bearing:bool, source(ai\|user), ai_original?(source=ai면 **필수**)} | **cap: 활성 5·load_bearing 2·배열 ≤5** → 초과 `PREMISE_CAP` |
| `amend` | `ref`, `action`(accept\|refine\|replace\|retire), `text?≤400`, `note?≤300` | AI 항목 편집 시 ai_original 보존 |
| `resolve` | `ref`, `decision≤400`(사용자 자신의 말) | open_question만(`NOT_AN_OPEN_QUESTION`). **elicitation only — 서버는 예시·선택지·lean 생성 금지**(§4) |

### `argus_recheck` — 살아있는 재확인 (v3에서 판정 재설계 — §7.1)
입력: `argus_dir`, `id`, `ref`, `finding`(현재 사실 요약 ≤400), `numeric_value?`(number),
`changed?`(bool — 텍스트 전제일 때 호스트의 **사실 단언**), `source`(**필수**:
url\|user_stated\|host_reported), `source_detail?≤300`, `today_override?`.
- 툴은 네트워크 안 함. 판정: `numeric_value` 있으면 **기계적**(±10%/부호반전 vs 저장된 이전
  numeric); 없으면 `changed` **필수**(없으면 `RECHECK_NEEDS_ASSERTION` + recovery).
- 첫 재확인 = baseline만(정상 경로, drifted:false·baseline_only:true).
- annotations 둘 다: readOnly:false, idempotent:false, destructiveHint:false, openWorldHint:false.

### 확장(신규 툴 아님)
- `argus_recall` view:'premises' — 서수+id·상태·provenance(ai_original↔최종)·마지막 재확인
  (시각·출처)·**staleness**. id 필수(`RECEIPT_NEEDS_ID` 패턴). 빈 상태: "추적 중인 전제 없음
  — argus_premises(add)로 등록".
- `argus_check_in` — due 전제 필드 추가. **각 due 전제에 결정 맥락 동반**(id + decision 텍스트
  48자 clip) — 여러 결정을 가진 사용자가 "P1이 어느 결정의 P1인지" 헤매지 않게.
- **NEXT_ACTIONS는 확장하지 않는다**(§0.5-2, review/sync 전례). 발견성 3경로:
  (a) SERVER_INSTRUCTIONS에 여정 한 줄("중대한 결정을 열면 전제를 argus_premises로 등록해
  두라 — seal 전에"), (b) open_decision·seal의 툴 description에 다음 단계 언급, (c) surface
  텍스트의 툴명 힌트. **stakes가 trivial/low거나 gate가 fired면 전제 제안 자체를 생략**
  (restraint — 사소한 결정에 전제 ceremony 금지).

### 사용자 여정 보강 (v4 — silent-premise 방지)
`add`의 응답 `data.premises`는 **등록된 전제 전문(서수+텍스트+source)을 반드시 에코**한다 —
호스트가 기록만 하고 사용자에게 안 보여주면 "본 적 없는 전제"가 생기므로, surface가 개수를
말하고 data가 전문을 실어 호스트가 표시할 수 있게 강제한다(표시는 호스트 재량이나 재료는
항상 제공). AI-source 전제의 침묵 기록에 대한 유일한 방어는 ai_original 필수 + amend 흐름.

---

## 3. UX 스펙 (디자인 렌즈 — 대화가 UI다)

### 3.1 surface 카피 (envelope의 한 줄 — locale.ts, 직설·비유 금지)
| 상황 | ko surface |
|---|---|
| add 성공 | `전제 {n}개 등록 (P{a}–P{b}). 틀린 건 argus_premises(amend)로 고치세요.` |
| amend refine | `P{n} 수정됨 — 당신 문장으로 기록.` |
| recheck baseline | `P{n} 기준값 기록: "{finding}" ({source}). 다음 재확인 7일 후.` |
| recheck 무변화 | `P{n} 변화 없음 ({source}).` |
| **recheck drift** | `전제가 된 사실이 바뀜 — P{n}: "{prev}" → "{finding}" ({source}). 이 결정을 다시 볼지는 당신 판단.` |
| resolve | `미결 P{n}에 당신 결정 기록: "{decision}".` |
| due_note (piggyback) | data 필드로만: `{"due_note":"재확인할 전제 2 · 정산할 계약 1"}` — surface는 호출된 툴 것 유지(나그냄 방지) |
drift 카피 주의: "다시 보세요"(지시) 금지 — "다시 볼지는 당신 판단"(핸들 반환)까지만.

### 3.2 서수 안정성 (v3 신규 — 오편집 사고 방지)
서수(P1, P2…)는 **등록순 영구 부여, 재사용·재번호 금지.** retire된 P2는 영원히 P2(recall에
retired로 표시), 새 전제는 P{max+1}. 이유: P2 은퇴 후 재번호하면 호스트가 다음 턴에 "P3
고쳐줘"로 **엉뚱한 전제를 수정**한다. `ref` 허용: 서수 | premise_id 전체 | id 앞 8자.
모호·불일치 → `AMBIGUOUS_REF`/`NO_SUCH_PREMISE` + 현재 목록 recovery에 동봉.

### 3.3 영수증 렌더 (settle-시점 fold 스냅샷)
```
  THE UNVERIFIED ASSUMPTION
    Rates stay flat this year          ← 활성 load_bearing 첫 전제
    (+2 premises tracked · 1 recheck: changed 2026-06-12 — argus_recall view=premises)
```
- 전제 0개(또는 전부 skipped): 기존 "(you skipped naming this)" 유지.
- 여러 개: 헤드라인 1 + 요약 1줄. 영수증은 settle 후 불변(기존 불변식).

### 3.4 due_note 절제 (mirror clause)
- count 0이면 필드 자체를 생략(빈 알림 금지). 있어도 **data 필드**이고 surface를 침범 안 함
  — 표면화 여부는 호스트 재량. next_actions에 `argus_check_in` 추가는 due>0일 때만.

---

## 4. 스파인 (v2 확정 유지 + v3 보강)

- **two-pole fork 금지 확정:** resolve는 elicitation only. 서버는 옵션·예시·lean 생성 금지.
  예시가 필요하면 사용자의 과거 source:user 항목 인용만. envelope에 lean-형 키 신설 금지
  (`FORBIDDEN_FORK_KEYS` drift-guard 통과 조건). *(파킹: 플러그인 track reconsider의 "예시
  lean 2개"도 같은 위반 — 플러그인 수리 목록.)*
- **host-asserted `changed`의 스파인 합법성(v3):** 이것은 **외부 현실에 대한 연구 결과 단언**
  이지 사용자 판단에 대한 판정이 아니다(verify의 external claim과 동일 부류). provenance
  (`source`) 필수로 무장. 사용자의 결정을 평가하는 어떤 필드도 아니다.
- **ai_verdict:null·판정 동사 금지** 불변. drift-guard가 심판.

## 5. Return-loop — 정직한 설계 (v5: 스펙-네이티브 레버 2개 추가)

1. **`argus://premises/due` 리소스**(§0.6-U1) = 최상위 레버 — 호스트가 자동 주입 가능한
   읽기전용 컨텍스트(`argus://contracts/due` 전례 그대로). 결정 맥락 포함, P5 캡 적용.
2. **piggyback due_note**(전 툴, §3.4 절제 규칙) = 반응형 트리거.
3. **argus-settle ritual prompt 확장**(§0.6-U2) — 사용자-발동 의식에 due 전제 재확인
   choreography(연구→provenance와 함께 argus_recheck) 포함.
4. SERVER_INSTRUCTIONS: "대화 시작 시 argus_check_in 1회" 지시.
5. recall staleness 상시 표시. 주기 케이던스는 호스트/사용자/외부 스케줄러 소관(README 명시).
6. recheck/add 비율 지표(§1.3)로 write-only ceremony 감시.
**전제 due 정의(v5-P4):** sealed|due 상태 결정의 감시 전제만 — opened는 추적만, settled는
닫힘. 캡(7d)은 due-계산만 게이트, 명시적 recheck 쓰기는 항상 허용(P3, 정정 경로).

## 6. 저장 모델 (v2 확정 유지)

### 6.1 원장 이벤트 4종 (같은 ledger.jsonl, append-only)
```
premise_add     {id, premise_id, ordinal, kind, text, external, load_bearing, source, ai_original?, ts}
premise_amend   {id, premise_id, action, from, to, note?, ts}
premise_recheck {id, premise_id, finding, numeric_value?, prev_numeric?, drifted, baseline_only, source, source_detail?, ts}
premise_resolve {id, premise_id, decision, ts}
```
- `premise_id` = 안정 해시(decision id+kind+정규화 텍스트). 재-add 멱등(dedup). 32-bit 충돌은
  이 규모(결정당 ≤5)에서 무시 가능 — 충돌 시 같은 전제로 취급됨을 주석으로 명시.
- `ordinal`은 add 이벤트에 기록(fold 재현성 — 재번호 불가의 근거 데이터).
- fold: contract별 `premises: Map<premise_id, PremiseState>`; recheck는 **최신값+횟수만**
  상태로 유지(전체 이력은 원장에 있음 — fold 메모리 억제).

### 6.2 상태기계 행렬 (guardTransition 확장 — v4: absent 열 추가)
| 이벤트 | **absent** | opened | sealed | due | settled/dismissed |
|---|---|---|---|---|---|
| premise_add | ❌ `ILLEGAL_TRANSITION`("결정부터 — argus_open_decision") | ✅ | ✅ | ❌ `PREMISE_LOCKED`(소급 전제심기 금지) | ❌ `DECISION_CLOSED` |
| premise_amend | ❌ 동일 | ✅ | ✅ | ❌ `PREMISE_LOCKED`(goalpost 아날로그) | ❌ `DECISION_CLOSED` |
| premise_recheck | ❌ 동일 | ✅ | ✅ | ✅ | ❌ `DECISION_CLOSED` |
| premise_resolve | ❌ 동일 | ✅ | ✅ | ✅ | ❌ `DECISION_CLOSED` |
premise_*는 **self-create 금지**(seal의 B1 전례 부적용 — 전제는 결정 서사에 속함, §0.5-3).

### 6.3 하위호환 — step 0, 선행 패치 릴리스
- 0-a: replay 미지 이벤트를 "v 필드 있는 정상 이벤트 → `skipped_unknown`으로 조용히 skip"
  vs "파싱불가 → dropped(무결성)"로 분리.
- 0-b: **1.0.x 패치로 먼저 배포**(npx 구 바이너리 대비). ⚠️ npm publish는 **사용자 계정
  권한 필요** — §8 사용자 액션.
- 0-c: 이후 premise 이벤트 도입(1.1.0 minor). SCHEMA_VERSION(spine.ts)은 이벤트 v 필드
  유지 — 관용 replay가 전제조건이므로 bump 불필요(구현 시 재확인).
- **롤백 스토리:** 원장은 append-only + 관용 replay → 패키지를 1.0.x로 되돌려도 premise
  이벤트 낀 원장이 그대로 읽힘(skip). 데이터 마이그레이션 없음 = 롤백 안전.

### 6.4 단일 소스 + reader (v2 확정)
- seal의 `unverified_assumption`·open의 `load_bearing_assumption` = **premise_add 입력
  알리아스**(source:'user', load_bearing:true; skipped면 승격 없음; stable id로 멱등).
- 영수증 헤드라인 = settle-시점 fold(§3.3).
- `ai_original`의 reader = **recall provenance 렌더 + 영수증 authorship** (도구-보정 용도
  없음 — MCP엔 튜닝할 엔진 없음).

## 7. 기술 심화 (v3 신규)

### 7.1 drift 판정 재설계 — 첫-숫자 파싱 버그 제거
웹앱 `premise-drift.ts`의 `parseNumber`는 **첫 번째 숫자**를 잡는다 → `"2026년 기준금리
3.5%"`에서 **2026**을 파싱, 가짜 drift. 이식 금지. v3 설계:
- **수치 전제:** 호스트가 `numeric_value`를 **명시적으로** 넘김(정규식 추출 안 함). 툴은
  이전 `numeric_value`와 기계 비교(±10%/부호반전). 이전 numeric 없으면 baseline.
- **텍스트 전제:** 문자열 비교는 패러프레이즈에 취약(매번 가짜 drift) → 호스트가 `changed`
  를 사실 단언(스파인 합법성 §4). 툴은 기록·게이트(빈도캡·상태기계)·provenance만 기계 담당.
- 정직성 가드: `changed:true`인데 정규화 finding == 저장 baseline이면 envelope에
  `integrity_note`("단언과 기록이 상충") 동봉 — 기록은 하되 표시.
- 이식 범위 축소: `numericDrift(prev, next)` 순수 함수만 새로 작성(±10%/부호반전, 유닛
  포함). 후퇴(dismissal-count)는 MCP에서 도입 안 함(무시를 셀 수 없음 — v2 확정).

### 7.2 piggyback 구현
공유 헬퍼 `withDueNote(envelope, state, today)` — 각 툴 핸들러 마지막에 1회 호출. replay는
이미 대부분 툴이 수행하므로 추가 비용 미미(로컬 jsonl). due 정의: 계약(check_by≤today) +
전제(on_change·활성·마지막 recheck 7일 경과 or 없음, sealed 상태에서만).

### 7.3 플러그인 공존 (확인 완료)
- 같은 `.argus/`를 플러그인(Claude Code)과 MCP가 공유해도 안전: 플러그인 훅
  `check-contracts.js`의 replay switch는 **미지 이벤트를 조용히 무시**(확인함), MCP는
  items.jsonl을 안 읽음.
- **단, 전제 저장소 이중화 발생**(플러그인 items.jsonl vs MCP ledger 이벤트). 선언:
  **MCP ledger가 canonical.** 플러그인 track/items.jsonl은 legacy — 향후 플러그인이 ledger
  premise 이벤트를 읽도록 마이그레이션(파킹, 이번 범위 아님). README에 공존 절 1개.

### 7.4 주입 방어
전제 텍스트는 사용자/호스트 입력이고 envelope surface·영수증으로 흘러 호스트 LLM이 읽는다.
규칙: (a) 모든 텍스트 캡(≤400/300) 스키마 강제, (b) surface에 삽입되는 사용자 텍스트는
따옴표로 감싸 **데이터임을 표시**, (c) 서버는 어떤 입력 텍스트도 지시로 해석하지 않음(구조상
자연 충족 — 명시 주석), (d) 렌더는 기존 render-receipt wrap 재사용.

## 8. 실행 플레이북 (커밋 단위·게이트·릴리스)

> 전제: §10 착수 트리거 충족 후, **최신 main에서 새 브랜치**. 커밋마다
> `npm run build && npm run typecheck && npm test` green 게이트(마지막에 `npm run eval`).

| # | 커밋 (MVP) | 파일 | 내용 |
|---|---|---|---|
| 0 | `fix(ledger): tolerant replay …` (A) | `lib/ledger-replay.ts`+테스트 | 미지 versioned 이벤트 skip vs 파싱불가 dropped 분리. **→ 1.0.x 패치 릴리스(사용자: npm publish)** |
| 1 | `feat(premises): ledger events + fold + state matrix` (A) | `lib/spine.ts`(이벤트타입)·`state-machine.ts`·`ledger-replay.ts`+테스트 | 4 이벤트·fold(PremiseState·ordinal)·§6.2 행렬·에러코드 |
| 2 | `feat(premises): argus_premises tool` (A) | `tools/premises.ts`(신규)·`tools/index.ts`·**통합 시뮬레이션 테스트**(integration-simulation 전례 따름) | add/amend/resolve·서수 ref 해석·cap·surface 카피(locale)·data.premises 에코. **NEXT_ACTIONS 불변**(§0.5-2) |
| 3 | `feat(premises): recall view + seal/open promotion + receipt` (A) | `tools/recall.ts`·`seal.ts`·`open-decision.ts`·`lib/receipt.ts`·`render-receipt.ts`+테스트 | view:premises(staleness·provenance)·승격 알리아스 멱등·영수증 fold 렌더 §3.3 |
| 4 | `feat(premises): argus_recheck` (B) | `tools/recheck.ts`(신규)·`lib/numeric-drift.ts`(신규)+테스트 | §7.1 판정·provenance 필수·integrity_note·baseline 경로·**apply_to_matching fan-out(P1)** |
| 5 | `feat(premises): due surfacing` (B) | `tools/check-in.ts`·`lib/envelope.ts`(withDueNote)·**`resources.ts`(argus://premises/due + /{id})**·전 툴 1줄+테스트 | due 전제(P4 정의·P5 캡·정규화-텍스트 그룹)·piggyback §7.2·§3.4 절제 |
| 5b | `feat(premises): settle attribution + ritual` (C) | `tools/settle.ts`(broken_premise_ref? — **기존 elicit 패턴**)·`prompts.ts`(argus-settle ritual에 재확인 절차)+테스트 | P2 전제-수준 캘리브레이션(track_record 빈도 진술)·§0.6-U2 |
| 6 | `feat(premises): instructions + privacy guard` (C) | **`lib/spine.ts`**(SERVER_INSTRUCTIONS — drift-guard 스냅샷 동반)·`lib/push-account.ts` 확인 | instructions에 check_in 지시+여정 한 줄(§2 발견성). **push 페이로드에 premise 데이터 미포함 확인**(§0.5-6 프라이버시 기본값) |
| 7 | `test(evals): premises fixtures + behavioral` (C) | `evals/fixtures/`(도구 dogfood로 temp dir에서 생성해 커밋)·`evals/cases.mjs` | eval-1 read-only QA 10문항 + eval-2 행동(§9) |
| 8 | `docs: README/CHANGELOG + 1.1.0` (C) | README(툴 문서·공존 절·return-loop 한계·행수 셀프체크)·CHANGELOG·package.json | **→ 1.1.0 릴리스(사용자: npm publish)** |

**사용자 액션 (내가 못 하는 것):** npm publish 2회(#0 패치, #8 minor) — 자격증명 필요.
그 외 전부 내가 실행. 각 MVP 단(A/B/C) 끝마다 PR→main 머지(작게 자주).
**릴리스 전 수동 스모크:** `npx @modelcontextprotocol/inspector`로 신규 툴 2개 왕복 1회
(자동화는 통합 시뮬레이션 테스트가 담당 — inspector는 사람 눈 확인용).

## 9. 테스트 · Eval (v2 유지 + fixture 생성법)
- vitest: 각 op happy+에러 / §6.2 행렬 전체 / §7.1 판정(숫자·단언·integrity_note·baseline·
  빈도캡) / 서수 안정성(retire 후 번호 유지·모호 ref) / 승격 멱등 / 영수증 fold / 하위호환
  (구 fold skip·신 fold fold) / drift-guard 스냅샷.
- eval-1: fixture 원장(도구 자체로 temp dir에서 생성 → 파일 커밋) 위 read-only QA 10문항
  (provenance·staleness·due 계산·영수증 헤드라인).
- eval-2: 행동 — resolve에서 lean 생성 유도 → lean-형 키 부재·중립 surface 스코어,
  due_note 발화 확인, recheck/add 비율 리포트.

## 10. 코디네이션 (v2 확정 — Option B; v4 재맵 의무화)
그 세션의 argus-decision-mcp 작업 main 머지 후 착수. **착수-시 재맵은 의무**(v4에서 탐색 맵이 이미
낡았음이 실증됨 — review/sync 2툴 누락, zod 혼재): `git fetch origin main` 후 **직접 읽기**
— `spine.ts`(NEXT_ACTIONS·SERVER_INSTRUCTIONS·SCHEMA_VERSION), `state-machine.ts`(ALLOWED),
`ledger-replay.ts`(default 처리), `tools/index.ts`(툴 수), 지배적 검증 스타일(zod vs 수동,
§0.5-7) 확인 → 이 계획의 §0.5를 갱신하고 새 브랜치.

## 11. 손 시뮬레이션 (6턴 — id 스레딩·카피 검증, regret test 이행)
```
T1 user: "동탄 집 살지 고민" → host: argus_open_decision → argus_premises(add, 3개
   [P1 금리동결(external,load_bearing,ai) P2 공급과잉(external,ai) P3 전세vs실거주(open_question,user)])
   surface: "전제 3개 등록 (P1–P3). 틀린 건 argus_premises(amend)로 고치세요."
T2 user: "P1은 '2026년 내 동결'로 좁혀줘" → amend(ref:"P1", refine) — 서수로 해석, id 스레딩 불필요 ✓
T3 user: (seal — unverified_assumption 입력 생략: P1이 이미 승격 대상과 dedup) ✓
T4 (2주 뒤) user: "argus 상태?" → 아무 툴이든 due_note:"재확인할 전제 1" → host: check_in
   → recheck(ref:"P1", finding:"기준금리 0.25%p 인상", numeric_value:3.75, source:"url",…)
   → drift ✓ surface: "…이 결정을 다시 볼지는 당신 판단."
T5 user: "P3 정했어, 실거주로" → resolve(ref:"P3", decision:"실거주로 간다") — 서버는 어떤
   선택지도 제시한 적 없음 ✓ (스파인)
T6 (check-by) settle → 영수증: 헤드라인 P1 + "(+2 premises tracked · 1 recheck: changed …)" ✓
```
검증 포인트: 서수만으로 전 여정 스레딩 가능(opaque id 불필요), retire 없어도 T2 amend 후
서수 불변, drift 카피가 핸들 반환형, resolve가 elicitation only.

## 12. 확정 기본값 (누적, v5 최종)
- 툴 2개(argus_premises + argus_recheck) · kind 2종(premise|open_question) · 모드 2종
  (off|on_change, 기본 = load_bearing·external → on_change) · 재확인 캡 7d(**due-계산만**,
  쓰기는 상시 허용) · cap 5/2/400자 · due 표면 top5+has_more.
- 서수 영구 부여(§3.2). drift 판정 = 명시 numeric_value 기계 비교 or 호스트 사실 단언(§7.1).
  교차-결정 fan-out은 `apply_to_matching` 명시 opt-in(P1).
- **스키마는 Zod로 작성**(§0.6-U4, main의 source-of-truth 관행). resolve·settle 귀속은 기존
  elicit 패턴(§0.6-U3). 리소스 `argus://premises/due`·`/{id}` 추가, 신규 prompt 없음
  (argus-settle ritual 확장만).
- 전제 due = sealed|due 결정만(P4). settle의 `broken_premise_ref?`로 전제-수준 캘리브레이션
  (P2, 빈도 진술만).
- MCP ledger가 전제의 canonical 저장소(§7.3). 영수증 헤드라인 = settle-시점 fold(§3.3).
- webapp↔MCP 동기화·플러그인 ledger-읽기 마이그레이션·교차-결정 검색·다중 dir 집계·팀 공유
  = 별도 계획(파킹).
