# Test Coverage Analysis (2026-07-06)

> 한 줄 요약: **"머리(로직)는 잘 챙겼는데, 손발(외부 연결·저장)이 비어있다."**
> The brain (pure logic) is well-tested; the extremities (trust boundaries and
> the persistence layer) are where the gaps are.

이 문서는 `claude/test-coverage-analysis-j6lv6r` 브랜치에서 진행 중인 테스트
보강 작업의 근거와 계획을 기록한다. 네 개의 갭을 우선순위 순으로 하나씩 채운다.

---

## Baseline (측정 시점)

- 웹앱(`src/**`) 테스트: **184 파일 / 2,656 케이스 전부 통과**.
- 별도 패키지 `argus-mcp/**`, `argus-plugin-v2/**`는 자체 하네스로 CI에서
  따로 돌린다(루트 vitest에서 제외). 이 문서/작업의 범위는 **웹앱(`src/**`)**.
- 소스 규모(대략): `src/lib` 153개 · 컴포넌트 166개 · 스토어 23개 · API 라우트 33개.

## 잘 되어 있는 것 (유지)

핵심 두뇌 로직과 CLAUDE.md 불변식이 이미 잘 덮여 있다 — 이 패턴은 유지·확장한다.

- **엔진/프롬프트 코어**: `reframe-core`, `recast-core`, `decision-contract`(5),
  `progressive-engine`(3), `navigator`(4), `orchestrator-select`(5) 등.
- **구조 가드(깨지면 CI가 빨개짐)**: `schema-drift`, `persistence-contract`,
  `erasure-coverage`, `snapshot-consumption-contract`, `spine-drift`,
  `contract-provenance`. 이것이 "그럴듯한 오답을 조용히 내는 것"을 막는 방어선.

---

## 갭과 계획 (우선순위 순)

### Gap 1 — API 라우트 핸들러 (최우선 🔴, 보안 경계)

33개 API 라우트 중 **31개가 핸들러 레벨 테스트 없음** (colocated 테스트가 있는
것은 `mcp/seal`, `llm` 둘뿐). 하필 서버 측 **신뢰 경계**가 여기 몰려 있다.

| 라우트 | 테스트 안 된 보안 로직 |
|---|---|
| `slack/events` | HMAC-SHA256 요청 서명 검증 |
| `telegram/webhook` | secret-token 헤더 검증 + 소유권 확인 (주석: "callback/token payloads are attacker-typable") |
| `email/inbound` | webhook secret + To 주소에서 reply-token 추출 |
| `account/delete`, `account/export` | 파괴/PII 반출 전 Bearer 토큰 **소유권** 검증 |
| `share/link`, `plugin/token`, `plugin/ingest` | Bearer/PAT 인증 + 토큰 해시 해석 |
| `boss/saju` | 미인증 라우트의 IP별 일일 호출 제한 |

이 경로의 회귀는 UI에는 안 보이지만(무증상) 결과가 치명적이다(인증 우회,
계정 간 데이터 노출, 웹훅 스푸핑). 테스트 방향: 각 라우트마다 (a) 서명/시크릿
누락·오류 시 거부, (b) 토큰이 대상 소유자가 아니면 거부, (c) 정상 경로 통과.
`mcp/seal/__tests__/route.test.ts`의 체인형 Supabase 스텁 패턴을 재사용한다.

### Gap 2 — Zustand 스토어 (저장 계층 🟠)

23개 중 **11개 스토어가 테스트 참조 0**. 그중 레버리지가 큰 것:

- **`createItemStore`** — `useProject`/`useReframe`/`useRecast`/`useSynthesize`
  4개가 공유하는 뿌리 팩토리. 여기 버그 하나면 4곳이 동시에 깨진다. localStorage
  우선 + Supabase 비동기 병합 seam이라 CLAUDE.md가 "조용히 유실된다"고 경고한 곳.
- `useHandoffStore` — 단계 간(decompose→recast→persona) 일회성 전달. 여기서
  데이터가 새면 맥락이 조용히 유실된다.
- 그 외: `useDecisionItemsStore`, `useBossStore`, `useTelegramStore`,
  `useSlackStore`, `useSynthesizeStore`, `useTeamStore`, `useWorkspaceStore`,
  `useAccuracyStore`, `usePluginStore`, `useAgentAttentionStore`.

### Gap 3 — 큰데 커버리지 0인 lib 모듈 (🟡)

어떤 테스트에서도 import되지 않음(파일명 불일치가 아니라 실제 0):

- **`numeric-drift.ts`** (431 LOC) — 파일 주석상 "3-valued MATERIALITY engine".
  중요도/드리프트 판정 엔진에 테스트 0 = spine 민감 영역 옆의 실질 위험.
- **`review-prompt.ts`** (320) — "웹앱+플러그인 공유 엔진" (drift 위험 큰 곳).
- **`plugin-ingest-core.ts`** (247) — 플러그인→웹앱 브리지, ledger+bearing를
  Supabase 행으로 접는 유일한 지점(두 호출자 공유).
- 여력 되면: `persona-refiner`(575), `worker-personas`(424), `agent-planner`(379),
  `guard-rails-schema`(284), `context-strategy`(305).

### Gap 4 — 커버리지 측정 자체가 안 됨 (🟡)

- `package.json`에 `test:coverage`는 있으나 provider(`@vitest/coverage-v8`)가
  **미설치** → 지금 그 명령을 돌리면 에러.
- CI(`ci.yml`)는 `vitest run`만 하고 **커버리지 수집/기준선 없음** → 조용히 감소 가능.
- 컴포넌트 테스트 15/166 (대부분 시각적이라 비율 자체는 문제 아님 —
  `workspace/progressive/*-render`의 핵심 렌더 가드는 이미 있음).

---

## 진행 상황 (checklist)

- [x] **Gap 1: API 라우트 인증/보안 테스트** — 7개 라우트, 45 케이스
  (`slack/events` HMAC+replay, `account/delete`·`account/export` bearer 소유권,
  `email/inbound` secret+토큰, `boss/saju` rate-cap, `share/link` auth+guard,
  `telegram/webhook` secret gate). 각 라우트 (a) 서명/시크릿 오류 거부,
  (b) 비소유 토큰 거부, (c) 정상 경로 통과.
- [x] **Gap 2: `createItemStore` + 미테스트 스토어** — 22 케이스.
  `createItemStore`(4개 스토어 공유 팩토리, load/merge·add·update·delete·
  nested), `useHandoffStore`(set/clear+track), `useDecisionItemsStore`
  (dedup·toggleMonitoring external=true·selectors·merge).
- [x] **Gap 3: 커버리지 0 lib 모듈** — 35 케이스.
  `numeric-drift`(3-valued materiality 엔진, under-fire 기본값 고정),
  `plugin-ingest-core`(fold + round-trip 보호: stale local이 web-settle을
  못 되돌림), `review-prompt`(locale/mode + prompt-injection 방어).
- [x] **Gap 4: 커버리지 provider 설치 + CI 배선** — `@vitest/coverage-v8` 설치,
  `vitest.config.ts`에 coverage(v8, text·json-summary·html, `src/**` 대상) 설정,
  CI에 **측정 전용**(비차단) 스텝 + 아티팩트 업로드 추가. 임계값 gate는
  베이스라인 합의 후 ratchet (다음 단계).

**합계: 13개 테스트 파일 신규, 111 케이스 추가** (웹앱 스위트 2,656 → 2,767).

### 다음 단계 (후속 PR 후보)

1. 커버리지 **베이스라인 확정 → 임계값 ratchet** (지금은 report-only).
2. 남은 미테스트 스토어(`useBossStore`·`useTelegramStore`·`useSlackStore`·
   `useTeamStore`·`useSynthesizeStore`·`useWorkspaceStore` 등).
3. 남은 lib 모듈(`persona-refiner`·`worker-personas`·`agent-planner`·
   `guard-rails-schema`·`context-strategy`).
4. 남은 보안 라우트(`plugin/token`·`plugin/ingest`·`slack/oauth`·`mcp/receipts`).
