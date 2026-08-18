# JCR J1 Correctness Evidence

> 상태: **J1 구현·회귀 검증 완료**
> 기준 branch: `codex/jcr-runtime-j1`
> 선행점: `e0405d8a` (`J0 canon + characterization`)
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` §7, §16, §24 J1

## 1. 이번 공정이 닫은 결함

| J0 debt | 구현 결과 | blocking evidence |
|---|---|---|
| J0-D1 model lineage를 독립성으로 계산 | minimum support에서 lineage count를 제거했다. 같은 model이어도 서로 다른 현실 관찰이면 인정하고, 여러 model이 같은 현실/source를 반복한 경우는 1개로 닫는다. | `counts independent resolved reality units, not model-lineage diversity` |
| J0-D2 SupportUnit/causal cluster 부재 | `SupportUnit`에 case, resolution, observation authority, causal/source cluster, model metadata, valid time, verification state를 타입화했다. | J1 characterization + E2 runtime tests |
| J0-D3 control-plane 내부 임의 string renderer | `prompt-renderer.ts`의 effect별 고정 template 하나로 이동했다. 저장 문장은 untrusted data cell만 차지한다. | `sanitizes a reviewed memory as data...` + injection corpus |
| J0-D4 recall과 background purpose 혼합 | `explicit_recall`은 `retrieve_only`만, `ordinary_generation`은 `ask_once`/`adapt_generation`만 통과한다. | `separates explicit recall from background influence` |
| J0-D5 conflict state 부재 | 명시된 conflict 관계의 양쪽을 fail-closed하고 상대 claim ID를 trace에 남긴다. | `fails closed for explicit conflicts instead of ranking one claim` |

## 2. support 판정 규칙

개인 패턴 claim은 다음 조건을 모두 만족해야 background influence 후보가 된다.

- 고유 support ref 3개 이상
- `resolved`이며 `ai_only`가 아닌 SupportUnit 3개 이상
- 고유 case, resolution event, observation ref가 각각 3개 이상
- 고유 causal cluster와 source cluster가 각각 3개 이상
- `unknown_shared` cluster 없음
- 미검색 counterexample scope 없음

`model_lineage_ids`는 provenance metadata로 보존하지만 support minimum에는 기여하지 않는다.
SupportUnit이 없는 E2 legacy record는 읽을 수는 있어도 독립성을 합성하지 않으며 influence에서
`insufficient_support`로 닫힌다. 같은 support unit ID 또는 같은 현실 관찰/정산 ref를 ID만
바꾸어 반복해도 support 수가 늘지 않는다.

이 J1 local shadow에서는 causal/source cluster ID의 발급 authority 자체를 새로 열지 않았다.
그 authority와 deterministic clustering은 J3의 aggregate/adapter 경계에서 구현한다. 따라서
J1은 기존 값을 낙관적으로 보강하지 않고 누락·AI-only·unknown-shared를 거부하는 방향만 연다.

## 3. prompt authority와 renderer

`src/lib/epistemic/prompt-renderer.ts`만 저장된 self-knowledge를 prompt section으로 만든다.

- behavioral language는 `InfluenceEffect`별 고정 template에서만 온다.
- claim/evidence는 최대 600/300자, evidence ref 최대 3개다.
- 공용 `sanitizeForPrompt()` 뒤 XML 경계 문자, role label, bracket role token, code fence를
  renderer 경계에서 다시 escape/neutralize한다.
- raw transcript, file, URL, tool invocation을 expand하거나 실행하지 않는다.
- fixed policy가 data cell보다 먼저 오며, 저장된 문장은 정확히 한 쌍의 `<user-data>` 안에만 있다.

영문 natural-language override, XML delimiter escape, ChatML role token, developer/assistant
label, code fence, 한국어 override를 포함한 corpus가 role boundary 불변식을 검증한다.
sanitizer만을 보안 경계로 간주하지 않고 typed effect, purpose gate, minimal payload, fixed policy,
quoted data cell을 함께 사용한다.

## 4. deterministic selection과 conflict

- background influence는 call당 최대 1개다.
- 선택 순서는 project → role → domain specificity, review/creation freshness, claim ID 순이다.
- cap을 넘긴 후보는 조용히 버리지 않고 `influence_cap_exceeded`를 기록한다.
- 현재 purpose에서 실제 사용 가능한 grant를 양쪽 claim이 가진 명시적 conflict는 둘 다
  `conflicting_authority`로 제외한다.
- conflict trace는 `related_claim_ids`로 상대 authority를 보존한다.
- conflict를 recency나 profile score로 조용히 이기게 하지 않는다.

J1은 neutral conflict question을 새 surface로 열지 않는다. 질문 permission과 durable use
reservation을 포함한 compiler 동작은 J3/J5에서 authority transaction과 함께 구현한다.

## 5. 유지한 fail-closed 불변식

- grant 0이면 influence 0
- endorsement와 permission은 별개
- scope/start/expiry/revoke/ask-once reuse 검사
- contested/retired/counterexample 차단
- review 후 과거 grant 재사용 금지
- malformed local record 무시
- trace persistence 실패 시 이미 만든 section도 0으로 회수
- personal principle의 system wording은 user rewording 없이 influence 불가
- legacy `independence` summary는 읽기 호환 metadata일 뿐 authority가 아님

## 6. persistence declaration

J1은 새 storage key, server table, 사용자 표면을 만들지 않았다. `SupportUnit`, `conflict_refs`,
`related_claim_ids`는 기존 E2 shadow records 안의 optional field다. 거취는 기존
`persistence-contract.test.ts` 선언을 그대로 따른다.

| key | 현재 거취 | J1 판단 |
|---|---|---|
| `SELF_KNOWLEDGE_CLAIMS` | localOnly E2 shadow | 유지; J3/J4 전에 server authority로 오인 금지 |
| `INFLUENCE_GRANTS` | localOnly E2 shadow | 유지 |
| `INFLUENCE_TRACES` | localOnly E2 shadow | 유지 |
| `CLAIM_REVIEW_EVENTS` | localOnly E2 shadow | 유지 |

서버 sync, account 이동성, RLS, export/restore/erasure 완료를 주장하지 않는다. 그것들은
정본의 J3/J4/J8 exit를 각각 통과해야 한다.

## 7. 검증 결과

2026-07-18 KST, repository root에서 실행했다.

| 검증 | 결과 |
|---|---|
| J1/E2 + E0 baseline + J0 characterization | 3 files, 63 tests passed |
| TypeScript `npx tsc --noEmit` | passed |
| changed-file ESLint | passed |
| production `npm run build` | MCP kernel build + Next.js production build passed |
| full Vitest suite (build 완료 후 순차 실행) | 252 files passed, 1 skipped; 3,243 tests passed, 10 skipped |
| `git diff --check` | passed |

## 8. J1 종료선과 다음 공정

J1의 exit는 **현재 local shadow 안에서** lineage inflation, duplicated reality refs,
purpose confusion, raw renderer bypass, untraced conflict selection이 blocking fixture를
통과하지 못하는 것이다. 이 범위는 닫혔다.

다음은 별도 변경 경계다.

1. J2: E4 synthetic consensus safety correction
2. J3: claim aggregate, commands/events/reducer/upcaster, local authority adapter
3. J4: server/RLS/outbox/artifact와 user-data erasure guards
4. J5: durable use reservation과 Context Compiler transaction

따라서 이 문서는 “JCR 전체 완료” 증거가 아니다. J1 correctness hardening의 완료와 이후
공정에서 아직 증명해야 할 durable authority 경계를 분리하는 증거다.
