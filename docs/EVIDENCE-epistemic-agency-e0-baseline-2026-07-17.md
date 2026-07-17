# E0 Epistemic Agency Baseline Evidence

> 날짜: 2026-07-17
> 기준 HEAD: `57d789a3` (O1 #172 + O2 첫 수렴 #173 병합 후)
> 브랜치: `codex/epistemic-agency-design`
> 목적: E-B1~E-B12의 현재 상태, 활성 표면, 무접촉 경계를 구현 전에 고정
>
> 이 문서의 §2~§6은 **E0 당시의 역사적 baseline**이다. E1 격리 이후의 현재 상태와
> 실행 증거는 §7에 이어서 기록한다.

## 1. 판정 읽는 법

`baseline RED` 테스트가 초록이라는 말은 현행 동작이 안전하다는 뜻이 아니다. 테스트가
**알려진 위반을 정확히 찾아냈다**는 뜻이다. E1이 해당 동작을 고칠 때 같은 커밋에서
이 검출을 “위반이 다시 생기면 실패”하는 blocking regression gate로 뒤집는다.

현행 동작을 정상으로 재정의하거나 `todo`로 영구 방치하지 않는다.

## 2. 12개 baseline

| ID | 상태 | 활성 표면 | 현재 증거 | E1 이후 목표 |
|---|---|---|---|---|
| E-B1 | **known violation** | legacy | `context-builder.ts#buildAdaptiveContext`가 AI 생성 `hidden_assumptions.axis`를 “사용자 판단 패턴”으로 부르고 다음 모델에 생성 지시 | system artifact를 사용자 evidence에서 제외 |
| E-B2 | **known violation** | legacy | 첫 reframe 수락률 80% 초과를 사용자 패턴으로 말하고 대안 프레이밍을 더 강하게 지시 | 클릭·수락은 사건으로만 보존 |
| E-B3 | **known violation** | **default** | `narrateWaypoint()`가 LLM의 `why_abandoned`를 provenance 없는 `WaypointAlternative`에 병합 | AI 해석과 사용자 이유 필드 분리 |
| E-B4 | **known violation** | legacy | Rehearse가 “모든 이해관계자가 동의”하는 `common_agreements`와 influence 기반 priority를 요구 | 합성 렌즈 수렴을 합의·증거로 표현 금지 |
| E-B5 | **partial guard** | legacy | `key_conflicts`는 있으나 strongest dissent·missing evidence 필수 슬롯 없음 | 가장 강한 반대와 미확인 현실 정보 구조 보존 |
| E-B6 | **protected** | legacy | 낮은 override 경고가 제거됐고 `userChangedMind`는 DQ 산식에 들어가지 않음 | 현재 보호 유지, 동의/반대 어느 쪽도 점수화 금지 |
| E-B7 | **known violation** | legacy | override 40% 초과에 positive tone, “향후 AI 제안에 반영” 문구 | 수정 빈도를 비판성·품질·개인화 권한으로 사용 금지 |
| E-B8 | **known violation** | legacy | coda와 retrospective 문장이 grant 없이 enhanced system prompt에 직접 들어감 | 현재 관련성 + active grant 없으면 주입 0 |
| E-B9 | **known violation** | legacy | 전체 JudgmentRecord를 domain/scope 없이 전역 패턴으로 분석 | claim 범위 밖 일반화 0 |
| E-B10 | **missing guard** | architecture | runtime에 InfluenceGrant·InfluenceTrace·revoke control plane 없음 | grant 없는 derived memory 영향 0, trace 100% |
| E-B11 | **missing guard** | architecture | counterexample refs와 candidate/endorsed/contested/retired lifecycle 없음 | 반례가 핵심 구조를 깨면 영향 즉시 중지 |
| E-B12 | **known violation** | **settings + legacy** | DQ를 “점점 나아짐/러프함”으로 번역하고 vitality를 alive/dead로 분류해 Navigator 개입에 연결 | 사람 평가·개입 입력에서 절차 telemetry 격리 |

합계:

- known violation: **8**
- partial guard: **1**
- missing guard: **2**
- protected: **1**

## 3. 활성 표면 분리

### Default progressive

- `workspace/page.tsx`는 progressive session이 있고 `?step=`이 없으면
  `ProgressiveLayout`을 먼저 반환한다.
- ProgressiveFlow는 `useChronicler(session, !busy)`를 호출한다.
- 따라서 E-B3는 현재 기본 제품 항해에서 실제로 살아 있다.

### Settings

- `getObservationsSummary()`는 설정 화면에서 호출된다.
- 저장된 DQ 데이터가 있고 session count가 2 이상이면 E-B12 의미 언어가 보인다.
- 신규 DQ 계산의 직접 callsite는 현행 검색에서 없지만 기존 저장값의 read surface는
  살아 있으므로 dormant로 분류하지 않았다.

### Legacy opt-in

- `?step=reframe|recast|rehearse|synthesize`가 `useLegacyMode`를 켠다.
- Enhanced prompt, NavigatorStrip, Rehearse synthesis는 이 경로에 있다.
- E-B1, B2, B4, B5, B7, B8, B9는 실제 코드지만 기본 progressive와 혼동하지 않는다.

### Architecture gap

- E-B10과 B11은 현재 호출 가능한 위반 기능이 아니라, 철회·반박을 보장할 제어면이
  아직 없다는 구조적 공백이다.

## 4. 실행 증거

명령:

```powershell
npx vitest run src/lib/__tests__/epistemic-agency-e0-baseline.test.ts `
  src/lib/__tests__/blueprint-exit-evidence.test.ts `
  src/lib/__tests__/context-builder-simulation.test.ts `
  src/lib/__tests__/voyage-log-narrate.test.ts `
  src/lib/__tests__/navigator.test.ts
```

결과:

```text
Test Files  5 passed (5)
Tests       113 passed (113)
```

신규 E0 suite 자체 결과:

```text
Test Files  1 passed (1)
Tests       20 passed (20)
```

20개인 이유는 12개 fixture 외에 baseline manifest 2개, surface inventory 3개,
E-B12의 두 하위 검증, boundary 검증 2개가 포함되기 때문이다.

## 5. 무접촉 증거

E0에서 runtime production 파일 변경은 **0개**다. 변경 범위는 다음뿐이다.

```text
CLAUDE.md
docs/ARGUS-BLUEPRINT.md
docs/DESIGN-epistemic-agency-and-self-knowledge-governance-v1-2026-07-17.md
docs/EVIDENCE-epistemic-agency-e0-baseline-2026-07-17.md
src/lib/__tests__/blueprint-exit-evidence.test.ts
src/lib/__tests__/epistemic-agency-e0-baseline.test.ts
```

다음 소유 경로는 읽기만 했고 수정하지 않았다.

- O2: ledger/Core/writer/statusline
- O3: driver/plugin/commands/install/Boss 구현
- K: `argus-mcp/src/v4/**`, `src/lib/semantic-v4/**`
- 웹 공정 5: progressive UI production code

PR #172와 O2 첫 수렴 PR #173은 원격 `main`의 `57d789a3`까지 반영했다. E0는 그
최신 HEAD 위에서 복원되었고 O1/O2 production hunk를 수정하지 않았다. PR #172가 만든
`blueprint-exit-evidence.test.ts`에는 E 트랙용 evidence map만 추가해 세 E0 exit와 같은
커밋에서 검증한다.

## 6. 다음 전환 규칙

E1은 한 번에 전체를 고치지 않는다. 활성도와 오판 비용 순서로 간다.

1. default/live E-B3
2. settings/live-read E-B12
3. legacy silent influence E-B1·B2·B8·B9
4. legacy Navigator 재감사에서 E-B7까지 E1에 포함
5. O3 Boss 교체 뒤 E-B4·B5
6. E2 shadow control plane에서 E-B10·B11

각 수정 PR은 해당 baseline detector를 같은 커밋에서 blocking guard로 전환하고,
`protected`인 E-B6을 깨지 않는지 함께 확인한다.

## 7. E1 오염원 격리 실행 증거

실행 기준 HEAD: `91b820c8` (O2 방4 PR #176 병합까지 동기화).

E1은 저장된 과거를 삭제하지 않고, 승인받지 않은 해석이 미래 판단에 미치는 영향만
차단했다. 현재 분류는 다음과 같다.

| 상태 | 개수 | fixture |
|---|---:|---|
| known violation | 1 | E-B4 |
| partial guard | 1 | E-B5 |
| missing guard | 2 | E-B10, E-B11 |
| protected | 8 | E-B1, E-B2, E-B3, E-B6, E-B7, E-B8, E-B9, E-B12 |

구체적인 차단:

- E-B3: Chronicler의 LLM 응답 계약에서 `why_abandoned`를 제거했다. 새 대안의
  `why_abandoned`는 사용자가 직접 이유를 남기기 전까지 빈 값이며, 기존 저장 필드와
  기존 원문은 삭제하지 않는다. 재감사에서 출처 없는 legacy 값이 화면·export에 남는
  문제를 찾아 `why_abandoned_source === 'user'`인 값만 사용자 이유로 투영하게 했다.
- E-B12: settings의 DQ 추세 평결과 Navigator의 vitality 개입 경로를 제거했다.
  원 telemetry 저장소와 계산 모듈은 삭제하지 않았다.
- E-B1·B2·B8·B9: legacy global pattern·AI 생성 축·reframe 수락률·다른 프로젝트
  coda/outcome/retro prompt 코드를 제거했다. 같은 프로젝트의 명시적 사용자 판단만
  계속 문맥으로 쓸 수 있다.
- E-B7: override 수정 빈도의 positive coaching과 미래 반영 문구를 실행 경로에서
  제거했다. NavigatorStrip/Inline의 축 fingerprint·선호 전략·수정률·파생 coaching은
  E2 승인 체계 전까지 표시하지 않는다.
- E-B6: AI와 같거나 다른 선택 어느 쪽도 점수화하지 않는 기존 보호를 유지했다.

E1 검증 명령:

```powershell
npx vitest run src/lib/__tests__/context-builder-simulation.test.ts `
  src/lib/__tests__/epistemic-agency-e0-baseline.test.ts `
  src/lib/__tests__/voyage-log-narrate.test.ts `
  src/lib/__tests__/voyage-log.test.ts `
  src/lib/__tests__/blueprint-exit-evidence.test.ts `
  src/lib/__tests__/navigator-content.test.ts
```

결과:

```text
Test Files  6 passed (6)
Tests       158 passed (158)
```

전체 저장소 검증도 `npm test`로 통과했다: **250 files passed, 3189 tests passed**
(기존 skip 1 file / 10 tests 유지). 전체 `npm run lint`는 error 0, 기존 warning
127개로 저장소 상한 145 이내이며, `npx tsc --noEmit`도 통과했다.

E1 종료 시 남은 E-B4·B5는 O3 Boss 교체와 같은 의미 표면을 건드리므로 E4까지
보류했다. E-B10·B11은 이어지는 E2 shadow control plane에서 다룬다. 따라서 E1 완료는
“자기지식 기능 완성”이 아니라 **잘못된 자동 영향부터 0으로 만든 안전한 바닥**의 완료다.

## 8. E2 영향 제어면 shadow 실행 증거

E2는 사용자 화면을 열지 않고 다음 계약을 구현했다.

- `SelfKnowledgeClaim`: 후보·근거·반례·독립 사례·범위·lifecycle을 별도 E namespace에
  저장한다. K 객체는 `support_refs`의 read-only ID로만 참조한다.
- `InfluenceGrant`: endorse와 별도인 사용자 권한 기록이다. surface/domain/project/
  session/시작/만료를 모두 검사한다.
- `InfluenceTrace`: claim이 존재하는 모든 prompt 시도에서 사용·배제 이유를 기록한다.
  active grant를 쓰기 전에 trace 저장을 확인하며, 저장 실패 시 prompt 영향도 0이다.
  trace의 `prompt_section`은 제목이 아니라 실제로 삽입되는 전체 section과 일치한다.
- 단일 gate: legacy global pattern/coda/outcome/retro/adaptive 경로는 제거했고
  `context-builder.ts`는 `buildStoredPromptInfluence()` 한 곳만 통과한다.
- 철회·만료·범위 밖·미채택·근거 부족·material counterexample·`ask_once` 재사용·prompt
  budget 초과는 모두 fail-closed다.
- claim의 domain/project/time뿐 아니라 role 범위도 실제 호출 문맥과 대조한다. 저장된
  `supported` 표지를 신뢰하지 않고 support ref·독립 lineage·resolved case·반례 검색
  최소치를 gate에서 다시 계산한다.
- 시스템이 제안한 `personal_principle` 문구는 사용자가 직접 고쳐 쓰거나 작성하기 전에는
  endorse와 grant 기록이 있더라도 영향시킬 수 없다.
- 기존 live callsite는 domain을 넘기지 않고 E2 사용자 권한 UI도 없으므로 실제 사용자
  표면 영향은 기본 0인 shadow 상태다.
- 네 E2 저장소는 persistence contract에 **E2 shadow 동안만 local-only**로 명시했다.
  사용자 표면을 여는 E3 전에 서버 동기화, 계정 이동성, 감사 보존, 삭제 정책을 함께
  설계해 synced 계약으로 승격해야 한다. 이 상태는 장기 영속성 완성이 아니다.

현재 fixture 분류:

| 상태 | 개수 | fixture |
|---|---:|---|
| known violation | 1 | E-B4 |
| partial guard | 1 | E-B5 |
| missing guard | 0 | — |
| protected | 10 | E-B1, E-B2, E-B3, E-B6, E-B7, E-B8, E-B9, E-B10, E-B11, E-B12 |

핵심 기계 증거는 `src/lib/__tests__/epistemic-agency-e2-control-plane.test.ts`다.
grant 0, endorse/grant 분리, domain/project/role in/out scope, 시작 전·만료·철회,
ask-once, contested/retired, 반례, prompt budget, injection sanitation, 실제 최소 근거 재검증,
손상된 local record·adapter throw, exact prompt trace, trace write fail-closed, 실제 context
builder 연결을 검증한다.

E2 경계 검증 명령:

```powershell
npx vitest run src/lib/__tests__/persistence-contract.test.ts `
  src/lib/__tests__/epistemic-agency-e2-control-plane.test.ts `
  src/lib/__tests__/epistemic-agency-e0-baseline.test.ts `
  src/lib/__tests__/context-builder-simulation.test.ts
```

결과:

```text
Test Files  4 passed (4)
Tests       90 passed (90)
```

최종 전체 저장소 검증은 `npm test`에서 **251 files passed, 3217 tests passed**
(기존 skip 1 file / 10 tests 유지)였다. `npx tsc --noEmit`도 통과했고,
`npm run lint`는 error 0, 기존 warning 127개로 상한 145 이내다.
