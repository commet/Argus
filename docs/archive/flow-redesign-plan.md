# Argus 플로우 재설계 — 구현 계획 (v2)

> 작성: 2026-06-08 · 대상: `src/app/workspace/page.tsx`(HeroFlow) + `src/components/workspace/progressive/**`
> 전제: 코드 직접 확인 후 작성([읽음] 표기). v1 대비 v2는 self-validation(V-1~V-7)을 접어 넣은 판.
> 정체성: **사심 없는 동료가 네 베팅을 *시험*하고 *도착*시킨다.** (브레이크 + 도착, 거인 아님)

---

## 0. 목표

9개 "당신 차례" 표면 → **5모먼트.** 흩어진 "이거 맞아?" 4겹 게이트 → **반증(④) 1개.**

---

## 1. 검증된 현행 흐름 (왜 조잡한가) [읽음 전 구간]

입력~완성 사이 표면 ~9개 + **중복 게이트:**
- "이 방향 맞아?" **두 번** — `FramingConfirmation`(L2240) + `VoyagePrepSummary`(L2204)
- 워커 검토 **두 번** — 인라인 스텝퍼(L2086) + `VerificationGate` 모달(L1910, 같은 기능)
- "이거 문제야" **네 곳** — 항해장 노트(`cmReview`) + 팀 내 반론(`debate` L1485) + `DMFeedback`(L2334) + "검증 다시"(L2470)

→ 사용자 결정 지점 과다 = 조잡 + 호흡 길다.

---

## 2. 최종 5모먼트 호 (arc validation v1~v3 반영)

| 모먼트 | 하는 일 | 핵심 규칙 |
|---|---|---|
| **① 말한다** | 입력 (HeroFlow `idle`) | 그대로 |
| **② 본다** | 진짜질문 + 숨은가정 스트리밍 = *중립 관찰* | "아니면 다시"는 카드 인라인(FramingConfirmation 게이트 제거). 가정은 여기서만 — ④서 같은 리스트 재노출 금지 |
| **③ 만든다** | 질문 1~2 → 팀 *자동 배치* → 초안 | 출항요약·내생각·워커검토·검증게이트 → 기본 숨김(고급). 워커검토 숨김 = **auto-approve-all 기본**, `validation_failed`만 필터 |
| **④ 시험한다** 🔥 | *강점 1개 인정* → "일부러 좀 부풀려볼게요, 못 믿겠는 데서 멈춰요" → 과주장 → 멈칫 → 차분(왜 다른 길 아냐) → 진짜 베팅 | 1회 후 ⑤로 밀어냄. **멈칫 0 → "너무 가까이 계실 수도. 제가 제일 위험하다 보는 건 이거" → 최고하중 가정 봉인** |
| **⑤ 도착** | **베팅 서명(스킵불가·능동작성) + 봉인 + 최종문서** | 베팅을 *네 말로* 재진술 + 출구/기한 직접. 재시도 = *이유 한 줄* 마찰 게이트. 드래프트트리/수정 강등 |

핵심: **④가 "맞아?" 4겹을 하나의 날카로운 클라이맥스로 빨아들인다.**

---

## 3. 구현 (v2 — 검증 결함 V-1~V-7 반영)

### 3.1 데이터 (types.ts — CLAUDE.md 체크리스트)
```
LoadBearingClaim { id, text, overreached, highest_load? }
Falsification {
  claims[]; flinched_id|null; alternative?; surfaced_constraint?;
  real_bet?; seal?; no_flinch_fallback?: boolean
}
SealRecord { observation, deadline, threshold, exit, settled?: {verdict, at} }
```
- `ProgressiveSession.falsification?` **새 필드로 추가** (← V-1: `dm_feedback`을 *대체하지 않는다*).
- **[확인필요]** `progressive_sessions`가 JSON blob 저장이면 마이그레이션 불필요 — 착수 전 확인.

### 3.2 상태머신 & 커플링 (V-1, V-3 — 내가 과소평가했던 부분)
- **V-1:** `dm_feedback`은 슬롯 하나가 아님 — **체크포인트 스냅샷(types L922)·완성 카피("피드백 N건 반영" L2412)·`onFinalize`(runFinalDeliverable이 dmFb 사용 L1736)**에 엮임. → falsification을 *별 필드*로 두고, **완성/파이널라이즈 경로를 명시적으로 갈아끼운다**(dmFb 의존 제거 또는 falsification 기반으로 재작성).
- **V-3 (누락했던 범위):** 항해일지/해도가 dm_feedback·assumptions에서 서사를 뽑음 — `recordCheckpoint`(곳곳), Chronicler waypoint(`headwind`=이해관계자 우려, `reef`=숨은 가정, types L979). **④ 도입 시 Chronicler·체크포인트 매핑도 같이 손봐야** = 숨은 작업. 별도 항목으로 추적.
- `runDebate`: 자동경로에서 제거(④가 대체). UI 참조(MixPreview·최종 블록 L2441) 정리.

### 3.3 프롬프트 빌더 (progressive-prompts.ts, debate-engine.ts 양식 복제 [읽음])
- `buildOverreachPrompt(snapshot, mix)` → 강점1 + 과주장 칩 3~5 *(문단 금지, distinctness self-check L81 재사용)*
- `buildAlternativePrompt(flinchedClaim)` → 대안 1줄 + 이유 칩 3
- `buildRealBetPrompt(flinch, constraint)` → 베팅 1문장 + 봉인 후보
- `buildHighestLoadPrompt(claims)` → no-flinch용 최고하중 1개

### 3.4 컴포넌트
- **신규** `Falsification.tsx` — ④ 전체.
- **수정** `MixPreview.tsx` — "검토받기/항해장/debate" CTA 클러스터 제거.
- **수정** `ProgressiveFlow.tsx` 렌더 — ④ 삽입 + ②③ 잉여 표면 강등 + 완성 경로 재배선.
- **유지** HeroFlow / FinalCard(+서명·봉인).
- 보이스: 전부 **존댓말·따뜻**, ④도 존댓말 안의 직설. ④ 첫 줄에 *한 줄 프레임* 필수("일부러 부풀려볼게요…").

### 3.5 봉인 루프 닫기 (V-2 — 안 그러면 또 죽은 테이블)
seal이 write-only가 되지 않게:
- (a) 마감일 로컬 리마인더(CronCreate 등),
- (b) 정산 결과 저장 위치(`SealRecord.settled`),
- (c) "정산 결과가 다음 ④에 어떻게 반영되는지" 한 줄 기전(최소: 과거 깨진 베팅을 다음 과주장에 주입).

### 3.6 빌드 순서 (V-4 — 프로토타입을 *진짜* 싸게)
1. **standalone throwaway 화면**으로 ④ 코어(과주장→멈칫→격리)만. *상태머신 미접촉.* ← V-1·V-3 커플링 풀기 전에 가설부터.
2. **A/B 검증:** `blindspot` AI픽 vs 멈칫픽 — "진짜 하중점이냐" + **보조지표(멈칫 후 '이게 맞다' 동의율)** (V-7), 5~10명. ← **make-or-break.**
3. 통과 → 차분 + 진짜베팅 + 봉인 + **no-flinch 분기**.
4. *그 다음에* 본 플로우 통합(V-1·V-3 커플링 작업 포함) + ②③ 강등 + ⑤ 서명/봉인.
5. (별도) 레거시 5탭 모드 정리.

---

## 4. 검증 이력
- **arc v1~v3** (수렴): HITL은 약화가 아니라 ④+⑤로 *집중* → ⑤ 서명이 안전망 / no-flinch 분기 추가 / 강점먼저·한줄프레임 / 마비 약(도착 강제) / ②④ 중복 회피.
- **plan validation (이 문서가 고친 것):** V-1 dm_feedback 커플링(churn 과소평가) · V-2 봉인 루프 미닫힘 · V-3 항해일지/해도 누락 · V-4 프로토타입 비용 · V-5 auto-approve 기본 · V-6 브레이크편중/알아봄 경량(수용·명시) · V-7 A/B 측정 보강.

## 5. 리스크 + 코딩 전 읽을 것
- 미해결 최대 리스크: *멈칫이 진짜 하중점에 떨어지나*(단일모델 천장) — 2번 A/B가 1차 판정.
- 트레이드오프 명시(V-6): 이 플랜은 **브레이크 편중, 알아봄(recognition) 경량.** ②를 키우는 건 후속.
- 착수 직전 읽기: `progressive-engine.ts`(runMix/runInitialAnalysis 시그니처)·`useProgressiveStore` 뮤테이션·`progressive_sessions` 저장 형태.

## 6. 남은 결정
- phase 재정의 vs 슬롯 재활용 (추천: 새 필드 + 경로 재배선)
- 레거시 5탭: 지금 vs 나중 (추천: 나중, 별도)
- ②의 가정 노출 깊이(②서 최소 → ④서 압박)
