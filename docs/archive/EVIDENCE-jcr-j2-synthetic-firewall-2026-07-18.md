# JCR J2 Synthetic Perspective Firewall Evidence

> 상태: **J2 구현·회귀 검증 완료**
> 기준 branch: `codex/jcr-runtime-j2`
> 선행점: `d86f2a49` (`J1 epistemic influence correctness`)
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` §18, §24 J2

## 1. 닫은 안전 위반

기존 Rehearse writer는 여러 persona가 같은 입력을 읽은 결과를
`common_agreements`로 쓰고, high-influence persona의 우려를 `priority: high`로
승격했다. 이는 synthetic repetition을 현실 증거·진실성·행동 우선순위처럼 보이게 했다.

J2 이후 새 write는 `SyntheticPerspectiveSet` 하나다.

- persona/model/worker 수와 무관하게 `independence_units: 1`
- generator/model/prompt/source-input lineage 필수
- 반복 항목은 `convergent_simulated_concerns`, 공통 결론이나 proof가 아님
- seat authority/influence는 metadata이며 truth/support/priority weight 0
- `team_contradictions` 보존
- `strongest_dissent.kind`로 observed/elicited/none_found 분리
- `unknowns_that_block_judgment`와 `reality_check_questions` 항상 존재
- synthetic output의 E SupportUnit 기여 0

## 2. web Rehearse 전환

### 새 writer

`src/lib/synthetic-perspective.ts`가 locale prompt, coercion, lineage, fallback,
legacy projection을 소유한다. `RehearseStep.tsx`는 이 경계를 호출할 뿐 두 번째 synthesis
architecture를 품지 않는다.

구조적 제한:

- LLM은 반복 우려/충돌/반대 렌즈/unknown/reality question 후보만 만든다.
- `independence_units`, lineage, perspective seat/source refs는 deterministic builder가 만든다.
- 반복 우려는 서로 다른 유효 perspective ID 2개 이상과 source ref 1개 이상이 없으면 폐기한다.
- 충돌은 서로 다른 perspective 두 개 이상이 없으면 폐기한다.
- synthesis 호출이 실패하면 free-text 종합으로 후퇴하지 않는다. 반복 결론은 0으로 두고
  extraction failure unknown과 reality-check를 기록한다.
- persona가 하나뿐인 Rehearse도 perspective set과 honest-gap fields를 저장한다.
- influence 값은 synthesis prompt에 전달하지 않는다.

### reader/UI

새 화면은 다음만 보여준다.

- 반복된 **가상 우려**
- kind와 search method가 붙은 가장 강한 반대 렌즈
- 관점 간 충돌
- unknown과 현실 확인 질문
- 동일 입력 전체가 independence unit 1이라는 명시적 한계

관점 수, high-influence badge, urgency ranking으로 truth/action priority를 표현하지 않는다.

## 3. legacy bytes와 dual reader

기존 `structured_synthesis` JSON은 rewrite하지 않는다.

`LegacyStructuredSynthesis` reader는 nested shape까지 검증한 뒤 다음 read projection만 만든다.

- `common_agreements` → `legacy_simulated_convergence`
- `key_conflicts` → legacy perspective conflicts
- `priority_actions` → priority를 제거한 user review item

UI는 이 기록이 이전 형식이며 공통 결론·사실·우선순위 증거가 아니라고 표시한다. 원본
priority byte는 보존되지만 새 판단이나 badge에는 사용하지 않는다. 손상된 legacy/new JSON은
어느 형식으로도 오인하지 않으며 plain stored synthesis fallback만 남긴다.

## 4. plugin team/verify firewall

신규 `argus-plugin-v2/data/schemas/synthetic-perspective-set.json`과
`versions/{label}/perspective_set.json` artifact contract를 추가했다.

team:

- 동일 snapshot을 본 모든 worker를 하나의 source cluster/unit으로 기록
- host가 model identity를 주지 않으면 `unreported`; identity를 발명하지 않음
- stage-2 echo도 새 support가 아님
- contradiction/dissent provenance/unknown/reality check 필수

verify:

- cross-agent repetition은 contradiction coverage일 뿐 evidence가 아님
- supported claim은 inspectable Evidence + 다른 non-count check가 필요
- strong은 direct evidence와 별도 source/reality locator가 필요
- worker/model/agent 수, 반복 concern, seat authority는 strength/confidence에 0
- ledger에 `synthetic_independence_units: 1`, strongest dissent, unknowns,
  reality questions 필수

runtime gate는 새 `perspective_set.json`이 존재하는 버전에 대해 위 필드와 ledger propagation을
검사한다. pre-J2 artifact에 perspective set이 없는 것은 legacy read로 남기되, 새 artifact가
부분적으로 쓰였거나 unit을 부풀리면 bearing 전에 `E4` violation이 된다.

## 5. E4 red-line 결과

| red line | 구현 결과 |
|---|---|
| 합의/다수/표결/N명 중 N명으로 truth 표현 | 새 Rehearse writer/reader label에서 제거 |
| agent 수가 evidence weight에 영향 | builder const 1 + verifier support rule + runtime gate |
| high-influence seat가 truth weight에 영향 | prompt input에서 influence 제거; seat metadata만 보존 |
| observed와 elicited dissent 혼합 | enum + source refs + search method |
| unknown field 누락 | web builder, plugin schema, verification ledger, gate에서 필수 |
| synthetic output이 E support가 됨 | web/plugin 모두 0, J1 SupportUnit gate와 분리 |

## 6. persistence declaration

새 localStorage key나 server column/table은 없다.

- web set은 기존 `FEEDBACK_HISTORY`에 들어가며 이 key는
  `persistence-contract.test.ts`에서 `feedback_records` synced로 선언되어 있다.
- `structured_synthesis`는 이미 존재하는 `feedback_records.structured_synthesis` JSON column을
  사용하므로 schema column 변경이 없다.
- plugin `perspective_set.json`은 기존 version directory의 새 write-once artifact다.
- legacy web/plugin artifacts는 in-place rewrite하지 않는다.

J2는 account archive/restore 완성을 주장하지 않는다. web `feedback_records`는 기존 account
export/erasure coverage를 따르고, JCR authority artifact의 portable restore는 J8 범위다.

## 7. 검증 결과

2026-07-18 KST, production build 뒤 suite를 순차 실행했다.

| 검증 | 결과 |
|---|---|
| J2/J1/E0 targeted | 4 files, 70 tests passed |
| production `npm run build` | MCP kernel + Next.js build passed |
| full Vitest suite | 253 files passed, 1 skipped; 3,252 tests passed, 10 skipped |
| plugin validation | passed |
| plugin enforcement gates | live 4 versions passed |
| gate fixtures | 29 passed, 0 failed |
| static eval gate | 16 passed, 0 failed |
| plugin install smoke | 19 skills, manifest parity v2.10.0 passed |
| TypeScript / changed-file ESLint | TypeScript passed; ESLint 0 errors, 7 warnings |
| `git diff --check` | passed |

## 8. 비변경 경계

- O3 public command/seat UX와 Boss contract를 변경하지 않았다.
- E2/J1 influence authority를 변경하지 않았다.
- legacy record bytes를 migration하지 않았다.
- synthetic perspective를 reality observation이나 user-authored claim으로 승격하지 않았다.
- E3B public Patterns surface를 열지 않았다.

이 문서는 J2 safety correction 완료 증거다. durable claim authority, event/upcaster/local adapter는
다음 독립 공정 J3에서 시작한다.
