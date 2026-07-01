# Argus 디자인 진단 — 종합 감사 리포트

- **날짜:** 2026-07-01
- **범위:** 웹앱 전체 (랜딩 + 워크스페이스 + 툴 스텝 + 글로벌 시스템 + 보스 기능)
- **방법:** 8개 표면 × 3 렌즈(craft / guidelines / content-fit) 다중 에이전트 진단 → 적대적 검증(코드 재확인, 트집·오판 제거, 심각도 재조정) → 종합
- **커버리지:** 8/8 표면, 총 56개 확정·개연 발견 (REJECTED 제외)
- **렌즈 정의:**
  - **craft** — 시각적 완성도: 위계, 여백 리듬, 타이포, 광학 정렬, 색/그림자/보더 규율, 애니메이션 타이밍, 상태 명확성, 일관성
  - **guidelines** — 웹 인터페이스 가이드라인 & 접근성: 대비 4.5:1, 가시 포커스 링, 키보드 내비, 시맨틱, 44px 터치, reduced-motion, CLS, 반응형
  - **content-fit** — 제품 척추(최대 생성, 제로 판단, 절제) 부합성: 프레젠테이션이 판정을 암시하거나 과잉발화하거나 은유가 실체를 덮는가 — **이번 감사의 고유 렌즈**

---

## 1. 한 줄 진단

**Argus의 시각 디자인은 대단히 정교하지만, 바로 그 정교함이 제품의 척추("최대 생성, 제로 판단, 절제")를 배신하는 지점들이 있다 — 특히 "진짜 제품"이라 이름 붙인 증명 화면에서 기계가 사용자의 결정에 금테와 초록 체크로 승패를 매긴다.**

---

## 2. 전체 인상

디자인 언어 자체는 의도적이고 일관되며 수준급이다. 항해 청사진 + 콘서트홀이라는 이중 레지스터, 손으로 튜닝한 대비(주석에 비율까지 명시), 라디우스/그림자 스케일, `reducedMotion="user"` 전역 래핑(`LayoutShell.tsx:13`) — 기본기는 대부분 이미 갖춰져 있다. 리뷰에서 "대비 실패"로 올라온 상당수가 실측 결과 AA를 통과했다는 사실이 오히려 이 팀의 손끝을 증명한다.

그래서 진짜 긴장은 craft가 아니라 **craft-vs-comprehension**과 **drama-vs-restraint**에 있다. 랜딩 히어로는 40초 필름과 신화 카피로 감정을 먼저 쌓지만, "이게 무슨 도구인가(결정을 쓰면 → 놓친 전제 하나를 짚어주고 → 지정한 날 다시 돌아온다)"라는 문자 그대로의 한 줄이 첫 화면 어디에도 없다. 은유가 실체를 *돕는* 게 아니라 *대신하고* 있다. 5초 스캐너는 이게 결정 리뷰 도구라는 걸 모른 채 떠난다.

가장 심각한 건 척추 위반이 "폴리시가 부족해서"가 아니라 **"폴리시가 과해서"** 발생한다는 점이다. 금테 글로우, 초록 승리 체크, 왁스씰 세리머니, gold-Apply vs red-Exclude — 시각적으로는 다 아름답지만, 각각이 "기계가 사용자의 선택에 판정을 내린다"는 메시지를 실어 나른다. CLAUDE.md의 미러 조항이 경고한 그대로다: 제로 판단은 "사용자를 판단하지 마라"보다 넓고, "개입할지 말지를 사용자 대신 판단하지 마라"까지 포함한다. Argus의 디자인은 지금 절제를 *말하면서 드라마를 연출*하고 있다.

세 번째 축은 **shipped-vs-built 갭**이다. 핵심 셸에서 3-phase 항해 스켈레톤(`VoyagePhaseRail`)이 만들어졌지만 라이브에 배선되지 않아, 제품의 가장 강한 제로-판단 메시지("AI가 대신 정할 수 없어요 — 당신이 확인합니다")를 담은 리디자인이 조용히 출시되지 않고 있다.

---

## 3. 시스템 이슈 (횡단) — 한 번 고치면 전부 고쳐진다

### S1. 금색/체크/세리머니 = 기계의 응원 (content-fit, 최우선)
서로 다른 6개 지점에서 같은 뿌리가 반복된다:
- Trail 필름: chosen 카드에 금테 링 + 초록 ✓ "Argus 추천" (`DecisionVoyageFilm.tsx:316-333, 747-761`)
- VerificationGate: Apply=gold, Exclude=red (`VerificationGate.tsx:90-98`)
- CurrentBearingCard: Proceed/Hold 색상 판정 pill (`CurrentBearingCard.tsx:94-99`)
- SealMoment: 경량 결정에도 동일한 금 메달리언 (`SealMoment.tsx:337-356`)
- FinalCard: 초안에 승리 금테 + 체크 (`FinalCard.tsx:77-91`)
- Falsification: 중립 crux 질문을 `--accent`로 (`Falsification.tsx:232`)

**근본 규칙 하나로 정리 가능:** 금색은 *사용자의 행동*(최종 커밋, 실제 CTA, settlement의 "Right call")에만 착지하고, 초록 ✓/판정 pill/기계 픽 뱃지는 전면 금지. 기계가 생성한 것(전제·근거)과 사용자가 소유한 것(선택·방위)은 색으로 위계를 만들지 않는다 — 둘은 등가로 병치한다.

### S2. 세리머니가 stakes에 스케일되지 않음 (content-fit)
`SealMoment`의 `gate`/`decision.mode` 절제 로직은 존재하지만(`SealMoment.tsx:84, 155-168`) **UI 렌더 경로가 boolean 하나(`justSealed`)에만 매달려 있어** 경량 체크도 풀 세리머니를 받는다(`:337`). `SynthesizeStep`은 아예 `gate` prop을 안 넘긴다(`:580-583`). 인터뷰에서 사용자가 "low"라고 답해도(`:106-116`) 게이트에 안 닿는다. 엔진은 절제했는데 디자인이 다시 드라마를 켠다. 메커니즘은 이미 다 있음 — stakes만 흘려주면 된다.

### S3. 다크모드 토큰 미parity (guidelines)
토큰화된 fill 위에 하드코딩 hex 텍스트, 또는 remap 안 되는 Tailwind-50 fill이 여러 곳:
- `Badge.tsx:9-12` (ai/human/both/checkpoint — 척추의 provenance 라벨이 다크에서 dark-on-dark, 4.5:1 실패)
- `Card.tsx:22-24` (danger/success/checkpoint), `SynthesizeStep.tsx:485-491` (side_a/b), RecastLoader 하드 hex `:268-272`
AI vs Human 뱃지가 다크에서 안 읽히면 honest-provenance의 핵심 구분이 조용히 사라진다.

### S4. 44px 터치 타깃 미달 (guidelines) — 저장소에 이미 패턴 있음
`Footer.tsx:14-18`, `Logbook.tsx:160`(`min-h-[20px]`), `SealMoment` predicate rows(`:661-674`), history 삭제 span(`Reframe:922`/`Recast:583`/`Synthesize:308`), `.bc-force-verdict-btn`/`.bc-cal-btn`(`globals.css:1440-1481`, ~30px), SeaChart 노드(`:592`), CrisisConcernBanner escape. `min-h-[44px]`는 VerificationGate와 `.bc-cal-dismiss`(`globals.css:1425`)에 이미 있다 — 복붙만 하면 된다.

### S5. focus-visible 규율 (guidelines)
`bg-transparent` 입력 2곳은 포커스 시 아무것도 안 보임(`SynthesizeStep.tsx:370`, `ReframeStep.tsx:1335`, WCAG 2.4.7). 나머지 필드는 약한 border-swap은 있음. 전역 규칙은 두 블록이 충돌해 8px 라디우스를 원형 컨트롤에도 강제(`globals.css:198-201` vs `246-250`). 공용 input 클래스/Field 프리미티브로 추출.

### S6. autoplay 루프 = pause/텍스트대안 없음 (guidelines)
`VoyageFilm.tsx`(40초 루프, video 요소가 `rm` 안 읽음 + 4개 aria-live 무한 재낭독)와 `DecisionVoyageFilm.tsx`(모바일 무한 루프 `:565-567`, 결정 내용이 전부 non-semantic div). WCAG 2.2.2. reduced-motion 시 poster + 정적 캡션으로 resolve — 이게 5초 이해에도 더 낫다.

### S7. shipped-vs-built 갭 & Single-Source-of-Truth (structural + content-fit)
`VoyagePhaseRail`(3-phase 리디자인)이 라이브 셸에 배선 안 되고 옛 `ProgressLine`이 계속 렌더됨(`ProgressiveFlow.tsx:2390`). 동일 시그니처의 진행 모델 2개 공존 = 드리프트 대기 상태. 랜딩엔 `ForkPath`, 전역엔 `.bp-seal-stamp`처럼 만들어졌지만 미사용/미배선인 컴포넌트들이 잠재 위험으로 남아 있다. (아래 표면별 상세 참조)

---

## 4. 표면별 진단 (전체 발견)

> 형식: **[심각도 · 렌즈] 제목** — `위치` · 문제 → 권고 (필요 시 *내용 관점*)

### 4.1 Landing · Hero + Header (7)

**[high · guidelines] 40초 루프 필름이 reduced-motion 무시 + pause 없음 (WCAG 2.2.2)**
`VoyageFilm.tsx:344-353, 388-401` — `<video autoPlay muted loop>`가 무조건. `useReducedMotion()`은 framer 캡션 트랜지션에만 스레드되고 video 요소 자체는 `rm`을 안 읽어 항상 오토플레이+무한 루프, pause 어포던스 전무. → autoPlay를 `!rm`에 게이트, reduced-motion 시 poster(voyage-poster.jpg) + 명시적 play 버튼; 긴 루프이므로 전 사용자에게 pause/play 어포던스 추가. *절제가 척추인데 멈출 수 없는 필름은 계속 연기한다 — 절제의 시각적 반대.*

**[high · guidelines] 루프 캡션의 aria-live='polite'가 신화 인용을 영원히 재낭독**
`VoyageFilm.tsx:363, 370, 472, 490` — 4개 캡션 컨테이너 모두 aria-live. 필름이 무한 루프라 스크린리더가 매 40초 사이클마다 인트로+신화 4구절+귀속+서비스 라인을 재낭독, 침묵 불가. → 스와핑 캡션에서 aria-live 제거; `<video aria-label>`(`:349,393`)이 이미 요약 제공. 신화 프레이밍이 AT에 꼭 닿아야 하면 visually-hidden 정적 캡션으로 한 번만.

**[medium · content-fit] 5초 안에 실제 메커니즘이 안 읽힘**
`SirenHero.tsx:152-157(헤드라인), 169-173(약속), 184-219(필름), 224-239(필름 아래 브릿지)` — 추상 couplet + 은유 약속 + 40초 필름이 이해를 짊어지고, 유일하게 문자적인 줄은 필름 *아래*. 메커니즘 평문(결정을 쓰면→가정 하나 짚음→날짜에 복귀)이 첫 화면에 없음. → 헤드라인 직하 또는 입력 바로 위에 제품 용어 평문 한 줄. 필름은 심화 레이어로. *은유가 실체를 돕게 하려면 메커니즘이 먼저 읽혀야 한다.*

**[medium · content-fit] CTA가 입력 시 금색으로 채워져 파일 자체 규칙과 모순**
`SirenHero.tsx:367-368` vs docstring `14-17`("Gold is spent exactly once… CTA is navy ink"). 텍스트 입력 시 border+bg를 `--bp-gold`로 채움 = 기계가 클릭을 응원하는 것으로 읽힘. → CTA는 navy ink(`--bp-ink`) fill. 금색은 인식/포크 순간에만. *가치의 순간은 클릭이 아니라 인식이다.*

**[medium · guidelines] Enter 제출이 `<form>` 없는 raw keydown, 계약 미고지**
`SirenHero.tsx:322-327` — textarea onKeyDown Enter로 페이지 이탈, `<form>` 없음, 버튼은 standalone onClick, 힌트가 aria-describedby로 미연결. → `<form onSubmit>` + `type=submit` + textarea에 aria-describedby로 Enter/Shift+Enter 계약 안내.

**[low · guidelines] cold-start 예시가 aria-hidden 오버레이에만 존재**
`SirenHero.tsx:302-315(오버레이 aria-hidden), 328(placeholder '')` — 회전 예시가 시각적으로만, AT는 aria-label만 받음. (회전은 `:54-63`에서, caret 깜빡임은 `globals.css:2810`에서 reduced-motion 게이트 정상.) → 대표 예시를 실제 placeholder/aria-placeholder/aria-describedby에 넣기.

**[low · guidelines] disabled CTA가 색상만으로 구분 (단, AA-fail 주장은 오류)**
`SirenHero.tsx:367-376` — 비활성 상태가 색+커서로만. 리뷰의 대비 실패 주장은 오류: `--bp-ink-soft #4a6180` on `--bp-paper #f4ede0` ≈ 5.3:1로 AA 통과. → (선택) 미세 opacity 큐 추가. 대비 교정 불필요.

### 4.2 Landing · The Trail ("진짜 제품" 증명 화면) (5)

**[CRITICAL · content-fit] 필름이 결과를 "Argus 추천"으로 라벨 + 금테 링 + 초록 ✓ = 기계 판정**
`DecisionVoyageFilm.tsx:316-333(pickBadge), 747-761(렌더), 263-289(금테 ringS + 패자 opacity×0.5, scale −0.04)` — chosen 루트에 (a) 금색 글로우 박스섀도 링, (b) 초록 ✓ "선택됨 · Argus 추천"(#1f8a5b), (c) 나머지 극은 반투명·축소. 기계가 승자를 고르고 축하하는 2극(세션2는 3극) 가중 포크 — 불변식 #1(저작권 거짓)·#2(사용자 판정 금지)·#4(과잉발화/laundered lean) 동시 위반. **가장 손해가 큰 이유: 여기가 "진짜 제품"이라 명명한 증명 화면.** → "Argus 추천" 텍스트 + ✓ 뱃지 삭제. chosen을 *사용자의* 픽으로 표기(커서가 이미 클릭함), 중립 border, 나머지 극도 등가·등명도 유지. *증명 화면의 일은 Argus가 숨은 전제·근거를 표면화(잘함)하고 사용자가 조타하는 것 — 옵션 채점이 아니다.*

**[high · content-fit] "현재 방위"(사용자 소유 필드)가 "Argus 추천"과 같은 카드에 co-brand**
`DecisionVoyageFilm.tsx:743-755(stamp), 61/75(plateTitle "전제 교정 —")` — stamp()가 엔진이 chosen 표시한 카드에 자동 적용, 같은 카드가 "Argus 추천"도 표기. plateTitle은 하달된 판정 문구. → provenance 분리: 전제/근거는 ai_surfaced("Argus가 찾았다"), 방위/선택은 "당신의 방위". plateTitle을 "여기서 항로를 바꿨어요 — 시험한 가정은 …"로. (finding #CRITICAL 고치면 대부분 해소, plate 카피만 남음.)

**[medium · guidelines] 멀티스테이지 필름에 pause/replay 없음 + 결정 내용 텍스트 대안 없음**
`DecisionVoyageFilm.tsx:565-567(폰 무한 루프), 618-823(전부 styled div/span, role/landmark 없음)` — WCAG 2.2.2. 결정 서사가 애니 노드로만 존재. → pause/replay 컨트롤 + 정적 텍스트 요약(질문→숨은 전제→당신의 방위) 상시 DOM. *정적 요약이 곧 honest-provenance 기회: "Argus가 전제를 짚었고, 방위는 당신이 정했다".*

**[medium · content-fit] 카피는 "당신이 정한다"인데 가짜 커서가 pre-scored 옵션 자동 클릭**
`DecisionVoyageFilm.tsx:340-352(커서), 432(phase "you decide")`; `Act2DecisionVoyage.tsx:70-72("Not an answer handed down")` — 카피는 사용자 내비, 필름은 pre-scored 답을 자동 클릭. → 한 비트를 실제 인터랙티브로, 아니면 카피를 완화. 최소한 자동 픽이 "you decide" phase 카피와 동시발생 금지.

**[low · content-fit / PLAUSIBLE] ForkPath 중앙 카피가 방향성 진술 + 단일 금색 pivot (미배선)**
`ForkPath.tsx:116-120(금색 pivot), 125-126(단정 카피)` — 단일 금색 노드 + 단정 문구가 포크를 illustration으로 주장(불변식 #4b: fire-form은 중립 질문이어야). **단, 라이브 랜딩에 렌더 안 됨(dead code, SirenHero 주석만 언급).** → 재등장 시 중립 crux 질문으로 전환 + 금색 pivot 약화. 아니면 dead 컴포넌트 삭제.

### 4.3 Landing · Social proof + Close/CTA + Footer (6)

**[medium · content-fit] Footer에 ©/운영주체/연락처/연도 없음**
`Footer.tsx:9-20` — 태그라인 + Terms/Privacy 링크만. 법적 계약을 링크하는 제품이 익명 = 신뢰 훼손, 모바일에서 미완성 placeholder처럼 읽힘. → © {year} + 운영 엔티티명 + contact/support 링크, `--text-tertiary`로 조용히. *식별 가능한 운영자 = honest-provenance의 회사 차원 확장.*

**[medium · guidelines] Footer 법적 링크: 11px + sub-44px 타깃, 모바일 인접 탭 충돌**
`Footer.tsx:14-18` — 11px, gap-3(12px)만, 패딩 없음 → 히트 영역 ≈ 글리프 박스(~15px). → 각 링크 inline-flex + 세로 패딩(min-height 44px), 텍스트 12px, `|`는 aria-hidden.

**[medium · content-fit] Act3 클로징 차트가 세리머니/금색으로 단일 CTA와 경쟁**
`Act3OnDeck.tsx:70-88(100vw VoyageMapFilm + 금색 방위 노드), 100-122(단일 금색 CTA)` — CTA 자체는 훌륭(금색 1개 + 정직한 sub-line). 위험은 위: 풀블리드 애니 "운명 차트"가 금색 예산을 기계 그린 노드와 실제 버튼이 나눠 씀(주석 `:10-12`). → CTA가 fold에서 가장 강한 금색이 되게, 차트 노드 out-glow 금지, 375px에서 CTA가 fold 밖으로 안 밀리는지 검증, 필름 런타임 단축 고려. *미러 조항: 금색은 사용자 행동에 착지, 기계 그린 노드에 아니게.*

**[low · content-fit] 최종 CTA가 은유("출항")만, 실제 첫 행동 미명명**
`Act3OnDeck.tsx:118("지금 출항"), 95(breadcrumb), 127(sub-line)` — 은유 밀도 높은 클로징에서 콜드 리더가 "출항"→"결정 붙여넣고 질문 하나 받기"를 연결 못할 수 있음(sub-line이 부분 구제). → 구체 라벨("첫 분석 시작") 또는 sub-line 강화("결정을 붙여넣으면 — 30초 안에 첫 리딩").

**[low · craft] 복수형 헤더인데 후기 1개**
`Testimonials.tsx:91(복수 헤더), 25-46(QUOTES 1개), 96(.map)` — 복수 chrome + 단수 콘텐츠. (코드 주석 `:11-13`이 "일부러 적게"라 명시 → 단수는 의도적 정직, 헤더 문구만 불일치.) → 헤더만 단수화("한 초기 테스터의 말") 또는 실제 후기 추가(조작 금지).

**[low · guidelines] Testimonials 면책 라인: 10.5px opacity 0.85 → 4.5:1 미달**
`Testimonials.tsx:152-157` — provenance 면책("실제로 써본 사람의 메모")이 가장 안 읽히는 텍스트. base ≈4.6:1에 opacity 0.85가 임계 아래로. → opacity 제거(토큰이 full value 운반) + ~11.5px. *honest provenance를 세우는 줄이 de-emphasis되면 척추를 훼손. 절제는 조용함이지 안 보임이 아니다.*

### 4.4 Workspace · 프로그레시브 플로우 셸 (8)

**[CRITICAL · guidelines/content-fit] `VoyagePhaseRail`(3-phase 리디자인) 전체가 orphaned — 라이브가 옛 `ProgressLine` 렌더**
`VoyagePhaseRail.tsx`(자기·테스트만 참조) vs `ProgressiveFlow.tsx:2390(ProgressLine 렌더, 정의 :165)` — `VoyagePhaseRail`은 헤더에 "옛 flat 5-step ProgressLine 대체"라 명시하지만 grep 결과 `ProgressiveFlow`/`page.tsx`가 절대 import 안 함. 의도된 공간 오리엔테이션 개선이 dead code. → `:2390`에 배선(드롭인, 동일 `{phase, crewDeployed}` 시그니처)하고 `ProgressLine` 삭제, 또는 5-step이 이겼으면 `VoyagePhaseRail`+테스트 삭제. *척추 이슈: 3-phase 모델은 deaf-rower 불변식("AI가 대신 정할 수 없어요 — 당신이 확인합니다", `:143`)을 Listen-phase 캡션으로 운반 — 제품의 가장 강한 제로-판단 메시지. flat stepper 출시 = 그 "당신이 확인" 프레이밍을 조용히 드롭.*

**[high · guidelines/craft] raw `<a href>`가 locale 라우팅 + Next 클라이언트 내비 우회**
`ProgressiveFlow.tsx:2439(/login?redirect=/workspace), 2453(/settings)` — 나머지 내부 링크는 전부 `LocaleLink`(locale prefix). 이 2개만 raw `<a>` → `/en` 사용자가 로케일 유실 + 전체 리로드로 인메모리 state 폐기. → 둘 다 `<LocaleLink>`로, redirect 타깃도 locale-correct하게. (S3의 lint 5개 에러 중 2개가 여기)

**[high · guidelines] SeaChart 인터랙티브 노드가 마우스 전용 — step-back/fork 키보드 불가**
`SeaChart.tsx:528, 471(<g onClick>); BranchMap.tsx:100` — 노드 픽이 SVG `<g>`의 bare onClick, `tabIndex`/`role`/`onKeyDown` 없음. `<svg role="img">`(`:345`)라 AT엔 정적 이미지. "포인트 탭해서 그 턴 읽기 / 어느 지점으로든 되돌아가기" = 맵의 존재 이유가 마우스 없이 불가. → 접근 가능한 병렬 제공: `VoyageChart` 모달의 텍스트 "항로 목록"(`:195`, 실제 `<button>`)을 키보드 내비 waypoint 리스트로 확장하고 SVG는 aria-hidden. 최소한 노드에 `role="button"`+`tabIndex={0}`+`onKeyDown`.

**[medium · guidelines] compact 레일 차트 노드 터치 타깃 44px 미달**
`SeaChart.tsx:592(<circle r={full?16:11}>)` — compact 히트 서클 반경 11 viewBox 단위(≈22px 지름), preserveAspectRatio="meet"로 더 작게 렌더될 수 있음. → 히트 반경 상향, 또는 compact은 glanceable-only로 두고 모든 *픽*을 풀차트 모달/접근 리스트로 라우팅.

**[medium · content-fit] 은유 스태킹이 실제 결정 진행을 매장할 위험 (절제)**
`VoyageMapRail.tsx`(해도+항해일지+legend) + `SeaChart.tsx` 장식(컴퍼스 로즈, rhumb line, 섬, 유령선, 안개 "미지의 바다" `:449`, ink-bleed/scorch 필터) + phase stepper + 상태바 + branch chip + (모바일)드로어 2개 — 동시 노출. legend가 "SVG 마크가 스스로 설명 못함"을 인정(`:158`)하는 것 자체가 인코딩이 self-evident하지 않다는 신호. → compact에서 장식 다이어트 공격적으로, 현재 위치를 legend 대신 차트에 인라인("여기") 라벨, *결정 콘텐츠*(턴 헤드라인, 포크 질문)가 항상 바다 장식보다 시각적 무게 크게. *미러 조항: flat 단일 코스 결정을 서사적 분기 여정처럼 *느끼게* 하면 없는 드라마를 제조. "다른 길을 내볼 수 있어요"(`:196`)는 borderline — 닫은 결정을 다시 열게 부추기지 말 것.*

**[medium · craft/guidelines] 차트 인코딩이 색맹/모노크롬 비안전 + 미세 SVG 형태 차이 의존**
`SeaChart.tsx:523(active=navy vs inactive=sepia), 559-575(형태 차이); VoyageChart.tsx:126; BranchMap.tsx:109(fill=branch color)` — 브랜치 정체성·활성 상태가 거의 색+2~4px 형태로만. compact에서 near-indiscernible, 색맹 실패. → 비색 채널로 active 강화(gold ship+pulse가 "여기"엔 잘 됨 — 그 redundancy를 active-branch course weight, 리스트 텍스트 라벨로 확장).

**[low · guidelines] 헤딩 위계: 셸에 `<h1>` 없음, 스텝 콘텐츠가 h2/h3로 점프**
`ProgressiveFlow.tsx:787(h2), 3294/3347(모달 h3); page.tsx:135(프로젝트 헤더가 span)` — 최상위 오리엔테이션이 span으로 구성, 첫 헤딩이 h2. 페이지 `<h1>` 없어 아웃라인이 중간부터. 레일 섹션 타이틀(해도/항해일지)도 span. → 워크스페이스/프로젝트에 (시각적으로 subtle해도 되는) `<h1>` 추가, 레일 eyebrow를 실제 헤딩으로. (`<aside aria-label>` `VoyageMapRail.tsx:291`은 좋음, 유지.)

**[low · craft/guidelines] 반응형: 375px가 미검증 `LogbookDrawer`에 전적 의존**
`page.tsx:120-221(xl 이하 rail→drawer)` — xl(1280px) 이하에서 좌측 레일 드롭 + 바텀 드로어 대체(건전, 주석됨). 하지만 375px에서 전체 공간 맵(SeaChart step-back/fork)이 `LogbookDrawer`로만 도달. → `LogbookDrawer`가 모바일에서 "전체 해도" 진입점 노출하는지 확인, 의도적으로 chart-less면 명시적 문서화. (플로우 컬럼 자체는 `max-w-2xl min-w-0` + safe-area 패딩으로 견고.)

### 4.5 Workspace · 결정 카드 & 모먼트 (8)

**[high · content-fit] VerificationGate가 Apply(금색)를 Exclude(danger-red)보다 가중 → AI 출력 신뢰 유도**
`VerificationGate.tsx:90-98` — Apply(반영)=`--gradient-gold` 흰텍스트 primary+shadow, Exclude(제외)=text-red-600/border-red-200. accept-is-good, exclude-is-danger. 게이트 목적("conscious, not coerced")과 정면 모순, red가 정상 편집 skip을 파괴 행위로 오코딩. → Apply/Exclude 대칭 중립 아웃라인, 금색은 최종 "Create draft" 커밋(`:116`, 여기선 OK)만. *기계가 자기 출력 선호를 표현 = 불변식 (a)/(c) 위반.*

**[medium · content-fit] CurrentBearingCard 상태 pill이 엔진 파생 방향 라벨을 색상 판정으로**
`CurrentBearingCard.tsx:24-31(STATUS_META), 66(tone split), 94-99(chip)` — Proceed/Hold/Revise/Collect evidence가 명령형, `--accent`(go)/`--gold`(caution) 색분기 = 승인-vs-주의 affect. → 색 없는 중립 상태 서술자(소문자 eyebrow, `--text-tertiary`), accent/gold 분기 제거, 명령형→중립 명사("포크가 열림", "근거가 더 필요"). *불변식 2/(a): 사용자에게 가는 meaning-language는 서술적이어야, 판정이 아니라.*

**[medium · content-fit] SealMoment이 de-escalated single_check/수동 복구 경로에도 동일 금 메달리언 세리머니**
`SealMoment.tsx:337-356(SEALED 블록), 159-167/219-243(도달 경로)` — 절제가 sealing 로직엔 있으나 SEALED UI는 `justSealed` boolean 단일 경로, `decision.mode`가 state로 안 스레드됨. → mode(+manual_recovery)를 state로 스레드, single_check/manual_recovery는 조용한 인라인 확인(금 메달리언 없음), 풀 계약만 메달리언. *시각 무게 = 엔진이 계산한 stakes에 비례해야, 아니면 de-escalation과 모순.*

**[low · content-fit / PLAUSIBLE] FinalCard가 AI 초안을 승리 금테+메달리언+scale-up으로 감쌈**
`FinalCard.tsx:77-91` — 0.9s scale-up + 금 그라디언트 보더 + 금 체크 메달리언. 문서는 기계 생성 초안이지 정착된 결과 아닌데 금+체크=승인. (수반 카피는 절제됨 "완성된 문서/Ready to send" → borderline.) → 문서 구분은 유지하되 승리 affect 배출: 금 체크→중립 "document ready" 마크, 금테→hairline, scale-up 제거. 축하 금색은 settlement "Right call"에.

**[low · content-fit] Falsification 중립 crux 질문이 `--accent`로 재-lean**
`Falsification.tsx:232` — 카피는 rounds-5~8 규칙 준수(중립 질문 "이게 정말 맞나요?", `:233`), 인접 주석도 "ask, don't conclude" 강제 — 그런데 라인이 `--accent`(강조/긍정색). → `--text-secondary`로. *잔여 lean은 irreducible하므로 최소화해야, 증폭 아니라.*

**[medium · guidelines] Logbook 토글(min-h-[20px]) + SealMoment predicate rows(py-2) 44px 미달**
`Logbook.tsx:160; SealMoment.tsx:661-674` — Logbook 토글은 모바일 LogbookDrawer의 primary 어포던스인데 20px. (같은 드로어 닫기 버튼은 `min-w/h-[44px]` `:256` — 불일치.) → `min-h-[44px]`(md: 오버라이드로 데스크톱 밀도 유지).

**[low · guidelines / PLAUSIBLE] AttributedSection 기여자 칩이 동색 fg-on-tint(저대비) + 문장 dot이 색+title만**
`AttributedSection.tsx:81-89(20px 칩, color on color+'25'), 156-170(4px dot), 100-107(10px 캡션)` — 동색 fg/bg가 4.5:1 미스, dot이 title-only. (단, 칩 내용은 이모지, 이름은 "기여" 캡션에 텍스트로도 있어 정보 손실은 아님.) → 칩에 `--surface` 배경 또는 1px `--border` 링, 캡션 ~11.5px, dot 유지 시 title-only 대신 aria-label.

**[low · guidelines] CrisisConcernBanner: 안전 백스톱 eyebrow 10px 흐린 amber + "계속" escape가 최저 강조**
`CrisisConcernBanner.tsx:46-47(10px amber), 52-58(text-tertiary underline, min-height 없음)` — never-hard-block escape가 앱에서 가장 흐린 어포던스, 위기 상황에서 도달성 필요. → amber eyebrow 4.5:1 양테마 검증 + 10px 상향, "계속"을 ~44px `--text-secondary` 컨트롤로(리소스보다 조용하되 최저 tertiary는 아니게). *copy-as-concern은 존중됨, 수정은 순수 도달성.*

### 4.6 Tools · Reframe/Recast/Rehearse/Synthesize (9)

**[high · craft] Synthesize가 conflict textarea 매 키스트로크마다 judgment 레코드 저장**
`SynthesizeStep.tsx:223-242(handleJudgment), 501(onChange)` — 40자 입력 = ~40개 persisted judgment 레코드. ReframeStep은 1000ms 디바운스(`:636-668`)로 해결했는데 여기만 누락. patterns/vitality가 읽는 판단 스토어 오염. → ReframeStep judgmentTimerRef 패턴 적용(타이핑 멈춘 ~1s 후 1회), 또는 onBlur. updateItem은 즉시 유지. *judgment 스토어는 patterns meaning-language의 substrate — 척추가 사용자에게 자기 얘기할 유일한 정직 경로. 키스트로크 홍수가 빈도 통계를 왜곡.*

**[medium · guidelines] history 삭제가 `<button>` 안 `<span onClick>` — invalid nesting + sub-44px**
`ReframeStep.tsx:922-927; RecastStep.tsx:583-585; SynthesizeStep.tsx:308-310` — interactive-in-interactive(무효 HTML), span은 키보드 미포커스/미조작, ~16px 타깃. 모바일에서 부모 탭 오히트로 아이템 전환. → 인접 형제 `<button type="button" aria-label>`(내부 아님), min 44×44, stopPropagation. 3곳 동일 수정.

**[medium · guidelines] persona 삭제가 native `confirm()` — 앱 자체 no-OS-dialog 규약 위반**
`RehearseStep.tsx:639` — 같은 파일 `:483`이 "CLAUDE.md forbids OS dialogs"라 주석하고 인라인 배너 사용하는데, 156줄 뒤에서 blocking `confirm()`. 언스타일·미테마·미포커스관리. → 인앱 2단계 인라인 확인(trash 아이콘이 "확인" 몇 초 morph) 또는 테마 팝오버.

**[medium · content-fit] SealMoment이 사용자 importance 답변 게이팅 없이 발화 — 경량 결정 과잉발화**
`SynthesizeStep.tsx:579-584(gate prop 없이 렌더), 106-116(인터뷰 importance)` — SealMoment의 gate prop이 미러 조항 절제 구현(routine+reversible+confident → 라이트 체크)하는데, Synthesize가 gate 없이 렌더 → 항상 풀 세리머니. 인터뷰 "low" 답이 raw_input 자유텍스트로만 저장되고 게이트에 안 닿음. → importance를 `gate.stakes`로 매핑(low→routine 등). 새 메커니즘 불필요 — 게이트가 이미 배선됨. (완화: predicate 0개면 SealMoment이 null 렌더 → 진짜 flat은 세리머니 안 뜸; 과잉발화는 predicate 있는 low-importance에만.)

**[medium · craft] 스트리밍이 배선됐지만 렌더 안 됨 — analyzing이 라이브 토큰 버리고 canned 로더**
`RecastStep.tsx:328-329, 408(setStreamingText), 671-675(RecastLoader); ReframeStep.tsx:569/577, 1069-1077(LoadingSteps)` — callLLMStream+onToken으로 streamingText 세팅하나 JSX에서 안 읽고 즉시 clear. 3500토큰 Recast가 15-30s 동안 같은 루핑 바, 진행 신호 0. → (a) streamingText를 라이브 프로비저널 프리뷰("drafting…" faint)로 렌더, 또는 (b) callLLMStream 제거. 긴 대기라 (a) 권장. *부분 AI 텍스트는 프로비저널 레지스터(faint, "drafting" 라벨)로 렌더해 half-formed 결론으로 오인 방지 = honest provenance 유지하며 진행 피드백.*

**[medium · guidelines] Synthesize conflict sides + 요약 카드가 하드 Tailwind 팔레트 → 다크 깨짐**
`SynthesizeStep.tsx:485-491(bg-blue-50/purple-50), 441/447(#2d4a7c), 457/460(#2d6b2d)` — raw Tailwind 유틸+리터럴 hex, `[data-theme=dark]`에서 미remap → 다크 charcoal 위 near-white 박스. → 시맨틱 토큰 매핑(side_a→`--ai` register, side_b→중립 서피스), 리터럴 hex 제거, 다크 검증. *두 side는 반드시 등가 유지(어느 쪽도 강조 금지) — 외부 소스지 엔진 lean 아님.*

**[medium · guidelines] Synthesize/Reframe 여러 입력의 포커스 링 약함/부재**
`SynthesizeStep.tsx:370(source name, bg-transparent, focus:border 없음); ReframeStep.tsx:1335(custom-question, 동일)` — 이 둘은 포커스 시 무표시(WCAG 2.4.7). 나머지(`:350,383,503,511,1163`)는 약한 border-swap 있음. → 모든 컨트롤에 `focus-visible:ring-2 ring-[var(--accent)]/40`, 두 bg-transparent 우선, 공용 클래스/Field로 추출. *conflict judgment textarea(`:503`)는 사용자가 자기 판단 렌더하는 가장 척추-핵심 입력 — 가장 키보드-legible해야.*

**[low · craft] RecastLoader가 하드 hex 바 색상, 테마 토큰 무시**
`RecastStep.tsx:268-272(#3b6dcc/#2d6b2d/#b8860b)` — 다크 미shift, #b8860b가 `--gold`(#96782e/#b8963e)와 다름. → `var(--ai/--collab/--gold)`(또는 WorkflowGraph의 actor 색). *조립 바를 실제 ai/human/both 색으로 = 로더가 의미(역할 배정)를 갖게.*

**[low · craft] RecastStep dead code + 미사용 prop**
`RecastStep.tsx:395-396(if(false)), 868(reframe prop 선언되나 미사용, 829에서 전달)` — Clean Removal 원칙 대상. → if(false) 삭제(git history가 레퍼런스), QuickRehearsalCard 타입+콜사이트에서 reframe 제거.

### 4.7 Global · 디자인 시스템 + Header/nav + UI 프리미티브 (7)

**[medium · guidelines] Badge/Card가 토큰 fill 위 하드 hex 텍스트 — Warm Charcoal에서 dark-on-dark**
`Badge.tsx:9-12; Card.tsx:22-24` — ai/human/both/checkpoint 변형이 remap되는 fill(`bg-[var(--ai)]`→다크 #2a2520)에 하드 dark hex 텍스트 → 다크에서 dark navy/olive on charcoal, 4.5:1 실패. risk-*/Card 변형은 고정 Tailwind-50 fill + var 텍스트로 밝은 칩이 다크와 충돌. → 양쪽 remap되는 페어드 CSS var(`--badge-ai-fg/-bg`) 또는 이미 remap되는 risk 토큰 재사용, 전 변형 다크 4.5:1 점검. *AI vs Human 뱃지가 honest-provenance(ai_surfaced vs user)의 문자적 시각 운반체 — 다크에서 안 읽히면 척추 핵심 구분이 조용히 소실.*

**[medium · craft] 활성 nav pill이 트랙과 같은 fill — pill 모양 안 읽힘**
`Header.tsx:124(트랙 var(--surface)) vs 138-139(활성 링크도 var(--surface))` — seated pill이 트랙 대비 fill 없음, shadow-sm이 동색에서 소멸(다크 --surface #292524에선 완전 소멸). "여기 어디" = 미세 텍스트색 차이로 붕괴. (모바일은 `bg-[var(--bg)]` `:287`로 정상.) → 데스크톱 트랙을 `bg-[var(--bg)]`로 or 활성 fill을 `--bg-hover`로, 양테마 검증, 모바일 패턴 일치. *wayfinding이지 verdict 아님 — 조용한 seated chip(bg-hover), gold-glow "여기" 금지.*

**[medium · guidelines] ErrorBoundary escape가 raw `<a href="/workspace">` — locale 유실**
`ErrorBoundary.tsx:65-70` — 라우트가 `app/[locale]/` 하위, `getCurrentLanguage()`가 2줄 위(`:5,42`)에 이미 있는데 raw `/workspace`. 크래시 복구 시 한국어 사용자가 locale-less 라우트로. + escape가 화면 최약(12px tertiary underline)인데 re-throw 가능한 retry가 prominent. → `href={`/${getCurrentLanguage()}/workspace`}`, escape를 `text-sm text-secondary` + 충분한 히트로. *크래시 시 locale 조용한 유실 = ownership-in-their-stead, 복구 경로는 정직·신뢰해야.*

**[low · guidelines] 전역 focus 규칙 2개 충돌, 승자가 8px 라디우스를 모든 링에 강제**
`globals.css:198-201 vs 246-250` — 동일 specificity라 후자(`:246`)가 이겨 `border-radius: var(--radius-sm)`를 모든 focus 링에. 주석(`:195`)은 "outline이 각 요소 라디우스 따름"이라지만 override됨 → 원형 컨트롤에 8px 링. → 하나로 통합(`:246` 블록 삭제, `:198-201`만; modern outline이 border-box 모양 hug), 필요한 소수만 로컬 라디우스.

**[low · craft] radius 토큰 스케일 존재하나 프리미티브가 우회, `rounded-2xl` 이름 충돌(16 vs 24)**
`globals.css:94-98(토큰) vs Button.tsx:60-62, Card.tsx:38(rounded-2xl), Modal.tsx:119(rounded-[20px]), Header:116(rounded-[10px])` — Tailwind `rounded-2xl`=16px인데 토큰 `--radius-2xl`=24px = 같은 이름 다른 값. 3개 radius 시스템 공존. → Tailwind radius를 CSS 토큰에 매핑 or 프리미티브가 토큰 직접 참조, 10px 로고를 8/12로 snap.

**[low · content-fit / PLAUSIBLE] `--bp-*` 블루프린트 토큰이 :root에 선언, 앱 토큰과 구조적 경계 없음**
`globals.css:75-98(:root), 151-160(다크)` — 랜딩 logbook 레지스터와 앱 concert-hall 레지스터 2개인데 `--bp-*`가 :root라 앱 컴포넌트가 참조해도 에러 없음. 경계가 `.bp-root` 관례로만. (현재 앱 프리미티브 누수 없음.) → `--bp-*`를 `.bp-root` 하위로 이동(누수 시 가시 실패), 2-레지스터 규칙 문서화. *이중 레지스터는 의도적 척추 시그널: 랜딩의 "seal a decision" 세리머니 목소리가 절제가 자세인 앱으로 새면 안 됨.*

**[low · content-fit / PLAUSIBLE] 세리머니 "seal stamp" 애니가 전역 클래스로 존재 (재사용 시 과잉발화 위험)**
`globals.css:2977-2981(.bp-seal-stamp), 2972-2976(keyframes), 3111(reduced-motion 게이트)` — 고드라마 왁스씰 제스처(scale 0.2→1.12 오버슈트+회전)가 전역 시트에 스코프 가드 없이. (현재 .tsx 사용 0 = dead.) → 랜딩-only 유지 + 스코프 주석, 앱 seal/commit UI 계획 시 stakes 게이트(진짜 비가역 고-stakes만). *사소/가역 행동에 왁스씰 = verdict-by-animation, 세리머니는 실제 stakes에 스케일해야.*

### 4.8 Boss · persona/inner-monologue 기능 (6)

**[medium · content-fit] inner-monologue 리빌이 for-fun saju 레이어를 점술로 스타일 — off-system + honest-provenance 위배**
`InnerMonologueCard.tsx:117-209; globals.css:1653-1791(보라 91,33,182)` — 유일하게 콘서트홀 gold/ink를 벗어나 violet/indigo + Lock + radial glow + Sparkles = 점성/운세 앱 문법. 면책("재미로")이 tooltip(title attr `:178`)에만 → 터치 시 안 보임. "타고난 결이 배어나요" + 신비 스타일이 픽션 페르소나의 saju를 verdict-flavored 리빌로 극화. → 앱 토큰(gold-leaf/ink/warm shadow)으로, 신비 큐 축소(glow 제거, Sparkles를 작은 정적 ink/gold 마크), "재미로"를 가시 라인(`.bc-inner-locked-sub` 슬롯 `:142`)으로, "타고난 결" 완화. *페르소나가 픽션이라 hard 위반은 아니나, 점술 스타일이 "기계가 네 본질을 본다"로 laundering. logbook 은유("책상에 돌아가 메모")가 도울 텐데 보라 신비주의가 덮음.*

**[medium · content-fit] Calibration("얼마나 실제 같나요")이 verdict 후 5초 타이머로 익명 사용자에게 auto-fire**
`BossChat.tsx:304-313(setTimeout 5000→calibration), 793-841(렌더)` — 미저장·비로드(익명 공유링크 리더)에게 😐/🤔/👍 레이팅이 5s 타이머로 슬라이드인, 미요청. 미러 조항: 기본은 절제, "가만히"가 맞을 때 engagement 푸시 금지. 감정 정점에서 반응 강요. → 수동 dismissible 어포던스("실제 같았나요?" 조용한 링크), 타이머 애니인 금지, opt-in, 세션 내 dismiss 후 재발화 금지. *rehearsal-not-prediction 리프레임(`:811-812`)은 좋음, 잔여 긴장은 타이밍.*

**[medium · guidelines] force-verdict + calibration pill이 44px 미달**
`globals.css:1440-1449(.bc-force-verdict-btn), 1472-1481(.bc-cal-btn)` — 둘 다 ~30px(12px 폰트+6px 패딩, min-height 없음). "여기서 판단하기 →"는 primary 결정 어포던스, calibration 3개는 레이팅 타깃, 둘 다 모바일-first. (`.bc-cal-dismiss` `:1425`에 44px 패턴 있음.) → `min-height: 44px` + 세로 패딩, calibration row(`:1467`) wrap 허용(375px 오버플로 방지).

**[low · guidelines / PLAUSIBLE] 보스 시그니처 루프가 reduced-motion 부분 우회 (CSS glow만; opacity 펄스는 MotionConfig 하에서 잔존)**
`InnerMonologueCard.tsx:129(glow div); globals.css:1666-1676(.bc-inner-locked-glow, 어떤 reduce 블록에도 없음)` — 전역 `<MotionConfig reducedMotion="user">`(`LayoutShell.tsx:13`)로 transform/layout 루프는 이미 정지. 잔존은 (a) CSS `.bc-inner-locked-glow` keyframe, (b) framer opacity 루프(MotionConfig가 opacity는 의도적 미비활성). → `@media (prefers-reduced-motion: reduce) { .bc-inner-locked-glow { animation: none; } }`. (선택) 남은 opacity 펄스 `useReducedMotion()` 게이트. (리뷰의 "전체 루프 무시" 주장은 오류 — transform은 이미 처리됨.)

**[low · craft] `.bc-inner-locked-title em` dead 규칙 — 리빌 이름 강조 미렌더**
`globals.css:1708-1715(em 그라디언트) vs InnerMonologueCard.tsx:138-141; i18n에 <em> 없음` — 그라디언트가 `<em>` 겨냥하나 i18n 문자열이 마크업 없는 보간 텍스트. 보스 이름(개인화 훅)이 flat. → 보간 `{name}`을 `<em>`/span으로 감싸(그라디언트는 앱 토큰으로 리톤, 보라 아님) 또는 dead 규칙 삭제.

**[low · guidelines] verdict 결과 + inner-monologue 라벨이 non-heading — 스크린리더 landmark/announce 없음**
`BossChat.tsx:707-713(.bc-verdict-label <p>); InnerMonologueCard.tsx:174(<span>)` — 클라이맥스 결과가 `<p>`, 섹션 타이틀이 `<span>`, verdict 카드에 aria-live 없어 auto-scroll이 시각 전용. → `.bc-verdict-label`을 h3로 승격 + verdict 카드에 `role="status"`/`aria-live="polite"`, inner-monologue 라벨도 헤딩. *verdict를 status로 announce = 절제 부합(극화 없이 알림).*

---

## 5. "내용을 감안하면 이렇게 보여야 한다"

### Hero
지금: 추상 couplet → 은유 promise → 40초 필름 → (뒤늦게) 문자적 줄.
**되어야 하는 모습:** 첫 화면 = 신화가 아니라 *이해된 제품의 예시로서의 신화*. 헤드라인 바로 아래 mono/small-serif 한 줄이 메커니즘을 평문으로: "당신이 고민 중인 결정을 쓰세요. Argus는 그게 걸린 가정 *하나*를 짚고, 당신이 정한 날 돌아와 확인합니다." 그 아래 단일 입력. 필름은 스크롤하면 깊어지는 레이어. CTA는 navy ink(금색 아님) — 기계는 클릭을 응원하지 않고 조용히 문을 연다. 금색은 이 화면에서 딱 한 번, 실제 인식의 순간에만.

### The Trail / ForkPath (증명 화면)
지금: 기계가 승자를 금테+초록✓로 고르고, 패자를 흐리게.
**되어야 하는 모습:** 이 화면의 일은 Argus가 *숨은 전제와 크루의 근거를 표면화*하는 걸 보여주는 것(이건 잘함) — 그다음 *사용자가 조타*하는 것. 세 갈래(또는 둘)는 **등가·등명도**로. 어느 것도 흐려지거나 축소되지 않는다. 전제/근거 블록은 "Argus가 찾았다"로 태그, 방위/선택은 "당신의 방위"로 태그. 승자 표시는 초록 판정이 아니라 "당신이 여기서 항로를 정함"이라는 중립 마커. 금테 글로우 전면 제거 — 선택된 것은 plain neutral border. ForkPath가 다시 살아난다면 금색 pivot을 낮추고 선언문을 *중립 crux 질문*으로. 메시지는 "여기 질문이 산다"이지 "여기 답이 있다"가 아니다.

### 워크스페이스 셸 & 항해 맵
**되어야 하는 모습:** 3-phase 스켈레톤(묶기/듣기/닿기)을 실제로 배선해 "당신이 확인합니다" 프레이밍이 셸에 상주하게. 바다 장식은 compact에서 최소화하고, 결정 콘텐츠(턴 헤드라인·포크 질문)가 항상 장식보다 무겁게. 맵의 step-back/fork는 마우스 없이도(키보드 waypoint 리스트) 가능하게. "다른 길을 내볼 수 있어요"는 중립 어포던스로 두되, 닫은 결정을 다시 열게 부추기지 않게. flat 단일 코스 결정이 서사적 분기 여정처럼 *느껴지지* 않게 — 드라마는 결정에 실재하는 만큼만.

### 결정 카드 & Seal/Verification 모먼트
- **VerificationGate:** Apply과 Exclude는 시각적 쌍둥이(둘 다 중립 아웃라인). 빨강 없음 — skip은 정상 편집이지 파괴 아니다. 금색은 사용자 최종 커밋만.
- **SealMoment:** 세리머니 무게 = 엔진이 이미 계산한 stakes에 비례. 경량 single_check → 조용한 인라인 체크 한 줄, 금 메달리언 없음. 풀 계약 → 메달리언. 왁스씰 오버슈트는 진짜 비가역 고-stakes만.
- **FinalCard:** 문서는 딜리버러블이므로 구분은 하되 *승리 감정*은 배출 — 금 체크를 중립 "document ready" 마크로, 금테를 hairline으로, scale-up 제거. 축하 금색은 실제 settlement("Right call") 순간에.
- **공통 원칙:** provenance는 색이 아니라 태그로 말한다. 기계 것과 사용자 것은 위계가 아니라 병치. 절제는 "조용함"이지 "안 보임"이 아니다 — Crisis escape, provenance disclaimer처럼 척추를 세우는 줄은 quiet-but-legible.

### Boss / inner-monologue
**되어야 하는 모습:** 카드를 앱 토큰(gold-leaf/ink)으로 되돌려 "보스가 책상에 돌아가 남긴 사적 로그"로 읽히게 — 타로 카드가 아니라. 신비 큐(perpetual glow, Sparkles) 강등, "재미로" 면책을 가시 라인으로. Calibration은 타이머 auto-fire가 아니라 조용한 opt-in 링크. verdict는 극화 없이 status로 announce.

---

## 6. 우선순위 로드맵

### P0 — 척추 위반 (지금 사용자에게 판정을 내리고 있음)
1. **Trail 필름** "Argus 추천" + 초록✓ + 금테 링 제거, chosen을 사용자 픽으로, 극들 등가화 (`DecisionVoyageFilm.tsx`) — **CRITICAL**
2. **VerificationGate** Apply/Exclude 대칭화, red 제거, 금색은 최종 커밋만 (`VerificationGate.tsx:90-98`)
3. **"현재 방위" co-brand** 해소 + plateTitle을 하달 판정→반환 핸들로 (`DecisionVoyageFilm.tsx`, #1과 함께)
4. **VoyagePhaseRail 배선 or 삭제** — 3-phase 리디자인이 dead code, "당신이 확인합니다" 프레이밍이 셸에서 누락 (`ProgressiveFlow.tsx:2390`) — **CRITICAL(structural)**

### P1 — comprehension + 체계적 척추/a11y
5. Hero에 제품 메커니즘 평문 한 줄 + CTA 금색→navy ink (`SirenHero.tsx`)
6. SealMoment/Synthesize에 stakes 게이트 스레드 → 경량 결정은 조용한 확인 (S2)
7. 다크모드 토큰 parity: Badge/Card/Synthesize/RecastLoader hex→페어드 변수 (S3)
8. Synthesize 키스트로크 judgment 저장 디바운스 (`SynthesizeStep.tsx:501`) — 학습 신호 오염
9. autoplay 필름 2개에 pause + reduced-motion poster + aria-live 제거 (S6)
10. SeaChart step-back/fork 키보드 접근 경로(waypoint 리스트) (`SeaChart.tsx`)
11. raw `<a>` → LocaleLink 2곳 (`ProgressiveFlow.tsx:2439,2453`) — lint 에러도 함께 해소

### P2 — a11y 마감 + polish
12. 44px 터치 타깃 일괄(이미 있는 패턴 복붙, S4) + bg-transparent 입력 focus ring (S5)
13. ErrorBoundary locale-aware href, native `confirm()`→인라인, history 삭제 nesting 수정
14. inner-monologue 카드 앱 토큰화 + calibration auto-fire→opt-in
15. CurrentBearingCard/Falsification 색상 중립화, FinalCard 승리 affect 배출
16. Footer 아이덴티티 행, nav 활성 pill fill 대비, 스트리밍 프리뷰 렌더 or 제거
17. 전역 focus 규칙 중복 정리 + radius 토큰 이름 충돌 해소 + `--bp-*` 스코프 하드닝
18. 헤딩 위계(`<h1>`) + 차트 색맹 안전 + 모바일 해도 접근 확인

---

## 부록 A — 잘 되어 있는 것 (실수로 "고치지" 말 것)

- **전역 reduced-motion:** `<MotionConfig reducedMotion="user">`(`LayoutShell.tsx:13`)가 transform/layout 루프를 이미 처리. 개별 컴포넌트에 중복 게이트 불필요(CSS keyframe/opacity 잔존분만).
- **VoyageMapRail 척추 노트**(`:27-29`)와 phase-rail의 "STATE + 사용자가 하는 일, verdict 없음" 규율 — 모범적 제로-판단 content-fit.
- **CollapsedSpine**(`VoyageMapRail.tsx:211`) — 중복 버튼 2개를 1 focus stop으로 + `focus-visible:ring`. 좋은 a11y craft, 회귀 금지.
- **DOM 순서** flow-first + `aria-hidden` 밸런싱 스페이서(`page.tsx:127-130`) — 키보드가 레일 전에 태스크 도달, 의도적·정확.
- **zustand `useShallow`/primitive-selector**(`page.tsx:92`, `VoyageMapRail.tsx:218`) — React #185 크래시 가드. "단순화" 금지.
- **VoyageChart confirm 모달**(`:284`)이 스토어의 fork-vs-switch 결정을 재사용 → 카피가 거짓말 못함. honest-authorship craft, 유지.
- **손으로 튜닝한 대비**(globals.css 주석의 비율 명시) — 정착된 값 relitigate 금지. 새 회귀만 플래그.
- **Testimonials "few on purpose"**(`:11-13`) — 단수는 의도적 정직. 헤더 문구만 조정.

## 부록 B — 방법론 & 한계

- 8개 표면을 각 3-렌즈 진단 에이전트로 병렬 감사 → 표면별 적대적 검증 에이전트가 코드 재확인하며 트집·오판 제거 및 심각도 재조정 → 종합. 워크스페이스 플로우 셸 1개 표면은 최초 패스에서 구조화 출력 실패 후 별도 에이전트로 재진단.
- 검증에서 **REJECTED**된 대표 오판: Hero disabled CTA "AA 대비 실패"(실측 ~5.3:1 통과), 보스 "전 루프가 reduced-motion 무시"(전역 MotionConfig가 transform 처리), AttributedSection "귀속 은닉"(텍스트 캡션 중복 존재).
- **PLAUSIBLE**로 남긴 것: 라이브에 미배선된 dead code(ForkPath, `.bp-seal-stamp`, `--bp-*` 누수)는 현재 위반이 아니라 예방적 하드닝.
- 이 문서는 진단이며 코드 변경을 포함하지 않는다. 구현은 위 로드맵 순서 권장.
