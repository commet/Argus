# 07 — 시그니처 순간: 봉인을 의식(ritual)으로

> 감사일: 2026-07-03 · 대상: 봉인 경험 전체 (SealMoment / SealModal·ReviewFlow / BindCard)
> 기준: "사용자가 스크린샷을 찍어 남에게 보여주고 싶은가"

## 요약 (5줄)

1. **봉인의 순간이 지금은 '장면'이 아니라 '상태 갱신'이다.** "네 — 물어봐 주세요"를 누르면 카드가 그 자리에서 즉시 다른 카드로 바뀐다(퇴장 애니메이션 0, 시간적 무게 0). 제품 이름의 어원인 그 동작이 목록 새로고침과 똑같이 렌더링된다.
2. **밀랍 인장 애니메이션은 이미 만들어져 있는데 아무 데서도 안 쓴다.** `bp-seal-stamp` 키프레임(globals.css:2983)은 컴포넌트 참조 0건인 죽은 CSS다 — 도구의 상징 동작이 제작만 되고 무대에 못 올랐다.
3. **봉인 직후 화면이 스크린샷 오브젝트가 아니다.** 사용자가 직접 쓴 "나는 ___라고 판단했다" 한 줄이 봉인하는 순간 화면에서 사라지고, 확인 카드는 버튼 4개가 채운다. 증서가 아니라 안내판이다.
4. **검수(/tools/review) 쪽 봉인은 초록 '성공 배지'로 끝난다** — 폼 저장처럼 보인다. 같은 제품 안에 봉인의 미학이 두 갈래다.
5. 처방: **약 2.6초짜리 의식**(누름 → 인장 압인 + 종이가 받는 충격 → 날짜가 먹으로 쓰임 → 인장의 숨) + **봉인 증서 플레이트**(해도 격자 질감 + 세리프 인용 + 압인). 전부 앱 레지스터 토큰으로 — 레지스터 계약 테스트(--bp-gold 금지)를 깨지 않고, 뺄셈 결과(남는 3화면)와도 충돌 없다.

---

## 발견 목록 (심각도순)

이 감사는 "고장"이 아니라 "무게의 부재"를 찾는 감사라 P0는 없다. 시그니처 순간의 관점에서 P1이 곧 최우선이다.

### P1-1. 봉인이 장면 전환 없이 즉시 스왑된다 (핵심 발견)

- `src/components/workspace/progressive/SealMoment.tsx:151-211` — `seal()`은 완전 동기 함수. 스토어 갱신 → `setJustSealed(true)`(:202)가 한 프레임에 끝난다.
- `SealMoment.tsx:278`, `:337` — ASK 화면과 SEALED 화면이 **조건부 return으로 갈라져 있어서** `AnimatePresence` 없이 통째로 교체된다. ASK 카드는 퇴장 애니메이션 없이 증발하고, SEALED 카드가 0.5초 페이드로 등장(:339-343)하는 게 전부다.
- 비교: 바로 위 "문서 완성" 순간(ProgressiveFlow.tsx:3165-3176)은 금색 원 + 체크가 스케일 애니메이션으로 등장한다. **문서 완성이 봉인보다 화려하다 — 위계가 뒤집혀 있다.** 봉인이 이 항해의 마지막이자 가장 큰 장면이어야 한다(주석 스스로 "screen-transition-grade"라고 약속함, SealMoment.tsx:6-7).

### P1-2. 봉인 직후 화면에서 사용자의 판단 한 줄이 사라진다

- ASK 상태에서만 JudgmentReceipt(판단 영수증)가 렌더링된다(`SealMoment.tsx:508-527`). 사용자가 "지금의 판단 — 한 줄" 입력(`JudgmentReceipt.tsx:96-110`)을 채워 봉인하면, SEALED 확인 화면(:337-446)에는 **그 문장이 어디에도 없다.** 저장은 되지만(`:185-186` judgment_receipt로 봉인됨) 눈앞에서 증발한다.
- SEALED 화면의 구성: 앵커 아이콘 + 안내문 2줄 + 로그인 CTA + 링크 2개 + 손보기 토글(:345-398). **가져갈 물건(증서)이 없고 다음에 할 일(버튼)만 있다.** 스크린샷을 찍을 이유가 없는 화면이다.

### P1-3. 검수 표면의 봉인은 '초록 성공 카드'다 — 두 미학

- `src/components/review/ReviewFlow.tsx:368-372` — SealModal의 "봉인하기"를 누르면 모달이 **즉시 닫히고**(애니메이션 0),
- `ReviewFlow.tsx:297-306` — 영수증 상단에 `Card variant="success"` + `text-green-700` "봉인됨" 배지가 나타난다. 문안("예측을 봉인했습니다. 확인일에 현실이 답할 때까지 이 판단은 살아 있습니다")은 훌륭한데 **옷이 '폼 저장 완료' 초록**이다. 항해 쪽 봉인(금색·앵커)과 물성이 다른 두 뇌.
- `src/components/review/SealModal.tsx:139-152` — 봉인 버튼도 일반 Button 컴포넌트, 인장의 흔적 없음.

### P1-4. 봉인 버튼에 누름 물성이 없다

- `SealMoment.tsx:529-537`(ASK 주 버튼), `:311-319`(수동 복구 봉인 버튼) — `active:` 스케일도 transition도 없다. 가장 무거운 클릭이 가장 뻣뻣하다.
- 비교: `CurrentBearingCard.tsx:150` "결정으로 봉인" 버튼은 `active:scale-[0.96]`이 이미 있다. 같은 동작, 다른 감촉 — 패턴은 코드베이스에 이미 있으니 이식만 하면 된다.

### P2-1. 제품의 상징 동작(밀랍 인장)이 죽은 CSS다

- `src/app/globals.css:2983-2992` — `bp-seal-stamp` 키프레임(압인: scale 0.2→1.12→1, rotate -14°→0, 오버슈트 이징)이 정의돼 있으나, `src/` 전체에서 클래스 사용처 0건(globals.css와 register 테스트에서만 등장). 랜딩에서조차 안 쓴다. 유일한 인장 시각물은 랜딩 필름의 정적 'chart seal'(`VoyageMapFilm.tsx:279-284` — ARGUS 원형 인장, -8° 회전)뿐이다. **이 인장 도장이 앱 안 봉인 의식의 원형이 되어야 한다.**

### P2-2. SEALED 확인의 아이콘이 일반 앱 칩이다

- `SealMoment.tsx:345-347` — 44px 둥근 사각형 + 금 그라디언트 + 흰 앵커. 인장(원형, 이중 링, 압인 자국)이 아니라 어느 앱에나 있는 성공 아이콘이다.

### P2-3. 다크 모드 금 그라디언트 + 흰 글자 대비 (기존 이슈, 승계 주의)

- `globals.css:156` — 다크 모드 `--gradient-gold`는 밝은 금(#d4b968→#e8d48b→#b8963e)인데 위에 `text-white`(SealMoment:314, :533)를 얹는다. 대비가 아슬아슬하다. 새 의식 스펙에서도 버튼은 "금 그라디언트 + 고정 텍스트" 원칙(기존 교훈)을 따르되, 다크에서 텍스트를 `#2a2015` 계열 고정 잉크색으로 두는 편이 안전하다 — 단 이 수리는 기존 버튼 전체에 걸친 별도 건이라 이번 스펙에선 새로 만드는 요소에만 적용한다.

### 참고 — 이미 잘 되어 있는 것 (건드리지 말 것)

- 봉인 카피의 뼈대: "이 결정, {날짜}에 어떻게 됐는지 물어봐 드릴까요?"(:483) / "「그래서, 어떻게 됐어요?」 — 그날 이 결정으로 돌아옵니다"(:355). 목소리 감사(02-voice)의 기준음과 일치. **의식은 무대만 바꾸고 대사는 유지한다.**
- 탈출구: "아니요, 괜찮아요" 1탭 무손실(:539-550), 날짜·예측 손보기 서랍(:554-595), 익명 봉인 정직 고지(:501-506) — 전부 보존.
- BindCard(출항 전 밧줄 묶기)는 **의도적으로 가볍다**(dominant skip, `BindCard.tsx:169-177`). 여기에 의식을 얹으면 과발화(over-fire)다. 의식은 종막 봉인 한 곳에만.

---

## 구현 스펙

### 설계 원칙 (레지스터 계약과의 정합)

`src/lib/__tests__/design-register-contract.test.ts:46`이 **--bp-gold / --bp-azure / bp-seal-stamp / bp-btn-primary를 랜딩 밖에서 금지**하고, `--bp-(paper|ink)`도 승인 목록(:33-43) 밖에선 금지한다. 그래서:

- 새 키프레임·클래스는 전부 **앱 네임스페이스(`seal-*`)로 새로 만든다.** `bp-seal-stamp`를 재사용하지 않는다(정규식에 걸림).
- 색은 앱 토큰만: `var(--accent)`, `var(--gradient-gold)`(봉인 버튼이 이미 쓰는 토큰, SealMoment:534), `var(--border)`, `var(--surface)`.
- 청사진 "질감"은 `Graticule`(`src/components/ui/VoyageElements.tsx:18-42`)로 들여온다 — 하드코딩 rgba(:27)라 bp 토큰을 안 쓰므로 **계약 테스트 수정이 아예 필요 없다.**
- `--bp-*`를 버튼 배경에 쓰지 않는다(기존 교훈 준수) — 버튼은 지금처럼 `--gradient-gold` + 고정 텍스트.

### S1 — globals.css에 봉인 의식 키프레임 추가 (앱 레지스터 구역)

`src/app/globals.css`의 앱 애니메이션 구역(voyage-bob 근처, :235-260 부근)에 추가:

```css
/* ── 봉인 의식 (앱 레지스터) — 작업 화면이 허용하는 유일한 의식.
   사용자 자신의 약속을 찍는 압인이지, AI 평결의 장식이 아니다.
   어떤 결정이든 똑같이 1회 재생 — 내용·방향에 따라 달라지지 않는다. */
@keyframes seal-press {
  0%   { opacity: 0; transform: scale(0.35) rotate(-11deg); }
  62%  { opacity: 1; transform: scale(1.10) rotate(2deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
.seal-press { animation: seal-press 560ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }

/* 소리 없는 '쿵' — 인장이 닿는 프레임에 종이(카드 전체)가 2px 눌렸다 돌아온다 */
@keyframes seal-thud {
  0% { transform: translateY(0); }
  55% { transform: translateY(2px); }
  100% { transform: translateY(0); }
}
.seal-thud { animation: seal-thud 180ms ease-out 340ms both; }

/* 압인 자리에서 먹이 번지는 링 — 1회 확산 후 소멸 */
@keyframes seal-ink-ring {
  from { opacity: 0.45; transform: scale(0.55); }
  to   { opacity: 0; transform: scale(1.55); }
}
.seal-ink-ring { animation: seal-ink-ring 700ms cubic-bezier(0.22, 0.61, 0.36, 1) 380ms both; }

/* 날짜 문장이 왼→오로 '쓰여지는' 잉크 획 */
@keyframes seal-line-write {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}
.seal-line-write { animation: seal-line-write 700ms cubic-bezier(0.16, 0.84, 0.44, 1) 950ms both; }

/* 안착 후의 숨 — 인장 위 희미한 광택 하나만 살아 있는다 */
@keyframes seal-glint-app { 0%, 100% { opacity: 0; } 50% { opacity: 0.4; } }
.seal-glint-app { animation: seal-glint-app 4.8s ease-in-out 1.8s infinite; }

@media (prefers-reduced-motion: reduce) {
  .seal-press, .seal-thud, .seal-ink-ring, .seal-glint-app { animation: none; }
  .seal-press { opacity: 1; }
  .seal-line-write { animation: none; clip-path: none; }
}
```

타임라인 합계: 누름 0ms → 압인 착지 ~380ms → 잉크 링 소멸 ~1,080ms → 문장 완성 ~1,650ms → 버튼 등장 ~1,900ms. **총 2초 이내에 조작 가능, 3초 이내에 정지.** 루프는 glint(불투명도 0↔0.4) 하나뿐.

### S2 — SealStamp 컴포넌트 (인장 SVG, 새 파일)

새 파일 `src/components/workspace/progressive/SealStamp.tsx`. 원형은 랜딩 chart seal(`VoyageMapFilm.tsx:280-283`)이되 앱 토큰으로 다시 그린다:

- 76×76 SVG, `-8deg` 고정 회전(찍힌 도장의 자연스러운 비뚤어짐).
- 외곽: `stroke: var(--accent)` 2px 원 + 4px 안쪽 옅은 링(`opacity .18`) — 이중 링.
- 중앙: 앵커 글리프(lucide Anchor 경로 재사용 가능) + 상단 호를 따라 `ARGUS`, 하단 호에 날짜(`month.day`, tabular-nums 10px).
- 스탬프 뒤에 `seal-ink-ring`용 동심원 div(absolute, `border: 1.5px solid var(--accent)`).
- props: `date: string`, `animate: boolean`(reduced-motion이면 false → 정지 프레임).
- 아무 텍스트도 판정을 담지 않는다 — 이름과 날짜뿐.

### S3 — SealMoment 장면 전환 재구성 (핵심)

`src/components/workspace/progressive/SealMoment.tsx`:

1. **장면 상태 추가**: `justSealed: boolean` → `scene: 'ask' | 'sealing' | 'sealed'`. `seal()`/`manualSeal()`은 스토어 갱신 직후 `setScene('sealing')`, 1,700ms `setTimeout`(cleanup 포함) 후 `setScene('sealed')`. `useReducedMotion()`(framer-motion, `VoyageFilm.tsx:304`에 기존 사용례)이 true면 타이머 없이 곧장 `'sealed'`.
2. **AnimatePresence로 감싸기**: 조건부 return 3개(:278, :287, :337)를 하나의 `<AnimatePresence mode="wait">` 아래 keyed `motion.div`로. ASK 카드 퇴장 = `exit={{ opacity: 0, scale: 0.985 }}` 220ms — 종이가 눌리며 물러나는 인상.
3. **'sealing' 장면**: 카드 골격(둥근 사각 + 금 테두리)은 유지한 채 내용만 교체 —
   - 카드 루트에 `.seal-thud` (인장 착지 시점에 카드 전체가 2px 받아낸다 — 소리 없는 무게).
   - 중앙에 `<SealStamp animate date={확인일} />` `.seal-press`로 압인.
   - 스탬프 아래 `.seal-line-write`가 적용된 한 문장(모노스페이스 아님, 본문 서체):
     **"봉인했어요 — {날짜}에 제가 먼저 물어볼게요."**
4. **'sealed' 장면(= 봉인 증서, S4)**로 크로스페이드. 버튼·링크는 `motion.div`에 `transition={{ delay: 0.25 }}`로 늦게 등장 — 의식이 끝나기 전 화면이 붐비지 않게.
5. **스킵 보장**: 'sealing' 장면 어디를 눌러도 즉시 'sealed'로 점프(`onClick={() => setScene('sealed')}` + `aria-label="건너뛰기"`). 의식은 제안이지 구속이 아니다.
6. **버튼 물성(P1-4)**: :533과 :314 버튼 className에 `transition-[scale,filter] duration-150 active:scale-[0.96]` 추가(CurrentBearingCard.tsx:150과 동일 패턴).

### S4 — 봉인 증서: 'sealed' 장면을 스크린샷 오브젝트로

SEALED 확인 카드(:337-446)를 두 층으로 분리한다. **위 = 증서(스크린샷 프레임), 아래 = 행동(버튼들).**

증서 플레이트 (카드 안 카드, `rounded-2xl border border-[var(--border)] relative overflow-hidden bg-[var(--surface)]`):

- 배경: `<Graticule opacity={0.05} spacing={26} />` — 해도 격자 질감(청사진 물성, 계약 테스트 무접촉).
- 우상단: `<SealStamp date={확인일} />` (정지 상태, `.seal-glint-app` 광택 숨만).
- 본문 순서:
  1. 라벨 `항해 기록 — 봉인` (10px, uppercase, tracking 0.2em, `--text-tertiary`) + 봉인일 날짜.
  2. 프로젝트 이름 (15px semibold).
  3. **사용자의 판단 한 줄** — `contract.judgment_receipt.human_judgment`가 있으면 세리프 인용으로: `style={{ fontFamily: 'var(--font-voice, serif)' }}` + 큰따옴표 (JudgmentReceipt.tsx:63의 기존 서체 패턴 재사용). **이게 P1-2의 수리이자 스크린샷의 심장이다 — 남에게 보여줄 것은 Argus의 문장이 아니라 자기 문장이다.** 비어 있으면 대표 예측(`contract.predicates[0].text`)을 `AI가 대신 적어둔 확인 질문` 라벨(ai_surfaced 정직 표기)과 함께.
  4. 하단 경계선 위 한 문장(증서의 마지막 줄, 13px, `--text-secondary`):
     **"이 판단의 답은 이제 현실만 갖고 있어요 — {날짜}, 「그래서, 어떻게 됐어요?」"**
- 증서 밖(아래)에 기존 요소 그대로: 텔레그램/채널 고지, 로그인 CTA(:365-377), 프로젝트 링크·캘린더(:379-390), 손보기 서랍(:392-443). 문안 변경 없음.

이렇게 하면 화면 상단 ~60%가 여백 있는 증서 하나로 정리되고, 모바일 스크린샷이 버튼 없이 깔끔하게 잘린다.

### S5 — 검수 표면 정합 (두 미학 → 한 미학)

1. `src/components/review/ReviewFlow.tsx:297-306` — `variant="success"` + `text-green-700` "봉인됨" 카드를 증서 미니어처로:
   - `variant="elevated"` + 좌측에 28px `<SealStamp date={check_by} />`(정지) + 라벨 색 `text-[var(--accent)]`.
   - 문안 유지(이미 좋음): "예측을 봉인했습니다. 확인일에 현실이 답할 때까지 이 판단은 살아 있습니다."
2. `ReviewFlow.tsx:368-372` — `setSealing(false)` 전에 모달 내부에서 `seal-press` 스탬프를 480ms 재생 후 닫기(또는 최소한 모달 퇴장 페이드 180ms). 항해 쪽 풀 의식의 축약형 — 같은 동작, 같은 인장, 작은 무대.
3. `SealModal.tsx:147` "봉인하기" 버튼에 `active:scale-[0.96]` 물성 추가.

### S6 — 위계 조정 (완성 순간 < 봉인 순간)

`src/components/workspace/progressive/ProgressiveFlow.tsx:3168` — "문서 완성" 금색 원(`--gradient-gold`)을 중립으로: `bg-[var(--surface-2)]` + `Check` 색 `var(--accent)`. 금색과 인장은 이 화면에서 봉인만 갖는다. (문안 변경 없음 — 색 위계만.)

### 구현 주의

- **mojibake 가드**: `src/lib/__tests__/mojibake-guard.test.ts:92`가 SealMoment.tsx의 한국어 문자열을 감시한다. 파일 편집 시 UTF-8 보존 필수.
- **레지스터 계약 테스트**: 새 클래스가 `bp-` 접두사를 절대 쓰지 않으면(`seal-*`) `design-register-contract.test.ts`는 무접촉 통과. `Graticule` import는 소비 파일이 bp 토큰을 안 쓰므로 MATERIAL 검사에도 안 걸린다.
- **`bp-seal-stamp` 죽은 CSS(P2-1)**: 이번에 지우지 말 것 — 랜딩용 자산으로 두고, 별도 청소 건으로 기록만.
- 순서: S1(CSS) → S2(SealStamp) → S3(장면) → S4(증서) → S5(검수) → S6(위계). S1~S4가 한 몸, S5·S6은 독립 커밋 가능.

---

## 스파인 충돌 검토

| 검사 | 판정 | 근거 |
|---|---|---|
| 평결·점수·등급 노출? | 없음 | 의식은 **모든 봉인에 동일하게 1회** 재생 — 결정의 내용·방향·stakes에 따라 크기·색·문장이 달라지지 않는다. 인장에는 이름과 날짜뿐. "잘한 결정"을 축하하는 게 아니라 "약속했다는 사실"을 찍는다. |
| verdict-by-styling (금색 의식이 평결로 읽힘)? | 아니오 | 레지스터 계약이 금지한 것은 **AI의 산출물**에 축하 금을 입히는 것(design-register-contract.test.ts:12-14). 봉인 버튼은 이미 `--gradient-gold`를 쓰는 기존 관행(SealMoment:534) — 금은 사용자 자신의 커밋 행위에만 붙는다. 의식도 같은 자리에만 붙인다. |
| ai_surfaced 정직 표기 | 유지·강화 | 증서에서 사용자의 한 줄은 인용 부호+세리프(본인 것), AI 유래 예측은 "AI가 대신 적어둔 확인 질문" 라벨로 구분(S4-3). |
| over-fire (개입 제조)? | 아니오 | 의식은 사용자가 이미 누른 봉인의 **연출**이지 새 개입이 아니다. 거절("아니요, 괜찮아요") 경로는 의식 없음·문안 무변경. 어디든 탭하면 즉시 스킵(S3-5). reduced-motion이면 정지 프레임. 총 3초 미만, 루프는 광택 숨 하나. BindCard(dominant skip)는 손대지 않는다. |
| 마찰 탈출구 보존 | 전부 | 1탭 수락 / 1탭 거절 / 날짜·예측 손보기 서랍 / 익명 정직 고지 — 코드 경로·문안 무변경, 무대만 교체. |
| 뺄셈(05) 결과와 충돌? | 없음 | 의식은 /workspace(ProgressiveFlow:3221)와 /tools/review(ReviewFlow:364) — 남는 3화면 안에서만 논다. SynthesizeStep(레거시, SynthesizeStep.tsx:628)은 SealMoment를 공유하므로 자동 상속 — 별도 작업 0. |
| 귀환(03)·최악의 날(10)과 충돌? | 없음 | 증서의 마지막 문장은 이미 합의된 기준음("그래서, 어떻게 됐어요?")을 재사용하고, 정산·귀환 화면(DecisionContractCard·SettlementModal)은 이번 스펙 범위 밖(무접촉). |
