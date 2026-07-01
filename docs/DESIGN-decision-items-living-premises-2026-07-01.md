# DESIGN — Decision Items & Living Premises

- 날짜: 2026-07-01
- 상태: 설계 확정본 (구현 전). Phase 1부터 순차 구현.
- 관련 메모리/문서: `living-premises-recheck`, `verify-reality-grounding-gate-2026-06-29`,
  `eta-ata-voyage-arrival`, `share-hub-architecture`, `dalio-authorship-patterns-fix`,
  `docs/ARCH-webapp-plugin-parity-2026-06-17.md`, `docs/FRAMEWORK-decision-navigation.md`

---

## 0. 한 줄 요약

결정을 **하나의 결론**이 아니라 **유형이 다른 항목(item)들의 목록**으로 분해하고 —
각 항목(전제·현상·결론·미결·예측)을 **독립적으로 편집·추적·알림**한다.
AI가 뽑은 항목을 사용자가 고치는 행위 자체를 **1급 신호**로 기록하고,
external 전제는 봉인 이후에도 **현실 변화를 재확인**해서 필요할 때만 사용자를 되부른다.
웹앱과 플러그인(MCP)이 **두뇌(lib) 하나를 공유**하고 표현만 다르게 구현한다.

---

## 1. 배경 — 왜 이걸 짓나

### 1.1 판단 도구가 반드시 갖출 것 (세 적 프레임)

판단 도구의 유일한 일 = **calibration 루프를 닫는 것**(예측→현실→갱신).
이를 막는 세 적이 있고, 필수 요건은 각 적에 대한 방어다.

| 적 | 방어 요건 | Argus 현재 |
|---|---|---|
| **후견지명 편향** (기억이 거짓말함) | 결과 전 예측 못박기 / 강제 재회 / 정직한 원장 | 못박기·원장 🟢 / **재회는 결과·날짜에만 🟡** |
| **조급함·콜드스타트** (보상이 늦음) | 장기 아키텍처 / 1일차 가치 / 마찰 스위트스폿 | 아키텍처 🟢 / 나머지 🟡 |
| **아웃소싱 욕구** (답이 유혹적) | 현실이 심판 / 저작권은 사용자 / 자제 | 전부 🟢 (2026-07-01 patterns·principles 수정으로 강화) |

메타 요건: **불리한 진실을 말하는 정직**(`calibration-disclosure`, 정산 3건 전 정확도 렌더 금지) 🟢.
북극성: **의존이 아니라 독립을 최적화** — 설계는 거울 쪽이나 이를 재는 계기 없음 ⚪.

### 1.2 이 설계가 때리는 구멍

감사 결과 가장 큰 구멍 두 개:

1. **재회가 결과에만 있고 전제엔 없다.** `check-contracts.js`(SessionStart 훅)는
   sealed contract의 `check_by` **날짜로만** 울린다. 봉인~정산 사이에 결정의 전제가
   된 사실이 바뀌어도 아무 일도 일어나지 않는다. (적 1·2를 동시에 때리는 구멍.)
2. **AI 추출물 편집이 "사이드"다.** AI가 뽑은 전제·결론이 과해석이거나 출발점이
   달랐던 경우가 잦은데, 지금은 편집이 예외 동작이라 사고 과정이 자산으로 추적되지 않는다.

### 1.3 이 설계의 두 지향

- **살아있는 전제** — 결정의 전제·현상·미결을 봉인 후에도 추적하는 살아있는 객체로.
- **추적되는 사고 과정** — AI가 뽑은 항목을 고치거나 따라가는 각 선택을 전부 기록해
  적극적 자산으로 쓴다. **AI를 뒤엎는 것은 특히 강한 신호다.**

---

## 2. 카피 규칙 (제품 전체 불변식)

> **비유 동사 금지. 직설·문자 그대로.**

한 번 더 해석하게 만드는 표현은 불필요한 인지 비용을 만든다. 예:

| 금지 (비유) | 사용 (직설) |
|---|---|
| "이 결정이 딛고 선 사실 하나는?" | "이 결정의 핵심 전제 (사실 1개):" |
| "전제 맥박" / "밧줄을 묶다" | "전제 변화 알림" / "전제 재확인" |
| "땅이 흔들렸다" | "전제가 된 사실이 바뀜" |

이 규칙은 이 문서의 모든 예시 카피와 향후 구현 카피에 적용한다.
(CLAUDE.md의 landing-films 카피 정책과 별개인, 기능 카피 규칙.)

---

## 3. 핵심 모델 — 결정 = 추적되는 항목 목록

### 3.1 항목 유형 (세분화)

| type | 뜻 | external? (현실이 검증 가능) |
|---|---|---|
| `premise` 전제 | 결정이 기반한 사실/믿음 | 자주 예 → web 감시 대상 |
| `phenomenon` 현상 | 결정 시점에 관찰된 사실 | 예 |
| `conclusion` 결론 | 내린 판단 | 정산 시 |
| `open_question` 미결 | 당시 못 정한 것 | — (재고 대상) |
| `prediction` 예측 | 반증가능한 예측 = **기존 predicate** | 정산 시 |

**중요 — 재발명이 아니다.** `prediction`은 이미 있는 `Predicate`
(`src/lib/decision-contract.ts`)와 동일 개념이다. 기존 seal→settle 루프는 `prediction`
항목 위에서 그대로 돈다. `premise`/`phenomenon`/`open_question`이 "살아있는 전제" 층을
**추가**할 뿐이다.

### 3.2 데이터 스키마 (양 surface 공유)

```ts
// src/lib/decision-items.ts (신규, 공유 두뇌)
export type ItemType =
  | 'premise' | 'phenomenon' | 'conclusion' | 'open_question' | 'prediction';

export type EditAction =
  | 'accept'   // AI 항목 그대로 둠 (침묵=동의; 명시 확인 시에만 기록)
  | 'refine'   // 방향은 맞고 범위/표현 수정
  | 'replace'  // 내용을 갈아엎음
  | 'reject'   // 삭제/거부
  | 'add'      // 사용자가 새 항목 추가
  | 'split';   // 한 항목을 둘로 쪼갬

export interface EditEvent {
  at: string;              // ISO
  action: EditAction;
  from: string;            // 편집 전 텍스트 ('' for add)
  to: string;              // 편집 후 텍스트 ('' for reject)
  ai_original?: string;    // AI가 최초 추출한 원문 (source==='ai'일 때 보존)
  note?: string;           // 선택: 왜 바꿨는지 (강제 아님 — 마찰 최소화)
}

export type AlertMode = 'off' | 'on_change' | 'weekly' | 'monthly';

export interface ItemAlert {
  mode: AlertMode;         // 기본 'off'
  last_checked?: string;   // 마지막 web 재확인 시각
  last_value?: string;     // 마지막으로 확인된 사실 요약 (drift 비교 기준)
}

export interface DecisionItem {
  id: string;              // 안정 id (djb2, decision-contract.ts stablePredicateId 재사용)
  decision_id: string;     // 소속 결정(project/session)
  type: ItemType;
  text: string;            // 현재 텍스트
  source: 'ai' | 'user';   // 최초 생성자
  authored: 'ai' | 'user' | 'ai_edited_by_user';  // 현재 소유권
  edits: EditEvent[];      // 전체 편집 이력 (append-only)
  external: boolean;       // 현실이 검증 가능한가 (web 감시 자격)
  load_bearing: boolean;   // 사용자가 '중요'로 표시
  alert: ItemAlert;
  status: 'active' | 'resolved' | 'retired';
  created_at: string;
}
```

### 3.3 불변식

- **편집 이력은 append-only.** 텍스트를 덮어써도 `edits[]`에 이전 값을 남긴다
  (원장 amend 패턴 — 변경도 기록이다).
- **`ai_original`은 절대 잃지 않는다.** 3.4의 신호가 여기에 의존한다.
- **`prediction` 항목은 계약과 이중 저장하지 않는다.** contract.predicates가 단일
  소스이고, item 뷰는 그 위의 표현이다(또는 예측 항목만 contract를 참조). 구현 시
  중복 저장 금지(스키마 sync 위반 방지).

---

## 4. AI 추출물 편집 = 1급 신호

지금 편집이 사이드인 이유는 **편집이 예외 동작**이기 때문. 기본 자세를 바꾼다:

> **"AI가 이렇게 뽑았어요. 틀린 건 바로 고치세요."**
> 편집이 기대되는 기본 행동이고, 안 고치는 것이 명시적 동의다.

### 4.1 세 행동 다 기록

| 사용자 행동 | action | 신호 강도 | 의미 |
|---|---|---|---|
| 그대로 둠 | `accept` | 약 | AI 출발점이 맞았음 |
| 다듬음 | `refine` | 중 | 방향 OK, 범위/표현 어긋남 |
| 갈아엎음/삭제 | `replace`/`reject` | **강** | AI 출발점 자체가 틀림 |

### 4.2 신호의 세 가지 용도

1. **엔진 보정.** `reject`/`replace`가 잦은 추출 유형 → 프롬프트가 이 사용자에게
   과해석 중이라는 신호. (patterns의 "아니에요가 도구를 보정한다"와 동일 원리.)
2. **왜 그렇게 했는지 추론.** `ai_original → to`의 **차이(delta)** 자체가 분석 대상.
   여러 결정에 걸쳐 델타의 방향성(예: "AI의 넓은 전제를 반복적으로 좁힘")을 뽑을 수 있다.
3. **정산 해상도 상승.** 결과가 나오면 "예측이 맞았나"를 넘어 **"어느 전제가 결과를
   만들었나"**까지 귀속. ("결정은 맞았는데 이유가 된 전제는 틀렸다" — 달리오식 학습.)

### 4.3 스파인 (2026-07-01 patterns 수정과 일관)

편집 신호는 **엔진 보정 + 비준 가능한 관찰**로만 쓴다. **사용자 판정으로 바꾸지 않는다.**

- ❌ "당신은 범위를 좁게 보는 사람" (판정 — 금지)
- ✅ "AI 전제를 8번 중 6번 더 좁게 고쳤어요. 이거 맞아요?" → 맞으면 `authored:user`
  원칙으로 `/argus:principles`에 기록

---

## 5. 항목별 알림 on/off

### 5.1 모드와 기본값 (opt-in 아니라 opt-out)

**설계 원칙:** 대부분 사용자는 설정을 안 건드린다. 되부름은 이 도구의 가장 약한
축이므로, 가치 있는 동작을 off-by-default 뒤에 두면 루프가 시작도 안 된다.
**기본값이 곧 제품.** 그래서 기본은 적당히 켜두고, 토글의 주된 역할은 *끄는 것*이다.

| mode | 동작 | 기본으로 켜지는 항목 |
|---|---|---|
| `off` | 감시 안 함 | 나머지 전제·현상 (필요하면 사용자가 켬) |
| `on_change` | 주기적 web 재확인, **바뀌었을 때만 알림** | **핵심(load_bearing) external 전제 — 결정당 1–2개** |
| `weekly` / `monthly` | 정해진 주기로 재고 유도 | 사용자가 켤 때만 |

추가로 **확인일(정산) 알림은 항상 on** — 사용자가 스스로 잡은 약속이고 핵심 루프다
(기존 `check-contracts.js`).

정리:

| 항목 | 기본 알림 |
|---|---|
| 확인일(정산) | 항상 on |
| 핵심 전제 (external, 결정당 1–2개) | on_change (기본 켬) |
| 나머지 전제·현상 | off |

### 5.2 잔소리 방지 — 정적 보수값이 아니라 높은 문턱 + 적응형 후퇴

핵심 구분: **감시를 켜는 것 ≠ 과잉 발화.** 과잉 발화는 납작한 결정에 억지 분기를
만드는 것이지 전제를 지켜보는 것이 아니다. 전제가 실제로 바뀌었을 때 알리는 것은
억지가 아니라 진짜 신호다. 그러므로 감시는 켜두되 **알림 문턱만 높게** 둔다.

- **문턱 높게** — 전제가 *실제로* 바뀔 때만 발화. drift 판정은 기계적으로
  (공유 `premise-drift.ts`), 발화 여부는 LLM 재량이 아니다.
- **빈도 상한** — 결정당 전제 알림은 일정 기간 최대 1건. 스트림이 아니라 묶음(digest).
- **적응형 후퇴** — 사용자가 전제 알림을 N번 무시/끄면 그 항목(또는 그 사용자)의
  알림이 자동으로 조용해진다. "off로 시작"하는 대신 **도움되게 시작하고 귀찮으면
  스스로 물러난다.** (mute를 행동에서 학습.)
- SessionStart의 침묵-기본, helm의 "하중+비가역에만 발화"는 *발화 문턱* 차원에서
  계승한다 — 감시 스위치를 끄는 방식이 아니라.

### 5.3 UI (쉬운 조작이 요구사항)

- **웹앱**: 항목 행 우측에 종 토글 + 주기 드롭다운. 클릭 한 번.
- **플러그인**: `/argus:track`(신규)이 항목을 `[알림 켬]/[끔]`으로 나열, id로 토글.

---

## 6. 봉인~정산 사이 — 전제 재확인 (살아있는 전제)

### 6.1 흐름

1. 봉인 시 external 전제를 등록(§7 봉인 카피).
2. `on_change`인 전제에 대해, 주기적으로(웹: edge function 스케줄 / 플러그인:
   `/argus:track` 실행 또는 SessionStart 훅) 공유 `premise-drift.ts`가 web 재확인.
3. `last_value`와 비교해 **의미 있는 변화가 있을 때만** 사용자를 되부른다.
4. 변화 없으면 **침묵.**

### 6.2 verify 재사용

external/internal 구분은 verify의 reality-grounding 게이트를 그대로 쓴다
(`verify-reality-grounding-gate-2026-06-29`): **external = 현실이 무효화 가능 =
web 감시 대상.** internal(AI 확인용) 전제는 감시하지 않는다.

### 6.3 미결(open_question) 재고

- 봉인 때 미결로 남긴 항목을, 가끔(주기 opt-in) **예시 선택지와 함께** 재고 유도.
- 판정 아닌 질문/선택지로만. (§7 미결 재고 카피.)

---

## 7. 직설 카피 예시 (양 surface 공통 문구)

**봉인 — 전제 등록:**
```
이 결정의 핵심 전제 (사실 1개): 금리가 올해 동결된다
└ 이 사실을 자동으로 재확인할까요?  [끔]  [바뀌면 알림]  [매달]
```

**AI 추출 후 편집 유도:**
```
AI가 뽑은 전제·현상입니다. 틀린 건 고치세요.
· [전제] 통근 40분 이내 유지        수정  삭제
· [현상] 동탄 신규 공급 3년간 많음   수정  삭제
· [미결] 전세 끼고 vs 실거주         지금 정할래요  나중에
```

**전제 변화 알림 (허브/터미널):**
```
전제가 된 사실이 바뀜: '금리 동결' → 오늘 0.25%p 인상.
[결정 다시 보기]  [전제 수정]  [이 알림 끄기]
```

**미결 재고 (예시 함께):**
```
동탄 결정에서 못 정한 것: 전세 끼고 vs 실거주.
지금 다시 본다면 —
  A: 전세 끼고 (현금 여력↑, 실입주 지연)
  B: 실거주   (즉시 거주, 현금 부담)
기울어요?
```

---

## 8. 아키텍처 — 웹앱 + MCP(플러그인)

CLAUDE.md single-source: **두뇌(lib) 하나 공유, 표현만 분리.**

```
                 ┌─────────────────────────────┐
                 │  공유 두뇌 (src/lib)          │
                 │  - decision-items.ts (스키마) │
                 │  - item-extract-core.ts (추출)│  ← reframe-core처럼 웹·봇 공유
                 │  - premise-drift.ts (재확인)   │
                 └───────────┬─────────────────┘
            ┌────────────────┴────────────────┐
   ┌────────▼─────────┐              ┌─────────▼──────────┐
   │  웹앱 (React)     │              │  플러그인 (SKILL.md)│
   │  - 항목 카드 편집  │              │  - clarify 추출     │
   │  - 종 토글/주기    │              │  - /argus:track     │
   │  - 편집이력 표시   │              │  - check-contracts 확장│
   │  → db.ts→Supabase │              │  → .argus/ 파일     │
   └────────┬─────────┘              └─────────┬──────────┘
            └────────── 공유 허브 sync ──────────┘
             (connect/push/pull/sync, 이미 라이브)
```

| 관심사 | 웹앱 | 플러그인(MCP) |
|---|---|---|
| 항목 편집 | 인라인 편집 (칩/행 클릭) — "쉬운 편집"의 핵심 | `/argus:track`에서 id로 편집, 또는 AskUserQuestion |
| 항목별 알림 토글 | 종 아이콘 + 주기 | `/argus:track` 토글 |
| 알림 전달 | 공유 허브 (이메일·텔레그램·푸시, 라이브) | SessionStart 훅 + `/argus:track` |
| 저장 | Supabase (db.ts sanitizeItem) | `.argus/ledger` + `.argus/items.jsonl` |
| web 재확인 | edge function | 스킬이 WebSearch 실행 |

### 8.1 기존 구조에 맞물리는 지점 (재발명 아님)

- `prediction` 항목 = 기존 predicate → seal/settle 그대로.
- external 전제 재확인 = verify의 internal/external 분리 재사용.
- 알림 전달 = 이미 라이브인 공유 허브(`share-hub-architecture`).
- 편집이력 저장 = 원장 append-only amend 패턴.

---

## 9. 구현 시 지켜야 할 기존 불변식 (CLAUDE.md)

1. **"필드 추가" 체크리스트 7단계** — `DecisionItem`을 `stores/types.ts`에 추가하면
   스토어 생성자·기본값·**Supabase 마이그레이션**·모든 관련 프롬프트·UI·핸드오프까지.
2. **Schema Sync** — 새 컬럼/테이블을 `apply_migration` + `schema-drift.test`의
   `TABLE_COLUMNS` 갱신(안 하면 PGRST204로 행 전체가 조용히 거부됨).
3. **Persistence Declaration** — 새 storage key를 `STORAGE_KEYS` +
   `persistence-contract.test`에 synced/localOnly로 등록.
4. **Single Source of Truth for Prompts** — 추출 프롬프트는 `item-extract-core.ts`
   하나. 웹·봇·플러그인이 참조(reframe-core 패턴). 복붙 금지.
5. **Defensive Data Access** — 모든 item 읽기에 optional chaining + fallback
   (`item.edits || []`, `item.alert?.mode ?? 'off'`).
6. **Zero-Judgment** — §4.3. 편집 신호는 엔진 보정·비준 관찰까지만. 판정 금지.
7. **자제(mirror clause)** — §5.2. 감시는 적당히 켜두되(핵심 전제 on_change), 발화
   문턱을 높게 + 적응형 후퇴. 자제는 "스위치 off"가 아니라 "발화 문턱"으로 지킨다.

---

## 10. 구현 단계 (의존 순서)

### Phase 1 — 스키마 + 공유 추출 + 편집 이력 (토대)
- `src/lib/decision-items.ts` (스키마, id, 불변식 헬퍼).
- `src/lib/item-extract-core.ts` (공유 추출 프롬프트 — clarify/webapp 공용).
- Supabase 테이블/컬럼 + 마이그레이션 + schema-drift 갱신.
- 편집 이력 기록(`recordEdit`)과 override 신호 집계(`summarizeOverrides`).
- **이유:** Phase 2·3이 전부 이 위에 올라간다.

### Phase 2 — 편집 UI를 1급으로
- 웹앱: 결정 후 **항목 편집 뷰가 주(主) 화면**. 인라인 편집·삭제·추가.
- 플러그인: `/argus:track` — 항목 목록·편집.
- override 신호 → `/argus:principles`/patterns로 비준 흐름 연결.

### Phase 3 — 살아있는 전제 알림
- 항목별 알림 on/off UI(웹 종 토글 / 플러그인 토글).
- `src/lib/premise-drift.ts` (web 재확인 + drift 판정, 기계적).
- 전달: 웹 edge function 스케줄 + 허브 / 플러그인 SessionStart 훅 확장.
- 미결 재고(예시 함께) 인터랙션.

---

## 11. 열린 질문 (구현 중 결정)

- **drift 판정 임계** — "의미 있는 변화"를 어떻게 기계적으로 정의? (수치 전제 vs
  서술 전제.) 초안: 수치는 방향+크기 임계, 서술은 LLM이 요약하되 발화 여부는
  규칙(전/후 요약 상충 시에만).
- **재확인 비용** — external 전제마다 주기적 web 검색은 비용. 게이트: load_bearing +
  사용자가 명시적으로 켠 것만.
- **북극성 계기** — "사용자가 더 독립적이 됐나"를 무엇으로 재나? (예: 시간이 지나며
  AI 추출을 덜 고치게 되는가 = 프레이밍 수렴. 별도 설계 필요.)
- **prediction/premise 이중 저장 회피** — 최종적으로 contract.predicates와 items를
  어떻게 하나의 소스로 둘지(뷰 vs 참조) 구현 시 확정.
```
