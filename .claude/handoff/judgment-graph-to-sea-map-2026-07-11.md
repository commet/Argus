# 인수인계 — 판단 그래프·영수증 부품을 새 지도(바다)에 녹이기

날짜: 2026-07-11 · 작성 세션 브랜치: `claude/agent-receipts-accountability-4yxx32` (PR #112, draft)
받는 세션: 창업자가 별도로 짓고 있는 **새 바다 지도** 세션 (지도 완성 후 이 문서로 통합 작업)

> 창업자 판정 요약: "함대 해도(FleetChart)는 내가 생각한 그 지도가 아니다.
> 진짜 지도는 다른 세션에서 만드는 중이고, 완성되면 이 브랜치의 영수증/그래프
> 내용이 그 배경에 녹아야 한다."

---

## 0. 한 문단 요약 (뭘 넘기나)

이 브랜치에는 **판단 그래프 v1**이 완성돼 있다: 봉인된 판단들이 **같은 전제**
위에 서 있는 관계를 결정론으로 계산하는 순수 라이브러리(`judgment-graph.ts`),
그 이벤트를 말하는 1티어 카드(`SharedGroundCard`), 그리고 (대체될 수 있는)
FleetChart 위에 그 관계를 "수중 해류"로 그린 시험 시공. **라이브러리와 카드는
지도-불가지론(map-agnostic)이라 그대로 재사용**하고, 해류 아이디어만 새 지도의
좌표계 위에 다시 그리면 된다.

## 1. 재사용할 부품 (건드리지 말고 그대로 쓰기)

### 1a. `src/lib/judgment-graph.ts` — 관계 엔진 (순수 함수, UI 무관)
- `sharedGrounds(receipts)` — active·monitored 전제를 `normalizePremiseText`
  **정확 일치**로 영수증들 가로질러 그룹핑. 공유 = 서로 다른 영수증 ≥ 2.
  각 그룹: 대표 원문 `text`, `members`(receipt_id+premise), `live_bets`
  (sealed·미정산 predicate + check_by, check_by 오름차순), `drift`(가장 최근
  drifted 재확인: baseline/current 숫자·문장, source_detail, ts).
- `groundSpotlight(receipts)` — **공유 전제가 실제 드리프트를 기록했고 그 위에
  live bet이 설 때만** 그룹 1개 반환, 아니면 null. **절제 기본값** — 플랫한
  날 하이라이트 제조 금지(over-fire 조항). 지도에서도 동일 규칙 적용할 것.
- `sharedGroundCount(receipts, ownId, text)` — 전제 1개의 교차 카운트
  (PremiseTracker의 조용한 한 줄이 소비 중).
- `receiptIsLive(r)` — armed 규칙 단일화(`state==='sealed' || sealed·미정산
  followup 존재`). review-sync/PremiseTracker와 같은 식.
- 테스트: `src/lib/__tests__/judgment-graph.test.ts` (11개 — 정규화 변형
  그룹핑, monitored-only, settled 멤버십은 bets 제외, 정렬, 스포트라이트 절제
  ×3, 카운트, armed).

### 1b. `src/components/review/SharedGroundCard.tsx` — 1티어 이벤트 카드
- 형태 = **내용의 다이어그램**: 판단 플레이트들이 다리(leg)로 서 있고, 다리가
  지반 밴드에 착지, 지반 안에 **드리프트 게이지** `봉인 당시 99 ○────● 오늘 67`
  (실토큰 `--warning`) + 출처. 접힘 표시도 지반 위 점선 플레이트.
- 카피 계약: 인용 → 사실(봉인 당시→오늘, 출처) → 손잡이("사실만 전해요 —
  다시 볼지는 당신 몫이에요"). 라벨 대신 말 거는 문장. 사람의 봉인 문장은
  `--font-voice` 세리프로 크게.
- 플랫한 날 = null 렌더. 테스트 3개(`shared-ground-card.test.tsx`) — 전체 렌더
  + 금지어휘, 침묵 ×2.
- 새 지도가 와도 이 카드는 ①티어에 그대로 두고, 지도는 같은 이벤트를 공간
  언어로 메아리치게 하는 구도가 검증됨.

### 1c. `/project` 위계 선언 (page.tsx 내 구조 주석)
`① 지금(이벤트) → ② 행동(due-strip) → ③ 함대(지도가 주인공) → ④ 항적(아카이브)`
— 새 지도는 **③티어의 주인공 슬롯**에 앉는다. 블록 추가는 이 위계에 자리를
정하고 넣는 게 규칙(주석에 명문).

## 2. 이관할 아이디어 (새 지도 위에 다시 그릴 것)

FleetChart에 시험 시공된 두 가지 — **코드가 아니라 사상을 이관**:

1. **한 바다(one sea)**: 배 = 프로젝트 항해 **+ 봉인된 검수/MCP 영수증**.
   영수증 배 자격: `falsifiable_followups.some(f => f.sealed_at)`. 상태는
   기존 `getVoyageState` 재사용 — `{started:true, completedAllLegs:true,
   lastActivityAt, hasCoda:settled, lastLeg:null, outcomeVerdict: settled ?
   'mixed' : 'pending'}` (계약 매핑과 동일; **두 번째 상태기계 발명 금지**).
   봉인일 = 가장 이른 `sealed_at`. 클릭은 종류별: 프로젝트→상세,
   영수증→`/tools/review`.
2. **수중 해류(currents)**: `sharedGrounds()` 그룹마다, 지도에 실린 멤버 배가
   2척 이상이면 배들 사이를 잇는 물길. 평시 = 잉크 low-opacity(0.22 근처),
   드리프트 = `--warning`(팩트 색이지 평결 아님). x 정렬 후 인접 쌍 체인으로
   그림(전 쌍 연결 아님). FleetChart는 flex라 rect 실측+SVG 오버레이 해킹을
   썼는데, **새 지도에 실좌표가 있으면 그 해킹은 버리고 좌표로 직접** 그릴 것.
   현행 참고 구현: `FleetChart.tsx`의 `Current` 타입·`currents` memo·SVG 패스
   (data-testid="fleet-current", data-drifted 속성 — 테스트가 이 계약을 잡음).
3. 거울 조항(해도 스파인): 상태별 그룹핑·강조·카운트 배지 금지, 시간축(봉인일
   오름차순)이 유일한 정렬키, 배 크기 균일. 기존 fleet-chart 테스트가 고정 중.

## 3. 이 세션에서 창업자가 승인/확정한 디자인 결정 (지도에도 적용)

- **레지스터**: 라벨 대신 말 거는 문장("봉인할 때, 이 전제 위에 서 있었죠.") ·
  사람의 봉인 문장은 크게 세리프(`--font-voice`) · 괘선 대신 여백 구획 ·
  시그니처 계기는 하나만(드리프트 게이지) · 골드 절제.
- **한글 조판**: letter-spacing 금지, uppercase-tracking 라벨 금지, `break-keep`.
- **유령 토큰 경보**: `--text-warning`, `--border-strong`, `--surface-2`는
  **globals.css에 정의가 없다** (참조 시 조용히 투명/상속). 실토큰만 쓸 것:
  `--warning`(양 테마 정의됨), `--border`, `--bg`/`--surface`. (전역 스윕은
  미해결 — 별도 건.)
- **금지 CI**: 왼쪽 골드 인용바(`border-l-[Npx] border-[var(--accent)` regex),
  알림 문안 금지어휘, 앵커/항적에 %·score·streak.

## 4. 스파인 불변식 (통합 후에도 반드시 참이어야 함)

1. 관계는 **선언·집계로만** — `normalizePremiseText` 정확 일치. LLM이 관계를
   추론/생성하는 코드 금지 (honest structure: 배선이 끊기면 그룹이 사라져
   테스트가 빨개질 뿐, 지어낸 관계는 구조적으로 불가능해야 함).
2. **절제 기본값**: 이벤트(공유+드리프트+live bets) 없으면 어떤 하이라이트도
   제조하지 않는다. 지도의 해류도 관계가 실존할 때만.
3. 드리프트 색은 **사실 표시**(앰버)지 평결 아님. 숫자는 카운트·날짜만, % 금지.
4. 해도 위 배들: 그룹핑·강조 금지(거울 조항). 정산 결과로 배를 줄세우지 않음.

## 5. 검증 킷 (이 세션이 실제로 쓴 방법)

- **실앱 라이브 검증**: dev 서버 `NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next dev -p 3210` (localStorage-first라
  무네트워크 동작). playwright-core + `/opt/pw-browsers/chromium-*/chrome-linux/chrome`
  로 `page.addInitScript`에서 주입:
  `argus-theme`('light'|'dark'), `sot_projects`(배열), `sot_review_receipts`(배열).
  프로젝트 리스트 뷰는 `projects.length ≥ 1` 필요. FleetChart는 배 2척 이상.
  영수증 픽스처 최소형은 `judgment-graph.test.ts`/`fleet-chart.test.tsx`의
  헬퍼(`receipt()`/`sealedReceipt()`)를 그대로 복사하면 된다.
- **회귀 가드**: `judgment-graph.test.ts`(11) · `shared-ground-card.test.tsx`(3)
  · `fleet-chart.test.tsx`의 "one sea" describe(3) — 지도 교체 시 이 3종이
  깨지면 계약 위반이거나 의도적 대체(테스트를 새 지도로 이식할 것).

## 6. 커밋 지도 (이 브랜치에서 뭘 취하고 뭘 버릴지)

| 커밋 | 내용 | 새 지도 관점 |
|---|---|---|
| `5df9489` | judgment-graph lib + 카드 + 테스트 | **전부 유지** |
| `7909376` | /project 위계 선언·재배치 | **유지** (지도는 ③슬롯) |
| `44c39c2`·`1e563b2`·이전 | 카드 디자인 진화(최종=다이어그램) | 유지 |
| `e469367` | FleetChart 승격 + 영수증 배 + 해류 | **사상만 이관** — 새 지도가 FleetChart를 대체하면 이 커밋의 FleetChart 변경은 되돌리거나 지도로 이식. 페이지의 receipts/onSelectReceipt 배선은 재사용 가능 |

## 7. 통합 체크리스트 (새 지도 완성 후 순서대로)

- [ ] 새 지도를 `/project` ③티어 주인공 슬롯에 (위계 주석 갱신)
- [ ] 배 소스 확장: 프로젝트 + 봉인 영수증 (§2-1 매핑 그대로)
- [ ] `sharedGrounds()`로 해류 렌더 (실좌표 사용, §2-2; data-drifted 계약 유지)
- [ ] `groundSpotlight()` 이벤트와 지도 앰버가 같은 사건을 가리키는지 육안 확인
      (① 카드 ↔ ③ 지도 메아리)
- [ ] FleetChart 처분 결정: 대체 시 `e469367`의 FleetChart 변경 되돌림 + one-sea
      테스트 3종을 새 지도 테스트로 이식
- [ ] 전체 스위트 + `npx tsc --noEmit` + 실앱 라이브 검증(§5, 라이트/다크)
- [ ] 남은 열린 설계(창업자 콜): 프로젝트 계약에도 전제 모델을 달아 프로젝트
      배에도 해류가 닿게 할지 · 평온 해류의 라벨/클릭(어느 전제인지) 노출 여부
