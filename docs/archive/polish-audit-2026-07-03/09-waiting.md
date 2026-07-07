# 09 — 기다림의 품질 감사 (모든 스피너 심문)

감사일: 2026-07-03 · 대상: 웹앱 전체 (LLM 호출 · 로그인 · 동기화 · 화면 전환 · 이메일/텔레그램 발송)
방법: loading/spinner/pending/busy 상태 전수 grep(83개 파일, 311건) 후 실제 코드 열어 확인. 추측 없음.

---

## 요약 (5줄)

1. **핵심 항해 경로의 기다림은 이미 모범 수준이다** — 첫 분석(경과초·"보통 20~40초"·취소·스트리밍), 진행 상태바(30초 장기대기 승격·항상 취소 가능), 문서 검수(150초 총예산·정직한 시간초과 안내)까지, 과거 "73초 무한 스피너" 계열은 대부분 봉합됐음을 재검증했다.
2. **딱 한 곳, 앱 대문에 옛날 자물쇠가 남았다** — 로그인 세션 확인(`getSession`)에 타임아웃이 없어서, 이게 멈추면 로그인 화면·프로젝트·에이전트·팀 전부가 "돌아가는 원 하나"로 영영 멈춘다. 같은 위험을 다른 두 곳은 이미 4초 컷으로 고쳤는데 이 곳만 빠졌다. (P0)
3. **동기화 배지가 두 방향으로 거짓말한다** — 확인한 적 없는 초록 "동기화됨"을 기본으로 보여주고, 반대로 한 번 실패하면 이후 성공해도 영영 "백업 보류"에 갇힌다(성공 신호를 쏘는 코드가 앱 어디에도 없음). (P1)
4. **레거시 도구 4종의 로딩은 연출이다** — 실제 진행과 무관하게 2.5초마다 단계가 넘어가는 가짜 진행 표시에, 취소 버튼도 경과 시간도 없다. LLM 재시도 최악 케이스(약 8분)와 만나면 가장 긴 침묵의 기다림이 된다. (P1)
5. **작은 스피너 누수 2건** — 텔레그램 연결 버튼(에러 시 영구 스피너), OAuth 콜백 "로그인 중..."(타임아웃 없음). 나머지 버튼류는 finally로 잘 풀리지만 fetch 자체에 타임아웃이 없는 패턴이 공통으로 남아 있다. (P1~P2)

---

## 먼저: 잘 지켜지고 있는 것 (재검증 완료 — 건드리지 말 것)

과거 감사에서 고쳤다고 기록된 것들을 코드로 다시 확인했다. 전부 실재한다.

| 항목 | 위치 | 확인 내용 |
|---|---|---|
| 스트리밍 워치독 | `src/lib/llm.ts:837-852` | 30초 무응답(idle) 또는 300초 총초과(cap) 시 스트림 강제 종료 + 정직한 에러 문구("응답이 지연되어 요청을 중단했습니다") |
| 비스트리밍 시도당 캡 | `src/lib/llm.ts:180-181` | 시도 1회당 120초 하드 캡 (죽은 소켓이 브라우저 기본 수 분을 못 끌게) |
| 인증 4초 컷 (LLM 경로) | `src/lib/llm.ts:465-468` | `getSession` 4초 레이스 — 멈추면 토큰 없이 진행 |
| 인증 4초 컷 (DB 경로) | `src/lib/supabase.ts:42-45` | `getUser` 4초 레이스 — 멈추면 익명 취급 |
| 웹검색 8초 캡 | `src/lib/worker-engine.ts:445-461` | 시간초과 시 검색결과 없이 진행 (워커를 안 막음) |
| 첫 분석 대기 화면 | `src/app/[locale]/workspace/page.tsx:880-897` | 경과초 표시, "보통 20~40초" 정직한 예상치, 취소 버튼, 스트리밍 필드별 렌더, aria-live |
| 분석 병렬 선실행 | `src/app/[locale]/workspace/page.tsx:366-378` | BindCard를 채우는 동안 분석이 이미 뒤에서 돌고 있음 — 낙관적 병렬화의 모범 |
| 진행 상태바 | `src/components/workspace/progressive/ProgressiveFlow.tsx:230-371` | 취소가 처음부터 항상 노출, 30초 넘으면 앰버 "오래 걸리고 있어요 — 계속 진행 중" 승격, substage("계획을 시험하는 중" 등) |
| 문서 검수 총예산 | `src/components/review/ReviewFlow.tsx:43, 189-221` | 150초 벽시계 데드라인 + 시간초과 시 "문서를 더 짧게 나눠서" 복구 안내 + 취소 시 입력 보존 |
| 봉인·정산 대기 없음 | `src/components/projects/SettlementModal.tsx`, `src/components/workspace/progressive/WakeReturn.tsx` | `await` 자체가 없음 — 완전 낙관적(로컬 즉시), 기다림 0초. 이상적 |
| 스트림 파싱 실패 강등 | `src/lib/llm.ts:978-987` | 잘린 스트림 → 자동으로 non-stream 재호출 (사용자 얼굴에 "JSON 파싱 실패" 안 던짐) |
| 고아 'analyzing' 복구 | `src/components/workspace/RecastStep.tsx:353-358` | 새로고침 후 분석 중이던 항목을 입력 상태로 되돌림 (영구 로딩 카드 방지) |
| 사주 조회 5초 캡 | `src/stores/useBossStore.ts:157-180` | 하드 캡 + finally 리셋 |

---

## 발견 목록 (심각도순)

### P0-1. 앱 대문의 마지막 자물쇠 — 세션 확인에 타임아웃이 없다

**무엇**: 앱이 켜질 때 "로그인돼 있나?"를 확인하는 단 하나의 호출에 시간 제한이 없다.

- `src/lib/auth.tsx:70-77` — `supabase.auth.getSession().then(...)`. 이 프라미스가 안 풀리면 `loading`이 영영 `true`.
- 이 `loading` 하나에 묶인 화면들:
  - `src/app/[locale]/login/page.tsx:109-115` — **로그인 화면 자체**가 문구 없는 원 하나로 무한 대기
  - `src/components/layout/AuthGuard.tsx:69-75` — /project·/agents·/teams 전부 문구 없는 원 하나
  - `src/components/layout/Header.tsx:290` — 헤더의 로그인/사용자 영역이 아예 안 그려짐

**왜 P0인가**: 과거 실사고("73초 상황읽는중" — Web Locks 교착)와 정확히 같은 계열이다. 그때 근본 원인(락)은 `src/lib/supabase.ts:20`의 `processLock`으로 제거했고, LLM 경로(`llm.ts:465`)와 DB 경로(`supabase.ts:42`)에는 4초 컷을 달았는데, **정작 제일 앞문인 이 곳만 빠졌다**. `getSession`은 토큰이 만료돼 있으면 네트워크로 갱신을 시도한다 — 즉 "한 시간 넘게 있다가 돌아온 사용자 + 불안정한 네트워크"라는 흔한 조합에서 로그인 화면이 통째로 멈출 수 있다.

**같은 계열의 형제 누락**: `src/lib/api-account.ts:8-13`의 `bearer()`도 `getSession`을 레이스 없이 기다린다. 여기가 멈추면 설정의 "내보내기"/"영구 삭제" 버튼 스피너(`settings/page.tsx:638, 749`)가 영영 안 풀린다 (finally는 예외에만 반응하지, 안 끝나는 await에는 무력하다). `ShareComposer.tsx:225, 305`도 동일.

**고치는 법**: 스펙 S1 참조.

---

### P1-1. OAuth 콜백 "로그인 중..." — 코드 교환에 타임아웃이 없다

**무엇**: 구글 로그인에서 돌아온 직후 화면.

- `src/app/[locale]/auth/callback/page.tsx:25` — `await supabase.auth.exchangeCodeForSession(code)`에 타임아웃 없음. 네트워크가 멈추면 스피너 + "로그인 중..."(:46-47)이 영구.
- 에러 시 리다이렉트(:26-29)는 잘 돼 있다. 문제는 오직 "안 끝나는 경우".

**고치는 법**: 스펙 S2.

---

### P1-2. 텔레그램 연결 버튼 — 네트워크 실패 한 번이면 영구 스피너

**무엇**: 설정 → Telegram 연결하기.

- `src/app/[locale]/settings/page.tsx:830-845` — `handleConnect`에 try/catch가 없다.
- `src/stores/useTelegramStore.ts:67-72` — `startConnect`의 `fetch`가 네트워크 오류로 거부되면 그대로 throw.
- 결과: `setPending(true)`(:832) 후 예외가 위로 터지면서 `setPending(false)`(:844)에 영영 도달 못함 → 버튼이 스피너 상태로 잠긴 채(disabled) 새로고침 전까지 복구 불가.

같은 스토어의 `sendToTelegram`(:85-102)은 finally로 지켰고, `loadConnections`(:52-61)는 주석에 "영구 스피너 방지"라고 스스로 적어두기까지 했다 — 그 교훈이 `startConnect`에만 적용 안 됐다.

**고치는 법**: 스펙 S3.

---

### P1-3. 비스트리밍 LLM — 총예산이 없고, 재시도가 침묵한다

**무엇**: `src/lib/llm.ts:167-249` `fetchWithRetry`.

- 시도 **1회당** 120초 캡(:180-181)은 있지만, `maxRetries = 3`이라 최악의 경우 시도 4번 × 120초 + 지수 백오프 지연 = **이론상 8분 이상**을 스피너 뒤에서 보낼 수 있다. 타임아웃도 "재시도 가능"으로 분류돼(:233-239) 루프를 계속 돈다.
- 그동안 **재시도 중이라는 사실이 UI에 전혀 전달되지 않는다**. 재시도 로그는 개발 모드 콘솔에만 찍힌다(:216-218). 사용자 눈에는 그냥 긴 침묵.
- 검수 화면은 이 위험을 스스로 알고 자체 150초 총예산으로 덮었다(`ReviewFlow.tsx:186-191` 주석: "120s × retries per call ... compounds into many minutes"). **그 방어가 llm.ts 안으로 들어가지 않아 나머지 모든 호출자(레거시 도구, QuickChatBar, PersonaForm 등)는 무방비다.**

**고치는 법**: 스펙 S4 (총예산 + 재시도 신호 이벤트).

---

### P1-4. 동기화 배지 — 양방향 부정직 (초록은 무근거, 앰버는 영구)

**무엇**: 헤더의 클라우드 배지 (`src/components/ui/SyncStatus.tsx`).

1. **무근거 초록**: 초기 상태가 `'synced'`(:16) — 로그인만 하면 **동기화를 한 번도 성공한 적 없어도** 초록 "동기화됨"이 뜬다. 확인 안 한 것을 "됨"이라고 말하는 것.
2. **영구 앰버**: 이벤트 수신부는 `'syncing'`/`'synced'` 상태를 처리하지만(:21-25), **그 이벤트를 쏘는 코드가 앱 전체에 없다.** `argus:sync` 이벤트의 유일한 발신자는 `src/lib/sync-health.ts:34-38`이고 `status: 'error'`만 보낸다 (grep으로 `status: 'synced'` 발신 0건 확인). 즉 한 번 실패해서 "이 기기에 저장됨 · 백업 보류"(:98)로 내려가면, 이후 백업이 실제로 성공해도 **영영 앰버에 머문다**. :53의 주석 "A real success event clears it to synced"는 현재 코드에서 실현 불가능한 문장이다.

기다림의 관점에서: 사용자가 "내 데이터가 클라우드에 갔나?"를 기다리며 보는 유일한 창인데, 그 창이 상태를 반영하지 않는다.

**고치는 법**: 스펙 S5.

---

### P1-5. 레거시 도구 4종 — 시계로 연출하는 가짜 진행 + 취소·경과 없음

**무엇**: `src/components/ui/LoadingSteps.tsx:14-19` — 단계가 **실제 진행과 무관하게 2.5초 간격 타이머로** 넘어가고, 마지막 단계에서 무한 스핀한다. 3단계 × 2.5초 = 7.5초 뒤부터는 어떤 정보도 갱신되지 않는다.

사용처: `ReframeStep.tsx:1071-1075, 1190`, `RehearseStep.tsx:687`, `SynthesizeStep.tsx:471`.

추가로 workspace 폴더 전체에서 `AbortController` 보유 파일은 `ProgressiveFlow.tsx`와 `TrialSail.tsx` 둘뿐(grep 확인) — 즉 **레거시 도구들(Reframe/Recast/Rehearse/Synthesize)과 tools 폴더(PersonaForm, FeedbackRequest)에는 취소 수단이 없고, 경과 시간 표시도 없다.** P1-3의 최악 8분과 결합하면 이 화면들이 앱에서 가장 긴 "침묵의 기다림"이다.

참작할 점: ReframeStep은 스트리밍 미리보기(:1079-1088)와 에러 시 "다시 시도" 버튼(:1052-1058)은 갖췄다. 문제는 진행 연출과 탈출구 부재.

**우선순위 판단**: 05-뺄셈 감사에서 이 화면들은 강등 대상이다. 화면을 남기는 동안의 최소 수리만 제안한다 (스펙 S6).

---

### P2-1. 문구 없는 원 3곳 — "무엇을 기다리는지" 말하지 않는다

같은 앱 안에서 기준이 갈린다:

| 위치 | 현재 |
|---|---|
| `src/components/layout/AuthGuard.tsx:71-73` | 원만 회전, 문구 없음 |
| `src/app/[locale]/login/page.tsx:112` | 원만 회전, 문구 없음 |
| (대비) `auth/callback/page.tsx:47` | "로그인 중..." 있음 |
| (대비) `workspace/page.tsx:1288-1289` | "워크스페이스 준비 중..." 있음 |

S1의 4초 컷이 들어가면 이 스피너들의 최장 수명이 4초가 되므로 심각도는 낮아지지만, 문구 한 줄은 그래도 넣을 가치가 있다 (스펙 S7).

### P2-2. 클라이언트 fetch 타임아웃 부재 패턴 (스피너는 풀리지만 hang에는 무방비)

busy 상태를 finally로 잘 풀고 있으나 fetch 자체가 안 끝나면 무한인 곳들:

- `src/lib/api-account.ts:18` (내보내기), `:40` (계정 삭제)
- `src/components/ui/ShareComposer.tsx:228` (공개 링크), `:308` (이메일 발송)
- `src/app/[locale]/settings/page.tsx:913` (플러그인 토큰 발급)
- `src/stores/useSlackStore.ts:85, 108` (Slack 채널/발송)
- `src/stores/useTelegramStore.ts:67, 90` (텔레그램 연결/발송)

서버 쪽도 짝이 맞는다: `src/app/api/email/send/route.ts:70`의 Resend 호출에 타임아웃 없음(플랫폼 기본 함수 제한에만 의존). 참고로 잘한 예: `src/app/api/search/route.ts`는 서버에 타임아웃이 없어도 클라이언트(`worker-engine.ts:446`)가 8초에 끊고 빈 결과로 강등한다.

**고치는 법**: 스펙 S8 (공용 헬퍼 하나로 일괄).

---

## 구현 스펙

### S1. 세션 확인 4초 컷 (P0-1) — 이미 있는 패턴을 마지막 한 곳에 복제

**파일**: `src/lib/auth.tsx:70-77`

```ts
// 기존: supabase.auth.getSession().then(...)
const sessionResult = await Promise.race([
  supabase.auth.getSession().then(r => r.data.session),
  new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
]);
setSession(sessionResult);
setUser(sessionResult?.user ?? null);
setAnalyticsUser(sessionResult?.user?.id ?? null);
setLoading(false);
```

- 타임아웃 시 **비로그인으로 간주하고 화면을 연다**. 실제로 로그인돼 있었다면 몇 초 뒤 `onAuthStateChange`(:79-97)가 어차피 발화해서 `user`를 채워준다 — 이 안전망이 이미 코드에 있으므로 오판 비용이 거의 0이다.
- `llm.ts:465-468`의 주석("critical path ... must NOT freeze")을 그대로 가져와 붙일 것.
- **함께**: `src/lib/api-account.ts:8-13`의 `bearer()`와 `src/components/ui/ShareComposer.tsx:225, 305`의 `getSession`도 같은 4초 레이스로. 세 곳 모두 같은 코드가 반복되므로, `src/lib/supabase.ts`에 `getSessionWithTimeout(ms = 4000)` 헬퍼 하나를 만들어 세 곳이 공유하는 것을 권장 (프롬프트 단일 소스 원칙과 같은 이유 — 세 번째 복사부터는 드리프트).

### S2. OAuth 콜백 타임아웃 (P1-1)

**파일**: `src/app/[locale]/auth/callback/page.tsx:23-30`

```ts
const exchanged = await Promise.race([
  supabase.auth.exchangeCodeForSession(code),
  new Promise<{ error: Error }>(resolve =>
    setTimeout(() => resolve({ error: new Error('timeout') }), 10_000)),
]);
if (exchanged.error) { router.replace('/login?error=auth_failed'); return; }
```

10초로 넉넉히 (코드 교환은 실제 왕복이 필요한 호출). 실패 문구는 기존 `?error=auth_failed` 경로를 재사용 — 로그인 페이지가 이미 표시한다(`login/page.tsx:60-68`).

### S3. 텔레그램 연결 스피너 누수 (P1-2)

**파일 1**: `src/stores/useTelegramStore.ts:64-76` — `startConnect` 본문을 try/catch로 감싸고 네트워크 실패를 리턴값으로:

```ts
startConnect: async () => {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, error: 'Not authenticated' };
    const res = await fetch('/api/telegram/connect', { ... });
    const data = await res.json();
    if (res.ok && data.link) return { ok: true, link: data.link };
    if (res.status === 503) return { ok: false, error: 'unconfigured' };
    return { ok: false, error: data.error || 'Could not start connect flow' };
  } catch {
    return { ok: false, error: 'network' };
  }
},
```

**파일 2**: `src/app/[locale]/settings/page.tsx:830-845` — `setPending(false)`를 finally로 옮기고, `error === 'network'`일 때 문구:

> `연결을 시작하지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요.`

### S4. LLM 총예산 + 재시도 정직화 (P1-3)

**파일**: `src/lib/llm.ts`

1. **총예산**: `fetchWithRetry`에 벽시계 데드라인 추가. 루프 시작 전 `const startedAt = Date.now();`, 각 재시도 진입 시(대기 후) `if (Date.now() - startedAt > TOTAL_BUDGET_MS) throw new LLMError('요청이 시간 내에 완료되지 않았어요. 잠시 후 다시 시도해 주세요.', { category: 'network', retryable: true });`. `TOTAL_BUDGET_MS = 180_000` 권장 (ReviewFlow의 150초 근거와 같은 자리수, 스트리밍 HARD_CAP 300초보다 짧게 — 비스트리밍은 짧은 구조화 호출이 대부분).
2. **재시도 신호**: 재시도 대기 직전(:216-219 부근)에 이벤트 발신:
   ```ts
   if (typeof window !== 'undefined') {
     window.dispatchEvent(new CustomEvent('argus:llm-retry', {
       detail: { attempt: attempt + 1, max: maxRetries, status: res.status } }));
   }
   ```
   소비처는 한 곳이면 충분: `ProgressiveFlow.tsx`의 `PhaseStatusBar` substage에 연결해 다음 문구를 잠깐 표시 —
   > `일시적인 오류가 있어 다시 시도하는 중 (2/3)…`
   레거시 도구는 S6에서 같은 이벤트를 받는다. 문구는 사실만: "오류가 있어 다시 시도"는 기계 상태 서술이지 판정이 아니다.

### S5. 동기화 배지 정직화 (P1-4)

**파일 1**: `src/lib/sync-health.ts` — 성공 보고 함수 추가:

```ts
export function reportSyncSuccess(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('argus:sync', { detail: { status: 'synced' } }));
  }
}
```

**파일 2**: `src/lib/db.ts` — 사용자 데이터 upsert가 **성공**한 자리(현재 `reportSyncFailure`를 부르는 두 경로 `db.ts:174, 227`의 성공 분기)에서 `reportSyncSuccess()` 호출. 이것으로 :53 주석("A real success event clears it")이 비로소 사실이 된다.

**파일 3**: `src/components/ui/SyncStatus.tsx:16` — 초기 상태를 `'synced'` 대신 새 상태 `'idle'`로. `idle`은 **배지를 그리지 않는다**(null 반환). 초록 "동기화됨"은 이 세션에서 실제 성공 이벤트를 한 번이라도 받은 뒤에만. — "확인한 것만 말한다"는 이 배지 자신의 P2 주석(:50-54) 철학을 초기값에도 적용하는 것.

### S6. 레거시 도구 최소 수리 (P1-5) — 화면을 강등하기 전까지의 응급 처치

**파일**: `src/components/ui/LoadingSteps.tsx` (한 곳만 고치면 세 도구에 모두 적용됨 — 이 파일이 공유 부품이라는 게 유일한 다행)

1. **경과 시간 추가**: 컴포넌트 안에 1초 타이머 하나 두고 마지막 줄에 표시:
   > `{elapsed}초 경과 — 오래 걸리면 새로고침해도 입력은 남아 있어요`
   (RecastStep:353-358의 고아 복구가 실재하므로 이 약속은 사실이다. Reframe/Rehearse/Synthesize에도 동일한 마운트 복구가 있는지 확인 후, 없으면 같은 4줄을 이식.)
2. **단계 연출 정직화**: 마지막 단계 도달 후에는 체크가 아닌 스피너를 유지하되 문구를 바꾼다 —
   > `아직 진행 중이에요 — 단계 표시는 대략적인 안내예요`
   …보다 나은 방법: `intervalMs` 타이머 진행을 유지하되, 마지막 단계에서 10초 이상 머물면 위 경과줄만 남기고 단계 리스트를 흐리게. (완전한 해법은 스트리밍 파서 연동이지만, 강등 예정 화면에 그 투자는 과함.)
3. (선택) S4의 `argus:llm-retry` 이벤트를 받아 같은 재시도 문구 표시.

취소 버튼(AbortController 배선)은 화면당 수술이 필요해 강등 대상 화면에는 **권장하지 않음** — S4의 180초 총예산이 상한을 만들어주는 것으로 갈음.

### S7. 문구 없는 원 2곳에 한 줄 (P2-1)

- `src/components/layout/AuthGuard.tsx:69-75`: 스피너 아래
  > `세션을 확인하는 중이에요…`
- `src/app/[locale]/login/page.tsx:109-115`: 동일 문구.

S1이 최장 4초를 보장하므로 그 이상의 장치(탈출 링크 등)는 불필요.

### S8. fetch 타임아웃 공용화 (P2-2, P2-3)

`src/lib/` 에 4줄짜리 헬퍼:

```ts
export function timeoutSignal(ms = 15_000): AbortSignal {
  return AbortSignal.timeout(ms); // 모든 근래 브라우저 지원
}
```

적용: `api-account.ts:18, 40`, `ShareComposer.tsx:228, 308`, `settings/page.tsx:913`, `useSlackStore.ts:85, 108`, `useTelegramStore.ts:67, 90` 의 fetch에 `signal: timeoutSignal()` 한 줄씩. 내보내기(:18)만 60초로(파일이 클 수 있음). 각 호출부의 기존 catch 문구가 그대로 실패 안내를 담당하므로 카피 추가 불필요. 서버 `email/send/route.ts`는 `export const maxDuration = 30;` 선언으로 플랫폼 기본 대신 명시적 상한.

---

## 스파인 충돌 검토 (maximum generation, zero judgment)

- **판정·점수 노출 없음**: 이 감사의 모든 제안은 기계 상태(연결·재시도·경과 시간)의 서술이다. 사용자에 대한 어떤 평가도 만들지 않는다.
- **S5는 스파인의 정직-표기 원칙을 기계 상태로 확장한 것**: 확인 안 한 "동기화됨"은 확인 안 한 문장을 사용자 소유로 표기하는 것과 같은 구조의 거짓이다. 성공을 확인했을 때만 초록을 켜는 것이 스파인과 정렬된다.
- **S6은 가짜(연출된 진행)를 제거하는 방향**이므로 스파인 강화다. 단, 재시도/장기대기 문구는 드라마를 만들지 말 것 — "오래 걸리고 있어요 — 계속 진행 중"(기존 PhaseStatusBar 문구)처럼 배의 사정만 담담히 서술. "죄송합니다"류 과잉 사과, "거의 다 됐어요"류 확인 안 된 약속 금지 (02-voice 가이드 원칙 4 "약속은 동작만큼"과 합치).
- **과잉개입(over-fire) 없음**: 어떤 스펙도 사용자에게 새 선택지를 들이밀거나 결정을 재개봉하지 않는다. 기다림 화면은 조용할수록 스파인에 가깝고, 이 감사의 방향은 "침묵을 없애라"가 아니라 "침묵 속에 갇히는 것을 없애라"다 — 4초 컷과 총예산은 전부 탈출구이지 개입이 아니다.
