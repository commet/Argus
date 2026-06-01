---
name: Build context 4R 적응 작업 로그
description: 2026-03-28 세션. 바이브 코더 타겟 분석 → /build 스킬 생성 → 4R 자동 적응으로 전환 → 프로토타입 테스트 → 카드 가독성 개선. 이어서 할 작업 포함.
type: project
---

## 배경

바이브 코딩 커뮤니티 대화에서 페인 포인트 발견:
- "기획을 대충하고 코드멍" — 실행 도구는 있는데 설계 도구가 없음
- "아이디어를 구체화해서 AI가 잘 알아듣게" — Argus의 정확한 밸류프롭

**문제:** 현재 Argus는 전략 의사결정에 최적화 → 바이브 코더에게 타겟 미스매치

## 결정 과정

1. **옵션 C (하이브리드) 선택** — Webapp=의사결정, CLI/MCP=개발빌드 경로
2. **처음에 /build 별도 스킬로 만듦** → 392줄 완성
3. **사용자 피드백: 브랜드 희석 우려** — "reframe은 뭘 하든 거쳐야 하는데 별개로 가면 헷갈림"
4. **옵션 A로 전환** — 4R 자체가 context를 감지해서 자동 적응. 새 커맨드 0개.

## 완료한 작업

### 1. /build 스킬 (아카이브)
- `argus-plugin/skills/build/SKILL.md` — 소스 남아있음 (참고용)
- `.claude/skills/build/` — 삭제됨 (스킬 목록에서 제거)

### 2. /reframe 수정 ✅
- **Context Detection** 섹션 추가 (build/decide 자동 감지)
  - Build 시그널: 앱, 만들다, 서비스, 도구, SaaS 등
  - Decide 시그널: 전략, 결정, 투자, 확장 등
  - 애매하면 라우팅 질문 1개
- **Build 인터뷰** Q1-Q3 대체:
  - Q1: 누구를 위한가 (audience: personal/niche/mass/unknown)
  - Q2: 성공 = ? (success_model: users/validation/revenue/learning)
  - Q3: 첫 버전 규모 (scale: weekend/side_project/full_product/unknown)
- **Build 가정 차원**: 가치/차별화/실현성 (3개, 조직역량 대신)
- **Build 리프레이밍 전략**: sharpen_wedge / narrow_scope / validate_first
- **Context Contract**: `context: build|decide`, `build_signals` 필드 추가

### 3. /recast 수정 ✅
- Build vs Decide 매핑 테이블 추가
- **Build 모드**: 실행 설계 → 프로덕트 스펙 (P0/P1/P2 + scope cuts)
- Product thesis / Product narrative 대체 텍스트
- **유저 페르소나 2명** (타겟 유저 + 회의론자) — 이해관계자 3명 대신
- **Implementation Prompt** 블록쿼트 산출물 추가
- **카드 포맷 개선** (2차 수정):
  - 한 줄 한 정보 원칙 (`·`로 속성 연결)
  - 내러티브는 카드에서 제거 → .md 파일에만
  - 가정은 심볼 먼저 (`? [텍스트] reframe`)
  - **저장 타이밍 변경**: 카드 후 사용자 승인 → 저장

### 4. /rehearse 수정 ✅
- **Build 유저 페르소나**: 타겟 유저 + 회의론자
- **Build 리뷰 형식**: "Would I switch?", "Why not X?", 전환 verdict
- **경량 Devil's Advocate** (에이전트 없이, 3줄로)
- **카드 포맷 개선** (2차 수정):
  - 다중열 테이블 폐기 → 페르소나별 블록 (5줄 고정)
  - `🎯 이름`, `🤨 이름` + 들여쓰기 `✗ 🔇 ▸ →`
  - 인용문 한 문장 제한
  - **저장 타이밍 변경**: 승인 후 저장

### 5. /refine 수정 ✅
- Build context: max 1 round (3 대신)
- 스펙/피처 수정 포커스
- Implementation Prompt 업데이트 포함

### 6. /argus 수정 ✅
- Context-adaptive pipeline 섹션 추가
- Build 감지 시 자동 경량화 (~5분)
- **산출물 분기**: Implementation Prompt / Product Brief / Agent Harness
- Product Brief 포맷 추가

### 7. /help 수정 ✅
- "Building something? / Making a decision?" 프레이밍
- Context-adaptive 설명 추가
- /build 참조 제거

## 프로토타입 테스트 결과

`/reframe "프리랜서용 프로젝트 관리 앱"` → `/recast` → `/rehearse` 실행

### 잘 된 것
- context: build 자동 감지 (Q1부터 제품 질문으로 전환)
- 인터뷰 시그널 매핑 작동 (niche/revenue/weekend)
- 가정 3개 제품 차원으로 도출
- Reframe 블라인드 스팟 구체적 ("경쟁자는 Notion 템플릿")
- Context Contract 체이닝 (reframe → recast → rehearse)
- Implementation Prompt 생성

### 아쉬운 점 (사용자 피드백)
- **Recast 카드 가독성 최악** — 피처 테이블 줄바꿈, 가정 테이블 깨짐
- **Rehearse 비교 테이블 최악** — 다중열 셀 줄바꿈으로 읽기 불가
- **Devil's Advocate 에세이화** — 포인트당 3-4줄, 카드답지 않음
- **자동 저장 의문** — 사용자 승인 없이 .md 생성이 맞는지

→ 카드 포맷 2차 개선 완료 (위 3, 4번). 실제 재테스트는 아직 안 함.

## 이어서 할 작업

### 즉시
1. **개선된 카드 포맷으로 재테스트** — `/reframe` → `/recast` → `/rehearse` 다시 한 바퀴
2. **Decide context 카드도 같은 문제** 있을 수 있음 — 확인 필요
3. **/refine 테스트** — build context에서 1 round refine이 잘 작동하는지

### 검토 필요
4. **Implementation Prompt 품질** — 실제로 Cursor에 넣어서 동작하는지
5. **Webapp 반영** — plugin에서 검증된 build context를 webapp 4R에도 적용
6. **바이브 코더 실사용 테스트** — 실제 타겟 유저에게 써보게 하기

## 파일 위치

| 파일 | 설명 |
|------|------|
| `argus-plugin/skills/reframe/SKILL.md` | Context detection + build 인터뷰/가정/전략 |
| `argus-plugin/skills/recast/SKILL.md` | Build 피처 스펙 + Implementation Prompt + 개선 카드 |
| `argus-plugin/skills/rehearse/SKILL.md` | Build 유저 페르소나 + 개선 카드 |
| `argus-plugin/skills/refine/SKILL.md` | Build max 1 round |
| `argus-plugin/skills/argus/SKILL.md` | Context-adaptive pipeline + 산출물 분기 |
| `argus-plugin/skills/help/SKILL.md` | 업데이트된 도움말 |
| `argus-plugin/skills/build/SKILL.md` | 아카이브 (참고용, 미설치) |
| `.argus/reframe.md` | 테스트 결과 — 프리랜서 PM 앱 reframe |
| `.argus/recast.md` | 테스트 결과 — 프로덕트 스펙 (구 포맷) |
| `.argus/rehearse.md` | 테스트 결과 — 페르소나 리뷰 (구 포맷) |
| `.argus/journal.md` | 저널 — 기존 4개 + 오늘 3개 엔트리 |
