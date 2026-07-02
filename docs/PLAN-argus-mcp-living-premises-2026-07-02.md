# PLAN v2 — Living Premises for argus-mcp (the model-agnostic surface)

- 날짜: 2026-07-02 (v2 — devils-advocate 10건 + 자체 리뷰 반영해 전면 보완)
- 상태: **계획 확정본** — 착수 트리거 대기(§10 코디네이션).
- 왜: decision-items/living-premises를 **`argus-mcp`(MCP 서버, 모델-무관)** 에 짓는다.
  어떤 MCP 호스트(Claude/ChatGPT/Gemini)에서도 돌게.
- 근거: argus-mcp 심층 맵 + mcp-builder Phase 1 + **적대 리뷰**(devils-advocate; 치명 2건 —
  reconsider의 two-pole fork, 수동 서버의 return-loop 부재 — 이 문서가 그 수정본).
- 관련: `docs/DESIGN-decision-items-living-premises-2026-07-01.md`(개념·스파인), `argus-mcp/README.md`.

---

## 0. 원칙

1. **이식 아님 — 컨셉으로 재설계.** 순수 drift 알고리즘만 이식, 저장·툴 계층은 argus-mcp
   모델(원장 fold·상태기계·envelope)에 맞춰 새로.
2. **겹침 회피 + 단일 소스.** 기존 단수 `unverified_assumption`을 전제 집합으로 **일반화**하되,
   **전제 엔티티가 canonical** — 영수증 헤드라인은 fold에서 렌더(§5). 이중 저장 금지.
3. **기존 스타일 일치.** 저수준 `Server`+JSON Schema, 수동검증(`isOneOf`/`GuardError`), envelope
   출력, `argus_` snake_case, **`spine.ts` 불변식**(`ai_verdict:null`, `FORBIDDEN_FORK_KEYS`,
   닫힌 NEXT_ACTIONS) 전부 유지. drift-guard 테스트가 심판.
4. **정직한 기대치.** MCP 서버는 수동적 — "재확인 안 된 전제"가 **기본 상태**다. liveness를
   연기하지 않고 staleness를 보여준다(§4).

---

## 1. 사용자 여정 → 툴 매핑 (v2: 2툴로 축소)

```
open_decision ─▶ argus_premises(op:add) ─▶ argus_premises(op:amend) ─▶ seal(전제 승격 연결)
  (결정 염)      (전제 N개 등록, AI/사용자)   (편집=provenance 신호)         │
                                                                          ▼
settle(영수증=fold 렌더) ◀─ argus_premises(op:resolve) ◀─ argus_recheck ◀─ check_in(+due 전제)
                              (미결에 사용자 결정 기록)      (현실 재확인)      (piggyback 표면)
```

**v1의 4툴 → 2툴로 축소한 이유 (적대 리뷰 8):** `reconsider`는 `recall`과 이름 근접(호스트
혼동), `amend_premise`는 `argus_amend`와 충돌. 또 opaque `premise_id`를 멀티턴으로 스레딩하면
모델이 id를 mangle → 정확히 "귀환의 순간"에 `NO_SUCH_PREMISE`. 해결: 툴 2개 + **서수 참조**.

## 2. 신규 툴 (2개)

### `argus_premises` — 전제 집합의 쓰기 (op 파라미터)
| op | 뜻 | 비고 |
|---|---|---|
| `add` | 전제 N개 등록 | `premises[]`{text(≤400), kind(premise\|open_question), external:bool, load_bearing:bool, source(ai\|user), ai_original?(source=ai면 **필수**)}. **cap: 결정당 활성 전제 5, load_bearing 2, 배열 ≤5** |
| `amend` | 전제 1개 편집=신호 | `ref`, `action`(accept\|refine\|replace\|retire), `text?`, `note?`. AI 항목 편집 시 `ai_original` 보존 |
| `resolve` | **미결(open_question)에 사용자 결정 기록** | `ref`, `decision`(사용자 자신의 말, ≤400). **elicitation only — 서버는 예시/선택지/lean을 절대 생성하지 않는다**(§3 스파인) |

- `ref` = premise_id 전체 **또는 서수(“P1”)/앞 8자** — 서버가 해석(멀티턴 id-mangling 방어).
  모호하면 `AMBIGUOUS_REF` + 후보 목록 recovery.
- annotations: readOnly:false, idempotent:false. destructiveHint:false (retire도 기록 보존).

### `argus_recheck` — 살아있는 재확인 (순수 판정 + 무장된 provenance)
- 입력: `argus_dir`, `id`, `ref`, `current_value`(≤400), **`source`(필수: url\|user_stated\|host_reported)**,
  `source_detail?`(URL 등, ≤300), `today_override?`.
- 툴은 **네트워크 안 함** — 호스트가 조사, 툴은 순수 drift 판정(수치 ≥10%/부호반전, 텍스트 변화).
- **provenance 무장(적대 리뷰 6):** `source`는 이벤트에 기록·recall에 렌더. `host_reported`는
  surface에 "재확인 출처: 호스트 보고(미인용)"로 정직 표기 — AI의 반기억이 현실기록에 fiction으로
  들어가는 걸 provenance로 막는다(verify reality-grounding 원칙).
- 첫 재확인 = baseline만(`RECHECK_NO_BASELINE` 아님 — 정상 경로, drifted:false·baseline_only:true).
  발화 캡: 같은 전제 재확인은 `RECHECK_MIN_INTERVAL_DAYS=7` 경과 시 due.
- annotations: readOnly:false(이벤트 기록), idempotent:false.

### 확장 (신규 툴 아님)
- **`argus_recall` view:'premises'** — 전제 목록(서수+id), 상태, provenance(ai_original↔최종),
  마지막 재확인 시각·출처, **staleness**("28일째 재확인 없음") 정직 표시.
- **`argus_check_in`** — due 전제 포함(overdue 계약과 별개 필드, envelope 한 줄).
- **`argus_open_decision`/`argus_seal` 승격 연결(§5).**
- **NEXT_ACTIONS**(닫힌 enum): `argus_premises`, `argus_recheck` 2개만 추가(4개 아님 — enum
  오염 최소). drift-guard 스냅샷 갱신 동반.

## 3. 스파인 수정 (치명 1 — two-pole fork 제거)

v1의 `argus_reconsider`("예시 lean 2개 A/B")는 **CLAUDE.md 규칙 4 직접 위반** — "never a
two-pole fork… you cannot launder a verdict by tagging it". 사용자 호출이어도 엔진이 고른 두
프레이밍이 곧 tilt(rounds 1–4: 태깅으로 중화 불가). `spine.ts`의 `FORBIDDEN_FORK_KEYS =
['options','poles','lean','tilt','recommendation']`가 이미 구조적으로 금지.

**v2 형태:** `resolve`는 **elicitation only** — 미결 질문을 seal-시점 맥락과 함께 그대로 재제시
(recall이 담당)하고, **사용자의 현재 결정을 그들의 말로 기록**한다. 서버는 옵션·예시·lean을
생성하지 않는다. 예시가 필요하면 **사용자가 과거에 직접 쓴 것(source:user 항목)만** 인용 가능.
envelope에 lean-형 키 신설 금지(drift-guard 통과 조건).

**⚠️ 파킹(플러그인 동일 결함):** `argus-plugin-v2/skills/track` `reconsider`의 "균형 예시 lean
2개"도 같은 위반 — 플러그인 수리 목록에 추가(이번 범위 아님, 기록만).

## 4. Return-loop — 정직한 설계 (치명 2 — 수동 서버)

MCP 서버는 **수동적**: cron·훅·push 없음. 아무 호스트도 몇 주 뒤 스스로 `check_in`을 부르지
않는다. v2는 이걸 숨기지 않는다:

1. **Piggyback이 1차 트리거** — **모든 argus_* 툴 응답**(read 제외 아님, 전부)에 due 카운트를
   조용히 동봉: `data.due_note`("재확인할 전제 2 · 정산할 계약 1") + next_actions에
   `argus_check_in`. 사용자가 argus를 쓰는 순간마다 표면화(statusline의 MCP 버전).
2. **SERVER_INSTRUCTIONS** — "이 서버를 쓰는 대화 시작 시 argus_check_in을 한 번 호출하라"를
   instructions 필드에 명시(호스트가 읽는 유일한 상시 문서).
3. **staleness 정직 표시** — recall(view:premises)이 "마지막 재확인 N일 전/없음"을 항상 보여줌.
   liveness를 연기하지 않는다.
4. **호스트 밖 케이던스는 문서로** — README에 "주기 재확인은 호스트/사용자 습관/외부 스케줄러
   소관"임을 명시(Claude Code 사용자는 기존 플러그인 훅이 이 역할).
5. **성공지표(행수 규칙):** 출시 후 관찰 지표 = `premise_recheck` 이벤트 수 / `premise_add` 수.
   재확인이 0에 머물면 이 기능은 write-only ceremony — §9 eval-2가 이걸 감시.

## 5. 저장 모델 (v2: 상태기계·하위호환·단일소스 확정)

### 5.1 원장 이벤트 4종 (append-only, 같은 ledger.jsonl)
```
premise_add     {id, premise_id, kind, text, external, load_bearing, source, ai_original?, ts}
premise_amend   {id, premise_id, action, from, to, note?, ts}
premise_recheck {id, premise_id, current_value, prev_value?, drifted, baseline_only, source, source_detail?, ts}
premise_resolve {id, premise_id, decision, ts}
```
`premise_id` = 안정 해시(decision id + kind + 정규화 텍스트). 재-add 시 dedup(멱등).

### 5.2 상태기계 확장 — 명시 (적대 리뷰 3: 소급 전제심기 방지)
| 이벤트 | opened | sealed | due | settled/dismissed |
|---|---|---|---|---|
| premise_add | ✅ | ✅ | ❌ `PREMISE_LOCKED`("소급 전제 등록 불가 — calibration 보호") | ❌ `DECISION_CLOSED` |
| premise_amend | ✅ | ✅ | ❌ `PREMISE_LOCKED`(goalpost 아날로그 — 틀리기 직전 전제 은퇴 방지) | ❌ `DECISION_CLOSED` |
| premise_recheck | ❌(전제는 seal 전 확인 무의미 아님—✅ 허용) | ✅ | ✅ | ❌ `DECISION_CLOSED` |
| premise_resolve | ✅ | ✅ | ✅(미결을 정하는 건 goalpost 아님) | ❌ `DECISION_CLOSED` |
`guardTransition`에 위 행렬 추가. 전부 recovery 힌트 동봉.

### 5.3 하위호환 — **step 0, 선행 릴리스** (적대 리뷰 4)
현행 `ledger-replay.ts`는 미지 이벤트를 `dropped++`(=corruption 신호)로 센다. premise_* 이벤트가
구버전 설치본(npx 배포됨!)에서 **가짜 무결성 경보**를 울리게 된다. 순서:
- **0-a:** replay의 미지 이벤트 처리를 "잘 형성된 versioned 이벤트(v 필드 있음) → 조용히 skip
  (`skipped_unknown` 카운트)" vs "파싱 불가 라인 → dropped"로 분리.
- **0-b:** 이 관용을 **자체 패치 릴리스로 먼저 배포**(구 바이너리가 대비되게).
- **0-c:** 그 다음 premise 이벤트 도입. SCHEMA_VERSION minor bump + CHANGELOG.

### 5.4 단일 소스 확정 (적대 리뷰 7)
- **전제 엔티티가 canonical.** `argus_seal`의 `unverified_assumption` 입력은 **premise_add의
  입력 알리아스**가 된다(내부적으로 premise_add 이벤트 생성, source:'user', load_bearing:true).
  skipped면 승격 없음. `open_decision.load_bearing_assumption` 동일(source: crux provenance 따름).
- **영수증 헤드라인 = settle 시점 fold 스냅샷** — "THE UNVERIFIED ASSUMPTION" 줄은 settle 때
  활성 load_bearing 전제 중 첫 번째를 렌더(없으면 기존 skipped 표기). settle 후 영수증 불변
  (기존 불변식 유지). 전제가 여러 개면 영수증엔 헤드라인 1 + "외 N개 — recall view=premises".

### 5.5 ai_original의 reader 명명 (적대 리뷰 10-b, signal-recorder 재발 방지)
`ai_original`의 **선언된 소비자 = recall(view:premises)의 provenance 렌더**("AI가 뽑음 → 내가
고침" 표시)와 **영수증의 authorship 정직성**. MCP엔 튜닝할 추출 엔진이 없으므로 v1의
"도구-보정" 용도는 **삭제** — reader 없는 신호를 쌓지 않는다(Persistence Declaration 원칙).

## 6. 재사용 vs 새로 짓기
| 조각 | 처리 |
|---|---|
| drift 판정 순수함수 | ✅ 이식(`argus-mcp/src/lib/premise-drift.ts`, 의존성 0) |
| 발화 게이트(빈도캡·후퇴) | ♻️ 원장 recheck 이벤트 기반으로 재구성 — **구체 규칙:** due = `last recheck ts + 7d ≤ today`; 후퇴 = resolve/retire가 명시 행동이므로 dismissal-카운트 후퇴는 **도입 안 함**(MCP에선 무시가 기본이라 카운트 불가 — 정직하게 생략) |
| 전제 스키마 개념·스파인 원칙·직설 카피 | ✅ 개념 적용, 저장은 이벤트로 재설계 |
| webapp/플러그인 코드 | ❌ 이식 안 함 |

## 7. 스타일·검증·에러
- 수동검증 + `GuardError(code, message, recovery)`. **에러코드:** `NO_SUCH_PREMISE`,
  `AMBIGUOUS_REF`, `PREMISE_LOCKED`, `DECISION_CLOSED`, `PREMISE_CAP`(활성 5 초과),
  `NOT_AN_OPEN_QUESTION`(resolve 대상 아님).
- envelope + text 미러 + ENVELOPE_OUTPUT_SCHEMA. surface는 locale(config) 존중, 직설 카피.
- 기존 serialize 체인. `argus_dir` 경로검증(PathSafetyError) 기존 헬퍼 재사용.

## 8. 테스트 (vitest — write 여정은 여기서)
- 각 op happy+에러 / 상태기계 행렬 전체(특히 settled에 add 거부, due에 amend 거부) /
  drift 시나리오(baseline→캡→발화→침묵→텍스트 flip) / 서수 ref 해석·모호 케이스 /
  승격 알리아스 멱등(dedup) / 영수증 fold 렌더 / **하위호환**(premise 이벤트 낀 원장을 구
  fold가 skip, 신 fold가 fold) / drift-guard(`ai_verdict:null`·FORBIDDEN_FORK_KEYS·NEXT_ACTIONS
  스냅샷) green.

## 9. Eval — 2단 분리 (적대 리뷰 9: read-only eval의 한계 인정)
- **eval-1 (mcp-builder식, read-only QA 10문항):** 시딩된 fixture 원장(전제 add→amend→recheck→
  settle이 미리 기록됨) 위에서 `recall`/`check_in`만으로 답하는 질문. 커버: provenance 읽기,
  staleness, due 계산, 영수증 헤드라인.
- **eval-2 (행동, 기존 evals/cases.mjs 스타일):** 스파인-임계 경로 — (a) resolve 흐름에서
  모델이 lean을 생성하도록 유도하는 케이스: 서버 응답에 lean-형 키가 없고 surface가 중립인지
  스코어. (b) piggyback due_note가 실제로 나오는지. (c) §4-5의 write-only ceremony 감시:
  fixture 시나리오에서 recheck/add 비율 리포트.
- write 여정 자체는 vitest가 커버(§8) — eval은 이해·스파인·귀환 검증에 집중.

## 10. 코디네이션 — 순서 조율 확정 (Option B)
사용자 결정: **그 다른 세션의 argus-mcp 작업이 main에 머지된 후 착수.** 적대 리뷰 10-a의
지적(NEXT_ACTIONS 닫힌 enum + drift-guard 스냅샷은 append여도 **의미 충돌**)이 정확히 B를
고른 이유 — 최신 main 위에서 enum·스냅샷·상태기계를 한 손으로 고친다. 착수 전 체크:
`git log origin/main -- argus-mcp/` 로 그 세션 머지 확인 + spine.ts/state-machine.ts 최신
형태 재확인(맵 갱신).

## 11. 구현 순서 (v2)
0. **하위호환 선행**(§5.3: replay 관용 + 패치 릴리스) ← 다른 무엇보다 먼저.
1. `lib/premise-drift.ts` 이식 + 유닛.
2. 원장 이벤트 4종 + fold + **상태기계 행렬** + 유닛.
3. `argus_premises`(add|amend|resolve) + 서수 ref 해석 + 유닛.
4. `argus_recheck`(순수판정 + provenance 무장) + 유닛.
5. recall(view:premises·staleness) + check_in(due 전제) + **piggyback due_note(전 툴)**.
6. seal/open 승격 알리아스(§5.4) + 영수증 fold 렌더 + 유닛.
7. NEXT_ACTIONS(2개)·TOOLS 등록·drift-guard 스냅샷·SERVER_INSTRUCTIONS 갱신.
8. eval-1(fixture QA 10) + eval-2(행동) + 전체 게이트(build/typecheck/test/eval) green.
9. README·CHANGELOG·버전(minor) — return-loop의 정직한 한계(§4-4) 포함.

## 12. 착수 전 확정된 기본값 (v1 §9 열린 결정의 답)
- 툴 수: **2** (argus_premises + argus_recheck). reconsider 폐기(→resolve).
- 영수증: 헤드라인 1 = settle-시점 fold 첫 load_bearing 전제, 나머지는 recall.
- kind: **premise | open_question 2종**(phenomenon은 premise+external로 흡수 — MCP 최소주의,
  웹앱 5종과의 차이는 의도적).
- webapp↔MCP 동기화: 지금은 각자 로컬. 공유 허브 연결은 별도 계획.
- 모드: off | on_change 2종(monthly 등 주기는 YAGNI). 기본 = load_bearing·external → on_change.
