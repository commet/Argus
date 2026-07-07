# M1 후속 노트 — 배경(교차세션) push는 "전제 account-sync 선행 필요" (2026-07-05)

> 정본 스펙: `docs/DESIGN-SPEC-companion-mechanisms-2026-07-05.md` §M1(§1.3).
> 이 노트는 M1 구현 중 **실코드 독해로 확정한 배관 사실**이다. 코드 결론:
> 세션 내 ambient(pull)는 구현했고, 배경 push는 **데이터가 없어 짓지 않았다.**

## 결론 (한 줄)

스펙 §1.3의 "웹앱 cron을 전제-재확인-due로 확장"은 **지금 지을 수 없다.**
MCP의 전제(premise)는 로컬 ledger에만 있고 **계정(Supabase)에 도달하지 않기
때문**이다. 데이터 없는 cron은 빈 알림만 쏘거나 아무도 안 뜬다 → 짓지 않았다.

## 왜 — 실코드 근거 (읽기만, 웹앱 편집 없음)

배경 push 파이프라인의 세 지점을 전수 확인했다:

1. **MCP → 계정 push 페이로드** (`argus-mcp/src/lib/push-account.ts`)
   - `SealPush = { action, id, predicate, check_by, sealed_at, source_title,
     real_question, human_judgment }`
   - `SettlePush = { action, id, outcome, what_happened, settled_at }`
   - **전제 필드가 없다.** 봉인된 *예측 한 줄*만 계정으로 간다.

2. **계정 수신 엔드포인트** (`src/app/api/mcp/seal/route.ts`)
   - `buildReceipt()`가 만드는 `JudgmentReceipt`는
     `claim_ledger: [], hidden_assumptions: [], forks: [], findings: []` —
     즉 **전제/재확인 cadence를 담을 자리 자체를 비운 채** `review_receipts`에
     upsert한다. `falsifiable_followups`(예측)만 채운다.
   - 결과: 계정은 그 결정의 monitored 전제도, `recheck_cadence_days`도,
     `next_recheck_due`도 **전혀 모른다.**

3. **Companion Brief cron** (`src/app/api/cron/companion-brief/route.ts`)
   - `duePredicates()`는 `falsifiable_followups`에서 `check_by <= today &&
     !settled_at`인 **예측만** 골라 이메일한다. `next_check_by`(정산일) 하나가
     유일한 due 신호다.
   - 전제 재확인 due를 뜨게 하려면 receipt에 없는 필드를 읽어야 한다 → 불가.

→ 세 지점 모두에서 전제가 누락. **cron 확장의 선행조건은 cron이 아니라
account-sync다.**

## v1에서 실제로 한 것 (세션 내 pull = ambient)

배경 push 대신, 스펙 §1.3의 **오른쪽 절반(세션 내 ambient)**을 정본대로 구현:

- `argus-mcp/src/lib/ambient-due.ts` — **단일 due 원천**(`ambientDue`/
  `ambientDueFromState`). check_in과 dispatch ambient가 같은
  `groupDuePremises(duePremises())` + `ledger.overdue`를 읽어 **드리프트 불가.**
- `argus-mcp/src/lib/due-note.ts` — 아무 argus 도구 성공 응답 끝에 사실 한 줄
  ("그나저나 — 정산할 것 N건 · 재확인할 것 M건, 여유 될 때 보세요")을 얹음.
  절제: due 0=침묵 · 세션당 1회 · `ambient_mute: true` 존중 · check_in 제외 ·
  지시문 없음(사실+handle) · 에러/실패는 원본 무손상.
- 전제 recheck cadence 정식화: `recheck_cadence_days`(전제별, jsonb-nested,
  마이그0) + `next_recheck_due`(파생) — 규칙 타입에서 기본 cadence 유도
  (고변동 7일 / 느린상태 30일 / 무규칙 14일), floor 7일. recall premises 뷰가
  노출, recheck baseline 문구가 "7일" 하드코딩 대신 이 cadence를 씀.

## 배경 push를 진짜로 지으려면 (v2 선행 작업, 순서대로)

1. **push-account.ts 페이로드 확장** — `SealPush`에 `premises: Array<{ premise_id,
   text, external, load_bearing, materiality_rule?, recheck_cadence_days?,
   last_recheck?, next_recheck_due? }>` 추가. (전제는 team-visible 아님 → 개인
   계정 범위. sanitize는 기존 seal 경로 따름.)
2. **`src/app/api/mcp/seal/route.ts` 저장** — receipt jsonb에 전제 블록을 실어
   `review_receipts.data`에 넣기. (PGRST204 위험 없음 — jsonb 내부 필드.)
   후속 `recheck`도 계정에 밀어야 baseline/next_due가 서버에서 갱신됨 →
   `push-account`에 `action: 'recheck'` 케이스 신설 필요.
3. **cron 확장** — `companion-brief`(또는 신규 `premise-recheck-due`)가
   receipt.data의 전제에서 `next_recheck_due <= today && status==='active' &&
   monitored`를 골라, **예측 due와 같은 빈도상한/mute/이메일 톤**으로 nudge.
   스파인: "사실이 재확인 차례" (handle) — "결정을 뒤집어라"(평결) 금지.
4. **erasure/스키마 규약** (CLAUDE.md §Schema Sync) — receipt.data 내부라
   새 테이블·컬럼은 없지만, 전제가 계정에 실리면 export/삭제 커버리지 검토 1줄.

이 4개가 끝나기 전엔 배경 premise-push cron을 짓지 말 것 — 지으면 데이터 없는
알림이 된다(2026-06-25 리마인더 from-도메인 거짓양성과 같은 계열의 함정).

## 스파인 확인

ambient는 사실+handle(argus_check_in)만, 평결·점수·지시 0. due 0=완전 침묵.
mute 탈출구 존재. 배경 push는 데이터 없어 **미구현이 정직** — 반쪽 기능을
"완성"으로 위장하지 않음.
