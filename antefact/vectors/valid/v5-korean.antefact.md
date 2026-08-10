---
antefact: 0.1
id: 018f0000-0000-7000-8000-000000000005
authors: [{h: "김서진"}, {ai: "argus — 세션 도우미"}]
state: recorded
---

# 결정 — 9월부터 텔레그램 채널을 닫는다

## Statement
- P1 (h) [assumption·moderate] 채널 유지 비용 대비 신규 유입 기여가 낮다
  tripwires: [주간 유입 10건 초과가 2주 연속이면 기각]
- P2 (h←ai) [inference·low] 유사 서비스 두 곳이 채널 정리 후 지표 악화가 없었다
  sources: [메모 M-2026-104]

## Stake
claim:      채널 폐쇄 후 30일간 주간 신규 가입이 폐쇄 전 4주 평균 대비 10% 이상 감소하지 않는다
p:          { raw: "0.6", mode: band, canonical: 0.6, granularity: 0.1 }
confidence: low
settle_by:  2099-10-15T00:00Z
settled_by: [h:김서진, h:박다인]
criteria:   { source: "주간 대시보드 스냅샷 w42",
              threshold: "감소율 10%", edge: "폐쇄 30일 내 재개설 시 annul" }

## Settlement
