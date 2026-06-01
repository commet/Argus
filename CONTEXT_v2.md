# Argus — 프로젝트 컨텍스트 v2

> 다른 기기/세션에서 작업을 이어갈 때 사용하는 핸드오프 문서.
> 마지막 업데이트: 2026-03-21

---

## 1. 최근 작업 요약

### 이번 세션 (2026-03-21)

#### 데모 페이지 신규 구축
- **`/demo` 라우트** — 6단계 인터랙티브 워크스루 (로그인 불필요)
- 시나리오: "매출 40% 고객사 Meridian 계약 해지 위기 대응"
- 각 단계: 악보 해석 → 편곡 → 리허설 → 합주 연습 → 결과
- 편곡 섹션: **actor 토글 인터랙션** (AI/사람/협업 클릭 전환, 실시간 통계 변동)
- 리허설 섹션: gradient 페르소나 카드, 다크 프리모템, 3분류 리스크 컬러 카드
- 로딩 시뮬레이션 (첫 방문 시만), 키보드 네비게이션, 단계 카운터

#### 랜딩 페이지 전면 재설계
- **Hero**: "AI에게 시키기 전에, 뭘 시킬지부터." + Before/After 카드 (①전제→②질문 흐름)
- **기능 섹션 (2번째)**: 3카드 — 질문 변환 비주얼, 페르소나 아바타 SVG, 수렴 차트 SVG
  - "핵심 위협부터 해결합니다" — 가중 수렴 로직 반영 (blocker 3x)
- **프로세스 (3번째)**: "네 단계로 작동합니다" + 메타포 맥락 설명 한 줄
- **순서 변경**: Hero → 기능 → 프로세스 → CTA (기존: Hero → 프로세스 → 유스케이스 → CTA)
- 전체 섹션 여백 40% 축소

#### 네비게이션 통일
- **글로벌 Sidebar**: 워크스페이스 스텝 링크로 통일 (`/workspace?step=xxx`)
- **ProcessSteps**: 합주 연습(4단계) 항상 표시 + getStatus 케이스 추가
- **모바일 탭바**: 4탭 (해석·편곡·리허설·합주), 터치 타겟 44px 보장
- **프로젝트 페이지**: `/tools/*` → `/workspace?step=*` 링크 통일, 진행률 4단계

#### 편곡 UI 대폭 개선
- **스텝 카드 expand/collapse**: 기본=간결 (번호+actor+태스크+산출물), 클릭=상세 입력
- **파스텔 배경 제거**: 흰색 + 좌측 3px 액센트 보더
- **"vs" 옵션 파싱**: "자체 개발 vs 패키지 도입 vs 외주 개발" → 클릭 가능 칩 + "직접 입력" 대안
- **비율 바 통합**: 3카드 → 단일 바 (AI|협업|사람, 라벨 표시)
- **레인 헤더**: 각 반 중앙에 크고 눈에 띄게
- **크리티컬 과잉 억제**: >50% 크리티컬이면 뱃지 숨김
- **체크포인트 설명**: "(사람 확인 필수)" + "이 단계를 넘기기 전: [이유]"
- **전제 조건/팀 리뷰/상황·문제·접근 스토리라인**: 제거 (악보 해석에서 이미 다룸)

#### 분석 트래킹 (analytics)
- **Supabase `user_events` 테이블**: event_name, properties(JSON), session_id, page_path
- **`src/lib/analytics.ts`**: fire-and-forget `track()` 함수, 세션 기반
- **8개 이벤트**: page_view, demo_step, project_created, decompose_complete, recast_complete, feedback_complete, iteration_complete, loop_converged
- SQL 쿼리 예시 포함 (일별 세션, 데모 완주율, 퍼널, 산출물 빈도)

#### 판단 근거서 + 실행 준비도
- **`src/lib/decision-rationale.ts`**: 5번째 산출물 — Executive Summary + 6섹션 (과제 재정의, 실행 설계, 이해관계자 검증, 수렴, 판단 이력, 성찰)
- **`src/components/ui/ExecutionReadiness.tsx`**: 프로젝트 페이지 스코어카드 — 7항목 체크 + 다음 행동 유도 + 점수 기반 라벨
- OutputSelector (5번째 포맷) + WorkspaceSidebar (6번째 버튼) 통합

#### 디자인 개선
- **Card variant 시스템**: `variant="ai|human|checkpoint|success|danger|muted"`
- **활성 상태 통일**: Header/Sidebar/Tab 동일 패턴 (밝은 배경 + 진한 텍스트)
- **트랜지션 통일**: Card hoverable 300→200ms, shadow 토큰 사용
- **빈 상태(Empty State)**: 합주 연습, 페르소나, 프로젝트 — 행동 유도 CTA 추가
- **Login**: Suspense 바운더리 추가

#### 기타
- "한솔그룹" → "Meridian" (가상 회사명, 법적 리스크 제거)
- 헤더 네비: 데모 제거 (랜딩+가이드에서 접근 가능)
- 가이드 페이지: 초보자 추천 + 데모 링크

### 이전 세션 (Phase 0-5)

| Phase | 상태 | 핵심 파일 |
|---|---|---|
| **0** 타입드 맥락 파이프라인 | 완료 | `src/lib/context-chain.ts` |
| **1** 적응형 악보 해석 | 완료 | `src/lib/reframing-strategy.ts`, `src/lib/eval-engine.ts` |
| **2** 다관점 편곡 검증 | 완료 | `src/lib/workflow-review.ts` |
| **3** 학습하는 리허설 | 완료 | `src/lib/context-builder.ts` (강화) |
| **5** 산출물 혁명 | 완료 | `src/lib/prompt-chain.ts`, `src/lib/agent-spec.ts` |
| **4** 자가 개선 | 기반만 | `eval-engine.ts`가 데이터 축적. 자동 mutation 미구현 |
| **6** 네트워크 효과 | 미착수 | 사용자 기반 확보 후 |

---

## 2. 현재 상태 & 알려진 이슈

### 배포

- URL: https://argus-zeta.vercel.app
- Vercel 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` 설정됨

### 알려진 이슈

1. **eval gaming**: `question_accepted` eval이 copy-paste로 우회 가능
2. **재분석 횟수 미추적**: 5번 재분석해도 eval에서 감지 안 됨
3. **리뷰 결과 재분석 시 소실**: 워크플로우 재분석하면 reviews 덮어씀
4. **Supabase 스키마 미동기**: 새 필드들 (reframed_question, evaluation 등) DB 마이그레이션 필요
5. **팀 리뷰**: 편곡에서 제거됨 — 별도 단계 또는 리허설에서 재도입 필요
6. **편곡 "직접 입력" UX**: 칩+텍스트 병행 구현했으나 실사용 검증 필요

---

## 3. 다음에 해야 할 것 (우선순위)

### 즉시
1. **전체 흐름 E2E 테스트** — 악보 해석 → 편곡 → 리허설 → 합주 전 과정 실사용 확인
2. **편곡 스텝 카드 UX 검증** — vs 칩 파싱 동작 확인, 클릭 반응성
3. **리허설 + 합주 화면 디자인 검토** — 편곡과 동일 수준으로 개선 필요

### 단기
4. **Supabase 마이그레이션** — 모든 새 필드 DB에 반영
5. **모바일 반응형 검증** — 좌우 레인, 데모, 랜딩 페이지
6. **팀 리뷰 재배치** — 편곡이 아닌 적절한 단계에서 재도입
7. **analytics 대시보드** — Supabase SQL 대신 간단한 관리자 뷰

### 중기
8. **Claude Code Skill** — /argus 커맨드
9. **MCP Server** — 다른 AI 도구에서 호출
10. **Phase 4 완성** — 프롬프트 자동 mutation
11. **온보딩 개선** — 첫 방문 시 인앱 가이드/툴팁

---

## 4. 기술 스택

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **State**: Zustand (localStorage + Supabase 이중 저장)
- **LLM**: Anthropic Claude Sonnet 4
- **DB**: Supabase (RLS 적용, `user_events` 트래킹 테이블 포함)
- **배포**: Vercel

---

## 5. 핵심 파일 맵 (이번 세션 추가분)

```
src/app/
├── demo/page.tsx              # 데모 라우트

src/components/
├── demo/DemoWalkthrough.tsx   # 6단계 인터랙티브 데모
├── layout/Analytics.tsx       # 페이지뷰 자동 트래킹
└── ui/ExecutionReadiness.tsx   # 실행 준비도 스코어카드

src/lib/
├── analytics.ts               # track() 함수 + SQL 쿼리 예시
└── decision-rationale.ts      # 판단 근거서 생성 (5번째 산출물)
```

---

## 6. 설계 결정 (이번 세션)

1. **데모 → 랜딩의 핵심 전환 도구**: 헤더 네비에는 안 넣음 (일회성). 랜딩 Hero + ClosingCTA + 가이드에서 접근.
2. **기능 강조 > 프로세스 설명**: 랜딩 순서를 "뭘 하는지"(기능) → "어떻게 하는지"(프로세스)로. 사용자는 How보다 What에 먼저 관심.
3. **편곡 카드 collapse 기본**: 빈 입력 필드 12개가 한꺼번에 보이면 포기. 기본=간결, 클릭=상세.
4. **"vs" → 클릭 칩**: LLM이 "A vs B vs C"로 생성 → extractOptions에서 파싱 → 서술형 입력 대신 1클릭 판단. 사람 개입을 쉽게 만드는 것이 핵심.
5. **크리티컬 억제**: AI가 전부 크리티컬로 찍으면 아무 의미 없으므로 >50% 시 숨김.
6. **전제 조건/팀 리뷰 편곡에서 제거**: 전제는 악보 해석에서 이미 다룸. 팀 리뷰는 편곡 단계에서 하는 게 부자연스러움 — 리허설 이후 또는 별도 단계로 재배치 예정.
7. **analytics = fire-and-forget**: UI 절대 블로킹 안 함. Supabase 미설정 시 조용히 실패. 프라이버시: 익명 세션 기반.
8. **판단 근거서 = "세계관 공유"**: 하네스 엔지니어링 아티클에서 영감. "무엇을 했는가"가 아니라 "왜 이렇게 판단했는가"를 공유.
9. **실행 준비도 = 과정 평가**: 핵심 4단계 각 20점, 리스크+수렴 각 10점. 합주 연습 없이도 80점(실행 준비 완료) 가능.
