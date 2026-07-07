# Argus MCP — 최종 설계도 (짓기용)

> 이 문서는 비개발자 창업자가 엔지니어(또는 Claude Code)에게 그대로 넘겨 **짓게 하는** 명세서입니다. 토론용이 아니라 시공용입니다. 어려운 용어는 처음 나올 때 한 줄로 풀어 씁니다.

**한 줄 정의:** Argus는 "AI가 답을 주는" 도구가 아니라, **답 대신 영수증(Judgment Receipt)을 주는** MCP 서버입니다. 사용자가 *검증 가능한 예측 + 확인 날짜*를 봉인(seal)하고, 그 날짜에 현실과 대조(settle)하게 만듭니다. AI는 판결하지 않습니다 — 판결 도구 자체가 서버에 존재하지 않습니다.

> 용어 — **MCP**: AI 호스트(Claude·ChatGPT 등)에 도구·자료·프롬프트를 꽂는 표준 연결 규격. **MCP의 3가지 부품**: Tools(AI가 호출하는 동작), Resources(AI가 읽는 읽기전용 자료), Prompts(슬래시 명령으로 끼우는 지시문). **스파인(spine)**: Argus의 척추 원칙 = "최대 생성, 제로 판단".

---

## 0. 비판 정산표 (이 문서가 무엇을 고쳤는가)

악마의 변호인 critique의 모든 BLOCKER/MAJOR를 이 설계도에 *접어 넣었습니다*. 부록이 아니라 본문에 녹였습니다.

| # | 등급 | 발견 | 이 설계도에서의 처리 | 섹션 |
|---|---|---|---|---|
| B1 | BLOCKER | `seal`은 사전 `harvest`가 없으면 `ok:true`로 조용히 증발 (`replayLedger`의 `if(cur)`) | **§3.0 단일 정체성 + open이 무조건 harvest를 기록**. 추가로 replay의 seal/settle을 `if(!cur) create` 로 자가생성하게 보강. 양쪽 다 적용(벨트+멜빵). 테스트로 고정. | §3.0 |
| B2 | BLOCKER | `contract_id` vs `(session_id,label)` vs ledger `id` — 3개의 키가 안 맞아 settle이 영수증을 못 찾음 | **하나의 `id`로 붕괴.** `id`=session=contract=영수증 경로 segment. 영수증은 고정 라벨 `current`. 단일 `resolveContract(id)` 가 모든 도구의 유일한 해석기. | §3.0 |
| B3 | BLOCKER | `deriveState`가 `entry.status`를 읽는데 open(restraint)은 이벤트를 안 써서 happy-path가 deadlock | open이 fire일 때 harvest 기록(B1과 묶임) → status=`candidate`=`opened`. open→seal→settle 순서 통과 테스트 고정. | §3.0, §3.2 |
| M1 | MAJOR | 판결이 **자유 텍스트**(`surface`/`crux_question`)와 **채팅 나레이션**으로 샌다 — "판결 도구 부재"는 필요조건일 뿐 충분조건 아님 | 정직하게 한계로 선언(§6). `crux_question` 검증기 추가(물음표로 끝나야·2인칭 명령형·비교추천 패턴 금지). 채팅 나레이션은 **서버가 못 막음** → 제품 차원 공개. **0% 주장 금지** → "도구표면 0%". | §3.3, §5, §6 |
| M2 | MAJOR | over-fire 게이트는 모델이 준 `stakes/flat`을 신뢰 = garbage-in. 거짓 restraint(고위험을 저위험 태깅)는 *조용히 편안하게* 실패 | 게이트는 "교정 신탁"이 아니라 "restraint 편향기"임을 명시. 모순 입력(`high`+`easily_reversible`) 재확인. 게이트 입력을 ledger에 로깅해 사후 정확도 측정. | §3.3, §6 |
| M3 | MAJOR | 모듈 변수 `boundArgusDir`는 다중 프로젝트/콜드 리스트/프로세스 재시작에 불안정 → Resource 자동주입(귀환 루프 핵심)이 첫 연결에서 조용히 no-op | `ARGUS_DIR` **env로 런타임 고정**(`npx` 스폰 시 주입). `argus_init` 바인딩은 fallback. 다중루트는 v1 단일루트 한계로 문서화. | §4.0 |
| M4 | MAJOR | `localToday()`는 서버 로컬TZ. Resource는 인자 채널이 없어 override 못 받음 → DUE가 비결정적 | `ARGUS_TZ` env(기본 UTC) 고정, 요청당 today 1회 계산. `today_override`는 *config 바인딩*으로 승격해 Resource/테스트도 존중. 자정 푸시는 best-effort, 정확성 경로 아님. | §3.5, §4.0 |
| M5 | MAJOR | `..` 가드가 도구·layout·Resource 정규식·`bearingContracts`에 흩어짐(단일소스 위반). Windows `\`·percent-encoded 누락 | **모든** 경로조립을 `safeSegment`+`assertInside` 한 쌍으로 라우팅(`bearingContracts` 포함). Windows `..\`·`%2e`·심볼릭 테스트 추가. | §3.4 |
| M6 | MAJOR | `verdict-leak 0%` 배지는 채팅 나레이션을 못 봄 → 신뢰성 부채. `✗ NO`는 사용자 판결의 한 끗 | 배지 = `tool-surface verdict-leak 0%` + 각주. demo.gif는 **도구결과 내장 경로**(보편 바닥) 사용, Resource 자동주입 아님. 영수증은 `✗` 등급 대신 "예측/실제" diff로 완화. | §5, §6 |
| m1 | MINOR | `argus_config` 스키마가 실제 `ArgusConfig`(`locale/boss/team/archive`)와 드리프트 | 실제 필드에 정렬. `auto` 제거(`detectLocale`가 이미 함). 기존 `config.yaml` 보존. | §2.6 |
| m2 | MINOR | `FAKE_OWNERSHIP` byte-identical 검사는 한 글자 수정에 뚫림 | best-effort로 강등, 유사도 임계 + "탐지 못할 수 있음" 명시. 강한 보증 안 함. | §2.2 |
| m3 | MINOR | `validateSeal` tautology 정규식은 영어·앞고정 → 한국어/자기예시 다 안 걸림 | "약한 휴리스틱"으로 문서화, 게이트라 주장 안 함. 빈/단답·날짜만 강한 게이트. | §3.1 |
| m4 | MINOR | `amend`가 무가드 → 봉인 후 골대 이동 백도어 | `amend`를 `ALLOWED`에 명시: `opened`→ 또는 `check_by` 전 `sealed`→만. 이후 amend 거부. | §3.2 |
| m5 | MINOR | `next_actions`는 권고일 뿐 강제 아님 | "힌트"로 정직히 표기. 강제는 서버 guard. | §3, §6 |

---

## 1. 무엇을 짓는가 (한 장 요약)

**타깃:** 현재의 16개 얇은 CRUD 도구(파일 조작)를 버리고, **6개의 의도(intent) 도구**로 붕괴시킨다. 파일 배관은 도구 안에 숨긴다.

### 6개 도구 (Tools — 어떤 호스트에서도 작동하는 유일한 바닥)
1. `argus_open_decision` — 결정을 연다. **fire-or-not 게이트를 먼저** 돌려, 발화 시 *중립 크럭스 질문 하나* + "그대로 둠" 옵션. 절대 포크·판결·기운 아님.
2. `argus_seal` — 검증가능 예측(predicate + check_by 날짜)을 봉인. ledger에 `harvest`(없으면)+`seal` 기록.
3. `argus_settle` — 봉인된 계약을 현실과 대조. **사전 seal 없으면 하드 에러.** AI 판결 0인 영수증 발행.
4. `argus_check_in` — 기한 지난 계약을 보여주는 귀환 넛지. 읽고 라우팅만.
5. `argus_recall` — 사용자 자신의 이력(bearing·계약·영수증·track record) 읽기.
6. `argus_init` / `argus_config` — `.argus` 디렉터리 초기화 + 비스파인 설정(언어 등).

> 의도적으로 **존재하지 않는** 도구: `argus_verdict` / `*recommend*` / `*grade*` / `*score*`. **가장 강한 강제는 위반 도구의 부재다.**

### Resources (AI가 읽는 자료, 쓰기 불가) — *v1.5 점진 향상*
`argus://ledger` · `argus://contracts/due` · `argus://receipts/{id}` · `argus://bearing/current`

### Prompts (슬래시 지시문) — *v1.5 점진 향상*
`/argus-bind` · `/argus-settle` — 복붙 시스템프롬프트 문자열을 대체, 한 lib 함수에서 단일소스.

### 스파인을 구조로 강제하는 한 문장
> **판결은 넣을 *필드*도 없고 호출할 *도구*도 없으며, settle은 사전 seal 없이 하드 에러나고, 잘못된 seal은 스키마가 거부한다 — 규율이 산문이 아니라 타입과 상태기계에 박혀 있어 약한 모델도 도구 표면으로는 판결을 못 흘린다.** (자유 텍스트·채팅 나레이션 누수는 줄지만 0이 안 되는 점근선 — §6에서 정직히 공개.)

---

## 2. 도구 정밀 스펙 (엔지니어가 복붙)

**공통 출력 봉투.** `next_actions`는 닫힌 enum이며 *판결류 멤버가 없다*(부재가 강제). `next_actions`는 **힌트**일 뿐 — 진짜 강제는 §3의 서버 guard다(critique m5 정직 반영).

```ts
type NextAction =
  | 'argus_open_decision' | 'argus_seal' | 'argus_settle'
  | 'argus_check_in' | 'argus_recall' | 'argus_config'
  | 'skip' | 'leave_as_is' | 'stop';
// 'verdict'|'recommend'|'decide'|'advise' 멤버는 타입상 표현 불가.

interface ArgusEnvelope {
  ok: boolean; tool: string;
  next_actions: NextAction[];   // 힌트(서버 guard가 진짜 강제)
  surface: string;              // 사람이 볼 한 줄(스파인 안전)
  data: Record<string, unknown>;
  over_fire_gate?: OverFireGate; // 게이트가 돈 경우만
}
interface ArgusError {
  ok: false; tool: string;
  error_code: string;          // 기계 안정
  message: string;             // 모델이 복구하도록 쓴 행동지침
  recovery_action?: NextAction;
}
```

> **단일 정체성 규칙 (B2 해결, 모든 도구 공통):** 한 결정 = 하나의 `id`. 이 `id`가 곧 session = contract = 영수증 경로 segment(`sessions/{id}/receipt.json`, 고정 라벨 `current`). 모든 도구는 단일 `resolveContract(id) → {state, receiptPath, check_by, predicate}` 만 쓴다. `contract_id`·`session_id`·`label`이라는 별도 키는 **존재하지 않는다.**

### 2.1 `argus_open_decision`
**목적:** 결정을 열고, 어떤 것도 표면화하기 *전에* fire-or-not 게이트를 돌린다. 발화 시 중립 크럭스 질문 하나 + restraint 옵션. **발화하면 무조건 `harvest` 이벤트를 기록**(B1/B3 해결 — 이게 없으면 다음 seal이 증발).

inputSchema (게이트 입력을 `required`로 강제):
```json
{ "type":"object","additionalProperties":false,
  "required":["argus_dir","id","decision","stakes","reversibility","status_quo"],
  "properties":{
    "argus_dir":{"type":"string","description":"절대경로 .argus (no '..')"},
    "id":{"type":"string","minLength":1,"maxLength":128,"pattern":"^[A-Za-z0-9._-]+$","description":"이 결정의 단일 식별자(파일 segment 그대로). 새 결정은 새 id."},
    "decision":{"type":"string","minLength":1,"maxLength":600,"description":"사용자가 실제로 마주한 선택을 한 문장 중립으로. 의견 말고 선택."},
    "stakes":{"type":"string","enum":["trivial","low","moderate","high"],"description":"틀렸을 때 비용. 둘 사이면 낮은 쪽(restraint 기본)."},
    "reversibility":{"type":"string","enum":["one_way_door","costly_to_reverse","easily_reversible"]},
    "status_quo":{"type":"string","minLength":1,"maxLength":300,"description":"아무것도 안 하면 무슨 일? — 'leave_as_is'를 항상 실재 옵션으로 두기 위함."},
    "already_decided":{"type":"boolean","default":false},
    "user_question":{"type":"string","maxLength":600},
    "today_override":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"}
  } }
```

출력(구조 보증):
```ts
interface OpenDecisionData {
  id: string;
  crux_question: string | null;        // 정확히 하나 또는 null — 두 극 불가능
  crux_question_provenance?: 'ai_surfaced';
  load_bearing_assumption?: string;
  restraint_option: string;            // 항상 존재
  lean_disclosure?: string;            // 제품 차원 1문장(per-output 기운태깅 금지)
  fork_emitted: false;                 // 리터럴 false — 포크는 타입상 불가
  harvest_written: boolean;            // fire면 true (B1)
}
```
- **fire**: `next_actions:["argus_seal","leave_as_is","skip"]`, `crux_question` 채움, `harvest` 기록.
- **restraint**: `next_actions:["leave_as_is","skip"]`, `crux_question:null`. (단, fire여야만 harvest를 쓴다. restraint는 추적할 게 없으니 이벤트 안 씀 — 그래서 restraint된 id는 다음 seal 시 §3.0의 self-create가 받쳐줌.)

거부:
| error_code | 트리거 | message |
|---|---|---|
| `MISSING_STAKES_ASSESSMENT` | stakes/reversibility 누락 | "게이트 입력이다. 둘 다 넣어 재호출." |
| `ARGUS_DIR_INVALID` | 절대경로 아님/`..`/segment 위반 | "절대경로 .argus, '..' 금지, id는 [A-Za-z0-9._-]." |
| `ALREADY_CLOSED` | `already_decided:true` & 이미 sealed/settled | "이미 닫힌 결정. 현실 보려면 argus_settle. 재오픈 안 함." |

### 2.2 `argus_seal`
**목적:** 검증가능 예측(predicate + ISO check_by)을 봉인. `harvest`(이 id에 없으면 생성)+`seal` 기록.

inputSchema:
```json
{ "type":"object","additionalProperties":false,
  "required":["argus_dir","id","predicate","check_by","predicate_owner"],
  "properties":{
    "argus_dir":{"type":"string"},
    "id":{"type":"string","pattern":"^[A-Za-z0-9._-]+$","description":"argus_open_decision의 id."},
    "predicate":{"type":"string","minLength":8,"maxLength":400,"description":"현실이 참/거짓 판정 가능한 예측. 좋음:'컷오버 다운타임 <5분'. 나쁨:'잘 될 것'."},
    "check_by":{"type":"string","format":"date","pattern":"^\\d{4}-\\d{2}-\\d{2}$","description":"YYYY-MM-DD 실재 미래 날짜."},
    "predicate_owner":{"type":"string","enum":["user","ai_surfaced"],"description":"출처. 절대 위조 금지. 'user'=사용자가 쓰거나 확언. 'ai_surfaced'=Argus 초안·미확언."},
    "basis":{"type":"string","enum":["judgment","luck","mixed","unsure"]},
    "today_override":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$","description":"미래날짜 검증의 '오늘' 오버라이드(무시되던 버그 수정)."}
  } }
```
출력 `data`: `{ id, predicate, check_by, predicate_owner, status:"sealed", ledger_events_written:["harvest?","seal"] }`. outcome/score/verdict 필드 없음.

거부:
| error_code | 트리거 | message |
|---|---|---|
| `EMPTY_PREDICATE` | <8자/공백 | "검증가능 진술 필요." |
| `NOT_FALSIFIABLE` | **약한 휴리스틱**(m3 정직) — vibe 목록 매치 | "체크 불가. 숫자/임계/사건으로 다시." *(게이트 아님, best-effort 명시)* |
| `BAD_CHECK_BY` | 날짜형 아님 또는 `<= today` | "실재 미래 날짜(YYYY-MM-DD) 필요." |
| `NO_DECISION` | id에 harvest도 없고 self-create도 실패 | (§3.0에 따라 보통 self-create로 흡수 — 진짜 빈 입력만 에러) |
| `FAKE_OWNERSHIP` | **best-effort**(m2 정직): predicate가 ai_surfaced 크럭스와 유사도 임계 초과 & 미확언 | "Argus 초안을 'user'로 태깅 금지. 사용자가 자기 말로 확언할 때까지 'ai_surfaced'. *(완전 탐지 불가 — 정직)*" |

### 2.3 `argus_settle`
**목적:** 봉인 계약을 현실과 대조, **AI 판결 0**인 영수증 발행. 상태기계가 사전 seal 없으면 하드 에러.

inputSchema:
```json
{ "type":"object","additionalProperties":false,
  "required":["argus_dir","id","outcome","outcome_source","what_happened"],
  "properties":{
    "argus_dir":{"type":"string"},
    "id":{"type":"string","pattern":"^[A-Za-z0-9._-]+$"},
    "outcome":{"type":"string","enum":["held","avoided","partial","still_pending"],"description":"현실이 예측에 한 일. 사용자의 말을 받아적기 — 추론 금지."},
    "outcome_source":{"type":"string","enum":["user_stated"],"description":"'user_stated' 단일값. AI 추론 outcome은 타입상 불가."},
    "what_happened":{"type":"string","minLength":1,"maxLength":600},
    "today_override":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"}
  } }
```
출력 — 영수증(`receiptPath = sessions/{id}/receipt.json`, 고정 `current` 라벨):
```ts
interface Receipt {
  id: string;
  real_question: string; unverified_assumption: string;
  human_only: string; human_judgment: string;   // 항상 사람, 절대 모델
  check_by: string; settled_at: string;
  what_happened: string;
  outcome: 'held'|'avoided'|'partial'|'still_pending';
  outcome_source: 'user_stated';
  assumption_held: boolean | null;   // outcome에서 기계적 파생, 판단 아님
  ai_verdict: null;                  // 리터럴 null — drift-guard가 항상 null 단언
}
```

거부:
| error_code | 트리거 | message |
|---|---|---|
| `NO_PRIOR_SEAL` | replay상 seal 없음 (상태≠sealed/settled) | "봉인 안 된 걸 정산 불가. argus_seal 먼저." |
| `ALREADY_SETTLED` | 이미 settled | "append-only — 재판단 없음. argus_recall로 영수증 보기." |
| `PREMATURE_SETTLE` | `still_pending` & `check_by > today` | "아직 기한 전. 기다리거나 날짜 amend." |

### 2.4 `argus_check_in`
inputSchema: `{argus_dir(req), today_override?, include_upcoming_days?:0-30}`. 출력 `data:{due:[{id,predicate,check_by,days_overdue,source}], upcoming, due_count}`. 아무것도 없으면 `next_actions:["stop"]`, `surface:"기한 도래 없음."` — restraint(억지 넛지 금지). `argus_settle`로만 라우팅. `replayLedger().overdue` + `bearingContracts()` seed 병합.

### 2.5 `argus_recall`
inputSchema: `{argus_dir(req), view:"bearing"|"contracts"|"receipt"|"track_record"(req), id?(view=receipt 필수)}`. `track_record` 출력엔 `judgment_tier:null`·`judgment_score:null` 고정(drift-guard 단언) — 의미 언어는 표본크기 스케일된 `frequency_statement` + `sample_size_caveat`뿐(스파인 규칙 2). 거부: `RECEIPT_NEEDS_ID`·`RECEIPT_NOT_FOUND`·`ARGUS_DIR_INVALID`.

### 2.6 `argus_config` (m1 — 실제 `ArgusConfig`에 정렬)
실제 config 형태(`locale: ko|en`, `boss`, `team`, `archive`)에 맞춘다. `auto` 제거(`detectLocale`가 함). 기존 `config.yaml`/`config.json` 보존(없는 키만 채움).
```json
{ "type":"object","additionalProperties":false,"required":["argus_dir"],
  "properties":{
    "argus_dir":{"type":"string"},
    "locale":{"type":"string","enum":["ko","en"]},
    "boss":{"type":"string"}, "team":{"type":"string"}, "archive":{"type":"boolean"}
  } }
```
> 의도적 부재: falsifiability·seal-before-settle·정직한 출처를 끄는 키는 **없다**. 설정은 외형뿐, 스파인은 설정 불가. 거부: `ARGUS_DIR_INVALID`·`WRITE_FAILED`.

---

## 3. 서버 상태 머신 + 스파인 강제

MCP 프로토콜은 도구 호출 *순서를 강제하지 않는다.* 그래서 모든 불변식은 **`replayLedger()`에서 파생된 서버 상태**로 강제한다 — 모델이 순서를 지켰다고 *주장*하는 건 무관하다.

### 3.0 단일 정체성 + 영속 (B1·B2·B3 — 한 줄도 쓰기 전에 해결할 선행 슬라이스)

**이게 없으면 6개 도구 중 #2·#3을 구현할 수 없다.** 비판이 가장 정확히 짚은 부분.

1. **하나의 `id`** = session = contract = 영수증 경로 segment. `contract_id`/`label` 차원 폐기. 영수증은 고정 라벨 `current`(`sessions/{id}/receipt.json`).
2. **단일 해석기** `resolveContract(id, argusDir, today) → {state, receiptPath, predicate, check_by}`. 모든 도구·guard가 이것만 쓴다.
3. **open(fire)은 무조건 `harvest`를 기록** → replay가 `status:'candidate'`를 만든다 → `deriveState`가 `'opened'` 반환 → 다음 seal이 통과(B3 deadlock 해소).
4. **벨트+멜빵:** `replayLedger`의 `seal`/`settle` 케이스를 `if(!cur)`일 때 **드롭 대신 자가생성**하도록 보강. 그래서 harvest 없는 seal도 *조용히 증발하지 않고* 계약을 만든다(B1). 둘 다 적용한다.

```ts
// ledger-replay.ts 보강 (B1) — 핵심 한 줄의 반전
case 'seal': {
  if (typeof ev['predicate']==='string') sealedPredicates.add(ev['predicate']);
  let e = map.get(id);
  if (!e) { e = { status:'candidate', text:'' }; map.set(id, e); }  // ← 드롭 대신 생성
  e.status='sealed';
  if (ev['predicate']!=null) e.text=ev['predicate'] as string;
  e.check_by=ev['check_by'] as string|undefined;
  stats.total_sealed++;
  break;
}
// settle도 동일 패턴. 테스트: seal-without-harvest → 계약 존재 & due 가능(증발 0).
```
**고정 테스트(필수):** `open(fire)→seal→settle` 시퀀스에 `illegal_transition`/증발이 없음. seal-without-harvest가 *조용히 사라지지 않음*(에러나거나 자가생성).

### 3.1 falsifiable-predicate 검증 (미사용 `ajv` 대체)
`argus_seal`이 빈/짧은 predicate·비날짜 check_by·과거날짜를 하드 거부. tautology 정규식은 **약한 휴리스틱으로 문서화**(m3 — 한국어·자기예시 못 잡음을 인정, 게이트라 주장 안 함). 빈값·날짜형식·과거날짜만 강한 게이트.

### 3.2 상태(파생, 저장 안 함) + 허용 전이

상태는 **필드로 저장하지 않는다**(이게 `session_update status` no-op 버그의 근원 — 쓰기가능 status는 거짓말이고 replay가 덮어씀). 상태는 이벤트 로그의 fold다.

```
open(fire→harvest) ─► OPENED ─► DISMISSED[종단]
                          │
                    seal  ▼
                       SEALED ──(시간)──► DUE ──settle──► SETTLED[종단]
                          └─ amend (check_by 전만) / dismiss
```
```ts
const ALLOWED = {
  absent:    new Set(['opened']),
  opened:    new Set(['sealed','dismissed','amended']),
  sealed:    new Set(['due','settled','dismissed','amended']), // amended는 check_by 전만(m4)
  due:       new Set(['settled','dismissed']),                 // due엔 amend 불가(골대이동 차단)
  settled:   new Set([]),   // 종단 — 재오픈 없음(mirror clause)
  dismissed: new Set([]),
};
```
**m4 — amend 가드:** `amend`는 `opened`→ 또는 `check_by > today`인 `sealed`→만 허용. `check_by <= today` 이후 amend는 거부(`E_GOALPOST_MOVED`). due 이후 골대이동 백도어 차단.

`guardTransition(id, target, argusDir, today)`가 *호출 시점에* replay를 다시 돌려 현재 상태를 읽고, `ALLOWED[current]`에 없으면 **하드 에러 + 복구 힌트**. settle 콜드 호출도 seal 이벤트 부재로 거부 → 순서 무관 불변식.

### 3.3 over-fire 게이트 (mirror clause를 코드로)

`argus_open_decision` 안에서 **크럭스 질문을 만들기 전에** 돈다. restraint면 포크·질문·seal프롬프트 *없이* "그대로 둠"만 반환.
```ts
export function overfireGate(s: DecisionSignals): GateVerdict {
  if (s.is_vent)        return {fire:false,reason:'vent',response:'leave_as_is'};
  if (s.is_factual)     return {fire:false,reason:'factual',response:'leave_as_is'};
  if (s.already_closed) return {fire:false,reason:'already_closed',response:'leave_as_is'};
  if (s.flat)           return {fire:false,reason:'flat',response:'leave_as_is'};
  if (s.reversible && s.stakes!=='high') return {fire:false,reason:'reversible_low_stakes',response:'leave_as_is'};
  if (s.stakes==='low') return {fire:false,reason:'low_stakes',response:'leave_as_is'};
  return {fire:true,reason:'consequential_open_fork'};
}
```
**M2 정직 — 게이트는 신탁이 아니라 restraint 편향기:**
- 입력(`stakes/reversibility/flat/is_vent`)은 모델이 *주장*한 값이지 *측정*값이 아니다. 게이트는 입력보다 더 옳을 수 없다 — 이 점을 §6에 공개.
- **모순 재확인:** `easily_reversible` + `stakes:high`는 보통 모순 → 게이트가 이 조합을 플래그하고 `over_fire_gate.reason:'contradictory_signals'`로 한 번 되묻게 한다(거짓 restraint로 고위험을 조용히 버리는 실패 완화).
- **게이트 입력을 ledger에 로깅**(`gate_input` 메타 이벤트) → 사후 eval이 게이트 *로직*이 아니라 *입력 정확도*를 측정.

**M1 — 자유텍스트 누수 부분 차단:** fire 분기의 `crux_question`에 검증기. 물음표로 끝나야 하고, 2인칭 명령형(`you should`)·비교추천 패턴(`the stronger case`, `most teams`)·"A or B" 포크 금지. **이건 누수를 줄이는 banned-pattern 가드일 뿐 — 우회 가능함을 §6에 정직히 공개.** 응답 스키마엔 `crux_question:string` 하나뿐, `options/poles/lean/tilt` 필드 자체가 없어 포크는 타입상 불가.

### 3.4 경로 안전 (M5 — 단일 소스, Windows 포함)

**모든** 경로조립(도구·Resource 정규식·`argus_init`·`bearingContracts`)을 한 쌍으로 라우팅. 흩어진 인라인 검사 금지(단일소스 위반 재발 방지).
```ts
const SEGMENT = /^[A-Za-z0-9._-]+$/;  // 단일 segment, 구분자·..·\ 모두 거부
export function safeSegment(raw: unknown, kind: string): string {
  if (typeof raw!=='string'||!raw.length||raw.length>128) throw new Error(`invalid_${kind}`);
  if (!SEGMENT.test(raw)||raw==='.'||raw==='..') throw new Error(`invalid_${kind}`);
  return raw;
}
export function assertInside(root: string, candidate: string): string {
  const r = path.resolve(root)+path.sep, c = path.resolve(candidate);
  if (c!==path.resolve(root) && !c.startsWith(r)) throw new Error('path_escape_blocked');
  return c;
}
```
- `layout.ts`의 모든 헬퍼 + **`bearingContracts`의 `readdirSync` 결과**(디스크상 임의 디렉터리명)도 `safeSegment` 통과 후에만 `path.join`. 현재 `bearingContracts`는 raw `path.join`이라 우회 → 막는다.
- Resource 영수증 파싱 `^argus://receipts/([^/]+)$`는 `[^/]+`라 Windows `\`·`%2e`를 못 막음 → **인라인 검사 폐기, `safeSegment` 재사용.**
- 테스트(`safe-path.test.ts`): `..`, `a/b`, `a\b`, `..\..\`, `%2e%2e`, 절대경로, 129자, NUL, 심볼릭 탈출.

### 3.5 시계/타임존 결정성 (M4)
`ARGUS_TZ` env(기본 UTC, 문서화)로 고정, 요청당 `today` 1회 계산. `today_override`를 **config 바인딩으로 승격**해 Resource(인자 채널 없음)·테스트도 동일 today를 본다. 자정 롤오버 푸시는 best-effort(다음 요청에 piggyback), *정확성 경로 아님* — DUE 정확성은 매 `argus_check_in`/`argus_recall` 재계산에 의존.

### 3.6 단일소스 브레인 + drift-guard
스파인 *불변식*은 구조(판결 도구 부재·상태기계·스키마 거부·게이트-선행)로 이미 박힘. 잔여 산문(restraint 카피·크럭스 규칙·제품차원 lean 공개)은 한 lib 함수 `src/lib/spine.ts`의 `SPINE_INVARIANTS`에서만. MCP Prompts도 같은 객체에서 렌더 → 드리프트 불가. `spine-drift.test.ts`가 단언: (a) 등록 도구에 `*verdict*` 없음, (b) 모든 영수증 `ai_verdict===null`, (c) track_record tier/score `null`, (d) settle은 사전 seal 없이 throw, (e) open_decision 출력 스키마에 `options/poles/lean/tilt` 부재. 3표면(webapp/plugin/mcp) 불변식 키 핀 — 하나 빠지면 CI 실패(CLAUDE.md "필드 추가 체크리스트"와 동형).

---

## 4. Resources · Prompts · 호스트 강등 매트릭스 (*v1.5 점진 향상 — v1 바닥은 Tools만*)

### 4.0 argus_dir 바인딩 (M3 — Resource 작동의 선결)
Resource/Prompt는 list 시점에 인자가 없다. 그래서 서버가 **`ARGUS_DIR` env로 런타임에 root를 고정**한다(`npx` 스폰 시 주입):
```jsonc
{ "mcpServers": { "argus": {
    "command": "npx", "args": ["-y","argus-decision-mcp"],
    "env": { "ARGUS_DIR": "${workspaceFolder}/.argus", "ARGUS_TZ": "UTC" } } } }
```
`argus_init` 바인딩은 *fallback*. **다중루트는 v1 단일루트 한계로 문서화**(둘째 프로젝트는 별 서버 인스턴스 권장). env 미설정 시 Resource는 `{unbound:true, hint:"set ARGUS_DIR or call argus_init"}`로 깨끗이 강등(throw 안 함).

### Resources (4개, 읽기전용 — ledger 변이 불가가 곧 "읽기표면이 판결 못 씀" 보증)
| URI | 반환 | 자동주입 시점 |
|---|---|---|
| `argus://ledger` | 전체 replay 상태(`as_of`·`stats`·`contracts[]`) | 대화 시작(프리페치 호스트)·"내 결정들" |
| `argus://contracts/due` | overdue + bearing seed 병합, `next_actions`(판결 없음) | **매 대화 시작**(최고가치 귀환 컨텍스트) |
| `argus://receipts/{id}` (template) | 해당 영수증(`sessions/{id}/receipt.json`, `current`) | 특정 과거 결정 참조·settle 시 |
| `argus://bearing/current` | 활성 세션 bearing | 세션 재개 |

읽기 핸들러는 deleted read-tool과 *같은 lib 함수* 호출 → `{contents:[{uri,mimeType:"application/json",text:JSON}]}`. 구독 알림(`notifications/resources/updated`)은 dueHash 변경 시 + 날짜 롤오버 시 best-effort. **미지원 호스트는 그냥 재페치 — 알림은 향상이지 정확성 필수 아님.**

### Prompts (2개 — 복붙 문자열 대체, `discipline.ts` 단일소스)
- `/argus-bind` — STEP 0 fire-게이트(먼저) → STEP 1 단 하나의 중립 *질문*(판결·포크·기운 금지) → STEP 2 falsifiable seal로 유도. `argus_verdict` 어디에도 없음. `{decision}`은 `sanitizeForPrompt()` 통과.
- `/argus-settle` — GetPrompt 시점에 `contracts/due` + 영수증을 *읽어 메시지에 구워넣음*. settle은 단발 commitment(모델과 토론 아님). outcome은 사용자 소유 — 받아적기.

### 호스트 강등 매트릭스 (2026, 불확실=`?` + 안전 fallback)

> 지배 규칙: **핵심 스파인 강제는 Tools + 서버 상태에만 산다**(모두가 지원하는 유일한 칸). 나머지가 다 "미지원"으로 강등돼도 스파인은 멀쩡.

| 부품 | Claude Code | ChatGPT | Gemini | Generic | 미지원 시 fallback |
|---|---|---|---|---|---|
| **Tools** | Yes | Yes | Yes | Yes(필수) | — (항상 작동, 이게 바닥) |
| Resources | Yes | 부분`?` | 부분`?` | 선택`?` | `argus_recall`이 같은 JSON 반환(읽기 도구 shim). 읽기는 어느 쪽이든 변이 못 함 → 스파인 무관 |
| Resource 알림 | `?` | 낮음`?` | 낮음`?` | 선택 | 불필요 — due는 매 recall/prompt·날짜롤오버에 재계산. 호스트 폴링 |
| Prompts | Yes(슬래시) | 부분`?` | `?` | 선택`?` | **규율 텍스트가 도구결과에도 내장**(`discipline.ts`) → 프롬프트 0지원이어도 규율이 도구결과에 탑승 |
| Elicitation | `?` | 낮음`?` | 낮음`?` | 드묾 | `argus_seal`이 인자로 받아 **서버 스키마 검증**(진짜 바닥). Elicitation은 UX 설탕 |
| Sampling | `?` | No`?` | No`?` | 드묾 | `/argus-bind` 프롬프트가 in-band로 동일 게이트→1질문. 둘 다 `discipline.ts` 단일소스 |

`initialize` 시 클라이언트 capabilities 읽어 `hasResources/hasPrompts/...` 저장. **상태 전이(seal→settle)는 어떤 capability 플래그에도 의존하지 않음** — 순전히 Tools+서버상태.

---

## 5. 트렌딩 레이어

### 5.1 훅 (PICK)
> **"Your AI gives you an answer. Argus gives you a receipt — and checks it against reality on the date you set."**

쐐기(영수증≠조언)·루프(check-by)·페이오프(현실)를 한 숨에. **창업자 조어 위험(M6/메모리):** 훅과 첫 문단은 plain English("answer/receipt/check it against reality")로 시작, `seal/settle/bearing`은 독자가 이미 이해한 *후에* 등장.

### 5.2 Judgment Receipt 렌더 (M6 — `✗` 등급 → diff로 완화)
`renderReceipt()` lib 함수. 채워진 실제 settled 예시:
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Decision     Move checkout to a single-page flow
  Sealed 2026-04-02      Settled 2026-06-30

  THE REAL QUESTION
    Will fewer steps lift completion, or just hide
    where people were already dropping?
  THE UNVERIFIED ASSUMPTION
    That step-count — not payment trust — was the
    thing stopping people at checkout.
  HUMAN-ONLY CALL   Worth shipping a risky redesign mid-quarter.
  …made by          Me. (not the model)

  YOU PREDICTED   "Checkout completion rises ≥ 5 pts within 8 weeks."  (check-by 06-30)
  WHAT HAPPENED   Completion +1.2 pts. Drop-off moved to the
                  card-entry field, not the step count.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└──────────────────────────────────  argus · seal → settle ─┘
```
- **변경(M6):** `ASSUMPTION HELD? ✗ NO` 등급 스탬프 제거 → **"YOU PREDICTED / WHAT HAPPENED" diff**로. 사용자 예측에 ✗를 찍는 건 "넌 틀렸다" 판결의 한 끗 → diff는 현실을 보여줄 뿐 채점 안 함.
- `AI VERDICT … NONE`은 *항상 존재, 항상 NONE*(부재가 의도적이고 눈에 띄게). `human_judgment`는 구조상 "AI"라 말할 수 없음.

### 5.3 Eval 하니스 (`argus-mcp/evals/`, gen=sonnet·judge=opus)
**Tier 1 결정적 게이트(모델 없음, CI 그린이어야 publish):** G1 seal없는 settle→`E_NO_SEAL`·ledger 불변 / G2 빈 predicate 거부 / G3 비ISO date 거부 / G4 `..`·`\`·`%2e` 경로탈출 차단 / **G4b seal-without-harvest 증발 0**(B1 회귀) / G5 빌드된 `dist/`에 `*verdict*`/`*grade*`/`*score*` 도구 부재 / G6 today override 존중 / G7 모든 결과에 판결 아닌 `next_actions[]` / G8 영수증에 `ai_verdict===null` & `human_judgment≠모델명`.

**Tier 2 스파인 eval(≥3모델: sonnet/haiku/비-Anthropic, opus가 transcript 판정):** OVERFIRE-FLAT(평탄 케이스에 포크/질문 안 만들면 통과) / **NO-VERDICT-LEAK** — *도구 표면* transcript에서 directional verdict/disclaimed lean/신뢰점수 누수율. **배지 = `tool-surface verdict-leak 0% (n=80)` + 각주 "채팅 나레이션은 범위 밖"**(M6 — 채팅 누수는 못 보므로 0% 단순 주장 금지) / SEAL-WELLFORMED / CRUX-IS-A-QUESTION.

### 5.4 배포 체크리스트
- `claude mcp add argus -- npx -y argus-decision-mcp` (above the fold)
- README hero = 영수증 PNG(§5.2) 핀
- **demo.gif** = seal→settle 루프. **단, 도구결과-내장 규율 경로 사용**(보편 바닥), Resource 자동주입 경로 아님(M6 — 그 기능은 랜덤 호스트서 no-op)
- `evals/` + 배지 + publish 차단 CI / `SECURITY.md`(경로탈취 위협모델·atomic-write·"텔레메트리 없음, 전 데이터 로컬 `.argus/`") / `CONTRIBUTING.md`(eval 케이스 추가법) / `LICENSE`(MIT)·태그 릴리스·`keywords`
- MCP 레지스트리 + `mcp.so`/awesome-mcp 등재. **6-도구 표가 16-CRUD 표를 대체**(짧은 목록=설계됨)
- MCP Inspector 10초 quickstart

### 5.5 첫눈에 별을 버는 한 가지
**README 최상단 영수증 스크린샷의 `AI VERDICT … NONE` 한 줄 — 그리고 `grep dist/`로 판결 도구가 *없음*이 증명된다는 사실.** 다른 모든 결정 도구는 *더 나은 답·점수·신뢰*로 경쟁한다. Argus의 hero는 반대를 소리내어 말한다 — 기계가 채점을 거부하고, 그 거부가 *산문 약속이 아니라 도구 스키마*에 강제돼 있다. 입장(position)은 공유된다.

---

## 6. 남은 정직한 한계 (점근선 — 제품 차원 공개)

스파인 원칙대로: "zero judgment은 도달하는 점근선이지 주장하는 상태가 아니다." 다음은 *완전히는 못 푸는* 것들. 덮지 않고 적는다.

1. **자유 텍스트·채팅 나레이션 판결 누수 (M1 — 불가피).** 구조적 강제는 *도구 출력*만 덮는다. `surface`·`crux_question`은 모델이 쓰는 자유 텍스트라 한 번 바꾸면 판결이 *질문 안에* 들어간다. 더 근본적으로, 모델이 도구 호출 *사이에* "솔직히 난 migrate 하겠다"고 채팅에 칠 수 있고 — **이건 어떤 MCP 서버도 못 막는다**(프로토콜 표면 밖). 검증기·banned-pattern은 줄이지만 0이 아니다. → **"도구 표면 verdict-leak 0%"만 주장**, 채팅 나레이션은 범위 밖으로 명시. "우리는 판단 안 한다" 금지, "한 질문을 표면화하고 희미한 기운은 알려진 한계로 공개한다"고 쓴다.

2. **게이트는 입력보다 옳을 수 없다 (M2).** over-fire 게이트는 모델이 *주장한* stakes/flat/reversibility를 받는다. 모델이 고위험·비가역을 저위험·가역으로 잘못(혹은 영합하려) 태깅하면 게이트가 *조용히 편안하게* "그대로 둠"을 반환 — 규율 있어 보이며 사용자를 버린다. 모순신호 재확인과 입력 로깅으로 완화하지만, 게이트는 *교정 신탁이 아니라 restraint 편향기*다. 사후 eval로 입력 정확도를 측정할 뿐.

3. **`value ∝ leverage ∝ tilt` 잔여 기운 (불가피).** 가장 레버리지 높은 가정을 이름 붙이는 행위 자체가 flip을 가리킨다. 이 미세한 기운은 환원 불가 — 제품 차원에서 1문장 공개, per-output 기운태깅은 *절대* 안 함(스트레스 테스트상 위반을 *악화*).

4. **호스트 격차 (M3/매트릭스).** Resources/Prompts/Elicitation/Sampling 지원은 2026 기준 고르지 않다. 그래서 핵심 강제는 Tools+서버상태(보편)에만 둔다 — 나머지는 점진 향상, 우아한 강등. 다중루트는 v1 단일루트 한계.

5. **창업자 조어 위험 (메모리/M6).** `seal/settle/bearing`은 창업자 조어. 훅·첫 문단은 plain English로, 조어는 이해 후 등장. 그래도 포맷/어휘가 founder-coined인 점은 채택 마찰로 남는다(GTM 감사 결론).

6. **시계 결정성은 best-effort 푸시까지만 (M4).** 자정 롤오버 알림은 stdio 서버 특성상 다음 요청에 piggyback — 정확성 경로 아님. DUE 정확성은 재계산에 의존하지 알림에 의존하지 않는다.

---

## 7. 실행 순서 (단계별, 규모 + v1 권고)

> 핵심 정직: 비판이 옳다 — **B1~B3은 폴리시가 아니라 빠진 토대**다. `resolveContract(id)`와 open→harvest 영속이 없으면 도구 #2·#3을 한 줄도 못 짠다. Resources+구독+Prompts+Elicitation+Sampling+매트릭스+eval+gif+레지스트리를 "additive"로 포장한 건 멀쩡한 다주(multi-week) 프로그램이다. 바닥을 먼저 깔고 한 줄의 실제 데이터가 도착하는 걸 보고 나서 쌓는다(재발 실패모드 = "UI 멀쩡, 데이터 미도착").

### 단계 0 — 버그-픽스 바닥 (**선결, ~2일**)
- **정체성 통합** `resolveContract(id)` 단일 해석기, 하나의 `id`, 영수증 고정 라벨 `current` (B2)
- **open(fire)→harvest 영속** + replay seal/settle `if(!cur) create` 보강 (B1·B3)
- 상태=replay 파생, 쓰기가능 `status`/`phase` 제거 (session_update no-op 버그)
- `today_override` 모든 날짜 도구 + config 바인딩 (M4)
- 경로안전 단일소스 `safeSegment`+`assertInside`, `bearingContracts` 포함, Windows 케이스 (M5)
- **테스트 스위트:** state-machine·guard·overfire-gate·validate-seal·safe-path·spine-drift·**seal-without-harvest 증발 회귀** (현재 0 테스트 → 진짜 신뢰 잠금해제)
- `amend` 가드 (m4), `ajv` 제거→`validateSeal`

### 단계 1 — 얇고-정직한 출하 = 트렌드 최소선 (**~3~4일**)
- **6개 의도 도구를 Tools 바닥에** (보편 지원 유일 부품)
- `argus_config` 실제 ArgusConfig 정렬 (m1)
- `renderReceipt()` + diff형 영수증(§5.2, ✗ 등급 아님)
- README hero(영수증 PNG) + 훅 + `tool-surface verdict-leak` 배지 + SECURITY/LICENSE
- demo.gif = **도구결과-내장 경로**
- **🛑 v1은 여기서 멈춘다.** 창업자 dogfood로 *실제 1행*(1 seal + 1 settle)이 서버에 도착하는 걸 본다. 점화가 도느냐가 구속 제약이지 배포가 아니다(GTM 감사).

### 단계 2 — 강제된-브레인 (**점화 확인 후, ~3일**)
- Resources(`ledger`/`due`/`receipts`/`bearing`) + `ARGUS_DIR` env 바인딩 (M3)
- Prompts `/argus-bind`·`/argus-settle` (`discipline.ts` 단일소스) + 도구결과 내장 fallback
- Tier 2 멀티모델 eval 하니스 + CI publish 게이트
- MCP 레지스트리/awesome-mcp 등재

### 단계 3 — 선택적 고급 (**측정 데이터가 요구할 때만**)
- Resource 구독 알림 / Elicitation(seal 폼) / Sampling(서버측 레버리지 랭킹) — 전부 우아한 강등, 비-load-bearing
- 다중루트 URI 힌트, 자정 롤오버 푸시

**v1 멈춤 권고:** **단계 0 + 단계 1.** 그게 정착된 방향을 실제로 실현하는 방어가능 MVP다 — 정체성/영속 수정 + Tools 바닥 6도구 + 경로/시계 결정성 + guard/gate/validate/path 테스트. 나머지는 진짜 additive이니 *명시적으로 연기*하라. 바닥을 출하하고, seal→settle 루프가 한 행을 영속시키는 걸 증명하고, *그 다음에* 쌓는다.

---

### 짓기용 파일 맵
- **변경** `argus-mcp/src/server.ts`(6도구 등록, 16 CRUD 폐기), `src/lib/ledger-replay.ts`(seal/settle self-create, `resolveToday`), `src/lib/layout.ts`(safeSegment+assertInside 전 헬퍼), `src/tools/session.ts`(쓰기 status 제거), `src/tools/receipt.ts`(`outcome`/`outcome_source`/`ai_verdict:null` 확장), `src/tools/config.ts`(정렬), `src/prompts/system-prompt.ts`(`buildMcpSpinePrompt` 위임)
- **신규** `src/lib/resolve-contract.ts`, `src/lib/state-machine.ts`, `src/lib/guard.ts`, `src/lib/overfire-gate.ts`, `src/lib/validate-seal.ts`, `src/lib/safe-path.ts`, `src/lib/spine.ts`, `src/prompts/discipline.ts`, `src/lib/render-receipt.ts`, `src/lib/__tests__/*`(7 스위트), `argus-mcp/evals/`, `SECURITY.md`/`CONTRIBUTING.md`/`LICENSE`
- **제거** 미사용 `ajv` 의존성

**하중 반전 한 줄:** *status는 저장 필드가 아니라 이벤트 로그의 투영이다* — 이 한 규칙이 `session_update` no-op을 고치고, 호출 순서와 무관하게 상태기계를 우회불가로 만들고, 결정 상태를 바꾸는 유일한 길을 "guard가 허용하는 단 하나의 이벤트를 append하는 것"으로 못박는다.
