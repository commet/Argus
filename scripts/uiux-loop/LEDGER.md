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
