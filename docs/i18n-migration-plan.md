# Argus i18n Migration Plan — locale-as-route, reactive, en-first

> **상태**: 2026-06-22 창업자 판단 4개 확정 후 재작성. 이전 버전(`?lang` + reload)은
> 폐기. 이 문서가 단일 소스다.

## 배경

처음 온 영어 사용자가 영어 랜딩 안에서 한국어를 만난다(워크스페이스/토스트/시드
페르소나/LLM 결과). 근원은 번역 데이터가 아니라 **locale 아키텍처**다 — 기본값이
세 곳에서 갈린다: `useLocale()`/SSR=`en`, `t()`/`getCurrentLanguage()`/설정스토어=`ko`.

## 확정된 아키텍처 (창업자 판단 4개)

| 축 | 결정 | 구현 |
|---|---|---|
| D1 기본 locale | **엣지에서 결정** | `proxy.ts`가 `?lang → cookie(argus-locale) → Accept-Language`로 결정, locale-less 경로를 `/{locale}`로 redirect |
| D2 반응성 | **LocaleProvider 단일화** | 경로의 `[locale]` 세그먼트가 진실의 소스 → `useLocale()`/`useT()`가 context 구독 → 전환=navigate(리렌더), reload 없음 |
| D3 SSR/SEO | **경로 기반 `/en` `/ko`** | App Router `[locale]` 세그먼트, 언어별 canonical + hreflang |
| D4 시드 | **en 기본 + ko 변형** | `DEFAULT_PERSONAS_EN` / `DEFAULT_PERSONAS_KO`, seed 시 locale 분기 |

원칙(유지):
- **영어가 source, 한국어가 번역.** LLM 프롬프트는 영어 1벌 + `Respond in {locale}`.
- **에이전트 이름(수진/현우/동혁…)은 캐릭터 정체성 → 유지.**
- **사주(`/boss/saju`)는 이미 locale-gate → 손대지 않음.**

## 키스톤: LocaleProvider 단일 소스

```
src/app/[locale]/layout.tsx  ──reads params.locale──▶ <LocaleProvider locale>
                                                          │
            ┌─────────────────────────────────────────────┼──────────────────────┐
            ▼                          ▼                    ▼                      ▼
      useLocale() (context)     useT()/L() (context)   setModuleLocale()    <html lang> + metadata
       리액티브, 구독            리액티브 번역           (t()/getCurrentLanguage 등
                                                         非-React 호출부 일관)
```

- `useLocale()`: context 우선, provider 없으면(테스트 등) 기존 fallback.
- `useT()`: 새 훅. context 구독 → 전환 시 즉시 리렌더.
- `t()` / `getCurrentLanguage()`: 모듈 레벨 `currentLocale` 미러를 읽도록 변경
  (기본 `'ko'` 제거). LocaleProvider가 mount/locale 변화 시 미러를 set. 엔진이
  프롬프트 빌드할 때 이 값을 읽는다.
- 전환: `useLocaleSwitch().switchTo(next)` → `router.push(/{next}/...)` (reload 폐기).

## 실행 순서 (멈춰도 실익이 남게)

### Phase 0 — 사용자-대면 버그 죽이기 (기본값 정렬 + 반응성)
1. `LocaleProvider` 생성 (context + 모듈 미러 sync).
2. `i18n/index.ts`: `t()`/`getCurrentLanguage()` 기본 `'ko'` → 모듈 미러. `useT()` 추가.
3. `useLocale()`: context 구독. `useSettingsStore` 기본 `language: 'ko'` 처리.
4. `useLocaleSwitch()`: reload → `router.push`.

### Phase 1 — 경로 기반 라우팅 (D1+D3)
5. `proxy.ts`: locale redirect (`?lang→cookie→Accept-Language`) + 쿠키 set. `/api`,`_next` 제외.
6. 비-API 라우트 전부 `src/app/[locale]/` 아래로 이동 (git mv). `/api`·메타데이터 루트 유지.
7. 루트 `layout.tsx` → `<html>`/`<body>`/`<Providers>` 셸만, locale은 `[locale]/layout.tsx`에서.
8. 내부 `<Link href>`·`router.push`를 locale-prefix 인지하도록 (헬퍼 `localeHref()`).
9. `generateMetadata`: `[locale]` 기반 canonical + hreflang.

### Phase 2 — 시드 콘텐츠 (D4)
10. `DEFAULT_PERSONAS_EN`/`_KO` 분기. (CLAUDE.md 필드 체크리스트 준수.)

### Phase 3 — LLM 프롬프트 (영어 1벌 + locale 디렉티브)
11. `progressive-prompts.ts`: `Korean only` → `Respond in ${locale}`. build* 함수에 locale 파라미터.
12. `progressive-engine.ts`: locale 배관 (모듈 미러에서).
13. `agent-skills.ts` / `guard-rails.ts` / `task-classifier.ts` / `worker-quality.ts`: 영어/이중 패턴.

### Phase 4 — 문자열 스윕 (남은 한국어 하드코딩)
14. 랜딩 hero(ForkPath 등) · 워크스페이스 · 토스트 · 예시 등 `L()`/`useT()` 적용.
15. `return-email.ts`(STUB, 발송 미배선) — locale화하되 우선순위 낮음.

## 검증
- `?lang` 없이 EN Accept-Language → `/en`으로 redirect, 영어 SSR, 한국어 0.
- KO Accept-Language → `/ko`, 한국어 SSR.
- 헤더 언어 토글 → reload 없이 즉시 전환 (D2).
- 기존 테스트 전부 통과 + `persistence-contract`/`schema-drift` 가드 통과.
- en/ko 키 parity 유지 (302/302).
