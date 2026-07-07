# 05 — 뺄셈의 완성도: 화면 3개만 남긴다면

> 감사일: 2026-07-03 · 대상: 웹앱 전체 라우트(src/app) + 각 화면의 버튼/링크 실측
> 기준: 핵심 루프 **결정 입력 → 봉인(seal) → 정산(settle)** 를 살리는가
> 소스코드는 건드리지 않았고, 모든 인용은 실제 파일을 열어 확인한 것만 적었다.

## 요약 (5줄)

1. **상단 메뉴는 이미 3개다**(워크스페이스·프로젝트·설정 — `src/components/layout/Header.tsx:32-36`). 문제는 메뉴가 아니라 그 아래 — 라우트가 24개이고, 핵심 입력 화면 위에 옆길 4개가 그대로 놓여 있다.
2. **가장 큰 발견(P0) 두 개**: ① 워크스페이스 첫 화면(결정을 적는 바로 그 자리) 밑에 "AI 팀 소개·보고 상대 설정·팀·가이드" 칩 4개가 나란히 있어 첫 입력 전에 시선을 넷으로 쪼갠다. ② "돌아와서 정산하는 집"이 둘로 갈라져 있다 — 프로젝트 정산은 `/project`, 문서검수 정산은 `/tools/review`. 상단 배지가 상황 따라 다른 집으로 보내고, `/project`에서는 검수 영수증이 아예 안 보인다.
3. **남길 3개 화면**: ① 워크스페이스(입력+봉인) ② 프로젝트(단일 귀환 항구 — 검수 영수증 합류) ③ 검수(/tools/review, 문서 입구). 설정은 "화면"에서 빼되 삭제 금지(내보내기·계정삭제는 법적 약속).
4. **접거나 물릴 것**: 레거시 4-탭 모드와 /tools/reframe·recast·rehearse·synthesize(같은 부품의 3중 문), /agents·/boss(게임·시뮬 표면), /design/*(어디서도 링크 안 되는 고아 라우트 2개), 가이드의 레벨/XP/체인 해금 문단(옛 세계관).
5. 남는 3개 화면은 이미 상당히 잘 다듬어져 있다(로딩 경과초·취소 버튼·정직한 에러 분류가 이미 있음). 마지막 디테일 스펙(빈 화면 문구, 낡은 카피, 검색/필터 접기)을 아래에 적었다.

---

## 1. 전수 목록 — 라우트 24개, 세 무리

`src/app/[locale]/**/page.tsx` + `src/app/d/[token]/page.tsx` 전부. (api 라우트 제외)

### 무리 1 — 핵심 루프를 살리는 것 (남긴다)

| 라우트 | 근거 |
|---|---|
| `/workspace` | 입력→BindCard(밧줄=이른 봉인, `workspace/page.tsx:813-819`)→항해→SealMoment. 루프의 앞 절반 전부. |
| `/project` | 귀환 표면: due 스트립(`project/page.tsx:478-505`), SettlementModal 자동 오픈(`project/page.tsx:109-119, 838-846`), 자차표 "나의 기록"(`project/page.tsx:454-475`). 루프의 뒤 절반. |
| `/tools/review` | 문서 입구의 **완결된 두 번째 루프**: 검수→봉인(SealModal)→정산(SettleModal), 영수증 목록(ReceiptList=Active Course). `src/components/review/ReviewFlow.tsx` 전체. 랜딩과 워크스페이스 ON FILE 문(`workspace/page.tsx:603-620`)이 여기로 민다. |
| (화면 아님) `/login`, `/auth/callback` | 문이 아니라 자물쇠. 유지. |
| (화면 아님) `/d/[token]` | 봉인 산출물의 **바깥 공유 뷰**(`src/app/d/[token]/page.tsx`) — 사용자 화면 수에 안 들어가고, 유일한 바이럴 표면. 유지. |

### 무리 2 — 방해하지 않지만 흐리는 것 (뒤로 물린다)

| 라우트 | 현재 위치 | 판단 |
|---|---|---|
| `/settings` (1,081줄) | 상단 메뉴 3번째 | 유지하되 "핵심 3화면" 자리는 검수/프로젝트에 양보(아래 S2). 내보내기·계정삭제(`settings/page.tsx:716-749`)는 법적 약속이라 삭제 불가. |
| `/import` | Header 더보기(…) 메뉴(`Header.tsx:47`) | 이미 잘 물러나 있음. 그대로. |
| `/teams` | Header 더보기 + 워크스페이스 칩(중복!) | 더보기에만 남기고 워크스페이스 칩에서 제거(F1). |
| `/guide` | Header 더보기 + 워크스페이스 칩(중복!) | 동일 + 내용 정리(F5). |
| `/admin`, `/admin/utm-builder` | 운영자 이메일 게이트(`Header.tsx:18,45,50`) | 일반 사용자에게 안 보임. 그대로. |
| `/privacy`, `/terms` | 푸터 | 그대로. |
| `/` (랜딩) | 앱 밖 마케팅 캔버스(`src/app/[locale]/page.tsx`) | 앱 화면 수에 안 셈. 그대로. |

### 무리 3 — 루프에서 시선을 빼앗는 것 (제거 또는 접기)

| 라우트/표면 | 무엇이 문제인가 |
|---|---|
| 워크스페이스 idle 칩 4개 | `workspace/page.tsx:627-643` — 입력창 바로 아래 `/agents`·`/boss`·`/teams`·`/guide` 링크. **첫 문장을 적기 전에 옆길이 넷.** teams·guide는 Header 더보기(`Header.tsx:46-51`)와 이중 노출. |
| `/agents` (선원 명부) | AgentHub — XP/레벨 진행 게임 UI(`src/components/agents/AgentHub.tsx:93` 주석 스스로 "progression flavor"라 부름). 루프에 아무것도 더하지 않음. |
| `/boss` (팀장 시뮬) | MBTI+생년 설정→채팅(`src/app/[locale]/boss/page.tsx`). 루프 밖 별동대. 단, `?reviewer=` 핸드오프로 워크스페이스와 연결돼 있어(`workspace/page.tsx:1017`) 라우트 자체는 살리되 문만 옮긴다. |
| 레거시 4-탭 모드 | `/workspace?step=reframe…` (`workspace/page.tsx:1013-1014, 1129-1279`) — 항해 플로우와 **다른 UI의 같은 앱**이 URL 파라미터 하나로 나타남. 모바일 하단 탭바까지 따로 있음(`workspace/page.tsx:1258-1277`). |
| `/tools/reframe`·`recast`·`rehearse`·`synthesize` | 같은 Step 컴포넌트의 독립 페이지(예: `src/app/[locale]/tools/reframe/page.tsx:10-14`). 즉 **같은 두뇌에 문이 3개**(항해/4-탭/독립페이지). `NextStepGuide.tsx:32,42,65`와 `guide/page.tsx:445-448`이 아직 이 문으로 사용자를 보낸다. |
| `/tools/refine` | 이미 리다이렉트 스텁(`tools/refine/page.tsx:17-23`). 올바른 상태. 그대로. |
| `/design/foundry`, `/design/workspace` | **어디서도 링크되지 않는 고아**(grep으로 src 전체에서 인바운드 링크 0건 확인). 디자인 레퍼런스인데 PUBLIC_PATHS로 공개돼 있음(`src/lib/public-paths.ts:17`). |
| 가이드의 레벨/XP/체인 문단 | `guide/page.tsx:331-364` — "체인 작업 N회 해금", "Lv.2 (xx XP)" 등 게임 세계관 설명이 사용 가이드의 한 축. 새 항해 플로우 사용자가 만나는 것과 다른 앱을 설명함. |

---

## 2. 발견 목록 (심각도순)

### P0-1. 핵심 입력 화면 위의 옆길 4개 — `src/app/[locale]/workspace/page.tsx:627-643`

워크스페이스는 "지금 들고 있는 결정, 어디서 갈리는지 봐 드릴게요"(`workspace/page.tsx:530`)라는 단 하나의 요청으로 열리는데, 입력 카드와 에러 영역 사이에 칩 4개(AI 팀 소개/보고 상대 설정/팀/가이드)가 끼어 있다. 이 중 팀·가이드는 상단 더보기 메뉴에 이미 있어(`Header.tsx:46-51`) 순수 중복이고, AI 팀 소개·보고 상대 설정은 첫 결정을 적기 전에는 의미가 없는 문이다. Things/Bear급 앱의 첫 화면은 "쓸 곳 하나 + 시작 버튼 하나"다.

**고치는 법**: §3 스펙 S1.

### P0-2. 귀환(정산) 항구가 둘 — `Header.tsx:83-86` + `/project`와 `/tools/review`의 단절

- 상단 "돌아올 결정" 배지는 프로젝트 due와 검수 due를 **합산**해 보여주면서(`Header.tsx:83`), 클릭하면 `projectDueCount > 0 ? '/project' : '/tools/review'`로 **둘 중 한 집에만** 보낸다(`Header.tsx:86`). 프로젝트 due 1건 + 검수 due 3건이면 배지는 4인데 `/project`에 가면 1건만 보인다.
- `/project`는 검수 영수증을 전혀 모른다 — `project/page.tsx`의 import 목록(1-29행)에 `useReviewStore`가 없고, due 스트립(`project/page.tsx:260-266`)은 `projects`만 필터한다.
- 즉 "정한 날 돌아와 물어요"라는 약속의 **총량을 한 화면에서 볼 수 있는 곳이 없다.** 루프의 마지막 조각(정산)이 제일 약하다는 기존 진단(47 opened/0 settled)과 정확히 같은 자리다.

**고치는 법**: §3 스펙 S2.

### P1-3. 같은 두뇌에 문이 3개 — 레거시 4-탭 + /tools/4종 + 항해 플로우

- `ReframeStep` 등 4개 컴포넌트가 (a) 항해 이전의 4-탭 모드(`workspace/page.tsx:1129-1279`, `?step=`로 진입), (b) `/tools/reframe` 등 독립 페이지(각 15줄 래퍼), 두 곳에 노출된다. 코드는 한 벌이라 Single Source 위반은 아니지만, **사용자 눈에는 서로 다른 세 개의 앱**이다.
- 낡은 문으로 보내는 링크가 살아 있다: `guide/page.tsx:445-448`(LegacyChip 4개), `src/components/ui/NextStepGuide.tsx:32,42,65`.
- 기존 데이터 호환: 레거시 스토어(reframe/recast/synthesize items)를 가진 옛 프로젝트가 실존하므로(project 페이지가 아직 읽음, `project/page.tsx:300-358`) **라우트를 지우면 안 되고 새 유입만 끊어야 한다.**

**고치는 법**: §3 스펙 S3.

### P1-4. /agents·/boss — 루프 밖 게임 표면이 앞줄에 서 있음

- `/agents`는 XP/레벨 진행("progression flavor", `AgentHub.tsx:93`), `/boss`는 MBTI 시뮬레이터. 스파인 위반은 아니다(레벨은 사용자가 아니라 AI 페르소나에 대한 것) — 하지만 "결정을 적고, 묶고, 돌아온다"는 이야기에서 시선을 빼앗는다.
- 진입점이 워크스페이스 idle 칩(P0-1)뿐이므로, 칩만 걷어내면 라우트 삭제 없이 자연히 뒤로 물러난다. `/boss`는 `?reviewer=` 핸드오프(`workspace/page.tsx:1017`)와 저장된 팀장 데이터(agents 테이블 origin='boss_sim')가 있으므로 **라우트 유지**.

**고치는 법**: §3 스펙 S1(칩 제거)로 해소. 라우트는 건드리지 않음.

### P1-5. 가이드가 다른 앱을 설명함 — `src/app/[locale]/guide/page.tsx:331-364, 445-448`

레벨(Lv.1~5, XP), 체인 해금 횟수, 항해사 해금 조건을 설명하는 문단과, 레거시 4단계로 직행하는 LegacyChip 4개. 새 사용자가 처음 여는 문서가 현재의 항해 플로우(밧줄→항해→봉인→귀환)가 아니라 게임 시스템을 가르친다.

**고치는 법**: §3 스펙 S4.

### P1-6. /design/* 고아 라우트 2개가 공개 — `src/lib/public-paths.ts:17`

`src/app/[locale]/design/foundry/page.tsx`(288줄), `design/workspace/page.tsx`(252줄)는 src 어디서도 링크되지 않는 디자인 쇼케이스인데 공개 경로다. 해는 없지만 "앱의 방 개수"를 늘리고, URL을 아는 사람에게 미완성 인상을 줄 수 있다.

**고치는 법**: §3 스펙 S5.

### P2-7. 낡은 카피 — 프로젝트 페이지가 아직 "4단계 프로세스"를 말함

- `project/page.tsx:400,420` 부제: "사고 프로세스의 전체 여정을 한눈에 확인합니다" — 항해 어휘가 아님.
- `project/page.tsx:433` 빈 화면: "…4단계 프로세스의 진행 상황을 여기서 한눈에 확인할 수 있습니다" — 새 사용자는 4단계를 밟지 않는다(항해 플로우가 기본).

**고치는 법**: §3 스펙 S6(정확한 문안 포함).

### P2-8. 프로젝트 목록의 검색+필터 4종이 항상 노출 — `project/page.tsx:508-545`

전체/진행 중/완료/시작 전 필터 + 검색창이 프로젝트 2~3개인 사용자에게도 보인다. 실DB 기준 사용자 대부분이 한 자릿수 프로젝트다(기존 감사: 13 users/47 projects). Hick의 법칙 — 선택지가 결정을 늦춘다.

**고치는 법**: §3 스펙 S7.

### P2-9. 설정 과밀 — `settings/page.tsx:175-182` (6개 섹션, 1,081줄)

프로필·AI 엔진·환경 설정·연동/데이터·실험실·위험 구역. 오디오 "앰비언트 드론"(`settings/page.tsx:523-524`), Slack 연동(`:557-607`), Labs(`:663-683`)가 API 키(막혔을 때 필요한 유일한 설정)와 같은 무게로 나열됨. 섹션 네비는 이미 있으니(A1 IA) 순서와 접기만 손보면 된다.

**고치는 법**: §3 스펙 S8.

---

## 3. 구현 스펙

### S1 (P0-1·P1-4). 워크스페이스 idle 칩 4개 제거

- **파일**: `src/app/[locale]/workspace/page.tsx:622-643` — 칩 블록(주석 포함) 전체 삭제.
- Clean Removal: 삭제 후 이 파일에서 `Bot`, `UserCheck`(다른 사용처 확인 필요 — `:630` 외 RehearseStep 아이콘 등), `Users`, `BookOpen` import(`:25`)의 잔존 사용을 grep해서 안 쓰는 아이콘만 import에서 제거.
- 대체 동선: 팀·가이드는 이미 Header 더보기에 있음. `/boss`(보고 상대 설정)는 Header `utilityItems`(`Header.tsx:46-51`)에 한 줄 추가: `{ href: '/boss', label: L('보고 상대 설정', 'Set your reviewer'), icon: UserCheck }`. `/agents`는 항해 중 크루가 이미 보이므로(VoyageMapRail/CrewAtWork) 별도 문 불요 — 더보기에도 넣지 않는 것을 권장(원하면 가이드 본문에서 링크).
- 스파인: 문을 줄이는 것 = 절제 기본값. 위반 없음.

### S2 (P0-2). 귀환 항구를 `/project` 하나로 합류

- **`src/app/[locale]/project/page.tsx`**:
  1. `useReviewStore` import + `load()` 호출을 기존 로드 이펙트(`:91-99`)에 추가.
  2. due 스트립(`:478-505`)에 검수 due 영수증을 합쳐서 렌더: `summarizeReceipt(r, today).urgent`인 영수증을 프로젝트 버튼들 뒤에 같은 모양의 칩으로 추가하고, 클릭 시 `/tools/review`의 해당 영수증으로 이동(가장 단순한 1차 구현: `router.push('/tools/review')` — ReceiptList가 urgent를 맨 위에 정렬하므로(`ReceiptList.tsx:49-50`) 목적지에서 길을 잃지 않음).
  3. 스트립 문구는 이미 좋은 카피가 있으므로 유지: "그래서, 어떻게 됐어요? — 돌아올 결정 N건"(`:481-483`)의 N에 검수 due를 합산.
- **`src/components/layout/Header.tsx:86`**: `dueTarget`을 항상 `'/project'`로 고정(분기 삭제). 귀환의 집은 하나여야 한다.
- 데이터 호환: 읽기만 추가하므로 마이그레이션 없음. 영수증 렌더는 Defensive Data Access 원칙대로 `(receipts || [])`.
- 스파인: 정산을 재촉하는 문구 추가 금지 — 기존 문구("그래서, 어떻게 됐어요?")는 질문형이고 평결이 없어 적합.

### S3 (P1-3). 레거시 문 봉쇄 (라우트는 유지, 새 유입만 차단)

- `src/app/[locale]/guide/page.tsx:445-448`: LegacyChip 4개 블록 삭제(섹션 제목이 남으면 함께). Clean Removal: `LegacyChip` 컴포넌트 정의가 이 파일에만 있으면 같이 삭제.
- `src/components/ui/NextStepGuide.tsx:32,42,65`: `/tools/recast`·`/tools/rehearse` 링크를 `/workspace`로 교체(레거시 4-탭 프로젝트에서만 이 가이드가 뜨는지 먼저 확인 — 레거시 전용이면 그대로 두는 것도 가능. 원칙: **레거시 프로젝트 안에서는 레거시 링크 허용, 새 표면에서는 금지**).
- `/tools/reframe` 등 4개 독립 페이지: 삭제하지 말 것(북마크·옛 세션 복귀 경로). 대신 `tools/refine/page.tsx`처럼 안내 배너 한 줄을 얹는 후속 과제로 기록만: "지금은 워크스페이스 항해로 시작하는 걸 권장해요."
- 기존 데이터: 레거시 스토어를 읽는 코드는 그대로(project 페이지 `:300-358`) — 옛 프로젝트가 계속 열린다.

### S4 (P1-5). 가이드 내용 교체

- `guide/page.tsx:331-364`(체인 해금·레벨 문단): 삭제하거나 "부록: AI 크루의 성장" 접힘(`<details>`)으로 강등.
- 가이드 최상단은 현재 항해 플로우 4박자로: 적는다 → 밧줄을 묶는다(내 예상+확인일) → AI 팀이 갈리는 자리를 보여준다 → 확인일에 돌아와 정산한다. 제안 문안(한글): "① 상황을 한 줄 적어요 ② 듣기 전에 내 예상을 밧줄로 묶어요 ③ AI 팀이 어디서 갈리는지 보여줘요 ④ 정한 날 돌아와 '그래서 어떻게 됐는지' 답해요."
- import 정리: `CHAIN_UNLOCK_THRESHOLDS` 등(`guide/page.tsx:22-27`)이 안 쓰이게 되면 제거.

### S5 (P1-6). /design/* 비공개화

- `src/lib/public-paths.ts:17`에서 `'/design'` 제거 → AuthGuard 뒤로. 또는 운영자 이메일 게이트(admin과 동일 패턴)로. 라우트 삭제는 불요(내부 레퍼런스 가치 있음).
- 주의: `LayoutShell.tsx:22,35`과 `Header.tsx:160`의 `/design` 분기는 그대로 둬도 무해.

### S6 (P2-7). 프로젝트 페이지 카피 3곳

- `project/page.tsx:400,420` 부제 → **"봉인한 결정들이 여기 정박해 있어요. 확인일이 오면 여기로 돌아옵니다."** (en: "Your sealed decisions anchor here. When the check-in day comes, this is where you return.")
- `project/page.tsx:433` 빈 화면 본문 → **"워크스페이스에서 첫 결정을 적으면, 그 항해가 여기 기록됩니다. 확인일이 오면 여기서 '그래서 어떻게 됐는지'를 답해요."** (en: "Write your first decision in the workspace and its voyage lands here. On the check-in day, this is where you answer how it actually went.")
- 빈 화면 CTA(`:437-444`)는 현행 유지(시작하기 + 30초 데모 — 이미 좋음).

### S7 (P2-8). 목록 필터·검색 지연 노출

- `project/page.tsx:508-545`: `projects.length >= 7`일 때만 필터 칩 행+검색창 렌더(상수로 빼서 주석: Hick — 한 화면에 다 보이면 도구가 필요 없다). 7 미만이면 정렬(귀환 due 우선, `:268-280`)만으로 충분.

### S8 (P2-9). 설정 순서 재배치

- `settings/page.tsx:175-182` NAV_ITEMS 순서를 사용 빈도순으로: AI 엔진(막혔을 때 오는 곳) → 프로필 → 연동·데이터 → 환경 설정 → 실험실 → 위험 구역. 오디오 소절(`:484-524`)은 환경 설정 안에서 `<details>` 접기. 기능 삭제는 없음.

---

## 4. 남는 3개 화면 — "사랑받는 인디 앱" 디테일 스펙

전제: 세 화면 모두 이미 수준이 높다(경과초 카운터, 취소, 에러 분류, 빈 화면 CTA가 다 있음). 아래는 **남은** 간극만.

### 화면 1 — 워크스페이스 (`/workspace`)

| 항목 | 현재 (확인됨) | 남은 간극 → 스펙 |
|---|---|---|
| 로딩 | 분석 중 단계 라벨+경과초+"보통 20~40초"+취소(`workspace/page.tsx:882-897`), aria-live 있음 | 없음 — 기준 충족. |
| 빈 화면 | 첫 방문: 헤드라인+3단계 오리엔테이션+데모 타일(`:528-547,760-799`) | S1 적용 후 칩 제거로 완성. |
| 에러 | 쿼터/네트워크/타임아웃 3분류+각각 다른 행동 버튼(`:654-697`) | 없음 — 모범 사례 수준. |
| 긴 텍스트 | 프로젝트명 truncate `max-w-[160px]`(`:139`), 입력 maxLength 5000(`:576`) | 프로젝트명이 160px에서 잘리는데 title 속성이 없음 → `:139` span에 `title={projectName}` 추가(마우스오버로 전체 확인). |
| 한/영 | 전면 `L()` 이중화 확인 | 없음. |
| 모바일 | min-h 44px 일관, iOS 줌 방지 text-base(`:571-577`), 하단 드로어 안전영역(`:134`) | 없음. |

### 화면 2 — 프로젝트/귀환 항구 (`/project`)

| 항목 | 현재 | 남은 간극 → 스펙 |
|---|---|---|
| 로딩 | 스토어 즉시 로드(localStorage-first)라 체감 로딩 없음 | Supabase 머지 지연 중 목록이 "없음"으로 깜빡일 수 있음 — 빈 상태 렌더 전에 `loaded` 플래그가 있으면 그걸 게이트로(스토어 확인 후). 최소한 빈 화면 문구를 단정("없습니다")이 아닌 S6 문안으로 바꿔 오인을 줄임. |
| 빈 화면 | CTA 2개 포함(`:429-445`) | 카피만 S6. |
| 에러 | 동기화 실패는 Header SyncStatus 배지가 담당(`Header.tsx:281`) | 없음. |
| 긴 텍스트 | 카드 제목 line-clamp-2+break-words(`:633`), 상세 제목 break-words(`:767`) | 없음. |
| 한/영 | `L()` 전면 | 자차표 문구(`:459-466`)는 견고. 없음. |
| 모바일 | 그리드 1열 강하(`:553`), due 스트립 세로 스택(`:479`) | due 프로젝트 칩(`:486-501`)이 이름 전체를 렌더 — 긴 이름에서 칩이 화면을 넘을 수 있음 → `max-w-full truncate` 추가. |
| 합류(S2) 후 | — | 검수 영수증 칩은 프로젝트 칩과 동일 톤(amber)으로, 앞에 문서 아이콘(FileText 12px)만 붙여 구분. |

### 화면 3 — 검수 (`/tools/review`)

| 항목 | 현재 | 남은 간극 → 스펙 |
|---|---|---|
| 로딩 | 단계 게이지 5칸+경과 mm:ss+25초 후 안심 문구+취소(`ReviewFlow.tsx:398-440`) | 없음 — 세 화면 중 최고. |
| 빈 화면 | 영수증 0건이면 바로 import 화면(`:87-91`) | 없음(현명한 기본값). |
| 에러 | 타임아웃 정직 실패+복구 안내(`:200-216`), 추출 실패 단계별 안내(`:543-559`) | 없음. |
| 긴 텍스트 | 붙여넣기 5만자 캡+잘림 경고(`:534-541`), 원문 pre break-words(`:343`) | 없음. |
| 한/영 | `L()` 전면 | 없음. |
| 모바일 | 원문/영수증 토글(`:327-334`), md 미만 세로 스택(`:338`) | concern 칩(`:566-578`)과 "검수 시작" 버튼(`:625-627`)에 min-h 44px이 없음(칩은 py-1=낮음) → 칩 `min-h-[36px]`, 시작 버튼은 Button size md라 무난하나 터치 검증 1회 권장. |

---

## 5. 스파인 충돌 검토

- **S1(칩 제거)·S3(레거시 문 봉쇄)·S7(필터 지연)**: 표면을 빼는 방향 = 절제 기본값(over-fire 미러 조항)과 일치. 위반 없음.
- **S2(귀환 합류)**: 정산을 한 집으로 모으는 것이지 정산을 강요하는 게 아님. 문구는 기존 질문형("그래서, 어떻게 됐어요?") 유지 — 평결·점수 문구를 새로 만들지 말 것. SettlementModal의 기존 "아직" 탈출구(연장)는 건드리지 않는다(`project/page.tsx:835-837` 주석 확인).
- **S4(가이드 재작성)**: 제안 문안에 평결·등급 언어 없음. 레벨/XP 문단은 사용자에 대한 점수가 아니라 AI 페르소나에 대한 것이라 **스파인 위반은 아니었음** — 제거 이유는 오로지 시선(초점)이다.
- **S6(카피)**: "봉인한 결정들이 정박해 있어요"는 사실 서술이며 사용자를 판단하지 않음.
- 삭제 제안 전부에서 **사용자 데이터가 지워지는 것은 없다**: 레거시 스토어·boss 에이전트·검수 영수증 모두 읽기 경로 유지. Clean Removal 체크(참조 grep, import 정리)는 각 스펙에 명시했다.

## 부록 — 버튼 단위 실측 근거 (주요 화면)

- Header: 로고, 3 nav(+due 배지 `:178-207`), 더보기(가져오기/팀/가이드/계기판 `:46-51`), KO/EN, 테마, SyncStatus, RateLimitBadge, 계정/로그인 — `src/components/layout/Header.tsx`.
- 워크스페이스 idle: 로그인 배너, 입력+시작, ON FILE 검수 문(`:603-620`), 칩 4(`:627-643`), 이어서 작업 목록(`:700-758`), 데모 3타일(`:760-799`).
- 프로젝트 목록: 새 프로젝트, 자차표 스트립, due 스트립, 필터 4+검색, 카드 그리드(배 비네트+ETA+메트릭).
- 프로젝트 상세: 목록으로, 브리프 복사/다운로드, CurrentBearingCard, DecisionContractCard(봉인), DecisionItemsCard, SettlementModal, 나의 기록.
- 검수: 붙여넣기/업로드, concern 칩 6, 맥락 접기, 원문 저장 토글, 검수 시작 → 영수증(봉인/정산 모달) → 목록(Active Course).
