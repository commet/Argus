# EXECUTION CUT — "첫 라이브 신호" (v4 → 실행)

> v4(`MASTER-DIRECTION-v4.md`)를 **다시 쓰지 않는다.** 이 문서는 v4를 *현재 코드 기준으로 감사*해서 뽑은 얇은 실행 백로그다.
> 원칙: v4의 effort 태그는 전부 `[INTENT]`, 리소스는 **솔로**라고 가정 → "검증된 거대 플랜"보다 "살아있는 신호 먼저".
> 감사 시점 기준: `main @ e013ffe` 머지 직후 (PR #6가 L0의 상당 부분을 이미 집행함).

---

## A. 이미 집행됨 (PR #6 — 재작업 금지)

v4가 "수정 전"으로 기술한 L0 항목 대부분이 **이미 들어가 있다.** 다시 손대지 말 것:

| v4 항목 | 위치 | 상태 |
|---|---|---|
| P0 스트림 hang watchdog (idle + 180s cap, idle/cap 구분) | `llm.ts:696-779` | ✅ |
| ADD-4 1차: 첫화면 Cancel + 경과 타이머 | `workspace/page.tsx:167-266,591,598` | ✅ |
| P1 null-deref (brief export) | `project-brief.ts:130,133` | ✅ |
| P1 null-deref (judgment eval) | `eval-engine.ts:183-184` (`steps?.length ?? 0`) | ✅ |
| P1 silent auto-accept (no-callback도 '깨끗한 완료' 위장 안 함) | `worker-engine.ts:265-290` | ✅ |
| P1 storage **WRITE** 토스트 (`argus:storage-error` + quota) | `storage.ts:44-50` | ✅ |
| ADD-6 observable-async-write + analytics canary | `sync-health.ts`, `analytics.ts:174-180` | ✅ |
| §UX-L1 hero value-prop + CTA (`href=/workspace`) | `Act1Voyage.tsx:127-152` | ✅ |

---

## B. 실제로 남은 잔여 (현재 코드 기준)

### B1. 텔레메트리 진실 floor — **THE 신호 (최우선)**
**왜:** 이벤트가 거짓이면 모든 go/no-go가 장님. v4 §4.1.
- ❌ **`landing_hero_submit` emit 0개** → 주 CTA(hero "무료로 시작하기")가 펀넬에서 안 잡힘. Act3 helm(`landing_cta_click`)만 잡힘.
  - **fix:** `Act1Voyage.tsx` hero CTA `onClick`에 `track('landing_hero_submit', { cta: 'hero_start' })`.
- ◻︎ (후속, 비차단) `landing_cta_click`을 `cta` 디스크리미네이터로 분해 — 대시보드 per-CTA 분리. 펀넬 스테이지(세션 단위 OR 매칭)는 hero emit만으로 살아남.

### B2. 디자인 정직성 — 거짓 주석 (cheap, near-zero risk)
- ❌ `globals.css:6` `/* Gold — contrast-safe on white (4.5:1+) */` — **거짓**(실측 3.9:1). 주석 삭제/정정.
- ◻︎ (후속) 토큰 대비 darken은 **contrast checker 재측정 후** — 지금은 `[ASSUMPTION]`이라 추측값으로 토큰 바꾸지 않음. CI contrast assertion은 그때.

### C. 의도적으로 미룸 (v4가 과대평가했거나 라이브 경로 아님)
- **auto-persona 무음 `return []`** — `extractPersonasFromContext`는 **테스트에서만 호출**(라이브 경로 = `suggested_reviewers` + `recommendBlindSpotPersona`). rage-quit 아님 → defer.
- **storage READ shape/version 가드** — `getStorage`는 이미 throw 안 함(catch→fallback). "shape drift"는 크래시가 아니라 stale이고, 모든 콜러가 shape를 넘겨야 하는 큰 리팩터 → L3a 버저닝과 함께.
- **reduced-motion 전역 catch-all** — 선택적 allowlist는 이미 있음(globals.css 4곳). 전역 `*` 규칙은 §5 디자인 패스에서.

---

## D. 이번 컷의 정의 (Definition of Done)
1. hero CTA가 `landing_hero_submit` emit → 다음 일일 리포트 펀넬 "랜딩 CTA"에 주 CTA가 잡힌다.
2. `globals.css`의 거짓 contrast 주석이 사라진다.
3. `npm run lint` + `vitest` green.

그 다음: 라이브 신호(펀넬/코호트)를 보고 v4 §4 probe(30일 재항해, 5인 테스트)로 넘어간다. **L2·L3b·L5는 kill-test 통과 전까지 손대지 않는다.**
