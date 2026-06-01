# Argus i18n Migration Plan — 영어 기본, 한국어 번역

## 배경

LinkedIn에서 유입된 32명의 en-US 사용자가 전원 0초 이탈. 랜딩은 영어 대응 완료(2026-04-06), 나머지 페이지와 LLM 프롬프트는 한국어 하드코딩.

## 원칙

- **영어가 기본(source), 한국어가 번역**
- **LLM 프롬프트는 영어 1벌 + `Respond in {locale}` 디렉티브**
- **UI 텍스트는 기존 `useLocale()` 훅 + `L(ko, en)` 패턴 사용**
- **에이전트 이름(수진, 현우, 동혁)은 캐릭터 정체성이므로 유지**

## 작업 범위

### 1. LLM 프롬프트 전환 (최우선, 가장 위험)

**파일**: `src/lib/progressive-prompts.ts` (~600줄)

변경할 것:
- 모든 `Korean only` → `Always respond in ${locale}.` (locale은 파라미터로 받음)
- 한국어 예시를 영어로 교체하되, 프롬프트 구조/의도는 그대로
- user prompt의 한국어 지시문 → 영어로 교체
- JSON 포맷 안의 한국어 설명 → 영어로

```typescript
// 변경 전
system: `... Korean only. Direct, specific — no academic tone. ...`

// 변경 후  
system: `... Always respond in ${locale === 'ko' ? 'Korean' : 'English'}. Direct, specific — no academic tone. ...`
```

**주의**: 프롬프트의 의도와 톤을 바꾸면 안 됨. 영어로 번역만.

구체적 변경 위치 (grep으로 확인된 것):
- L24: `Korean only` → locale 디렉티브
- L116: `Korean only` → locale 디렉티브  
- L245: `Korean only. 바로 쓸 수 있는 결과물을 만들어` → locale 기반
- L296: `Korean only` → locale 디렉티브
- L307: `Professional Korean` → `Professional ${locale === 'ko' ? 'Korean' : 'English'}`
- L365: `natural conversational Korean` → locale 기반
- L479: `Korean only` → locale 디렉티브
- L514: `Korean only` → locale 디렉티브

**locale을 어떻게 전달할 것인가**:
- `buildInitialAnalysisPrompt(problemText, locale)` — 2번째 파라미터로
- `buildDeepeningPrompt(..., locale)` — 마지막 파라미터로
- `buildWorkerTaskPrompt(..., taskType, locale)` — 마지막 파라미터로
- 나머지 build* 함수들도 동일

locale 값은 `progressive-engine.ts`에서 전달. engine은 `useSettingsStore` 또는 `getCurrentLanguage()`에서 가져옴.

### 2. Worker/Agent 프롬프트 전환

**파일**: `src/lib/agent-skills.ts` (~700줄)

변경할 것:
- 프레임워크 이름은 이미 영어 많음 (MECE, SWOT, Porter 5F). 한국어 설명만 영어로
- `levelPrompts` (junior/senior/guru 지시문): 영어로 교체
- `checkpoints`: 영어로 교체
- `outputFormat`: 영어로 교체

```typescript
// 변경 전
frameworks: ['MECE 분류: 빠짐없이, 겹침없이 분류']

// 변경 후
frameworks: ['MECE Classification: Mutually Exclusive, Collectively Exhaustive']
```

### 3. Guard-rails 한국어 키워드

**파일**: `src/lib/guard-rails.ts`

변경할 것:
- 검증기의 한국어 키워드에 영어 대응 추가 (이중 매칭)

```typescript
// 변경 전
const failureKw = countMatches(output, ['실패', '망', '붕괴']);

// 변경 후
const failureKw = countMatches(output, ['실패', '망', '붕괴', 'fail', 'collapse', 'crisis']);
```

### 4. Task Classifier 영어 패턴

**파일**: `src/lib/task-classifier.ts`

변경할 것:
- 이미 일부 영어 패턴 있음. 한국어 패턴과 동등하게 영어 패턴 보강

### 5. UI 텍스트 (페이지별)

**파일들** (우선순위 순):
1. `src/app/workspace/page.tsx` + `ProgressiveFlow.tsx` — 핵심 워크플로우
2. `src/app/demo/` — 데모 시나리오
3. `src/components/workspace/progressive/WorkerCard.tsx` — 에이전트 결과 UI
4. `src/app/settings/page.tsx` — 설정
5. 나머지 페이지들

**패턴**: 기존 `useLocale()` + `L(ko, en)` 그대로 사용

```tsx
const locale = useLocale();
const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

<button>{L('반영', 'Apply')}</button>
```

### 6. Specificity/Quality 검증 영어 대응

**파일**: `src/lib/worker-quality.ts`

변경할 것:
- `GENERIC_PHRASES`에 영어 제네릭 문구 추가
- `checkSpecificity`에서 영어 수치 패턴 추가

## 실행 순서

1. **progressive-prompts.ts** — locale 파라미터 추가 + 디렉티브 전환 (가장 중요)
2. **progressive-engine.ts** — locale을 prompt 함수들에 전달하는 배관
3. **agent-skills.ts** — 프레임워크/체크포인트/레벨프롬프트 영어 전환
4. **guard-rails.ts + task-classifier.ts + worker-quality.ts** — 이중 언어 패턴
5. **UI 컴포넌트들** — 페이지별 L() 적용

## 검증

- 영어로 "I need to write a project proposal for my CEO" 입력 → 영어로 분석 나오는지
- 한국어로 "대표님이 기획안 써오라고 했어" 입력 → 한국어로 분석 나오는지
- guard-rails가 영어 결과물도 제대로 검증하는지
- 기존 한국어 테스트 (1009개) 통과하는지
