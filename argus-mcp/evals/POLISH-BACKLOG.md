# Polish backlog — 자잘한 것 모아서 한 번에 잡는 목록

self-drive loop(`npm run loop`) · life loop(`npm run life`) · experience loop
(`npm run eval:experience`)이 발견한 **작지만 실재하는** 다듬기 항목. 하나씩
고칠 크기가 아니면 여기 적고, 배치 세션에서 한꺼번에 처리한다.
(큰 발견은 백로그가 아니라 바로 이슈/수정 — 이 파일은 polish 전용.)

## 규칙
- 발견한 루프/날짜/증거(실제 surface 인용)를 남긴다.
- 고치면 줄을 지우지 말고 `[x]`+커밋 해시.

## 항목

- [ ] **seal surface에 캘린더 절대경로가 통째로 들어감** (loop J1/J3/J4, 2026-07-09)
  `"봉인했습니다. … Calendar file: C:\Users\…\calendar\j3.ics 무엇을 전제로…"`
  — "한 줄 human surface" 원칙이 깨지고 기술적 냄새. 경로는 data에 이미 있는지
  확인 후 surface에서는 "캘린더 파일도 만들어뒀습니다" 수준으로 줄이기.
  주의: 테스트가 경로 문구를 박아뒀는지 grep 먼저.

- [ ] **argus_review 한국어 surface에 EN 밴드 토큰 누출** (loop J5, 2026-07-09)
  `"검수 가능성 79/100 (caveated)"` — 밴드명(clean/caveated/…)을 ko 매핑으로.

- [ ] **에러 봉투(message/recovery)가 전 도구 EN 고정** (loop J6, 2026-07-09)
  ok-surface는 이중언어화 완료(2026-07-09), 에러는 모델 복구용이라 EN 우선이
  맞을 수 있음 — 단 호스트가 사용자에게 그대로 보여주는 경우 존재. **정책 결정
  필요**: "에러는 EN(모델용) 유지 + surface성 에러만 ko" 또는 전체 이중언어.

- [ ] **INVALID_INPUT이 zod 원문을 그대로 중계** (loop J6, 2026-07-09)
  `"op: Invalid option: expected one of \"add\"|\"amend\"…"` — 사람이 볼 수도
  있는 문장 치고 기계적. 필드명+기대값을 자연문으로 한 겹 감싸기.

- [ ] **혼합 언어 원장에서 check_in 목소리는 하나** (2026-07-09 설계 확인)
  표본 사슬이 첫 due 항목의 언어를 따름 — 한 원장에 ko/en 결정이 섞이면 절반은
  다른 언어 프레임. escape는 config `locale:` 고정. README에 한 줄 안내 고려.

- [x] **ambient due-note("By the way — …") EN 고정** (experience loop 하은, 2026-07-09)
  → FIXED: ambientLine이 원장 목소리(ledgerVoiceText)를 탄다. 같은 커밋에서
  check_in을 본 세션은 ambient 예산 소진 처리(정산 직후 빚 카운트 재발화 차단).

- [ ] **정산이 그 세션의 첫 argus 호출일 때는 ambient가 여전히 정산 응답에 붙음** (2026-07-09)
  잔여 케이스. "완료의 순간에 남은 빚 세기"가 맞는가 vs 이게 귀환 루프의 유일한
  전선인가(활성화 병목) — 창업자 판단. 아래 '결정 필요'와 연결.

## 결정 필요 (창업자) — polish 아님, 제품 판단

- [ ] **빈 서랍 문제 — 자발 채택은 되는데 포획이 0** (experience loop marcus, 2026-07-09)
  가장 큰 제품 발견. 사용자가 Argus를 한 번도 언급 안 했는데 호스트가 결정
  순간을 알아보고 open_decision까지 감(자발 채택 ✓, 승차감 5/5). 그러나
  "기록해둘까요?" 두 번 제안 → 사용자가 무시("그냥 가자") → 아무것도 안 남음
  → 30일 뒤 회고에서 서랍이 비어 있음(earned_return 2/5). 판정단 평:
  "돌아왔더니 서랍이 비어 있었다". 선택지:
  (a) 현행 유지 — 빈 서랍도 정직한 결과(강제 포획은 spine 위반)
  (b) seal 거절/무응답 시 zero-ceremony 강등 경로를 서버 instructions에 명시
      (argus_watch op=anchor는 이미 존재 — 호스트가 그리로 안 감)
  (c) 호스트가 사용자의 발화 그대로를 watch 앵커로 남기도록 유도(제안 1회,
      provenance = 사용자 발화 인용)
  판정단 ADD 제안은 "체크인마다 자동 포획"이었으나 이는 spine 위반 —
  (b)/(c)가 spine-safe 번역.

- [ ] **세션 범위 기억** (experience loop 하은 ADD, 2026-07-09)
  "오늘은 하나만"이라고 사용자가 선언한 범위를 존중해 다음 항목으로 자동으로
  안 넘어가는 것 — 대부분 호스트 행동이라 서버가 강제 못 함. instructions에
  한 줄 반영할지 검토.

- [ ] **확인 전 전제는 day 1부터 발화** (life loop, 2026-07-09)
  감시 전제는 추가 다음 날부터 "재확인 차례"로 뜸(`isDueForRecheck`: 확인
  이력 없음 = 즉시 due). 미결 질문은 같은 파일에서 **추가일 기준 cadence**로
  이미 반대로 설계돼 있음(`reconsiderAnchor` = added_ts) — 내부 비일관.
  증거: 75일 시뮬에서 d1–d20 동안 동일 넛지(지금은 문장이 나이 들어 벽지는
  깨졌지만, **발화 자체가 이른가**는 별개 질문). 선택지:
  (a) 현행 유지 — "봉인 직후 근거 한 번 박아두라"는 베이스라인 넛지로 의도됨
  (b) 질문처럼 added_ts 기준 cadence 후 첫 발화
  (c) (a)+무시 N일 후 침묵 캡(웹앱 §9.2 silence-cap의 MCP판)
  테스트가 (a)를 박아두고 있어 바꾸면 같은 커밋에서 테스트 갱신 필요.

- [ ] **life 시뮬 한정 왜곡: added_ts가 실제 벽시계** (2026-07-09)
  premise_add의 ts는 실시간 now라 시뮬 달력(today_override)과 어긋나
  "적어둔 지 N일"이 시뮬에선 근사치. 실사용에선 정확. 시뮬 정밀도가 필요해지면
  premise_add에 anchor_date(오늘)를 전제 kind에도 기록.
