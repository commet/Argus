# Argus 통합 디자인 리모델링 계획 (Claude 감사 + Codex 감사 대조·합의)

- **날짜:** 2026-07-02
- **베이스 브랜치:** `codex/align-3phase-main` (최신 main 위에 feat/3phase-integration 머지) → 최종 main 병합 목표
- **작업 브랜치:** `claude/design-remodel-czftet`
- **소스 감사 2건:**
  - `docs/DESIGN-AUDIT-2026-07-01.md` — Claude, 정적 코드 분석, 8표면 × 3렌즈(craft/guidelines/content-fit), 56 발견
  - `docs/ARGUS-DESIGN-AUDIT-PLAN-2026-07-02.md` — Codex, 실행(dev 서버)·화면 기반, 렌더링/IA 중심
- **이 문서의 목적:** 두 감사를 대조해 (A) 서로 놓친 것, (B) 합의 필요, (C) 합쳐서 통합 우선순위 사다리를 세우고, 이번 패스에서 적용한 것을 기록한다.

---

## 0. 결론 한 줄

**두 감사는 충돌보다 상호보완이 강하다.** Codex는 "실제로 렌더링되는가 + 화면(IA)"을 실행 기반으로, Claude는 "컴포넌트 단위 content-fit(제로 판단) + 세밀 a11y"를 정적으로 잡았다. 겹침은 3~4개(금색 과다, 랜딩 CTA, 카드/버튼 드리프트, 이중 언어)뿐이고 나머지는 서로 다른 층을 채운다. 합의가 필요한 실질 충돌은 **금색의 역할** 하나이며, "금색 = 사용자의 행동·소유에만" 규칙으로 수렴한다.

---

## 1. 대조 요약

### A. Codex가 잡고 Claude가 놓친 것 (검증 완료)
1. **🔴 런타임 렌더링 P0 (Claude 최대 맹점).** `/workspace` `HeroFlow` idle(`page.tsx:493-496`), `/boss` `BossSetup`(`:218-222`)의 상위 motion 래퍼가 `opacity:0`에 갇혀 **필수 본문이 실제로 안 보임**. 정적 분석은 못 잡음. → **이번 패스에서 수정 완료.**
2. **"motion 실패가 콘텐츠를 숨긴다" 시스템 원칙** — 필수 화면은 default-visible이어야. Claude S6(reduced-motion)의 상위 개념. 채택.
3. **`/settings` 정보구조** — 큰 카드+긴 폼 반복, section-nav 없음, danger zone 미격리. Claude 범위 밖.
4. **`/project`를 앱 내부 기준(reference) 화면으로** — Claude 범위 밖.
5. **실픽셀 visibility를 Playwright CI 게이트로.** → 이번 패스에서 1회 수동 실행(둘 다 PASS), CI 상시화는 후속.
6. **랜딩 데스크톱 CTA below-fold(1280×720)** — Claude는 "5초 comprehension"으로만 봄. 상호 보강.

### B. Claude가 잡고 Codex가 놓친 것
1. **🔴 content-fit / 제로판단 위반 전반** — Codex는 "금색 과다"까진 봤지만 *기계가 판정을 내린다*는 척추 위반으로 프레이밍 안 함. Trail 필름 "Argus 추천"+금테+초록✓(**CRITICAL**), VerificationGate gold/red, SealMoment 세리머니 stakes 미스케일, CurrentBearingCard verdict pill, FinalCard 승리, Falsification accent, Boss calibration auto-fire, inner-monologue 점술 스타일.
2. **judgment-per-keystroke 저장**(`SynthesizeStep:501`) — patterns/vitality 학습 신호 오염.
3. **다크모드 토큰 parity** — Badge ai/human provenance가 다크에서 dark-on-dark.
4. **구체 a11y 위치** — autoplay 필름 WCAG 2.2.2, SeaChart step-back 키보드 불가, raw `<a>` locale 유실, focus ring 2곳, 스트리밍 dead code.
5. **`VoyagePhaseRail` orphaned** — feat/3phase엔 배선됐으나 정렬 머지가 "workspace UI는 main 우선"으로 되돌려 다시 dead. → **이번 패스에서 되살림.**

### C. 합의(조율) — 2건
**C1. 금색의 역할 (유일한 실질 충돌).**
- Codex: 금색 = 확정/봉인/**현재 방위**/**중요한 결론**에 집중.
- Claude: 봉인 세리머니와 *기계가 낸 결론*에 금색 쓰는 게 바로 verdict/over-ceremony 위반.
- **합의안:** **금색 = 사용자의 행동·소유에만** (최종 커밋, 실제 CTA, 사용자가 정한 현재 방위, settlement의 "Right call"). **기계가 낸 결론·추천엔 금지.** 봉인 세리머니는 **stakes-gated**(진짜 비가역 고-stakes만). "현재 방위"는 사용자 소유라 gold 가능하지만 "Argus 추천"과 co-brand는 금지.

**C2. blueprint/logbook 앱 전체 승격 (Codex) vs 이중 레지스터는 의도적 (Claude S7).**
- **합의안 (층위 분리):** *기본 재질 언어*(ink/paper/line/chart) = 앱 전체로 **승격**. *세리머니 요소*(seal stamp, gold flourish) = 승격하지 말고 **stakes 게이트**. "차분한 부분은 승격, 드라마는 격리." `--bp-*` 재질 토큰은 앱에서도 쓰되 `.bp-seal-stamp` 류는 landing-only/게이트 유지.

---

## 2. 통합 우선순위 사다리 (진행 상태 포함)

### P0 — 렌더링 복구 (Codex) + 척추/판정 제거 (Claude)
- [x] **/workspace HeroFlow idle opacity 트랩** — `AnimatePresence initial={false}` (`page.tsx:493`)
- [x] **/boss BossSetup opacity 트랩** — root `initial={false}` (`BossSetup.tsx:220`)
- [x] **Trail 필름 판정 제거** — "Argus 추천"+초록✓ 삭제 → "여기로 정함 · 당신의 선택"(중립 ink), 금테 링 제거, 패자 dim/축소 제거(등가화) (`DecisionVoyageFilm.tsx`)
- [x] **VerificationGate 대칭화** — Apply/Exclude 중립 아웃라인, red 제거, 금색은 최종 커밋만 (`VerificationGate.tsx:90-98`)
- [x] **VoyagePhaseRail 되살림** — 3단계 항해 레일(묶기/듣기/닿기) 배선, 옛 `ProgressLine`+헬퍼 제거 (`ProgressiveFlow.tsx`)
- [ ] **"현재 방위" plateTitle 리워딩** — 하달 판정("전제 교정 —")→반환 핸들("여기서 항로를 바꿨어요 —") (P0 잔여, copy — 후속)

### P1 — 첫 진입 + 시스템 척추
- [ ] 랜딩 데스크톱 CTA in-fold(1280×720) + Hero 메커니즘 평문 한 줄
- [ ] 금색 규칙 통일(C1)을 토큰/컴포넌트에 반영 — CurrentBearingCard verdict pill 중립화, FinalCard 승리 affect 배출, Falsification accent→secondary
- [ ] SealMoment stakes 게이트 스레드(`SynthesizeStep:580` gate prop) → 경량 결정 조용한 확인
- [ ] 다크모드 토큰 parity (Badge/Card/Synthesize/RecastLoader hex→페어드 변수)
- [ ] Synthesize 키스트로크 judgment 저장 디바운스(`SynthesizeStep:501`)
- [ ] autoplay 필름 2개 pause + reduced-motion poster + aria-live 제거

### P2 — 시각 언어 통합 + IA
- [ ] 재질 언어 앱 승격 · 세리머니 격리(C2); `--bp-*` :root→`.bp-root` 스코프
- [ ] Card 기본 반경 10–12px(큰 상태판만 16+), Button `active:scale-[0.96]` 통일, ink/gold/outline/danger 역할 분리
- [ ] settings 좌측 section-nav + danger zone 격리
- [ ] project를 앱 내부 reference 화면으로, list/detail도 해도 언어로

### P3 — a11y + polish
- [ ] SeaChart step-back 키보드 접근(waypoint 리스트), raw `<a>`→LocaleLink(`ProgressiveFlow` login/settings)
- [ ] 44px 터치 타깃 일괄, bg-transparent 입력 focus ring
- [ ] boss를 workspace/reviewer flow에 통합, inner-monologue 앱 토큰화 + calibration opt-in
- [ ] text-wrap(balance/pretty), tabular-nums, `transition-all` 제거, dead code 정리
- [ ] 헤딩 위계(`<h1>`), 차트 색맹 안전, 모바일 해도 접근 확인
- [ ] Playwright 픽셀-visibility를 CI 게이트로 상시화

---

## 3. 이번 패스에서 적용한 변경 (요약)

| 파일 | 변경 | 근거 |
|---|---|---|
| `src/app/[locale]/workspace/page.tsx` | `<AnimatePresence mode="wait" initial={false}>` | P0 렌더링 트랩(Codex 3.1) — idle 입력화면 default-visible |
| `src/components/boss/BossSetup.tsx` | root `initial="hidden"`→`initial={false}` | P0 렌더링 트랩(Codex 3.2) — setup default-visible |
| `src/components/landing/films/DecisionVoyageFilm.tsx` | "Argus 추천"+초록✓→중립 "여기로 정함·당신의 선택"; 금테 ringS 제거; 패자 dim/scale 제거; `dim()` 삭제 | content-fit CRITICAL(Claude 4.2) — 기계 판정 제거, 극 등가화, 금색 규칙(C1) |
| `src/components/workspace/progressive/VerificationGate.tsx` | Apply/Exclude 대칭 중립 아웃라인, red 제거 | content-fit(Claude 4.5) — 기계 출력 신뢰 유도 제거 |
| `src/components/workspace/progressive/ProgressiveFlow.tsx` | `VoyagePhaseRail` 배선, `ProgressLine`+`STAGE_PHASES/STAGES_KO/EN/stageIdx` 제거 | drop된 3phase 간판 기능 복원(Claude P0-4) + "당신이 확인합니다" 프레이밍 셸 복귀 |

**검증 (전부 통과):**
- `tsc --noEmit` PASS
- `eslint` 0 errors (기존 warning만)
- `vitest run` — **164 files / 1867 tests PASS** (VoyagePhaseRail 렌더 테스트 포함)
- `next build` PASS
- Playwright 픽셀-visibility 게이트: `/ko/workspace`(textarea opacity 1, in-viewport), `/ko/boss`(bs-hero opacity 1, in-viewport) — **ALL PASS**

---

## 4. 브랜치·머지 주의

- 이번 작업은 `codex/align-3phase-main` 위 `claude/design-remodel-czftet`에서 진행 → 최종 main 병합 대상.
- **정렬 머지가 드롭한 3phase 자산 주의:** `VoyagePhaseRail`은 이번에 복원했으나, 정렬이 "workspace/voyage UI 충돌은 main 우선"으로 처리했으므로 3phase의 **다른 UI 자산도 유사하게 드롭됐을 수 있음** — feat/3phase-integration과 diff로 재점검 필요(후속 P1).
- Claude 정적 감사(`DESIGN-AUDIT-2026-07-01.md`)는 main 기반이라, content-fit 발견 일부는 이 브랜치에서 코드가 다를 수 있음 — 구현 전 표면별 재검증 전제(예: 이 브랜치 SirenHero docstring은 이미 "CTA navy ink"를 표방 → 재확인 후 P1 진행).

---

## 5. 구현 로그 — 2026-07-02 야간 세션 (autonomous)

브랜치 `claude/design-remodel-czftet` (← `codex/align-3phase-main`)에서 아래를 **각각 검증 후 커밋**. 검증 = tsc + eslint(0 errors) + vitest(164 files/1867 tests) + next build + (해당 시) Playwright 실브라우저 게이트.

### ✅ 완료 (구현+검증+커밋+푸시)
- **P0 렌더링:** `/workspace` HeroFlow, `/boss` BossSetup의 `opacity:0` 트랩 → `AnimatePresence initial={false}` / `initial={false}` (Playwright 실픽셀 게이트 통과).
- **P0 척추:** Trail 필름 "Argus 추천"+초록✓+금테 제거·극 등가화; VerificationGate Apply/Exclude 대칭 중립화.
- **drop 자산 복원:** `VoyagePhaseRail`(3단계 항해 레일) 재배선, 옛 `ProgressLine`+헬퍼 제거.
- **신규 ①** 히어로 통합 split A/B 입력창(쓰기 | 올리기, divider 슬라이드) — Playwright 상호작용 게이트 통과(포커스 시 슬라이드, Enter→/workspace).
- **신규 ②** UseCases 밴드(구체 사용사례 4 + 정직한 3단계 효용).
- **신규 ③** 워크스페이스 ON FILE 도어(→/tools/review) — hero와 여정 일관.
- **P1:** 금색 규칙 롤아웃(CurrentBearingCard/FinalCard/Falsification), 다크모드 토큰 parity(--ai-fg 등 페어드 토큰 + Badge/Card/Synthesize/RecastLoader), Synthesize judgment 디바운스, SealMoment stakes 게이트, VoyageFilm reduced-motion 포스터 게이트 + aria-live 트랩 제거, plateTitle 리워딩. (Playwright: 토큰 remap + reduced-motion 포스터 게이트 통과.)
- **P2/P3 안전 슬라이스:** Footer © 아이덴티티 + 44px 링크; Logbook 토글 44px.
- **P3 추가분(재시작 후):** Boss calibration 5s auto-fire 제거→저장 시에만(미러 조항); Synthesize/Reframe bg-transparent 입력 focus ring(WCAG 2.4.7); Boss verdict `role=heading`+`role=status aria-live`; Boss verdict/calibration pill 44px + wrap.

- **B 배치(정답형 잔여, 재개 후):** SeaChart/BranchMap 키보드 픽(role=button+Enter/Space, svg role img→group), Recast/Reframe 스트리밍 프리뷰("초안 작성 중…" provisional 렌더), SealMoment predicate rows 44px, Testimonials 단수화+면책 대비, 전역 focus 규칙 중복 제거, 워크스페이스 sr-only h1.
- **C1 종결:** 정렬 머지 드롭 자산 = ForkLimitToast 1개뿐이며, main이 포크 한도(MAX_BRANCHES) 자체를 의도 제거해 무의미 → 복원 불필요. **손실 0 확정.**

- **A 배치(사용자 승인 A1-①·A2-①·A3-①·A4-① 구현):**
  - **A2** 물리적 `.bp-root` 스코핑 대신(정식 앱 소비자 4곳이 깨짐) `design-register-contract.test.ts` 가드로 경계 강제 — 세리머니(gold/seal) 어휘는 랜딩 밖 금지, 재질(paper/ink)은 명시적 whitelist만.
  - **A4** boss 속마음 카드: 보라 점술 문법 → 앱 gold-leaf/잉크 "사적 메모" 톤. 상시 glow keyframe·Lock 흔들림·Sparkles 펄스 정지(정지형), 보라 다크 오버라이드 5개 삭제(토큰이 자체 remap).
  - **A3** 커스텀 --radius-* 스케일 폐기(rounded-2xl=16 vs 토큰 24 이름 충돌 함정), Tailwind rounded-*가 단일 라디우스 언어. 소비처 3곳 스냅, Modal 20→16, 로고 10→8. Card 기본 16→12px 다이어트. Button press `active:scale-[0.96]` 통일 + 역할 문서화(gold=사용자 커밋 전용).
  - **A1** 설정 IA 재구축: 좌측 sticky 섹션 내비(모바일 가로 칩) + IntersectionObserver 활성 추적, 섹션 앵커화, 파괴 액션을 연동 카드에서 분리해 최하단 danger zone Card로 격리. Playwright 게이트 통과.

> **머지 상태:** 위 전부 `origin/main`에 반영됨(`d45f218` 대규모 머지 + `552eb7d` a11y 배치 FF). 각 배치 tsc/eslint/vitest/build 그린 확인 후 머지.

### ⏳ 남은 P2/P3 (후속 — 설계 반복이 필요해 야간 blind 구현에서 제외, main 그린 유지 목적)
- **설정 화면 IA:** 좌측 section-nav + 우측 panel, danger zone 격리, 폼 밀도.
- **재질 언어 앱 전체 승격 / 세리머니 게이트:** `--bp-*`를 `:root`→`.bp-root` 스코프, `.bp-seal-stamp`류 stakes 게이트.
- **Card/Button 규율:** 기본 반경 10–12px, `active:scale-[0.96]` 통일, radius 토큰 이름 충돌(rounded-2xl=16 vs --radius-2xl=24) 정리.
- **Boss:** inner-monologue를 앱 토큰으로(점술 문법 강등) + "재미로" 가시 caveat; calibration auto-fire(5s 타이머)→opt-in; verdict를 h3+aria-live status로.
- **잔여 a11y:** 나머지 44px(SealMoment predicate rows, `.bc-*` pills, CrisisConcern escape), bg-transparent 입력 focus ring, 전역 focus 규칙 중복 정리, 헤딩 위계(`<h1>`), SeaChart step-back 키보드 경로, 차트 색맹 안전.
- **스트리밍 프리뷰 렌더 or 제거**(RecastStep/ReframeStep canned 로더).
- **재점검:** 정렬 머지가 `VoyagePhaseRail` 외 다른 3phase UI 자산도 드롭했는지 `feat/3phase-integration` diff 대조.

### 검증 하네스 메모 (후속 세션용)
- 실브라우저 검증: `.env.local`에 더미 Supabase 넣고 `next build` → `next start` (dev는 Next16 `allowedDevOrigins`가 cross-origin 자산을 막아 hydration 안 됨).
- Playwright는 `executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome`, 그리고 프록시 우회 위해 `env -u HTTPS_PROXY -u HTTP_PROXY NO_PROXY="*"`로 실행 (안 그러면 localhost 청크가 프록시 터널 실패로 hydration 불가).
- 셸에서 foreground `sleep` 금지(차단됨) — 서버 대기는 `curl --retry --retry-connrefused`.
