---
name: watch
description: 이미 나눈 대화에서 결정을 알아보고(scan), 내기로 봉인하고(seal), 확인일에 정산한다(due/settle). argus-watch CLI의 대화형 래퍼. 세션을 마치며 "오늘 결정 뭐 했지", 아침에 "정산할 거 있나" 할 때 사용.
---

# /watch — 결정 원장 도우미

`tools/argus-watch/cli.mjs`의 대화형 래퍼다. 인자에 따라 분기:

## /watch (인자 없음) — 일일 루프
1. `node tools/argus-watch/cli.mjs due` 실행 — 확인일 도래 내기가 있으면 **그것부터** 사용자에게 보여주고,
   각 건에 대해 "그래서, 어떻게 됐어요?"를 물어 [발생/회피/부분/아직] 답을 받아 `settle` 실행.
2. `node tools/argus-watch/cli.mjs scan` 실행 (현재 프로젝트, 동시성 4) — 새로 알아본 결정을 보여준다.
3. 무게 high/medium 후보가 있으면 "봉인할까요?" — 사용자가 고르면 `seal <id>` 실행,
   초안된 내기를 보여주고 수정 요청을 받아 `amend`로 반영.

## /watch all — 전 프로젝트 스캔
`scan --all-projects --concurrency 5`. 시간이 걸리니 백그라운드로 돌리고 완료 시 요약.

## /watch ledger — 원장 보기
`ledger` + `list --status all` 출력을 사람이 읽기 좋게 요약. 정산 5건 이상이면 편차 패턴
(어떤 종류의 결정에서 예측이 빗나가는지)을 한 줄로 짚어준다 — 판정 없이, 관측만.

## 규율 (모든 분기 공통)
- 점수·등급·칭찬·경고 어휘 금지. "갈렸어요/비어 있어요/알아봤어요" 톤 유지 (해요체).
- 후보를 결정이라고 단정하지 않는다 — "이렇게 읽었는데, 맞아요?" 자세. 틀렸다면 즉시
  `dismiss <id> --reason "..."` (기각도 보정 자료다).
- 원장은 로컬 전용(.argus/ledger/) — 내용을 커밋·외부 전송하지 않는다.
