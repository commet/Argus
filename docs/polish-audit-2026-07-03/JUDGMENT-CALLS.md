
### [P0-3] 스펙 열거 밖 문자열 2건의 처리 (2026-07-03)

- **무엇이 애매했나**: ① 마스터 스펙은 ko.ts:74(demoAllDoubted)만 지목했는데, 바로 아래 :75(Detail "이번에도 그 날카로움을 적용해보세요…")가 제거된 평결 절("비판적 관점이 강합니다")을 지시대명사로 참조해 홀로 남으면 문장이 공중에 뜬다. ② navigator.avgSuffix(ko:268)는 스펙 목록(:267 dqScore)에 없지만 유일한 소비처가 함께 삭제된 트렌드 줄이라 죽은 키가 된다.
- **창업자 판단 근거**: Clean Removal 원칙("grep으로 소비처 전부 확인 후 imports·i18n 키 제거") + 스파인(칭찬 절 잔존 금지).
- **내린 판단**: ① :75는 평결 참조 첫 문장만 잘라 사실 안내 문장("어떤 전제가 가장 위험한지 표시하면 실행 설계에 반영됩니다")만 남김 — 키/분기 유지. ② avgSuffix는 dqScore와 함께 제거. ③ learning.tierLabel은 스펙 미지목 + 이번 제거와 무관한 기존 죽은 키라 무접촉(웨이브 범위 밖).
- **되돌리는 법**: 이 커밋의 ko.ts/en.ts diff에서 해당 키 2건과 demoAllDoubtedDetail 원문을 복원.

## W2-1. handleSettle "아직" 연장의 웹 계약 반영 간격 (P0-2 ③)

- **애매했던 것**: 텔레그램 네이티브 정산의 "아직"은 텔레그램 행을 14일 연장하는데, 스펙(03 S2)은 웹 계약도 "동일하게 양쪽에 반영(amendCheckIn)"이라고만 함. `applyTelegramSettlement`의 pending 기본값은 1주 — 그대로 쓰면 두 표면의 다음 확인일이 어긋난다(텔레그램 2주 뒤, 웹 1주 뒤 → 웹이 1주 먼저 조르기 시작).
- **창업자라면**: "같은 사건은 같은 얼굴로"(03 S3의 원칙) — 두 표면이 다른 날짜를 말하는 건 신뢰 배관 균열의 재생산.
- **내린 판단**: bridgeWebContract에서 pending일 때 `amendCheckIn(contract, '2w', now)`로 텔레그램 행과 같은 2주로 맞춤. (stl1 경로의 pending은 반대로 웹 기본 1주를 기준으로 미러를 웹 날짜에 맞춤 — 각 경로의 발신 표면이 기준.)
- **되돌리는 법**: webhook route의 bridgeWebContract에서 '2w' 분기를 제거하고 applyTelegramSettlement 결과를 그대로 쓰면 1주 기본으로 복귀.

## W2-2. reminder_count는 채널 합산 1카운터 (P1-B1)

- **애매했던 것**: 이메일·텔레그램 재발송 스탬프는 별도인데 상한 카운터를 채널별로 둘지 합산으로 둘지 스펙이 명시 안 함(10 S3은 "3회 발송 후 중단"만).
- **창업자라면**: 절제 기본값 — 상한의 목적은 "조르기 총량"의 상한이지 채널별 쿼터가 아님. 채널별 3회면 최대 6번 조르게 됨.
- **내린 판단**: 웨이브(크론 1회 실행에서 뭐라도 발송) 단위 1카운터, 양 채널 공용. mute는 카운터를 상한으로 점프.
- **되돌리는 법**: checkin-due에서 increment를 채널 분기 안으로 옮기고 필드를 email_reminder_count/telegram_reminder_count로 분리.

## W2-3. check_in 계정 힌트 문안 미세 조정 (P1-E4 ③)

- **애매했던 것**: 마스터 문안 "Nothing due locally. Judgments sealed in your account: argus_sync shows them."을 기존 고정 문구 "Nothing is due. Nothing to nudge." 끝에 그대로 붙이면 "Nothing is due. Nothing to nudge. Nothing due locally…"로 같은 말이 세 번 겹침. E3은 due-0 문구 현행 유지를 못박음.
- **창업자라면**: 취지(웹 봉인자가 "아무것도 없다"로 오독 방지)가 계약이지 문자열이 계약이 아님 — 단 새 문장에 판정·과장 금지.
- **내린 판단**: "This reads the local ledger only — judgments sealed in your account: argus_sync shows them." (사실 진술만, argus_sync 지시 부분은 마스터 그대로). 기존 문구 무접촉, 테스트로 고정.
- **되돌리는 법**: check-in.ts accountHint 문자열을 마스터 원문으로 교체.
