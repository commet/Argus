# 2026-03-26 세션 정리 — Argus Plugin 개발

## 시작점

0325 세션에서 만든 웹앱(4단계 구조화 사고 프레임워크)을 Claude Code plugin으로 패키징하는 프로젝트.
사용자 피드백 "플러그인 형태로 쓰고 싶다"에서 출발.

---

## 전략 논의 (구현 전)

### 1. 플러그인 vs 웹앱
- MCP/Plugin으로 가면 프롬프트 노출 + 무료 + 데이터 수집 실패
- 결론: **웹앱이 본진, 플러그인은 진입점**
- 플러그인에서 가치를 경험 → 웹앱에서 깊은 분석

### 2. 경쟁 분석
- **Superpowers** (233K installs): 코딩용 7단계 워크플로우. 프롬프트 완전 공개, MIT, $0 매출
- **Manyfast**: AI 기획 에디터. PRD/스펙 생성. 판단 레이어 없음. 500명 베타
- **시장에 "구조화된 판단 도구"는 0개** — GIC, Audax PE가 자체 개발해야 했을 정도
- McKinsey/BCG는 내부 도구만 만듦, 오픈 플러그인은 안 만듦

### 3. 포지셔닝
- Manyfast = "문서 생성기" (What to build)
- Argus = "판단 설계 도구" (Should we? Why?)
- Argus가 상위 레이어 — 판단 후 Manyfast/Cursor로 넘어가는 체인

### 4. Anthropic 하네스 디자인 아티클 적용
- Generator-Evaluator 분리 → Devil's Advocate 서브에이전트
- 주관적 품질의 정량화 → DQ 6요소 스코어
- Sprint Contract → 편곡의 체크포인트
- "Every harness component encodes an assumption about model limitations"

### 5. Output 결정
- ~~Decision Brief~~ (너무 컨설팅 용어) → 3가지 deliverable:
  - **Sharpened Prompt**: 바로 AI에 붙여넣을 수 있는 더 나은 질문
  - **Thinking Summary**: 팀에 공유할 슬랙 형식 요약
  - **Agent Harness**: CLAUDE.md 형태의 에이전트 실행 지시서

---

## 구현 — 웹앱 개선 (0325 TODO 처리)

### 완료
- **DQ 중복 계산 버그 수정**: 버튼 핸들러에서 computeDecisionQuality 제거, localStorage 멱등성 추가
- **Supabase 마이그레이션**: outcome_records, retrospective_answers, decision_quality_scores 3개 테이블 + RLS
- **deleteAllUserData**: 3개 신규 테이블 추가
- **보상 카드 애니메이션**: useCountUp 훅, animate-bar-grow, animate-score-pop, reward-entrance
- **Cross-stage coaching**: 악보→편곡, 편곡→리허설, DQ추이→합주 concertmaster 연동
- **DQ 추이**: DQScoreCard 안에 이전 대비 +/-p 인라인
- **PersonaAccuracyCard**: outcome 기록 있을 때 페르소나 예측 정확도 표시
- **DQ↔Outcome 상관**: OutcomeRecordingCard에 correlateDQWithOutcomes 연결 (4건 이상일 때)
- **Outcome 알림**: 워크스페이스에 2주 이상 미기록 프로젝트 넛지 + 데일리 리포트에 stale 프로젝트 섹션
- **resend 패키지 설치**: 빌드 에러 수정

---

## 구현 — Plugin

### 구조 (16개 파일)

```
argus-plugin/
├── .claude-plugin/plugin.json
├── LICENSE (MIT)
├── README.md
├── install.sh (ASCII 아트 로고 + 원라인 설치)
├── agents/
│   └── devils-advocate.md (context: fork)
└── skills/
    ├── help/SKILL.md (/argus-help)
    ├── reframe/SKILL.md + references/reframing-strategies.md
    ├── recast/SKILL.md + references/execution-design.md
    ├── rehearse/SKILL.md + references/persona-design.md, risk-classification.md
    ├── refine/SKILL.md + references/convergence.md
    └── argus/SKILL.md + references/decision-quality.md
```

### 스킬 설명

| 스킬 | 역할 | 상태 |
|------|------|------|
| `/reframe` | 인터뷰 3개 → 전제 도출 → 전제 평가 → 리프레이밍 + Sharpened Prompt | 가장 완성도 높음. 인터뷰 + 평가 + 출력 모두 디자인됨 |
| `/recast` | 실행 설계 — Governing Idea, Storyline, AI/Human 역할 분리, 체크포인트 | 디자인 시스템 적용됨. 스텝 박스(┌┐└┘) 포함 |
| `/rehearse` | 페르소나 사전 검증 — 2-3명 독립 리뷰 + Devil's Advocate + 종합 | Bottom line first 패턴. Devil's Advocate 에이전트 참조 |
| `/refine` | 수렴 루프 — 이슈 추출 → 수정 → 재리뷰 → 수렴 판정 (최대 3회) | 수렴 상태 표시 포함 |
| `/argus` | 전체 파이프라인 — 각 스킬 순서대로 실행 + DQ 스코어 + 3 deliverables | 각 스킬의 디자인을 그대로 사용하도록 위임 |
| `/argus-help` | 사용법 안내 | 기본 완성 |

### CLI 디자인 시스템

```
헤더:     ╭──────────────────────────────────────────╮
          │  Argus · [Skill]                      │
          │  ● [phase]  ○ [phase]  ○ [phase]         │
          ╰──────────────────────────────────────────╯

섹션:     ■ Section Name                    [counter]
구분선:   ━━━━━━━━━━━━━━━━ (메이저) / ────────────── (마이너)
옵션:     1 · Option text
강조:     ▸ Important text
상태:     ✓ ✗ ? ○
스텝박스: ┌─ Step 1 ──── Human ──┐
          └──────────────────────┘
```

**렌더링 규칙**: 모든 디자인 출력은 반드시 fenced code block (```) 안에. 아니면 모노스페이스 깨짐.

### 시그니처 요소

**"What you didn't see"**: 매 실행 끝에 한 문장 — 사용자가 못 본 사고의 사각지대.
- 구체적이어야 함 (범용 X)
- 불편해야 함 (동의만 하면 실패)
- "You were thinking about X, but the real issue is Y" 형태

**학습 저널** (`.argus/journal.md`): 매 실행 후 자동 기록. 재사용 시 패턴 참고.

### 설치 방법

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin/install.sh | bash
```

설치 시 Bold Block ASCII 아트 로고 출력.

---

## 잘 된 것

1. **composable skills 구조**: 각 스킬이 독립적으로 가치 있고, 체이닝도 가능
2. **CLI 디자인 시스템**: 일관된 비주얼 — 박스, 섹션 헤더, 진행 표시, 옵션 포맷
3. **웹앱 인터뷰 플로우 보존**: 3개 질문 → 전제 도출 → 평가 → 리프레이밍 전략 선택 (Cynefin 기반)
4. **입력 최소화**: 숫자 하나씩 선택, 평가도 1/2/3
5. **3가지 deliverable**: Sharpened Prompt (나→AI), Thinking Summary (나→팀), Agent Harness (나→에이전트)
6. **Anti-sycophancy 일관 적용**: 모든 스킬에 self-check, Devil's Advocate 분리
7. **영어 기본 + 다국어 대응**: UI chrome 영어 고정, 콘텐츠는 사용자 언어

## 못 한 것 / 문제점

1. **실제 end-to-end 테스트 미완료**: /reframe 인터뷰 Q1까지만 테스트함. Q2~Q3 → 전제 평가 → 리프레이밍 → 출력까지 전체 플로우 미확인
2. **다른 스킬 테스트 0회**: /recast, /rehearse, /refine, /argus 전부 실사용 테스트 안 함
3. **인터뷰 신호 → 전제 도출 연결 품질 미확인**: 인터뷰 답변이 실제로 전제에 영향을 주는지 검증 안 됨
4. **Devil's Advocate 에이전트 동작 미확인**: `context: fork`가 실제로 작동하는지 테스트 안 함
5. **학습 저널 동작 미확인**: .argus/journal.md 실제 생성/읽기 테스트 안 함
6. **Slack/Discord 출력 호환 미확인**: 코드블록이 실제 메시징 앱에서 어떻게 렌더링되는지 미확인
7. **다른 스킬들의 디자인 시스템 실제 렌더링 미확인**: /recast의 스텝 박스, /rehearse의 bottom line 등이 Claude Code에서 잘 보이는지 확인 안 함
8. **한글 렌더링 정렬**: 한글 문자가 모노스페이스에서 2칸 차지해서 정렬이 밀릴 수 있음 — 미확인
9. **/argus 전체 파이프라인**: 5-10분 연속 실행 시 context window 소진 여부 미확인

## 다음에 해야 할 것

### 즉시 (이어서 할 것)
- [ ] `/reframe` 전체 플로우 end-to-end 테스트 (Q1~Q3 → 전제 → 평가 → 리프레이밍 → Sharpened Prompt → "What you didn't see")
- [ ] `/recast` 실사용 테스트
- [ ] `/rehearse` 실사용 테스트 (Devil's Advocate 포함)
- [ ] `/refine` 실사용 테스트 (수렴 루프)
- [ ] `/argus` 전체 파이프라인 테스트
- [ ] 학습 저널 생성/읽기 테스트
- [ ] 한글 모노스페이스 정렬 확인 및 수정
- [ ] 발견되는 UX 이슈 즉시 수정

### 단기
- [ ] 다른 주제로 /reframe 테스트 (개인 결정, 기술 결정, 짧은 입력 등 edge case)
- [ ] /argus context window 소진 테스트
- [ ] GitHub repo README에 플러그인 안내 추가
- [ ] 공식 마켓플레이스 PR 준비 (anthropics/claude-plugins-official)

### 중기
- [ ] 웹앱 프롬프트 추출 (React 컴포넌트 → lib 파일) — 플러그인과 웹앱 일관성
- [ ] 사용자 커스터마이징 (.argus/config.md — 페르소나 수, 산업 맥락 등)
- [ ] Blind Spot Profile (5회 이상 사용 후 패턴 분석)
- [ ] 웹앱과 플러그인 간 데이터 동기화 방안

---

## 커밋 히스토리 (주요)

```
fa40111 fix: ask for problem FIRST, then show overview + interview
201ae54 Revert "fix: interview signals MUST shape assumption discovery"
0e9d958 fix: separator length adjusted
0fba272 feat: unified design system + "What you didn't see" signature
eeea505 fix: /argus now delegates to each skill's own design system
cddab97 feat: complete reframe redesign — web app flow + CLI design system
0cb4a16 ux: default-and-override assumption evaluation
8b76e50 feat: support no-argument invocation for all skills
92910fa feat: friendly first-use onboarding
586cbf3 feat: add install.sh — one-line installer
0c9f191 feat: Argus Claude Code plugin + web app improvements
```

---

## 기술 참고

### 파일 위치
- 플러그인 소스: `argus-plugin/`
- 프로젝트 스킬: `.claude/skills/` (git tracked)
- 글로벌 스킬: `~/.claude/skills/` (로컬만)
- 학습 저널: `.argus/journal.md`

### 스킬 싱크 명령어
플러그인 수정 후 로컬에 반영:
```bash
cp -r argus-plugin/skills/* ~/.claude/skills/
cp -r argus-plugin/agents/* ~/.claude/agents/
cp -r argus-plugin/skills/* .claude/skills/
```

### Vercel 빌드 참고
- `InterviewSignals` 타입에 `trigger` 필드 추가됨 (c972147)
- 다른 세션에서 수정된 파일들 커밋 안 된 것 있음 (git status 확인 필요)

### 웹앱 변경 파일 (이 세션)
storage.ts, db.ts, decision-quality.ts, use-count-up.ts (신규), concertmaster.ts,
RefinementLoopStep.tsx, DecomposeStep.tsx, RecastStep.tsx, PersonaFeedbackStep.tsx,
workspace/page.tsx, globals.css, daily-report/route.ts
