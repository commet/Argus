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
