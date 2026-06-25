# Argus Follow-Up Work Packages

Date: 2026-06-25  
Purpose: 후속 세션에 나눠 맡기기 전, 같은 파일/개념을 만지는 과제를 묶고 우선순위를 정한다.

## 결론 요약

Argus의 다음 보완은 크게 여섯 묶음으로 나누는 게 좋다.

1. **Bearing-first completion UI + Decision replay**
2. **Low-stakes / flat routing and user choice**
3. **Web/plugin schema canonicalization**
4. **Stakeholder Review vs Boss viral surface**
5. **Telegram/email/slack settlement-by-reply**
6. **Canonical BearingLedger + learning loop**

Routing policy for item 2: **low-stakes/flat/reversible -> fast bearing by default; medium/high/uncertain stakes -> team review by default; both paths must offer the opposite choice.**

## 2026-06-26 구현 재감사 보완

이 문서 기반의 1차 구현 뒤, 다음 결함을 추가로 확인하고 보완했다.

- **프레임 재분석 경로 누락**: 사용자가 초기 프레임을 거절한 뒤 다시 분석하는 `refineInitialFraming` 경로가 `request_type`, `stakes`, `reversibility`, `decision_density`, `frame_status`를 저장하지 않았다. 이 경우 low-stakes/flat 라우팅 정책이 초기 경로와 다르게 동작할 수 있었다. 보완: 초기 분석과 동일한 shape/route contract를 사용하고 snapshot에 모든 라우팅 축을 저장한다.
- **deepening snapshot의 라우팅 축 손실**: Q&A 이후 snapshot이 초기 density/stakes/reversibility를 들고 가지 않아 최신 snapshot만 보는 UI/라우팅에서 신호가 약해질 수 있었다. 보완: deepening snapshot에 라우팅 축을 carry하고, routing helper도 마지막 known signal을 fallback으로 본다.
- **Telegram stale settlement 보호막 약함**: reminder text는 `contractId`를 받을 수 있었지만 cron 발송에서 넣지 않았다. 답장 settlement가 오래된 계약인지 확인하는 stale guard가 제대로 힘을 못 썼다. 보완: cron reminder token에 contract id를 포함한다.
- **Telegram 한국어 alias 처리**: `발생 - ...`, `아직: ...` 같은 답장을 outcome으로 인식하고도 note에서 alias를 지우지 못하거나, `\b` 경계 때문에 한글 alias가 불안정했다. 보완: alias match 결과를 note stripping에 재사용한다.
- **Decision replay predicate 선택**: replay의 check-later row가 첫 predicate를 무조건 보여줘 이미 해결된 항목을 다시 보여줄 수 있었다. 보완: unresolved predicate를 우선 표시한다.
- **프로젝트 상세 간격/표현**: replay 추가 뒤 workspace link가 음수 margin으로 timeline에 붙을 수 있었고, 한국어 replay 라벨이 "최종 항로"라서 "Current Bearing" 철학과 어긋났다. 보완: 정상 margin, "현재 항로"로 수정한다.

## 2026-06-26 마지막 인접 감사 보완

- **cron due 판단 drift**: 웹의 `contractStatus()`는 "약속한 날짜의 0시부터 due"로 보는데, cron은 정확한 timestamp와 `graded_at`만 봤다. 같은 결정이 웹에서는 due인데 이메일/Telegram reminder는 아직 안 나가거나, legacy contract는 이미 모든 predicate가 해결됐는데 `graded_at` 누락 때문에 다시 알림이 나갈 수 있었다. 보완: reminder 후보 판단을 `isCheckInReminderDue()`로 추출하고 내부에서 `contractStatus()`를 단일 기준으로 쓴다.
- **date-only rope의 Telegram 미종결**: 웹 SettlementModal은 predicate가 없는 날짜 약속을 "돌아봤어요 — 닫기"로 닫지만, Telegram 답장은 0개 predicate를 업데이트하고 계약을 계속 due 상태로 남겼다. 보완: predicate-less contract에 non-pending 답장이 오면 `graded_at`을 찍고 `check_in_at/check_in_interval`을 제거한다.
- **/settle 명령어의 stale guard 손실**: 답장 token에는 `contractId`가 있었지만 `/settle` 명령어는 project id만 받았다. 사용자가 reminder token을 복사해 명령어로 처리하면 stale guard를 유지하지 못했다. 보완: `/settle ARGUS_SETTLE:<projectId>:<contractId> happened ...` 형식을 허용한다.
- **웹 date-only close의 빈 기록/오염된 지표**: predicate가 없는 날짜 약속은 웹에서 닫을 수는 있었지만 실제 결과 메모를 저장하지 못했고, 닫기 직후에도 `settle_abandoned`로 추적될 수 있었다. 보완: freeform note를 `outcome_note`에 보존하고, freeform close는 abandoned 이벤트에서 제외한다.
- **리마인더 카피의 약속 불일치**: SealMoment/Guide는 "알림을 보내지 않는다"고 말했지만 실제로는 이메일 opt-in과 Telegram reminder 경로가 생겼다. 보완: 사용자-facing 카피를 "달력 저장 + 명시적 이메일 opt-in" 기준으로 바꿔 거짓 부정 약속을 제거한다.
- **Telegram 버튼의 남은 stale guard 구멍**: 답장/명령어 token은 `contractId`를 보존하지만 inline button은 Telegram `callback_data` 64바이트 제한 때문에 project id만 보냈다. 보완: UUID project/contract id 쌍을 32바이트로 압축해 base64url token으로 싣고, 과거 `stl|outcome|projectId` 포맷은 backward compatible하게 유지한다.
- **이메일 reminder HTML의 깨지기 쉬운 인라인 템플릿**: cron route 안에 직접 박힌 HTML이 프로젝트명/lean escape와 태그 구조를 route 구현 세부에 묶고 있었다. 보완: `renderCheckInReminderEmail()`로 추출해 실제 lean 보존, HTML escaping, 닫는 태그를 테스트로 고정한다.

1과 6은 같은 spine을 만지지만, 동시에 하면 너무 커진다. 먼저 1로 화면과 replay를 만들고, 6에서 저장 모델을 정리하는 순서가 안전하다.

## 1. Current Bearing을 기본 출력으로 올린다는 뜻

현재 완료 화면은 긴 `FinalCard`가 먼저 나오고, 그 아래에 `CurrentBearingCard`가 붙는다. 즉 사용자가 처음 보는 것은 "AI가 만든 최종 문서"이고, Current Bearing은 그 요약/부록처럼 보인다.

제안의 의미는 반대다. 사용자가 가장 먼저 봐야 하는 것은 긴 분석문이 아니라:

- 지금 어떤 방향으로 가야 하는지,
- 왜 그 방향인지,
- 아직 걸리는 안개/암초가 무엇인지,
- 버린 선택지는 무엇인지,
- 다음 조타가 무엇인지,
- 나중에 확인할 약속이 무엇인지.

즉 Current Bearing을 "요약 카드"가 아니라 **Argus의 기본 산출물**로 올리자는 뜻이다. 긴 분석문은 접히거나 "근거 보기"로 내려가야 한다.

중요한 이유:

- 사용자는 긴 문서를 다시 요약하러 온 게 아니다.
- Argus의 차별점은 글쓰기보다 판단의 현재 위치를 고정하는 것이다.
- 이후 Decision Contract/Settlement/Replay가 모두 이 Bearing을 기준으로 이어진다.

관련 파일:

- `src/components/workspace/progressive/ProgressiveFlow.tsx`
- `src/components/workspace/progressive/CurrentBearingCard.tsx`
- `src/components/workspace/progressive/FinalCard.tsx`
- `src/lib/current-bearing.ts`
- `src/components/workspace/progressive/SealMoment.tsx`

권장 작업:

- 완료 화면에서 `CurrentBearingCard`를 `FinalCard` 위로 이동.
- `FinalCard`는 기본 접힘 유지.
- `SealMoment`는 Bearing 바로 아래에 배치.
- Bearing에 "복사", "근거 보기", "결정으로 봉인" CTA를 붙인다.

## 2. Low-Stakes 요청에서 crew/debate/review 자동 생략

정정된 기본 원칙:

- **low-stakes / flat / reversible**로 충분히 판단되면 기본은 **빠른 항로**다.
- 그 외, 즉 **stakes가 중간 이상이거나 불확실하면 기본은 팀 검토**다.
- 사용자는 항상 반대 선택을 할 수 있어야 한다.
  - 빠른 항로 기본 화면: "팀에 맡겨 더 뜯어보기"
  - 팀 검토 기본 화면: "팀 검토 생략하고 바로 항로 받기"
- 분류 confidence가 낮으면 자동으로 한쪽을 택하지 말고 사용자에게 묻는다.

즉 "모든 요청을 빠르게"가 아니라, **가벼운 요청만 빠르게**다. Argus의 기본 브랜드는 여전히 "판단을 단단하게 만든다"이고, low-stakes에서는 그 단단함을 과한 절차로 오해받지 않게 줄이는 것이다.

좋은 제안이지만, 완전 자동으로만 가면 위험하다. 판단은 가능하되, 사용자 선택권을 같이 줘야 한다.

현재 plugin v2는 이미 `frame_status: flat | load_bearing`, `decision_density`, `stakes_guess`, `request_type` 같은 게이트를 갖고 있고, 테스트도 있다. 웹앱도 `progressive-engine.ts`에 `frame_status` 계열 판단이 들어가 있다.

하지만 "low-stakes"는 LLM이 틀릴 수 있다. 특히 사용자가 가볍게 말했지만 실제로는 법무/비용/평판 리스크가 숨어 있을 수 있다.

권장 UX:

- 기본값: low-stakes/flat이면 `crew/debate/review` 생략.
- 화면에는 짧게 표시: "가벼운 결정으로 보여서 바로 항로를 냈어요."
- 항상 선택권 제공: "팀에 맡겨 더 뜯어보기"
- 불확실하면 자동 생략하지 말고 사용자에게 선택: "이건 가벼운 결정인가요, 아니면 검토가 필요한가요?"

분류 기준:

- low-stakes: reversible, private, low cost, no external approval, no legal/security/finance/people impact.
- not low-stakes: irreversible, customer-facing, money/legal/security involved, third-party dependency, team commitment, public launch, contract, hiring/firing.

관련 파일:

- `src/lib/progressive-engine.ts`
- `src/components/workspace/progressive/ProgressiveFlow.tsx`
- `src/lib/__tests__/progressive-engine-frame-status.test.ts`
- `argus-plugin-v2/data/schemas/analysis-snapshot.json`
- `argus-plugin-v2/skills/clarify/SKILL.md`
- `argus-plugin-v2/skills/sail/SKILL.md`
- `argus-plugin-v2/evals/cases.json`
- `argus-plugin-v2/evals/static-gate.test.mjs`

권장 작업:

- web/plugin 둘 다 같은 `routing decision` vocabulary를 쓴다.
- `low_stakes_confidence`를 넣고, 낮으면 사용자 선택으로 넘긴다.
- UI에는 항상 "빠른 항로"와 "팀 검토" 두 길을 노출한다.

## 3. 플러그인과 웹앱 schema 공유

"꽤 통일했다"는 판단은 맞다. 실제로 이미 parity guard가 있다.

확인된 통일 지점:

- `src/lib/current-bearing.ts`의 `COURSE_STATUSES`
- `argus-plugin-v2/data/schemas/current-bearing.json`
- `src/lib/__tests__/course-status-parity.test.ts`
- `src/lib/ledger-schema.ts`
- `src/lib/__tests__/ledger-schema.test.ts`
- `src/lib/__tests__/predicate-basis.test.ts`
- `src/lib/__tests__/schema-drift.test.ts`

그래도 drift 위험이 남는 이유:

- 웹은 TypeScript interface 중심이고 plugin은 JSON Schema + SKILL.md 중심이다.
- 테스트가 "서로 맞는지" 막아주지만, 한 소스에서 생성되지는 않는다.
- Current Bearing은 웹에서 파생되고, plugin에서는 파일로 저장된다.
- schema enum은 맞아도 필드의 의미/UX 위치/저장 타이밍은 다를 수 있다.

즉 "많이 괴리되어 있다"기보다는, **수동 동기화가 꽤 잘 되어 있지만 생성형 단일 소스는 아니다**가 정확하다.

관련 파일:

- `src/lib/current-bearing.ts`
- `src/stores/types.ts`
- `src/lib/ledger-schema.ts`
- `src/lib/plugin-parse.ts`
- `src/lib/plugin-ingest-core.ts`
- `argus-plugin-v2/data/schemas/*.json`
- `argus-plugin-v2/skills/*/SKILL.md`
- `src/lib/__tests__/course-status-parity.test.ts`
- `src/lib/__tests__/ledger-schema.test.ts`
- `src/lib/__tests__/predicate-basis.test.ts`

권장 작업:

- 최소: parity tests 확대.
- 중간: `packages/argus-schema` 같은 공유 폴더 생성.
- 이상적: Zod/JSON Schema 중 하나를 canonical로 두고 TS type + plugin schema를 생성.

주의:

- 바로 대형 schema migration으로 가지 말 것. 먼저 `CurrentBearing`, `DecisionContract/LedgerDecision`, `AnalysisRouting` 세 개만 canonicalize한다.

## 4. Boss 기능: 재미 vs 진지함

현재 Boss는 viral/fun surface로 의미가 있다. 하지만 핵심 제품 루프 안에서는 "재미 캐릭터"보다 "stakeholder review"가 더 강하다.

이미 코드에도 방향은 일부 들어가 있다. `seat-not-type.test.ts`는 MBTI/type 자체가 아니라 seat/objective function이 가치라고 못박고 있다. 즉 "팀장 유형"의 재미는 껍질이고, 실제 가치는 승인자/고객/법무/운영/재무 관점이다.

제안:

- Fun Boss는 유지하되 acquisition/viral surface로 분리.
- Workspace 안에서는 "Stakeholder Review"로 표현.
- Boss 캐릭터가 들어와도 질문은 항상 seat 기준으로 한다.

권장 제품 구조:

- `/boss`: 재미형 진입점. 공유, 바이럴, 캐릭터, 가벼운 리허설.
- `/workspace`: 진지형 검토. "법무 담당자", "CFO", "핵심 고객", "운영 책임자" 같은 seat.
- 생성된 boss agent는 workspace에서 stakeholder reviewer로 재사용 가능.

관련 파일:

- `src/components/boss/*`
- `src/lib/boss/*`
- `src/stores/useBossStore.ts`
- `src/stores/useAgentStore.ts`
- `src/stores/agent-types.ts`
- `src/lib/review-prompt.ts`
- `src/lib/__tests__/seat-not-type.test.ts`
- `argus-plugin-v2/skills/boss/SKILL.md`
- `src/components/agents/AgentHub.tsx`
- `src/components/agents/AgentProfile.tsx`

권장 작업:

- copy/IA 변경: "Boss Simulator"보다 "Stakeholder Review"를 기본 명칭으로.
- fun labels는 `/boss`와 share card에 남긴다.
- workspace에서는 personality code를 숨기거나 secondary metadata로 내린다.

## 5. Telegram 답장으로 settlement

현재 Telegram loop는 완결되어 있지 않다.

현재 구현:

- `/api/telegram/connect`: 연결 코드 생성.
- `/api/telegram/webhook`: `/start <code>`만 처리해서 chat_id 저장.
- `/api/telegram/send`: 사용자가 결과물을 Telegram으로 보냄.
- webhook은 일반 답장/버튼/settlement intent를 처리하지 않는다.

따라서 지금 Telegram은 "공유/알림 채널"에 가깝고, "답장으로 정산" 채널은 아니다.

빠진 것:

- check-in due contract를 Telegram으로 보내는 경로.
- message에 contract id 또는 token을 심는 방식.
- 사용자가 답장하면 어떤 contract인지 매칭하는 방식.
- `happened / avoided / partial / still pending` 선택 처리.
- settlement note 저장.
- `DecisionContract` 업데이트 또는 ledger append.
- 중복 settlement/idempotency 처리.

관련 파일:

- `src/app/api/telegram/webhook/route.ts`
- `src/app/api/telegram/send/route.ts`
- `src/app/api/telegram/connect/route.ts`
- `src/stores/useTelegramStore.ts`
- `src/lib/decision-contract.ts`
- `src/components/projects/SettlementModal.tsx`
- `src/app/api/cron/checkin-due/route.ts`
- `src/lib/ledger-schema.ts`

권장 작업:

- 1차: due reminder를 Telegram으로 보내되 버튼/딥링크는 web settlement로 연결.
- 2차: inline keyboard로 `happened / avoided / partial / later`.
- 3차: 자유 답장을 `settle-align`으로 보조하되 최종 outcome은 사용자가 탭한 값만 기록.

## 6. Decision replay 화면

매우 좋은 제안이다. 지금 output은 "일부 재료는 저장되어 있지만, replay로 조립되어 보이지 않는다"가 정확하다.

현재 재료:

- problem text
- questions/answers
- snapshots
- branches/forks
- falsification
- debate_result
- mix/final_mix
- dm_feedback
- decision_contract
- settlement fields
- voyage log/checkpoints

하지만 사용자가 보는 완성 출력은 replay가 아니라 final document + bearing + settlement prompt에 가깝다.

Replay가 보여줘야 할 것:

- 처음 질문
- AI가 바꾼 실제 질문
- 답변하면서 바뀐 가정
- 버린 선택지
- 최종 Current Bearing
- 봉인한 Decision Contract
- 나중 실제 결과
- 배운 점

관련 파일:

- `src/components/workspace/progressive/Logbook.tsx`
- `src/lib/voyage-log.ts`
- `src/lib/branch-summary.ts`
- `src/lib/current-bearing.ts`
- `src/lib/decision-contract.ts`
- `src/components/projects/DecisionContractCard.tsx`
- `src/components/projects/SettlementModal.tsx`
- `src/app/[locale]/project/page.tsx`
- `src/stores/useProgressiveStore.ts`
- `src/stores/types.ts`

권장 작업:

- 새 컴포넌트: `DecisionReplayTimeline.tsx`
- 먼저 project detail/settlement 완료 후 화면에 붙인다.
- 그 다음 complete 화면에도 "이 결정의 궤적 보기"로 연결.
- 타임라인은 compact row 중심: 질문 → 전환 → 근거 → 선택 → 결과.

## 추가로 더 중요한 것들

## 7. Canonical BearingLedger

가장 중요한 추가 과제다.

현재 web Current Bearing은 `deriveCurrentBearing(session)`으로 파생된다. plugin은 `current_bearing.json`을 파일로 저장한다. 이 차이가 장기적으로 replay/settlement/learning을 흔든다.

작업 방향:

- 웹에도 `BearingLedger` 또는 `bearing_entries` 개념을 둔다.
- `CurrentBearing` 생성 시점, source snapshot, version label, contract seed를 같이 저장한다.
- replay와 settlement는 derive가 아니라 저장된 bearing을 기준으로 한다.

관련 파일:

- `src/lib/current-bearing.ts`
- `src/stores/types.ts`
- `src/stores/useProgressiveStore.ts`
- `src/lib/plugin-parse.ts`
- `src/lib/plugin-ingest-core.ts`
- `argus-plugin-v2/data/schemas/current-bearing.json`

## 8. Encoding / mojibake cleanup

여러 파일에서 한글 주석/문자열이 깨져 보인다. 기능과 무관해 보일 수 있지만, 프롬프트/UX 카피/테스트 설명이 많은 제품이라 방치하면 유지보수성이 크게 떨어진다.

관련 파일 예:

- `src/lib/current-bearing.ts`
- `src/components/workspace/progressive/ProgressiveFlow.tsx`
- `src/lib/__tests__/schema-drift.test.ts`
- `src/app/api/telegram/webhook/route.ts`

권장 작업:

- 기능 변경과 분리해서 별도 세션에서 처리.
- 먼저 실제 파일 인코딩 문제인지 터미널 표시 문제인지 판별.
- 프롬프트/사용자 카피 파일부터 복구.

## 9. Lint warning budget

현재 lint는 0 errors지만 warnings가 많다. 품질 게이트로서 "통과"는 맞지만, 장기적으로 unused/import/hook warning은 실제 버그를 묻는다.

관련 파일:

- broad; 별도 cleanup 세션 필요.

권장 작업:

- warnings를 카테고리별로 나눠 20개 단위로 줄인다.
- generated/script 경고와 app source 경고를 분리한다.
- hook dependency 경고는 기능 변경과 함께 처리해야 하므로 별도 PR.

## 권장 세션 분리

### Session A: Bearing-first completion + replay skeleton

목표:

- 완료 화면에서 Bearing을 기본 출력으로 올림.
- Decision replay timeline skeleton 추가.

파일:

- `src/components/workspace/progressive/ProgressiveFlow.tsx`
- `src/components/workspace/progressive/CurrentBearingCard.tsx`
- `src/components/workspace/progressive/FinalCard.tsx`
- `src/components/workspace/progressive/SealMoment.tsx`
- `src/components/workspace/progressive/DecisionReplayTimeline.tsx` 신규
- `src/lib/voyage-log.ts`
- `src/lib/branch-summary.ts`

### Session B: Low-stakes routing + explicit user choice

목표:

- low-stakes/flat/reversible 요청은 기본 fast path.
- 그 외 stakes가 중간 이상이거나 불확실한 요청은 기본 team review.
- 두 경우 모두 사용자가 반대 선택을 할 수 있게 함.
- plugin/web gates 동기화.

파일:

- `src/lib/progressive-engine.ts`
- `src/components/workspace/progressive/ProgressiveFlow.tsx`
- `argus-plugin-v2/skills/clarify/SKILL.md`
- `argus-plugin-v2/skills/sail/SKILL.md`
- `argus-plugin-v2/data/schemas/analysis-snapshot.json`
- `argus-plugin-v2/evals/*`

### Session C: Schema canonicalization

목표:

- CurrentBearing/DecisionContract/Routing schema를 한 소스에 가깝게 묶음.

파일:

- `src/lib/current-bearing.ts`
- `src/lib/ledger-schema.ts`
- `src/stores/types.ts`
- `argus-plugin-v2/data/schemas/current-bearing.json`
- `argus-plugin-v2/data/schemas/analysis-snapshot.json`
- `src/lib/__tests__/course-status-parity.test.ts`
- `src/lib/__tests__/ledger-schema.test.ts`

### Session D: Stakeholder Review / Boss split

목표:

- `/boss`는 viral fun 유지.
- workspace에서는 stakeholder review로 진지하게 재정의.

파일:

- `src/components/boss/*`
- `src/lib/boss/*`
- `src/lib/review-prompt.ts`
- `src/components/agents/AgentHub.tsx`
- `src/components/agents/AgentProfile.tsx`
- `src/stores/useBossStore.ts`
- `src/stores/useAgentStore.ts`
- `argus-plugin-v2/skills/boss/SKILL.md`

### Session E: Telegram settlement-by-reply

목표:

- Telegram에서 due reminder 수신.
- 답장/버튼으로 settlement 처리.

파일:

- `src/app/api/telegram/webhook/route.ts`
- `src/app/api/telegram/send/route.ts`
- `src/app/api/cron/checkin-due/route.ts`
- `src/lib/decision-contract.ts`
- `src/lib/ledger-schema.ts`
- `src/components/projects/SettlementModal.tsx`

### Session F: Canonical BearingLedger

목표:

- derive-only Current Bearing을 persisted ledger로 승격.
- replay/settlement/plugin import의 기준점 통일.

파일:

- `src/stores/types.ts`
- `src/stores/useProgressiveStore.ts`
- `src/lib/current-bearing.ts`
- `src/lib/plugin-parse.ts`
- `src/lib/plugin-ingest-core.ts`
- Supabase migration

### Session G: Encoding + lint debt

목표:

- 깨진 한글/주석/카피 복구.
- lint warnings를 줄임.

파일:

- broad cleanup
- 기능 세션과 분리 권장

## 추천 순서

1. Session A: 사용자가 체감하는 차별점이 가장 빨리 보인다.
2. Session B: 과한 항해 문제를 줄인다.
3. Session E: return loop를 실제 채널에서 닫는다.
4. Session F: 장기 moat의 데이터 구조를 만든다.
5. Session C: schema drift를 구조적으로 낮춘다.
6. Session D: viral fun과 serious product를 분리한다.
7. Session G: 품질 부채 정리.

주의: Session A와 F는 둘 다 Current Bearing을 만진다. A는 UI/replay 중심, F는 저장 모델 중심으로 명확히 나눠야 충돌이 적다.
