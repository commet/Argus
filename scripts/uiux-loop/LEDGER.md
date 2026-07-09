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
