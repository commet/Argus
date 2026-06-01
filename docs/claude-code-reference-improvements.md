# Claude Code 소스 분석 기반 Argus 개선 기록

> **날짜**: 2026-04-01
> **참조 소스**: [nirholas/claude-code](https://github.com/nirholas/claude-code) (519K LOC, 2026-03-31 유출)
> **대상**: Argus 웹앱 (46K LOC)

---

## 1. 배경

Claude Code CLI 전체 소스(1,940파일, 519K LOC)를 6개 병렬 에이전트로 분석 후, Argus에 적용 가능한 아키텍처 패턴을 식별하여 구현.

**분석 영역**: 코어 엔진(QueryEngine, query.ts), 도구 시스템(42 tools), 권한 시스템(5-way race), 서비스 레이어(API, MCP, Compact), UI(React+Ink), Bridge, Coordinator

---

## 2. 식별된 갭 & 적용 현황

### 2.1 LLM 호출 레이어 (`src/lib/llm.ts`)

| Claude Code 패턴 | 적용 내용 | 상태 |
|---|---|---|
| `errors.ts` — 에러 분류 + 재시도 판단 | `LLMError` 클래스 7카테고리 (rate_limit, overloaded, context_too_long, auth, parse_failure, network, validation) | ✅ |
| `withRetry.ts` — 지수 백오프 + credential refresh | `fetchWithRetry` 3회 재시도, jitter ±25%, 429 retry_after 존중 | ✅ |
| Circuit breaker (연속 실패 차단) | 5회 연속 실패 → 30초 차단, 자동 복구 | ✅ |
| `lazySchema()` Zod v4 — 모든 도구 입력 검증 | `shape` 파라미터로 19/21 callLLMJson 호출에 스키마 적용 | ✅ |
| `semanticNumber()`/`semanticBoolean()` — LLM 타입 오류 자동 변환 | `validateShape`에 `coerce` 옵션 (string→boolean, string→number) | ✅ |
| Structured output retry | JSON 파싱 실패 시 교정 프롬프트로 자동 1회 재시도 | ✅ |
| `StreamingToolExecutor` — 병렬 도구 실행 | `callLLMParallel<T>()` — Promise.allSettled 기반 (향후 하이브리드 멀티에이전트 시 사용) | ✅ |
| 스트리밍 + JSON 파싱 통합 | `callLLMStreamThenParse<T>()` — 실시간 표시 후 JSON 파싱 | ✅ |
| AbortController | 모든 호출에 `signal` 옵션, ProgressiveFlow에서 실제 연결 | ✅ |
| SSE 라인 버퍼링 | 불완전한 SSE 라인을 버퍼로 보관, 다음 chunk에서 합침 | ✅ |
| 3-strategy JSON 파싱 | markdown fence → 객체 추출 → 배열 추출 순차 시도 | ✅ |

### 2.2 병렬 페르소나 피드백 (`RehearseStep`, `RefineStep`)

| Before | After | 효과 |
|---|---|---|
| `for...of` 순차 실행 | `Promise.allSettled()` 병렬 실행 | 3명 기준 ~3배 속도 |
| 부분 실패 시 전체 중단 | 성공한 것만 수집, 전체 실패 시 에러 | 안정성 향상 |

### 2.3 컨텍스트 압축 (`src/lib/compact-context.ts`)

| Claude Code 패턴 | 적용 내용 |
|---|---|
| 4-layer compact (full/partial/auto/micro) | `compactQAHistory()` — 최근 2라운드 원문, 이전 1줄 요약 |
| | `compactSnapshots()` — 최신 전체 + 이전 insight delta |
| | `shouldCompact()` — 토큰 예산(3000) 초과 시 자동 트리거 |
| | `buildDeepeningPrompt`과 `buildMixPrompt`에 적용 |
| | `max_rounds` 3→5 (압축 덕분에 더 깊은 대화 가능) |

### 2.4 스트리밍 분석 UI (`ProgressiveFlow.tsx`)

| Before | After |
|---|---|
| LoadingSteps 스피너만 표시 | `onToken` 콜백으로 실시간 텍스트 표시 |
| 분석 중 취소 불가 | AbortController + 취소 버튼 |
| | `streamingText` state + motion 애니메이션 |

### 2.5 에러 카테고리별 처리 (`src/lib/error-display.ts`)

| Before | After |
|---|---|
| 모든 에러 동일 메시지 | `toDisplayError()` — 카테고리별 한국어 메시지 + retryable 플래그 |
| `err.message` 직접 표시 | `isAuthError()` — LOGIN_REQUIRED 분기 표준화 |
| | 5개 Step 컴포넌트 catch 블록 업그레이드 |

### 2.6 Dynamic Import 최적화

| 컴포넌트 | 모듈 | Before | After |
|---|---|---|---|
| ReframeStep | eval-engine | static | `lazyEvalEngine()` |
| RecastStep | eval-engine | static | `lazyEvalEngine()` |
| RehearseStep | eval-engine, judgment-vitality | static | `lazyEvalEngine()`, `lazyVitality()` |
| RefineStep | eval-engine | static | `lazyEvalEngine()` |

---

## 3. 적용하지 않은 Claude Code 패턴 (+ 이유)

| 패턴 | 이유 |
|---|---|
| React Compiler `_c()` 자동 메모이제이션 | Next.js + Bun이 아닌 환경. React 19에서 별도 설정 필요 |
| Feature flag dead code elimination (`bun:bundle`) | Bun 전용 기능, Argus는 Next.js |
| Ratchet 패턴 (높이 축소 방지) | 터미널 UI 전용, 웹앱에선 CSS overflow로 해결 |
| OffscreenFreeze (스크롤백 프리즈) | 터미널 virtual scroll 전용 |
| 5-way 권한 레이스 | CLI 권한 모델, 웹앱에선 불필요 |
| Bridge 시스템 (IDE 통합) | CLI↔IDE 전용, 웹앱 해당 없음 |
| MCP 프로토콜 | 도구 통합 프로토콜, 현재 Argus 범위 밖 |
| 풀 멀티에이전트 (Coordinator/Swarm) | 비용 3배 증가, 50초 대기 — 스마트 하이브리드(C안) 추후 구현 예정 |

---

## 4. 향후 계획

### Phase 2: 스마트 하이브리드 멀티에이전트 (C안)

```
Phase 1: 독립 리뷰 (현재, 병렬)      → 3 calls
Phase 2: 갈등점 교차 검증 (1회)       → 3 calls (짧은 응답)
최종 합성                              → 1 call
총: 7 calls, ~25초, 현재의 1.5배 비용
```

기본은 A(현재), "더 깊게 검증" 버튼으로 C 활성화하는 선택적 구조.

### Phase 3: 플러그인 시스템 개선
- Claude Code의 `buildTool()` 팩토리 패턴 참고
- 스킬별 독립 input schema + permission model
- 번들된 스킬 vs 사용자 스킬 분리

### 보류 항목
- ConcertmasterInline `React.lazy` 전환 (별도 PR)
- decision-quality.ts 렌더 내 IIFE → useEffect 리팩터링 (별도 PR)

---

## 5. 검증 결과

- **TypeScript**: 0 errors
- **Tests**: 40/40 파일, 978/978 테스트 통과
- **변경 파일**: 15개 수정, 2개 신규

### 변경 파일 목록

**신규**:
- `src/lib/compact-context.ts` — 컨텍스트 압축 유틸
- `src/lib/error-display.ts` — 에러 카테고리별 표시 유틸

**수정 (인프라)**:
- `src/lib/llm.ts` — LLM 호출 레이어 전면 업그레이드
- `src/lib/progressive-engine.ts` — 스트리밍 + signal + shape
- `src/lib/progressive-prompts.ts` — 컨텍스트 압축 적용
- `src/stores/useProgressiveStore.ts` — max_rounds 3→5

**수정 (컴포넌트)**:
- `src/components/workspace/progressive/ProgressiveFlow.tsx` — 스트리밍 UI + 취소 버튼
- `src/components/workspace/RehearseStep.tsx` — 병렬 피드백 + 에러 처리
- `src/components/workspace/RefineStep.tsx` — 병렬 재리뷰 + 에러 처리
- `src/components/workspace/ReframeStep.tsx` — shape 검증 + dynamic import + 에러 처리
- `src/components/workspace/RecastStep.tsx` — shape 검증 + dynamic import + 에러 처리
- `src/components/workspace/SynthesizeStep.tsx` — shape 검증 + 에러 처리
- `src/components/tools/PersonaForm.tsx` — shape 검증
- `src/lib/workflow-review.ts` — shape 검증

**수정 (테스트)**:
- `src/lib/__tests__/llm-simulation.test.ts` — 새 기능 테스트 추가
- `src/lib/__tests__/llm-network-simulation.test.ts` — 에러 메시지 업데이트
