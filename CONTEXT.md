# Argus — 프로젝트 컨텍스트 핸드오프

> 이 문서는 다른 기기/세션에서 작업을 이어갈 때 컨텍스트 손실 없이 진행하기 위한 핸드오프 문서입니다.
> 마지막 업데이트: 2026-03-17

---

## 1. 프로젝트 정체성

**Argus** — "Think before you recast"

오케스트라에서 서곡(Argus)은 본 공연 전에 전체 음악의 주제를 미리 제시하는 곡.
AI 에이전트가 실행하기 전에, 무엇을 왜 어떤 순서로 할지를 설계하는 도구.

**핵심 테제**: "실행 비용이 0에 가까워질수록, 실행 이전의 판단의 가치는 올라간다."

**타겟**: 전략기획자뿐 아니라 개발자, PM, 디자이너, 마케터 — AI를 쓰기 전에 판단을 구조화해야 하는 모든 사람.

---

## 2. 핵심 플로우 (4단계 + Output)

```
악보 해석 → 편곡 → 리허설 → 합주 연습 → 공연(산출물)
```

| 단계 | 오케스트라 비유 | 업무명 | 기능 | 코드 |
|------|-------------|--------|------|------|
| 1 | **악보 해석** | 문제 재정의 | 과제의 진짜 질문 찾기, 가설 수립, 전제 점검 | DecomposeStep.tsx |
| 2 | **편곡** | 실행 설계 | Governing idea + SCR 스토리라인 + 워크플로우 + 판단 포인트 + 핵심 가정 | RecastStep.tsx |
| 3 | **리허설** | 사전 검증 | 페르소나 기반 프리모템 + 리스크 3분류 + 가정 공격 + 승인 조건 | PersonaFeedbackStep.tsx |
| 4 | **합주 연습** | 피드백 반영 | 리허설 피드백 반영 → 재검증 → 하모니 수렴 | RefinementLoopStep.tsx |
| → | **공연** | 산출물 | 4종 Output 생성 | OutputSelector.tsx |

**조율(Synthesize)**: 메인 플로우에서 제외됨. 여러 AI 결과물을 비교할 때 독립적으로 쓰는 유틸리티. 사이드바에서도 제거됨.

---

## 3. Argus Method (지적 자산)

각 단계에 내장된 사고 패턴 (전부 public domain 개념):

### 악보 해석
- **가설 기반 사고**: "이 과제의 진짜 이유는 X, 풀어야 할 질문은 Y"
- **리프레이밍**: 대안적 프레이밍 2-3개 생성
- **4축 전제 점검**: 고객 가치 / 실행 가능성 / 사업성 / 조직 역량
- **이슈 트리**: MECE 분해

### 편곡 (가장 중요한 단계)
- **피라미드 원칙**: governing_idea (한 문장 핵심 방향)
- **SCR 스토리라인**: 상황 → 문제 → 해결 서사 구조
- **기대 산출물**: 각 단계가 "뭘 만드는지" 구체적 명시
- **판단 포인트**: 사람이 결정할 것 + 선택지 + 트레이드오프
- **핵심 가정**: importance × certainty 매트릭스 + if_wrong
- **크리티컬 패스**: 병목 단계 식별

### 리허설
- **프리모템**: "이 계획이 이미 실패했다면, 이유는?"
- **리스크 3분류**: 🔴 핵심 위협(critical) / 🟡 과장된 우려(manageable) / 🟣 침묵의 리스크(unspoken)
- **가정 공격**: 편곡의 핵심 가정 중 검증 안 된 것 집중
- **승인 조건**: "이걸 보여주면 OK하겠다" 구체적 조건

### 합주 연습
- **PDCA**: 수정 → 반영 → 재검증 → 표준화
- **더블루프 러닝**: 지적받은 걸 고치는 것뿐 아니라 "애초에 질문이 틀렸나?"까지
- **하모니 지수**: 수렴 정도 추적

### 맥락 누적 체인 (Argus의 해자)
```
악보 해석의 숨겨진 전제 → 편곡의 핵심 가정 → 리허설에서 가정 공격 → 합주 연습에서 우선 해결
악보 해석의 가설 → 편곡의 governing_idea → 리허설에서 프리모템 → 합주 연습에서 더블루프 체크
```

---

## 4. Output 4종

| 비유명 | 영문명 | 설명 | 파일 |
|-------|--------|------|------|
| 프로그램 노트 | Project Brief | 경영진/팀에 공유하는 의사결정 기록 | project-brief.ts |
| 파트보 | Prompt Chain | AI에 순서대로 입력할 프롬프트 세트 | prompt-chain.ts |
| 총보 | Agent Spec | LangGraph/CrewAI 구현 출발점 (YAML) | agent-spec.ts |
| 셋리스트 | Execution Checklist | 순서대로 체크하며 실행하는 리스트 | checklist.ts |

---

## 5. 기술 스택 & 인프라

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **State**: Zustand (localStorage + Supabase 이중 저장)
- **LLM**: Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- **DB**: Supabase (RLS 적용, 최근 연동 완료)
- **배포**: Vercel (https://argus-zeta.vercel.app)
- **Repo**: github.com/commet/Argus

### LLM 비용 구조
- 프리 티어: 하루 5회 (서버 프록시, `ANTHROPIC_API_KEY` 환경변수)
- BYOK: 사용자 본인 키 입력 (브라우저 localStorage, 서버 미전송)
- Anthropic 대시보드에서 월 한도 $20-50 설정 권장
- 편곡 단계 maxTokens: 3500 (가장 큰 출력)

---

## 6. UI/UX 설계 결정사항

### 입력 모드
- **직접** (Direct): 텍스트박스 하나. 파워 유저용.
- **대화형** (Interview): 질문 하나씩 → 칩 자동 전진 → 요약 확인 → 제출. 기본값.
- InterviewInput.tsx 컴포넌트, ModeToggle.tsx로 전환

### 사이드바
```
악보 해석
편곡
리허설
합주 연습
─────
사용 가이드
설정
```
(조율은 제거됨)

### 오케스트라 메타포 적용 위치
- 로딩 메시지: "악보를 펼치고 있습니다...", "각 파트에 역할을 배정하고 있습니다..."
- 빈 상태: "아직 서곡이 시작되지 않았습니다", "무대에 연주자가 없습니다"
- 수렴 지표: "하모니 지수", "하모니 완성"
- 다음 단계: "주제가 잡혔습니다 → 악보가 완성되었습니다 → 첫 합주가 끝났습니다"
- Output 네이밍: 프로그램 노트 / 파트보 / 총보 / 셋리스트

### 페르소나
- influence 필드 (high/medium/low) — 이해관계자 우선순위
- 리스크 3분류: critical / manageable / unspoken
- 피드백에 failure_scenario, untested_assumptions, approval_conditions 포함

---

## 7. 다른 세션에서 작업된 내용 (이 세션 외)

### Premium UI 오버하울
- CSS 변수 확장: shadow-xs~xl, ease-spring, radius scale
- body::after 노이즈 오버레이
- 스프링 기반 트랜지션 (cubic-bezier(0.16, 1, 0.3, 1))

### Workspace 단일 페이지
- /workspace가 primary entry point
- QuickChatBar: 자연어로 워크스페이스 제어
- WorkspaceSidebar: 프로세스 단계 네비게이션

### Workflow Graph
- WorkflowGraph.tsx: 편곡 단계의 시각적 워크플로우 그래프
- 카드 기반 StepEntry UX

### Supabase 연동
- db.ts, supabase.ts: upsertToSupabase, deleteFromSupabase, syncToSupabase
- 모든 store에 Supabase 동기화 추가
- RLS 적용

### Landing Page 리디자인
- 철학 중심 디자인 (255d268)

---

## 8. 글 (LinkedIn 에세이) 최종 상태

### 구조
1. 훅: "AI에게 일을 시키는 건 쉬워졌습니다. 어려운 건 무슨 일을 시킬지 정하는 겁니다."
2. 전환: 전략기획에서 답을 찾았다
3. 세 장면: 질문을 만드는 사람 (악보 해석) → 서로 다른 언어를 엮는 사람 (리허설) → 실행을 설계하는 사람 (편곡)
4. 브릿지: AI 오케스트레이션과의 연결 (악보 해석, 리허설, 편곡 콜백)
5. Argus 소개 + 4단계
6. 결론: "만들 것을 결정하는 것은 여전히 사람의 몫입니다. Argus는 그 결정이 시작되는 서곡입니다."

### 4단계 워딩 (글에서)
```
악보 해석 — 주어진 과제 뒤에 숨은 진짜 질문을 찾아냅니다.
편곡 — 누가 어떤 역할을 맡고 어떤 순서로 움직일지 설계합니다.
리허설 — 이해관계자 앞에서 한 번 연주해봅니다.
합주 연습 — 맞을 때까지 반복합니다.
```

---

## 9. 참고한 외부 리소스

- **pm-skills** (github.com/phuryn/pm-skills): 65개 PM 스킬 모음. Argus와는 다른 접근 (도구 모음 vs 사고 파이프라인). 프리모템 분류 체계와 가정 4축을 참고하여 Argus에 적용.
- **public domain 사고 패턴들**: 가설 기반 사고, 피라미드 원칙 (Minto), SCR, 프리모템 (Gary Klein), 레드팀, PDCA, 더블루프 러닝 등. 전부 자유롭게 구현 가능.

---

## 10. 미완료 / 다음 작업

- [ ] Vercel 환경변수 `ANTHROPIC_API_KEY` 설정 + 재배포 (`npx vercel --prod`)
- [ ] 실제 LLM 출력 품질 테스트 (새 시스템 프롬프트)
- [ ] 편곡 단계 UI에 새 필드 표시 (governing_idea, storyline, expected_output, judgment, key_assumptions 등) — 일부 다른 세션에서 작업됨
- [ ] 리허설 UI에 classified_risks 3분류 시각적 표시
- [ ] 합주 연습의 하모니 지수 시각화
- [ ] 랜딩 페이지를 새 4단계 플로우에 맞춰 업데이트
- [ ] LinkedIn 글 최종 발행
- [ ] Supabase 테이블 마이그레이션 (새 필드: hypothesis, alternative_framings, hidden_assumptions, governing_idea, storyline, key_assumptions, critical_path, classified_risks, failure_scenario, approval_conditions, influence)

---

## 11. 파일 구조 요약

```
src/
├── app/
│   ├── api/llm/route.ts          # LLM 프록시 (5회/일 제한)
│   ├── project/page.tsx          # 프로젝트 오버뷰 + Output
│   ├── tools/                    # 각 도구 페이지 (Step 컴포넌트에 위임)
│   └── workspace/                # 워크스페이스 (단일 페이지)
├── components/
│   ├── ui/
│   │   ├── InterviewInput.tsx    # 대화형 입력 컴포넌트
│   │   ├── ModeToggle.tsx        # 직접/대화형 전환
│   │   ├── NextStepGuide.tsx     # 다음 단계 안내 (선형 플로우)
│   │   └── OutputSelector.tsx    # 공연 — 4종 산출물
│   └── workspace/
│       ├── DecomposeStep.tsx     # 악보 해석
│       ├── RecastStep.tsx   # 편곡
│       ├── PersonaFeedbackStep.tsx # 리허설
│       ├── RefinementLoopStep.tsx  # 합주 연습
│       ├── SynthesizeStep.tsx    # 조율 (메인 플로우 외)
│       └── WorkflowGraph.tsx     # 편곡 시각화
├── lib/
│   ├── llm.ts                    # LLM 호출 (direct/proxy)
│   ├── context-builder.ts        # 판단 축적 → 시스템 프롬프트 강화
│   ├── project-brief.ts          # Output: Project Brief
│   ├── prompt-chain.ts           # Output: Prompt Chain
│   ├── agent-spec.ts             # Output: Agent Spec (YAML)
│   ├── checklist.ts              # Output: Execution Checklist
│   ├── db.ts                     # Supabase 동기화
│   └── supabase.ts               # Supabase 클라이언트
└── stores/
    ├── types.ts                  # 전체 타입 정의
    ├── useDecomposeStore.ts
    ├── useRecastStore.ts
    ├── usePersonaStore.ts
    ├── useRefinementStore.ts
    └── useProjectStore.ts
```

---

## 12. 핵심 설계 원칙 (잊지 말 것)

1. **Argus는 서곡이다** — 실행 전 판단을 구조화하는 도구. 실행 도구가 아님.
2. **맥락 누적이 해자** — 각 단계의 output이 다음 단계의 input. 이 체인이 경쟁 우위.
3. **프레임워크가 아니라 사고 패턴** — McKinsey 따라하기가 아니라 public domain 사고 패턴의 고유한 조합.
4. **비유는 이해를 돕되 가리지 않게** — 오케스트라 메타포 + 업무명 병기.
5. **프리 티어는 맛보기** — 5회/일, Sonnet, 월 $20 한도. BYOK으로 전환 유도.
