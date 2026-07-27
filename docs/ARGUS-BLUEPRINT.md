# ARGUS BLUEPRINT — 정본 설계도

Version: 1.2 (2026-07-17 — §9.8 자기지식·AI 영향 권한 트랙 E 등록.
1.1은 2026-07-08 §9 MCP 재건축 트랙 신설과 3중 감사 수렴)
Author: Claude (claude-fable-5)
Status: **단일 빌드 정본.** 이 리포에서 "무엇을 지을 것인가"에 대한 답은 이
문서 하나다. 이전 문서들은 이 설계도의 증거·상세 부록으로 지위가 바뀐다:
- `ARGUS-KEYSTONE-2026-07-07.md` → 공개 전 결함 판정과 수정 명세 (부록 A)
- `FABLE5-QUANTUM-UPGRADE-PROMPT-AND-PLAN-2026-07-07.md` → 초기 진단 (부록 C)
- `DESIGN-judgment-checkpoints-v2` / `DESIGN-clarify-question-system-v2` → 해당
  공정의 상세 시공도 (부록 D/E)

**이 문서의 사용 규약 (모든 세션의 첫 규칙):**
1. 어떤 세션이든 작업 전에 §6 공정표에서 **현재 공정**을 확인하고, 그 공정의
   방만 짓는다. 다른 방의 아이디어가 떠오르면 §8 대기 목록에 적고 짓지 않는다.
2. 모든 PR 본문 첫 줄: `공정 N · 겨냥 퍼널 단계 X→Y`.
3. 이 문서 자체의 수정은 "공정 완료 체크" 또는 "대기 목록 추가"만 허용.
   예외는 창업자가 독립 병렬 트랙과 기존 공정 무접촉 경계를 명시 승인한 등록이다.
   그 외 구조 변경은 준공(§6 끝) 후에만.

---

## §1. 이 집이 무엇인가 — 한 페이지 선언

브랜드 인물·이미지·동작·문체의 정본은 `ARGUS-BRAND-CANON.md`를 따른다.
제품 구조의 정본은 이 문서이며, 두 문서가 충돌하면 해당 소유 영역의 정본이 우선한다.

**Argus는 판단하지 않는 친구다.** AI가 실행을 가져간 시대에, 중요한 결정을
답변으로 끝내지 않고 살아있는 항로로 만든다: 사용자가 자기 말로 내기를
봉인하면(seal), 시간이 흐르고, **약속한 날에 Argus가 먼저 돌아와**(return)
현실과 대조한다(settle). 그 기록 — AI VERDICT: NONE이 찍힌 판단 영수증 — 이
쌓여 사용자의 항적이 된다.

**단 하나의 루프** (이것이 제품의 전부다):

```
열기 ──▶ 봉인 ──▶ [살아있는 전제] ──▶ 기다림 ──▶ 귀환 ──▶ 정산 ──▶ 항적
(frame)  (bet+call)   (depth, 선택)    (알림이 관리)  (1차/2차)  (영수증)  (frequency)
```

**우정 5조항** (모든 표면의 심사 기준 — 부록 A §2):
① 네가 한 말을 그대로 기억한다 ② 약속한 날에 먼저 돌아온다 ③ 너를 평가하지
않는다 ④ 네 언어로 말한다 ⑤ 연결이 끊기면 끊겼다고 말한다.

**두 번의 첫인상** (부록 B §7): 봉인 카드를 받는 순간(지어졌다, 훌륭하다)과
몇 주 뒤 알림이 도착하는 순간(이 설계도의 심장, §4). 두 번째 인상만이
사용자를 만든다.

**판단의 자리** — 사람의 판단은 3점이다: 프레임(내가 진짜 묻는 게 이건가) ·
내기(분석이 확인 못 하는 내 믿음) · 콜(어느 쪽으로 가고, 뭘 보면 뒤집나).
구조 규칙은 **정박지 3, 관문 1**: 프레임·내기는 답하지 않아도 기계가
`ai_surfaced`로 정직하게 전진하는 정박지이고, 유일한 hard gate는 봉인이다
(사용자의 말 없이는 못 넘는다). 조각별 승인(워커 QA)은 판단이 아니다 —
어디에도 짓지 않는다. AI에게는 절대 fork(X vs Y)를 시키지 않는다 — 중립 crux
질문 하나가 상한이다. (부록 B §4의 5개 교정 전문)

## §2. 큰 그림 — 시스템 아키텍처

```
                        ┌─────────────── 하나의 뇌 (드리프트 가드로 고정) ───────────────┐
                        │  spine.ts (금지어휘·닫힌 next_actions·AI VERDICT null)          │
                        │  premises-core.ts (전제 모델·materiality·recheck cadence)       │
                        │  영수증 DNA (한 렌더 계약: 웹 JSX · MCP ASCII · 이메일 · OG)     │
                        └──────────────────────────────────────────────────────────────┘

  [집 A] MCP append-only ledger (.argus/)          [집 B] 웹 store (projects.decision_contract 등)
      │  터미널에서 봉인된 판단의 정본                    │  웹에서 봉인된 판단의 정본
      │  상태 변경은 여기서만 (seal/settle/amend)         │  상태 변경은 여기서만
      └───────────────┬───────────────────────────────┘
                      ▼
        [거울 버스] review_receipts (kind:'judgment' 미러) + 파생 행들
        미러 3의무: ①지어내지 않는다 ②출신을 밝힌다 ③깨지면 말한다 (부록 A §6)
                      │
                      ▼
        [알림 라우터] 기존 cron 6종(checkin-due·companion-brief·premise-watch·
        telegram-reminders·daily-report·expire-tokens)이 **하나의 발송 게이트**를
        공유 (§4.6) — 유형 판정·빈도 상한·음소거·침묵 규칙은 전부 결정론, LLM 없음
                      │
                      ▼
        [귀환 표면] 이메일(히어로) · 웹 항구 due-strip · 4-tap 귀환 화면
        (CheckpointReturnCard) · 1차 정산(FirstSettlementCard) · MCP check_in
        + ambient-due · statusline · Telegram 한 줄 · .ics(로컬 전용의 달력)
                      │
                      ▼  (정산은 집으로 되돌아 써진다)
        [계기판] /admin 퍼널: opened→sealed→returned→settled, 표면별(web/mcp/plugin)
```

**부위별 역할 선언:**
- **MCP = 포착의 문 + 당직의 자리.** 결정이 실제로 일어나는 AI 대화 안.
  회전 주기 하루의 당직 루프(§9)와 수일~수개월의 항해 루프가 여기서 만난다.
  스스로 깨어나지 못하므로(stdio) 알림은 "세션을 열었을 때"(check_in, ambient)
  와 .ics뿐 — 이 한계를 정직하게 말하고, 브리지가 그 너머를 담당한다.
- **웹앱 = 항구.** 살아있는 결정들이 기다리는 곳, 귀환이 도착하는 곳. 생성
  흐름은 항구에 결정을 공급하는 보조 장치다.
- **이메일 = 두 번째 첫인상의 기본 채널.** (§4.4)
- **브리지 = 혈관.** 포착과 귀환을 잇는다. 혈관의 결함 목록과 수정 명세는
  부록 A §4 (F1~F3) + 부록 B §2 (FC-1~6) — 공정 1이 전부 시공한다.

## §3. 줄기와 가지 — 무엇이 트렁크이고 무엇을 정리하나

**트렁크 (투자 대상은 이것뿐):** §1의 루프 7단계 + 그것을 나르는 4표면
(MCP·항구·이메일·브리지) + 계기판. 끝.

### 3.1 동결 — 존치하되 투자 0, 내비게이션에서 도구 서랍으로 강등 (공정 0)
- `/[locale]/boss` (MBTI+사주) · `/teams` · `/agents` — 스파인 밖의 구세대
  쇼케이스. 라우트 유지(링크 안 깨기), 헤더 내비에서 제거.
- `/tools/reframe|recast|rehearse|synthesize` 독립 도구 4종 — 이미 서랍에
  있음. 추가 커밋 금지 선언만.
- 랜딩 3D voyage/films — 방금 재작업됨. 유지, 추가 투자 금지.
- `argus-plugin-v2/` — 참고물 (창업자 브리프 지시). 이번 공개 범위 밖.

### 3.2 철거 — 확인 절차와 함께 삭제 (공정 0, 각각 grep→테스트→삭제)
- `internal design notes` tier/score의 **사용자 노출 지점** (렌더 확인 후 노출만
  제거, 내부 라우팅은 internal-only 주석+드리프트 테스트로 봉인).
- `/workspace`의 구세대 step 진입점 노출 (코드 삭제가 아니라 기본 화면에서
  제거 — 완전 철거는 준공 후 현실 데이터로 결정).
- 죽은 코드 후보 감사 목록: `WorkflowGraph`(legacy), `useSlackStore`,
  `RetroBadge`, 17개 store 중 소비자 없는 것 — **각각 grep으로 소비자 0 확인
  후에만 삭제.** 확인 안 되면 대기 목록으로.

### 3.3 문서 정리 (공정 0 — "중구난방 세션"의 구조적 종결)
- **정본 세트 7편만 docs/ 최상위에 남긴다**: `ARGUS-BLUEPRINT.md`(이것) ·
  KEYSTONE · checkpoints-v2 · clarify-v2 ·
  AGENT-ARCHITECTURE-FOUNDATIONAL · MCP-COMPLIANCE-AUDIT · ARGUS-REPO-MAP.
- 나머지 설계·전략 이력은 **공개 리포에 두지 않는다** — 리포 밖(백업)에 보관.
  코드/정본 문서가 이력을 참조할 땐 특정 파일명 대신 "내부 설계 노트"로 일반화한다
  (경쟁 노출·노이즈 축소).
- `CLAUDE.md`에 5줄 추가: *"빌드 정본은 docs/ARGUS-BLUEPRINT.md다. 세션 시작
  시 §6 공정표의 현재 공정을 확인하고 그 공정만 진행한다. 새 설계 문서 작성
  금지 — 아이디어는 BLUEPRINT §8 대기 목록에 추가한다."* ← 이 한 줄이
  세션들의 중구난방을 끊는 장치다.

## §4. 두 번째 인상의 설계 — 귀환·알림 시스템 (이 설계도의 심장)

> 창업자 질문에 대한 직답: **알림은 결과(정산일)만이 아니다.** 다섯 유형이
> 있고, 그중 둘(T2·T3)이 전제와 미결 질문이다. 아래에 유형·내용·형식·빈도를
> 전부 확정한다. 배관은 이미 있다(6 cron) — 없는 것은 헌법과 문안과 공예다.

### 4.1 알림의 헌법 (모든 유형·모든 채널에 적용)

**문법 — 모든 알림은 정확히 세 문장 구조다:**
1. **인용** — 사용자 자신의 말이 항상 첫 줄이다. ("그때 당신: '…'")
2. **사실** — 기계가 아는 것만, 출처와 함께. (날짜가 왔다 / 값이 3.5→4.0,
   출처 URL / 7일이 지났다)
3. **손잡이** — 행동 1개 + 탈출구 1개. ("30초 기록" + "아직 모르겠어요" /
   "다시 보기" + "그대로 두기")

**금지 (하나라도 어기면 그 알림은 스파인 위반):** 평결·점수·조언·재촉
("벌써 N일 지났어요!"·"놓치지 마세요") · 이모지 남발 · 긴박감 연출 · streak ·
"보고 싶어요"류 re-engagement · 기능 홍보.

**빈도 헌법:**
- 결정당: T1은 정산일에 1회, 무응답 시 14일 뒤 1회 더, 그 뒤 **영구 침묵**
  (T5 브리프에 한 줄로만 잔류). 재촉은 두 번째까지도 재촉이 아니어야 한다 —
  두 번째 문안은 "놓아주기" 손잡이를 앞세운다.
- 사용자당: 단독 메일 주 최대 2통. 넘치면 라우터가 T5 브리프로 병합한다.
- 모든 메일 하단: "이 결정 알림 끄기" (결정 단위 mute) + "알림 설정" 링크.
- 내용 없는 브리프는 발송하지 않는다 (빈 브리프 = 알림 시스템의 자기 홍보).

### 4.2 알림 유형 5종 — 트리거·내용·채널 확정

**T1 · 약속한 귀환** (check_by 도래 — 유일하게 사용자가 명시적으로 허락한 알림)
- 트리거: `next_check_by <= today` (checkin-due cron, 이미 있음)
- 채널: 이메일(기본) + Telegram(연결 시) + 웹 due-strip + MCP check_in/ambient
- 이메일 문안 (이대로 시공):
  ```
  제목: 당신이 적어둔 날이 왔어요 — "{human_judgment 또는 predicate 앞 40자}"

  {sealed_at_로컬날짜}, 당신은 이렇게 적었어요:

      "{human_judgment}"

  예측     "{predicate}"
  확인일   {check_by} — 오늘이에요.

  그래서, 어떻게 됐어요?

  [ 30초 안에 기록하기 ]   ← /{locale}/project?return={id} 딥링크

  아직 모르겠으면 그것도 답이에요 — 기록 화면의 '아직'이
  벌점 없이 다음 확인일을 정해줘요.

  ─ 이 결정 알림 끄기 · 알림 설정
  ```
- 제목이 곧 설계다: **사용자 자신의 문장을 제목으로.** 받은편지함에서 자기
  말을 만나는 순간이 두 번째 첫인상의 첫 프레임이다.

**T2 · 전제가 움직였다** (living premises — 창업자 질문의 직접 대상)
- 트리거: premise-watch cron(E5, 이미 있음 — Brave+Claude 리서치, 월 지출
  상한)이 **load-bearing 외부 전제**의 drift를 감지하고 materiality 규칙(M2,
  premises-core)이 "중대"로 판정했을 때만. 사소한 drift는 T5 브리프로 강등.
- 내용 규칙: 사실만+출처, 해석 금지, 그리고 반드시 **"다시 볼지는 당신의
  몫"** 문장으로 손잡이를 되돌린다. AI가 "재검토를 권한다"고 말하는 순간
  스파인 위반이다.
- 이메일 문안:
  ```
  제목: 전제가 하나 움직였어요 — "{premise 앞 40자}"

  "{decision_title}"을 봉인할 때, 이 결정은 이 전제 위에 서 있었어요:

      P{n}  "{premise_text}"        (봉인 당시 값: {baseline})

  오늘 확인된 값: {current}   (출처: {provenance}, {checked_at})

  전제가 움직였다는 사실만 전해요.
  결정을 다시 볼지는 당신의 몫이에요.

  [ 전제 살펴보기 ]   [ 그대로 두기 ]

  ─ 이 전제 알림 끄기 · 알림 설정
  ```
- MCP에서는: 세션 시작 check_in의 due_premises 라인(이미 있음) + recheck의
  drift surface(이미 있음). 신규 시공 없음 — 이메일 문안과 어휘만 통일.

**T3 · 미결 질문이 아직 열려 있다** (open_question 재고 — M3)
- 트리거: open_question의 재고 주기 도래 (§9.2 silence cap 반영, 이미 있음).
- **단독 메일 금지.** T5 브리프의 한 섹션 + check_in의 한 줄로만. 미결
  질문은 재촉하는 순간 숙제가 된다.
- 문안(브리프 내): `아직 열려 있는 질문 — "{question}" · 지금 답이 생겼다면
  적어두고, 아직이면 그대로 두세요. 이 질문 접기`

**T4 · 1차 정산 초대** (생각↔생각 — 결과 없이 닫는 첫 루프)
- 트리거: check_by가 21일 이상 남은 봉인의 **7일째** (한 번만).
- 목적: settle-latency 문제의 해법 절반 — **긴 결정에도 7일 안에 '돌아오는
  경험'을** (부록 B §5.3). 결과 채점이 아님을 문안이 명시한다.
- 문안:
  ```
  제목: 결과는 아직이에요 — 그때의 당신만 잠깐 볼래요?

  7일 전, 당신은 이렇게 적었어요:

      "{human_judgment}"

  결과를 채점하는 게 아니에요. 그때의 문장을 지금의 눈으로
  다시 읽어보는 것 — 그게 전부예요. (30초)

  [ 그대로예요 ]  [ 조금 바뀌었어요 ]  [ 모르겠어요 ]

  ─ 이런 초대 그만 받기
  ```
- 착지: FirstSettlementCard(이미 있음). 답은 `lean_after` 계열에 기록,
  절대 점수화하지 않는다.

**T5 · 주간 항해 브리프** (companion-brief cron, 이미 있음)
- 내용: 이번 주의 T1 잔여 + 강등된 T2 + T3 + 다가오는 확인일. **내용이
  없으면 침묵.** 항적 요약은 빈도 문장만("이번 달 정산 2건: held 1 ·
  missed 1"), 절대 추세 평가 없음.

### 4.3 반(反)유형 — 짓지 않는 알림 (대기 목록에도 넣지 않는다)
연속 기록(streak) · 주간 목표 · "다른 사용자들은…" 비교 · 미사용 재유인 ·
기능 출시 소식(별도 옵트인 뉴스레터가 아닌 한) · AI가 쓴 "이번 주 인사이트".
이유: 전부 우정 2조("먼저 돌아온다")를 engagement 조작으로 오염시키는 형태다.

### 4.4 채널별 형식 확정
- **이메일 = 히어로.** 영수증과 같은 원장 DNA(§4.5): 세리프 제목, 고정폭
  숫자, 얇은 괘선, 다크 대응. 버튼은 딱 하나. 이미지 없이도 완결(텍스트
  우선). 발신인 "Argus" (hello@argus.voyage, 검증됨).
- **웹 항구** = due-strip이 화면 주인공(공정 1에서 홈 승격과 함께).
- **MCP** = check_in(세션 시작 1회, 서버 instructions에 이미 규약) +
  ambient-due 한 줄(단일 소스 이미 있음) + **.ics 내보내기**(공정 2 신설:
  봉인 시 `.argus/calendar/{id}.ics` 생성, surface에 경로 한 줄 — 로컬
  전용 사용자의 T1을 사용자 자신의 달력이 대신 울려준다. 네트워크 0,
  의존성 0).
- **Telegram** = 한 줄 + 딥링크 (telegram-reminders cron, 이미 있음. 문안만
  §4.1 문법으로 통일).
- **푸시(모바일)** = 대기 목록. 지금은 짓지 않는다.

### 4.5 정산 화면 — 두 번째 인상의 본체 (공정 2의 공예 대상)
딥링크 착지에서 일어나는 일, 순서대로 (기존 CheckpointReturnCard를 이 사양으로
완성한다):
1. **그때의 말이 먼저** — 화면 상단에 봉인 카드가 그대로 다시 뜬다 (통계 X,
   내 문장 O).
2. **탭 4개** — [대체로 맞았다 held] [빗나갔다 missed] [섞여 있었다 partial]
   [아직 모르겠다 still_pending]. 저장 enum은 기존 PredicateVerdict 유지,
   이건 표시 레이어다 (checkpoints-v2 §7.2). '아직'은 벌점 없이 다음 확인일
   제안으로 이어지는 1급 경로.
3. **한 줄 (선택)** — "무슨 일이 있었어요?" 자유 입력, 전부 optional.
4. **영수증 완성의 순간** — 이 제품 인생 최고의 화면. WHAT HAPPENED 줄이
   영수증 카드에 그 자리에서 채워지고, `AI VERDICT ── NONE` 라인이 마지막에
   확정된다. 여기에 공예를 전부 건다 (부록 B §5.1 — 디자인 투자 순서의 반전).
5. **growth note (조건부)** — 방금 기록 1건만 인용, 성향 어휘 validator 차단,
   수정/삭제 가능 (checkpoints-v2 §10).
6. **다음 손잡이 하나** — "이 결정에서 갈라진 다음 결정이 있나요?" 또는
   침묵. 30초 계약: 필수 인터랙션 = 탭 1회. 테스트로 고정.

### 4.6 알림 라우터 — 신설하는 유일한 부품 (얇게)
새 알림 시스템을 만들지 않는다. 기존 cron 6종의 **발송 직전에 공유 게이트
함수 하나**를 끼운다 (`src/lib/notification-gate.ts`, 결정론·LLM 없음):
```
gate(user, candidate) → send | merge_into_brief | silence
  검사 순서: ①결정/전제 단위 mute ②유형별 규칙(T3 단독 금지 등)
  ③결정당 재알림 상한(T1 2회) ④사용자당 주간 단독 상한(2) ⑤빈 내용 억제
```
+ 발송 로그 행(어떤 유형을 왜 보냈/눌렀나) → 계기판의 returned 단계와 연결.
소비 계약 테스트: cron 6종 전부가 gate를 통과하는지 reflection 테스트로 고정
(gate를 우회하는 발송 경로가 생기면 CI가 빨갛게).

## §5. 연결 — MCP↔웹 혈관의 완성 사양

한 문단 요약 (상세는 부록 A·B — 공정 1이 시공):
①거울 버스 정화 — missed→unclear 훼손(FC-1)·지어낸 필드(F1)·강제 한국어(FC-2
브리지분) 제거, `kind:'judgment'` discriminator. ②침묵 제거 — 미러 실패는
surface 1줄(F3), sync의 next_actions는 local-settleable만 안내(F2). ③어휘
1벌 — provenance 값 사전 통일(FC-4). ④시간의 신뢰 — 기본 tz를 사용자 로컬로
(FC-3). ⑤온보딩 3걸음 — /import 한 화면(로그아웃 상태에서도 가치 설명,
FC-5): "터미널에서 봉인 → 정한 날 이메일이 먼저 옵니다 → 30초 기록". 브리지의
존재 이유를 사용자 언어로 말하면 정확히 이 세 걸음이다. ⑥여정 테스트 —
터미널 봉인→계정 행→cron 선택→이메일 페이로드→딥링크→정산→로컬 반영을 한
fixture로 CI에 (BS-5).

## §6. 공정표 — 다섯 공정, 준공까지

각 공정 = PR 여러 개, 그러나 **공정을 건너뛰는 PR은 금지.** 각 공정에 입주
조건(entry)·준공 검사(exit, 전부 기계 확인)·금지 목록이 있다. 예상 규모는
집중 작업 기준이며 절대 기한이 아니다 — 순서가 기한보다 중요하다.

> **MCP 재건축 트랙 (2026-07-08 신설):** MCP 표면의 공정은 §9의 M0~M4가
> 정본이다. 웹 공정 0~4와 병행 가능하되, M-트랙 안에서는 순서 고정.
> PR 첫 줄 규약은 동일하게 적용: `공정 M{n} · 겨냥 퍼널 단계 X→Y`.

**exit 체크 규약 (2026-07-08 추가 — 완료 선언 부풀림의 구조적 차단):**
`[ ]`→`[x]`는 공짜 행동이 아니다. 체크하는 커밋은 반드시 같은 커밋에서
`src/lib/__tests__/blueprint-exit-evidence.test.ts`의 EVIDENCE 맵에 그 항목의
증거 — 기계 증거(테스트/캡처 파일 경로) 또는 정직한 `manual:` 검증 기록 —
를 추가한다. 공정별 `[x]` 개수와 맵이 어긋나거나 증거 파일이 없으면 CI가
빨개진다. 그리고 **시공과 완료 판정을 분리한다**: exit 문구를 "무엇이 이걸
빨간불로 만드는가"로 읽고, 그 빨간불이 실제로 존재할 때만 체크한다 —
"토막 테스트 됨"을 "여정 됨"으로 올려 적지 않는다. (근거: 공정 3/4 완료
선언 감사에서 체크된 exit 2건 부분 미달·1건 무검증이 실증됨.)

### 공정 0 · 부지 정리 (S — 반나절~1일)
- 작업: §3.1 내비 강등 · §3.2 확인-후-철거 · §3.3 문서 아카이브 스윕 +
  CLAUDE.md 포인터 5줄 + Reality Gate 원칙(부록 C Phase 5 문안) · 계기판
  완성(returned 단계 + 표면별 분해, 부록 C Phase 0).
- exit: [x] docs/ 최상위 정본 8편 [x] CLAUDE.md에 BLUEPRINT 포인터
  [x] /admin에 표면별 4단 퍼널 [x] 내비에 항구·워크스페이스·설정만
- 금지: 이 공정에서 기능 코드 수정 금지 (문서·내비·계측만).

### 공정 1 · 혈관과 배관 (M — 3~5일) = KEYSTONE Wave 1 전체
- 작업: FC-1(missed 매핑+드리프트 테스트) · FC-2(영수증 로케일 — receipt
  렌더러를 locale brain에) · FC-3(기본 tz=시스템 로컬) · FC-4(provenance
  어휘 1벌) · FC-5(/import 3걸음 화면) · FC-6(잔결함 6종) · F1~F3(브리지
  정화·sync 분기·미러 실패 surface) · 항구 홈 승격(부록 C Phase 1) ·
  T1 이메일 딥링크(§4.2 문안으로) · BS-5 여정 테스트 · npm 위생+되돌림 계획.
- exit: [x] 여정 fixture CI 초록 [x] ko 영수증 전문 한국어 스크린샷
  [x] missed가 웹에서 missed로 (SQL 대조) [x] 만료 토큰 seal의 surface에
  실패 1줄 [x] 이메일 CTA 1클릭=해당 결정 4-tap (실메일 캡처)
- 금지: 새 기능. 이 공정은 전부 "이미 약속한 것을 지키게 만드는" 수리다.
- **공정 1 완료 = MCP 공개 가능 상태.** (공개 시점 자체는 창업자 판단)

### 공정 2 · 두 번째 인상 (M — 4~6일) = 이 설계도의 심장 시공
- 작업: §4.1 헌법을 notification-gate.ts로 · T1 문안 시공 · T4 1차 정산
  초대(트리거+문안+FirstSettlementCard 착지) · §4.5 정산 화면 공예(영수증
  완성 모먼트 포함) · .ics 내보내기 · Telegram 문안 통일 · 이메일 원장 DNA
  템플릿 (email-html.ts).
- exit: [x] gate reflection 테스트(6 cron 전부 통과) [x] 30초 계약 테스트
  [x] 신규 사용자 fixture의 첫 귀환 ≤ 7일 (T1 또는 T4) [x] 빈 브리프 0건
  테스트 [x] 정산 화면 Playwright 스냅샷(라이트/다크)
- 금지: 새 알림 유형 추가 (5종이 상한), LLM이 알림 여부를 판단하는 코드.

### 공정 3 · 살아있는 전제 (M — 3~4일)
- 작업: T2 문안 시공 + materiality 판정과 이메일/브리프 강등 라우팅 ·
  T3의 브리프 편입 · premise-watch의 지출 상한/빈도 확인 · PremiseTracker
  화면에서 "봉인 당시 값 vs 지금 값 + 출처" 대조 뷰 완성 · MCP recheck
  어휘와 웹 문안 통일.
- exit: [x] 전제 드리프트 fixture: 감지→gate→이메일 페이로드→전제 화면
  딥링크 여정 테스트 [x] 해석 어휘 validator (알림 문안에 권고/평가 표현이
  들어가면 테스트 실패)
- 금지: 구조화 API·페이지 변경감지 등 v2 감지 인프라 (대기 목록).

### 공정 4 · 자산화 (M — 3~4일)
- 작업: 영수증 공유 페이지(/d 인프라 재사용, opt-in) + OG 이미지(원장 DNA,
  `AI VERDICT ── NONE`이 구도의 중심) · 랜딩에 실물 영수증 1장 · settle-latency
  온보딩(데모 시나리오를 "중대하되 신호가 빠른 결정"으로 교체, MCP init/seal
  안내 한 줄) · 웹 voice 전수 정리(부록 A §7 Q6 후반).
- exit: [x] 공유 링크 OG 카드 렌더 캡처 [x] 기본 비공개 테스트
  [x] 데모 시나리오 전부 확인일 ≤ 7일
- 금지: 게이미피케이션 일체 (뱃지·마일스톤·축하 팡파레).

### 공정 5 · 첫인상 수리 — 묶기 흐름의 UX 기본기 (M — 2026-07-08 신설)
**배경 (설계 오류의 인정):** §3.1의 "생성 흐름 투자 0" 선언은 "봉인까지의
첫인상은 이미 훌륭하다"(§1 두 번의 첫인상)는 **미검증 가정** 위에 있었고,
창업자 실사용(2026-07-08, 묶기 흐름 스크린샷 5장)이 반증했다. 생성 흐름 중
**본선(progressive 묶기·듣기·당기)의 기본기 결함**은 동결 대상이 아니라
트렁크 수리로 재분류한다 — 봉인이 유일한 hard gate인 이상, 봉인까지
데려가는 표면이 어수선하면 루프 전체가 시작되지 않는다.
- 작업 (창업자 지시 7건):
  1. 확인일 옵션에 **1일** 추가 — 웹 BindCard + 타입 + MCP seal.
  2. 묶기 화면에서 **사용자 고민 인용의 시각 위계 승격** (지금 너무 작음).
  3. **Seal 직후 화면 정보구조 재설계**: 'AI가 채운 전제'·'우리가 잡은
     항로'·질문·항해지도가 설명 없이 동시 등장 → 각 블록의 정체·서로의
     연결·"왜 질문에 답하는가"가 첫눈에 읽히게 (front-load 해체, progressive
     감사 Tier1의 미이행분).
  4. **'우리가 잡은 항로' 기본 접힘**: 핵심 문장 + '알아둘 것' 요약만 기본,
     5단계 전문은 펼치기 — 질문 답변 후 전문이 전부 펼쳐지는 현상 제거.
  5. **항해지도 레일 텍스트 다이어트**: 노드는 한 줄, 세부는 펼침 —
     갈림길 확인·되돌아가기 기능이 텍스트에 묻히지 않게.
  6. **하단 잔류 배너 3종 정리**: '중단된 작업이 있어요'·'선원들이 일하고
     있어요'·'당신의 질문이 바뀌었습니다' — 어정쩡한 하단 부착 제거/정위치.
  7. **'오래 걸리고 있어요' 배너 뒤 밝은 배경 박스 잔재 제거** — 코드 vs
     production 대조 포함 (제거했다는 이전 선언의 검증).
  8. **3단계 레일(묶기·듣기·닿기)의 기능화** — ① 배 컴포넌트가 단계 따라
     항해·정박 (2026-07-08 시공: VoyagePhaseRail 바닷길) ② 완료 단계 클릭 시
     해당 산출물로 회항 (엔진의 단계 상태 열람 지원 필요 — 은유 라벨만으로는
     방향감이 안 서고, 클릭이 안 되는 스테퍼는 장식이라는 창업자 지적).
  9. **초안 생성 중 화면 + 초안 결과 화면 재검토** — 당기 단계의 대기·결과
     표면을 같은 30초 룰로 점검·수리.
  10. **듣기 단계 피드백 카드(의사결정권자의 검토) 재설계** — 인용·잘한 점·
     이것만 고치면·통과 조건의 위계와 밀도 재구성 (창업자: "토나와" 수준).
- 구현·검증 기록: [`IMPLEMENTATION-REPORT-JUDGMENT-JOURNEY-2026-07-25.md`](IMPLEMENTATION-REPORT-JUDGMENT-JOURNEY-2026-07-25.md)
  — PR #290에서 시공한 기준점→검토→최종 판단→귀환→정산, attribution,
  중단 복구와 운영 검증을 기록한다. 이 보고서는 설계 정본이 아니며, 아래 exit
  체크를 대신하지 않는다. 히어로 `Decision record`의 시각적 미완성도 함께
  명시한다.
- 회귀 수리 (2026-07-28): PR #290이 항구 카드의 "검토 전 기준점" 화면을
  `closed_at` 부재로 판정했으나 그 스탬프는 SealMoment 닫는 봉인 **한 경로만**
  찍는 의식 표식이었다 — 회고 봉인·항구 카드 자체 봉인·텔레그램·필드 도입 이전
  기록이 전부 "미완성 기준점"으로 강등되고 **정산 경로를 잃었다**(삭제 버튼과
  함께). 수리: 생애주기 판정을 `contractPhase`(baseline·sealed·settled) 단일
  정본으로 옮기고, 확인일이 온 기준점도 루프를 닫을 수 있게 했다. 같은 PR에서
  집계 비대칭(AI 제안 항목의 **나쁜 결과만** 어느 칸에도 안 잡히던 것)과
  MCP↔웹 다리의 출처 유실(`predicate_owner` 미전달)을 함께 고쳤다.
- exit: [ ] 같은 시나리오 재실사에서 7건 육안 확인 (창업자 또는 Playwright
  캡처 3화면: seal 직전·직후·질문 답변 후) [ ] seal 직후 화면의 각 블록
  정체가 라벨 한 줄로 읽힘 (30초 룰) [ ] 항로 카드 기본 상태 = 접힘 (테스트)
- 금지: 생성 흐름 신규 기능 (수리만). 3-질문 구조 자체의 재설계 (대기 목록).

### 준공 검사 (전체 완료의 정의)
KEYSTONE §10의 봉인 그대로: **공개 후 30일 안에 외부인 1명이 봉인→귀환
알림→정산을 외부 개입 없이 완주하고 계기판에 남는다** + 보조 예측: **신규
사용자 첫 귀환 중앙값 ≤ 7일.** 빗나가면 다음 작업은 코드가 아니라 완주 실패
지점의 사용자 5명과의 대화다.

## §7. 건축 현장 규칙 — 세션 운영 규약

1. **한 세션 = 한 공정의 방 하나.** 세션 시작: BLUEPRINT §6에서 현재 공정
   확인 → 그 공정의 미완 항목 하나를 고른다 → 완료하고 exit 체크박스를
   커밋으로 갱신한다.
2. **PR 첫 줄 규약**: `공정 N · 겨냥 퍼널 단계 X→Y`.
3. **새 아이디어 = §8 한 줄 추가**, 코드 0줄. (아이디어를 죽이는 게 아니라
   순서를 지키는 것이다 — 준공 후 현실 데이터가 대기 목록의 우선순위를 정한다.)
4. **설계 문서 신설 금지.** 시공 중 설계 결정이 필요하면: 부록 A §7·부록 B
   §4의 결정된 질문들 → 없으면 이 문서 §8에 질문을 적고 창업자에게 묻는다.
   단, 창업자가 독립 병렬 트랙과 무접촉 경계를 승인해 이 문서에 등록한 **단일
   정본 문서**는 예외다. 예외 등록은 사용자 표면 개방 허가가 아니다.
5. **현실 접촉 후 행수 확인** (CLAUDE.md Persistence Declaration 3항)은 모든
   공정의 exit에 암묵 포함이다.

## §8. 대기 목록 — 여기 적고, 짓지 않는다

- boss 무설정 × 파이프라인 체인 긴장 확정: config에 boss 블록이 없는 채로
  review 체인이 boss 단계에 도달하면 "일반 리뷰 제안" AskUserQuestion과
  체인-중-질문-금지 규칙이 충돌한다 — auto-create 기본 boss 덕에 희귀 경로.
  체인 중엔 무질문 generic-seat 진행으로 못박는 한 줄 수리 대기 (O3 방4 검수
  발견, 2026-07-18)
- Streamable HTTP + OAuth 원격 전송 (창업자 결정 대기)
- 에이전트 아키텍처 F1~F4 재설계 트랙 (설계 완료 상태로 대기 — 웹 생성 흐름의
  프레임·내기·콜 이관과 함께 준공 후 1순위 후보)
- judgment_receipts 테이블 분리 (현실 데이터가 요구할 때)
- 모바일 푸시 · 구조화 API 전제 감지(금리·환율) · 페이지 변경감지
- premises `apply_to_matching` 홍보 (기능 존치, 문서 후순위)
- 전제 알림 피드백 루프: 사용자의 "알림 받을 만함/너무 사소함/브리프로만/더
  민감하게" 반응을 전제별 materiality·confidence·cadence·채널 기준에 반영
- 전제 알림 강한 E2E: fixture를 넘어 실제 웹 검색/모델 조사/출처 검증/알림
  payload까지 잇는 네트워크 포함 테스트 하네스
- `/workspace` 구세대 코드 완전 철거 (준공 후, 사용 데이터로)
- 17 Zustand store 통폐합 · WorkflowGraph 등 죽은 코드 대청소 (감사 후)
- ~~BS-1(기기 간 id 충돌)·BS-2(토큰 오배송)~~ → **공정 M3로 승격** (2026-07-08,
  §9 — 코드 감사로 무방비 실증: 계정 row가 `mcp_<slug>`, 기기 네임스페이스 없음)
- 팀/조직 기능 · i18n 제3언어 · 뱃지류 일체 (반유형 §4.3과 함께 영구 보류)
- 당직 앵커의 통계/추세 뷰 일체 (앵커는 내기가 아니다 — §9 판정 3. 영구 보류에
  가깝게 취급)
- MCP 원장 스냅샷/컴팩션 (수천 이벤트 시 replay 지연 — 현실 데이터가 요구할 때)
- argus_review의 당직 루프 편입 (문서 리뷰→capture 자동 제안 — M1 준공 후 검토)
- **[O4 관문 뒤에만 인출 — §9.7]** Codex plugin v1 (`.codex-plugin` + 같은 MCP 자동
  배선 + 3 skills + 당직 미러)
- **[O4 관문 뒤]** MCPB Desktop 번들 (한 파일 설치 + `user_config` 폴더 선택기 —
  Desktop 첫설치 블로커의 공인 해법; 로컬-우선 제품의 sanctioned 배포 형태)
- **[O4 관문 뒤]** MCP Apps 위젯 — 상한 2종: 영수증 then-vs-now display · due 인박스
  picker (게이미피케이션·verdict 금지는 위젯에도 그대로; 미지원 호스트는 텍스트 강등)
- **[O4 관문 뒤]** `npx argus install` 범용 설치기 (host 감지·명시 선택·
  doctor/update/uninstall, managed block + dry-run + idempotent)
- TUI due-inbox — 위젯 2종이 같은 일자리를 더 싸게 대체하므로 보류; 터미널-네이티브
  수요가 실측될 때만 재개 (PTY/CJK/resize 전장을 열지 않는다)
- v2 미러 catch-up: 프로젝트 v1의 미미러 라인을 멱등 키로 재미러 (플러그인
  쓰기 포함 v2 완전성 확보) — 구현·검증 후에만 v2를 read-canonical로 승격
  (O2 방4의 2겹 정본 선언 참조; 그 전까지 v2 소비자는 프로젝트 v1과 union)

---

## §9. MCP 재건축 — 당직과 항해, 두 궤도 설계도 (2026-07-08 신설)

> 창업자 판정: "사실상 집을 다시 설계하고 짓는 과정." 이 절이 MCP 표면의
> 정본 설계도다. 새 문서를 만들지 않고 여기에 통합한다 — 정본은 하나다.
>
> **정본 앵커 (2026-07-11 착공, 창업자 지시):** MCP 재건축의 시공 정본은
> `docs/ARGUS-MCP-V2-SPEC.md`다 — 공정은 그 문서의 P-1~P6 · Release Gate를
> 따르며, 이 절의 M0~M4와 충돌 시 스펙이 이긴다. §9.2 스파인 판정 4건은
> 스펙 아래에서도 계속 헌법이다.

### 9.0 왜 다시 짓나 — 진단의 한 문단

소개글(0707)이 파는 것은 세 운동 루틴이다: **①봉인하기**(세션 시작, 오늘의
가설·전제·성공기준) · **②드러내기**(작업 중, 삼킨 주장·미검증 전제·유보
질문을 밖으로) · **③돌아보기**(전제·현실 변화 시 재판단). 3중 감사(2026-07-08,
4+2 에이전트 + stdio 직접 완주) 실증: 현 MCP는 **③만** 지었다. ①은 절제
게이트가 세션 가설(저위험·가역)을 구조적으로 거부하고(`overfire-gate.ts:48-54`),
②는 서버 instructions에 작업 중 안무가 0줄이며 전제 기록이 결정 id 뒤에
게이트되어 결정 없이 메모 하나 못 남긴다(`premises.ts:125`). ①②는 플러그인
훅 4종(anchor/keel/wake/recall-signal)에 이미 지어져 있다 — MCP가 본진이라는
결정의 **이관 부채**다. 부수 실증: npm엔 1.0.0만 존재(공정 2 개선 미도달),
Desktop은 README 설정 그대로가 전 도구 실패, 영수증 렌더러는 locale 인자
자체가 없고(`render-receipt.ts:21`), 이메일 CTA는 100% 웹으로만, MCP 전제는
동기화되지 않아 자율 감시(T2)가 터미널 전제에는 영영 안 닿는다.

**결론이자 §1 루프의 확장:** 기존 루프(항해)는 옳지만 회전 주기가 수일~수개월
이라 "매일 만질 이유"가 구조적으로 없다. 소개글의 ①②는 회전 주기 하루의
두 번째 궤도를 요구한다.

### 9.1 두 궤도 — 여정 정본

```
당직 루프 (하루 — 습관을 만든다. 게이트 없음, 판정 없음, 영수증 없음)
┌──────────────────────────────────────────────────────────────┐
│ 당직 시작: 오늘의 항로     당직 중: 표류물 기록      다음 당직: 미러  │
│ "오늘 여기까지 간다,       삼킨 주장·전제·미결 질문   "어제 당신:      │
│  나는 X라고 본다"     ──▶  을 한 손짓으로 capture ──▶ '…' — 그래서   │
│ (anchor, 30초)            (침묵-기본)                어떻게 됐어요?" │
└───────────────────────────────┬──────────────────────────────┘
                                │ 하중 실린 전제·반복 가설만 사용자가 승격
                                ▼
항해 루프 (수일~수개월 — 자산을 만든다. §1의 루프 그대로)
  열기 ─▶ 봉인 ─▶ [살아있는 전제] ─▶ 기다림 ─▶ 귀환 ─▶ 정산 ─▶ 항적
```

사용자 시간으로: 아침 check_in이 어제 앵커를 한 줄 미러하고 오늘의 앵커를
받는다(30초). 작업 중 "이거 전제로 남겨" 한 마디로 capture(흐름 절단 없음).
같은 전제가 반복 등장하면 check_in이 **사실만** 보고하고("이 전제가 3개 기록에
걸쳐 있어요") 승격은 사용자가 한다 — 그때부터 기존 항해 루프다. **당직이
습관을, 항해가 자산(영수증·항적=해자)을 만든다.** 웹 BindCard("듣기 전에 내
기울기 먼저")가 이미 이 사상이다 — 새 철학이 아니라 터미널 이식이다.

### 9.2 스파인 판정 4건 (이 절의 헌법 — 어기면 스파인 위반)

1. **당직 앵커는 절제 게이트 관할 밖이다.** 게이트의 존재 이유는 "개입 여부를
   사용자 대신 판단하지 말라"인데, 앵커는 개입이 아니라 사용자가 자청한
   기록이다. 단, 앵커에 대한 모델의 피드백·평가·개선 제안은 전면 금지 —
   기록과 다음날 미러만 존재한다.
2. **capture는 침묵-기본이다.** 주도권은 사용자 호출. 모델의 자발 개입은
   keel-급 조건(무근거 주장이 **비가역 작업**에 닿는 순간)에만 허용 — 플러그인
   keel-signal이 실증한 절제 그대로. "관찰은 넓게, 발화는 좁게." 작업마다
   "이거 기록할까요?"를 묻는 것은 flat case 세리머니 = over-fire 재도입이다.
3. **앵커는 내기가 아니다.** predicate 아님, 정산 없음, track record·항적
   불산입, 달성률·streak·추세 뷰 영구 금지. 미러는 알림 헌법 §4.1의 세 문장
   문법(인용→사실→손잡이)을 따르는 질문이며 평가가 아니다.
4. **전제 프라이버시 기본값은 유지한다.** 전제 동기화는 명시적 opt-in으로만
   열고(M3), 열지 않은 사용자에게는 "터미널 전제는 세션 안에서만 확인된다"를
   README·surface가 정직하게 말한다. 조용한 업로드는 스파인 위반.

### 9.3 보이는 것 — 표면 사양

- **`argus_watch` 도구 1개 신설** (도구 수 절제 — op 패턴): `op:'anchor'`
  (오늘의 항로 한 문장 + 선택적 lean), `op:'capture'`(kind: claim|premise|
  question, text, provenance — 필드 최소, ai_surfaced면 ai_original 포함),
  `op:'list'`(오늘/어제 조회). 결정 id 불요, 게이트 불요.
- **check_in 확장**: 응답 서두에 어제 앵커 미러 1줄(있을 때만, §4.1 문법).
  기존 due 보고와 동거 — 새 표면 아님.
- **미결함 승격 경로**: `argus_premises op=add`가 `from_capture` 참조를 받아
  capture를 결정의 전제로 승격(원본 capture는 원장에 그대로 — 이동이 아니라
  참조). `argus_open_decision`도 관련 capture id들을 받을 수 있다.
- **영수증 한국어**: `renderReceipt`를 SURFACES locale 사전에 편입(수리,
  M0). check_in의 언어는 config locale이 있으면 항상 그것을 따른다(텍스트
  없는 호출에서 환경으로 튀는 현상 제거).
- **README 재포지셔닝**(M1): 소개글의 세 루틴이 README 첫 화면 구조가 된다 —
  "The loop" 표 위에 당직/항해 두 궤도. 카피는 소개글과 같은 어휘(landing-films
  정책과 동일하게 KO는 순화 유지).
- **배포 스니펫**(M1): `argus-mcp/snippets/`에 Claude Code용 hooks 조각과
  CLAUDE.md 블록(세션 시작 check_in·keel-급 capture 조건) — stdio 서버가
  SessionStart/PreToolUse 표면이 없다는 한계의 정직한 해법. `argus_init`이
  경로를 한 줄 안내(강요 없음).

### 9.4 보이지 않는 것 — 배관 사양

- **원장 이벤트 2종 신설**: `anchor`·`capture` (결정 상태 기계 밖, fold에서
  당직 뷰로만 접힘). 구버전 replay는 `skipped_unknown`으로 안전 통과 —
  하위호환 확인 테스트 포함.
- **첫 설치의 문**(M0): argus_dir 미해석 `${...}` 감지 시 전용 에러(호스트가
  변수를 확장 안 했다고 말한다) + 미설정 시 `~/.argus` 기본값 + README에
  Desktop 절대경로 예시·Windows `cmd /c` 블록·tz 문구 정정(코드는 시스템
  로컬 기본 — README가 거짓말 중).
- **귀환 봉합**(M0/M2): Companion Brief에 터미널 복귀 명령 1줄(M0, 웹 시공).
  `argus_sync`에 웹 정산 로컬 반영 op(M2) — 현행 flag-only는 영구 발산.
  fleet check_in(M2): `.bound` 목록(이미 존재, 소비자 0)을 실제로 읽어
  프로젝트 횡단 due 한 화면.
- **두 기기 안전**(M3): 계정 push id를 `mcp_<install8>_<slug>`로 네임스페이스
  (BS-1), 원장 append에 lockfile(동시 세션 이중 정산 차단), 전제 opt-in
  sync(켜면 T2 감시가 터미널 전제도 커버).
- **경계 수리 소묶음**(M0): check_in due 상한+`due_truncated` · `reponder_
  cadence_days` 오탈자 alias 수용 · sync 실패 reason 인간화. restraint 응답의
  "그래도 기록하고 싶으면 argus_watch(앵커)로" 출구 한 줄은 도구가 생기는
  **M1과 함께** 시공한다(절벽 제거 — 게이트 판정은 유지하되 출구를 준다).

### 9.5 공정표 M — 다섯 공정

**공정 M0 · 문과 언어 (S~M — 사흘 안)**
- 작업: §9.4 첫 설치의 문 + 경계 수리 소묶음 + 영수증/locale 수리(§9.3) +
  Companion Brief 터미널 1줄(웹) + npm 1.1.0 publish 준비(lockstep 태그 포함
  — publish 실행은 창업자).
- exit: [x] 무설정 첫 도구 호출이 ~/.argus로 성공하는 fixture [x] 미확장
  `${...}`에 전용 에러 [x] ko 여정 fixture의 receipt_text 전문 한국어
  [x] check_in due가 상한을 넘지 않는 테스트 [x] 이메일 페이로드에 터미널
  명령 문자열 존재 테스트
- 금지: 새 도구·새 이벤트(그건 M1). 이 공정은 전부 수리다.

**공정 M1 · 당직 루프 (M — 3~5일)**
- 작업: `argus_watch`(anchor/capture/list) + 원장 이벤트 2종 + check_in 미러 +
  SERVER_INSTRUCTIONS 안무(§9.2 원칙 명문화) + snippets/ + README 두 궤도
  재포지셔닝 + 어휘 validator의 스캔 범위에 argus-mcp surfaces 편입(공정 3
  누락분 상환).
- exit: [x] 당직 여정 fixture(anchor→capture→다음 세션 미러) [ ] over-fire
  eval: 플랫 작업 시나리오에서 모델 자발 capture 제안 0건 (모델 실행 필요 —
  결정론 절반인 instructions 가드만 테스트로 고정됨, eval 실행 후 체크)
  [x] 앵커 비산입 테스트(track record에 앵커가 안 섞임) [x] validator가 MCP
  recheck 문안 커버
- 금지: 앵커 통계·달성률 일체(§9.2-3). capture 자동 분류/요약(LLM이 기록을
  다듬는 것 — 사용자의 말 그대로).

**공정 M2 · 승격과 다리 (M — 2~4일)**
- 작업: from_capture 승격 경로 + sync 웹 정산 로컬 반영 + fleet check_in +
  이메일↔터미널 왕복 여정 fixture.
- exit: [x] capture→봉인→정산 승격 여정 fixture [x] 웹 정산 후 로컬 원장
  발산 0 테스트 [x] 두 프로젝트 due가 한 check_in에 잡히는 fixture
- 금지: 승격 자동화(추천·자동 봉인 — 승격은 언제나 사용자의 동사다).

**공정 M3 · 전제 개통 + 두 기기 안전 (M — 2~4일)**
- 작업: §9.4 두 기기 안전 3종 + opt-in 전제 sync 시 T2 여정(웹 premise-watch
  연동) 또는 opt-out 유지 시 한계 고지 문안.
- exit: [x] 두 기기 같은 slug fixture에서 계정 row 충돌 0 [x] 동시 이중
  settle이 한 건만 기록되는 테스트 [x] (opt-in 시) 터미널 전제 드리프트가
  T2 게이트에 도달하는 fixture
- 금지: 전제 자동 업로드(§9.2-4).

**공정 M4 · 재공개 (S~M)**
- 작업: 버전 lockstep publish + /import에 OS별 설치(Windows `cmd /c` 포함,
  웹 시공) + 소개글↔README 카피 정합 + 외부인 검사 준비.
- exit: [ ] npm 최신 버전 == package.json == 태그 (publish는 창업자 행동 —
  실행 후 체크) [x] /import에 Windows 블록 렌더 테스트 [ ] 신규 사용자 1명이
  설치→당직 앵커→봉인→(모의)귀환을 외부 개입 없이 완주(manual: 검증 기록)
- 금지: 새 기능. 공개는 지은 것을 도달시키는 공정이다.

**exit 체크 규약은 §6과 동일** — `[x]`는 같은 커밋에서
`blueprint-exit-evidence.test.ts` EVIDENCE 맵 갱신과 함께만.

### 9.6 이 절의 봉인 (예측 — 빗나가면 §6 준공 검사와 같은 절차)

> **예측:** M0~M2 준공 시점의 신규 MCP 사용자 코호트에서 "설치 후 7일 내
> 서로 다른 날짜의 argus 도구 호출 ≥ 3일"(당직 정착의 대리 지표)이 처음으로
> 측정 가능한 값으로 찍힌다. 그리고 당직 사용자의 첫 봉인 전환율이 비당직
> 사용자보다 높다.
> **확인일: M2 준공 + 14일.**
> **빗나가면:** 당직 루프의 존재가 아니라 아침 미러의 문안(첫 줄이 어제의 내
> 말인가)을 먼저 의심하고, 그다음 스니펫 설치율(호스트가 check_in을 실제로
> 부르는가)을 본다.
>
> AI VERDICT ON THIS TRACK ································· NONE

### 9.7 전면 개편 위계 O0~O5 — 수렴과 확장의 관문 (2026-07-16 신설, 창업자 승인)

> 입력 문서 3편(내부 설계 노트 — 비공개 백업)이 독립적으로 같은 결론에
> 수렴했다. **이 절이 그 수렴의 정본이다. 같은 진단을 반복하는 새 감사·평가·
> 계획 문서는 새 정보가 있을 때만 짓는다.**
> 우선순위: §9.2 스파인 판정(헌법) > 이 위계 > V2-SPEC 시공 상세. §9.5의
> M0~M4는 이 위계 이전 단계로 유효하며 잔여는 M4 두 건(publish·외부인 완주).
> 명명 주의: DKK "P5 가치 관문"과의 충돌을 피해 이 위계는 O(Overhaul)를 쓴다.

**한 줄 원리: 아키텍처 수술은 마찰 수리의 수단으로 지금(O1~O2), 시장 확장은
실사용 증거 관문(O4) 뒤(O5). 헌법은 어느 공정에서도 변하지 않는다.**

**Product contract (4표면 공통 — 웹·MCP·플러그인·설치 문구가 같은 문장을 쓴다):**

> Argus는 결정을 대신 내리지 않는다. 당신의 판단을 그대로 기록하고, 예측을
> 봉인하고, 확인일에 현실과 대조한다. 평결·추천·점수는 어떤 표면에도 없다.

- 외부 어휘 = plain canon (predict/resolve/check/history). 항해어는 브랜드 장식과
  내부 artifact로만.
- locale은 대화-언어 우선. 설정과 대화 언어가 어긋나면 1회 확인 후 갱신 — 감지
  1회 영구 고착 금지 (2026-06-15 P5 테스트가 실 config에 `locale: en`을 오염시킨
  사건이 회귀 fixture의 근거).
- 상호작용은 elicitation-first + capability probe + 텍스트 fallback. **crux는
  어떤 층(텍스트/elicitation/위젯)에서도 선택지가 되지 않는다.**
- Boss 리뷰는 MBTI 성격극이 아니라 역할·목표·권한 기반 이해관계자 리뷰로 (O3).

**공정 O0 · 헌법 동결 (완료 = 이 절의 커밋)**

**공정 O1 · 루프의 구조 수리 — 방 5개, 각 방 = 증상 + 원인 수술 (M~L)**
- 방1 시간·언어 결정화: 환경 해석기 1벌(clock/locale/tz, 주입식 — MCP·플러그인
  공용 소비, 감지기 2벌 해소) + Intl 테스트 격리(잔여 red) + **테스트·평가의
  ARGUS_DIR 격리 강제**.
- 방2 귀환 계약: attention projection 1벌 — `argus://attention` resource가
  tools와 같은 zero-config 저장 모델을 보게 (현재 `ARGUS_DIR` 미설정 시 unbound).
- 방3 첫 영수증 보상: then-vs-now 한 화면이 structured-숨김 호스트에서도 보이게.
- 방4 봉인 1탭: Keep/Reword/Skip elicitation (OOB picker 실증 #163 위에).
- 방5 게이트 전진: 신뢰 게이트를 Stop-hook 사후 경고 → 렌더 전 결정론 검증으로.
- exit: [x] 설치→봉인→재시작→귀환→정산 여정 fixture가 ko/en·Windows에서 초록
  [x] 릴리스 스위트 결정적(로케일·시계·홈 독립) [x] 대화-언어 불일치 1회 확인
  fixture
- **O1 exit부터 실사용 코호트 가동 (O4 데이터 수집 시작 — 코드보다 사용이 주역).**

**공정 O2 · 두뇌 수렴 (M)**
- decision-ledger.js 내장: 정본 writer의 규율(락·torn-heal·O_APPEND·fsync·
  v/ts 스탬프)을 **자기완결 이식 + 쓰기 규율 계약으로 기계 고정** (Option A
  2단계 — 스킬 prose 불변). 런타임 위임(CLI→MCP subprocess)은 **기각**: zero-dep
  마켓플레이스 산출물이 콜드 npx/오프라인에서 봉인 실패하게 되고, 폴백 로컬
  writer를 두면 쓰기 경로가 다시 2개가 된다 (방3 PR 기록).
- Core 경계 추출(거동 불변) + CI 경계 게이트(core↛어댑터, 플러그인↛writer,
  렌더러↛전이).
- 저장 정본 선언 (방4에서 현실 대조 후 2겹으로 확정): **쓰기 정본 = 공유
  프로젝트 v1 파일**(.argus/ledger/ledger.jsonl — 두 writer 공용, MCP 도구
  읽기도 여기). **v2 durable(~/.argus/projects/)은 파생 내구 projection** —
  MCP 호출 안에서만 배치-멱등 미러되므로 플러그인 쓰기가 누락될 수 있고,
  따라서 v2 소비자는 프로젝트 v1과 **union으로 접어야 한다**(statusline이
  이 규칙의 첫 소비자 — 바인딩 repo에서 플러그인 봉인이 사라지던 드리프트
  6호 수리). v2의 read-canonical 승격은 미러 catch-up 구현 후에만 (§8 대기).
  v3는 P5 HOLD ADR대로 동결.
- exit: [x] canonical append: argus-mcp 안 단독(O_APPEND census 게이트) +
  플러그인 writer는 동일 규율 이식·쓰기 규율 계약(스탬프/torn-heal/동시성)으로
  고정 [x] 같은 이벤트 fixture → 플러그인/MCP/statusline 동일 해석

**공정 O3 · 포장 통합 (M)**
- driver + plugin-v2 → 사용자에게 하나의 `Argus` (기본 = 조용한 driver 거동,
  deep review는 `/argus:review`만 — auto-trigger는 CI 빨강). (방1 준공
  2026-07-17: argus 플러그인이 .mcp.json 자동 배선·조용한 훅 2개(session-start·
  ambient-nudge)·doctor를 흡수, marketplace 항목 정확히 1개 + driver 디렉토리
  소멸을 one-install.test.ts가 고정. statusline은 정본 단일 사본이 되어 바이트
  대조 가드는 존재 이유와 함께 은퇴. SessionStart due 발화가 두 평면(v1
  check-contracts · v2 session-start)에서 겹치는 것은 충실 이동으로 보존 —
  단일 소유자 확정은 방2 activation 계약의 몫.)
- 명령 20→5 (자연어 기본 + review/check/history/settings) · plain rename
  (+alias 2 minor 유지) · README/사이트 "어디서 쓰세요?" 문 구조 · Boss 교체.
  (방2 준공 2026-07-17: 공개 메뉴 = review·check·history·settings·help + alias
  sail·resolve. deep review 문 2개는 disable-model-invocation — 모델이 자동으로
  열 수 없는 **플랫폼 구조**로 0 달성, 구 단계 스킬(clarify/team/verify/boss/
  revise)은 skills/review/ 안의 step 파일로 이주(디렉토리 부활 금지 게이트).
  나머지 12 스킬은 본문 무변경 user-invocable:false — 타이핑하면 여전히 작동.
  due 발화 단일 소유자 = check-contracts(프로젝트 v1 UNION 내구 원장,
  statusline과 동형 fold; 흡수된 session-start 훅은 LOGBOOK 신선도·첫 안내·
  수확 큐만). activation-contract.test.ts가 메뉴 목록·문 잠금·fan-out 폐포·
  부활 금지·help 범위를 전부 CI로 고정.)
  (방3 준공 2026-07-17 — Boss 교체: MBTI 성격극 → **자리(seat)-우선** 이해관계자
  리뷰. config boss 블록의 정본 = role·owns·goals·authority(스키마 required에서
  mbti_code 제거), 16타입은 선택 tone 스킨으로 강등(legacy mbti_code 키 = tone
  별칭, 하위호환). 프롬프트는 자리 블록 선두 + 모든 우려에 seat_basis 필수 —
  M2를 입버릇-복창 게이트에서 자리-앵커 결정론 검사로 교체, 보고 헤더의 타입
  라벨 제거(R42 "never surfaced" 자기위반 수리), M7 재정의(차별점 = 책임).
  dm-feedback의 minItems:1 우려-제조 강제도 폐기 — 깨끗한 스캐폴드엔
  concerns:[]가 정직한 출력(스키마가 스킬의 R42 절제 규칙과 모순이었음).
  seat-not-type.test.ts가 구조 회귀를 고정. 근거: R42 실측(가치는 전부 자리,
  타입 0/5) + 평가 문서 §4.4 personality-theater 경고.)
  (방4 준공 2026-07-17 — 문·카피 마감: README 세-문("어디서 쓰세요?") 구조는
  O0 표가 정본으로 유지·방2에서 명령 어휘 최신화 완료 확인. 방2·방3 명시-포기
  잔여 청소 — 스키마 8종·agents/classification yaml·data README의 구 명령
  산문을 step-언어로 매핑(node JSON.parse 11/11 검증), queue.ts의 미출하
  /argus:debrief 스텁 정직화(§8 대기 명시, 설계 인용은 원문 보존+주석),
  session.json boss_agent를 자리-우선으로(legacy mbti_code 주석), 구 문서
  4종(TEST_PLAN·BUILD_STATUS·DEJARGON·rehearsal-prompt)에 HISTORICAL 동결
  스탬프. **공정 O3 준공 — 방 4/4 완료, exit 2/2 전부 체크.** 다음 = O4 증거 관문
  (실사용 코호트가 주역) ∥ npm publish(자연어 입구 완성 조각, 창업자 명령 필요).)
- exit: [x] fresh install 명령 1개 [x] activation 계약 테스트(자동 deep review 0)

**공정 O4 · 증거 관문 (공정이 아니라 판정 — §6 준공 검사·P5 가치 관문과 한 몸)**
- (코호트 개정 2026-07-18, 창업자 승인) "5명 모집×21일"을 **창업자 + 자연 유입,
  D0(=3표면 동시 배포일 2026-07-18)~D+21**로 완화 — 1-day 배포 결정으로 모집
  관찰이 불가해짐. 배포→관찰 순서는 원설계 그대로이며, 비교군 요건은 코호트
  완화와 함께 철회. 사전 검수는 관찰의 대체가 아니라 보완(전 표면 테스트
  배터리 + 출시본 실기동 스모크, 2026-07-18 수행).
- 7단계 퍼널(noticed→captured→accepted→surfaced→returned→resolved→again).
  측정 정본 = .argus 원장 이벤트(완주 = resolved 도달), 웹 텔레메트리 보조,
  npm 다운로드는 참고만(설치≠사용). 알려진 계측 빈틈: noticed/captured는 MCP
  경로에서 얇다 — captured 이후만 정확 (사후 재해석 방지 위해 지금 명시).
- **판정 숫자 (착수 전 봉인 2026-07-18, 창업자 승인 — 기본 기대값 ITERATE,
  사후 변경 금지):**
  - PASS (O5 확장 착공 허가): 완주 ≥10 AND 창업자 외 사용자 ≥2 AND
    again(같은 사용자 2번째 봉인) ≥3
  - ITERATE (기본 기대값): 완주 3~9 — 퍼널 최대 이탈 단계 1곳만 수리 후
    D+21 1회 연장
  - HOLD: 완주 1~2 — 신규 시공 전면 중지, 원인 파악만
  - KILL 신호 (자동 아님, 재론 트리거): D+21 완주 0 AND 창업자 재방문 중단
- **통과 전 확장 착공 금지. 확장 후보는 전부 §8 동결 목록에 있다.**

**공정 O5 · 확장 (관문 통과 후에만, 순서는 O4 데이터가 정한다)**
- §8의 `[O4 관문 뒤]` 항목에서 인출: MCPB(Desktop) · Codex plugin · 위젯 2종 ·
  installer · (remote/team/v3/TUI는 그 뒤).

**병렬 코어 트랙 K (2026-07-16 등록, 창업자 승인)** — `docs/DESIGN-judgment-knowledge-core-and-coaching-v1-2026-07-16.md`(judgment knowledge core & coaching, PR #167)의 구현 트랙. O-위계와 병렬 진행을 허용하되 경계 3규칙:
1. **순서와 격리**: K0(ADR + 배신방지 fixture를 코드보다 먼저) → K1(새 스키마는
   `argus-mcp/src/v4/` 신규 네임스페이스 + env 플래그 뒤 **shadow-write만**, v3
   의미 변경 금지 — 설계 문서 §12.1) → K2(웹 `user_lean` 승격). A0(계정 연결,
   PKCE+Device — §8의 "OAuth 원격 전송"=MCP transport 인증과 **별개**)은 기존
   sync 마찰 수리로서 표면 포함 진행 가능. v1/v2 쓰기 경로·플러그인 scripts
   (O2 소유)·O1 closeout 구현 경로는 무접촉, 테스트는 격리 규약(실홈 금지) 준수.
2. **표면 게이트 유지**: 사용자-표면(코칭 카드·5차원 Patterns 노출)과 canonical
   read 전환은 **O4 통과 후에만** — 동결의 목적(가치 증명 전 표면 확장 금지)은
   K-트랙 아래에서도 그대로다.
3. **봉인 순간은 카드 한 장**: O1 방4(predicate Keep/Reword/Skip)가 먼저, K-트랙
   W1(전제 watch 승인)은 그 카드를 확장한다 — 두 장이 되면 over-fire.
   PR 첫 줄 규약: `공정 K{n} · 겨냥 퍼널 단계 X→Y`.

**exit 체크 규약은 §6과 동일** — `[x]`는 같은 커밋에서 EVIDENCE 맵 갱신과 함께만.
병행 트랙: 웹 공정 5(첫인상 수리)는 이 위계와 독립적으로 §6을 따른다.

### 9.8 병렬 권한 트랙 E — 자기지식과 AI 영향의 거버넌스 (2026-07-17 신설, 창업자 승인)

헌법 정본: `docs/DESIGN-epistemic-agency-and-self-knowledge-governance-v1-2026-07-17.md`.
O3/E1/E2 이후 저장·회수·동기화·E3/E4 실행 정본:
`docs/DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` (**JCR**, 2026-07-18
창업자 요청 등록). JCR은 E 불변식을 바꾸지 않고 authority aggregate, artifact,
Judgment Recall, Context Compiler, portability/erasure의 구현 순서와 검증 gate를 소유한다.
이 트랙은 K의 지식 그래프를 다시 만들지 않는다. **K가 판단 기록에서 후보 패턴을
생산한다면, E는 그 패턴이 언제 ‘나에 대한 지식’으로 승격되고 언제 미래 AI의
질문·검색·생성에 영향을 줄 자격을 얻는지 통제한다.**

> **패턴은 프로필이 아니고, 프로필은 프롬프트 정책이 아니다.**

현행 감사에서 확인한 첫 위험은 네 가지다: ① AI가 생성한 hidden assumption의 축
분포를 사용자 사각지대로 다시 주입하는 폐회로, ② DQ/vitality 같은 절차 계측을
사용자의 품질·경직 추세로 번역하는 경로, ③ AI가 항해일지의 `why_abandoned`를 써서
사용자의 과거 이유와 섞는 경로, ④ 같은 LLM의 여러 persona를 `common_agreements`와
우선 행동으로 합성하는 가짜 다수 효과. E는 새 프로필 화면보다 이 오염을 먼저 막는다.

**헌법 5규칙:**

1. 사건→관찰→자기지식 후보→사용자 채택→미래 영향 허가는 서로 다른 단계이며 자동
   승격하지 않는다. **채택(endorse)과 영향 허가(grant)는 별도 사용자 행위**다.
2. AI 산출물과 그 수락 클릭은 사용자 사고의 독립 표본으로 세지 않는다. 교차 결정
   자기지식 후보는 K의 F3와 같이 독립 resolved case 3개 + 반례 검색이 기본 최소다.
3. 기억의 관련성은 영향 권한이 아니다. 모든 derived-memory 주입은 활성 grant와
   `InfluenceTrace`가 필요하며, contest/retire/revoke 다음 호출부터 영향은 0이다.
4. 같은 생성 계보의 persona N개는 증거 단위 1이다. AI 역할극에 합의·다수·표결을
   주장하지 않고 가장 강한 반대 렌즈와 미확인 현실 정보를 함께 보존한다.
5. 자율성은 다수에 반대한 횟수가 아니다. AI와 같거나 다른 어느 선택도 가점·감점하지
   않고, AI 전 입장·사용자 변화 이유·반대 근거·현실 정산을 보존한다.

**단계와 관문:**

- **E0 · 헌법·감사·red fixture (지금, 설계/평가만):** default/live와 legacy 경로를
  분리하고 12개 betrayal fixture의 baseline을 남긴다. 사용자 표면과 runtime 의미는
  바꾸지 않는다.
- **E1 · 오염원 격리:** DQ/vitality 자기평가, AI-artifact 프로필, coda/회고 자동 지시,
  AI-authored 이유를 자기지식·프롬프트 영향 경로에서 분리한다.
- **E2 · 영향 제어면 shadow:** SelfKnowledgeClaim/InfluenceGrant/InfluenceTrace를 E
  namespace에 기본 grant 0으로 두고, K 객체는 read-only 참조한다.
- **E3A · durable authority foundation (지금, shadow):** claim별 authority aggregate,
  use receipt/trace 분리, artifact, sync, restore/erasure를 사용자 표면 없이 닫는다.
- **E3B · 자기지식 검토 표면:** **O4 통과 후에만.** K C3 후보를 관찰·반례·범위·질문
  카드로 투영하며 endorse와 grant를 한 탭으로 합치지 않는다.
  (2026-07-18 J9 구현은 closed gate 뒤 완료: canonical source fail-closed review,
  분리 grant UX, 5차원 bounded projection. 실제 O4/comprehension receipt가 없어 공개 404 유지.)
- **E4 · 합성 관점 방화벽 (선행조건 충족):** O3 Boss 교체가 PR #180으로 완료됐다.
  role-play 수렴을 현실 합의나 증거 가중치로 바꾸는 경로를 제거한다.

**무접촉 경계:** O2의 ledger/Core/writer/statusline, O3의 driver·plugin·명령·설치
문구·Boss 구현, K의 `argus-mcp/src/v4/**`와 `src/lib/semantic-v4/**`, 웹 공정 5의
progressive UI 공예, 병합된 O1 #172의 구현 경로. E0는 문서·격리 평가만 소유하며,
Chronicler처럼 공정 5와 맞닿는 runtime 수정은 활성 PR 종료 뒤 별도 PR로 한다.

**E0 exit:** [x] 12개 betrayal fixture의 현재 baseline 증거 [x] default/legacy 경로
구분 테스트 [x] O/K/P5 무접촉 allowlist 또는 동등한 경계 증거.

**E1 exit:** [x] E-B1·B2·B3·B7·B8·B9·B12 blocking guard [x] 기존 사용자
원문·결정 기록 손실 0 [x] 출처 없는 legacy 이유 보존 + 표시·영향 격리.

**E2 exit:** [x] grant 없는 derived-memory 주입 0 [x] active grant 사용 trace 100%
[x] revoke·material counterexample 다음 호출 주입 0 [x] K reducer/event 의미 변경 0.

2026-07-17 현재 protected 10, known violation 1(E-B4), partial 1(E-B5), architecture
gap 0이다. E-B4·B5는 O3 Boss 교체 뒤 E4 합성 관점 방화벽에서 처리한다. E2는
shadow라 사용자 자기지식 표면을 열지 않았고, 기존 live callsite의 영향은 0이다.

---

### 9.9 병렬 트랙 V — 판단 지식의 연동·시각화 (2026-07-21 신설, 창업자 승인)

한 줄 정의: **플러그인/MCP의 판단 기록이 무념(승인 탭 1회)으로 웹앱에 닿고,
흩어진 결정·전제·정산이 하나의 병합된 항해 지도로 보이게 하는 연동·투영 트랙.**
새 두뇌·새 정본을 만들지 않는다 — 기존 트랙 E(§9.8, JCR)와 K(§9.7), P6 web
canonical ledger에 **묶여** 실행되는 배관·투영 트랙이다.

- **V1 · 무념 연동 + 점화 (게이트 없음, 지금):** 플러그인에 MCP의 브라우저-승인
  (PKCE loopback + device 폴백) 흐름을 이식하고 — `account-connect.ts`가 정본 —
  자격 없을 때 첫 seal에서 **자동으로 승인 탭**을 띄운다. PAT 복붙 경로 제거.
  승인 클릭 1회 = opt-in(§9.4 "sync opt-in 전 egress 0" 불변식 준수 — 클릭 0
  무단 업로드는 짓지 않는다). 점화 축(순간 하중 전제)이 신규 사용자 첫 결정에서
  작동함을 확인하되, **공정 5 progressive UI 공예와 무접촉**.
- **V2 · 병합 지도 (마이그레이션 게이트):** `project_semantic_events`(P6) 배포
  후 — VoyageSea가 웹+플러그인/MCP **병합 스트림**을 렌더하고, `judgment-graph.ts`에
  축 3개를 얹는다: per-ground 정산 track record 조인 · 출처 태그(Claude Code/
  Codex/웹) · 최근점검. 사실+카운트 표시는 허용(§9.8 스파인), 사용자 대면
  **평결형 자기지식 표면은 E의 O4 게이트를 상속**한다.
- **V3 · recall (O4 게이트):** 다음 결정에 판단을 push하는 표면 = **E3B/JCR J7**.
  E의 게이트를 그대로 상속하며 새 표면을 열지 않는다.

**무접촉 경계:** 공정 5 progressive UI 공예, O2의 ledger/Core/writer/statusline,
K의 `argus-mcp/src/v4/**`·`src/lib/semantic-v4/**`, E의 O4-gated 자기지식 표면
(E3B). V1은 플러그인 bridge(`scripts/push-webapp.js`)와 `a0/account-*`만 만지고,
V2 데이터 축은 `src/lib/judgment-graph.ts`·`voyage-state.ts`·VoyageSea에 국한한다.

**이 등록은 사용자 표면 개방 허가가 아니다(§7.4).** V3와 V2의 평결형 표면은
O4 통과 전 비공개.

**V1 exit:** [x] 플러그인 승인 탭 1클릭 연동(복붙 0) [x] 첫 seal 자동 트리거
[x] 실주행에서 `plugin_bearings` 0→1 실측(§7.5 행수 확인) — 2026-07-21 창업자 실주행 준공.

**V2 exit:** [x] 정산 track record 축 — per-ground held/broke/mixed 조인(`GroundRecord`),
사실 카운트만(평결 0). [x] 출처 축 — **정직 라벨**(웹 / MCP·CLI / 미상); 진짜
"Claude Code↔Codex" 세분은 어떤 영수증에도 표면 신호가 없어(source_kind는 문서
종류일 뿐) '미상'으로 표기하는 **disclosed gap** — 그 신호를 실제로 배선하려면
push→ingest→schema를 건드려 V2 무접촉 경계를 넘으므로 별도 승인 트랙으로 남긴다
(창업자 2026-07-22 "정직 라벨, 경계 안" 결정). [x] 최근점검 축 — 전제/결정의
`last_activity`(멤버 recheck ts / 영수증 updated_at) → "N일 전 점검", 없으면 정직한
미표시(honest gap). [x] VoyageSea 병합 스트림 — 웹 프로젝트 + `review_receipts`
(MCP/review `JudgmentReceipt`)가 한 바다에 vessel로 병합 렌더(실측 테스트); 플러그인
브리지 `plugin_decisions`(usePluginStore) 병합은 경계 밖 gap으로 기록.
— 2026-07-22 트랙 V2 준공(스크린샷 도구 세션 장애로 DOM/인라인 스타일 대체 검증).

---

## 마지막 장 — 이 설계도의 봉인

> **예측:** 공정 0~2를 순서대로 완료하면, 그 시점의 신규 사용자 코호트에서
> "봉인 후 7일 내 귀환"이 계기판에 처음으로 0이 아닌 값으로 찍힌다.
> **확인일: 공정 2 준공 + 14일.**
> **빗나가면:** 알림의 헌법(§4.1)이 아니라 알림의 존재 자체가 안 닿는 것 —
> 채널 문제(이메일 도달률·스팸함)를 먼저 의심하고, 그 다음 T1 제목 문안을
> 사용자 5명과 함께 다시 쓴다.
>
> AI VERDICT ON THIS BLUEPRINT ····························· NONE
> 이 설계도를 채점하는 것도 모델이 아니라, 완공된 집에 사는 사람이다.
