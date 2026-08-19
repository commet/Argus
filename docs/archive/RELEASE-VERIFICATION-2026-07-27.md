# Argus 출시 전 재검증 보고서 — 2026-07-27

## 결론

`origin/main`의 `27fc2454`를 깨끗한 별도 작업공간에서 다시 검증했다.

코드·스키마·플러그인·MCP의 결정 기록 규칙은 회귀 테스트를 통과했다. 그러나 검증 과정에서 출시를 막을 수 있는 운영 문제 두 건과 모바일 시각 결함 한 건을 실제로 발견했다.

1. 코드에는 존재하지만 운영 DB에는 빠져 있던 판단 기반 계약 마이그레이션을 운영에 적용했다.
2. 운영 Anthropic 계정의 크레딧 부족으로 핵심 분석 API가 실제 500을 반환하고 있음을 확인했다.
3. 모바일 히어로 철학 문구가 언어 전환 스위치와 겹치던 문제를 수정했다.

현재 코드 수정은 검증을 통과했지만, **Anthropic 크레딧을 충전하고 운영 분석 호출과 한 번의 전체 사용자 항해를 다시 성공시키기 전에는 “출시 준비 완료”로 판정하지 않는다.**

## 1. 운영 DB에서 발견한 마이그레이션 공백

운영 migration history를 비교한 결과 다음 상태였다.

```text
20260726090000  local / remote
20260726120000  local only
20260727120000  local / remote
```

즉, 더 최신 무결성 마이그레이션은 적용됐지만 그 기반인
`20260726120000_decision_foundation_contract.sql`은 빠져 있었다.

이 마이그레이션은 다음을 운영 DB에서 강제한다.

- kind·kind evidence·origin utterance·review status의 형태
- witness에 반환 시점 필드가 들어가지 않는 규칙
- score·accuracy score·hit rate·win rate·overall DQ 저장 금지
- semantic idempotency fingerprint의 기반 필드

처리 순서:

1. 누락 파일 전체 검토
2. 단독 dry-run으로 해당 버전 하나만 적용되는지 확인
3. 운영 DB에 적용
4. 원격 migration history 재조회

최종 이력:

```text
20260726090000  local / remote
20260726120000  local / remote
20260727120000  local / remote
```

## 2. 운영 분석 기능 차단

공개 랜딩과 정적 자산은 정상 응답했지만, 운영 `/api/llm` 최소 호출은 500을 반환했다.

Vercel 운영 로그와 로컬 동일 키 호출에서 원인을 교차 확인했다.

```text
Anthropic 400 invalid_request_error
Your credit balance is too low to access the Anthropic API.
```

이는 모델 식별자나 스트리밍 순서 오류가 아니라 Anthropic 조직의 크레딧 부족이다. 브라우저에 열린 Anthropic 결제 화면은 로그인 전 상태이므로, 계정 로그인과 결제는 사용자의 계정 접근이 필요하다.

### 함께 수정한 실패 처리

기존 구현은 이 영구적 운영 실패를 스트림 내부의 일반 `Stream error`로 축약했다. 그 결과 사용자는 원인을 알 수 없고 “다시 시도”를 반복하게 됐다.

수정 후:

- provider credit exhaustion을 `PROVIDER_CREDITS_REQUIRED`로 분류
- 재시도 불가 오류로 처리
- non-stream 응답은 503과 구조화된 실패 코드 반환
- stream 응답도 동일한 실패 코드를 SSE로 전달
- 원 upstream 메시지는 서버 로그 밖 사용자·분석 telemetry에 저장하지 않음
- 한·영 UI 모두 입력과 지금까지의 작업이 보존됐음을 명시
- 고칠 수 없는 “다시 시도” 버튼 제거
- 사용자는 운영 복구를 기다리거나 본인 API 키로 계속할 수 있음

운영 계정에 크레딧을 충전한 뒤에는 아래를 다시 통과해야 한다.

1. `/api/llm` 최소 non-stream 호출 200
2. 실제 stream에 첫 token과 `[DONE]` 도착
3. 히어로 입력 → 검토 전 기준점 → 핵심 질문 → 사용자 선택 → 최종 판단 확정
4. judgment seal 및 확인 계획 저장
5. 새로고침 후 동일 세션 복구

## 3. 모바일 히어로

390×844 실브라우저에서 상단 철학 문구가 헤더의 KO/EN 전환 스위치 아래로 들어가 일부 글자가 가려졌다.

모바일에서만 히어로 상단 여백을 72px로 확보하고, `sm` 이상에서는 기존 반응형 여백을 유지했다.

수정 후 측정:

- KO 철학 문구: y 72–89
- EN 철학 문구: y 72–106
- 언어 전환: y 5–51
- KO 핵심 CTA 하단: y 508
- EN 핵심 CTA 하단: y 537
- viewport 높이: 844

따라서 한·영 모두 헤더와 겹치지 않고, 핵심 CTA는 첫 화면 안에 남는다.

## 4. 실제 사용자 여정 재검증

로컬 production build를 실제 브라우저로 밟았다.

### 한국어

1. 히어로에 `9월에 파일럿을 출시할까?` 입력
2. `가장 중요한 질문 찾기`
3. 원문이 워크스페이스 상단에 그대로 전달됨
4. `검토 전 기준점 · 선택` 단계 노출
5. `아직 잘 모르겠어요 · 건너뛰기` 가능
6. provider 장애 시 입력이 그대로 남음
7. 사용자에게 운영 복구 또는 본인 API 키 선택만 제공

### 영어

1. 히어로에 `Should we launch the pilot in September?` 입력
2. `Find the question that matters`
3. 원문 전달
4. `Before-review baseline · optional`
5. `I'm not sure yet · skip`
6. 동일한 보존·복구 안내

두 흐름 모두 브라우저 console error는 0이었다.

## 5. 회귀·안전성 증거

### Web

- production build: 성공, TypeScript 성공, 85 routes/pages 생성
- Vitest: 320 files passed, 1 skipped
- Tests: 3,762 passed, 10 skipped
- ESLint: 0 errors, 기존 warning 112개, warning budget 145 이하
- production dependency audit: 취약점 0

### MCP·plugin·semantic contract

- MCP: 113 files, 1,106 tests 통과
- plugin decision ledger: 63/63 통과
- gate fixtures: 29/29
- decision signals: 64/64
- static eval: 16/16
- plugin validation: 통과

### Heavy dogfood

- W1–W21
- T1–T9
- P1–P9
- X1–X3
- model-based random walk 2,000 moves × 3 seeds
- 총 4,311 steps, 전부 green

검증된 핵심:

- 중복·재전송은 새 사건을 만들지 않음
- 같은 idempotency key의 다른 내용은 거절
- concurrent defer/close가 조용히 유실되지 않음
- observation 없는 answered resolution 거절
- answer와 close는 별개 사건
- Telegram·plugin·web이 같은 semantic stream을 사용
- AI/system의 인간 closure 권한 사칭 거절
- score 계열 저장 금지

## 6. 운영 비인증 방어

운영 주소에서 확인:

| 대상 | 결과 |
|---|---:|
| `/ko` | 200 |
| `/en` | 200 |
| `/manifest.webmanifest` | 200 |
| semantic events without auth | 401 |
| account export without auth | 401 |
| Telegram cron without secret | 401 |
| check-in cron without secret | 401 |
| daily report cron without secret | 401 |
| Telegram webhook without secret | 401 |
| MCP seal without auth | 401 |

## 7. 남은 출시 게이트

필수:

- Anthropic Platform 로그인
- 사용할 조직·결제 수단·충전 금액 확인
- 크레딧 충전
- 운영 분석 non-stream/stream 재검증
- 운영 전체 항해 1회 및 새로고침 복구 확인

운영 부채:

- 저장소와 Supabase의 오래된 migration history에는 과거부터 누적된 이름 불일치가 남아 있어, 표준 `db push`를 무심코 실행하면 안전하지 않다.
- 이번 누락은 단독 migration fetch·dry-run·push로 보완했지만, 장기적으로는 원격 history reconciliation 절차를 별도 운영 문서와 CI gate로 고정해야 한다.

## 최종 판정

- 데이터 무결성: 통과
- 웹·MCP·plugin semantic contract: 통과
- 공개 랜딩·한영·모바일: 수정 후 통과
- 장애 시 데이터 보존과 정직한 안내: 수정 후 통과
- 핵심 AI 분석의 운영 가용성: **차단 — Anthropic 크레딧 충전 필요**
