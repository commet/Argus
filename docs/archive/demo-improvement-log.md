# Demo 개선 작업 로그

## 파일
`src/components/demo/DemoWalkthrough.tsx`

---

## 완료된 작업

### 1. 입력 시뮬레이션 (Step 0)
- 정적 카드 → **타이핑 애니메이션** (30~70ms/char, 자연스러운 속도 변화)
- 완료 시 bezel border가 accent gradient + glow로 전환 + "입력 완료 ✓"
- subtitle: 제품 설명 → 공감 ("막막할 때는, 상황을 일단 꺼내놓으세요")
- 하단 메타 텍스트 축약 ("* 데모용 예시입니다")

### 2. 분석 로딩 (Step 1 진입)
- 3단계 로딩 애니메이션 (상황 읽기 → 놓치는 것 찾기 → 초안 생성, 2.4초)
- `hasSeenAnalysis` ref로 재방문 시 스킵
- 로딩 텍스트도 대화체 ("상황을 읽고 있습니다", "당신이 놓치고 있는 걸 찾고 있습니다")

### 3. 즉시 초안 구조 개편 (Step 1)
**레이아웃: 카드 나열 → Hero + 2-column grid**
```
[Hero: 이 상황의 본질 — BezelCard, dark bg]

[Grid 3:2]
  [좌: 대표님이 알고 싶은 것]     [우: 오늘 할 일]
  [5개 항목 flow 연결선]          [흔한 착각 3개]
```

**콘텐츠 변경:**
- `insight` + `real_question` 중복 → insight 하나로 통합 (3줄 스토리: 과제 재정의 → 판단자료 → 당신만 답할 수 있는 것)
- 기획안 뼈대: 템플릿 스타일 → CEO 질문 형태 (`"왜 지금이야?" — 시장 타이밍의 근거`)
- "상황 정리" 섹션 삭제 (입력 복붙 = 가치 없음)
- "지금 바로 할 일" 추가 — 구체적 액션 (`대표님에게 이 한마디만 하세요`)
- 전제: `assumption/reality` → `wrong/right` + 인용문 형태 ("완벽한 문서를 써야 한다" → 판단 가능한 최소 구조면 충분합니다)

**디자인:**
- BezelCard (gradient border + inset shadow)
- 구조 항목: numbered list → flow 연결선 (원형 번호 + gradient 세로선)

### 4. 심화 질문 (Step 2)
**콘텐츠:**
- 헤딩: "답할 때마다 초안이 바뀝니다" → "두 가지만 더 알려주세요"
- 게이트 힌트: "하나만 더요."
- getUpdatedDraft 모든 situation_update: 화살표 문법 → 대화체
  - direction: "뭘 써야 할지 모르는 게 당연합니다. 아직 대표님이 뭘 판단하려는지 모르니까요."
  - persuasion: "설득력은 데이터 양이 아니라 논리 구조에서 나옵니다."
  - time: "2주 안에 완벽한 기획안은 불가능합니다. 목표를 바꿔야 합니다."
  - expertise: "기획을 모른다고요? 오히려 좋습니다."
- skeleton 업데이트 항목도 CEO 질문 형태로 통일

**레이아웃: 카드 → Before/After 비교 뷰**
```
[상황 업데이트 — 풀폭 accent 배너]

[이전 (dimmed, dashed) | 이후 (BezelCard, dark)] ← 양쪽 비교

[구조 변화 — flow 연결선 + NEW 뱃지]

[✓ 확인됨 | ✗ 위험 | ? 미확인] ← 3-column grid
```

### 5. 대표님 반응 (Step 3)
**레이아웃: 세로 나열 → grid**
- 페르소나 카드: Card elevated → BezelCard
- 약점 3개: 풀폭 세로 → **3-column grid** (번호 뱃지 + 텍스트)
- 수정 제안 3개: 풀폭 세로 → **3-column grid** (텍스트 + impact badge)
- "아무도 말 안 하는 것": purple bezel border + manuscript-bg 악보 패턴

### 6. 반영 선택 (Step 4)
- 점수 영역: 단순 border → BezelCard + 완료 시 green glow
- Progress bar: 단색 → gradient (`#2d6b2d → #4ade80`)

### 7. 최종 (Step 5)
- "제출 가능한 구조" → `.text-gold-gradient` (금색 그라데이션 텍스트)
- 최종 핵심 질문 카드 → `glow-gold` shadow
- CTA 버튼 → `.animate-gold-shimmer` (빛 반사 애니메이션)
- 여정 타임라인 → inset shadow로 엠보싱

### 8. 전역 디자인
- **BezelCard 컴포넌트** 추가 (gradient border + inset shadow, ProgressiveFlow 패턴)
- **Ambient Glow**: step 1~4 미세 gold glow (0.03), step 5 강한 glow (0.08)
- **Progress stepper**: 완료 구간 → gradient-gold fill, 번호 원형 + 연결선
- **모든 텍스트 상향**: 본문 14→16px, 레이블 11→13px, 헤딩 +4~12px
- **Badge 컴포넌트** 각 스텝 타입별 적용
- **phrase-entrance** 애니메이션 활용

---

## 아직 안 한 것 / 이어서 할 수 있는 것

### 콘텐츠
- [ ] Step 3 대표님 reaction 내용이 Q2 답변에 따라 충분히 차별화되는지 재검토
- [ ] Step 5 "이 과정에서 일어난 일" 요약 — 더 간결하게 줄이거나, 시각적 타임라인으로 대체 가능
- [ ] 전체 플로우를 처음부터 끝까지 실제 사용자처럼 읽어보며 리듬 체크

### 디자인/UX
- [ ] Step 1 로딩 → 결과 전환 시 더 드라마틱한 애니메이션 (framer-motion 도입 가능)
- [ ] Step 2 Before/After 비교에서 구조 변화도 양쪽 비교로 확장 가능
- [ ] Step 4 fix 토글 3개를 가로 배치 검토 (현재 세로)
- [ ] 모바일 반응형 세부 검증 (grid collapse, 터치 타겟 등)
- [ ] Step 0 타이핑 완료 후 자동으로 다음 스텝으로 넘어가는 옵션 검토

### 기술
- [ ] `StaffLines` 컴포넌트 활용 — 섹션 간 시각적 연결 요소로 사용 가능
- [ ] framer-motion `layout` prop으로 Step 전환 시 morphing 애니메이션
- [ ] Step 1 → Step 2 전환 시 skeleton 항목이 제자리에서 변하는 효과
- [ ] 다크모드 검증 (CSS 변수 기반이라 대부분 작동하나 bezel/glow 확인 필요)

---

## 데이터 구조 변경 사항

### FIRST_DRAFT
```ts
// 삭제된 필드
real_question  // insight에 통합

// 변경된 필드
premises: { assumption, reality }[]  →  { wrong, right }[]

// 추가된 필드
insight: string           // 3줄 핵심 발견
immediate_action: string  // 오늘 할 일
immediate_action_why: string

// skeleton 내용 변경
'신사업 배경과 기회 — ...'  →  '"왜 지금이야?" — ...'  (CEO 질문 형태)
```

### getUpdatedDraft
```ts
// real_question_before: FIRST_DRAFT.real_question 참조 제거
// → 하드코딩 문자열로 대체

// 모든 situation_update: 화살표 문법 → 대화체
// 모든 skeleton 업데이트 항목: CEO 질문 형태로 통일
```

---

## 커밋 히스토리
1. `4e985e7` — 데모 UX 전면 개선 (가독성, 맥락 전달, 디자인 상향)
2. 이후 미커밋 — 콘텐츠 대화체 전환 + 구조적 레이아웃 개편 + 워크스페이스 디자인 패턴 적용
