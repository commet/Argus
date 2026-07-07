# Argus dogfood 발견 요약 — 2026-07-03

발행된 `argus-decision-mcp@1.0.0`(동일 빌드)를 실제 MCP stdio 프로토콜로 구동해
**18개 케이스 / 31 스텝**을 돌린 실측. 격리 임시 저널. 원본: `CORPUS.md` + `raw.jsonl`.
개선 작업 시 "case X에서 이게 샜다"로 인용해 쓰기 위한 레퍼런스.

## ✅ 스파인이 라이브로 전부 작동 (건드리지 말 것)

| 케이스 | 기대 | 실측 결과 |
|---|---|---|
| flat/trivial ("점심 뭐 먹지") | 포크 제조 안 함 | `over_fire_gate.fired:false / reversible_low_stakes` — "trying it IS the test" ✓ |
| already_decided | 재오픈 안 함 | `fired:false / already_closed` — "Argus does not reopen it" ✓ |
| 중대 결정 fork | 열림 | `fired:true / consequential_open_fork` ✓ (평평 vs 중대 구분 정확) |
| track_record (10 정산 후) | 점수·등급 없음 | `judgment_tier:null, judgment_score:null` + "Of 10 settled: 5 held, 2 avoided, 3 partial" — **빈도만** ✓ |
| ai_surfaced 술어 | 정직 소유 분기 | seal_text: "Argus가 초안한 문장입니다 — 아직 당신이 확언하지 않았습니다" ✓ |
| crux에 "user id" | 오탐 없어야 | `ok:true` — lean으로 오검거 안 함(정규식 수정 확인) ✓ |
| 막연 술어(한/영) | 거절+안내 | `NOT_FALSIFIABLE` — KO "이건 기분이지 확인 가능한 예측이 아닙니다" / EN "reads like a vibe" + recovery ✓ |
| 과거 확인일 | 거절 | `BAD_CHECK_BY` + recovery ✓ |
| 봉인 없는 정산 | 하드에러 | `NO_PRIOR_SEAL` + mcp_ 접두사 힌트 ✓ |
| 이중 정산 | 하드에러 | `ALREADY_SETTLED` (append-only) ✓ |
| ai_verdict | 항상 null | 전 정산 `ai_verdict:null` ✓ |

## ⚑ 고칠 것 (개선 세션 우선순위)

### P1 — 영어 한 줄 섞임 (EN_SURFACE_UNDER_KO) · 21건
locale=ko인데 **성공 한 줄 요약**만 영어로 하드코딩:
- `argus_open_decision` → "Opened. The one question that decides this: …"
- `argus_seal` → "Sealed. … reality answers on …. Come back then with argus_settle."
- `argus_settle` → "Settled. The receipt records what you predicted and what reality did — no grade."

**정작 리치 표면은 전부 한국어**: seal_text 증서, check_in 닻거울, Judgment Receipt,
그리고 **에러 메시지·recovery까지 한국어**(NOT_FALSIFIABLE 등). 즉 누락된 건 딱
happy-path 3~4개 도구의 최상단 `surface` 문자열뿐. 지난 유통 작업에서 locale 통합을
"최소 범위"로 해서 남은 잔여. → `surfaces.ts`에 ko/en 사전화 + 각 도구 surface를
`surfaceLocale(dir)`로 분기. (스파인 무관, 순수 카피 현지화)

관련 도구: `open-decision.ts`, `seal.ts`, `settle.ts`, `check-in.ts`(일부), `recall.ts` surface 라인.

### P2 — 영수증 표시 날짜 붕괴 (cosmetic, 무해)
`today_override`가 due 판정엔 반영되나 영수증의 `Sealed/Settled` **표시 날짜**엔
안 들어가 데모에서 같은 날로 보임. 실사용(실제 며칠 경과)에선 문제 없음.
고치려면 receipt 렌더가 벽시계 대신 resolveToday(override)를 쓰게.

## 재현
```
node scratchpad/argus-corpus.mjs <dist/index.js> docs/dogfood-2026-07-03
```
