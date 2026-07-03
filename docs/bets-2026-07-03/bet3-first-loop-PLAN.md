# 베팅③ 실행 계획서 — 첫 정산 대리 체험 (회고 봉인)

_2026-07-03 · 제안 3건 + 적대 판정 2건 종합 · 소스코드 미수정(설계도)_

---

## 0. 한 문장 요약 (창업자용)

> **신규 사용자가 "이미 결과를 아는 지난 결정" 하나로 봉인→정산 고리를 첫 세션 3분 안에
> 자기 데이터로 완주하게 한다.** 진짜 가치인 정산을 2~3주 안 기다리고 바로 맛보게 하는
> 게 목적. 단, 이건 "연습(회고)"이라고 3표면에 상시 표시하고, 이 연습 기록이 진짜 성적표를
> 부풀리지 못하게 완전히 격리한다.

**왜 이 안인가 (경쟁 3안 중):** 병목은 "47개 열림 / 0개 정산"이다. 사용자가 봉인은 해도
정산(제품의 진짜 moat)을 2~3주 기다려야 처음 본다. 회고 봉인은 그 대기를 접어 첫 세션에
정산을 경험시키는 **유일한** 안이다. 제안2·제안3 일부는 회고 봉인에 흡수하거나 병행하고,
나머지는 기각한다(§5).

---

## 1. 채택안 (kill 판정 반영, 조건은 스펙으로 내장)

### 1-A. 정본: 회고 봉인 온보딩 (제안1 채택)
지난 결정 하나를 지금 봉인하고 즉시 정산해 seal→settle 고리를 첫 세션에 닫는다.
- **진입점:** 워크스페이스 빈 상태(`projects.length === 0`)의 데모 시나리오 섹션 옆에 조용한
  카드 1개. 데모타일과 동급의 옵션이며 강제 아님(건너뛰고 새 결정으로 바로 가능 = 절제 기본값).
- **데모와 구별:** "데모(가짜 시나리오)가 아니라 당신의 진짜 지난 결정, 단지 이미 끝난 결정"임을
  카피로 명시.
- **3스텝 플로우:**
  1. 지난 결정 + 그때 내 판단을 한 줄로 적기 → `buildEarlyContract`의 `lean` 경로로
     `user_lean` predicate 봉인(`authored:'user'` — 진짜 자기 말, 가짜 소유권 아님).
  2. 어떻게 됐는지 한 문단 → 기존 `settle-align`(단발 alignment 에이전트) 재사용해 draft만
     **미리 강조**(non-binding, `verdict_via:'ai_draft'` 태깅). 사용자가 탭으로 최종 확정.
  3. 기존 `SettlementModal`로 발생/회피/부분 자기채점 + 판단 액자(그때 생각 ↔ 실제) 즉시 표시.

### 1-B. 병행: 짧은 확인일(3d) 조용한 부각 (제안2 안① 병행 채택)
대기가 **남는** 결정용. 회고 봉인과 독립. 봉인 시 이미 존재하는 `'3d'` 지평을 첫 봉인자에게
**순수 동등 옵션**으로 조용히 제시("내일/모레면 답 나올 작은 확인일 있으면 그걸로"). 강제·재촉
어휘 금지, 2주/1달 그대로 유지. 지평이 먼 결정은 인위적으로 자르지 않음(가짜 정산 방지).

### 채택에 내장된 필수 조건 (스펙 = 이것들이 빠지면 스파인 위반)
- **[C1·최대위험] 회고 격리:** `DecisionContract`에 `origin?: 'retro'` 플래그(jsonb-nested,
  마이그 0) 추가 → `summarizeRecord`(자차표 단일 집계원)에서 retro 제외. 미적용 시 회고 연습이
  `loops/betsHeld/risksAvoided`를 조용히 부풀림 = goalpost-guard 불변식 위반(규칙2).
- **[C2] 라벨 상시 노출:** 봉인증서·정산모달·판단액자 3표면 모두에 `연습 · 회고` 배지 상시
  (ai_surfaced 배지와 동일 shade). "이미 끝난 일을 되짚은 거예요 — 진짜 봉인은 결과를 모르는
  채로 거는 거고요" 카피. 회고임을 절대 숨기지 않음(정직 provenance, 규칙1).
- **[C3] 실전 온램프:** 회고 정산 완료 화면 끝에 텍스트 링크 1개만("이제 진짜 — 결과를 아직
  모르는 결정 하나 걸어볼까요?"). 버튼 승격·자동 네비 금지(절제, 규칙4).
- **[C4] 회상편향 방어:** 회고 정확도를 실력/예측력 신호로 절대 카운트 금지(회상편향은 태생적).
  회고만 한 사용자는 실제 record strip이 여전히 안 뜸(retro 제외 집계) — 대신 완료 화면에서만
  "연습 고리를 닫아봤어요 — 실제 기록은 진짜 봉인부터 쌓여요" 별도 안내로 빈 자차표가 배신처럼
  안 보이게.
- **[C5] draft는 non-binding:** 회고 정산도 기존 `SettlementModal`의 사용자-탭-확정 패턴 유지.
  settle-align은 미리 강조만, AI 평결을 결론으로 보여주지 않음.

---

## 2. 구현 항목 목록 (파일:줄 · 작업량 S/M/L)

> 검증 완료: 아래 seam은 실제 코드로 확인함(2026-07-03, 이 워크트리).

| # | 항목 | 파일:줄 | 작업 | 크기 |
|---|------|---------|------|------|
| 1 | `origin?: 'retro'` 필드 추가 | `src/stores/types.ts:607` `DecisionContract` 인터페이스 | 필드 1줄. jsonb-nested라 마이그 0, schema-drift 불변(단일 `decision_contract` 컬럼) | **S** |
| 2 | **[C1] 회고 격리 필터** | `src/lib/decision-contract.ts:636` `summarizeRecord` 루프 | `if (c.origin === 'retro') continue;` 1줄. **유일한 집계원**(project strip + SettlementModal 둘 다 이 함수를 읽음 → 한 곳만 고치면 됨) | **S** |
| 3 | 회고 봉인 진입 카드 | `src/app/[locale]/workspace/page.tsx:762` 데모 섹션 옆(빈 상태) | 데모타일과 동급 카드 1개 + 클릭 시 회고 플로우 상태 진입 | **M** |
| 4 | 회고 3스텝 플로우 컴포넌트 | 신규 `src/components/workspace/RetroSeal.tsx` (HeroFlow 내부 렌더, **새 라우트 금지**) | (1) lean 입력→`buildEarlyContract({lean})` (2) outcome 문단→`settle-align` 재사용 (3) `SettlementModal` 오픈. check_in_at=오늘/과거로 심어 `contractStatus.checkInDue=true` 즉발 | **L** |
| 5 | **[C2] `연습·회고` 배지** 3표면 | `SealMoment.tsx` · `SettlementModal.tsx` · 판단액자(SettlementModal 내 그때↔실제 블록) | `origin==='retro'`일 때 배지 렌더. ai_surfaced와 동일 shade | **M** |
| 6 | **[C3] 실전 온램프 링크** | 회고 완료 화면(RetroSeal 종료 or SettlementModal 종료 콜백) | 텍스트 링크 1개 → 새 결정 진입(`setCurrentProjectId(null)`) | **S** |
| 7 | **[C4] 빈 자차표 안내 카피** | `src/app/[locale]/project/page.tsx:500` (`loops===0` 블록) | retro만 있는 사용자용 별도 안내 문구 | **S** |
| 8 | **[1-B] 3d 동등 옵션 부각** | `BindCard`/`SealMoment`의 CheckInInterval 선택 UI | 첫 봉인자에게 `'3d'`(types.ts:596 실재) 조용히 노출. 순수 동등 옵션, 재촉 어휘 0 | **M** |
| 9 | **[C1 가드] retro-격리 테스트** | 신규 `src/lib/__tests__/retro-isolation.test.ts` | `summarizeRecord`가 `origin:'retro'` 계약을 loops에 안 넣는지 + 3표면 배지 커버리지(enum-literal-copy 류) | **M** |
| 10 | **[활성화 계측]** retro→실봉인 전환 이벤트 | `signal-recorder`/`user_events` 경로 | `retro_settled`, `first_real_seal_after_retro` 이벤트 track. 없으면 "3분 완주=병목 해소"는 검증 불가 주장으로 남음 | **M** |
| 11 | Persistence 선언 | `src/lib/__tests__/persistence-contract.test.ts` | `origin`은 `decision_contract` jsonb 안에 실림 → 이미 synced 계약의 일부. 명시 declaration 1줄 | **S** |

**작업 총량:** S×6, M×5, L×1. 마이그레이션 **0건**(전부 기존 jsonb 필드 확장).

---

## 3. 검증 방법

1. **로컬 즉발 확인(가장 중요):** 워크스페이스 빈 상태 → 회고 카드 → 3스텝 → **같은 세션에서
   `SettlementModal`이 실제로 열리고 판단 액자가 뜨는지**. (`check_in_at`을 오늘로 심으면
   `contractStatus.checkInDue=true`가 로컬 자정 기준으로 즉시 참 — 코드 확인됨, line 517.)
2. **격리 검증(C1):** 회고 1건 정산 후 `/project`의 record strip이 **여전히 안 뜨는지**
   (`crossRecord.loops===0` 유지). retro 제외가 실제로 작동하는지 = §2-#9 테스트 + 수동 1회.
3. **라벨 커버리지(C2):** 봉인증서·정산모달·판단액자 3곳 전부에 `연습·회고` 배지가 뜨는지
   스크린샷 or preview_eval.
4. **온램프 강도(C3) — 창업자 dogfood 1회:** 회고 1건 → 온램프 링크 → **실제 봉인 1건까지**
   본인이 완주. "회고가 리허설로 끝나는지, 진짜 전환이 일어나는지"를 눈으로 확인.
5. **전환 계측(활성화):** §2-#10 이벤트가 실제로 기록되는지 실DB 행수 1줄 확인
   (UI 멀쩡함 ≠ 데이터 도착 — CLAUDE.md Persistence Declaration).
6. **회귀:** `tsc` 0, retro-격리 테스트 통과, 기존 봉인/정산 플로우 무변.

---

## 4. 스파인 위험표 (채택 조건 명시)

| 위험 | 어떤 규칙 위반 | 완화(=채택 조건) | 상태 |
|------|---------------|------------------|------|
| **calibration 오염** (회고가 진짜 성적표를 부풀림) | 규칙2(사용자에 대한 평결) | `origin:'retro'` + `summarizeRecord` 제외 필터 **필수**. 가드 테스트로 강제 | **C1 (P0)** |
| **가짜 소유권** (AI 심은 문장이 user 필드 상속) | 규칙1(정직한 authorship) | lean은 `authored:'user'`(진짜 자기 말). settle-align draft는 `verdict_via:'ai_draft'` 태깅 + 사용자 탭 확정 | C5 |
| **AI 평결을 결론으로 노출** | 규칙2 | settle-align은 미리 강조만, 자기채점(발생/회피/부분)이 최종 | C5 |
| **강제 게이트** (연습부터 하라고 조름) | 규칙4(절제) | 카드는 데모 동급 옵션 1개, 건너뛰기·새 결정 상시 | C3 |
| **회상편향을 실력으로 착각** | 규칙2 | 회고 정확도 카운트 금지, record strip에서 제외 | C4 |
| **3d 재촉이 가짜 정산 유발** (먼 지평 인위 절단) | 규칙4(거울 조항·과잉발화) | 순수 동등 옵션, 재촉 어휘 0, fire-or-not 게이트 먼저 | 1-B |
| **빈 자차표 배신감** | UX/정직 | retro만 한 사용자엔 별도 안내 카피 | C4 |

---

## 5. 기각 목록 (kill 판정 반영)

| 기각 항목 | 출처 | 기각 사유 |
|-----------|------|-----------|
| **타인의 정산 사례 관찰** | 제안2 안③ | 실DB 정산 경험자 **1명** → 표본 극소·바넘·선택편향, 프라이버시 최고위험. 두 판정 모두 KILL/DEFER. 창업자 dogfood로 사례가 쌓이기 전엔 근거 0 |
| **데모에 별도 샘플 계약 시드** | 제안3 별도 시드 경로 | 회고 봉인의 **열등 버전**. 제안3은 AI가 심은 샘플이라 가짜 소유권(규칙1) 위험 ↑, 시간 간극(then↔now) 없어 감정 무게 약함. 회고는 사용자의 **진짜** 지난 결정을 써서 더 정직·강력. 중복 → 흡수 |
| **생각↔생각 되읽기(human_judgment 재노출)** | 제안2 안② | 효과가 "대기가 덜 비어 보임"(간접)뿐, 정산 자체를 당기지 않음. 반복 푸시 시 거울조항 위반 리스크. 회고 봉인이 상위 목표를 직접 달성 → 이번 스코프 제외(추후 별건) |

**제안3의 흡수분(중복 아님):** 데모 격리·`FRESH_INTENT_PARAMS` 등록·record 오염 배제 =
회고 봉인 구현에 그대로 반영. (단, 회고 진입은 데모 파라미터 불필요 — 빈 상태 카드로 진입.
만약 `?demo=settle` 같은 URL 진입을 추가한다면 `workspace/page.tsx:55`의
`FRESH_INTENT_PARAMS` 배열에 **반드시** 등록 — 싱글톤 가로채기 방지.)

---

## 6. 창업자 버튼 (자율 실행이 못 하는 것)

자율 구현이 **끝낼 수 없고 창업자가 직접 해야** 하는 것:

1. **dogfood 1회 (검증 §4-#4):** 회고 1건 → 온램프 → 실제 봉인 1건까지 **본인이 완주**해
   "자각/전환이 실제로 오는지" 확인. 이게 "3분 완주=병목 해소" 주장의 유일한 실증. 코드가
   대신 못 함.
2. **카피 톤 최종 결정:** `연습·회고` 배지 문구, 온램프 링크 문구, 데모-vs-진짜 구별 카피의
   최종 어투는 창업자 목소리. 초안은 제공하나 확정은 창업자.
3. **활성화 지표 판독:** `retro_settled→first_real_seal` 전환율을 실DB에서 며칠 뒤 읽어
   "회고가 종착역인지 온램프인지" 판정. 데이터 도착 후 창업자가 봐야 함.
4. **커뮤니티 공개/실발송 여부:** 이 온보딩을 랜딩/공지에 노출할지, 실사용자에게 밀지는
   외부 공개 결정 → 창업자 버튼.

---

## 부록: 검증된 코드 사실 (2026-07-03)

- `buildEarlyContract`/`withCheckIn` (`decision-contract.ts:325,353`) = 어떤 날짜든 받음
  (과거·오늘 포함). lean → `user_lean` predicate `authored:'user'` (line 365).
- `contractStatus.checkInDue` (`decision-contract.ts:517`) = 로컬 자정 기준, 과거·오늘 즉시 due.
- `summarizeRecord` (`decision-contract.ts:631`) = **origin 필터 전무**, `allGraded`만 보고
  `loops++`. 자차표의 **유일** 집계원(project/page.tsx:383 strip + SettlementModal:157 둘 다 사용).
- `DecisionContract` (`types.ts:607`) = `origin` 필드 **없음**. `decision_contract`는 단일 jsonb
  컬럼(schema-drift.test:31) → 중첩 필드는 마이그·schema-drift 변경 불필요.
- `settle-align` (`settle-align.ts`) = 단발, non-binding, `verdict_via:'ai_draft'` 태깅 실재.
- `SettlementModal` 즉발 = `/project`의 `settleDueNow`(page.tsx:110)가 `checkInDue`로 자동 오픈.
- `InteractiveDemo.tsx` = seal/settle **0건**(grep) → 데모가 moat 미노출 확인.
- `FRESH_INTENT_PARAMS` (`workspace/page.tsx:55`) = 명명 상수 `['q','demo','reviewer']`,
  새 진입 파라미터는 여기 등록.
- `CheckInInterval` `'3d'` (`types.ts:596`) 실재 = 1-B 근거.
