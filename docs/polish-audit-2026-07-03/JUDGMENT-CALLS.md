
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

## W3 (귀환 한 집) 판단 기록

### 1. P1-E1 범위 — tools/review.ts:173 surface의 사전 편입 보류
- **애매했던 것**: 마스터 P1-E1이 "갈라진 목소리 통일(seal/settle/open 영어 ↔ sync/review 한국어 하드코딩)"을 들며 review.ts:173을 파일:줄에 포함하되, 괄호로 "(tools/review.ts:173의 surface는 도구 파일이라 안전)"이라고만 적음 — 필수인지 허용인지 문면이 갈림. 또 review surface는 한 줄이 아니라 data 안 protocol·routing note 등 다수의 한국어 지시문과 한 몸.
- **나(창업자)라면**: "최소 범위 — 신규 렌더가 쓸 문자열 + 이미 갈라진 목소리의 surface만"이 리뷰4에서 명시한 자름선이고, review는 W1에서 방금 봉합한 MCP parity(byte drift 가드) 인접 지역 — 밤샘 자율 세션이 굳이 인접 지뢰밭을 넓게 밟을 이유가 없다. "나머지는 도구를 고칠 때마다 점진 편입"이 정확히 이 경우.
- **내린 판단**: sync만 편입(갈라진 목소리의 대표 사례이자 P0-8 동선의 연장), review.ts는 surfaces.ts 헤더의 점진 편입 정책 주석에 명시적으로 남김.
- **되돌리는 법**: review.ts surface 문자열을 SurfaceStrings에 review 섹션으로 추가하고 handler에서 surfacesFor 호출 — 구조는 이미 깔려 있음.

### 2. P1-E1 locale 해석 — config-only 결정론 (detectLocale 폴백 배제)
- **애매했던 것**: 스펙 문구는 "readConfig(dir).locale로 선택"인데 기존 detectLocale은 config→env(LANG)→Intl 순 폴백. 도구 런타임에서 env 폴백을 살리면 창업자의 한국어 Windows와 CI가 다른 문장을 내놓아 테스트가 기계마다 갈림.
- **나라면**: MCP 청사진 M4가 결정성(UTC 기본)을 논거로 박제돼 있고, §5-13이 같은 이유로 기본 시간대 변경을 기각 — locale도 같은 결: 스니핑은 init이 config에 **쓸 때** 한 번(detectLocale 유지), 도구는 config만 **읽는다**. config 없으면 base 'en'.
- **내린 판단**: surfaceLocale은 config.yaml만 읽음. 한국어 사용자는 argus_init 시점에 detectLocale이 ko를 config에 심으므로 실사용 경험은 동일.
- **되돌리는 법**: surfaceLocale에서 catch 시 detectLocale(argusDir) 반환으로 한 줄 교체.

### 3. P1-A4 — 08 S3의 2번 항목(검증 프로젝트 FolderOpen→금색 깃발) 미구현
- **애매했던 것**: 출처 보고서 08 S3에는 3개 항목(칩·금색 깃발·축적 한 줄)이 있는데 마스터 §2 P1-A4 문면은 "VoyageEta 칩 + due 최상단 정렬 + 축적 한 줄"만 명시.
- **나라면**: "§2의 항목 스펙 전문이 정본 — 요약과 다르면 00-MASTER가 이긴다"가 실행 지침이고, 리뷰5가 이 항목에 범위 가드(뺄셈과 상쇄 금지)까지 달았다 — 마스터가 판정 결과라면 깃발은 판정에서 떨어진 것.
- **내린 판단**: 마스터 문면 3요소만 구현. 깃발은 미래 소품 후보로만 기록.
- **되돌리는 법**: HeroFlow 행의 FolderOpen을 allGraded 조건부로 VoyageShip verified 금색 계열 아이콘으로 교체하는 4줄.

### 4. P0-6③ — check_in_at 없는 due 계약의 헤드라인 폴백
- **애매했던 것**: 스펙은 "날짜 앵커 필수"인데 contractStatus는 check_in_at 없이도(미정산 predicates만으로) due를 낸다 — 그 경우 앵커로 쓸 날짜 자체가 없음.
- **나라면**: 날짜를 지어내는 것(Defensive Data Access 위반)보다 날짜절만 뺀 사실문("돌아오셨네요 — 물어보기로 한 게 있어요")이 정직. "날짜 앵커 필수"의 취지는 부재-길이 집계 금지의 대구이지, 날짜 없는 데이터에 날짜를 강요하라는 게 아님.
- **내린 판단**: check_in_at 있으면 날짜 포함, 없으면(구버전 계약) 날짜절 없는 동일 문형. 부재-길이 어휘는 양쪽 다 0.
- **되돌리는 법**: contractDueDateLabel null 분기 제거하고 due 헤드라인을 날짜 있는 경우로만 한정(else 기존 완성 헤드라인).

## 웨이브4 (상태 정직화) 재량 판단

### W4-1. P1-C5 — "새로고침해도 입력은 남아 있어요" 약속 문구 미채택
- **애매했던 것**: 출처 스펙(09 S6-1)은 경과줄에 "오래 걸리면 새로고침해도 입력은 남아 있어요"를 제안하되 "Reframe/Rehearse/Synthesize에도 동일한 마운트 복구가 있는지 확인 후, 없으면 이식"이라는 조건을 붙였다. 마스터 정본(§2 P1-C5)의 문면은 "경과초 + '단계 표시는 대략적 안내'"까지만.
- **창업자라면**: 목소리 원칙4 "약속은 실제 동작만큼만" + 마스터가 정본이라는 명시 규칙. 3개 레거시 도구의 고아 복구 실재를 개별 검증하지 않고는 참말이 보장 안 되는 약속 — 강등 예정 화면에 그 검증 투자는 §5-3의 기각 취지와 같은 방향.
- **내린 판단**: 정본 문면대로 경과초+대략적 안내만 구현, 약속 문구 생략.
- **되돌리는 법**: 3개 도구의 마운트 복구를 확인(또는 이식)한 뒤 LoadingSteps.tsx의 경과줄에 한 문장 추가.

### W4-2. P0-5 — 만료 토스트 "한 번만"의 해상도: 탭 세션당 1회
- **애매했던 것**: 10 S1(a) "한 번만 띄운다" — 만료당 1회인지, 탭 세션당 1회인지, 로그아웃 상태의 매 방문마다인지 미지정. onAuthStateChange는 로그아웃 상태의 매 부팅에서도 null 세션 이벤트를 쏘므로 무대책이면 매 페이지 로드마다 토스트가 뜬다.
- **창업자라면**: 절제 기본값(over-fire도 위반) — 같은 사실을 반복 통보하는 건 조르기. 지속 상태는 P1-C1의 앰버 배지("이 기기에만 저장 중")가 이미 상시 담당.
- **내린 판단**: sessionStorage dedupe로 탭 세션당 1회. 새 탭/새 방문에서는 다시 1회(만료 인지가 필요한 새 문맥). /login 위에서는 미표시(문이 이미 열려 있는데 문으로 안내하는 중복 제거).
- **되돌리는 법**: SessionExpiredToast.tsx의 SEEN_KEY 체크 제거(매 이벤트 표시) 또는 localStorage로 승격(영구 1회).

### W4-3. P1-C2 — 재시도 이벤트를 3곳 모두 발신 (스펙은 1곳 지목)
- **애매했던 것**: 09 S4는 상태코드 재시도 대기(:216-219) 한 곳을 지목했지만, fetchWithRetry에는 대기가 3곳(상태코드/하드캡 타임아웃/네트워크 오류) 있고 나머지 둘도 같은 5~15초 침묵이다.
- **내린 판단**: 세 대기 모두 직전에 emitRetryEvent — "재시도가 침묵한다"는 발견의 취지가 특정 분기가 아니라 침묵 자체이므로. 이벤트 형태는 스펙 그대로(attempt/max/status — status는 네트워크 분기에서 undefined).
- **되돌리는 법**: llm.ts의 emitRetryEvent 호출 2곳(타임아웃/네트워크 분기) 제거.

### W4-4. P1-C3 — 재시도 버튼을 재진입-안전 핸들러 6개에만 배선
- **애매했던 것**: 10 S5(c) "마지막 실패 액션을 ref에 보관" — ProgressiveFlow의 setError 지점은 15곳+이고 전부 배선하면 재진입 시 상태를 이중 소비하는 핸들러(onRequestRevision 등)가 위험하다.
- **창업자라면**: 회귀 위험 > 커버리지 — 검증 못한 재실행은 안 얹는다(실패가 사용자 데이터를 다치게 하는 방향 금지).
- **내린 판단**: 재진입 안전을 코드로 확인한 6개만(onAnswer는 catch의 rollbackAnswer로 안전 확인, runMixCore·onDM·onDeepen·onMore·onFinalize는 진입 가드+상태 재설정 구조). onTest는 실패 시 스스로 finalize로 폴백해 불필요. 나머지 실패 지점은 버튼 없이 기존 메시지 유지(retryRef가 비어 있으면 버튼 미렌더).
- **되돌리는 법**: 각 핸들러 진입부의 retryRef.current 한 줄씩 추가/제거.
