<!--
생성: 2026-07-02, 에이스팀 멀티에이전트 총체 감사 (46 에이전트)
파이프라인: 정찰 7 (라우트/워크스페이스/도구/랜딩/디자인시스템/철학문서/실화면 스크린샷)
→ 전문가 패널 4 (pm-dev · marketer-user · designer · philosophy, finding 44건)
→ 반박 검증 32건 (코드 대조, "틀렸다고 증명하라" 프로토콜: 생존 31 / 반박 1)
→ CEO 종합 초안 → 악마의 변호인 비판 10건 → CEO 최종판 (수용 10 / 기각·정정 기록)
finding 번호(F1~F31)는 부록 A를 가리킨다.
-->

# Argus 2.0 계획 (최종)

작성: 대표 / 2026-07-02
입력: 4-guru 패널 총평(pm-dev · marketer-user · designer · philosophy) + 반박 검증 통과 finding 31건 + **악마의 변호인 비판 10건+1 (코드 재검증 후 반영: 전면 수용 5, 부분 수용 5, 사실관계 정정 1)**

---

## 1. 경영진 요약 — 현재 상태 냉정 판정

**철학-제품 정합성: 설계 층 90 / 화면 도달 층 50. 합성 점수는 내지 않는다** — 무보정 가중 평균은 우리가 사용자에게 금지한 수사(스파인 규칙 2)이고, 자신에게도 쓰지 않는다. 초안의 "62/100"은 근거 없는 가중치(0.3/0.7)의 산수였으므로 철회한다. 두 층의 낙차 자체가 판정이다.

근거를 쪼개면 이렇다.

- **설계 층은 A급이다 (90).** 스파인 4개 조항이 전부 코드 불변식으로 번역돼 있다 — BindCard의 프리필 금지, Falsification의 `user`/`ai_surfaced` 출처 태깅과 3중 friction escape, SealMoment의 flat-결정 절제, CurrentBearing의 "proceed는 earned" 사다리. 이 수준의 자기규율을 가진 코드베이스는 드물고, 이것이 우리의 유일한 방어 가능 자산이다.
- **그러나 사용자가 실제로 만나는 화면은 그 설계를 세 겹으로 배신한다 (50).**
  1. 철학이 가장 공들인 두 화면(Falsification, SettlementModal)의 한국어가 **소스 레벨 mojibake로 판독 불가**다 (F9 — `Falsification.tsx`에서 직접 재확인 완료). 출처 정직성의 심장인 escape 버튼이 깨진 글자로 렌더된다.
  2. **기본(focus) 모드가 보지도 않은 AI 분석에 선장 승인을 자동 날인**해 출처를 세탁하고 학습 신호를 오염시킨다 (F10 — `ProgressiveFlow.tsx:1408` 재확인 완료). 재검증에서 오염 경로가 하나 더 확인됐다: 자동 승인은 `progressive-convergence.ts:156`의 워커 품질 점수까지 무검토 상태로 부풀린다(`approved.length > 0 && rejected.length === 0 → 15점`).
  3. 랜딩은 내부 헌법이 명시적으로 금지한 절대 주장("답을 대신 정하진 않아요 / it never decides for you")을 팔고 있다 (F27).
- **핵심 약속(봉인→귀환→정산)이 3개 진입 경로 중 1개에서만 완결된다.** progressive 본선만 살아 있고, 4-도구 체인은 종점이 죽었으며(F1, F2 — synthesize에 project_id를 넣는 코드가 0곳이라 봉인 자체가 구조적으로 불가), 랜딩이 직접 미는 /tools/review wedge는 귀환 루프 밖이다(F12).
- **첫 접촉면의 완성도가 코어보다 낮다.** 모바일 히어로의 250px 공백(F5), 내용 0의 224px 사이드바(F6/F8), 버튼으로 안 보이는 주 CTA(F7), 영어 사용자에게 통째로 한국어인 wedge(F11/F29). 4개 패널이 전원 같은 곳을 가리켰다.

**한 줄 판정: 엔진은 철학에 정렬돼 있으나, 제품은 그 철학이 화면에 도달하기 전에 세 번 새고 있다 — 진입에서, 기본 경로에서, 종결에서.** Argus 2.0은 신기능 확장이 아니라 **이미 설계된 약속을 모든 경로에서 실제로 이행하게 만드는 릴리스**다.

---

## 2. 핵심 진단 5개 (패널 교차 확인)

### 진단 1. 폐쇄 루프가 본선 전용이다 — "봉인→귀환→정산"이 제품의 1/3에서만 작동
(pm-dev F1·F2·F3·F12 + marketer F16·F18 + philosophy 총평 교차)

- 4-도구 체인: synthesize에 project_id 기록 0곳 → SealMoment("North-Star C" 주석이 달린 코드) 영구 도달 불가, legacy 프로젝트는 결정 계약 봉인 자체가 불가능 (F2).
- handoff 이중 단절: 발신자 없는 수신부(`from==='refine'`)와 수신부 없는 발신(Rehearse) (F1).
- review wedge: 봉인한 예측이 Header due 배지·/project 어디에도 안 뜸. 익명 사용자는 어떤 귀환 트리거도 못 받음 (F12) — "정한 날 돌아와 물어요"라는 랜딩 약속이 wedge에서 침묵으로 깨진다.
- Progressive→4R 탈출구도 착지에서 컨텍스트를 잃는다(F3) — 사용자 체감상 데이터 유실.

### 진단 2. 기본 경로가 스파인을 위반한다 — 철학은 옵션에만 살아 있다
(philosophy F10·F26·F27 + CLAUDE.md 제로-저지먼트 조항 교차)

- focus 모드(기본값)의 `approveAllPending()` 자동 호출: 미검증 분석이 approved=true로 흘러들고, XP/observation 부수효과가 "선장이 클릭한 것과 정확히 동일하게" 발화 → **CLAUDE.md 규칙 1의 신호-레벨 위반이자, patterns의 원료(빈도 진술) 오염** (F10). 재검증 추가 소견: convergence 점수 오염(§1 참조)까지 겹친다.
- CurrentBearing pill의 "진행(Proceed)" 어휘: 규칙 4(a) "방향 진술 금지"와 긴장 (F26).
- 랜딩 절대 주장: 헌법이 "절대 '우리는 판단하지 않는다'라고 쓰지 말라"고 못박은 바로 그 문장 형태 (F27). 제품 어디에도 잔여 lean 한계 고지가 없다 — 단, 헌법이 지정한 고지 형태는 **제품 레벨**이지 산출물별 표기가 아니다(라운드 5~8: "per-output tilt-tagging makes the violation worse"). 수리안 A3는 이 구분을 지킨다.

### 진단 3. 첫 접촉면이 코어보다 싸 보인다 — 전환이 가치 체감 이전에 샌다
(marketer F4·F5·F17 + designer F6·F7·F8·F23·F25 + pm-dev F11 + philosophy F29 — **4패널 전원 교차, 유일하게 만장일치인 진단**)

time-to-value 자체는 2~4분으로 나쁘지 않다(marketer 실증). 문제는 그 앞이다: 모바일 히어로 공백, 13MB 영상, 폴드 아래 입력창, 빈 사이드바, 안 보이는 CTA, 한국어 고정 wedge, 단위가 화면마다 다른 무료 한도. "깨져 보이는 것"이 가치 체감 전에 사용자를 내보낸다.

### 진단 4. 디자인 시스템의 비대칭 — 어려운 절반은 80점, 쉬운 절반이 50점
(designer F20·F21·F22·F23 단독이나 marketer F7 체감과 교차)

분류형 에러·스트리밍 로딩·다크모드·reduced-motion은 이미 상급. 반면 타이포는 임의 px 20종 1,565회의 무정부 상태(F20), 공용 Button 채택률 21%(F21), 잠금 화면은 벽만 있고 창이 없다(F23). **"움직이는 순간"은 고급인데 "멈춰 있는 순간"이 싸 보인다 — 첫인상은 멈춰 있는 순간에 결정된다.**

### 진단 5. "만들어놓고 잇지 않는" 조직 습관 — 부품 생산력 > 배선·검수 규율
(pm-dev F1·F2·F3·F13·F30·F31 + designer의 Button 21%·죽은 ChartPlate + marketer F18의 UI 없는 이메일 백엔드 + philosophy F9 교차)

producer 없는 수신부, set되지 않는 phase, import 0건인 컴포넌트, opt-in UI 없는 cron, unload flush 없는 debounce, 그리고 핵심 세리머니의 mojibake가 출시까지 발견되지 않은 QA 공백. 개별로는 minor지만 **동일 패턴의 축적**이며, 다음 기여자의 오판 비용과 사용자의 조용한 데이터 유실을 낳고 있다. 이것은 기능 문제가 아니라 **파이프라인 문제**고, CI 가드와 실사용 리허설로만 고쳐진다. **이 진단은 계획 자신에게도 적용된다** — 악마의 변호인 검증에서 초안의 A2(부품 신설)와 C4(grep 미실시)가 같은 습관을 반복하고 있음이 드러나 수정했다(§4).

---

## 3. Argus 2.0 북극성 + 하지 않을 것

### 북극성 (한 문장)

> **어느 문으로 들어온 결정이든 — 문서를 들고 왔든, 질문을 들고 왔든, 계획을 들고 왔든 — 정직한 출처로 기록되고, 봉인되고, 정한 날 돌아와, 현실로 정산된다.**

2.0은 새 약속을 만들지 않는다. 1.0이 이미 한 약속(`ARGUS-FINAL-DIRECTION.md`: "중요한 결정은 답으로 끝나지 않는다")을 **모든 경로에서** 이행한다.

**북극성의 유지보수 계약 — "문 3개, 루프 1개" (악마의 변호인 지적 6 반영):** "어느 문이든"은 3개 퍼널의 병렬 영구 유지 약속이 아니다. 심사했고, 결론은 **폐쇄가 아니라 수렴**이다: (a) H2-1의 절단 수술로 legacy 체인은 독자 종점을 잃고 본선의 SealMoment 하나로 합류한다 — 이미 문 하나를 루프에서 지우는 계획이다. (b) review wedge는 유일한 익명 획득 채널이라 문으로서 유지하되, H1-B5·H2-2로 같은 루프에 배선한다. (c) 계약: **모든 문은 단일 봉인-정산 루프로 합류해야 하며, 자기 루프를 따로 가지려는 문은 잘라낸다.** 배선 능력이 부족한 조직이 감당할 것은 루프 1개다 — 문 수가 아니라 루프 수가 유지비를 결정한다.

### 하지 않을 것 목록

| # | 하지 않을 것 | 이유 |
|---|---|---|
| 1 | **신규 도구·에이전트·표면 추가** (2.0 기간 전면 동결) | 진단 5의 원인이 부품 과잉·배선 부족이다. 부품을 더 만들면 병이 깊어진다. |
| 2 | **4-도구 legacy 체인의 종점(Synthesize) 완전 복원 공사** | 수리 대신 절단한다(§4 H2). refine을 이미 흡수한 전례가 있고 총 공사량이 적다. |
| 3 | **랜딩-앱 전면 톤 통일 / 리브랜딩** | 브리지 요소 3개 이식으로 충분 (F22 재검증 결과 브리지가 이미 상당 부분 존재). |
| 4 | **Boss 사주 엔진 유지·확장** | 근거 0의 실존 인물 성격 평결은 "불확실성은 이름 붙이지, 퍼뜨리지 않는다"와 양립 불가. 제거한다(§4 H2, §7) — 헌법 집행이지 손익 판단이 아니다. |
| 5 | **참여형 알림·리텐션 푸시** | 복귀 트리거는 "정산일 1회" 원칙. 그 이상은 over-fire의 채널 버전이다(스파인 규칙 4). |
| 6 | **사용자 대면 점수·등급·수락률 노출** | 스파인 규칙 2. 성공 지표도 이 제약 아래 설계한다(§6). |
| 7 | **강제 검증 게이트 / friction escape 제거** | F10의 수리는 "자동 승인 금지"가 아니라 "승인 기록의 정직화"다. 게이트를 강제로 바꾸면 다른 방향으로 스파인을 깬다. |
| 8 | **퍼널이 깨진 상태에서의 마케팅 실험(A/B, 광고 확대)** | 깨진 것 위의 실험은 노이즈만 산다. H1 완료가 실험의 전제 조건. |
| 9 | **간격(스페이싱) 전면 토큰화** | 타이포만 토큰화하고 간격은 8/12/32 3단 규약으로 끝낸다 — designer 자신의 완화안 채택. |
| 10 | **산출물별 lean/기울기 표기 UI** (신규, 악마의 변호인 지적 1에서 도출) | 라운드 5~8 결론 그대로 — "per-output tilt-tagging makes the violation worse". 한계 고지는 제품 레벨(가이드·FAQ) 한 곳에서만 한다. |

---

## 4. 실행 계획 — 3개 지평선

### H1. 지금 당장 (1~2주) — "배신 3건 + 깨져 보이는 것 전부"

세 트랙 병렬. 전부 국소 수리이며 신규 설계가 필요 없다.

**Track A — 스파인 응급수술 (철학 부채, ~3일)**

| # | 작업 | 파일 | 판정 근거 |
|---|---|---|---|
| A1 | mojibake 전량 복원(영문 원문 기준) + **원인 규명을 복원 PR의 머지 조건으로**: ① `git log -p --follow`로 오염 도입 커밋 특정(담당: A1 실행자, 기한: 복원 PR 이전), ② 해당 커밋의 생성 환경(CP949 로케일 에디터/스크립트) 확인 후 `.gitattributes` UTF-8 강제 + pre-commit 인코딩 유효성 훅으로 재발 차단, ③ 가드는 3중 — `\?[가-힣]`·U+FFFD 정규식 **+ 핵심 세리머니 파일(Falsification/SettlementModal/SealMoment)의 사용자 노출 문자열 known-good 픽스처 스냅샷 대조** (CP949→UTF8 mojibake는 '?' 없는 유효 유니코드로 렌더되어 정규식을 통과하므로, 픽스처 불일치 검출이 주 방어선) | `src/components/workspace/progressive/Falsification.tsx`(37건), `src/components/projects/SettlementModal.tsx`(4건+), 신규 `src/lib/__tests__/mojibake-guard.test.ts`, `.gitattributes` | F9 + 악마의 변호인 지적 7 수용. 원인 미상 복원은 재오염 예약이다 |
| A2 | **focus 자동 승인 삭제 (신설 아님)**: ProgressiveFlow.tsx:1402-1411 effect 제거. `approved: null`("선장 미판정")이 이미 정직한 상태이고, mix 정책(`mixableWorkerResults`의 `approved !== false`)이 자동 반영 UX를 그대로 보존한다 — 초안의 `approved_by` 필드·`autoApplyPending` 신설안 철회(진단 5의 자기 반복이었다). 단 "~5줄 삭제로 끝"은 아니다: `approved === true`에 의미를 싣는 소비자 3곳을 같은 커밋에서 재정렬한다 — ① `progressive-convergence.ts:156`(자동 승인이 workerQualityScore를 무검토 15점으로 부풀리던 오염 동시 제거), ② `agent-tools.ts:59`(`!== true` skip → mix 정책과 동일한 `!== false`로, focus 워커가 에이전트 도구에서 실종되지 않게), ③ `ProgressiveFlow.tsx:2748` handled 게이트(리뷰 스테퍼 진행 판정). FinalCard/AttributedSection의 auto 섹션 셰이딩 차등은 **기존 필드**(`approved===true` vs `null`)로 구현 + "열어보기" 핸들 유지 | `src/components/workspace/progressive/ProgressiveFlow.tsx:1402-1411,2748`, `src/lib/progressive-convergence.ts:156`, `src/lib/agent-tools.ts:59`, `FinalCard.tsx`, `AttributedSection.tsx` | F10 + 악마의 변호인 지적 2 부분 수용. 자동 반영 UX는 유지(스파인은 편의를 금지하지 않는다), 승인 기록의 거짓말만 제거 — 삭제+재정렬 ~1일. 검증 UX를 대화형으로 푸는 방향은 이 수리의 범위 밖("Verification is not a chat"은 협상 불가) |
| A3 | 랜딩 절대 주장 교체 — **제품 레벨 한계 고지 형태로** (초안 카피 "어느 쪽으로 기울었는지는 저희 한계로 표시해 둬요" 철회 — 산출물별 lean 표시 약속으로 읽히며 규칙 4(a) 위반): KO "갈리는 질문 하나를 돌려드려요. 희미한 기울기까지 지우진 못해요 — 그건 저희가 아는 한계예요", EN 'never decides for you' → 'hands the call back to you — one question, plus an honest note that no engine is perfectly neutral'. 가이드 FAQ에 잔여 lean 한계 항목 1개 추가(고지의 단일 위치). **산출물별 표기 UI는 만들지 않는다**(하지 않을 것 10) | `src/components/landing/UseCases.tsx:27`, `src/app/[locale]/guide/page.tsx` | F27 + 악마의 변호인 지적 1 수용. 헌법 지정 형태("name the faint lean as a known limit")는 제품 레벨 공개이지 per-output 태깅이 아니다 |
| A4 | CurrentBearing pill 어휘를 방향 진술→상태 기술로: proceed→"이의 없음(리뷰 기준)", hold→"미해결 쟁점 있음", collect_evidence→"확인 필요 항목 있음" + 1단어 출처 표기 | `src/components/workspace/progressive/CurrentBearingCard.tsx:26-33,113-115`, `src/lib/current-bearing.ts:189-203` | F26(부분확인). 카피 수정 수준이라 H1에 포함 |

**Track B — 루프 봉합, 최소 수리 (pm-dev, ~4일)**

| # | 작업 | 파일 | 판정 근거 |
|---|---|---|---|
| B1 | **synthesize에 project_id 배선만** (handoff.projectId 또는 getOrCreateProject). 초안에 묶여 있던 "sealable 게이트 4/4→핵심 산출물 존재로 완화"는 **H1에서 분리·제외** — `project/page.tsx:827-828` 주석("Seal only offered once the voyage is finished (all legs done)")이 §0 KICK의 의도적 설계이고, 게이트 완화를 지지하는 finding이 없으며, 미완 결정 봉인 유도는 거울 조항(설익은 결정에 세리머니)과 긴장한다. 게이트 문제는 H2-1 절단 수술에서 "all legs"의 정의 자체가 바뀔 때(rehearse가 종단 leg가 됨) 그 재정의의 일부로만 다룬다 | `src/stores/useSynthesizeStore.ts:26-33`, `src/components/workspace/SynthesizeStep.tsx:179-181` | F2 + 악마의 변호인 지적 3 수용. 배선 finding 밑에 제품 결정을 밀반입하지 않는다 — pm-dev 1순위는 배선이다 |
| B2 | 끊긴 다리로 보내지 않기: NextStepGuide의 rehearse→synthesize primary 안내 제거(전면 수리는 H2에서 절단으로 대체), RehearseStep에 `addRef(projectId, {tool:'rehearse'})` 추가 | `src/components/ui/NextStepGuide.tsx:50-60`, `src/components/workspace/RehearseStep.tsx:770-775` | F1의 **부분 채택** — §7 참조 |
| B3 | PipelineExitOptions를 풀 리로드→SPA 내 전환(setActiveStep+setHandoff)으로 교체, locale 없는 절대 URL 제거 | `src/components/workspace/progressive/ProgressiveFlow.tsx:2992,3007` | F3. "전환했더니 다 날아갔다" 체감 제거 |
| B4 | pagehide+visibilitychange('hidden')에서 `_pendingSyncs` 즉시 flush(sendBeacon/keepalive), `setFinalDeliverable`·봉인 등 종결 mutation은 debounce 우회 즉시 upsert | `src/stores/useProgressiveStore.ts:343-367` | F13. 클라이맥스 직후 이탈 = 최종 산출물 유실 창 봉쇄 |
| B5 | Header dueCount에 review receipt urgent 수 합산, 배지 클릭 시 소스별 분기(/project 또는 /tools/review) | `src/components/layout/Header.tsx:51-52`, `src/components/review/ReceiptList.tsx:47` | F12. wedge를 귀환 루프에 편입시키는 최소 수술 |

**Track C — 깨져 보이는 것 제거 (designer/marketer, ~5일)**

| # | 작업 | 파일 | 판정 근거 |
|---|---|---|---|
| C1 | 모바일 히어로 공백: 영상 미재생 상태에서 자막 거터에 intro 캡션 기본 표시 폴백(오버레이 이전은 하지 않음 — 의도적 설계 존중) + QA 체크리스트에 390px 히어로 스냅샷 | `src/components/landing/films/VoyageFilm.tsx:294-296,383` | F5·F25(부분확인). 모바일 유입 최상위 이탈 요인 |
| C2 | 히어로 영상 재인코딩: 720p·구간 단축으로 13MB→2~3MB, 모바일 `<source media>` 저용량 소스 | `public/voyage/voyage-film.mp4`, VoyageFilm.tsx | F25 |
| C3 | disabled 재정의: 투명도 감산→솔리드 감채도(배경 `--bg-hover`, opacity 1, 형태·44px 히트영역 보존), Button에 disabled 전용 depth + 인라인 opacity 오버라이드 금지, **ReviewFlow accent variant의 골드 배경 미적용 근원 조사** | `src/components/ui/Button.tsx`, `src/app/[locale]/workspace/page.tsx:583-585`, `src/components/review/ReviewFlow.tsx:589` | F7. designer "코드 3줄로 체감 최대" 1순위 |
| C4 | **사이드바 제거 결정 — 전체 내용물 grep 완료 기준으로 (초안의 "링크 3개"는 실사와 불일치했다)**: Sidebar.tsx의 실제 내용물 4종을 각각 거취 선언 — ① 유틸 링크 3개(가져오기/팀/가이드)→헤더 오버플로우(…), ② **operator 게이트 admin 링크(Sidebar.tsx:31)→같은 오버플로우에 operator 게이트 유지한 채 이전**(초안 누락분), ③ 페르소나 링크(Sidebar.tsx:74-85)→/teams로 이전 — 이 이전이 해당 링크의 legacy `/workspace?step=rehearse` href도 함께 은퇴시킨다(**H2-1 `?step=` 정리와 교차 의존 — C4를 먼저 하면 H2-1의 정리 대상이 하나 준다**), ④ 현재 프로젝트 표시 블록→Header의 기존 프로젝트 컨텍스트로 흡수 후 aside 삭제. 3중 내비 레지스터의 '팀'·'가이드' 중복도 함께 해소 | `src/components/layout/Sidebar.tsx`, `src/components/layout/LayoutShell.tsx:59-65`, `src/components/layout/Header.tsx` | F6·F8 + 악마의 변호인 지적 8 부분 수용. "지우는 것이 채우는 것보다 빠르다" 채택 — 단 Clean Removal 원칙(제거 전 전수 grep)을 계획 자신에게 먼저 적용 |
| C5 | review wedge 신뢰 정비: `(receipt_only)` 삭제 + enum 리터럴 카피 린트(`rg '(receipt_only\|store_source\|local_only)' --glob '*.tsx'` CI), review 디렉토리 5개 파일 L() 일괄 적용 + `tools/review/layout.tsx` 추가 | `src/components/review/ReviewFlow.tsx:583` 외 ReceiptList/ReceiptView/SealModal/SettleModal | F24·F15·F11·F29. EN 랜딩→한국어 앱 퍼널 단절 봉합 |
| C6 | 무료 한도 단위 통일: 사용자 노출은 "하루 결정 N개"로 단일화("로그인 없이 결정 2~3개 → 로그인하면 4~5개"), 콜 수는 내부 지표로만 | `src/app/[locale]/login/page.tsx:181-207`, workspace 배너, `src/lib/quota-config.ts` 주석 | F17 |

**H1 총량: 약 12 작업일.** 신규 설계 0, 전부 기존 시스템의 수리·채택·삭제다. (A2가 신설→삭제로 바뀌며 준 만큼 A1 원인 규명과 C4 전수 처리가 가져갔다.)

### H2. 다음 (1~2달) — "구조 정리 + 축적의 연결"

**용량 산정과 낙하 순서 (악마의 변호인 지적 5 수용):** 아래 7건 합계 **약 23 작업일** (1~2달의 실효 가용 20~40 작업일 하한에 걸림). 초과 시 낙하 순서는 **7 → 6 → 4** (어휘 정리·flat 핸들·히어로 재구성 순으로 H3 이월). 1(구조)·2(약속 이행)·5(헌법 집행)는 밀리지 않는다 — 특히 5를 4(전환 개선) 뒤로 미루는 것은 손익이 헌법을 이기게 두는 것이므로 금지.

1. **Legacy 체인 절단 수술** (F1·F2·F14·F30·F31의 근본 해결, **~4일**):
   - Synthesize 종점을 잘라내고 **RehearseStep에서 직접 SealMoment로 직결** — refine을 흡수한 전례 그대로. pm-dev 권고 채택. sealable 게이트의 "all legs done" 정의도 이 절단의 일부로서만 재정의한다(rehearse가 종단 leg — B1에서 분리한 게이트 문제의 정식 처리 위치).
   - 죽은 배선 3건 삭제(ReframeStep `from:'workspace'` 수신부, `'iterating'` phase, NextStepGuide `refine` 분기) — Clean Removal 원칙대로 grep 후 일괄.
   - legacy `?step=` 진입 링크 정리: 가이드의 "한 단계만 따로" 유스케이스(LegacyChip 4개)만 유지, pushState에 locale 프리픽스 포함. (C4가 사이드바 페르소나 링크의 `?step=rehearse`를 선제 은퇴시켰는지 교차 확인.)
   - NextStepGuide 클릭 통일: 화살표 LocaleLink 제거, 모든 행에 onClick + role/tabIndex/키보드 핸들러 (F30).
2. **wedge→본선 연결** (F16·F18, **~3일**): ReceiptView에 "이 문서로 결정 항해 시작" CTA(검수 요약을 `/workspace?q=` 프리필 또는 receipt를 project에 addRef). 봉인 화면에 정산일 이메일 1통 opt-in 체크박스 — **이미 살아 있는 checkin-due 백엔드에 UI만 배선**(죽은 경로 부활). guide FAQ의 stale 카피("메일·알림은 보내지 않아요") 수정.
3. **디자인 시스템 채택 캠페인** (§5 상세, **~7일** — designer 자체 추정 8~9일 중 H1 선반영분 제외): 타이포 6단 토큰 + 코드모드 치환, 주 전환 경로 Button 이관 + CI 차단 룰, LockedState 표준 컴포넌트, 톤 브리지 3요소 + 죽은 ChartPlate 실사용 연결.
4. **히어로 재구성** (F4, **~3일**): 입력 박스를 폴드 내 1차 요소로 승격(영상은 축소·보조로 — 제거 아님, §7 참조), 빈 상태 CTA 골드 filled, 회전 예시를 클릭 가능한 칩으로.
5. **Boss 사주 제거** (F28, **~4일 + 마이그레이션 고지**): 제거 대상은 사주 시드 층 — `lib/boss/`의 saju-interpreter·daily-energy·kyeol·zodiac + `components/boss/`의 SajuPreview·DailyMoodIndicator + BossSetup의 생년월일 입력 + useBossStore의 사주 필드(실측: lib/boss 8파일 중 4, components/boss 13파일 중 2+setup). 사용자 관찰 기반(axes/userContextHint) 시드를 기본으로 승격. 기존 사주 프로필 사용자에게는 마이그레이션 고지 1회. **판정 근거는 손익이 아니라 헌법이다**: 근거 0의 실존 인물 성격 평결 주입은 verdict-세탁 금지의 인물 버전이라 리텐션 기여가 얼마든 존치 사유가 못 된다(§7 참조). 다만 고지 대상 규모 산정용으로 사주 프로필 보유 사용자 수를 실행 전 1회 집계한다(재심 목적 아님).
6. **항해 어휘 정리** (F19, 부분확인 규모, **~1일**): '현재 방위'(카피) vs '현재 항로'(카드 라벨) 용어 통일, BindCard eyebrow에 기능 병기. 첫 노출 이중 라벨 → 2회차부터 메타포 단독.
7. **flat-결정 수동 봉인 핸들 반환** (philosophy 총평의 역방향 지적 수용, **~1일**): SealMoment가 flat 케이스에서 자동 프롬프트는 안 하되, 접힌 "그래도 봉인하기" 핸들은 노출 — 절제 원칙의 원형("가정 하나 명명 + 핸들 반환")대로. 개입 안 함을 기계가 확정하지 않는다.

### H3. 방향 (분기) — "귀환을 두 번째 기둥으로"

1. **정산 데이터의 가치 표면화**: 정산 완료된 결정이 쌓이면 patterns의 sample-size-scaled 빈도 진술로만 사용자에게 되돌린다(스파인 규칙 2 준수 — 점수·등급 없음). `CONCEPT-earned-self-portrait` 문서 방향의 신중한 구현.
2. **익명 귀환의 구조화**: 익명 wedge 사용자용 로컬 due 표면(재방문 시 최상단), .ics 기본 제안 유지. 웹푸시는 "정산일 1회" 원칙을 지킬 수 있을 때만 검토.
3. **EN 시장 본격화**: H1-C5로 i18n 부채가 청산된 뒤에만. 순서가 반대면 F29(약속-경험 갭)를 영어로 복제하게 된다.
4. **학습 신호 재교정**: A2 이후 오염 기간의 신호(자동 approved=true 및 convergence 부풀림 포함)를 격리하고 patterns 파이프라인 재검증.
5. **랜딩 실험 재개**: H1·H2로 퍼널이 봉합된 뒤 히어로 구성 A/B — "깨진 것 위의 실험 금지" 해제 시점.
6. **H2 낙하분 수용**: H2에서 이월된 항목(있다면 7→6→4 순)의 착지.

---

## 5. 디자인 50→80 로드맵 (designer 우선순위 그대로, 일정 배치)

designer의 5순위와 8~9 작업일 추정을 **그대로 채택**한다. 판정: 이 로드맵의 강점은 "신기능 없이 이미 있는 시스템(토큰·Button·AuthGuard)의 채택만으로 도달 가능"하다는 것이며, 이는 진단 5(배선 부족)의 처방과 정확히 일치한다.

| 순위 | 항목 | 규모 | 배치 | 내용 |
|---|---|---|---|---|
| 1 | 비활성 CTA 구조 | 1일 | **H1** (C3) | disabled = 솔리드 감채도, Button disabled depth, 인라인 opacity 금지. 최소 기준: "비활성이어도 버튼임이 1초 안에 읽힌다" |
| 2 | 빈 사이드바 제거 | 0.5~1일 | **H1** (C4) | aside 삭제 + 내용물 4종 전수 거취 선언(유틸 3·admin·페르소나·프로젝트 블록). IA 3중 레지스터 해소 부수효과 |
| 3 | 타이포 스케일 토큰화 | 2일 | **H2 초입** | 6단(11/12/13/15/18/24px + 고정 line-height)을 `@theme`에 caption/label/body/title/display 의미 이름으로 정의. 9px 이하 4+57회·반픽셀 4종 137회 코드모드 일괄 치환. 간격은 8/12/32 3단 스택 규약만 |
| 4 | 잠금·빈 상태 표준화 | 2일 | **H2** | `LockedState` 1개(가치 한 줄 + 블러 프리뷰 정적 이미지 + CTA + 탈출구)로 reframe/agents/import 통일. "잠금 화면은 벽이 아니라 쇼윈도" |
| 5 | 랜딩→앱 톤 브리지 | 3일 | **H2** | 전면 통일 아님. 3요소만: ① 워크스페이스 히어로에 `--bp-paper` 미세 텍스처/비네트, ② 섹션 라벨(ON FILE/LOG ENTRY) 레터스페이싱·괘선 유틸 공유, ③ 나침반 모티프 1종을 빈 상태·로딩에 재사용. 죽은 `ChartPlate.tsx`를 빈 상태에 실제 연결 |

**+ 유지 규율 (H2~상시, 진단 5 처방):**
- CI 3종: 골드 gradient 인라인 원시 button 차단(grep 룰), enum 리터럴 카피 린트, mojibake 3중 가드(정규식+픽스처 대조, A1).
- Button 채택률을 분기 내부 지표로 추적(21%→70% 목표) — 사용자 대면 아님.
- 390px 히어로 포함 핵심 화면 스냅샷을 QA 체크리스트에 고정.
- Button에 `fullWidth`·`loading` prop 추가로 이탈 사유 제거.

---

## 6. 성공 지표 — 스파인을 훼손하지 않는 측정

**측정 원칙 3개:** ① 사용자에게 점수를 보여주기 위한 지표 없음(전부 내부). ② 개입·수락·**봉인을 늘리라는 압력이 되는 지표 없음** — "전환율 상승"은 목표가 아니라 경보일 수 있다. ③ UI가 멀쩡한 것과 데이터가 도착한 것을 구분한다(Persistence Declaration).

| 지표 | 정의 | 2.0 목표 | 스파인 안전장치 |
|---|---|---|---|
| **루프 완결률** (북극성 지표) | 봉인된 결정 중 정산일 ±7일 내 정산된 비율, **진입 경로별**(progressive/review/legacy) | legacy·review 경로에서 0%(구조적 불가)→측정 가능 상태, 전체 상승 | 분모가 "봉인된 결정"이므로 봉인을 늘릴 유인이 없음. 정산 재촉 푸시 금지 — 리마인드는 opt-in 1회 |
| **봉인 가능성 복구** (악마의 변호인 지적 9 수용, 초안 "봉인 도달률" 대체) | ① 경로별 "봉인이 구조적으로 가능한가" 1회성 검증(수리 확인), ② **봉인을 시도한 사용자의 기술적 완료율**(시도→완료, 퍼널 무결성) | ① legacy·review 불가→가능, ② 95%+ | **세션→봉인 전환율은 측정하지 않을 것 목록으로 이동** — 경로별 상승을 목표로 보는 순간 flat 결정에 봉인 프롬프트를 늘리는 되먹임(규칙 4의 조직 버전)이 생긴다. `seal_not_armed` 집계는 절제 케이스 분리용으로만 유지 |
| **데이터 도착률** | 봉인·final_deliverable 로컬 기록 대비 서버 행 도착 비율 (B4 검증) | 유실 창 0 | — |
| **출처 정직성** | 학습 신호·convergence 입력에 선장 미클릭 `approved=true`가 0건인지 (A2 검증 — focus 모드 워커는 `null`로 남아야 정상) | 오염 0 | `null` 비율 자체를 낮추라는 목표는 두지 않음 — focus 모드는 정당한 UX |
| **절제 회귀** | flat 케이스 over-fire율 (스트레스 테스트 재실행) | 0% 유지 | 라운드 5~8 프로토콜 그대로 분기 1회 |
| **전환 누수 봉합** | 랜딩→첫 제출률(데스크톱/모바일 분리), /en/tools/review 이탈률 | 모바일 히어로 이탈 유의미 감소 | 히어로 실험은 H1·H2 완료 후에만 |
| **귀환률** | due 보유 사용자의 due일 ±7일 복귀율 (배지·이메일·ics 경로별) | 측정 개시 → 기준선 수립 | 채널 추가로 올리지 않는다 — 기존 채널 배선만 |

**측정하지 않을 것:** 세션 체류 시간, AI 제안 수락률(목표로서), **세션→봉인 전환율(목표로서)**, 일간 개입 수, 사용자별 판단 품질 점수. 이들은 전부 "더 개입하라/더 봉인시켜라"는 압력으로 되먹임되어 스파인 규칙 4를 조직 차원에서 위반하게 만든다.

---

## 7. 기각한 조언과 이유

패널 4-guru분과 악마의 변호인분을 통합한다. 초안의 10번 항목("verification 대화형화 선제 기각")은 아무도 제안하지 않은 허수아비였으므로 테이블에서 제거하고 A2의 범위 한정 문구로 강등했다 — 기각 테이블은 실제로 도착한 조언만 담는다(악마의 변호인 총평 지적 수용).

| # | 조언 (출처) | 판정 | 이유 |
|---|---|---|---|
| 1 | **F1 원안: Synthesize handoff 완전 복원** (pm-dev finding) | **부분 기각** | 종점을 살리는 수리 대신 **절단**(H2)을 택한다 — pm-dev 자신의 총평 대안("종점을 잘라내고 rehearse→SealMoment 직결이 총 공사량이 적다") 채택. H1에서는 사용자를 끊긴 다리로 보내는 안내만 내린다(B2). 죽은 종점에 공사비를 쓰는 것은 "만들어놓고 잇지 않는" 습관의 반복이다. |
| 2 | **F4 원안: 영상을 배경/보조로 강등** (marketer) | **부분 기각** | marketer의 "행동 우선"과 designer의 "랜딩 질감이 신뢰를 이월한다"(F22)가 상충한다. 중재: 입력을 폴드 내 1차 요소로 **승격**하되 영상은 축소·경량화(2~3MB)로 **유지**한다. 세피아 항해 세계관은 marketer 스스로 "고급스럽다"고 인정한 자산이고, 톤 브리지 전략의 원천이다. 감상과 행동은 배타적이지 않다 — 순서의 문제다. |
| 3 | **F28 최소안: 사주 유지 + 고지 강화** (philosophy finding의 '최소' 제안) | **기각, 강한 안 채택** | 고지를 아무리 강화해도 "근거 0의 실존 인물 성격 평결을 시뮬레이션의 심층 성향 층으로 주입"하는 구조는 남는다. 이는 verdict-세탁 금지("태그로 평결을 세탁할 수 없다")의 인물 버전이다. **판정 근거는 헌법 위반이며 그것으로 충분하다** — 초안의 "리텐션 기여보다 브랜드 희석이 크다"는 무측정 손익 단언은 철회한다(악마의 변호인 지적 4의 정당한 부분 수용). 관찰 기반 시드로 대체, 사주 제거(H2-5, 규모 실측 완료). |
| 4 | **간격 전면 토큰화** (designer 원안) | **기각** | designer 스스로 완화한 3단 스택 규약(8/12/32)만 채택. 타이포 토큰화가 위계의 80%를 해결하며, 간격 전면 공사는 H2의 다른 항목을 밀어낸다. |
| 5 | **정산 리마인드 채널 확장(Slack/Telegram 전면화)** (marketer F18 제안 일부) | **부분 기각** | 기존 텔레그램 cron은 유지, 이메일은 opt-in 1통만 배선한다(H2-2). 채널을 늘려 귀환률을 올리는 접근은 "돌아와 물어요"를 "돌아오라고 조르요"로 변질시킨다 — 하지 않을 것 5. 또한 F18 원안의 "SealMoment 캘린더 원클릭 추가"는 **이미 구현되어 있어**(SealMoment.tsx:383) no-op으로 기각. |
| 6 | **모든 legacy 링크 즉시 제거** (F14 원안의 함의) | **부분 기각** | 반박 검증이 밝혔듯 legacy 카드는 이미 `!currentHasVoyage`로 게이트되어 있고, 가이드의 "한 단계만 따로" 유스케이스는 실재한다. locale pushState 버그 수정 + 사이드바 페르소나 목적지 이전(C4)만 수행. 과잉 절단은 standalone 사용자의 실사용 경로를 부순다. |
| 7 | **F26을 major로 취급해 pill 구조 자체 재설계** | **부분 기각** | 반박 검증의 심각도 하향(minor~moderate)을 수용 — restraint 사다리와 중립 스타일은 이미 작동하고, markdown 내보내기로 새지도 않는다. 어휘 교체 + 출처 1단어만 H1에서 수행(A4). 구조 재설계는 과잉 수리다. |
| 8 | **랜딩 히어로 A/B 등 전환 실험 즉시 착수** (marketer 퍼널 관점의 자연 귀결) | **연기 (H3)** | 모바일 공백·13MB 영상·안 보이는 CTA가 살아 있는 상태의 실험은 노이즈를 산다. 봉합(H1)→재구성(H2)→실험(H3) 순서를 강제한다. |
| 9 | **"제로-저지먼트"를 랜딩 셀링 포인트로 더 세게 밀자** (marketer 총평의 확대 해석 여지) | **기각** | 헌법의 signboard 금지 조항 그대로 — 철학은 엔진이지 간판이 아니다. F27 수리는 주장을 "더 세게"가 아니라 "정직하게(제품 레벨 한계 공개형)" 만드는 방향이다(A3). |
| 10 | **악마의 변호인 지적 2의 규모 주장: "최소 수리 = effect 삭제 ~5줄"** | **부분 기각** (방향은 수용) | 신설안 철회와 삭제-우선 방향은 전면 수용했다(A2). 그러나 "5줄로 끝"은 코드 재검증과 불일치: `approved === true`에 의미를 싣는 소비자가 3곳 실재한다 — `progressive-convergence.ts:156`(approved===true 필터가 workerQualityScore 산정), `agent-tools.ts:59`(`approved !== true` skip — 삭제만 하면 focus 워커가 에이전트 도구에서 통째로 실종), `ProgressiveFlow.tsx:2748`(handled 게이트 — 삭제만 하면 focus 모드 리뷰 스테퍼가 영구 미완료). 무보정 삭제는 조용한 회귀 3건을 만든다. 정답은 삭제+소비자 3곳 재정렬(~1일)이다. |
| 11 | **악마의 변호인 지적 4의 함의: "리텐션 측정 후 Boss 제거를 재결정하라"** | **부분 기각** (근거 서술 수정·규모 산정은 수용) | 무측정 손익 단언의 철회, 제거 규모 실측(H2-5), 고지 대상 집계는 수용했다. 그러나 헌법 위반의 존폐를 리텐션 데이터에 거는 것은 기각한다 — 스파인 조항은 A/B 대상이 아니다. "거짓말이 전환율에 얼마나 기여하는지"를 측정한 뒤 거짓말을 끊을지 정하는 조직이 되는 순간, §6의 측정 원칙 전체가 장식이 된다. 측정 규율은 트레이드오프 결정에 적용되는 것이지, 불변식 집행에 적용되는 것이 아니다. |
| 12 | **악마의 변호인 지적 6의 함의: "문 수 자체를 줄여라(폐쇄)"** | **부분 기각** (심사 부재 지적은 수용) | 대전제를 심사대에 올리라는 지적은 정당했고, 심사했다(§3 "문 3개, 루프 1개" 계약 신설). 결론은 폐쇄가 아니라 수렴: review wedge는 유일한 익명 획득 채널이고(폐쇄 시 랜딩 퍼널의 절반이 죽는다), legacy 단계는 standalone 실사용이 반박 검증으로 확인됐으며(F14), H2-1이 이미 legacy의 독자 루프를 절단한다. 유지비의 함수는 문 수가 아니라 루프 수이며, 2.0이 끝나면 루프는 1개다. 이후 어떤 문이든 단일 루프 합류 계약을 어기면 그때 자른다. |
| 13 | **악마의 변호인 지적 8의 사실관계 일부: "Sidebar.tsx:77은 퀵스타트 CTA"** | **정정** (admin 링크 누락 지적은 수용) | 재검증 결과 77행은 별도 퀵스타트 CTA가 아니라 **페르소나 링크의 href**(`/workspace?step=rehearse`)이며, 페르소나 링크의 /teams 이전은 초안 C4에 이미 있었다 — 이전이 legacy href 은퇴를 겸한다는 교차 의존만 미기재였고, 이는 C4에 명기했다. 31행 admin 링크 누락은 실재한 구멍이었으므로 수용(C4 ②). |

---

### 마무리 판정

Argus 1.0의 문제는 철학의 부재도, 재능의 부재도 아니다. **약속과 이행 사이의 배선이다.** 4개 패널이 서로 다른 언어로 같은 것을 말했다 — pm-dev는 "producer 없는 수신부", designer는 "채택률 21%", marketer는 "UI 없는 백엔드", philosophy는 "설계는 A급, 화면은 B-". 그리고 악마의 변호인은 이 계획 자신도 같은 병에 감염될 수 있음을 보였다 — 지우면 될 곳에 부품을 신설하고(A2 초안), 자기 원칙(전수 grep, 근거 있는 수치, 제품 레벨 고지)을 자신에게만 면제하는 습관. 그래서 이번 수정의 원칙은 하나였다: **계획이 제품에 요구하는 규율을 계획 자신이 먼저 통과한다.** Argus 2.0은 확장 릴리스가 아니라 **이행 릴리스**다: 신규 표면 0, 기존 약속의 완결 100. 이 계획이 끝나면 우리는 "자기 철학을 실제로 구현한 흔치 않은 제품"이라는 philosophy 패널의 조건부 평가에서 조건을 뗄 수 있다.

---

## 부록 A — 검증 통과 finding 31건 (반박 검증 프로토콜 생존)

`confirmed` = 코드로 전면 확인, `partially` = 핵심은 사실이나 일부 과장/부정확(검증관 소견 병기).

### F1. [critical · pm-dev · confirmed] 4-도구 컨텍스트 체인의 종점(Synthesize)이 이중으로 끊겨 있다 — 발신자 없는 수신부와 수신부 없는 발신
- **상세**: SynthesizeStep의 handoff 수신부는 from==='refine'만 수용하는데 from:'refine'을 설정하는 코드가 코드베이스에 0건이다(전수 grep: setHandoff 호출은 reframe/recast/synthesize에서만, from 값은 'reframe'/'recast'/'synthesize'뿐). 동시에 RehearseStep의 NextStepGuide onSendTo는 navigate만 하고 setHandoff를 호출하지 않는다. 결과: 어떤 경로로도 synthesize에 내용이 pre-fill되지 않고, 리허설 결과는 종합 단계로 절대 넘어가지 않는다. 사용자는 '다음 단계: 종합' 안내를 따라가서 빈 입력창을 만나 수동 복붙해야 한다. 또한 rehearse는 addRef를 한 번도 호출하지 않아(grep 0건) NextStepGuide 자체가 latestFeedback.project_id 있을 때만 렌더되어 standalone 리허설은 다음 단계 안내조차 없다.
- **근거**: src/components/workspace/SynthesizeStep.tsx:163-170 (from==='refine'만 수용, producer 0), src/components/workspace/RehearseStep.tsx:770-775 (onSendTo가 navigate만), src/components/ui/NextStepGuide.tsx:50-60 (rehearse→synthesize primary 안내)
- **제안**: SynthesizeStep 수신부를 from 불문(또는 'rehearse'|'recast' 명시) 수용으로 바꾸고, RehearseStep의 onSendTo에서 latestFeedback(synthesis+results)을 setHandoff({from:'rehearse', content, projectId})로 발신. addFeedbackRecord 직후 addRef(projectId,{tool:'rehearse',...})도 추가.
- **검증관 소견**: SynthesizeStep.tsx:164는 from==='refine'만 수용하는데 전수 grep 결과 setHandoff의 from 값은 'reframe'(ReframeStep.tsx:1472,1490), 'recast'(RecastStep.tsx:784,835,853), 'synthesize'(SynthesizeStep.tsx:627)뿐이고 refine 컴포넌트 자체가 제거됨(workspace/page.tsx:983 주석). RehearseStep.tsx:774의 onSendTo는 onNavigate만 호출하고 setHandoff 없음, addRef도 RehearseStep 내 0건이며 NextStepGuide는 latestFeedback?.project_id(handoff.projectId 유래, RehearseStep.tsx:389)에 게이트되어 standalone 리허설엔 안내가 안 뜬다. 따라서 어떤 경로로도 synthesize pre-fill이 불가능하다는 주장 전부 사실.

### F2. [critical · pm-dev · confirmed] synthesize 항목에 project_id를 기록하는 코드가 0곳이라, 도구 경로 결정은 봉인(seal)→정산 루프에서 구조적으로 배제된다
- **상세**: useSynthesizeStore.createItem은 project_id 없이 항목을 만들고 SynthesizeStep.handleAnalyze도 넣지 않는다(다른 producer 없음). 도미노: (1) SynthesizeStep의 SealMoment는 sealProject(current.project_id 기반)가 항상 undefined라 영구 도달 불가 — 'North-Star C: 루프의 종점' 주석이 달린 죽은 코드. (2) /project의 4단계 중 '종합'이 영원히 not-started. (3) DecisionContractCard가 sealable={completedSteps===steps.length}로 게이트되어 legacy 4-도구 프로젝트는 결정 계약을 절대 봉인할 수 없다(sealable=false→buildFresh가 null). (4) '모든 단계를 완료했습니다' 완료 카드도 도달 불가. 즉 제품의 핵심 차별화(봉인→귀환→정산)가 progressive 경로에서만 작동한다.
- **근거**: src/stores/useSynthesizeStore.ts:26-33 (createItem에 project_id 없음), src/components/workspace/SynthesizeStep.tsx:179-181,208-209,609-616 (sealProject 게이트·SealMoment), src/app/[locale]/project/page.tsx:350,829,1013 (synthesize status 필터·sealable 게이트·완료 카드), src/components/projects/DecisionContractCard.tsx:190 (!sealable→null)
- **제안**: SynthesizeStep에서 handoff.projectId 또는 getOrCreateProject로 project_id를 createItem/updateItem에 배선. 단기 핫픽스로는 DecisionContractCard의 sealable을 completedSteps 4/4 대신 '핵심 산출물 존재(reframe done ∨ rehearse done)' 기준으로 완화.
- **검증관 소견**: 유일한 producer인 useSynthesizeStore.ts:26-32 createItem과 SynthesizeStep.tsx:208-209 handleAnalyze 모두 project_id를 쓰지 않고(git -S 이력에도 writer 없음, 다른 파일은 전부 읽기 전용), ReframeStep.tsx:1467-1468·RecastStep.tsx:380은 project_id를 기록하므로 synthesize만 유일하게 누락된 링크다. 도미노 4개 모두 실코드로 확인: SynthesizeStep.tsx:179-181 sealProject는 current.project_id가 항상 undefined라 609의 SealMoment 도달 불가, project/page.tsx:302+350에서 '종합' status 영구 not-started, 829 sealable={completedSteps===steps.length}는 최대 3/4이라 false→DecisionContractCard.tsx:190 candidate=null·:231 return null(legacy 프로젝트 봉인 불가), 1013 완료 카드도 동일 게이트로 도달 불가. progressive 경로(SealMoment livePredicates)만 작동한다는 서술까지 정확히 일치한다.

### F3. [critical · pm-dev · confirmed] Progressive→4R 탈출구(PipelineExitOptions)가 착지 지점에서 컨텍스트를 잃는다 — URL 파라미터 소비자 0, currentId는 풀 리로드에 증발
- **상세**: '→ 문제 재정의'/'→ 피드백 먼저' 클릭 시 아이템을 store에 넣고 window.location.href로 이동하는데, (a) addItem이 세팅한 currentId는 메모리 전용이라 풀 리로드에서 null로 초기화되고, (b) URL에 실은 handoff=progressive&itemId= 파라미터를 읽는 코드가 workspace page(step/reviewer/q/new/demo만 소비)·ReframeStep·RehearseStep 어디에도 없다. 결과: 사용자는 빈 입력 화면에 착지하고, 방금까지의 progressive 분석은 히스토리 탭에 선택되지 않은 채 숨는다. onRehearse 경로는 더 심해서 RehearseStep의 pendingProjectId도 비어 컨텍스트 체인 재조회(:313-325)까지 무력화된다. 사용자 체감상 '전환했더니 다 날아갔다'와 구별 불가.
- **근거**: src/components/workspace/progressive/ProgressiveFlow.tsx:2992,3007 (window.location.href=...&handoff=progressive&itemId=), src/stores/useReframeStore.ts:23,36-39 (currentId 메모리 전용), src/app/[locale]/workspace/page.tsx:1006-1014 (searchParams 소비 목록에 handoff/itemId 없음)
- **제안**: 풀 리로드 대신 SPA 내 전환(setActiveStep+setHandoff)으로 바꾸거나, 최소한 각 Step 마운트 시 searchParams의 itemId를 읽어 setCurrentId(itemId)하는 소비부를 추가. locale 없는 절대 URL도 함께 제거.
- **검증관 소견**: ProgressiveFlow.tsx:2992,3007이 addItem 후 window.location.href 풀 리로드로 이동하고, handoff/itemId 파라미터를 읽는 코드는 src 전체 grep에서 0건(page.tsx:1006-1014는 step/reviewer/q/new/demo만 소비, ReframeStep/RehearseStep은 useSearchParams 미사용). useReframeStore.ts:23,36-39의 currentId와 useHandoffStore.ts:19-26의 handoff 모두 메모리 전용이라 리로드 후 null → ReframeStep.tsx:934,941은 빈 입력 화면, RehearseStep.tsx:272의 pendingProjectId도 비어 :313-325/:412 컨텍스트 체인이 무력화됨. 유일한 완화 요소(아이템 자체는 localStorage에 동기 저장돼 히스토리 탭에 남음, proxy.ts:115-127이 locale-less URL을 쿼리 보존 307로 처리)는 finding 본문이 이미 정확히 반영하고 있음.

### F4. [critical · marketer-user · partially] 히어로의 실제 행동 진입점(입력 카드 2장)이 40초 루프 영상에 묻혀 CTA 존재감이 없다
- **상세**: 첫 화면의 시각적 주인공이 인터랙티브가 아닌 감상용 영상이고, WRITE/ON FILE 두 문은 그 아래 작은 회색 카드로 배치돼 있다. 방문자는 '볼 것'은 얻지만 '할 것'을 찾지 못한 채 스크롤하거나 이탈한다. 랜딩 CTA 3개가 전부 /workspace로 수렴하는 구조상 이 첫 진입점의 약함이 전환율에 직결된다.
- **근거**: landing.png(일러스트 카드 대비 하단 2개 소형 카드), SirenHero.tsx:250-450 (두 개의 문이 영상 아래 한 박스)
- **제안**: 입력 textarea를 히어로의 1차 요소로 승격(영상은 배경 또는 우측 보조로 강등)하고, '읽어봐 주세요' 버튼을 골드 filled 버튼으로. 회전 예시 프롬프트는 placeholder가 아니라 클릭 가능한 칩으로 노출해 1클릭 제출을 허용.
- **검증관 소견**: 핵심 구조 주장은 코드로 확인됨: SirenHero.tsx:195-227의 필름 플레이트가 min(92vw,1160px)·16:9(~650px 높이)로 히어로를 지배하고, 입력 박스(maxWidth 680, :256)는 그 아래 ~1150px 지점에 시작해 일반 노트북/1080p에서 폴드 아래로 밀림 — 컴포넌트 주석(:24-26)의 "스크롤 없이 타이핑 위치가 보인다"는 목표와 모순. 그러나 세부는 낡음: d54edd3(2026-07-01 18:15, 스크린샷 이후) 커밋으로 두 문은 회색 카드 2장이 아니라 캐럿 애니메이션·회전 예시·호버 슬라이딩 디바이더를 가진 단일 종이톤 스플릿 박스이고, '읽어봐 주세요' 버튼은 텍스트 입력 시 이미 골드 filled(:370-372)이며, ON FILE 문은 /workspace가 아닌 /tools/review(:409)로 간다.
- **정정된 서술**: 히어로의 시각적 주인공이 40초 루프 영상(VoyageFilm, ~650px 높이 플레이트)이어서 실제 행동 진입점(WRITE/ON FILE 스플릿 박스, maxWidth 680)이 일반 데스크톱 뷰포트에서 폴드 아래로 밀린다 — 이는 컴포넌트 자신의 설계 목표("스크롤 없이 입력 위치가 보인다", SirenHero.tsx:24-26)와 모순되므로 유효한 지적. 단, 진입점은 '작은 회색 카드 2장'이 아니라 캐럿·회전 예시·A/B 슬라이드를 갖춘 인터랙티브 단일 박스이고, 제출 버튼은 입력 시 이미 골드 filled이며(빈 상태에서만 ghost), CTA 중 ON FILE은 /tools/review로 분기한다. 남는 실제 개선 여지는 (1) 영상 대비 입력의 폴드 내 노출, (2) 빈 상태 CTA의 시각적 존재감, (3) 회전 예시의 클릭 가능화(현재 pointer-events:none).

### F5. [critical · marketer-user · confirmed] 모바일 랜딩에서 영상 카드 아래 ~250px 빈 공간이 생겨 페이지가 깨져 보인다
- **상세**: 390px 뷰포트에서 일러스트/영상 아래 캐러셀 도트만 있는 큰 공백이 히어로 직후에 나타난다. 모바일 유입(SNS·광고)의 첫 스크롤에서 '미완성/버그' 인상을 주는 최상위 이탈 요인.
- **근거**: landing-mobile.png (카드 하단 대형 공백 + 도트만 표시)
- **제안**: VoyageFilm 컨테이너의 모바일 높이를 콘텐츠에 맞게 축소하거나 자막 영역 高 고정값을 반응형으로 조정. QA 체크리스트에 390px 히어로 스냅샷 추가.
- **검증관 소견**: src/components/landing/films/VoyageFilm.tsx:383 — 모바일(<640px) 분기의 자막 gutter가 `height: 256`(고정값)인데, intro(t≥1.0s) 전이거나 캡션이 없으면 383–397행의 AnimatePresence가 null을 렌더해 398–403행의 진행 도트만 남은 ~250px 빈 종이 띠가 영상 바로 아래 나타난다. 이 상태는 첫 페인트~영상 1초 도달 전까지 모든 모바일 방문자에게 보이고, autoplay가 막히는 환경(iOS 저전력/데이터 절약, prefers-reduced-motion — 337–352행이 명시적으로 재생을 차단해 currentTime이 0에 고정)에서는 영구 지속되며, 루프가 t=0으로 돌아올 때마다(300–319행: shownIdx가 -1로 리셋) 매 40초 루프마다 재발한다. 제안된 원인 진단("자막 영역 高 고정값")과 스크린샷 상태가 코드와 정확히 일치한다.

### F6. [critical · marketer-user · partially] tools/review·guide·agents·tools/reframe 등 사이드바 페이지에서 내용 0의 빈 흰 사이드바가 220px을 차지한다
- **상세**: 비로그인 상태에서 Sidebar 영역이 항목 없이 흰 패널로만 렌더돼 데스크톱 전 페이지가 미완성으로 보인다. 특히 /tools/review는 랜딩 히어로가 직접 미는 wedge 페이지라 첫 유입자가 이 상태를 그대로 본다.
- **근거**: tools-review.png·guide.png·tools-reframe.png 좌측 흰 패널, LayoutShell.tsx:59-65 (workspace/boss 외 전부 Sidebar+본문)
- **제안**: 항목이 0개면 Sidebar를 렌더하지 않거나(조건부 collapse), 비로그인에게도 가이드·워크스페이스 링크 등 최소 항목을 채워 넣기.
- **검증관 소견**: Sidebar가 workspace/boss/landing/design/login 외 전 페이지(/tools/review·/guide·/agents·/tools/reframe 포함)에서 w-56(224px)로 렌더되는 것은 LayoutShell.tsx:54-66에서 확인된다. 그러나 "내용 0"은 거짓 — Sidebar.tsx:27-32의 utilityItems(가져오기/팀/가이드 3개)가 로그인 여부와 무관하게 항상 렌더된다(Sidebar.tsx:91-110). 다만 첫 방문자는 currentProject(:52)·personas(:68) 섹션이 조건부로 빠지고 mt-auto(:91)가 3개 링크를 최하단에 붙여 상단 대부분이 빈 흰 패널로 보이므로, "미완성으로 보인다"는 인상 자체는 타당하나 critical·내용 0 주장은 과장이다.
- **정정된 서술**: 비로그인/신규 방문자의 데스크톱에서 /tools/review·/guide·/agents·/tools/reframe 등 사이드바 페이지의 Sidebar(224px)는 프로젝트·페르소나 섹션이 조건부로 비어 상단이 전부 공백이고, 유틸리티 링크 3개(가져오기·팀·가이드)만 mt-auto로 최하단에 몰려 있어 거의 빈 패널처럼 보인다. 완전히 빈(항목 0) 것은 아니므로 심각도는 critical이 아닌 minor~major 수준의 첫인상 문제이며, 개선안(항목 적을 때 collapse 또는 비로그인용 최소 항목을 상단에 배치)은 여전히 유효하다.

### F7. [critical · designer · partially] 비활성 상태의 주 CTA가 시각적으로 소멸해 다음 행동 유도가 끊긴다
- **상세**: 워크스페이스의 '시작' 버튼은 disabled:opacity-30, 리뷰의 '검수 시작'은 Button의 disabled:opacity-40 위에 인라인 style opacity:0.5가 이중으로 얹혀 골드 그라디언트가 사실상 사라진다. 스크린샷에서 '검수 시작'은 테두리·배경 없는 플레인 텍스트로 읽히고, 워크스페이스 첫 화면(가장 중요한 전환 지점)에서 사용자는 '무엇을 누르면 되는지'를 형태로 인지하지 못한다. 빈 입력창 상태 = 모든 신규 방문자의 기본 상태이므로 이건 엣지가 아니라 디폴트 화면의 결함이다.
- **근거**: src/app/[locale]/workspace/page.tsx:583-585 (disabled:opacity-30), src/components/review/ReviewFlow.tsx:589 (disabled + style opacity 0.5 중첩), shots/workspace.png·tools-review.png에서 육안 확인
- **제안**: disabled를 투명도 감산이 아니라 '채도 감산'으로 재정의: 배경을 var(--bg-hover) 계열 솔리드로 바꾸고 opacity는 1 유지, 테두리·형태·44px 히트영역은 보존. Button 컴포넌트에 disabled 전용 variantDepth를 추가하고 인라인 opacity 오버라이드를 금지. 최소 기준: 비활성이어도 '버튼임'이 1초 안에 읽혀야 한다.
- **검증관 소견**: 코드 근거는 실재하나(workspace/page.tsx:583-584 disabled:opacity-30, ReviewFlow.tsx:589 inline opacity 0.5, Button.tsx:75 disabled:opacity-40) 메커니즘 서술이 틀렸다 — opacity는 동일 CSS 속성이라 인라인 0.5가 클래스 0.4를 '덮어쓰는' 것이지 이중 중첩(0.2)이 아니며, opacity 0.5만으로는 골드 그라디언트+테두리+그림자가 소멸할 수 없다(워크스페이스 '시작'은 opacity 0.3에서도 스크린샷 확대 확인 결과 명확한 골드 필 형태로 렌더됨). 반면 tools-review.png 확대·픽셀 샘플링 결과 '검수 시작'은 실제로 배경·테두리가 전혀 없는 플레인 텍스트로 렌더되어 있어(픽셀이 페이지 배경색 246,244,240과 동일) 그 화면의 결함 자체는 확인되지만, 이는 finding이 지목한 opacity 중첩으로는 설명되지 않는 별개 원인(accent variantDepth 인라인 스타일이 아예 적용 안 된 상태)이다.
- **정정된 서술**: 리뷰 페이지 '검수 시작'(ReviewFlow.tsx:589)은 빈 입력 기본 상태에서 배경·테두리 없는 플레인 텍스트로 렌더되어 버튼임을 인지할 수 없다(스크린샷 픽셀 확인) — 다만 원인은 disabled:opacity-40과 inline opacity:0.5의 '중첩'이 아니라(같은 속성이라 인라인 0.5만 적용됨) accent variant의 골드 배경 스타일이 실제로 적용되지 않고 있는 것으로, 별도 근원 조사가 필요하다. 워크스페이스 '시작'(page.tsx:583, disabled:opacity-30)은 흐릿하지만 골드 필 형태가 유지되고 바로 옆에 '한 줄만 적어도 시작할 수 있어요' 안내문(page.tsx:580-582)이 있어 심각도는 critical이 아닌 moderate — 대비 강화는 여전히 권장된다. 인라인 opacity 오버라이드 금지와 disabled를 채도 감산으로 재정의하자는 제안은 유효하다.

### F8. [critical · designer · confirmed] tools/guide/agents 전 페이지에 사실상 빈 224px 사이드바가 렌더되어 미완성 인상을 준다
- **상세**: Sidebar는 currentProject·personas가 없는 신규/비로그인 사용자에게 상단이 완전히 비고, 유틸 링크 3개(가져오기/팀/가이드)만 mt-auto로 바닥에 깔린다. 1440px 스크린샷에서 좌측 흰 기둥이 내용 0으로 보이며, 첫인상 신뢰도를 가장 크게 깎는 요소다. 또 헤더(워크스페이스/프로젝트/설정) + 사이드바(가져오기/팀/가이드) + 워크스페이스 칩(AI 팀 소개/보고 상대 설정/팀/가이드)의 3중 내비 레지스터가 겹쳐 '팀'과 '가이드'가 두 곳에 존재한다.
- **근거**: src/components/layout/Sidebar.tsx:49-111 (빈 상단 + mt-auto 유틸 3개), src/components/layout/LayoutShell.tsx:59-65, shots/tools-review.png·guide.png·agents.png 좌측 공백 기둥
- **제안**: 사이드바를 제거하고 유틸 3개를 헤더 오버플로우(… 메뉴)나 푸터로 이동 — 워크스페이스/보스는 이미 사이드바 없이 살고 있으므로 IA가 단순해진다. 유지한다면 빈 상태 규칙 필수: 콘텐츠가 임계치 미만이면 aside를 렌더하지 않는 조건 분기.
- **검증관 소견**: Sidebar.tsx:49-111 확인 — currentProject 블록(52)과 personas 블록(68)은 모두 조건부이고, 페르소나 시딩은 RehearseStep.tsx:254에서만 실행되므로 워크스페이스를 거치지 않은 신규 사용자는 /tools·/guide·/agents에서 w-56(224px) aside 상단이 완전히 비고 mt-auto 유틸 링크 3개만 바닥에 렌더된다(LayoutShell.tsx:59-65 기본 분기가 이 경로들에 사이드바를 붙임; /guide·/tools/review는 public-paths.ts:12,29로 비로그인도 노출). 3중 레지스터도 실재: Header.tsx:29-31(워크스페이스/프로젝트/설정), Sidebar.tsx:27-32(가져오기/팀/가이드), workspace/page.tsx:620-635 칩(AI 팀 소개/보고 상대 설정/팀/가이드)로 '팀'·'가이드'가 두 표면에 중복된다. 유일한 사소한 결함은 shots/*.png가 레포에 없고 팀/가이드 중복이 동일 화면 동시 노출은 아니라는 점(워크스페이스엔 사이드바 없음)이나, finding이 그렇게 주장하지도 않았으므로 서술은 유지된다.

### F9. [critical · philosophy · confirmed] 철학의 두 핵심 화면(Falsification·SettlementModal)의 한국어가 소스 레벨 mojibake로 깨져 있다.
- **상세**: Falsification.tsx에 37개, SettlementModal.tsx의 date-only 정산 분기에 4개 이상의 한국어 문자열이 CP949→UTF-8 mojibake로 파일에 박혀 있다. 스트레스테스트 단계의 제목/설명/중립 crux 질문('이게 정말 맞나요?'가 '?닿쾶 ?뺣쭚 留욌굹??'로), 그리고 출처 정직성의 핵심인 escape 버튼('이 문장 그대로 쓰기', '직접 안 쓸게요 — AI가 짚은 걸로 할게요')이 전부 깨진 글자로 렌더된다. 정산 모달 한 분기의 타이틀 '그래서, 어떻게 됐어요?'도 '洹몃옒?? ?대뼸寃??먯뼱??'다. 제품의 차별화 순간(반증→봉인→정산)이 한국어 사용자에게 판독 불가능하게 도착하고, friction escape가 사실상 접근 불가가 되어 철학 설계 자체가 화면에서 무효화된다.
- **근거**: src/components/workspace/progressive/Falsification.tsx:111-117,141,220-221,234,271,291 (예: L('怨꾪쉷 ?쒗뿕','Stress-test'), L('?닿쾶 ?뺣쭚 留욌굹??','Is it actually true?')); src/components/projects/SettlementModal.tsx:170,173,181,189 (title={L('洹몃옒?? ?대뼸寃??먯뼱??','So, how did it go?')}). 파일은 valid UTF-8 — 깨진 글자가 소스에 실제로 저장돼 있음(렌더 시 그대로 노출).
- **제안**: 두 파일의 mojibake 문자열을 영어 원문 기준으로 전량 복원하고, CI에 한글 mojibake 패턴(예: /\?[가-힣]{2}/ 또는 U+FFFD·CP949 잔재 정규식) 가드 테스트를 추가해 재발을 막는다. 커밋 파이프라인의 인코딩 손상 원인(에디터/패치 적용 경로)을 추적한다.
- **검증관 소견**: 모든 인용 지점에서 mojibake 실재 확인: Falsification.tsx:110('怨꾪쉷 ?쒗뿕'), 234('?닿쾶 ?뺣쭚 留욌굹??'), 271/291(두 escape 버튼), SettlementModal.tsx:170/173/181/189(date-only 분기) — 파일은 valid UTF-8이라 깨진 글자가 그대로 렌더된다. Falsification.tsx의 L() 14개 중 9개의 한국어가 깨졌고 mojibake 잔재 라인은 38줄로 '37개'는 주석 포함 집계와 일치한다(사용자 노출 문자열만은 9개). 경미한 과장 둘 — believe-all escape(L202 '전부 믿겠어요')와 SettlementModal 본분기 타이틀(L200)은 멀쩡 — 이 있으나 finding 자체가 '한 분기'로 한정했고 핵심 화면(crux 질문·escape 2종·정산 분기)이 실제로 판독 불가이므로 critical 판정은 타당하다.

### F10. [critical · philosophy · confirmed] 기본(focus) 모드가 사용자가 보지 않은 AI 분석에 '선장 승인'을 자동 날인해 출처를 세탁한다.
- **상세**: approveAllPending()은 주석상 'VerificationGate의 명시적 확인-없이-출항 override 전용 — 선장이 수락했음을 정직하게 기록'하기 위한 함수인데, focus 모드(기본값)는 워커가 끝나면 이를 자동 호출한다. 내부적으로 approveWorker를 재사용해 'XP/observation 부수효과가 선장이 반영을 클릭한 것과 정확히 동일하게' 발화한다. 결과: (1) 미검증 AI 결과가 approved=true로 초안에 흘러들어 VerificationGate의 존재 이유('미검증 분석이 몰래 흘러들지 않게')가 기본 경로에서 죽고, (2) 에이전트 학습 신호가 가짜 사용자 승인으로 오염되며(패턴/보정의 원료), (3) 자동 승인과 사용자 승인이 데이터상 구별 불가 — CLAUDE.md 규칙 1(기계 행위가 사용자 소유 의미를 조용히 상속 금지)의 신호-레벨 위반.
- **근거**: src/components/workspace/progressive/ProgressiveFlow.tsx:1402-1411 (focus 모드 자동 store.approveAllPending()); src/stores/useProgressiveStore.ts:276-279('explicit "proceed without checking" override... honestly records'), 1745-1753('exactly as if the captain had clicked 반영'); src/components/workspace/progressive/VerificationGate.tsx:14-19(불변식 선언).
- **제안**: 자동 반영은 유지하되 승인 주체를 분리: WorkerTask.approved에 approved_by: 'user' | 'auto' 필드를 추가하고, 자동 경로에서는 XP/observation 부수효과를 발화하지 않는 별도 store 액션(autoApplyPending)을 쓴다. FinalCard/AttributedSection에서 auto-applied 섹션은 출처 셰이딩을 살짝 달리해 '열어보기'로의 핸들을 남긴다.
- **검증관 소견**: 모든 인용이 실코드와 일치: focus 모드는 기본값(ProgressiveFlow.tsx:1058-1059, classic_session 기본 false)이고, 워커 정착 시 자동으로 store.approveAllPending() 호출(ProgressiveFlow.tsx:1402-1411), 이는 approveWorker를 재사용해 'task_approved' XP 적립과 onTaskApproved observation(3회째 선호 observation 생성, 5회마다 LLM 배치 분석 — observation-engine.ts:18-49)을 사용자 클릭과 동일하게 발화한다(useProgressiveStore.ts:1745-1753, 1211-1231). approved_by 류 필드는 코드베이스 전체에 부재(grep 0건)해 자동/수동 승인이 영속 데이터상 구별 불가하고, VerificationGate는 unreviewedWorkers>0일 때만 열리므로(ProgressiveFlow.tsx:2012-2016) 자동 승인이 선행되는 기본 경로에서 게이트가 사실상 발화하지 않는다 — 유일한 완화책은 '열어보기' 뒤 사후 제외 가능성뿐이며 이미 발화한 observation/XP는 되돌리지 않는다.

### F11. [major · pm-dev · confirmed] 랜딩이 양 locale 모두에게 미는 공개 wedge(/tools/review)의 컴포넌트 5개 전부가 i18n 0건 — /en 방문자가 한국어 UI를 본다
- **상세**: src/components/review/ 디렉토리(ReviewFlow, ReceiptList, ReceiptView, SealModal, SettleModal)에 useLocale/useT/L() 사용이 전무하고 모든 카피가 한국어 하드코딩이다('짚어드립니다', '검수 시간 초과', 봉인/정산 모달 전체). SirenHero의 ON FILE 문과 워크스페이스 ON FILE 카드가 EN 사용자를 직접 이 페이지로 보내므로, 영어 랜딩→한국어 앱이라는 퍼널 단절이 첫 인상에서 발생한다. 다른 tools 페이지가 전부 locale metadata layout을 갖춘 것과 달리 review만 layout도 없다.
- **근거**: grep: src/components/review/ 전체에 useLocale|useT 0건; src/components/review/ReviewFlow.tsx:201-206,479 (한국어 고정 문자열); src/components/landing/SirenHero.tsx:409 (EN 랜딩에서 /tools/review로 유도)
- **제안**: review 디렉토리에 L() 헬퍼 일괄 적용(다른 Step들과 동일 패턴) + tools/review/layout.tsx 추가. 최소 범위는 랜딩에서 바로 보이는 import 화면과 receipt 라벨.
- **검증관 소견**: src/components/review/ 5개 파일 전체에 useLocale|useT|L( 0건, 한국어 하드코딩 155건(전 파일)이며 ReviewFlow.tsx:201('검수 시간 초과'), :477-480('기존 문서 검수하기', '짚어드립니다') 그대로 존재. SirenHero.tsx:408-410이 LocaleLink href="/tools/review"로 EN 카피('ON FILE · upload it')와 함께 유도하므로 /en 방문자가 한국어 UI를 보는 퍼널 단절이 실재. src/app/[locale]/tools/ 하위에서 reframe/refine/rehearse/recast/synthesize는 전부 locale metadata layout.tsx를 갖췄으나 review만 layout 부재도 사실.

### F12. [major · pm-dev · confirmed] Review에서 봉인한 예측이 글로벌 귀환 루프 밖에 있다 — 확인일이 와도 Header 배지·/project 어디에도 안 뜬다
- **상세**: Header의 due 배지는 projects[].decision_contract만 센다. review receipt의 next_check_by는 /tools/review 내부 ReceiptList에서만 표면화되고, /project 페이지는 review store를 아예 읽지 않는다(grep 0건). 이메일 cron(companion-brief)이 있으나 Supabase에 동기화된(=로그인) 사용자만 커버한다. 이 wedge는 익명 허용이 셀링 포인트이고 랜딩이 익명 사용자를 직접 밀어넣는데, 그 익명 사용자는 확인일이 와도 어떤 인앱/이메일 트리거도 받지 못한다 — '정한 날 돌아와 물어요'라는 랜딩 약속이 wedge 경로에서만 조용히 깨진다.
- **근거**: src/components/layout/Header.tsx:51-52 (dueCount가 projects만 집계), src/components/review/ReceiptList.tsx:47 (dueCount는 페이지 내부 전용), src/app/api/cron/companion-brief/route.ts:67-73 (서버 테이블 기반=로그인 전용), grep: project/page.tsx에 review_receipts/useReviewStore 0건
- **제안**: Header dueCount에 useReviewStore의 urgent receipt 수를 합산하고 배지 클릭 시 due 소스에 따라 /project 또는 /tools/review로 분기. /project 목록에도 due receipt 행을 추가하면 wedge→본제품 연결 고리도 생긴다.
- **검증관 소견**: Header.tsx:51-53의 dueCount는 projects[].decision_contract만 집계하고, review receipt due는 src/components/review/ReceiptList.tsx:47에서 /tools/review 내부에서만 계산되며, src/app/[locale]/project/page.tsx에는 useReviewStore/review_receipts 참조가 0건이다(reviewerCount 등 무관한 매치뿐). 이메일 귀환 트리거인 companion-brief cron(route.ts:67-74)은 Supabase review_receipts 테이블 기반인데 src/lib/review-sync.ts:10이 명시하듯 익명 사용자는 user_id가 없어 동기화가 "silent no-op"이므로 커버 대상이 아니다. 랜딩(SirenHero.tsx:409)이 익명 허용 public path인 /tools/review로 직접 유도하는 것도 사실이라, 익명 wedge 사용자는 확인일에 인앱 배지·이메일 어느 트리거도 받지 못한다는 서술이 그대로 성립한다.

### F13. [major · pm-dev · confirmed] progressive 세션 저장이 3초 trailing debounce인데 unload flush가 없어, 완성·봉인 직후 이탈하면 최종 산출물이 서버에 영영 안 닿는다
- **상세**: persist()는 세션 변경마다 타이머를 리셋하는 trailing 3초 debounce로 Supabase upsert를 미룬다. beforeunload/pagehide/visibilitychange flush는 코드베이스에 ScrollTracker(분석 이벤트용)에만 존재한다. 항해의 클라이맥스(완성 배너→SealMoment)는 사용자가 탭을 닫기 직전의 마지막 상호작용이므로 정확히 이 3초 창에 걸릴 확률이 가장 높은 지점이다. decision_contract는 project 경유 즉시 upsert라 계약은 살아남지만, 세션의 final_deliverable/drafts/bearing_entries는 유실된다 — 다른 기기에서 열면 '봉인은 됐는데 문서·경위가 없는' 반쪽 상태. localStorage-first라 같은 기기에선 멀쩡해 보여서(CLAUDE.md의 Persistence Declaration이 경고하는 바로 그 패턴) 발견도 늦다.
- **근거**: src/stores/useProgressiveStore.ts:343-367 (trailing 3s debounce persist), grep: beforeunload|pagehide|visibilitychange가 src/components/landing/ScrollTracker.tsx:49-50 외 0건
- **제안**: pagehide+visibilitychange('hidden')에서 _pendingSyncs를 즉시 flush(가능하면 keepalive fetch/sendBeacon 경유). 최소한 setFinalDeliverable·계약 봉인 같은 종결 mutation은 debounce를 우회해 즉시 upsert.
- **검증관 소견**: persist()는 세션당 trailing 3초 debounce로만 upsert하고(src/stores/useProgressiveStore.ts:342-367), setFinalDeliverable(같은 파일 800-882행)도 이 경로만 타며 즉시 upsert 우회가 없고, pagehide/visibilitychange/beforeunload flush는 코드베이스 전체에서 ScrollTracker.tsx:49-50(분석 이벤트용)뿐임을 확인했다. 봉인은 updateProject→createItemStore.ts:65의 즉시 upsertToSupabase라 계약은 살아남지만, loadSessions(useProgressiveStore.ts:534-582)는 pull-only 병합이라 로컬이 더 새로워도 서버로 되밀지 않으므로 debounce 창에서 유실된 final_deliverable/drafts/bearing_entries는 재방문 로드만으로는 복구되지 않는다. 유일한 완화는 같은 기기에서 이후 progressive 스토어를 다시 mutate하면 persist가 전 세션을 재업서트한다는 점("영영"의 경미한 과장)이나, 제기된 시나리오(완성·봉인 직후 이탈 후 다른 기기 접근)에서는 유실이 그대로 성립한다.

### F14. [major · pm-dev · partially] 주 내비게이션(사이드바·가이드·/project 단계 카드)이 종점이 파손된 legacy ?step= 모드로 여전히 사용자를 보낸다
- **상세**: progressive가 공식 본선이고 /project 코드 주석조차 4-도구 store를 'dead'라 부르는데, 사이드바 '페르소나'(?step=rehearse), 가이드의 4개 LegacyChip, /project의 4단계 카드·'다음 단계' CTA가 전부 legacy 탭 모드로 연결된다. 이 모드의 종점은 위 finding들(rehearse→synthesize 단절, synthesize 봉인 불가)로 완주가 불가능하므로, 정식 내비가 완주 불가능한 흐름으로 트래픽을 보내는 셈이다. 부수적으로 legacy 모드 내 이동은 window.history.pushState(null,'','/workspace?step=…')로 locale 프리픽스를 URL에서 떨어뜨려, 그 URL을 공유/북마크하면 수신자 쿠키 기준 locale로 재해석된다.
- **근거**: src/components/layout/Sidebar.tsx:77, src/app/[locale]/guide/page.tsx:432-435, src/app/[locale]/project/page.tsx:315-349 (모두 /workspace?step=* 링크), src/app/[locale]/workspace/page.tsx:1059 (locale 없는 pushState), src/app/[locale]/project/page.tsx:136-137 ('dead 4-tool stores' 주석)
- **제안**: legacy 진입 링크를 단계별 유지가 필요한 곳(가이드의 '한 단계만 따로' 유스케이스)만 남기고, 사이드바 페르소나는 /teams 또는 rehearse 전용 화면으로, /project 단계 카드는 legacy 프로젝트에서만(이미 그렇게 함) + 종점 수리와 함께 유지. pushState에는 locale 프리픽스를 포함.
- **검증관 소견**: 링크 사실은 전부 실재: Sidebar.tsx:77(페르소나→?step=rehearse), guide/page.tsx:432-435(LegacyChip 4개), project/page.tsx:315-349(?step= 카드), workspace/page.tsx:1059(locale 없는 pushState, proxy.ts:115-120이 수신자 쿠키/Accept-Language로 307 재해석). 그러나 가이드 칩은 접힌 '고급—단계별 직접 사용' 섹션(finding 자신이 남기라는 유스케이스)이고, /project 카드·'다음 단계' CTA는 !currentHasVoyage로 이미 voyage 프로젝트에서 숨겨지며(project/page.tsx:851,988), 핵심 전제인 '종점 파손으로 완주 불가'는 legacy SynthesizeStep에 SealMoment가 실재하고(SynthesizeStep.tsx:609-615, decision_contract 기록) RehearseStep에도 NextStepGuide 연결이 있어(RehearseStep.tsx:770-775) 현행 코드로 뒷받침되지 않는다.
- **정정된 서술**: legacy ?step= 진입 링크가 남아 있는 곳은 (a) 사이드바 페르소나 목록(Sidebar.tsx:77 → ?step=rehearse; 프로세스 단계 링크 자체는 이미 제거됨), (b) 가이드의 접힌 '고급' 섹션의 4개 LegacyChip(의도된 단계별 standalone 유스케이스), (c) /project의 4단계 카드·CTA — 단 이들은 !currentHasVoyage로 voyage/계약 프로젝트에서는 이미 숨겨지고, 신규(voyage 없는) 프로젝트에서만 legacy 모드로 유도한다. legacy 모드 내 이동의 pushState(workspace/page.tsx:1059)가 locale 프리픽스를 떨어뜨려 공유/북마크 URL이 수신자 locale로 재해석되는 것은 실재하는 minor 버그. 반면 'legacy 종점이 파손되어 완주 불가'라는 전제는 현행 코드와 불일치 — SynthesizeStep에 SealMoment(봉인)가 연결되어 있고 RehearseStep에 NextStepGuide(다음 단계 이동)가 있다. 심각도는 major가 아니라 minor(locale pushState 수정 + 사이드바 페르소나 링크 목적지 재검토) 수준.

### F15. [major · marketer-user · confirmed] review 페이지에 내부 용어(receipt_only) 노출 + i18n 전면 미적용
- **상세**: 체크박스 설명에 '(receipt_only)'라는 코드 식별자가 그대로 보이고, ReviewFlow 전체가 한국어 하드코딩이라 /en/tools/review 방문자(랜딩 EN 히어로가 직접 링크)가 한국어 UI를 만난다. 신뢰 상품(판단 검수)에서 디테일 신뢰를 깎는다.
- **근거**: tools-review.png '(receipt_only)' 문구, ReviewFlow.tsx:479·528·569 한국어 고정 + useT/L( 0건, tools/review/layout.tsx 부재
- **제안**: receipt_only 괄호 표기 삭제(설명문만으로 충분), ReviewFlow에 L()/useT 적용 및 locale metadata layout 추가.
- **검증관 소견**: src/components/review/ReviewFlow.tsx:583에 사용자 노출 텍스트로 '(receipt_only)'가 실제 존재하고, 파일 전체(477, 479, 500, 512, 528, 536, 556, 562, 569, 579, 590 등)가 한국어 하드코딩이며 useT/L( 사용 0건이다. 랜딩 EN 히어로(src/components/landing/SirenHero.tsx:408-409)가 LocaleLink로 /tools/review에 직접 연결되어 /en 방문자가 한국어 UI를 만나고, 형제 도구(reframe/recast/refine/rehearse/synthesize)는 모두 locale별 metadata layout.tsx가 있는데 src/app/[locale]/tools/review/에만 layout.tsx가 없다.

### F16. [major · marketer-user · partially] 랜딩이 두 번째 문으로 미는 문서 검수가 본선(progressive)과 완전 절연돼 축적 약속이 끊긴다
- **상세**: '판단이 항로로 쌓인다'가 핵심 약속인데, ON FILE로 들어온 검수 결과(Judgment Receipt)는 프로젝트/progressive 세션과 데이터가 이어지지 않는다. 문서로 시작한 사용자(팀장 보고형 지식노동자, 주 타깃)는 검수 후 '이걸 항로에 얹으려면?'의 다음 단계가 없다.
- **근거**: tools 정찰: Review는 handoff/project 무연결·ShareBar 없음, review_receipts 별도 테이블(db.ts:25)
- **제안**: Receipt 화면에 '이 문서로 결정 항해 시작' CTA를 추가해 /workspace?q=에 검수 요약을 프리필하거나, receipt를 project에 addRef로 연결.
- **검증관 소견**: 절연 자체는 사실: 검수 Receipt(useReviewStore, review_receipts — db.ts:23,25)는 review 컴포넌트에서만 소비되고, ReceiptView.tsx/ReviewFlow.tsx에 workspace·project·handoff·ShareBar로 가는 링크/CTA가 전무하며(grep 0건), progressive의 judgment_receipt(SealMoment.tsx:45, projects/JudgmentReceipt)는 타입부터 별개이고 current-bearing.ts도 ProgressiveSession만 읽는다. 다만 '축적 약속이 끊긴다'는 과장 — 검수 트랙 자체에 항로형 축적 루프가 있다: Active Course 목록('내 판단 항로', ReceiptList), seal→settle 생애주기(ReviewFlow.tsx:355-384), 재검수 버전 연결(ReviewFlow.tsx:225-234), companion-brief 크론의 정산 리마인더(api/cron/companion-brief/route.ts:68). 또 workspace→review 방향 문은 이미 존재한다(workspace/page.tsx:592-603 ON FILE 카드) — 끊긴 건 역방향(receipt→본선) 단 하나다.
- **정정된 서술**: 랜딩 ON FILE 문으로 들어온 문서 검수는 자체 축적 루프(Receipt 목록·seal/settle·버전 드리프트·정산 리마인더)는 갖췄으나, 검수 결과가 프로젝트/progressive 세션과 데이터·UI 어느 층에서도 이어지지 않아(별도 review_receipts 테이블, ReceiptView에 workspace/project 링크 0건, current-bearing은 ProgressiveSession만 투영) 검수 트랙이 사일로가 된다. workspace→review 방향 진입(workspace/page.tsx:592 ON FILE 카드)은 있지만 역방향 — receipt에서 '이 문서로 결정 항해 시작' 류의 본선 연결 — 이 없어, 문서로 시작한 주 타깃 사용자의 다음 단계가 검수 사일로 안에서 끝난다.

### F17. [major · marketer-user · confirmed] 무료 한도 표기가 화면마다 단위가 달라(30회 vs 결정 2~3개) 로그인 가치 계산이 안 된다
- **상세**: 로그인 페이지 탈출구는 '하루 30회 무료', 워크스페이스 배너는 '하루 결정 2~3개 분량 무료', 가입 혜택 박스는 '하루 50회'. 콜 단위와 결정 단위가 혼용돼 게스트가 지금 얼마나 남았고 로그인하면 뭐가 얼마나 늘어나는지 비교 불가 — 전환 설득이 흐려진다.
- **근거**: login.png '로그인 없이 계속 → 하루 30회 무료' vs workspace.png '하루 결정 2~3개 분량 무료', quota-config.ts(익명30/로그인50콜), login/page.tsx:181-207
- **제안**: 사용자 노출 단위를 '결정 N개'로 통일('로그인 없이 하루 결정 2~3개 → 로그인하면 4~5개'). 콜 수는 내부 지표로만.
- **검증관 소견**: login/page.tsx:421은 "하루 30회 무료"(ANON_LIMIT 콜 단위), 같은 페이지 가입 혜택 박스 190-191은 "하루 50회 (비회원 30회)", 반면 workspace/page.tsx:512·1226과 guide/page.tsx:120은 "하루 결정 2~3개 분량 무료 · 로그인하면 더 넉넉해요"로 결정 단위이며 로그인 증가폭을 수치로 제시하지 않는다. quota-config.ts:13,21(ANON=30/DAILY=50)이 콜 단위 출처이고 두 단위 간 환산 안내는 어디에도 없어, 게스트가 워크스페이스→로그인 경로에서 단위 불일치를 그대로 마주친다는 주장이 코드로 확인된다.

### F18. [major · marketer-user · partially] 정산일 복귀 트리거가 전무해 핵심 리텐션 루프('돌아와 물어요')가 사용자 기억력에 100% 의존한다
- **상세**: 제품의 차별 약속이 '정한 날 돌아와 물어요'인데 이메일·푸시 등 어떤 아웃바운드도 없고(가이드에 명시), 캘린더 파일도 사용자가 FAQ를 읽고 원해야 얻는다. due 배지는 이미 재방문한 사람에게만 보인다. 봉인까지 간 사용자가 정산으로 돌아올 화면 밖 이유가 없다 — 축적 가치가 실현되기 전에 이탈한다.
- **근거**: guide.png FAQ '메일·알림은 보내지 않아요… 원하면 캘린더 파일로', Header.tsx:132(재방문자 전용 due 배지), SealMoment→/project 루프
- **제안**: SealMoment 직후 캘린더(.ics) 추가를 기본 제안(원클릭)하고, 로그인 유저에겐 정산일 이메일 1통 opt-in 체크박스를 봉인 화면에 배치. Slack/Telegram 연동이 이미 있으니 정산 리마인드 채널로 연결.
- **검증관 소견**: "아웃바운드 전무·캘린더는 FAQ 전용"은 코드와 불일치: SealMoment.tsx:383-389에 봉인 확인 화면 원클릭 '캘린더에 약속 넣기'(.ics) 버튼이 이미 있고, 텔레그램 아웃바운드가 실재한다(SealMoment.tsx:193 syncSealToTelegram → vercel.json 등록 cron /api/cron/telegram-reminders 및 /api/cron/checkin-due:130-159가 정산일에 푸시, SealMoment.tsx:496에 채널 고지 카피도 있음). 다만 이메일 리마인드는 cron 코드(checkin-due/route.ts:106)가 `email_reminder === true`를 요구하는데 이 플래그를 설정하는 UI가 전무해(grep 결과 types.ts:630과 cron뿐) 이메일 경로는 사실상 죽어 있고, 텔레그램 미연결·익명 사용자는 여전히 기억/캘린더 의존이며 Header.tsx:132 due 배지가 재방문자 전용인 것도 사실이다.
- **정정된 서술**: 정산일 복귀 트리거가 '전무'하지는 않다 — 봉인 직후 원클릭 .ics 버튼(SealMoment.tsx:383)과 텔레그램 연결 유저 대상 정산일 푸시(cron checkin-due·telegram-reminders, vercel.json 등록)가 이미 구현·고지되어 있다. 실제 갭은 (1) 이메일 리마인드가 백엔드만 있고(checkin-due가 email_reminder===true 요구) 이를 opt-in할 UI가 어디에도 없어 죽은 경로라는 점, (2) 텔레그램 미연결·익명 사용자의 복귀가 여전히 사용자 기억 + 수동 캘린더에 의존한다는 점, (3) guide FAQ 카피('메일·알림은 보내지 않아요')가 텔레그램 채널 존재와 어긋나는 stale 카피라는 점이다. 제안 중 'SealMoment에 캘린더 원클릭'은 이미 구현됨; '봉인 화면 이메일 opt-in 체크박스'만 유효한 미구현 제안이다.

### F19. [major · marketer-user · partially] 항해 메타포 어휘(밧줄 묶기·현재 방위·선원·출항)가 첫 회차 사용자에게 번역 비용을 물린다
- **상세**: 기획안 검토라는 실용 목적으로 온 사용자가 첫 제출 직후 '출항 전 · 밧줄 묶기'를 만나고, 결과물 이름이 '현재 방위'다. 가이드 FAQ에 '현재 방위가 뭔가요?'가 존재한다는 것 자체가 용어가 자력으로 읽히지 않는 증거. 세계관은 자산이지만 기능 라벨까지 메타포면 첫 세션 인지 부하가 커진다.
- **근거**: guide.png FAQ '현재 방위가 뭔가요?', BindCard.tsx:103-111 '출항 전 · 밧줄 묶기', workspace 3스텝 카피 '현재 방위 한 장'
- **제안**: 첫 노출 시 기능 설명을 병기하는 이중 라벨('현재 방위 — 결론·이유·확인거리 한 장', '밧줄 묶기 — 지금 기운 마음 기록'). 2회차부터 메타포 단독 표기.
- **검증관 소견**: 인용 근거는 실재하지만(BindCard.tsx:103 '출항 전 · 밧줄 묶기', guide/page.tsx:127 FAQ, workspace/page.tsx:531) 제안된 이중 라벨은 이미 대부분 구현돼 있다: BindCard는 메타포가 소형 eyebrow일 뿐 H2·부제(BindCard.tsx:107-112)가 기능('지금 마음은 어디로 기울어요? / 안 적어도 됩니다')을 평문으로 설명하고, 결과 카드는 라벨이 '현재 항로'이며 매 렌더마다 평문 설명 한 줄을 병기하며(CurrentBearingCard.tsx:96,122-127), workspace 3스텝 카피도 '문서와 결론 요약 한 장(현재 방위)'로 기능 우선+메타포 괄호 병기이고, '선원'도 첫 노출 정의문이 있다(CrewAtWork.tsx:127-128). 따라서 '번역 비용을 물린다'는 major 판정은 과장이며, 남는 실제 문제는 용어 불일치(카피·가이드는 '현재 방위', 실제 카드는 '현재 항로')와 eyebrow 라벨 단독 메타포 정도다.
- **정정된 서술**: 항해 메타포 라벨은 실재하나 첫 노출 표면 대부분이 이미 기능 평문을 병기한다(BindCard H2/부제, CurrentBearingCard 설명줄, workspace 3스텝 괄호 병기, CrewAtWork '선원' 정의). 잔여 이슈는 (1) 워크스페이스 카피·가이드 FAQ는 '현재 방위'라 부르는데 실제 결과 카드 라벨은 '현재 항로'(CurrentBearingCard.tsx:96)인 용어 불일치 — 사용자가 카피의 용어로 화면 요소를 찾을 수 없음, (2) BindCard eyebrow '출항 전 · 밧줄 묶기'가 메타포 단독 표기라는 점. 심각도는 major가 아닌 minor(용어 통일 + eyebrow 병기 수준의 카피 수정).

### F20. [major · designer · confirmed] 타이포 스케일 부재 — 8~28px 사이 20종의 임의 px 크기가 위계를 잡음으로 만든다
- **상세**: tsx 전체에서 임의 폰트 크기 text-[Npx]가 10~14px 구간에만 1,565회, 총 20개 상이한 크기(8/9/10/10.5/11/11.5/12/12.5/13/13.5/14/15/16/17/18/19/20/22/24/28px)가 쓰인다. 9px 57회, 8px 4회는 가독 한계 이하이고, 12.5/13.5 같은 반픽셀 크기는 '그때그때 눈대중' 조판의 증거다. 크기 차 1px로는 위계가 생기지 않아 화면 전반이 균일한 시각 무게(AI-generic의 전형)로 읽힌다. 색/그림자/라운드는 토큰화됐는데 타이포·간격만 무정부 상태인 비대칭.
- **근거**: rg 집계: text-[12px] 382회, [11px] 348회, [13px] 332회, [9px] 57회, 반픽셀 4종 137회; globals.css에 --font-* 패밀리만 있고 size/leading 토큰 없음
- **제안**: 6단 스케일 토큰 도입(예: 11/12/13/15/18/24px + 각각 고정 line-height)을 @theme에 정의하고, 9px 이하와 반픽셀 크기를 코드모드로 일괄 치환. caption(11)·label(12)·body(13~15)·title(18)·display(24+)의 의미 이름을 부여해 '크기를 고르는' 행위 자체를 제거.
- **검증관 소견**: rg 실측이 finding 수치와 일치하거나 더 나쁘다: src/**/*.tsx에서 text-[12px] 382회·[11px] 348회·[13px] 332회·[9px] 57회·[8px] 4회가 정확히 재현되고, 상이한 크기는 20종이 아니라 28종(7/9.5/14.5/21/23/26/30/32px 추가), 반픽셀도 4종 137회가 아니라 6종 139회로 오히려 과소 서술이다. src/app/globals.css:186-196의 @theme 블록에는 --color-*/--shadow-* 토큰만 있고 font-size/line-height 토큰이 없으며(--text-primary 류는 색상 토큰, --font-*는 패밀리 토큰: globals.css:21-23,76-81), tailwind.config의 fontSize 정의도 부재해 "색/그림자는 토큰화, 타이포는 무정부"라는 비대칭 주장도 사실이다.

### F21. [major · designer · confirmed] 공용 Button 채택률 21% — 화면들이 원시 button을 인라인 조립해 인터랙션 품질이 화면마다 다르다
- **상세**: <Button 104회 vs 원시 <button 391회. 공용 Button은 hover 리프트/active 프레스/인셋 하이라이트까지 갖춘 반면, 대표 화면인 워크스페이스의 주 CTA조차 원시 button + 인라인 gradient로 조립되어 press 상태(active transform)가 없고 hover는 그림자만 바뀐다. 결과적으로 같은 '골드 CTA'가 화면마다 다른 촉감을 내고, disabled 처리 방식도 제각각(opacity-30/40/인라인 0.5)이다.
- **근거**: grep: <Button 104회 vs <button 391회; src/app/[locale]/workspace/page.tsx:583-587 (주 CTA가 원시 button), src/components/ui/Button.tsx:70-80 (공용에는 hover/active 물리 반응 존재)
- **제안**: 주 전환 경로(워크스페이스 시작, BindCard, 리뷰 시작, 로그인)부터 Button으로 강제 이관하고, ESLint 커스텀 룰이나 grep CI로 'style={{background:var(--gradient-gold)}}를 가진 원시 button'을 차단. Button에 fullWidth·loading prop을 추가해 이탈 사유를 없앤다.
- **검증관 소견**: 전 주장이 실측과 일치: <Button 104회 vs <button 391회(채택률 ~21%), workspace/page.tsx:583-587의 주 CTA는 원시 button + 인라인 style={{background:'var(--gradient-gold)'}} + disabled:opacity-30 + transition-shadow만 있고 active transform 부재, 반면 Button.tsx:70-80은 hover:-translate-y/active:translate-y/inset 하이라이트(27,35행 boxShadow)를 모두 갖춤. disabled 처리도 실제로 제각각(disabled:opacity-30 10건, -40 16건, -50 16건, 인라인 opacity:0.5 다수 — SealModal.tsx:139, ReviewFlow.tsx:589 등)이고 Button.tsx 외부의 인라인 gradient-gold 배경이 58건에 달해 골드 CTA 파편화 주장도 사실.

### F22. [major · designer · partially] 랜딩(세피아·세리프·항해 일러스트)과 앱(플랫 크림·산세리프)의 톤 낙차가 커서 진입 순간 브랜드가 끊긴다
- **상세**: 랜딩은 Blueprint 레지스터(bp-paper, radius:0, 잉크+골드 절제)로 고급 인쇄물처럼 완성됐는데, '지금 출항'을 누르는 순간 도착하는 워크스페이스는 흰 카드+둥근 모서리+이모지 없는 SaaS 기본형이다. 항해 메타포(출항/방위/선원)는 카피에만 남고 시각 언어는 사라진다. 사용자는 '광고 페이지와 실제 제품이 다른 회사' 같은 인지 부조화를 겪고, 랜딩이 쌓은 신뢰 프리미엄이 첫 화면에서 소멸한다.
- **근거**: shots/landing.png vs shots/workspace.png 대조; globals.css:83-93 (--bp-* 랜딩 전용 팔레트), globals.css:10-31 (앱 팔레트) — 두 레지스터를 잇는 중간 토큰 없음
- **제안**: 전면 통일이 아니라 '브리지 요소' 3개만 이식: (1) 워크스페이스 히어로 배경에 --bp-paper 톤의 미세 텍스처/비네트, (2) 섹션 라벨(ON FILE, LOG ENTRY 등)의 레터스페이싱·괘선 스타일을 랜딩과 동일 유틸로 공유, (3) 나침반/항로 모티프 아이콘 1종을 빈 상태와 로딩에 재사용. 랜딩의 인쇄물 질감이 앱에 5%만 스며들어도 낙차가 절반으로 준다.
- **검증관 소견**: 근거로 든 사실들이 코드와 어긋난다: --bp-gold는 --accent와 동일 값으로 명시된 공유 토큰이고(globals.css:91) bp-* 전체가 다크모드 리맵까지 가진 앱-테마 연동 토큰이며(globals.css:166-174), 항해 시각 언어는 카피가 아니라 앱 내부에 실재한다 — 워크스페이스 배경 Graticule 해도 격자(src/app/[locale]/workspace/page.tsx:118,459,490,1217 + warm-vignette/concert-hall 그라디언트), 진행 플로우의 앤티크 해도 SeaChart(나침반 로즈 포함, src/components/workspace/progressive/SeaChart.tsx:136), 프로젝트 카드마다 bp-paper 패널 위 수제 잉크 범선 VoyageShip(src/app/[locale]/project/page.tsx:599-601), error/not-found의 VoyageShip, 워크스페이스 전반의 tracking-[0.2em] 대문자 섹션 라벨. 제안한 브리지 3종(텍스처/비네트, 라벨 스타일, 나침반·배 모티프 재사용)은 대부분 이미 구현돼 있고, 인용한 shots/landing.png·shots/workspace.png는 리포에 존재하지 않는다.
- **정정된 서술**: 랜딩(bp 레지스터)과 앱을 잇는 브리지는 이미 상당 부분 구현돼 있다(공유 골드 토큰, bp-* 다크 리맵, Graticule 배경, SeaChart 나침반 해도, 프로젝트 카드 VoyageShip, 공통 mono-uppercase 라벨). 남은 실제 이슈는 정도의 문제다: 워크스페이스 기본 표면은 여전히 흰 둥근 카드이고 Graticule이 opacity 0.02~0.03으로 거의 지각 불가하며, '해도 시트' 빈 상태 전용으로 만든 ChartPlate(src/components/ui/ChartPlate.tsx)가 현재 어디서도 import되지 않는 죽은 코드다. 심각도는 major가 아니라 minor(기존 브리지 요소의 가시성 튜닝 + ChartPlate 실사용 연결)가 적절하다.

### F23. [major · designer · confirmed] 잠금(로그인 필요) 화면이 화면의 90%를 공백으로 두고, reframe은 도구 설명 한 줄도 없다
- **상세**: 보호 경로의 소프트월이 자물쇠 아이콘+제목+버튼만 중앙에 띄우고 나머지는 전부 여백이다. agents는 가치 한 줄('나만의 리뷰어 팀을 저장')이라도 있지만 reframe은 이 도구가 뭘 하는지조차 말하지 않는다. 잠금 화면은 전환 설득의 최전선인데 지금은 '벽'만 있고 '창'이 없다 — 로그인하면 무엇이 보이는지에 대한 미리보기가 전무하다.
- **근거**: shots/agents.png (콘텐츠가 뷰포트 상단 40%에만 존재), 정찰 보고: tools-reframe 잠금 화면에 도구 설명 부재, src/components/layout/AuthGuard.tsx:80-93
- **제안**: 표준 LockedState 컴포넌트 1개로 통일: 도구 한 줄 가치 + 블러/스켈레톤 처리된 실제 UI 프리뷰(정적 이미지면 충분) + 로그인 CTA + 탈출구 링크. 각 도구는 title/description/preview 3필드만 주입. 공백은 프리뷰가 채우고, 설득력은 '보이는데 못 쓰는' 긴장이 만든다.
- **검증관 소견**: src/components/layout/AuthGuard.tsx:17-22의 detectPage는 project/agents/teams만 분기하고 /tools/reframe(보호 경로, src/lib/public-paths.ts:29 주석 "The other /tools/* routes stay protected" 확인)은 'other' 폴백으로 떨어져 "이 페이지는 로그인한 사용자만 사용할 수 있어요"(AuthGuard.tsx:53-57)라는 무설명 카피만 노출된다. 마크업(AuthGuard.tsx:83-107)은 max-w-md 중앙 카드에 자물쇠 아이콘+제목+2줄 설명+CTA뿐이고 프리뷰/스켈레톤류 요소가 전혀 없어 나머지 뷰포트는 여백이 맞다. 유일한 과장은 탈출구 링크는 이미 존재한다는 점(AuthGuard.tsx:99-104 "로그인 없이 워크스페이스 써보기")이나 이는 제안부의 항목일 뿐 finding의 핵심 주장(벽만 있고 창이 없음)은 코드로 확인됨.

### F24. [major · designer · confirmed] 내부 시스템 용어 'receipt_only'가 사용자 대면 카피에 그대로 노출된다
- **상세**: 원문 저장 체크박스 설명 끝에 '(receipt_only)'라는 스키마 enum 값이 괄호로 붙어 있다. 프라이버시를 안심시키려는 문장(신뢰 구축의 핵심 카피) 한가운데 개발자 용어가 박혀 오히려 '미완성 내부 도구' 인상을 준다. 첫인상 신뢰도 축에서 작지만 치명적인 누수다.
- **근거**: src/components/review/ReviewFlow.tsx:583 — '기본은 원문을 저장하지 않습니다 — 판단과 확인 조건만 남깁니다. (receipt_only)', shots/tools-review.png에서 노출 확인
- **제안**: 괄호 용어 삭제. 필요하면 '영수증만 남기기' 같은 제품 언어로 번역. 추가로 rg '(receipt_only|store_source|local_only)' --glob '*.tsx'를 카피 린트에 넣어 enum 리터럴의 UI 유출을 차단.
- **검증관 소견**: src/components/review/ReviewFlow.tsx:583에 사용자 대면 카피로 '(receipt_only)' 리터럴이 그대로 존재하며, storeSource 체크박스의 기본(미체크) 상태에서 렌더링되므로 이 화면에 도달한 모든 사용자에게 노출된다(575행 주석 'receipt_only is the default'가 기본 상태임을 확인). 번역/치환 로직 없이 스키마 enum 값이 프라이버시 안심 문장에 박혀 있어 finding의 사실 관계와 심각도 서술 모두 코드와 일치한다.

### F25. [major · designer · partially] 히어로의 13MB 루프 영상이 LCP를 지배하고, 로드 실패/모바일에서 큰 공백으로 깨진다
- **상세**: voyage-film.mp4가 13,058KB — 랜딩 첫 화면의 핵심 자산치고 과체중이다. preload=metadata와 poster는 있지만, 모바일 스크린샷에서 poster 아래로 캐러셀 도트만 있는 ~250px 공백이 생겨 레이아웃이 깨진 것처럼 보인다(영상 미재생 상태 = 느린 회선의 실제 경험). 모바일 데이터로 13MB 자동재생은 비용 문제이기도 하다.
- **근거**: ls: public/voyage/voyage-film.mp4 = 13,058,607 bytes; shots/landing-mobile.png 일러스트 카드 하단 대형 공백; VoyageFilm.tsx:367-415 (poster 있음, 그러나 자막/도트 영역이 영상 높이를 예약)
- **제안**: (1) 720p·CRF 상향·40초→20초로 재인코딩해 2~3MB 목표, 모바일엔 별도 저용량 소스(<source media>) 제공. (2) 영상 컨테이너에 aspect-ratio 고정 + poster를 배경으로 겹쳐 미재생 상태에서도 공백이 생기지 않게. (3) 자막 영역은 영상 위 오버레이로 옮겨 예약 공백 제거.
- **검증관 소견**: 핵심 사실은 코드로 확인됨: public/voyage/voyage-film.mp4 = 13,058,607 bytes이고, 모바일 레이아웃(VoyageFilm.tsx:358-406)에서 자막 거터가 고정 높이 256px(VoyageFilm.tsx:383)인데 intro=false/active=null/shownIdx=-1 초기 상태(VoyageFilm.tsx:294-296)라 영상이 t≥1.0에 도달하기 전(느린 회선·로드 실패·reduced-motion 시 영구히)에는 도트 외 완전 공백이 맞다. 그러나 두 가지가 과장/부정확: (1) poster(voyage-poster.jpg 97KB, VoyageFilm.tsx:371)가 LCP 페인트 후보라 "13MB 영상이 LCP를 지배"는 과장 — 13MB는 autoplay로 인한 대역폭 경쟁/데이터 비용 문제지 LCP 요소 자체가 아니며, 영상 컨테이너는 이미 aspect-ratio 16/9 고정(VoyageFilm.tsx:366)이라 제안(2)의 절반은 기구현. (2) 제안(3) "자막을 영상 위 오버레이로"는 코드 주석(VoyageFilm.tsx:354-357)에 명시된 의도적 결정(모바일 밴드에서 오버레이가 그림을 삼켜서 거터로 분리)과 정면 충돌하고, 근거로 든 shots/landing-mobile.png는 저장소에 존재하지 않는다.
- **정정된 서술**: 히어로의 13MB 루프 영상(public/voyage/voyage-film.mp4 = 13,058,607 bytes)은 poster(97KB)가 LCP를 처리하더라도 autoplay로 전량 다운로드되어 모바일 데이터 비용과 대역폭 경쟁을 유발하며, 재인코딩(720p·구간 단축·<source media> 저용량 소스)으로 2~3MB화가 타당하다. 별개의 실제 결함: 모바일(<640px)에서 자막 거터가 고정 256px(VoyageFilm.tsx:383)인데 영상 재생이 t=1.0에 도달하기 전에는 intro/chapter 상태가 모두 비어 있어(초기값 VoyageFilm.tsx:294-296) 느린 회선·로드 실패·prefers-reduced-motion 사용자는 poster 아래 도트만 있는 256px 공백을 본다 — 수정은 오버레이 이전(의도적으로 배제된 설계, VoyageFilm.tsx:354-357 주석)이 아니라 영상 미재생 상태에서 거터에 intro 캡션을 기본 표시하는 폴백이 적절하다. 영상 컨테이너 자체는 이미 aspect-ratio 16/9 고정이라 영상 영역 공백은 없다.

### F26. [major · philosophy · partially] CurrentBearing의 상태 pill('진행/보류/근거 먼저')이 기계-파생 방향 평결을 사용자 결정 위에 띄운다.
- **상세**: CourseStatus는 순수하게 AI 리뷰 concern 심각도와 good_parts 유무에서 도출되는데(critical→collect_evidence, important→hold, 리뷰 호평→proceed), 그 결과가 사용자 결정 카드 상단에 '진행(Proceed)'/'보류(Hold)' pill로 표시된다. 팀도 인지하고('neutral wayfinding descriptor, NOT a color-coded verdict') 스타일을 중립화했지만, CLAUDE.md 규칙 6은 '발화 형태는 맨 중립 질문이어야 하며 방향 진술 금지 — 태그/스타일로 평결을 세탁할 수 없다'고 명시한다. 'Proceed'는 단어 자체가 go 신호(엔진-가중 극)이고, 출처 표기(ai_surfaced)도 없다. 복사(bearingToMarkdown)로 외부 공유될 때는 스타일 완화조차 사라진다.
- **근거**: src/lib/current-bearing.ts:189-203(상태 사다리: 'proceed... must be EARNED'), src/components/workspace/progressive/CurrentBearingCard.tsx:26-33(STATUS_META '진행/보류/수정'), 113-115(pill 렌더), 80-81(자기 인식 주석).
- **제안**: 상태 어휘를 방향 진술에서 상태 기술로 바꾼다: proceed→'열림/이의 없음(리뷰 기준)', hold→'미해결 쟁점 있음', collect_evidence→'확인 필요 항목 있음' 등 '리뷰가 본 것'을 서술하는 명사구로. pill에 '리뷰 기준' 같은 1단어 출처 표기를 붙이고 markdown 내보내기에도 동일 적용.
- **검증관 소견**: 핵심은 사실이다: 상태는 순수히 AI 리뷰 concern/good_parts에서 도출되고(src/lib/current-bearing.ts:199-203), '진행(Proceed)/보류(Hold)' pill로 결정 카드 상단에 출처 표기 없이 렌더된다(CurrentBearingCard.tsx:26-33, 113-115). 그러나 (a) "복사 시 스타일 완화조차 사라진다"는 주장은 틀렸다 — bearingToMarkdown(current-bearing.ts:235-259)은 status를 아예 내보내지 않아 외부 공유본에는 평결 단어가 존재하지 않는다; (b) 사다리는 flat 케이스에서 중립 'anchor'를 기본값으로 두는 restraint 설계를 이미 구현했으므로(199-203) over-fire 측면은 완화돼 있고, 잔여 문제는 어휘('Proceed'라는 방향 단어)와 출처 미표기로 좁혀진다.
- **정정된 서술**: CurrentBearing의 상태 pill('진행/보류/근거 먼저')은 순수하게 AI 리뷰 결과(concern 심각도, good_parts)에서 도출되는데(current-bearing.ts:199-203), 사용자 결정 카드 상단에 출처 표기(예: '리뷰 기준'/ai_surfaced) 없이 표시된다(CurrentBearingCard.tsx:113-115). 팀은 스타일을 중립화하고(80-81 주석) flat 케이스는 'anchor'로 떨어지는 restraint 사다리를 구현해 over-fire는 방어했으나, 'Proceed'라는 단어 자체가 엔진-가중 go 신호여서 CLAUDE.md Zero-Judgment 규칙 4(a)("방향 진술 금지, 태그/스타일로 평결을 세탁할 수 없다")와 긴장이 남는다. 단, 마크다운 내보내기(bearingToMarkdown)는 status를 포함하지 않으므로 외부 공유 경로로는 평결이 새지 않는다 — 문제는 카드 내 어휘와 출처 미표기에 한정된다(심각도는 major보다 minor~moderate에 가깝다).

### F27. [major · philosophy · confirmed] 랜딩이 내부 헌법이 금지한 절대 주장('답을 대신 정하진 않아요 / it never decides for you')을 판다.
- **상세**: CLAUDE.md 스파인 결론부는 'zero judgment는 점근선 — 절대 "우리는 판단하지 않는다"라고 쓰지 말고, 희미한 lean을 알려진 한계로 명시하라'고 못박는다. 그런데 UseCases 첫 카드가 정확히 그 금지 문장 형태('답을 대신 정하진 않아요', EN은 더 강하게 'it never decides for you')를 쓴다. 동시에 제품은 실제로 기계-파생 방향 pill(진행/보류)을 띄우므로(별도 finding), 이 카피는 지킬 수 없는 약속이 되어 약속-경험 갭을 만든다. 잔여 lean의 한계 고지는 가이드 포함 제품 어디에도 없다(guide/page.tsx에 '한계/lean' 0건).
- **근거**: src/components/landing/UseCases.tsx:27('결정이 걸린 숨은 전제 하나를 짚어줘요 — 답을 대신 정하진 않아요.' / 'it never decides for you'); CLAUDE.md:63-69('Never write "we don't judge"; write "we surface the one question, and name the faint lean as a known limit"').
- **제안**: 카피를 헌법이 지정한 형태로 교체: '갈리는 질문 하나를 돌려드려요 — 어느 쪽으로 기울었는지는 저희 한계로 표시해 둬요' 류의 한계-공개형 문장. EN 'never decides for you'는 'hands the call back to you'로. 가이드 FAQ에 잔여 lean 한계 항목 1개 추가.
- **검증관 소견**: src/components/landing/UseCases.tsx:27에 금지 형태 문장('답을 대신 정하진 않아요' / 'it never decides for you')이 그대로 존재하고, CLAUDE.md 스파인 4항은 '절대 "we don't judge"라고 쓰지 말고 faint lean을 알려진 한계로 명시하라'고 못박는다. 한계 고지는 guide(src/app/[locale]/guide/page.tsx)를 포함해 src 전체 grep에서 0건이며, 제품은 실제로 기계-파생 방향 pill을 띄운다(src/lib/current-bearing.ts:199-203이 dm_feedback에서 proceed/hold를 산출, CurrentBearingCard.tsx:27-31이 '진행'/'보류'로 렌더 — 코드 주석 스스로 "'proceed' is a directional call"이라 인정). 따라서 카피는 헌법 위반이자 실제 경험과 모순되는 약속이고, 심각도 major도 과장이 아니다.

### F28. [major · philosophy · partially] Boss 사주 엔진이 실존 인물의 생년월일로 성격 평결을 제조해 시뮬레이션에 주입한다 — '불확실성은 퍼뜨리지 않는다'는 제품 원칙과 정면충돌.
- **상세**: BossSetup은 상사의 생년월일·성별을 받아 SajuPreview로 사주 프로필을 보여주고, BossChat이 그 프로필(일간별 성격 키워드: '甲=정직하고 강직, 융통성 부족' 등)을 시스템 프롬프트에 주입한다. 리허설 페르소나 생성 자체는 '생성'이지만, 근거 0의 pseudoscience로 실존 제3자의 성격을 단정하는 것은 current-bearing.ts가 선언한 'No fabrication: uncertainty is named, not spread' 원칙 및 판단-보정 브랜드와 충돌한다. 06-25 감사가 '핵심 약속을 값싸게 만들 위험'으로 이미 지적했으나(:143-149) 그대로 라이브 상태. 시뮬레이션 정확도가 사주라는 허구 위에 서 있음이 사용자에게 고지되지도 않는다.
- **근거**: src/components/boss/BossSetup.tsx:368(<SajuPreview year=... />); src/components/boss/BossChat.tsx:367(buildBossSystemPrompt({ saju: sajuProfile, ... })); src/lib/boss/saju-interpreter.ts:32-40(일간별 성격 단정 사전); docs/ARGUS-TOTAL-DEEP-AUDIT-2026-06-25.md:143-149.
- **제안**: 최소: 사주 입력을 opt-in 뒤로 접고 '재미용 프로필 — 실제 성격 근거 아님' 고지를 SajuPreview와 채팅 시작 시점에 명시. 권장: 생년월일 대신 사용자가 직접 관찰한 행동(회의에서 어떤 질문을 하는지 등)으로 페르소나를 시드하는 기존 axes/userContextHint 경로를 기본으로 승격하고 사주는 제거.
- **검증관 소견**: 기술 사슬은 전부 라이브로 확인됨 — BossSetup.tsx:368 SajuPreview, useBossStore.ts:152-175 loadSaju→/api/boss/saju→interpretSaju, saju-interpreter.ts:32-43 일간 성격 사전이 dayMaster에 결합(:83), boss-prompt.ts:80-91이 "사주 기반 심층 성향…내면 성향을 반영하세요"로 메인 채팅 시스템 프롬프트에, :301-305가 "숨겨진 기운 (이것이 속마음을 지배한다)"로 속마음 프롬프트에 주입하며, 감사 지적(ARGUS-TOTAL-DEEP-AUDIT-2026-06-25.md:143-149 'saju/MBTI-style flavor can cheapen the core promise')도 실재. 그러나 "고지되지도 않는다"와 최소 제안(opt-in화+재미용 고지)은 과장/부분 기구현 — 생년월일 입력은 이미 선택 항목이고 UI가 '속마음에 양념 더하기 (재미로 · 선택)'/'just for fun · optional'로 명시한다(ko.ts:310-313, en.ts:293-296, BossSetup.tsx:322-327).
- **정정된 서술**: Boss 사주 엔진이 실존 상사의 생년월일로 일간별 성격 단정(saju-interpreter.ts:32-43)을 만들어 메인 채팅 시스템 프롬프트(boss-prompt.ts:80-91 "이면으로 작동")와 속마음 프롬프트(:301-305 "이것이 속마음을 지배한다")에 주입하는 것은 사실이고 06-25 감사 지적 후에도 라이브다. 다만 입력은 이미 opt-in이며 '재미로 · 선택' 고지가 셋업 화면에 존재한다(ko.ts:310-313). 남는 실제 결함은 고지-실사용 불일치: 고지는 "속마음에 기운이 '살짝' 섞인다(재미로)"고 약속하지만 프롬프트는 사주를 메인 대화의 심층 성향 층으로 승격시키고, 채팅/평결 시점에는 어떤 고지도 없으며, 프롬프트가 "AI/성격유형 언급 금지"로 허구성을 프레임 안에서 숨긴다 — 'uncertainty is named, not spread'(current-bearing.ts:17-18, ARGUS-FINAL-DIRECTION.md:159)와의 긴장은 유효하나 심각도는 '무고지'가 아니라 '과소고지'다.

### F29. [major · philosophy · partially] 랜딩(EN)이 직접 미는 ON FILE 관문(/tools/review)이 영어 사용자에게 전부 한국어로 렌더된다.
- **상세**: SirenHero의 두 번째 문('검수받기')과 UseCases 3번 카드가 /tools/review로 보내는데, ReviewFlow.tsx는 유일하게 i18n(useT/L())이 0건이고 제목·설명·placeholder·오류 문구가 전부 한국어 하드코딩이다. /en 랜딩의 영어 약속('Upload the doc — weak claims... get flagged')을 믿고 들어온 사용자가 한국어 전용 화면을 만난다. 익명 허용 공개 wedge — 즉 첫인상 표면 — 에서의 약속-경험 갭이며, tools/review만 locale metadata layout도 없다.
- **근거**: src/components/review/ReviewFlow.tsx:477-479('기존 문서 검수하기', '...원문 위치와 함께 짚어드립니다' — useT/useLocale/L( 검색 0건); src/components/landing/SirenHero.tsx:409(EN 랜딩→/tools/review); tools/review/layout.tsx 부재.
- **제안**: ReviewFlow(+ReceiptList 등 review 폴더)에 L() 헬퍼를 적용해 영문 스트링을 채우고, 다른 tools 페이지와 동일한 locale metadata layout을 추가한다. 단기 완화: EN 랜딩에서 이 문에 'Korean UI' 표기 또는 EN 진입 시 안내 배너.
- **검증관 소견**: 핵심 주장은 사실: src/components/review/ReviewFlow.tsx는 useT/useLocale/L( 0건이고(review 폴더 5개 파일 전체 0건) 477-479행 제목·설명, 500행 placeholder, 512·516행 버튼/오류 문구가 전부 한국어 하드코딩이며, SirenHero.tsx:408-409의 LocaleLink가 EN 랜딩에서 /en/tools/review로 보내고(LocaleLink.tsx:19 locale prefix), src/app/[locale]/tools/review/에는 page.tsx만 있고 layout.tsx가 없다(reframe/refine/rehearse/recast/synthesize는 전부 layout.tsx 보유). 또한 public-paths.ts:29로 익명 공개 경로임도 확인. 단 한 가지 세부만 틀림: UseCases.tsx 3번 카드(36-38행)는 'Upload the doc — weak claims...get flagged' 영어 약속 문구는 담고 있으나 href/링크가 전혀 없어 /tools/review로 '보내지' 않는다 — 실제 진입 경로는 SirenHero 하나다.
- **정정된 서술**: 랜딩(EN)의 SirenHero ON FILE 문(SirenHero.tsx:408-409)이 /en/tools/review로 직접 보내는데, ReviewFlow.tsx(및 review 폴더 전체 5개 컴포넌트)는 i18n 호출이 0건으로 제목(477)·설명(479)·placeholder(500)·버튼/한도 문구(512,516)가 전부 한국어 하드코딩이고, tools/review만 다른 5개 tools 페이지와 달리 layout.tsx(locale metadata)가 없다. UseCases 3번 카드는 이 기능의 영어 약속 문구('Upload the doc — weak claims...get flagged')를 노출하지만 링크는 아니다(진입 링크는 SirenHero 단일). 익명 허용 공개 wedge(public-paths.ts:29) 첫인상 표면에서의 약속-경험 갭이라는 심각도 판단은 유효하다.

### F30. [minor · pm-dev · partially] NextStepGuide의 행 클릭이 이중 동작이다 — 화살표 클릭은 handoff 없이 이동하고, non-primary 행은 클릭해도 아무 일도 안 일어난다
- **상세**: 행 전체는 cursor-pointer지만 onClick은 primary 옵션에서만 onSendTo(handoff 발신)를 호출한다. non-primary 옵션('프로젝트 개요')은 행을 클릭해도 no-op이고 우측 14px 화살표 LocaleLink로만 이동 가능 — 클릭 가능해 보이는데 반응 없는 기만적 affordance. 더 나쁘게, primary 행에서도 화살표 아이콘을 누르면 LocaleLink가 handoff 없이 /tools/*로 라우팅해 같은 카드의 두 클릭 지점이 '컨텍스트 있는 이동'과 '빈 화면 이동'으로 갈린다. workspace 임베드에서는 화살표가 사용자를 workspace 밖 /tools/* 표면(AuthGuard 소프트월)으로 끌어내기까지 한다. 링크가 클릭 핸들러 div 안에 중첩되어 있어 a11y로도 문제.
- **근거**: src/components/ui/NextStepGuide.tsx:96-103 (primary만 onClick), :119-121 (handoff 우회하는 중첩 LocaleLink)
- **제안**: 행 전체를 단일 클릭 대상으로 통일: onSendTo가 있으면 화살표 LocaleLink를 제거하고 모든 옵션에 onClick(비-primary는 단순 navigate) 부여.
- **검증관 소견**: NextStepGuide.tsx:96-103에서 non-primary 행(프로젝트 개요, :78-85)의 클릭 no-op·기만적 affordance와 중첩 LocaleLink(:119-121)의 a11y 문제(役割/키보드 없음, 아이콘 링크 무명)는 확인되고, workspace→/tools/* 끌어내기도 public-paths.ts:29('/tools/review 외 /tools/*는 protected')로 확인된다. 그러나 "화살표 클릭은 handoff 없이 이동"은 부정확 — stopPropagation이 없어 클릭이 행 onClick으로 버블되어 setHandoff가 실제로 발화하며, 단독 /tools/* 표면에서는 zustand 인메모리 스토어가 클라이언트 내비게이션을 살아남아 목적지 step이 mount 시 handoff를 소비한다(RecastStep.tsx:340-350). 빈 화면 결과는 workspace 임베드에서만 발생하며, 그것도 우회가 아니라 이중 발화 레이스(onNavigate로 mount된 workspace step 인스턴스가 handoff를 소비·clear한 뒤 Link 내비게이션이 새 인스턴스를 mount) 때문이다.
- **정정된 서술**: NextStepGuide 행 클릭이 이중 동작이다: 모든 행이 cursor-pointer지만 onClick은 primary 옵션에서만 onSendTo를 호출해 non-primary 행('프로젝트 개요')은 클릭해도 no-op이고 우측 14px 화살표 LocaleLink로만 이동 가능한 기만적 affordance다(NextStepGuide.tsx:96-103, 119-121). primary 행의 화살표 클릭은 — 원 서술과 달리 handoff를 우회하지 않고 버블링으로 setHandoff가 발화하지만 — 두 내비게이션이 동시에 발화한다: 단독 /tools/* 표면에서는 결과적으로 컨텍스트가 전달되나, workspace 임베드에서는 onNavigate가 먼저 mount한 workspace step 인스턴스가 handoff를 소비·clear한 뒤 Link가 사용자를 workspace 밖 AuthGuard 보호 /tools/* 페이지(빈 새 인스턴스)로 끌어낸다. 또한 클릭 핸들러 div에 role/tabIndex/키보드 핸들러가 없고 화살표 링크에 접근 가능한 이름이 없어 a11y 문제도 실재한다. 수정 제안(화살표 LocaleLink 제거, 모든 옵션에 onClick 부여, 비-primary는 단순 navigate)은 타당하다.

### F31. [minor · pm-dev · confirmed] 죽은 배선 잔재 3건 — producer 없는 handoff 수신부(from:'workspace'), set되지 않는 'iterating' phase, 도달 불가 currentTool='refine' 분기
- **상세**: (1) ReframeStep이 handoff.from==='workspace'의 initialText를 기다리지만 from:'workspace'를 발신하는 코드가 0건이다 — 히어로 ?q= 플로우는 handoff store를 쓰지 않으므로 이 수신부는 죽은 코드이고, 미래에 누군가 '이미 배선돼 있다'고 오인해 발신만 추가하면 handoff의 useEffect([]) 소비 타이밍 이슈를 그대로 밟는다. (2) phase 'iterating'은 타입과 phaseToStage 매핑에만 존재하고 setPhase('iterating')가 0곳 — post-complete 수정은 로컬 isIterating으로만 처리되어 타입이 거짓말을 한다. (3) NextStepGuide의 currentTool==='refine' 분기는 refine 페이지가 리다이렉트 스텁이 된 후 어떤 호출자도 없다. 셋 다 단독으론 무해하나, '만들어놓고 잇지 않는' 동일 패턴의 축적이라 다음 기여자의 오판 비용이 실재한다.
- **근거**: src/components/workspace/ReframeStep.tsx:491-497 (from:'workspace' 수신부, producer grep 0건), src/stores/types.ts:903 + src/stores/useProgressiveStore.ts:61 ('iterating' 유일 사용처), src/components/ui/NextStepGuide.tsx:62-76 (refine 분기, 호출자 0)
- **제안**: 세 잔재 모두 삭제(Clean Removal 원칙 그대로 grep 후 일괄 제거). 'iterating'은 타입에서 빼거나 실제 수정-요청 플로우에 set을 배선해 타입과 런타임을 일치시킬 것.
- **검증관 소견**: (1) ReframeStep.tsx:492-497의 handoff.from==='workspace' 수신부는 실재하나 전 src에서 setHandoff의 from은 'reframe'/'recast'뿐이고 from:'workspace' 발신은 0건. (2) 'iterating'은 types.ts:903과 useProgressiveStore.ts:61(phaseToStage)에서만 등장하고 setPhase('iterating')은 0곳 — ProgressiveFlow.tsx:2216 주석이 스스로 "only the local isIterating flag drives the (revision)"이라 인정. (3) NextStepGuide는 RecastStep.tsx:848/ReframeStep.tsx:1483/RehearseStep.tsx:772에서만 "recast"/"reframe"/"rehearse"로 호출되어 NextStepGuide.tsx:62-76의 refine 분기는 도달 불가(refine/page.tsx는 리다이렉트 스텁임을 자체 주석으로 확인).

---

## 부록 B — 반박된 finding (기록용)
- **[marketer-user] 핵심 wedge의 실행 버튼 '검수 시작'이 버튼으로 인지되지 않는 플레인 텍스트로 렌더된다** — 반박 사유: '검수 시작'은 플레인 텍스트가 아니라 공용 Button 컴포넌트의 accent 변형으로 렌더된다 — src/components/review/ReviewFlow.tsx:589에서 `<Button variant="accent" size="md" disabled={!canRun}>`이고, src/components/ui/Button.tsx:30-37이 골드 그라디언트 배경(var(--gradient-gold), globals.css:62에 정의), 1px 테두리, 박스 섀도, rounded-xl 패딩을 적용한다. 비활성 시에도 형태는 유지되고 inline opacity 0.5만 적용되므로(ReviewFlow.tsx:589) 제안된 "비활성 시 버튼 형태 유지 + 활성 시 골드 버튼, 공용 컴포넌트 통일"이 이미 구현된 상태다. git 이력상 이 버튼은 도입 커밋(9c979cc)부터 동일한 accent Button이었고 그 이후 플레인 텍스트였던 적이 없다.

## 부록 C — 미검증 minor 12건 (검증 상한 초과분, 참고용)
검증 상한(32건) 초과로 반박 검증을 거치지 않았다. 착수 전 개별 재확인 필요.

- [marketer-user] HeroFlow 보조 칩 4개('AI 팀 소개' vs '팀')의 역할 구분이 라벨만으로 안 된다
- [marketer-user] 보호 도구의 잠금 화면에 그 도구가 뭘 해주는지 한 줄도 없어 로그인 동기를 못 만든다
- [marketer-user] 사회적 증거가 후기 1건뿐이고, 최종 CTA 위 '톺기/읽기/맞기' 탭이 맥락 설명 없이 떠 있다
- [marketer-user] privacy/terms의 '돌아가기'가 출발지와 무관하게 /login으로 가고, /import는 모바일에서 도달 불가
- [designer] focus:outline-none 71건 — 전역 골드 포커스 링을 스스로 무효화한 표면들이 남아 있다
- [designer] 히어로의 실제 진입점(두 입력 카드)이 일러스트 대비 시각 무게가 낮아 CTA 존재감이 약하다
- [designer] USE CASES의 인용 카드 4장과 3단 루프가 동일한 회색 톤·동일한 무게로 스캔이 불가능하다
- [designer] '팀' vs 'AI 팀 소개', '30회 무료' vs '2~3개 분량 무료' — 같은 개념의 이중 표기가 곳곳에 있다
- [designer] 간격 토큰 부재로 수직 리듬이 화면마다 다르다 — mt-2/3/4/5가 의미 없이 혼용
- [philosophy] flat 결정에서 SealMoment가 수동 봉인 핸들까지 회수한다 — 절제의 원칙('핸들 반환')을 절제 자체가 위반.
- [philosophy] '30초 안에 첫 분석' 약속이 실제 경험(BindCard 의식 + '보통 20~40초')과 어긋난다.
- [philosophy] DMFeedback/합성 리뷰의 심각도 라벨 '필수(Required)'가 AI 피드백을 지시어로 격상시킨다.

## 부록 D — 패널 총평 원문

### pm-dev

Progressive 본선(voyage)은 방어가 촘촘하다 — 리로드 복구(migrateWorkers), 실패 롤백, terminal 카드의 탈출 핸들, 정산 모달의 arm-once 로직까지 최근 커밋들이 실제로 잘 다듬었다. 문제는 본선 바깥이다. 이 제품의 핵심 약속인 "봉인 → 귀환 → 정산" 폐쇄 루프가 본선에서만 완결되고, 나머지 두 경로(4-도구 체인, /tools/review wedge)에서는 구조적으로 끊겨 있다.

첫째, 4-도구 체인은 종점이 죽어 있다. Synthesize는 handoff 수신부가 존재하지 않는 발신자(from:'refine')만 기다리고, Rehearse는 애초에 handoff를 보내지 않는다. 더 치명적인 것은 synthesize 항목에 project_id를 넣는 코드가 코드베이스 어디에도 없다는 점이다. 이 하나가 도미노처럼 무너뜨린다: (a) SynthesizeStep의 SealMoment("North-Star C" 주석까지 달린 루프 종점)가 영구 도달 불가, (b) /project의 4단계 중 '종합'이 영원히 미완료, (c) DecisionContractCard의 sealable 게이트(4단계 전부 완료)가 legacy 프로젝트에서 절대 열리지 않음 — 즉 도구 경로로 들어온 결정은 봉인 자체가 불가능해서 정산 루프에서 통째로 배제된다. "모든 단계를 완료했습니다" 카드도 도달 불가능한 죽은 코드다.

둘째, 이 죽은 체인으로 사용자를 보내는 문이 아직 주 내비게이션에 살아 있다. 사이드바 '페르소나', 가이드의 4개 칩, /project의 단계 카드 전부가 ?step= legacy 모드로 연결된다. 만들어 둔 legacy 모드를 지우지도, 종점을 고치지도 않은 반쯤 상태다.

셋째, Progressive에서 4R로 나가는 유일한 다리(PipelineExitOptions)도 착지에서 부러진다. window.location.href 풀 리로드가 메모리 전용 currentId를 날리고, URL에 실어 보낸 handoff=progressive&itemId= 파라미터는 읽는 코드가 0곳이다. 사용자가 "→ 문제 재정의"를 누르면 빈 입력 화면에 떨어지고, 방금까지의 분석은 히스토리 탭 속에 무언으로 숨는다. 사용자 입장에서는 데이터 유실과 구별 불가능하다.

넷째, 랜딩 히어로가 직접 미는 wedge인 /tools/review는 (1) 디렉토리 5개 파일 전부 i18n 0건이라 /en 방문자가 한국어 UI를 보고, (2) 거기서 봉인한 예측이 글로벌 귀환 루프(Header due 배지, /project) 밖에 있다. 이메일 cron이 있지만 로그인+동기화 사용자만 커버하고, 이 wedge의 주 타깃인 익명 사용자는 스스로 /tools/review에 재방문하지 않는 한 어떤 귀환 트리거도 받지 못한다. "정한 날 돌아와 물어요"라는 랜딩 약속이 wedge에서 침묵으로 깨진다.

다섯째, progressive 세션 저장이 3초 trailing debounce인데 unload flush가 없다. 완성/봉인 직후 탭을 닫으면 최종 산출물(final_deliverable, drafts)이 서버에 영영 안 닿는다. decision_contract는 프로젝트 경유로 즉시 upsert되므로 계약은 살지만, 다른 기기에서 열면 "봉인은 됐는데 문서가 없는" 반쪽 상태가 된다.

권장 우선순위: ① synthesize project_id 배선 + sealable 게이트를 hasVoyage 기준으로 재정의(한 줄 수준의 수정으로 봉인 루프 배제가 풀림), ② PipelineExitOptions를 리로드 없는 라우팅 + itemId 소비로 교체, ③ review receipts를 Header dueCount에 합산, ④ review 디렉토리 i18n, ⑤ pagehide flush. legacy 체인 자체는 고치기보다 종점(synthesize)을 잘라내고 rehearse에서 바로 SealMoment로 잇는 것이 총 공사량이 적다 — 이미 refine을 그렇게 흡수한 전례가 있다.

### marketer-user

일주일 써본 사용자이자 퍼널을 뜯어보는 마케터로서 여정을 재연한다.

랜딩에 들어왔다. "AI가 실행을 가져간다. 판단은 어디에 쌓이나?" — 훅은 상위권이다. 세피아 항해 일러스트도 고급스럽다. 그런데 다음 순간 내 눈은 갈 곳을 잃었다. 화면의 70%를 차지하는 건 40초짜리 무한루프 영상이고, 정작 내가 뭔가 할 수 있는 입력창("읽어봐 주세요")은 그 아래 작은 회색 카드 두 장으로 숨어 있다. 마케터로서 단언하면, 이 히어로는 '감상'을 시키지 '행동'을 시키지 않는다. 모바일에서 다시 열었더니 영상 카드 아래 250px쯤 되는 빈 베이지 공간이 뚫려 있었다 — 깨진 페이지처럼 보였고, 광고로 유입된 모바일 방문자라면 여기서 접었을 것이다.

그래도 궁금해서 예시 문장을 넣고 엔터를 쳤다. 워크스페이스는 랜딩보다 낫다. "지금 들고 있는 결정, 어디서 갈리는지 봐 드릴게요" — 목적이 즉시 읽힌다. 다만 '시작' 버튼이 입력 전엔 거의 배경색이라 눈에 안 들어오고, 하단 칩 4개 중 "팀"과 "AI 팀 소개"가 뭐가 다른지 눌러보기 전엔 모른다. 제출하자 분석 대신 "밧줄 묶기"가 먼저 나왔다. 팀장 보고 기획안을 들고 온 나에게 밧줄·출항·현재 방위·선원이라는 어휘는 첫 회차엔 번역이 필요했다 — 가이드 FAQ에 "현재 방위가 뭔가요?"가 있다는 것 자체가 용어가 자력으로 안 읽힌다는 증거다. 다행히 질문 2~3개에 답하니 "당신이 놓친 단 하나"를 실제로 짚어줬고, 여기서 처음 가치를 체감했다 — 진입 후 약 2~4분, time-to-value 자체는 나쁘지 않다. 랜딩의 문제는 이 결과물(현재 방위 한 장)을 미리 보여주지 않는다는 것이다.

기획안 PDF가 있어서 "검수받기"로 갔다. 여기서 짜증이 났다. 좌측에 내용이 0인 흰 사이드바가 220px을 차지하고 — 미완성 제품처럼 보인다 — 문서를 붙여넣고 나니 실행 버튼 "검수 시작"이 버튼이 아니라 그냥 글자로 렌더돼 있어 두 번 두리번거렸다. 게다가 "(receipt_only)"라는 개발자 용어가 사용자 문구에 그대로 노출된다. 이 페이지는 랜딩 히어로가 직접 미는 wedge인데 완성도가 가장 낮고, 영어 사용자에겐 통째로 한국어다.

로그인을 고민했다. 로그인 페이지는 "하루 30회 무료"라 하고 워크스페이스 배너는 "하루 결정 2~3개 분량"이라 한다 — 같은 것을 다른 단위로 말하니 뭘 잃고 뭘 얻는지 계산이 안 된다. 로그인 후 /tools/reframe에 들어가 보니 잠금 화면에 이 도구가 뭘 하는지 한 줄도 없다(agents 잠금엔 있다).

그리고 재방문. 이 제품의 약속은 "정한 날 돌아와 물어요"인데, 가이드에 정직하게 적혀 있다: "메일·알림은 보내지 않아요. 프로젝트 페이지에 오시면 제가 먼저 물어요." 즉 정산 루프의 발화점이 100% 내 기억력이다. 일주일 뒤 내가 돌아온 건 이 리뷰를 쓰기 위해서였지, 제품이 불러서가 아니었다. 판단의 '축적'이 핵심 가치인 제품에서 복귀 트리거 부재는 카피 문제가 아니라 리텐션 구조의 구멍이다. 헤더 due 배지는 이미 들어온 사람에게만 보인다.

총평: 코어 루프(입력→갈리는 자리→현재 방위→봉인)는 진짜 가치가 있고 zero-judgment 포지셔닝도 화면 카피에 일관되게 살아 있다. 문제는 그 가치의 앞뒤다. 앞(랜딩 히어로·모바일·wedge 완성도)에서 전환이 새고, 뒤(복귀 트리거 부재)에서 리텐션이 샌다. 우선순위는 (1) 모바일 랜딩 빈 공간과 빈 사이드바 같은 '깨져 보이는 것' 제거, (2) 히어로에서 입력창을 주인공으로 승격하고 결과물 미리보기 추가, (3) 정산일 복귀 수단(캘린더 파일을 봉인 직후 기본 제안, 로그인 유저 이메일 opt-in) 신설, (4) review 페이지의 버튼·용어·i18n 정비다.

### designer

Argus의 현재 상태를 한 문장으로 요약하면 "상태 디자인은 이미 80점인데, 정적 화면의 기본기가 50점"이다. 분류형 에러(로그인/쿼터/네트워크를 나눠 각각 다른 CTA), 스트리밍 로딩 연출, 변수 리맵 기반 다크모드, reduced-motion 전면 대응, 대비 수치를 주석으로 관리하는 문화 — 이런 것들은 Linear급 팀도 자주 빼먹는 부분이고 진심으로 훌륭하다. 모션도 장식이 아니라 의미(phase 전환, 팀 등장 stagger)를 돕는 쪽이다. 문제는 그 반대편이다: 사용자가 아무것도 하지 않고 처음 마주하는 화면들 — 비활성 CTA, 빈 사이드바, 잠금 화면, 균일한 회색 카드 — 이 방치되어 있다. 즉 "움직이는 순간"은 고급인데 "멈춰 있는 순간"이 싸 보인다. 첫인상은 멈춰 있는 순간에 결정된다.

구조적 원인은 두 가지다. 첫째, 토큰 시스템의 비대칭: 색·그림자·라운드·이징은 5단 토큰으로 문서화됐는데 타이포와 간격만 무정부 상태다(임의 px 폰트 20종 1,500회+, 반픽셀 크기 4종). 위계는 결국 크기·굵기·간격의 반복에서 나오는데 그 축이 없으니 화면이 "정보는 많고 위계는 없는" AI-generic 질감이 된다. 둘째, 컴포넌트 채택률: Button 21%라는 숫자가 말해주듯, 좋은 부품을 만들어놓고 화면은 인라인으로 조립하는 문화다. 그래서 같은 골드 CTA가 화면마다 다른 촉감을 내고, disabled 처리가 세 가지 방식으로 갈라져 결국 "보이지 않는 시작 버튼"이라는 크리티컬을 낳았다.

80점으로 가는 최단 경로 (우선순위 순):

1. 비활성 CTA 구조(1일). 워크스페이스 '시작'과 리뷰 '검수 시작'의 disabled를 투명도 감산에서 솔리드 감채도로 바꾼다. 이것 하나가 신규 사용자 전환 경로의 가장 큰 구멍이며, 코드 3줄짜리 수정으로 체감이 가장 크다. 동시에 주 전환 경로의 원시 button을 공용 Button으로 이관한다.

2. 빈 사이드바 제거(반나절). tools/guide/agents의 224px 흰 기둥은 "미완성 제품" 신호를 모든 보조 페이지에 방송하고 있다. 유틸 링크 3개는 헤더로 흡수하고 aside를 지운다. 지우는 것이 채우는 것보다 빠르고 IA도 단순해진다(현재 내비가 3중 레지스터).

3. 타이포 스케일 토큰화(2일). 6단 크기+고정 행간을 @theme에 정의하고 9px 이하·반픽셀을 일괄 치환. 이건 단일 작업으로 전 화면의 위계가 동시에 정돈되는, 투자 대비 효과가 가장 넓은 항목이다. 간격은 전면 토큰화 대신 '8/12/32 3단 스택 규약'만 도입해도 리듬이 산다.

4. 잠금·빈 상태 표준화(2일). LockedState 컴포넌트 하나(가치 한 줄 + 블러 프리뷰 + CTA + 탈출구)로 reframe/agents/import를 통일한다. 잠금 화면은 벽이 아니라 쇼윈도여야 한다. 지금은 화면의 90%가 공백인 채 전환 설득을 포기하고 있다.

5. 랜딩→앱 톤 브리지(3일). 랜딩의 인쇄물 질감(세피아, 괘선 라벨, 나침반 모티프)을 앱에 5%만 이식한다 — 워크스페이스 히어로 배경 텍스처, 섹션 라벨 스타일 공유, 빈 상태의 항해 모티프. '지금 출항'을 누른 사용자가 도착하는 화면이 랜딩과 같은 세계여야 랜딩이 쌓은 신뢰가 이월된다. 겸사 13MB 히어로 영상 재인코딩과 receipt_only 카피 유출도 이 스프린트에서 함께 처리.

이 다섯 개는 전부 합쳐 8~9 작업일 규모다. 신기능 없이, 이미 있는 시스템(토큰, Button, AuthGuard)의 채택과 일관성만으로 도달 가능하다는 점이 이 코드베이스의 좋은 소식이다. 로딩·에러·다크모드·모션이라는 어려운 절반은 이미 끝나 있다 — 남은 건 규율이지 재능이 아니다.

### philosophy

총평: Argus는 "철학이 코드에 새겨진" 드문 코드베이스다. BindCard의 스킵-우세 설계(밧줄은 절대 모델 출력으로 프리필하지 않음), Falsification의 real_bet_authored 'user' vs 'ai_surfaced' 출처 태깅과 3중 friction escape, SealMoment의 flat-결정 침묵과 restraint-관측 신호 분리(seal_not_armed reason), CurrentBearing의 "proceed는 기본값이 아니라 earned" 사다리, VerificationGate의 의식적-비강제 검증 — 스파인 4개 조항이 전부 구체적 코드 불변식으로 번역돼 있고, 주석이 그 이유까지 인용한다. 이 수준의 자기규율은 진심으로 훌륭하다.

그러나 판정은 "철학이 잘 녹여진 제품인가?"이고, 답은 "설계는 그렇다, 그러나 현재 화면은 세 군데서 배신당하고 있다"이다.

첫째, 실행 품질이 철학의 심장을 부수고 있다. 철학이 가장 공들인 두 화면 — Falsification(진짜 베팅 재서술)과 SettlementModal(정산 "그래서, 어떻게 됐어요?") — 의 한국어 문자열 다수가 CP949 mojibake로 소스에 박혀 있다. 출처를 정직하게 태깅하는 escape 버튼("직접 안 쓸게요 — AI가 짚은 걸로 할게요")조차 "吏곸젒 ???곸쓣寃뚯슂"로 렌더된다. 제품의 차별화 순간(봉인→귀환→정산)이 한국어 주 사용자에게 깨진 글자로 도착한다. 철학이 아니라 QA의 문제지만, 결과적으로 철학이 화면에서 안 느껴지는 가장 큰 이유다.

둘째, 기본 모드(focus)가 검증 불변식을 조용히 무력화한다. approveAllPending은 "선장이 명시적으로 '확인 없이 반영'을 누른 사실을 정직하게 기록하기 위한" 함수인데, focus 모드는 워커가 끝나면 이를 자동 호출해 사용자가 보지도 않은 AI 결과에 선장 승인 도장을 찍고, "선장이 반영을 클릭한 것과 정확히 동일하게" XP/관찰 부수효과까지 발화시킨다. VerificationGate가 지키려던 "미검증 분석이 초안에 몰래 흘러들지 않는다"는 기본 경로에서 죽었고, 학습 신호(패턴 빈도 진술의 원료)가 가짜 사용자 승인으로 오염된다. 정직한 출처표기 조항의 신호-레벨 위반이다.

셋째, 랜딩이 내부 문서가 금지한 절대 주장을 한다. CLAUDE.md는 "'우리는 판단하지 않는다'라고 쓰지 말고, 희미한 lean을 한계로 명시하라"고 못박는데, UseCases는 "답을 대신 정하진 않아요 / it never decides for you"라고 점근선을 상태로 판다. 그리고 제품은 실제로 CurrentBearing에 "진행(Proceed)/보류(Hold)" 같은 기계-파생 방향 pill을 띄우므로(중립 스타일링으로 완화했지만 단어 자체가 방향 진술), 이 카피는 약속-경험 갭이 된다. 제품 어디에도(가이드 포함) 잔여 lean의 한계 고지가 없다.

역방향(철학 과잉)도 있다: flat 결정에서 SealMoment가 수동 봉인 핸들까지 통째로 숨긴다 — 절제의 원칙은 "가정 하나 명명 + 핸들 반환"인데, 여기선 개입 안 함을 기계가 사용자 대신 확정하고 핸들을 회수한다. 절제가 침묵으로 렌더되는 것도 사용자에겐 "기능 누락"과 구별 불가능해, 철학이 UX 가치로 번역되지 못한 채 비용만 남는다.

마지막으로 Boss의 사주 엔진은 실존 인물(상사)의 생년월일에서 성격 평결을 제조해 프롬프트에 주입한다 — "불확실성은 이름 붙이지, 퍼뜨리지 않는다"는 제품이 팔면서, 근거 0의 인물 판정을 오락으로 파는 표면이 공존한다. 06-25 감사가 경고한 브랜드 희석이 그대로 살아 있다.

결론: 엔진(코드)은 철학에 A급으로 정렬돼 있으나, 기본 경로의 자동 승인, 랜딩의 절대 주장, 그리고 핵심 세리머니의 텍스트 부패 탓에 "화면에서 느껴지는 제품"으로서는 아직 B-다. 셋 다 국소 수리로 고칠 수 있고, 고치면 이 제품은 자기 철학을 실제로 구현한 흔치 않은 사례가 된다.
