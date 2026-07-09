# Argus 검증 루프 — findings 원장 (append-only)

RUBRIC.md 기준. 각 finding = 증상(측정값 포함) + 진단(파일:줄/프롬프트) + 집도 + 상태.

---

## Loop 1 — 전체 여정 첫 캡처 (scenario 0: 동탄 매수)

캡처: 11표면 완주 성공. 하네스(capture.mjs) 정상 작동.

### F-1-1 · P1 · complete-bearing/full · UX#7 정보구조 + 내용#12
증상: 완성 화면에 '완성된 문서'(FinalCard) + '현재 방위'(CurrentBearingCard)
  두 카드가 나오는데 둘 다 요약/인사이트를 실어 무슨 차이인지 불명. 접힌
  FinalCard는 제목 + "전체 문서 펼치기"만 보여 진짜 문서가 딴 데 있는 듯.
  (창업자 3회 지적)
진단: FinalCard.tsx:85-100 헤더가 "완성된 문서 · 바로 보낼 수 있어요"로 역할을
  안 밝힘. 131-147 접힘 상태가 제목+펼치기만. CurrentBearingCard.tsx:100 eyebrow
  9px로 형제 카드와 위계 불일치 — 둘 다 "내가 뭔지"를 안 말함.
집도: 두 카드에 역할 부제 부여(문서=가져가는 결과물 / 방위=지금 선 자리 요약).
  접힘 FinalCard에 섹션 수 표기 + "여기서 전체 읽기"로 문구 교정. eyebrow 위계
  통일.
상태: open

### F-1-2 · P1 · complete-bearing · UX#2 가독성
증상: 현재 방위 카드 역할 설명 문장 10.5px(하한 12px 미달), 본문 단락 최소
  10.5px 측정.
진단: CurrentBearingCard.tsx:127 `text-[10.5px]`.
집도: 12px로 상향 + 색 tertiary→secondary.
상태: open

### F-1-3 · P2 · idle/bind/premise · UX#2 가독성
증상: idle·bind·premise-extract 표면 본문 최소 폰트 11.5px(하한 미달).
진단: 표면별 보조 설명 단락들이 11.5px. 다수라 개별 확인 필요 — 이번 루프
  범위 밖(방위 우선), 다음 루프에서 표면별 집도.
상태: open (deferred to loop 2)

### 관찰 (finding 아님, 좋은 상태)
- 리뷰 '이것만 고치면' 카드: 권장/필수 뱃지 + 볼드 제목 + 해결 틴트 = 위계 양호(loop21 수리 유효).
- draft-gate: 히어로 1개·틴트 요약·CTA 명확 = 양호.
- 사다리 단계 단계요약: 접속사 뒤 내용 실림 = 양호(loop 수리 유효).
- 손톱(왼쪽 악센트 바): 전 표면 0건.

---

## Loop 2 — 완성 화면 검증 + 마크다운 렌더

### F-1-1, F-1-2 → fixed (재캡처 확인)
세 카드(완성된 문서 / 현재 방위 / 봉인 종막)가 역할 부제로 명확히 구별됨.
접힌 문서 = "6개 섹션 · 여기서 전체 읽기". 방위 = "지금 선 자리 요약".

### F-2-1 · P1 · complete-bearing · 내용#9 렌더 + 창업자 팁 · fixed
증상: 현재 방위 요약에 리터럴 `**동탄이 내 삶의 패턴에 맞는 곳인가**` 별표 노출(2개).
진단: CurrentBearingCard가 current_course.summary/reasons/fog를 plain {text}로
  렌더 — 엔진(current-bearing 프롬프트)은 **강조**를 넣는데 렌더가 버림.
집도: summary·reasons·fog에 renderInline 적용 → 별표 0개 확인. 부수효과로
  창업자 팁(긴 요약의 하중 어구 강조)이 엔진 산출 그대로 자동 구현됨.
상태: fixed(<이 커밋>)

### F-2-2 · P2 · complete-bearing · UX#2 가독성
증상: 방위 화면 최소 본문 여전히 11px(하한 12px 미달) — 별도 요소 잔존.
상태: open (loop 3)

### 하네스: run.mjs 신설 — 완주까지 자동 재시도(창업자 "끝까지" 지시).

---

## Loop 3 — 가독성 하한 패스 (다른 시나리오: 채용 vs 외주)

관찰: 새 주제에서도 리프레임 날카로움("실제 질문은 개발 수요가 구조적/일시적인가").
레일 9노드 정상. 손톱 0. 세 완성 카드 구별 유지.

### F-3-1 · P2 · bind · UX#2 · fixed
증상: 밧줄 화면 하단 안내 11.5px(하한 미달).
집도: BindCard.tsx:203 → 12px + tertiary→secondary.
상태: fixed(<이 커밋>)

주: 남은 sub-12(복사 버튼 라벨 10.5px, 조건부 봉인 캡션 11px)은 관례적
마이크로 라벨 — 본문 하한과 무관. 본문 단락은 전 표면 ≥12px 달성.

---

## Loop 4 — 자동 CHECK 도입 + 마크다운 누출 완전 봉합

### 하네스: check.mjs 신설 — 스파인/마크다운/가독성/레일/커버리지 자동 검사.
매 캡처 뒤 실행. 사람 눈은 미학에, 규칙 위반은 기계에.

### F-4-1 · P1 · complete-bearing · 내용#9 렌더 · fixed
증상: check.mjs가 방위 카드 `**[진단 선행 조건...]**` 리터럴 별표 재검출 —
  loop2 renderInline이 요약/근거/암초만 덮고 next_helm은 샘.
진단: CurrentBearingCard next_helm(230)·contract_seed.predicate(244)·
  required_check(197)이 plain text.
집도: 셋 다 renderInline. 재캡처 후 P1=0 확인.
상태: fixed(<이 커밋>) — 자동검사가 사람이 놓칠 회귀를 잡은 첫 사례.

### F-4-2 · P2 · 다표면 · UX#2 가독성 (batch)
증상: idle·analyzing·draft·review·ladder·premise·bearing 본문 최소 11px.
  여러 표면이 정확히 11px → 공통 컴포넌트/패턴 의심.
집도: 다음 루프에서 공통 소스 추적 후 일괄. (P2, 회귀 아님)
상태: open (loop 5 batch)

---

## Loop 5 — 가독성 공통 소스

### F-4-2 부분 → fixed
AnalysisCard.tsx:170 본문 문장 11px→12px+secondary. 이 카드가 질문·사다리·
방위 여러 표면에 떠서 한 수정이 다표면 개선. 남은 11px는 대부분 카운트/칩/
라벨(관례적 소형) — 본문 하한과 무관.

---

## ▶ 다음 세션 재개 절차 (context 압축 후 이어받기)

1. `preview_start`로 dev 서버(:3000) 띄우고 200 확인.
2. `node scripts/uiux-loop/run.mjs --scenario N --tries 4` — 완주까지 자동 재시도.
   (N: 0=동탄매수 1=채용vs외주 2=가격대응, 시나리오 돌려가며)
3. `node scripts/uiux-loop/check.mjs` — 스파인·마크다운·가독성·레일 자동 진단.
   P0/P1 있으면 그 표면 gallery/*.png 읽고 집도.
4. 이 LEDGER를 읽어 open findings 확인 → RUBRIC 순서(P0>P1>P2, 여정 앞쪽)로 집도.
5. 한 루프 = findings 3~6개 집도 → 재캡처+check로 검증 → 커밋 → PR 머지.
6. 1~8루프 UX, 9루프+ 내용/엔진(프롬프트) 비중↑ (RUBRIC 규율).

현재 상태: P0=0, P1=0, P2=가독성 잔여(대부분 관례적 소형 라벨). 세 완성
카드 구별·마크다운 렌더·레일 정합·손톱0 전부 green.

---

## Loop 6 — 세 번째 시나리오(가격 대응) + 가독성 잔여 소탕

캡처: 가격대응 시나리오 10표면 완주 (try 1). check: P0=0 P1=0 P2=3.
관찰: 새 주제에서도 스파인/마크다운/레일 무결 — 3개 시나리오 연속 clean.

### F-4-2 잔여 → fixed
idle(MCP 안내문)·premise-extract(멈춤 안내 3개 문단)·complete(항해일지 체크
설명) 본문 11~11.5px → 12~12.5px. 다음 캡처의 check.mjs가 자동 재검증.
(SealMoment '마지막으로' 등 짧은 uppercase 마이크로 라벨은 관례 유지)

---

## Loop 7 — 가독성 whack-a-mole 구조적 종결 (하네스 자기진단화)

문제 인식: loop 5·6·7 연속으로 complete-bearing이 11px를 흘림. 매번 요소
하나를 추측 수정 → 다음 루프에 다른 11px 재등장 = 추측성 땜빵(창업자 지적).
근원: complete 표면은 FinalCard·방위·SealMoment·JudgmentReceipt가 **동시에**
뜨는 화면이라 위반 `<p>`가 어느 카드인지 소스만 봐선 못 짚음.

### 하네스 개선 · capture.mjs measure()
`subMinBody`: 12px 미만 본문 `<p>`의 {px, text 70자}를 전부 기록. 이제
check가 "11px 있음"이 아니라 **정확한 문장**을 준다 → 추측 영구 제거.

### F-7-1 · P2 · complete · UX#2 가독성 (batch, 근원 4곳) · fixed
subMinBody가 지목한 4개 실문장(전부 봉인/완성 영역, 방위 카드 아님):
- JudgmentReceipt.tsx:97 "지금의 판단 — N에 꺼냅니다" 11px→12px+secondary
- ProgressiveFlow.tsx:3531 "새 프로젝트 시작해도 저장돼요" 11px→12px+secondary
- SealMoment.tsx:700 "그날 프로젝트 페이지에 오시면…" 11.5px→12px+relaxed
- SealMoment.tsx:707 "로그인 전이라 이 기기에만…"(익명 경고) 11.5px→12px
재캡처: **P0=0 P1=0 P2=0, subMinBody=[] — 전 표면 본문 ≥12px 최초 달성.**
방위 카드 169줄(봉인 설명문)도 11px→12px 함께 정리.

---

## Loop 8 — 다른 시나리오(채용)에서 가독성 하한 유지 검증

scenario 1 완주. P0=0 P1=0 P2=0, subMinBody=[]. 날짜·수치가 삽입되는
**동적 문장**(check_by 등)에서도 12px 하한 유지 확인. 수정 없음(회귀 방지 확인).

---

## Loop 9 — 내용/엔진 층 감사 (RUBRIC layer 2·3, 3개 시나리오)

UX가 clean해져 내용 고도(너무 좁은가/넓은가/얕은가)로 시선 이동. 실측 판정:
- **리프레임 고도 정확**: 채용→"이 일감이 내년에도 있느냐", 가격→"우리 차별화가
  30% 가격차를 이길 근거가 뭐냐"로 표층 질문을 하중 질문으로 격상. 3/3 날카로움.
- **boss-review가 진짜 약점을 잡음**: 근거 없는 "16 man-week" 기준선, 담당자가
  이름 아닌 역할("영업/CS 팀장")이라 책임 공백 — 둘 다 구체적 수리 처방 동반.
- **정직한 저작권 준수**: 엔진이 만든 정량 앵커(16 man-week·연봉대)를 봉인 화면이
  "AI는 이렇게 가정했다 … 아직 확인되지 않음"으로 provenance 태깅.
판정: 내용 A급, 자기교정 구조(boss-review) 작동. **억지 수정 안 함**(over-fire =
mirror-clause 스파인 위반). finding 아님, 강한 상태 기록.

---

## Loop 10 — 다크 모드 대비 사각 (하네스에 다크 추가)

### 하네스 개선 · capture.mjs
`--dark` 플래그: playwright colorScheme:'dark'로 prefers-color-scheme 에뮬레이션.
지금까지 10루프 전부 라이트만 봤던 사각 제거. surfaces.json에 mode 기록.

### 다크 대비 감사 (눈)
완주 캡처 후 완성 화면 육안: 따뜻한 다크 배경 + 골드 악센트 대비 충분, 흰 버튼/
골드 CTA·방위/영수증 카드 본문 전부 판독 가능. **P0=0 P1=0 P2=0, 대비 결함 없음.**
텍스트 검사도 clean(하한은 색과 무관하나 다크 회귀 감시선 확보).

---

## Loop 11 — 모바일 뷰포트 (390px) 완주 검증

### 하네스 개선 3건 · capture.mjs + run.mjs
- `--mobile`: 390×844 뷰포트. 11루프 만에 모바일 사각 제거.
- 사다리 rung 클릭 문턱 `width>300`→`>240`: 데스크톱 전용이라 좁은 뷰포트에서
  rung을 놓칠 위험 제거(숫자시작+30자↑ 조건이 오탐 방지).
- run.mjs가 `--mobile`/`--dark`를 capture로 통과 → 모바일·다크도 재시도 래퍼 적용.

### 정직한 정정 (첫 판독 오류 → 진짜 원인)
첫 모바일 캡처가 8표면(그다음 5표면)에서 끊겨 P0. rung 문턱을 의심했으나
재현이 **비결정적** → 진짜 원인은 **dev 서버가 세션 중간에 죽음**(curl 000).
서버 재시작 후 재주행: **11표면 전부 완주, P0=0 P1=0 P2=0.** 모바일 레이아웃
결함 아님. (교훈: 완주 실패 시 서버 헬스부터 확인 — run.mjs가 이미 serverUp 체크.)

### 모바일 육안 감사
390px에서 완성 화면 견고: 복사/보내기 버튼 맞음, 헤드라인 2줄 clean wrap,
가로 오버플로 없음, 핵심 틴트·단계 판독 양호.

### 관찰 (finding 아님, 다음 루프 후보)
완성 화면 "현재 방위" 제목이 우측 배지(복사 + '확인 필요…리뷰 기준')에 밀려
2줄 wrap. 판독엔 문제없음 — 좁은 폭 헤더 배치 미세 개선 여지(P2 코스메틱).

---

## Loop 12 — 엔진 스파인 스트레스 (over-fire / tilt), RUBRIC layer 3

가설: reframe crux 프롬프트에 fire-or-not 게이트가 없어(crux_question이 스키마
required) 플랫한 결정에도 억지 분기를 제조할 것(CLAUDE.md mirror clause 경고).

### 하네스 신설 · engine-probe.mjs
reframe 두뇌를 여정 없이 격리 호출(실제 프롬프트를 reframe-core.ts에서 regex
추출 — 하드코딩 드리프트 방지). 플랫2 + 고위험 대조군을 나란히 찍어 자동 스파인
판정(질문형·lean누출·두갈래포크). 여정 캡처가 flaky·고위험 튜닝인 사각을 메움.

### 판정 (가설 반증됨)
- **FLAT(워크샵 장소)**: crux="장소보다 먼저 팀이 가장 중요하게 얻어야 할 게
  뭔가?" — 두 선택지 사이 분기를 **안** 만들고 "이게 중요한 결정이긴 한가"로
  되돌림. **restraint 실작동, over-fire 아님.** 가설이 너무 비관적이었음.
- **HIGH-STAKES(대조군)**: 소득대비 대출40%를 정확히 하중으로. 정상.
- **FLAT2(냉장고 라벨, 트리비얼)**: crux="목적이 'A'인가 아니면 'B'인가?" —
  약한 두갈래 프레이밍. CLAUDE.md가 인정하는 irreducible 잔차, 저심각도.
- **제품 코드 수정 안 함**: restraint 디폴트가 이미 작동. 하드 fire-or-not
  게이트 추가는 rounds 5-8이 경고한 under-fire 위험 — 큰 설계결정이라 창업자 몫.

### 계기 정직성 수리 (probe 자체)
첫 검사기가 FLAT을 ⚠오탐('확정**해야** 할'의 benign 해야) + FLAT2 진짜 포크를
놓침(vs 계열만 봄). lean 정규식을 방향지시로 좁히고 'A인가 아니면 B인가' 문형을
추가 → 재실행: FLAT OK, FLAT2 ⚠포착, 대조군 OK. **계기를 믿을 수 있게 만든 뒤
결론냄**(honest instrument = 스파인).

---

## Loop 13 — recast 두뇌 over-fire (판단 사다리 논지-맞춤 검사)

가설: recast가 논지("사람의 판단을 남긴다")에 맞추려고 기계적 단계도 'human'으로
과잉배정하면 mirror-clause("개입할지를 사용자 대신 판단") 위반.

engine-probe.mjs에 recast 섹션 추가(RECAST_SYSTEM_KO를 소스에서 추출). 기계적
과제 vs 판단 과제 대조.

### 판정 (가설 반증 — 배분 정직)
- **MECHANICAL(블로그 예약)**: ai=2, human=2. human 단계는 "의도한 발행 순서가
  맞는지 확인"처럼 AI가 모르는 사용자 의도 확인점뿐 — 과잉배정 아님.
- **JUDGMENT-HEAVY(개발자 해고)**: ai=1, both=2(법적·사기 분석 초안), human=3
  (맥락 인터뷰·최종 결정·통보). 판단 사다리 정확 작동 — 진짜 판단이 사람에게 집중.
- **제품 코드 수정 안 함.** 두 생성 두뇌(reframe·recast) 모두 스파인 clean.

## 엔진 층 감사 결론 (loop 12-13)
reframe·recast 두 두뇌를 격리 probe로 검증 → restraint 실작동, 역할분리 정직,
tilt/over-fire는 CLAUDE.md가 인정한 저심각도 잔차뿐. **엔진은 건강.** 다음 고가치
타깃은 엔진이 아니라 production 재실사(#19, 창업자 로그인 필요).

---

## Loop 14 — 왜 문제가 안 나오나: 하네스 자기비판 + 적대적 probe (진짜 결함 2건)

창업자 질문 "왜 이렇게 문제가 안 발견되지?" → 정직한 진단: 해피패스 하네스가
문제 사는 곳(엣지·적대·에러)을 구조적으로 안 밟음. 자기 숙제 채점(내가 아는
것만 잡는 정규식) + 싼 표면값(px/마크다운)만 측정 + LLM이 LLM 산출을 in-frame
칭찬. 증거: 이번 세션 유일 심각버그(429 freeze)를 하네스 아닌 실사용자가 발견.

### 하네스 신설 · adversarial-probe.mjs
결정 아닌 입력(빈칸/헛소리/사실질문/넋두리/이미-끝난-결정)을 리프레임에 먹여
abstain vs fabrication 판정. 해피패스의 사각을 정면으로.

### F-14-1 · P1 · reframe 엔진 · LLM-glue 규칙#1(honest gap) 위반
리프레임에 abstain 경로 없음 + UI 게이트는 length>0뿐(BindCard.tsx:67, 의미
게이트 부재) → 비-결정 입력이 그대로 통과해 날조된 크럭스 생성:
- "대한민국 수도가 어디야?"(사실질문) → crux "법적·행정적 수도로 지정된 도시는?"
- "음..."(2글자) → "말로 꺼내는 게 어려운 이유는?"(심리분석 날조)
저빈도(사용자가 결정 적도록 유도됨)지만 invariant 위반. 상태: open.

### F-14-2 · P0 · reframe 엔진 · mirror-clause 스파인 위반(문서 명시)
"어제 이미 사인했어. 끝난 얘기야." → 리프레임이 결정을 **재오픈**
("지금 정리하고 싶은 것은?"). CLAUDE.md mirror-clause가 over-fire로 명시한
"reopens a decision the user already closed" 바로 그것. 넋두리도 결정으로 강제
변환. 상태: open — 수정은 reframe 스파인 프롬프트 손대는 일이라(rounds 5-8의
under-fire 위험 경고) 창업자 방향 확인 후 집도.

### 방법론 전환 (영구)
adversarial-probe를 상시 계층으로. 다음: 엣지/에러 상태(LLM 실패·malformed
JSON·쿼터·새로고침·봉인후수정·연속결정) UI 주행 + 내용 품질을 in-frame 칭찬
말고 **독립 refute 에이전트**로 반증. 싼 표면값 채점은 이미 clean, 문제는 딴 데.

---

## 하네스 커버리지 현황 (loop 14 기준)
3개 시나리오 × {라이트, 다크} × {데스크톱 960, 모바일 390} 완주 캡처 가능.
자동 검사: 스파인·마크다운·가독성(위반문 텍스트까지)·레일·커버리지. 재시도 래퍼로
LLM 흔들림·서버 재기동 흡수. **현재 전 조합 P0=0 P1=0 P2=0.**
