# 12 — argus-mcp 심층 감사 (완주 경험 · 재방문 · 시그니처 순간 · 축적의 보물)

> 2026-07-03. 감사 방법: 소스 전량 읽기 + **실제 빌드·실행**(`npm install && npm run build` 성공, tsc 0 에러).
> 데이터는 전부 스크래치패드 임시 디렉터리(`…\scratchpad\argus-data\.argus`)로 격리 — 서버 디스패치와 동일한 경로(zod 검증 → 핸들러 → due_note 부착)로 도구를 직접 호출했다.
> `11-mcp.md`(배신·첫3분·목소리·최악의날·기다림·드리프트)와 중복 없음 — 이 문서는 나머지 4각도만 다룬다.

## 요약 (5줄)

1. **완주는 된다.** init→open→seal→(2주 뒤)check_in→settle→recall 전 구간을 7번의 호출로 실제 완주했고, 모든 가드(seal 없는 settle, 이중 settle, 정산 후 amend, 과거 날짜)가 정확한 에러+복구 힌트로 막았다. P0 없음 — 엔진은 진짜다.
2. **봉인 순간에 의식(ritual)이 없다.** settle은 스크린샷 찍고 싶은 영수증 텍스트 박스를 주는데, 정작 "묶는" 순간인 seal은 JSON 속 영어 한 줄뿐이다. 시그니처 순간이 루프의 뒷문(정산)에만 있고 앞문(봉인)에는 없다.
3. **돌아온 사람을 알아봐주지 않는다.** 2주 뒤 check_in은 기한 목록을 정확히 주지만(3초 안에 "정산해라"는 나옴), "당신이 그때 이렇게 말했다"는 닻 거울이 없어 사용자는 자기 말을 다시 못 보고 정산에 들어간다 — 웹앱 WakeReturn이 가진 것을 MCP가 잃었다.
4. **쌓여도 풍경이 안 변한다.** 결정 20개·정산 3개 시점의 bearing/contracts는 정렬 안 된 생 JSON 배열이고, track_record는 한 줄이다. 축적이 자산으로 **보이는** 텍스트 렌더(항적)가 없다.
5. **한국 사용자 마찰 3개가 실측으로 확인됐다:** 오늘 날짜가 UTC라 한국 아침 9시까지 어제로 계산됨(실행 중 today=07-02로 관측, 실제는 07-03), 한국어 막연 술어("잘 될 것 같다 아마도")가 반증가능성 휴리스틱을 그대로 통과, locale=ko 설정이 코어 루프에서 아무 효과 없음.

---

## 1. 완주 기록 (dogfood — 실제 호출 로그 인용)

시나리오: "시니어 엔지니어를 지금 뽑을지 6개월 미룰지" — 열고, 봉인하고, 2주 뒤 돌아와 정산.

| # | 호출 | 결과 |
|---|---|---|
| 1 | `argus_init` | ok — "Argus is ready. It does not give answers…" |
| 2 | `argus_open_decision` (stakes=high, one_way 아님) | fire, 크럭스 질문 1개, `harvest_written:true` |
| 3 | `argus_seal` (predicate+check_by 7/17+영수증 4필드) | ok, `premise_promoted:"P1"` |
| 4 | `argus_check_in` (당일) | "Nothing is due. Nothing to nudge." ← 절제 정확 |
| 5 | `argus_check_in` (`today_override:7/18`) | 1건 due, `days_overdue:1` |
| 6 | `argus_settle` (outcome=partial) | ok, 영수증 발행 |
| 7 | `argus_recall view=receipt` | 동일 영수증 재열람 |

**막힌 곳: 없음.** 에러 경로도 전부 도왔다 (그대로 인용):

```
NO_PRIOR_SEAL      "Cannot settle a decision that was never sealed."
                   recovery: "Call argus_seal with a falsifiable predicate and a check-by date first."
ALREADY_SETTLED    "This decision is already settled (append-only — no re-judging)."
DECISION_CLOSED    (정산 후 amend 시도) "This decision is settled; it cannot accept a amend."
BAD_CHECK_BY       "check_by (2026-01-01) must be in the future (today is 2026-07-02)."
```

**봉인 직후 출력 (전문):**

```
"surface": "Sealed. \"채용 후 90일 안에 신규 엔지니어가 핵심 기능 1개를 단독 출시한다\"
            — reality answers on 2026-07-17. Come back then with argus_settle."
```

**정산 직후 출력 (`data.receipt_text` 전문):**

```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-02      Settled 2026-07-02

  THE REAL QUESTION
    사람이 부족한 건가, 방향이 불확실한 건가
  THE UNVERIFIED ASSUMPTION
    온보딩 문서만으로 90일 내 전력화가 가능하다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   분기 중 채용 리스크를 질 가치가 있는가
  …made by          Me. (not the model)
  …called as        judgment

  YOU PREDICTED   "채용 후 90일 안에 신규 엔지니어가 핵심 기능 1개를 단독 출시한다"   (check-by 2026-07-17)
  WHAT HAPPENED   엔지니어는 합류했지만 90일째 기준 핵심 기능은 공동 출시. 단독 출시는 아직.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└──────────────────────────────────  argus · seal → settle ─┘
```

이 영수증은 진짜 좋다. 문제는 **이게 루프의 끝에만 있다**는 것.

추가 실측 (축적 시나리오, 결정 20개 중 3개 정산):
- `due_note` 피기백이 실제로 작동 — 관련 없는 `argus_recall` 호출에도 `"due_note": "6 contract(s) to settle (argus_settle)"`이 붙고 `next_actions`에 `argus_check_in`이 추가됨 (`src/lib/due-note.ts:25-59`). 재방문 루프의 숨은 조력자, 잘 지어졌다.
- `related_to`로 과거 결정 3개를 태그하니 `continuity.frequency_statement: "Of 3 similar decision(s) you settled: 1 held, 2 did not."` + 소표본 경고가 붙음 (`src/lib/continuity.ts:26-28`) — 스파인 규칙 그대로.

---

## 2. 발견 목록

### P0 — 없음

완주 가능. 데이터가 디스크에 실제로 남는다(ledger.ndjson + sessions/{id}/receipt.json + bearing 확인). 이건 그 자체로 보고할 발견이다: **MCP 표면의 엔진과 가드는 출하 품질이다.**

### P1-1. 봉인 순간이 의식이 아니다 (시그니처 순간 부재)

- `argus_seal`은 `surface` 한 줄만 반환 (`argus-mcp/src/tools/seal.ts:124-127`). 정산에는 `renderReceipt()`가 있어 `receipt_text` 박스를 주지만 (`src/tools/settle.ts:115`), 봉인에는 렌더 함수 자체가 없다 (`src/lib/render-receipt.ts`는 settled 전용).
- 이 제품의 심리적 계약은 봉인 순간에 맺어진다. 사용자가 "내가 뭔가에 서명했다"를 몸으로 느끼는 텍스트 블록이 없으면, 2주 뒤 check_in이 와도 그건 남의 알림이다.
- 참고: `argus_recall view=receipt`를 봉인 직후 부르면 "JUDGMENT RECEIPT … Settled (open)"이 나오긴 하는데(실측), 이건 정산 문서의 미완성판이지 봉인 확인문이 아니고, 아무 도구도 그리로 라우팅하지 않는다.
- → 구현 스펙 §3.1.

### P1-2. 재방문: 기한은 알려주지만 사람을 알아보지 않는다

- 재방문 경로 자체는 3중으로 깔려 있다 — (a) 서버 instructions가 "세션 시작 시 argus_check_in 1회"를 지시 (`src/lib/spine.ts:65`), (b) `argus://contracts/due` 리소스 (`src/resources.ts:23`), (c) 모든 성공 호출에 붙는 due_note. **LLM이 뭘 호출하게 되는지는 잘 설계됨.**
- 그런데 check_in의 due 항목은 `{id, predicate, check_by, days_overdue, source}`뿐 (`src/tools/check-in.ts:30-37`). 봉인 때 받아 적은 `human_judgment`("지금 뽑는다. 늦추면 하반기 로드맵이 전부 밀린다.")와 `real_question`은 영수증 파일에 이미 있는데 여기 실리지 않는다.
- surface도 `"1 decision contract(s) past check-by — time to check them against reality (argus_settle)."` (`src/tools/check-in.ts:58`) — 기능적으로 정확하지만, 봉인한 지 며칠 됐는지·그때 자기가 뭐라고 말했는지가 없다. `next_actions`가 곧장 `argus_settle`이라 모델이 닻 거울 없이 "결과가 어떻게 됐나요?"부터 물을 확률이 높다. 웹앱 WakeReturn(닻 거울+그대로/바뀜)이 MCP에는 없는 것.
- → 구현 스펙 §3.2.

### P1-3. "오늘"이 UTC라 한국에서는 아침 9시까지 어제다

- `resolveToday` 기본 tz가 UTC (`src/lib/resolve-today.ts:19`). 실측: 로컬 날짜 2026-07-03인데 check_in이 `"today": "2026-07-02"`를 반환.
- 체감: check_by가 오늘인 계약이 **한국 시간 오전 9시까지 check_in에 안 뜬다.** "확인일 아침에 돌아왔는데 Argus가 아직 아니라고 한다"는, 재방문 루프에서 가장 아픈 첫인상.
- `ARGUS_TZ` env는 구현돼 있는데 **README에 한 줄도 없다** (README에는 `ARGUS_DIR`만 등장, README.md:67). 설계상 UTC 기본(청사진 M4)은 유지하더라도 문서화+설치 예시가 필수.
- → 구현 스펙 §3.3.

### P1-4. 한국어 막연 술어가 반증가능성 휴리스틱을 통과한다

- 실측: `predicate: "잘 될 것 같다 아마도"`가 그대로 봉인됐고, surface가 `Sealed. "잘 될 것 같다 아마도" — reality answers on…`이라고 **축하까지 해준다** (호출 11).
- 원인: VIBE 목록이 영어뿐 (`src/lib/validate-seal.ts:20` — `go well|be fine|…` 영어 단어 경계 정규식). 청사진 m3가 "약한 휴리스틱"으로 정직하게 문서화한 한계지만, 주 사용자가 한국어 창업자인 제품에서 자기 언어만 구멍인 건 고쳐야 한다.
- → 구현 스펙 §3.4.

### P2-1. 축적이 보이지 않는다 (결정 20개 = JSON 벽)

- 실측: 결정 20개·정산 3개 시점 —
  - `view=bearing` → `"17 open bearing(s)."` + **삽입 순서 그대로의** JSON 17개 (`src/tools/recall.ts:97` — 정렬 없음. check_by 지난 dec-06이 8월 계약들 사이에 묻힘).
  - `view=contracts` → `"20 decision(s) on record."` + 무제한 배열 (`src/tools/recall.ts:105` — 100개면 100개 다 나옴).
  - `view=track_record` → `"Of 3 settled: 1 held, 1 avoided, 1 partial."` — 이 한 줄은 스파인상 완벽한데, 1개일 때도 20개일 때도 **모양이 똑같아서** 쌓는 보람이 텍스트로 안 보인다.
- 영수증(정산의 순간)은 렌더가 있는데 항적(누적의 풍경)은 렌더가 없다 — 시각적 축적은 스파인이 명시적으로 허용하는 영역이다("항적의 시각적 축적").
- → 구현 스펙 §3.5.

### P2-2. 축적의 알맹이가 옵션 인자에 달려 있는데 아무도 안 알려준다

- track_record의 유일한 심화 서술(깨진 전제 귀속)은 settle에 `broken_premise_ref`를 넘겼을 때만, 열기의 유일한 이력 서술(continuity)은 open에 `related_to`를 넘겼을 때만 생긴다 (`src/tools/settle.ts:22`, `src/tools/open-decision.ts:28`). 실측에서 이 인자 없이 3건을 정산하니 track_record에 전제 귀속 문장이 아예 없었다.
- 서버 instructions(`src/lib/spine.ts:56-68`)는 premises 기록은 지시하지만 이 두 인자는 언급하지 않는다 — 모델이 스스로 챙길 확률이 낮다. instructions에 각 한 줄이면 된다.

### P2-3. 영수증 렌더의 한국어/장문 견고성

- 술어 줄이 wrap을 안 탄다 (`src/lib/render-receipt.ts:51` — `YOU PREDICTED "${r.predicate}"`를 그대로 붙임). 실측 영수증에서 이 줄만 박스 폭(60칸)을 훌쩍 넘었다. 스크린샷용 아티팩트인데 제일 중요한 줄이 제일 먼저 삐져나온다.
- CJK는 터미널에서 2칸 폭이라 위/아래 레일과 본문 폭이 어차피 안 맞는다 — 상하단 레일만 있는 현 디자인이라 치명적이진 않지만, 술어 wrap은 넣어야 한다.

### P2-4. locale 설정이 코어 루프에서 no-op

- `argus_config`가 locale(ko/en)을 저장하고 `detectLocale`까지 있는데 (`src/tools/init-config.ts:48`, `src/lib/locale.ts:4`), **seal/settle/check_in/recall 어느 것도 이를 읽지 않는다** (전량 grep으로 확인 — 소비처는 review 계열뿐). surface는 모델이 번역해서 전달하니 반쯤 가려지지만, **verbatim으로 보여주라고 만든 `receipt_text`(그리고 §3.1의 `seal_text`)는 영어 고정**이라 한국 사용자의 시그니처 순간이 절반쯤 남의 언어다.
- → §3.1/§3.5 렌더 스펙에 locale 분기 포함.

---

## 3. 구현 스펙 (정확한 출력 문안 포함)

### 3.1 봉인 확인문 `seal_text` — 루프 앞문의 의식 (P1-1 + P2-4)

`renderSeal(receipt, locale)`을 `src/lib/render-receipt.ts`에 추가하고, `argus_seal` 성공 envelope의 `data.seal_text`로 반환. surface에는 기존 한 줄 유지(모델용), seal_text는 "사용자에게 그대로 보여줄 것"이라고 필드 설명에 명시.

**한국어판 (locale=ko, config에서 읽음):**

```
┌─ ARGUS · 봉인 ────────────────────────────────────────────┐

  "채용 후 90일 안에 신규 엔지니어가
   핵심 기능 1개를 단독 출시한다"

  이 문장은 당신의 것입니다.          (predicate_owner: user)

  봉인          2026-07-03
  현실의 답     2026-07-17   (14일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ─┘
```

**영어판 (locale=en):**

```
┌─ ARGUS · SEALED ──────────────────────────────────────────┐

  "New engineer ships one core feature solo
   within 90 days of joining"

  These words are yours.             (predicate_owner: user)

  Sealed            2026-07-03
  Reality answers   2026-07-17   (14 days out)

  This stays shut until then. What gets written next is not
  a grade — it is what actually happened.

└──────────────────────────────────  argus · anchor down ─┘
```

규칙 (스파인):
- `predicate_owner:'ai_surfaced'`일 때 소유 줄을 **정직하게 바꾼다**: ko `"Argus가 초안한 문장입니다 — 아직 당신이 확언하지 않았습니다."` / en `"Argus drafted these words — you have not yet made them yours."` (거짓 소유 서사 금지, 강제 타이핑 게이트도 금지 — 그대로 봉인 가능해야 함).
- 이모지 0, 과장 0. "닻 내림/anchor down"이 유일한 세계관 장식.
- 술어는 §3.4의 wrap 함수로 감싼다(스크린샷 폭 보장).
- 날짜 diff(`N일 뒤`)는 `resolveToday` 결과로 계산 — 벽시계 새로 읽지 않는다.

### 3.2 재방문 인식 — check_in에 닻 거울 (P1-2)

`check-in.ts`에서 각 due 항목에 대해 `readReceipt(dir, id)`(이미 존재, `src/lib/receipt.ts`)를 읽어 두 필드를 추가:

```jsonc
{
  "id": "hire-senior-eng",
  "predicate": "채용 후 90일 안에 …",
  "check_by": "2026-07-17",
  "days_overdue": 1,
  "sealed_at": "2026-07-03",          // receipt.created_at.slice(0,10)
  "days_since_seal": 15,
  "your_words_then": "지금 뽑는다. 늦추면 하반기 로드맵이 전부 밀린다.",  // receipt.human_judgment (skipped면 생략)
  "source": "ledger"
}
```

surface 문안 (1건 due, ko/en — locale 분기, 사실만, 감탄 금지):

```
ko: "봉인 후 15일 — 계약 1건이 확인일을 지났습니다. 그때 당신은 이렇게 적었습니다:
     '지금 뽑는다. 늦추면 하반기 로드맵이 전부 밀린다.' 현실이 어떻게 답했는지만 기록하면 됩니다 (argus_settle)."
en: "15 days since you sealed — 1 contract is past its check-by. Your words then:
     'Hiring now. Waiting kills the H2 roadmap.' All that's left is to record what reality did (argus_settle)."
```

여러 건이면 가장 오래된 1건의 your_words_then만 surface에 싣고 나머지는 data로 (surface 비대화 방지). due 0건 문구는 현행 유지("Nothing is due. Nothing to nudge." — 절제 정확). **"돌아오셨군요" 류의 환영 인사는 넣지 않는다** — 인식은 날짜 산수(사실)로만 한다.

### 3.3 ARGUS_TZ 문서화 + 설치 예시 (P1-3)

- README 설치 스니펫(README.md:60대 `mcpServers` 예시)의 env에 `"ARGUS_TZ": "Asia/Seoul"`을 추가하고, 한 줄 설명: *"check-by가 '오늘'이 되는 기준 시간대. 미설정 시 UTC — 한국 사용자는 오전 9시까지 어제로 계산된다."*
- `argus_init` 응답 data에 `today`와 `tz`를 포함시켜 (현재 미노출) 설치 직후 어긋남을 스스로 발견하게 한다: `"data": { …, "today": "2026-07-02", "tz": "UTC (set ARGUS_TZ to change)" }`.
- 기본값 변경은 하지 않는다(청사진 M4의 결정성 논거 유지) — 문서+가시화만.

### 3.4 한국어 vibe 휴리스틱 (P1-4)

`validate-seal.ts:20`의 VIBE 옆에 한국어 패턴 1줄 추가 (약한 휴리스틱 지위 유지, `weak:true` 그대로):

```ts
const VIBE_KO = /(잘\s*될|잘\s*풀릴|괜찮을|좋아질|나아질)\s*(것|거)\s*(같|이)|아마도|어떻게든\s*(될|되)/;
```

에러 문안도 ko 분기: `"이건 기분이지 확인 가능한 예측이 아닙니다. 숫자·임계값·관찰 가능한 사건으로 다시 적어주세요. (휴리스틱 — 놓칠 수 있음)"`. 그리고 §3.1의 seal_text가 생기면, 통과한 막연 술어를 "축하"하는 현행 surface의 어색함도 자연히 줄어든다.

### 3.5 항적 렌더 `wake_text` — 축적이 보이는 구조 (P2-1)

`renderWake(contracts, stats, today, locale)`를 추가해 `argus_recall view=bearing`과 `view=contracts`의 data에 `wake_text`로 반환. **정렬: check_by 오름차순, 그룹: 기한 지남 → 대기 중 → 정산됨.** n이 커질수록 줄이 늘어나는 구조 — 점수·등급·비율 없이 개수와 사실만.

결정 20개·정산 3개 시점 목표 출력 (ko):

```
┌─ ARGUS · 항적 ─────────── 결정 20 · 봉인 중 17 · 정산 3 ─┐

  확인일 지남 (6)                            ← argus_settle
    dec-06   "기능 6 … 60건을 넘는다"        07-10 · 11일 경과
    dec-09   "기능 9 … 90건을 넘는다"        07-10 · 11일 경과
    … (+4)

  현실을 기다리는 중 (11)
    dec-05   "기능 5 … 50건을 넘는다"        답 08-01
    dec-07   "기능 7 … 70건을 넘는다"        답 08-15
    … (+9)

  정산됨 (3) — held 1 · avoided 1 · partial 1
    dec-01   held      07-21   "기능 1 … 10건을 넘는다"
    dec-02   avoided   07-21   "출시를 접었다"
    dec-03   partial   07-21   "사용 19건, 기준 미달"

└─────────────────────────────── 기록 시작 2026-07-03 부터 ─┘
```

- n=1이면 세 그룹 중 한 줄짜리 하나 — 그래도 같은 프레임이라 "이 배가 커진다"가 보인다. 그룹당 상위 5줄 + `(+N)` 접기(due_premises의 TOP=5 관례 재사용, `src/tools/check-in.ts:42`).
- 마지막 줄 "기록 시작 YYYY-MM-DD 부터"가 무료로 생기는 축적감 — 가장 오래된 ledger 이벤트의 ts.
- **금지 목록 (스파인):** 적중률 %, "1/3", 등급, 연속 기록(streak), "잘하고 있다" 류. `held 1 · avoided 1 · partial 1`처럼 **개수 나열만**. 정산됨 줄의 상태 단어는 사용자가 자기 입으로 고른 outcome(user_stated)이라 표시해도 판결이 아니다.
- track_record는 현행 한 줄 유지 + 이미 구현된 전제 귀속 문장(§P2-2 인자가 들어올 때)이 최대 심화 — 여기에 새 의미 언어를 추가하지 않는다.

### 3.6 부속 수정

- `render-receipt.ts:51` 술어 줄에 `wrap()` 적용 (P2-3).
- `recall.ts:105` contracts를 check_by 오름차순 정렬 + 60건 초과 시 `{truncated: N}` (P2-1의 JSON 측).
- `spine.ts` SERVER_INSTRUCTIONS에 2줄 추가 (P2-2): *"When opening a decision similar to past ones, pass their ids as related_to — history is frequency, never a verdict."* / *"When the user names which premise broke at settle time, pass broken_premise_ref — never infer it."*

실행 순서 제안: 3.1 → 3.2 → 3.3(15분) → 3.4(15분) → 3.5 → 3.6. 전부 argus-mcp/ 내부라 병렬 세션 규칙(웹앱 등록부 4개)과 충돌 없음.

---

## 4. 스파인 충돌 검토

**실측으로 확인된 준수 (그대로 지킬 것):**
- `ai_verdict: null` 리터럴이 정산 응답과 영수증 양쪽에 존재, `judgment_tier/judgment_score: null` 고정 (`src/tools/recall.ts:131`) — 실행 출력에서 육안 확인.
- restraint 기본값 실동작: 저위험·가역 결정에 `"no fork to manufacture here"` + `harvest_written:false` (호출 10), due 0건에 `"Nothing to nudge."` — over-fire 미러 조항 준수.
- `lean_disclosure`가 제품 차원 1문장으로만 존재 (`src/tools/open-decision.ts:118`), per-output 기운 태깅 없음.
- 소표본 경고가 track_record와 continuity 모두에 부착. 봉인 전 settle은 `NO_PRIOR_SEAL` 하드 에러 (`src/lib/state-machine.ts:71-77`) — 청사진 B1~B3 봉합이 실제로 작동.
- 참고: check_by 전이라도 outcome이 확정적(held/avoided/partial)이면 정산이 허용된다 — `still_pending`만 `PREMATURE_SETTLE`로 막힘 (`src/tools/settle.ts:72`). 현실이 일찍 답하면 받아 적는 게 맞으므로 위반 아님 (설계 의도로 판단).

**이 문서 제안들의 자가 검증:**
- §3.1 seal_text — "이 문장은 당신의 것입니다"는 provenance **사실 진술**이지 칭찬/판결이 아니고, ai_surfaced 분기가 거짓 소유를 막는다. 마찰 게이트 추가 없음(그대로 봉인 가능) — 정직 표기>강제 게이트 원칙 준수.
- §3.2 닻 거울 — 사용자가 쓴 문장을 그대로 되돌려주는 것(받아적기)이라 판결 0. 환영 인사·감정 표현을 금지하고 날짜 산수만 허용해 engagement 제조를 차단. due 0건이면 침묵 유지.
- §3.5 항적 — 개수·사실·시간축만. 비율/등급/streak 금지 목록을 스펙에 명문화했고, 이 금지는 `spine-drift.test.ts`에 "wake_text에 %/tier/score 문자열 부재" 단언으로 고정할 것을 권고.
- §3.4 — 휴리스틱을 게이트로 승격하지 않는다(`weak:true` 유지, 우회 가능성 문구 유지) — 청사진 m3의 정직성 보존.

**유일한 긴장:** §3.2의 "그때 당신은 이렇게 적었습니다"는 tired-user에게 가벼운 죄책감 압박이 될 수 있다. 그러나 그 문장은 기계가 아니라 사용자 자신이 쓴 것이고, 스파인이 금지하는 건 "기계의 평결"이지 "자기 말과의 재회"가 아니다 — Argus의 존재 이유(1차 정산: 생각↔생각) 그 자체이므로 채택을 권한다.
