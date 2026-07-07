# Fable5 — Argus 웹앱·MCP 퀀텀 업그레이드: 주문서와 실행 계획

> **2026-07-07 후속:** 창업자 브리프(MCP가 이번 공개 대상, 웹앱은 지지 표면)가
> 도착한 뒤 `docs/ARGUS-KEYSTONE-2026-07-07.md`가 이 문서를 재조준했다.
> **실행자는 KEYSTONE을 먼저 읽어라** — 이 문서의 Phase들은 KEYSTONE §8의
> 매핑표에 따라 Wave 0~3으로 재배치되어 유효하다.

Date: 2026-07-07
Author: Claude (claude-fable-5), 코드베이스·문서 전수 독해 후 작성
Status: **Execution-ready** — 실행 세션(Opus/Sonnet)이 이 문서만 읽고 구현할 수 있게 쓴다
Structure: §1 진단(왜 뺑뺑 도는가) → §2 프롬프트(천재 기획자의 주문서) → §3 그 프롬프트에 대한 응답(상세 실행 계획)

Read-first (실행 전 필독, 이 순서로):
- `CLAUDE.md` — Zero-Judgment Gate + LLM-glue invariant (모든 작업의 바인딩 제약)
- `docs/ARGUS-FINAL-DIRECTION.md` — 스파인의 정본
- `docs/DESIGN-judgment-checkpoints-v2-2026-07-06.md` §2 Ground Truth 표 — 정산 루프의 현재 코드 지도
- 이 문서 §3.0 Ground Truth 표 — 이 계획이 딛고 서는 코드 사실들

---

## §1. 진단 — 왜 "궁극의 개선"이 안 되고 뺑뺑 도는가

코드와 문서 전체를 읽고 내린 결론이다. 다섯 개의 발견이 하나의 뿌리로 수렴한다.

### 1.1 개선 루프가 내부 정합성만 최적화하고 있다 (뿌리)

지난 한 달의 커밋·문서 패턴: **감사 → 설계문서 v2 → CLAUDE.md 불변식 추가 →
리팩터 → 다음 감사**. `docs/`에 전략·감사·설계 문서가 80편을 넘는다. 각 사이클은
분명히 제품을 좋게 만들었다 — 스파인 위반이 줄었고, 드리프트 가드가 생겼고,
소비 계약 테스트가 생겼다. 그런데 정작 움직여야 할 숫자는 이것이다:

> **47 opened / 0 sealed / 0 settled** (`DESIGN-judgment-checkpoints-v2` §Q2, 2026-07-06 기준)

Argus 자신의 제1원리가 이 상황을 정확히 예언한다: **"plausible ≠ verified —
in-frame 합의는 검증이 아니다. 현실만이 정산한다."** 지금 Argus는 자기 자신에게
이 원리를 적용하지 않고 있다. 설계문서 v2가 설계문서 v1을 리뷰하는 것은 in-frame
합의다. 제품의 정산일(현실 사용자의 귀환)은 아직 한 번도 오지 않았다. **내부
정합성은 자정 없이 무한히 올릴 수 있는 지표라서, 거기에 갇히면 영원히 돌 수
있다.** 이것이 "뺑뺑 도는 느낌"의 정체다.

### 1.2 웹앱 한 몸에 두 세대의 제품이 살고 있다

- `/workspace/page.tsx` — 구세대(Reframe/Recast/Rehearse/Synthesize 4단계 생성
  흐름) + 신세대(progressive flow + RetroSeal)가 한 페이지에 50개+ import로 공존.
- `/project/page.tsx` (1,095줄) — 사실상 신세대의 홈이다: FleetChart(봉인된
  항해들), due 정렬, 귀환 표면. 그런데 IA상 "프로젝트 목록"이라는 보조 화면.
- `/tools/review` — ReceiptList/ReviewFlow(영수증·정산)가 여기 얹혀 있다.
- 랜딩 히어로의 유일한 입력은 `router.push('/workspace?q=…')`
  (`SirenHero.tsx:80`) — **첫 사용자를 구세대 생성 흐름으로 보낸다.**

즉 제품의 심장(seal→귀환→settle 루프)은 코드로는 이미 있는데, **집이 세 군데로
흩어져 있고 현관은 심장이 아닌 곳으로 나 있다.** README가 파는 것("AI VERDICT
NONE — 영수증과 정산")과 첫 화면이 주는 것(다단계 생성 항해)이 다른 제품이다.

### 1.3 MCP와 웹앱이 "두 개의 반쪽 제품"으로 서 있다

argus-decision-mcp는 테제의 가장 순수한 구현체다 — 13개 도구, verdict 도구의
구조적 부재, ledger 상태기계. 그리고 웹앱은 **귀환의 집**이 될 몸을 다 갖고
있다 — PAT 브리지(`src/app/api/mcp/seal/route.ts` → `review_receipts`), check-in
cron 이메일, companion brief, due-strip, /admin 퍼널.

그런데 이 둘을 잇는 회로가 **opt-in이고, 묻혀 있고, 첫 실행 경로에 없다.**
결정은 AI와의 대화 안에서 일어난다(MCP가 포착 지점). 귀환은 시간이 지난 뒤
일어난다(웹/이메일이 귀환 지점). 이 분업이 Argus의 해자인데, 지금은 각 표면이
자기 안에서 루프를 완결하려 한다. MCP만 쓰는 사용자는 귀환 알림이 없고(스스로
못 깨어나는 stdio), 웹만 쓰는 사용자는 포착 지점(실제 결정이 일어나는 대화)에
Argus가 없다. **반쪽 + 반쪽이 아니라 0.5 × 0.5 = 0.25가 되어 있다.**

### 1.4 계기판은 있는데 아무도 그것을 보고 일하지 않는다

`/admin`에 퍼널(signup → 사용 → 프로젝트 → SEAL → settle, plugin_sealed까지)이
이미 계측되어 있다(`admin/page.tsx:106`). 그러나 어떤 설계문서도 PR도 "이 작업이
퍼널의 어느 단계를 몇에서 몇으로 옮기려는 것인가"를 선언하지 않는다. 계기판이
개발 루프 바깥에 있으니, 루프는 계기판 없이 돈다.

### 1.5 영수증이 아직 '자산'이 아니라 '출력'이다

Judgment Receipt는 이 제품의 유일무이한 아티팩트다(`AI VERDICT … NONE`을 새긴
문서는 세상에 이것뿐이다). 그런데 지금은 MCP의 ASCII 렌더와 웹의 ReceiptView로
나뉜 내부 출력물이고, 자랑하고 싶은 물건 — 공유 링크의 OG 이미지, 벽에 붙일 수
있는 한 장 — 이 아니다. 공유 인프라(`/d/[token]`, `shared_links`)는 이미 있다.

### 진단의 압축

> **엔진과 스파인은 완성에 가깝다. 부족한 것은 (a) 하나의 현관, (b) 두 몸을 잇는
> 회로, (c) 현실 계기판에 묶인 개발 루프다. 다음 사이클은 "더 옳게"가 아니라
> "닫히게" 만들어야 한다.** 루프가 닫히는 순간부터는 현실 데이터가 다음 개선을
> 고르게 되고, 그때 뺑뺑이가 끝난다.

---

## §2. 주문서 — 천재 기획자·개발자·디자이너가 AI에게 내리는 프롬프트

> 아래는 "이렇게 만들고 싶은 사람"이 실행 AI에게 던질 주문을 Fable이 대신 쓴
> 것이다. §3은 이 주문에 대한 Fable 자신의 응답(상세 계획)이다. 실행 세션은
> 이 프롬프트를 자기 지침으로 삼고, §3을 그 지침의 승인된 계획으로 삼아라.

```
너는 Argus의 수석 프로덕트 엔지니어다 — 기획·개발·디자인 판단이 하나로 붙은
역할이다. 단, 방향 판단은 이미 끝났고 아래에 잠겨 있다. 너의 일은 방향을
다시 정하는 것이 아니라, 잠긴 방향을 코드와 화면으로 닫는 것이다.

## 잠긴 방향 (재논의 금지)
Argus는 "결정의 항해"를 파는 제품이다: 봉인(seal) → 시간 → 귀환(return) →
정산(settle). AI는 평결하지 않고, 현실이 정산한다. 이번 사이클의 테제는
한 문장이다:

  **하나의 루프, 두 개의 문, 하나의 계기판.**
  - 하나의 루프: seal→귀환→settle 루프가 유일한 제품이다. 나머지 전부
    (생성 흐름, 에이전트, 보스, 페르소나)는 이 루프에 결정을 공급하는
    보조 장치다.
  - 두 개의 문: MCP는 포착의 문(결정이 실제로 일어나는 AI 대화 안),
    웹앱은 귀환의 문(시간이 흐른 뒤 돌아오는 항구). 두 문은 한 루프의
    양 끝이며, 서로를 항상 알고 있어야 한다.
  - 하나의 계기판: opened → sealed → returned → settled 퍼널이 모든
    작업의 존재 이유다. 어떤 변경도 겨냥하는 퍼널 단계를 선언해야 한다.

## 바인딩 제약 (CLAUDE.md의 상위 규칙, 위반시 어떤 개선도 무효)
1. Zero-Judgment Gate + mirror clause: 어떤 새 표면도 사용자를 평결하지
   않고, 개입 여부를 사용자 대신 판단하지 않는다. 기본값은 절제다.
2. Honest Structure: 끊긴 와이어는 시끄럽게 실패하거나 정직하게 드러난다.
   모델의 그럴듯한 땜질로 가려지지 않는다. 모든 새 배선에 소비 계약
   테스트를 건다.
3. 자르는 것이 더하는 것보다 낫다. 새 객체·새 저장소·새 알림 시스템을
   만들기 전에, 이미 있는 것(§3.0 Ground Truth 표)을 반드시 먼저 확인하라.
   이 코드베이스는 "이미 있는 걸 또 만든" 사고를 여러 번 겪었다.
4. 현실 접촉 후 행수를 본다: 기능이 "동작하는 것처럼 보임"과 "예상
   테이블에 행이 늘었음"은 다른 사실이다. 후자를 확인한다.

## 하지 않을 것 (명시적 비목표 — 하고 싶어져도 하지 마라)
- 엔진 재작성, 새 에이전트/페르소나, 멀티에이전트 심화 (별도 트랙:
  AGENT-ARCHITECTURE-FOUNDATIONAL의 F1~F4가 이미 설계됨. 중복 착수 금지)
- MCP의 HTTP/OAuth 원격 전송 (창업자 결정 대기 중 — MCP-COMPLIANCE-AUDIT F1b)
- 랜딩 전면 재작성 (2026-07-07에 방금 재구축됨. 영수증 증거물 주입만 허용)
- 새 DESIGN-* 설계문서 작성 (이 문서가 마지막이다. 계기판의 settled가
  움직일 때까지 설계는 동결, 실행만 한다)
- i18n 확장, 모바일 네이티브, 팀/조직 기능

## 완료의 정의 (전체)
콜드 스타트 사용자가 ①어느 문으로 들어와도 3분 안에 첫 봉인에 도달하고,
②정한 날에 한 번의 클릭으로 귀환 화면에 도착하고, ③30초 안에 정산을 마치고
다음 손잡이를 받으며, ④이 전 과정이 /admin 퍼널에 표면별(web/mcp/plugin)
행으로 남는다. 그리고 ⑤그 여정 전체가 fixture 하나로 CI에서 재생된다.

## 방법
- 각 Phase를 독립 PR로. PR 본문 첫 줄에 "겨냥 퍼널 단계: X→Y"를 쓴다.
- 판단이 필요해 보이는 지점을 만나면 §3.7(결정된 질문들)을 먼저 보라.
  거기 없으면 멈추고 물어라 — 그럴듯하게 지어내지 마라.
- 각 Phase의 수용 기준은 전부 기계 확인 가능하게 유지한다 (테스트,
  행수, 클릭 수). "느낌이 좋아졌다"는 수용 기준이 아니다.
```

---

## §3. 응답 — 상세 실행 계획

### §3.0 Ground Truth — 이 계획이 딛고 서는 코드 사실 (실행 전 검증하라)

| 사실 | 위치 | 이 계획에서의 역할 |
|---|---|---|
| seal→settle 루프 전 구간 구현됨 | `src/lib/decision-contract.ts`, `stores/types.ts` Predicate 계열 | 재사용. 새 객체 금지 |
| 4-tap 귀환 화면 + 체크포인트 엔진 | 2026-07-06~07 커밋 (`feat(checkpoints)` 계열) | Phase 3의 기반 |
| 영수증 목록/상세/봉인/정산 UI | `src/components/review/` (ReceiptList, ReceiptView, SealModal, SettleModal, PremiseTracker) | Phase 1에서 승격 |
| 함대 홈(봉인된 항해 + due 정렬) | `src/app/[locale]/project/page.tsx` (1,095줄, FleetChart, useDueCount) | **이미 항구다.** Phase 1에서 홈으로 지정 |
| MCP→계정 브리지 (PAT, opt-in) | `src/app/api/mcp/seal/route.ts` → `review_receipts` | Phase 2에서 기본 경로화 |
| MCP 13 도구, verdict 도구 구조적 부재 | `argus-mcp/src/tools/index.ts` | 도구 추가 금지의 근거 |
| 한 뇌 공유 + 드리프트 가드 | `premises-core.ts` (웹·MCP byte-for-byte, `premises-core-drift.test.ts`) | Phase 2 영수증 패리티의 모범 패턴 |
| 귀환 트리거 4종 | check-in cron 이메일, companion-brief cron, /workspace due-strip, statusline | Phase 3에서 딥링크만 보강 |
| /admin 퍼널 (signup→사용→프로젝트→seal→settle, plugin 분리, return_loop 섹션) | `src/app/[locale]/admin/page.tsx` | Phase 0에서 완성 |
| 공유 링크 인프라 | `src/app/d/[token]/page.tsx` + `shared_links` 테이블 | Phase 4 영수증 공유의 기반 |
| 랜딩 히어로 입력 → `/workspace?q=` | `src/components/landing/SirenHero.tsx:80` | Phase 1에서 재라우팅 |
| 토큰 발급 흐름 | Settings에서 push token 발급 → `/import` 안내 | Phase 2에서 한 화면화 |

검증 명령: 위 각 행에 대해 `git log --oneline -3 -- <path>`로 이 문서 작성
이후의 변경을 먼저 확인하라. 다른 세션이 이미 고쳤으면 해당 작업을
`RESOLVED (commit <hash>)`로 표시하고 건너뛴다 (MCP-COMPLIANCE-AUDIT의 재검토
절차와 동일한 규약).

### §3.0b 실행 순서와 의존성

```
Phase 0 (계기판 완성)  ── 반나절, S ──> 이후 모든 Phase의 측정 기준선
Phase 1 (항구가 홈)    ── M ──> 웹 문. Phase 0의 returned 계측을 사용
Phase 2 (두 문 잇기)   ── M ──> MCP 문. Phase 1의 항구가 착지점
Phase 3 (귀환 30초)    ── M ──> 루프 폐쇄. Phase 1·2 위에서 동작
Phase 4 (영수증=자산)  ── M ──> 루프가 닫힌 뒤의 증폭기
Phase 5 (회로 차단기)  ── S ──> 프로세스 규칙. 언제든 가능, Phase 0 직후 권장
```

Phase 0→1→2→3이 임계 경로다. 4·5는 병렬 가능.

---

### Phase 0 — 계기판을 개발 루프 안으로 (S, 반나절)

**겨냥 퍼널 단계: 계측 자체 (모든 단계의 전제조건)**

왜 첫 번째인가: 이후 모든 Phase의 수용 기준이 "퍼널 숫자가 움직였나"이기
때문이다. 계기판이 불완전하면 나머지 전부가 다시 '느낌'으로 평가된다.

작업:
1. `/admin` 퍼널에 **returned 단계를 1급으로 추가**: 귀환 화면(4-tap)이 열린
   횟수와 유니크 사용자. 이미 `return_loop` 섹션이 있으니 (`admin/page.tsx:22`)
   그 데이터 소스를 확인하고, 없으면 `track()` 이벤트(`src/lib/analytics.ts`
   경유)를 귀환 화면 mount에 심는다. 이벤트명은 기존 컨벤션을 따른다.
2. **표면별 분해를 한 표로**: web / mcp / plugin 각각의 opened, sealed,
   returned, settled. `plugin_sealed`/`plugin_settled`는 이미 있고, MCP 유입은
   `api/mcp/seal`이 남기는 행에 source 필드가 있는지 확인 — 없으면
   `review_receipts.data` jsonb에 `source: 'mcp'`를 기록하게 한 줄 추가
   (jsonb 내부라 마이그레이션 불요 — lean_after 선례).
3. **주간 스냅샷 1줄**: cron이 이미 있다(companion-brief). 거기에 운영자
   (관리자 계정)에게만 가는 주간 퍼널 요약 1통을 추가하거나, 더 싸게는
   /admin에 "지난 7일 vs 그 전 7일" 열만 추가한다. **새 알림 시스템 금지** —
   기존 cron/이메일 배관에 얹는다.

수용 기준:
- [ ] /admin에서 표면별 opened→sealed→returned→settled가 한 표로 보인다.
- [ ] 각 단계의 데이터 소스가 실제 테이블 행수와 일치한다 (SQL 대조 각 1회,
      결과를 PR 본문에 기록).
- [ ] 이후 PR 템플릿 관례 시작: 본문 첫 줄 "겨냥 퍼널 단계: X→Y".

하지 말 것: 외부 분석 도구 도입, 대시보드 라이브러리 추가, 이벤트 대개편.

---

### Phase 1 — 웹앱 IA 반전: 항구(Harbor)가 홈이다 (M, 1~2일)

**겨냥 퍼널 단계: opened→sealed (첫 봉인 도달률), 그리고 재방문→returned**

왜: §1.2의 "집 세 군데, 현관은 엉뚱한 곳" 문제. 신세대의 홈(`/project`)은
이미 1,095줄짜리 완성품인데 IA가 그것을 보조 화면으로 두고 있다. **새 화면을
만드는 게 아니라 문패를 바꾸는 작업이다.**

작업:
1. **`/project`를 로그인 후 기본 착지점으로.** 라우트 URL은 유지(링크 안정성),
   내비게이션 라벨을 "항구(Harbor)"로 바꾼다. `auth/callback` 및 로그인 후
   리다이렉트 대상을 `/workspace` → `/project`로 변경. 로그인 사용자가 랜딩
   헤더의 CTA를 누를 때도 `/project`로.
2. **항구의 3단 구성만 손본다** (이미 다 있는 요소의 배열):
   상단 = due-strip (오늘 귀환할 것, 있으면 화면의 주인공) →
   중단 = FleetChart + 살아있는 결정 목록 (다음 check-by 날짜 표시) →
   하단/우상단 = 유일한 생성 CTA "새 결정 열기" → `/workspace`.
   영수증 목록(`/tools/review`)은 항구의 한 섹션으로 인라인하거나 최소한
   1급 탭으로 승격한다. 판단 기준: ReceiptList가 이미 route-호환이면 탭,
   props 주입이 가벼우면 인라인. (§3.7 Q3)
3. **빈 항구 = 가르치는 화면.** 결정 0건일 때: 예시 영수증 1장(정적 fixture,
   `demo-data`의 기존 시나리오 재사용)과 "첫 결정 열기" 버튼. 절대 튜토리얼
   모달·코치마크 금지 — 예시 영수증 그 자체가 설명이다.
4. **랜딩 히어로 입력의 목적지 유지, 귀결 변경.** `SirenHero.tsx:80`의
   `/workspace?q=`는 유지하되(생성의 문은 저기가 맞다), **생성 흐름의 끝
   (seal 완료)에서 사용자를 반드시 `/project`(항구)로 착지시킨다** — "봉인됨.
   당신의 항구에 정박했고, {check_by}에 다시 부른다" 한 줄과 함께. 첫
   사용자의 멘털 모델에 '돌아올 곳'을 심는 것이 이 Phase의 진짜 목적이다.
5. **구세대 흐름 강등 (삭제 아님).** `/tools/reframe|recast|rehearse|synthesize`
   는 이미 /tools 아래에 있다 — 내비게이션에서 "도구" 서랍 안으로만 내리고
   라우트·기능은 그대로 둔다. `/workspace` 안의 구세대 step 진입점이 기본
   노출되어 있으면 progressive flow 뒤로 접는다.

수용 기준:
- [ ] 콜드 사용자(스토리지 빈 상태) 기준: 랜딩 → 질문 입력 → 첫 seal →
      항구 착지까지 강제 클릭 수를 세어 PR에 기록, 기존 대비 감소.
- [ ] due 항목이 있는 사용자: 로그인 → 귀환 화면까지 2클릭 이하.
- [ ] 빈 항구가 예시 영수증과 단일 CTA를 보여준다 (Playwright 스냅샷 1장).
- [ ] `/tools/review`, `/project` 기존 URL 전부 200 유지 (링크 부수지 않음).
- [ ] 퍼널: 이 PR 이후 opened→sealed 전환이 계기판에서 관찰 가능.

하지 말 것: /workspace 리팩터·삭제 (50-import 정리는 유혹적이지만 이 Phase의
목적이 아니다 — 문패가 먼저, 청소는 루프가 닫힌 뒤), 새 온보딩 위저드,
라우트 개명.

---

### Phase 2 — 두 문 잇기: MCP↔웹 브리지를 기본 경로로 (M, 1~2일)

**겨냥 퍼널 단계: mcp sealed→(계정 연결)→returned**

왜: §1.3. stdio MCP는 스스로 깨어나지 못한다 — MCP에서 봉인된 결정의 귀환은
구조적으로 웹/이메일이 담당해야 한다(companion-mechanisms §0 "배경 알림은
반드시 다른 채널과 합작"). 브리지는 이미 있으니(§3.0) **기본 경로로 승격
+ 소비 계약으로 고정**이 전부다.

작업:
1. **`argus_init` 출력에 연결 제안 1줄.** 계정 토큰이 없을 때 init 결과
   말미에: "이 봉인들은 로컬에만 남는다. 정한 날에 이메일로 돌아오려면:
   argus.voyage/import에서 토큰 발급 → `argus_config`로 등록." 딱 이 톤 —
   지시("~해라") 금지, 손잡이 반환만 (스파인의 절제 규칙).
2. **미연결 `argus_seal` 성공 시 조용한 1줄, 단 한 번.** 같은 문구의 축약형.
   config에 `account_nudge_shown: true` 플래그를 저장해 **평생 1회**로 제한
   (§3.7 Q4). 이미 유사한 침묵 상한 패턴이 체크포인트 엔진에 있다 — 재사용.
3. **`/import` 페이지를 "한 화면 완결"로.** 현재 320줄, Settings로 보내는
   구조(`import/page.tsx:141-149`). 이 화면에서 직접: ①토큰 발급 버튼(기존
   Settings 발급 로직 재사용) ②복사 가능한 `claude mcp add argus -- npx -y
   argus-decision-mcp` 블록 ③복사 가능한 `argus_config` 등록 명령 블록.
   세 블록이 위에서 아래로, 다른 화면 왕복 0회.
4. **E2E 소비 계약 테스트 (이 Phase의 핵심 성과물).** fixture:
   MCP `argus_seal`(토큰 mock) → `api/mcp/seal` route → `review_receipts`에
   행 생성 → 항구 due-strip 훅(`useDueCount`)이 그 행을 집계 → check-in cron
   쿼리가 그 행을 선택. 각 홉을 한 테스트 파일에서 검증. Persistence
   Declaration 3항("행수도 본다")의 자동화판이다.
5. **영수증 렌더 패리티 가드.** MCP `render-receipt.ts`와 웹 `ReceiptView`가
   같은 fixture 영수증에 대해 **같은 필드 집합**을 표기하는지 대조하는 테스트
   (`premises-core-drift.test.ts` 패턴 복제). 문자 동일이 아니라 내용 계약
   동일 — ASCII와 JSX니까 필드 존재/순서 수준으로.

수용 기준:
- [ ] 콜드 MCP 사용자: `argus_init` → 봉인 → (연결 안내 1회 노출 확인).
- [ ] `/import` 한 화면에서 토큰 발급→연결 명령 복사까지 왕복 0회.
- [ ] 4번 소비 계약 테스트가 CI에서 초록. 이후 이 배선을 끊는 변경은 CI가 막는다.
- [ ] 실계정 스모크 1회: MCP로 봉인 → 항구에서 그 영수증이 보인다 (스크린샷
      + `review_receipts` 행수 확인을 PR에 기록).
- [ ] 계기판: mcp 표면의 sealed가 0에서 1 이상으로 (운영자 자신의 dogfood로).

하지 말 것: 새 MCP 도구 추가(13개로 충분 — verdict 부재가 제품이다), HTTP
전송, 토큰 자동발급(보안 검토 없이 금지), nudge 반복 노출.

---

### Phase 3 — 귀환 30초를 진짜로 배선한다 (M, 1~2일)

**겨냥 퍼널 단계: sealed→returned→settled (활성화 절벽의 정면)**

왜: 47/0/0의 절벽은 타입 체계가 아니라 (a) 돌아올 이유 (b) 30초 완결로만
건드려진다(checkpoints-v2 §Q2). 4-tap 귀환 화면·1차 정산·growth note는 방금
구현됐다(2026-07-06~07 커밋). 남은 것은 **끊길 수 있는 와이어를 전부 잇고
시끄럽게 만드는 것**이다.

작업:
1. **이메일 딥링크.** check-in cron 이메일의 CTA가 일반 링크가 아니라 **해당
   결정의 귀환 화면**을 직접 여는 딥링크인지 확인, 아니면 만든다
   (`/project?return=<id>` 쿼리 → 항구 mount 시 해당 4-tap 화면 자동 오픈).
   이메일→귀환 화면이 정확히 1클릭.
2. **statusline/plugin 경로 확인.** plugin statusline의 OVERDUE 표시에서
   귀환까지의 경로가 존재하는지 — 없으면 statusline 문구에 웹 딥링크 안내를
   추가한다 (plugin 자체 수정은 비목표, 문구만).
3. **luoop 소비 계약을 fixture로 CI에.** checkpoints-v2 §5가 명시한 단선
   후보 4곳: seed→seal 승계, due→표면 노출, growth note의 기록-근거성,
   귀환 기록→patterns 반영. 이미 loop-contract 테스트가 있다면
   (2026-07-06 커밋 `test(checkpoints): loop-contract`) 커버리지를 위
   4곳 기준으로 검사하고 빠진 홉만 추가.
4. **"아직 모르겠다"의 다음 손잡이.** 4-tap 중 '아직 모르겠다'가 벌점 없이
   다음 return handle을 낳는 1급 경로인지 실제 클릭으로 확인 (checkpoints-v2
   §7의 결정 사항). 죽은 끝이면 고친다.
5. **growth note validator.** 성향 어휘 차단 validator가 실제로 물려 있는지
   확인 (checkpoints-v2 §10·§11). 프롬프트에만 있고 validator가 없으면
   결정론 차단 목록을 추가한다 — "당신은 ~한 사람" 계열이 한 번이라도 새면
   스파인 위반이다.

수용 기준:
- [ ] seeded fixture 하나가 seal→due→이메일 페이로드→귀환 화면→settle→
      patterns 반영까지 CI에서 완주한다.
- [ ] 이메일 CTA 1클릭 = 해당 결정의 4-tap 화면 (실메일 스모크 1회, 스크린샷).
- [ ] 30초 계약: 귀환 화면의 필수 인터랙션이 탭 4개 + 후속 질문 최대 1개
      + 자유입력 전부 optional임을 테스트가 고정.
- [ ] 계기판: returned > 0, settled > 0 (운영자 dogfood 1건이라도 — 이 숫자가
      이 리포 역사상 처음으로 0에서 움직이는 순간이 이 Phase의 완료다).

하지 말 것: 새 알림 채널(푸시·슬랙 등) 추가, 귀환 화면에 통계·점수·조언 추가.

---

### Phase 4 — 영수증을 자산으로 (M, 1~2일, Phase 1~3과 병렬 가능)

**겨냥 퍼널 단계: settled→(공유)→신규 opened (루프의 증폭기)**

왜: §1.5. 정산까지 간 사용자가 받는 물건이 "화면 속 상태"가 아니라 "간직하고
자랑할 수 있는 한 장"이면, 영수증 자체가 유통 경로가 된다. 인프라는 있다.

작업:
1. **영수증 공유 페이지.** `/d/[token]` 공유 인프라에 영수증 타입을 추가
   (`shared_links.content`에 영수증 JSON, 렌더는 ReceiptView 재사용). 공유는
   명시적 버튼으로만 — 기본 private (외부 공개는 사용자의 행위여야 한다).
2. **OG 이미지.** 공유된 영수증 링크의 OG 이미지를 `next/og`로 생성 — README
   상단의 ASCII 영수증 구도를 그대로: 질문 1줄, YOU PREDICTED / WHAT HAPPENED,
   그리고 맨 아래 `AI VERDICT ── NONE`. 이 한 장이 제품 광고 전체다.
   (boss의 `opengraph-image.tsx` 선례 참고.)
3. **디자인 방향 (실행자에게 잠금):** 원장(ledger) 타이포그래피 — 고정폭
   숫자(tabular-nums), 얇은 괘선, 봉인 스탬프 느낌의 seal 마크, 다크/라이트
   양대응. 장식 금지: 그라데이션·글로우·마스코트 없음. 이 물건의 힘은
   "문서스러움"이다. 웹 ReceiptView도 같은 DNA로 정돈 (구조 변경 없이 시각만).
4. **랜딩 증거물 주입.** UseCases 또는 Act2에 실제 렌더된 영수증 1장을
   정적으로 삽입 (랜딩 재작성 금지 — 컴포넌트 1개 추가만).
5. **PNG 내보내기 (S, 선택).** 공유 페이지에서 "이미지로 저장" — html-to-image
   류 의존성 1개가 필요하므로, 의존성 추가가 부담이면 OG 이미지 URL 자체를
   저장 대상으로 안내하는 것으로 대체 가능 (§3.7 Q5).

수용 기준:
- [ ] 정산된 영수증에서 공유 버튼 → 링크 → 비로그인 브라우저에서 열림 +
      OG 이미지가 카드로 렌더 (실제 페이스북/트위터 디버거 캡처 1장).
- [ ] 공유는 opt-in이며 기본 상태에서 외부 노출 0 (테스트).
- [ ] 랜딩에 실물 영수증 1장 노출.

하지 말 것: 랜딩 구조 변경, 영수증에 점수/등급/뱃지 추가 (제일 위험한 유혹 —
"정산 5회 달성!" 같은 게이미피케이션은 스파인 위반이다. 영수증은 기록이지
트로피가 아니다).

---

### Phase 5 — 회로 차단기: Reality Gate (S, 1시간)

**겨냥 퍼널 단계: 개발 루프 자체**

왜: §1.1의 뿌리는 코드가 아니라 프로세스에 있다. 규칙 하나를 CLAUDE.md에
박아 뺑뺑이의 재발을 구조적으로 막는다.

작업: `CLAUDE.md`에 아래 섹션 추가 (이 문구 그대로, 짧게 유지):

```markdown
## Principle: Reality Gate (2026-07-07)

Argus의 제1원리(plausible ≠ verified)는 Argus 자신에게도 적용된다.

1. 모든 PR은 본문 첫 줄에 겨냥하는 퍼널 단계(opened→sealed→returned→settled
   중 하나)를 선언한다. 선언할 수 없는 작업은 보안·버그·법적 사항이 아닌 한
   보류한다.
2. /admin 퍼널의 settled가 움직이기 전까지: 새 DESIGN-* 설계문서, 새 스파인
   불변식, 구조 리팩터를 동결한다. 설계는 충분하다 — 부족한 것은 정산이다.
3. 감사·설계 문서를 새로 쓰고 싶어지면, 대신 기존 문서의 미실행 항목 하나를
   실행한다.
```

추가로 (선택, S): `docs/` 상위에서 superseded 문서들을 `docs/archive/`로
이동하는 스윕 — 실행 세션의 read-first 오염을 줄인다. 이동만, 삭제 금지.

수용 기준: CLAUDE.md diff 1개. 이후 PR들이 규칙 1을 따르는지는 리뷰 관례로.

---

### §3.6 전체 완료 후의 모습 (이 사이클의 settle 조건)

이 계획 자체가 하나의 결정이므로, Argus 방식으로 봉인한다:

> **예측:** Phase 0~3 완료 + 운영자 dogfood 2주 후, 계기판의 settled가 0이
> 아니고, 외부 사용자 최소 1인이 "봉인→귀환 이메일→정산"을 완주한다.
> **check-by: 2026-07-28.**
> **빗나가면:** 문제는 IA·배선이 아니라 가치 제안 자체에 있다는 신호다. 그때는
> 코드가 아니라 첫 사용자 10명과의 대화가 다음 작업이다 — 그것도 이 계기판이
> 있어야 알 수 있는 사실이다.

### §3.7 결정된 질문들 (실행 중 멈추지 않도록 전부 여기서 결정)

| # | 질문 | 결정 | 근거 |
|---|---|---|---|
| Q1 | `/workspace`(구세대 혼재)를 지금 정리하나? | **아니오.** 문패(IA)만 바꾼다 | 루프 폐쇄가 먼저. 청소는 현실 데이터가 어느 흐름이 사는지 알려준 뒤 |
| Q2 | 항구를 새 라우트로 만드나 `/project` 재사용인가? | **`/project` 재사용**, 라벨만 항구 | URL 안정성 + 1,095줄 완성품 재사용. 새 화면 = 세 번째 집 |
| Q3 | 영수증 목록을 항구에 인라인 vs 탭? | 실행자가 결합도 보고 결정하되, **왕복 없는 쪽** | 어느 쪽이든 "항구 안"이면 목적 달성 |
| Q4 | MCP 계정 연결 nudge 빈도? | **평생 1회** (config 플래그) | 절제가 기본. 반복 nudge는 over-fire |
| Q5 | 영수증 PNG 내보내기에 의존성 추가? | **OG 이미지 URL 재사용 우선**, 부족하면 그때 의존성 | 자르는 것이 더하는 것보다 낫다 |
| Q6 | 계기판에 목표 수치(OKR)를 박나? | **아니오.** 단계별 절대수와 7일 추이만 | 0→1 구간에서 목표치는 허구. 움직임 자체가 신호 |
| Q7 | 구세대 4단계 도구를 deprecation 고지하나? | **아니오.** 조용히 강등만 | 사용자 0 확인 상태에서 고지는 무의미한 의식 |
| Q8 | check-in 이메일 빈도·문구 개편? | **안 한다.** 딥링크만 추가 | 이메일 발송 자체는 검증됨(hello@argus.voyage). 변수를 하나만 움직인다 |

### §3.8 지금 하지 않는 것 (재확인)

- MCP HTTP/OAuth 전송 (F1b — 창업자 결정 대기)
- 에이전트 아키텍처 F1~F4 (별도 트랙, 설계 완료 상태로 대기)
- 랜딩 재작성, i18n 확장, 팀 기능, 모바일
- Supabase 스키마 대변경 (jsonb 내부 확장으로 충분한 곳에 컬럼 추가 금지)
- 새 Zustand store (17개면 이미 많다)

---

## 부록 — 이 문서가 참고한 1차 자료

`CLAUDE.md` · `docs/ARGUS-FINAL-DIRECTION.md` ·
`docs/AGENT-ARCHITECTURE-FOUNDATIONAL-2026-07-05.md` ·
`docs/MCP-COMPLIANCE-AUDIT-2026-07-05.md` ·
`docs/DESIGN-judgment-checkpoints-v2-2026-07-06.md` ·
`docs/DESIGN-clarify-question-system-v2-2026-07-06.md` ·
`docs/DESIGN-SPEC-companion-mechanisms-2026-07-05.md` ·
`docs/archive/ARGUS-FABLE-REVIEW-PROMPT.md` (프롬프트 형식의 선례) ·
`argus-mcp/` 전체 · `src/app/[locale]/{project,workspace,import,admin}` ·
`src/app/api/mcp/seal/route.ts` · `src/components/{review,landing,workspace}` ·
git log 2026-07-05~07 구간.

주: 사용자가 언급한 `docs/FABLE5-ARGUS-WEBAPP-MCP-DIAGNOSTIC-BRIEF-2026-07-07.md`는
리포에 존재하지 않아(로컬 미푸시로 추정) 참조하지 못했다. 이 문서의 진단은
코드베이스·문서 전수 독해로 독립 수행한 것이다. 브리프가 푸시되면 §1과
대조하여 차이만 반영하라.
