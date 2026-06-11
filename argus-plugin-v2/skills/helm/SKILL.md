---
name: helm
description: EXPERIMENTAL — pre-approval keel scan for agent plans, separate from the sail pipeline. Before the user approves a plan (ExitPlanMode, a plan doc, a migration/deploy/delete proposal), helm runs a silent load-bearing scan and speaks ONLY when an unsupported claim touches an irreversible operation. Default output is silence. Full divergence probe is opt-in. Seals accepted bets into .argus/ledger/ (same schema as argus-watch). Invoked as `/argus:helm`.
---

# /argus:helm — 계획 승인 전 용골 스캔

> Status: **experimental.** helm은 sail 파이프라인의 단계가 아니라 독립
> 보조 스킬이다. 사용자에게 보이는 모든 출력(스캔 결과 한 줄, 발화문,
> 봉인 제안)은 `.argus/config.yaml`의 `config.locale`을 따른다 — 아래의
> 한국어 카피는 ko 기준 문안이며, en이면 같은 의미를 자연스러운 영어로.

## Product Contract (P0.B 판정이 봉인한 제약 — 위반 금지)

> 백테스트 실측 (2026-06-11, Argus 저장소 내부 기록 `.argus/eval/P0B-verdict.md` —
> 플러그인에 동봉되지 않음): 탐침은 갈라질 계획
> 6개 중 5개를 선취했지만, **잘 굴러간 계획 6개 전부에서도 말했다.** 그러므로:

1. **기본 출력은 침묵이다.** 침묵 = "용골 스캔: 잡히는 하중 없음" 한 줄, 그 이상 금지.
2. **무게 게이트가 전부다.** 자동 발화 조건: D 하중 발견(근거 없는 결론-받침 문장)이
   **비가역 연산 문장에 직접 닿을 때만** — 마이그레이션 · 삭제 · 배포 · 외부 계약 ·
   과금/요금 변경 · 공개 발행. 가역적 작업(코드 수정, 문서, 리팩토링)에서는 발견이
   있어도 침묵한다.
3. **C 분기 탐침은 자동 실행 금지.** `--full`을 사용자가 직접 붙였을 때만.
4. 점수 · 판정 · "위험합니다" 어휘 금지. 측정과 인용만 (P1 · P2).
5. 사용자 표면에 내기/predicate/반증 노출 금지 — "물어봐 줄까요?" 화법만.

## When To Run

- `/argus:helm` — 직전 대화에서 승인 대기 중인 계획(ExitPlanMode 직전 계획,
  마지막으로 제시된 plan 텍스트)을 자동으로 집는다.
- `/argus:helm @<plan-file>` — 계획 문서를 직접 지정.
- `/argus:helm --full` — C 분기 탐침까지 (3 독립 샘플 → 갈림, opt-in 전용).

훅 연동(선택, 별도 설정): 계획 승인 직전 1회 제안. 같은 세션에서 두 번 제안 금지.

## Step 1 — 경량 용골 스캔 (기본, ≤20초, haiku급 1콜)

계획 텍스트에 대해 D 하중 탐침 1콜 (프롬프트는 G0 승자 그대로 — 재발명 금지):

```
규율: 모든 지적은 원문 구절 인용. 판정·점수 금지. 근거가 없으면 빈 결과.
문단의 핵심 문장을 하나씩 제거하며: removed_sentence / decision_shift /
evidence_in_text("" = 근거 없음). findings = shift true && evidence "" 만.
```

기계적 후처리 (모델 신뢰 금지):
- `removed_sentence`가 계획 원문에 실제로 없으면 버림 (환각 앵커).
- findings 각각에 대해 **비가역 연산 접촉 검사**: 해당 문장(또는 그 문장이 받치는
  단계)이 마이그레이션/삭제/배포/외부 계약/과금/공개 발행을 포함하는가.
  접촉 없음 → 그 finding은 침묵 처리.

### 출력

- 발화 조건 미달 (대부분의 경우): `용골 스캔 — 잡히는 하중 없음. 그대로 진행하세요.`
- 발화 조건 충족 (비가역 + 무근거 하중):

```
이 문장이 {비가역 연산}을 받치고 있는데, 계획 안에 근거가 없어요:
> "{removed_sentence 원문 인용}"
이대로 진행해도 돼요. 다만 — 이 결정, 확인 날짜 하나 잡아둘까요?
```

## Step 2 — 봉인 (사용자가 "네"일 때만)

`.argus/ledger/ledger.jsonl`에 watch와 **같은 이벤트 형식**으로 append
(스키마 규약은 Argus 저장소의 `src/lib/ledger-schema.ts` ·
`tools/argus-watch/lib/ledger.mjs` — 플러그인에 동봉되지 않으므로 아래
예시 두 줄이 이 스킬의 단일 계약이다):

```json
{"event":"harvest","id":"<sha256(session|quote).slice(0,8)>","project":"<repo>","session":"helm/<ISO date>","decided_at":"<ISO>","quote":"<계획의 해당 문장>","decision":"<계획 한 줄 요약>","type":"adopt","stakes":"high","at":"<ISO>"}
{"event":"seal","id":"<같은 id>","predicate":"<확인 가능한 한 문장>","falsified_if":"<반대 신호 한 문장>","check_by":"<YYYY-MM-DD, 기본 +1w>","at":"<ISO>"}
```

- id 해시·이벤트 리플레이 규칙은 ledger.mjs와 동일 — `argus-watch list`에 그대로 잡힌다.
- 거절은 1탭, 무손실. 재촉 금지.

## Step 3 — 반자동 정산 (실행 완료 후)

계획이 실행된 흔적(해당 커밋/배포)이 보이고 check_by가 지났으면, 다음 helm 호출
시작에 한 줄: `지난번 그 계획 — 그래서, 어떻게 됐어요?` → `/argus:settle` 안내
(플러그인의 정산 스킬 — 같은 ledger를 읽고 쓴다). pending = check_by 연장
(amend, 이력 보존). `argus-watch` CLI가 설치된 환경에서는 `argus-watch settle
<id>`도 같은 결과를 낸다 — 어느 쪽이든 원장은 하나다.

## --full (opt-in 전용) — C 분기 탐침

3 독립 샘플(동일 브리프, 차별화 지시 없음, haiku급) → 갈림 병합(sonnet급 1콜).
`flipped_user_claim` 없는 갈림 버림. 갈림 0 = "실행자들이 같은 곳으로 갔어요" 한 줄.
표면 카피: "같은 계획서를 따로따로 읽었어요."

## 예산

| 모드 | 콜 | 시간 |
|---|---|---|
| 기본 용골 스캔 | 1 (haiku급) | ≤20초 |
| --full | +4 (haiku 3 + sonnet 1) | ≤90초 |

## 수용 기준 (이 스킬의 실측 게이트 — P0.B 판정의 라이브 검증)

본인 실계획 3건에서 **잔소리 없이** 작동: 가역적 계획 → 침묵, 비가역+무근거 하중
→ 1회 발화 + 봉인 제안. 위반(멀쩡한 계획에 발화) 발견 시 무게 게이트 재조정 후
재시도 — 결과를 `.argus/test-observations.md`에 기록.
