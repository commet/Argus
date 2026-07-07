# ProgressiveFlow · Post-Finalize Iteration Loop 설계

**작성**: 2026-04-14
**맥락**: 사용자가 요청한 "기획안 버전 관리"를 RefineStep(legacy 4R 경로)에 구현했으나, 실제 사용자가 만나는 기본 경로는 **ProgressiveFlow**임을 확인. 이 문서는 ProgressiveFlow에 맞춘 **새로운** 설계. force-fit 없음.

---

## 1 · 발견 요약

### 1.1 구조적 gap
- 사용자 기본 경로 = `HeroFlow → ProgressiveFlow` (데모와 같은 에이전트 팀 스택).
- RefineStep (legacy) = `?step=refine` URL로만 접근. 내가 추가한 버전 트리는 이쪽에만 붙음.
- ProgressiveFlow에는 "반복 루프"라는 개념 자체가 **없음**. 한 번 `complete` 도달하면 최종 문서 하나 생성하고 끝.

### 1.2 실제 agent 로스터 (18명, `src/lib/agent-registry.ts`)
내 시뮬에서 썼던 CTO/CFO는 placeholder였음. 실제 팀:

| 그룹 | 멤버 |
|---|---|
| 리서치 체인 | 하윤 · 다은 · 도윤 |
| 전략 체인 | 정민 · 현우 · 승현 |
| 실행 (독립) | 서연(카피) · 규민(숫자) · **혜연(재무)** · 민서(마케팅) · 수진(조직) · **준서(기술)** · 예린(PM) |
| 검증 | **동혁(Critic)** · 지은(UX) · 윤석(법률) |
| 특수 | **악장 (Concertmaster)** |

### 1.3 Persona vs Agent
- **Persona** (`usePersonaStore`): 사용자가 정의하는 의사결정자 프로필 (보스/스테이크홀더)
- **Agent** (`useAgentStore`): 18명 고정 실행 주체
- **Worker**: 한 번의 작업 단위. `runWorkerTask(task, agent)` 형태로 agent가 worker를 실행

### 1.4 ProgressiveFlow pipeline 특성
- `runMix / runDMFeedback / runFinalDeliverable / runDeepening` 전부 **순수 함수**. store 수정 없음, 호출자가 결과 기록.
- → **임의 단계를 자유롭게 재호출 가능**.
- `complete` 는 terminal 아님. 유일한 기존 재실행 경로: **"이해관계자 검증 다시 하기"** 버튼 (`ProgressiveFlow.tsx:1624`) → mix 유지, dmFb+final 초기화, `dm_feedback` 로 역이동.
- `session.final_deliverable` (string) 과 `session.final_mix` (MixResult) 는 **단일 값**. 덮어쓰면 이전 버전 소실. drafts 배열 없음.

---

## 2 · 설계 철학

### 2.1 "iteration" 의 의미 — 5 층위

| 층위 | 의미 | LLM 호출 | 비용 |
|---|---|---|---|
| L0 | directive 기반 악장 재편집 | 1회 | $ |
| L1 | concerns 재토글 + final 재생성 | 1회 (`runFinalDeliverable`) | $ |
| L2 | DM 재리뷰 → 새 final | 2회 | $$ |
| L3 | mix 재합성 + DM 재리뷰 + final | 3회 | $$$ |
| L4 | worker 재실행 + 전체 파이프라인 | N+3회 | $$$$ |

### 2.2 MVP는 L0 에 집중
사용자 원래 요청은 **"GPT처럼 대화형 수정"** 에 가까움:
> "사람들 gpt 쓸 때도 이전에 작성했던 내용 돌아가서 참고하기도 하잖아"

L0 = 사용자가 directive 적음 → **악장(Concertmaster)** 한 명이 현재 draft + directive + 문제 맥락을 받아 revised draft 반환.

**L0을 고른 이유**:
1. 의미론적 적합 — 악장은 "종합 검토자 / 최종 편집자"
2. 사용자 멘탈 모델 일치 — directive 하나 던지고 새 버전
3. 비용 저렴 — LLM 1회
4. 실제 agent system 사용 — 악장 노드 활용
5. 기존 "이해관계자 검증 다시 하기" 와 겹치지 않음

L1~L4는 향후 확장 여지. MVP는 L0 단일 경로.

### 2.3 부수 개선: 기존 버튼도 draft 로 보존
"이해관계자 검증 다시 하기" 는 지금은 덮어쓰기. 새 설계에선 이것도 **자동으로 새 draft 로 쌓임** (L2 성격). 공짜로 versioned 되는 셈.

---

## 3 · 데이터 모델

`ProgressiveSession` 에 신규 optional 필드 (backward-compat):

```ts
interface ProgressiveSession {
  // ... 기존 필드 전부 유지
  drafts?: Draft[]
  active_draft_id?: string | null
  released_draft_id?: string | null  // v1.0 승격된 draft
}

interface Draft {
  id: string
  parent_draft_id: string | null      // null = 초기 complete 결과
  version_label: string                // "v0.1" / "v0.1.1" / "v1.0"
  change_summary: string               // 한 줄 요약 (40자 이내)
  directive: string | null             // 사용자 수정 요청 (초기는 null)
  final_text: string                   // markdown
  final_mix?: MixResult                // attribution 표시용 (선택)
  reviewing_agent_id: string | null    // null=초기 / 'concertmaster'=수정본 / 'dm_reroll'=DM 재검증
  created_at: string
}
```

**DB 변경 0건** — JSONB 내부 확장.
**마이그레이션 0건** — sanitizeItem 같은 건 필요 없음. drafts는 실제 persist 대상.

---

## 4 · 기존 session 마이그레이션

`useProgressiveStore.loadSessions` 내부에서 자동:

```ts
function migrateSession(s: ProgressiveSession): ProgressiveSession {
  if (s.drafts) return s
  if (!s.final_deliverable) return s  // 아직 complete 안 됨
  const initialDraft: Draft = {
    id: `legacy-${s.id}-0`,  // deterministic
    parent_draft_id: null,
    version_label: 'v0.1',
    change_summary: '첫 초안 (에이전트 팀 분석 기반)',
    directive: null,
    final_text: s.final_deliverable,
    final_mix: s.final_mix,
    reviewing_agent_id: null,
    created_at: s.updated_at ?? new Date().toISOString(),
  }
  return { ...s, drafts: [initialDraft], active_draft_id: initialDraft.id }
}
```

Deterministic id → 재로드 안전.

---

## 5 · 악장 수정 LLM 호출 (신규)

`src/lib/progressive-engine.ts` 에 추가:

```ts
export async function runConcertmasterRevision(params: {
  currentFinalText: string
  directive: string
  problemContext: string
  priorDrafts?: Array<{ version_label: string; change_summary: string }>
  signal?: AbortSignal
}): Promise<{ revised_text: string; change_summary: string }>
```

**시스템 프롬프트 개요**:
> 당신은 악장(Concertmaster)입니다. 이미 완성된 기획안을 사용자의 수정 요청에 맞춰 편집합니다.
>
> 원칙:
> - 원본 구조 유지, 지시된 부분만 정확히 변경
> - 문체/톤 일관성 유지
> - 사실 보존 (숫자, 고유명사)
> - 의도의 변화는 명시적으로만
>
> 반환 JSON: `{ revised_text, change_summary }` (change_summary는 40자 이내)

LLM 1회. 저렴.

---

## 6 · Phase 전이

`session.phase` 에 신규 값 추가: `'iterating'`

```
complete → (사용자 "악장에게 수정 요청") → iterating → (완료) → complete
                                                      ↓ (실패)
                                                      complete (draft 기록 X, 에러 표시)
```

iterating 동안 UI: 스피너 + 사용자 directive + "악장이 편집 중..." 스트림 프리뷰. 중단 버튼 포함.

---

## 7 · UI 통합

### 7.1 Complete phase 상단 (`FinalCard` 위)

```
┌─────────────────────────────────────┐
│ 📜 v0.1 · 1개 버전   [히스토리]     │  ← 신규
├─────────────────────────────────────┤
│ FinalCard (기존)                    │
├─────────────────────────────────────┤
│ [새 프로젝트] [이해관계자 재검증]    │  ← 기존
│ [✏️ 악장에게 수정 요청]              │  ← 신규
└─────────────────────────────────────┘
```

### 7.2 수정 요청 모달 (신규)
- 현재 버전 표시 (v0.1 / v0.2.1 등)
- 텍스트 영역: "어떻게 고치면 좋을까?" (maxLength 500)
- [취소] [수정본 생성]

### 7.3 히스토리 드로어 — 재사용 + 일반화
- 기존 `VersionHistoryDrawer.tsx` 는 `RefineLoop + RefineIteration` 하드코딩
- **일반화**: generic tree node 인터페이스 추출
  ```ts
  interface VersionTreeNode {
    id: string
    parent_id: string | null
    label: string
    summary: string
    created_at: string
    is_released?: boolean
  }
  ```
- RefineStep도 같이 이 인터페이스로 변환. ProgressiveFlow는 Draft → VersionTreeNode 매핑.
- 드로어 코드는 데이터 소스 agnostic.
- **force-fit 아님** — 드로어는 본래 tree view라 generic이 맞음.

### 7.4 분기 시나리오
- 사용자가 드로어에서 v0.1에서 [여기서 분기] 클릭
- `active_draft_id = v0.1.id`
- 메인 뷰 final_text 가 v0.1 로 갱신
- 수정 요청 시 v0.1.1 생성 (parent=v0.1)
- Label: `nextChildLabel('v0.1', ['v0.2'])` → `v0.1.1`
- **`lib/version-numbering.ts` 그대로 재사용**

### 7.5 분기 배지 (올바른 정의)
이전 RefineStep에서 `isOnBranch = activeIteration !== overallLatest` 로 저지른 버그 수정:

```ts
function isOnBranch(drafts: Draft[], activePathIds: Set<string>): boolean {
  return drafts.some(d => !activePathIds.has(d.id))
}
```

"active path에 없는 draft가 하나라도 있으면 분기 중". RefineStep도 같은 정의로 백포트 → 공짜 버그 수정.

### 7.6 v1.0 승격
- 활성 draft에서 [v1으로 승격] 버튼 (isActiveLeaf + isPreRelease)
- `released_draft_id` 세팅 + label 교체 (promoteToMajor)
- ShareBar / export가 `released_draft_id` 있으면 우선 사용, 없으면 active_draft

---

## 8 · 기존 RefineStep 코드 운명

| 파일 | 처리 |
|---|---|
| `lib/version-numbering.ts` | **유지, 공용 사용** |
| `VersionHistoryDrawer.tsx` | **일반화 후 공용 사용** |
| `useRefineStore` tree 로직 | **legacy 경로로 유지. 건드리지 않음** |
| RefineStep의 `isOnBranch` 버그 | **일반화 과정에서 자동 수정** |
| RefineStep의 drawer v1 승격 버그 | legacy 버그로 남김 (loop status 체크 X) |
| RefineStep의 max_iter 가드 이슈 | legacy 버그로 남김 |

---

## 9 · 구현 작업 분해

| # | 작업 | 시간 |
|---|---|---|
| 1 | `types.ts` Draft/ProgressiveSession 필드 추가 | 30분 |
| 2 | `useProgressiveStore`: migrateSession, addDraft, setActiveDraft, promoteDraft, getActiveDraftPath, setReleasedDraft | 1시간 |
| 3 | `setFinalDeliverable` 훅 걸기 (initial draft 자동 생성, 재완성 시 새 draft) | 30분 |
| 4 | `runConcertmasterRevision` 작성 + 프롬프트 튜닝 | 1시간 |
| 5 | `iterating` phase 추가 + 전이 로직 | 45분 |
| 6 | 수정 요청 모달 + 스피너 컴포넌트 | 1시간 |
| 7 | `VersionHistoryDrawer` 일반화 (tree generic) + RefineStep 어댑터 | 1.5시간 |
| 8 | Complete phase 칩/버튼/드로어 마운트 | 1시간 |
| 9 | `isOnBranch` 올바른 정의 + 양쪽 적용 | 15분 |
| 10 | 테스트 (store migration + version-numbering reuse + revision flow mock) | 1.5시간 |
| **합계** | | **약 9시간** |

---

## 10 · 결정 필요 (네 확인 항목)

사용자가 **구현 들어가기 전에 정해줘야 할 7가지**:

1. **악장 default로 OK?** specialist(혜연·준서 등) 선택 UI는 MVP 밖. 향후 확장 여지만 남김. 찬성?

2. **수정 directive 성격** — 구체 지시("이 섹션 재무 가정 더 보수적으로") + 톤 지시("더 공격적으로") 둘 다 수용? 프롬프트 규칙에 영향.

3. **"이해관계자 검증 다시 하기" 도 draft로 쌓이게?** — 찬성하면 기존 덮어쓰기 버튼이 버전 보존으로 격상. 반대하면 그 버튼은 기존 동작 유지.

4. **초기 draft 생성 시점** — (a) complete 도달 즉시 drafts[0] 생성 (기본 제안) vs (b) 첫 "수정 요청" 누를 때 비로소 drafts[0, 1] 동시 생성. (a)가 단순.

5. **released_draft_id 의미** — v1 승격 후 ShareBar가 released draft를 우선할지(= "v1 = release") 아니면 active 따라갈지. 전자가 의미 강함.

6. **Legacy RefineStep 방치** — 유지보수 대상 2개 되지만 일단 둠. 향후 ProgressiveFlow 안정화되면 삭제. 찬성?

7. **RefineStep 잔여 버그 3개 중** `isOnBranch` 만 공용 라이브러리 수정으로 해결되고, 드로어 v1 승격 오픈 + max_iter 가드는 legacy 버그로 남김. 찬성?

---

## 11 · 다음 단계

1. 위 7개 결정 확정
2. 확정 후 Task 분해 (10개 세분화) + 순서대로 구현
3. 각 단계 후 3-tier 리뷰 (구조 → 동작 → 합성)
4. 브라우저 e2e 검증 (수정 요청 → draft 생성 → 분기 → 승격)
5. 커밋 + 푸시
