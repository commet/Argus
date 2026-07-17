# JCR J9 evidence — E3B gated self-knowledge surface

> 날짜: 2026-07-18  
> 구현 상태: **code complete behind a closed release gate**  
> 공개 상태: **closed — O4 pass와 실제 comprehension study receipt가 없음**

## 1. 정직한 판정

J9의 코드·API·projection·UI·자동 검증은 구현됐다. 그러나 JCR §24의 J9 exit는
“E3B gate와 user comprehension study 통과”다. 저장소에는 실제 5명×21일 O4 pass 증거나
사용자 연구 결과가 없으므로, 이 문서는 exit를 통과했다고 주장하지 않는다. 환경변수만으로
열 수 없고 승인 레지스트리가 비어 있어 `/patterns`와 `/api/epistemic/review`는 404로 닫힌다.

이 상태가 의도된 완료 형태다. 제품 코드를 먼저 안전하게 병합하되, 사람이 수행해야 하는
가치·이해도 검증을 가짜 fixture로 대체하지 않는다.

## 2. 구현 지도

| 계약 | 구현 |
|---|---|
| O4 + comprehension release receipt | `src/lib/epistemic/e3b-release-gate.ts` |
| 독립 현실 근거 3개 floor | `src/lib/epistemic/patterns-projection.ts` |
| canonical source fail-closed resolver | `src/lib/epistemic/server-review.ts` |
| authenticated read/action API | `src/app/api/epistemic/review/route.ts` |
| review card | `src/components/patterns/ClaimReviewCard.tsx` |
| separate influence permission | `src/components/patterns/InfluenceGrantPanel.tsx` |
| five-dimension bounded projection | `src/components/patterns/PatternCard.tsx` |
| gated route | `src/app/[locale]/patterns/page.tsx` |
| comprehension 실행 절차 | `docs/PROTOCOL-e3b-comprehension-study-v1-2026-07-18.md` |

## 3. 구조 불변식

### 3.1 노출

- candidate는 `support_state=supported`이면서 서로 다른 support unit, case, resolution,
  observation, causal cluster, source cluster가 각각 3개 이상이어야 한다.
- `ai_only`, unresolved, shared/unknown cluster는 독립 근거로 세지 않는다.
- 세 observation과 resolution event를 현재 사용자의 canonical semantic stream에서 모두
  찾고 schema 검증해야 한다. 하나라도 없거나 event type이 맞지 않으면 카드 전체를
  `source_unavailable`로 제외한다.
- public Patterns는 endorsed + supported authority만 소비한다. candidate, contested,
  retired, forgotten은 노출하지 않는다.

### 3.2 행위

- review와 grant는 discriminated API action이고 한 payload에 합치면 거절된다.
- endorse는 `ReviewClaim` 하나만 만든다. grant ID나 effect가 없다.
- grant는 `GrantInfluence` 하나만 만들며 이미 endorsed인 aggregate에서 domain reducer가
  다시 eligibility를 확인한다.
- reword/contest/reopen/retire는 authority epoch와 기존 grant 무효화 규칙을 그대로 탄다.
- restricted origin 정책은 UI 편의를 위해 자동 확대하지 않는다.
- 모든 write는 aggregate version, authority epoch, account erasure epoch, semantic fingerprint,
  idempotency key를 가진 canonical gateway를 지난다.

### 3.3 공개 잠금

- `ARGUS_E3B_RELEASE_RECEIPT`는 등록된 receipt를 선택할 뿐 승인하지 않는다.
- navigation은 별도의 public build selector가 같은 등록 receipt를 고를 때만 나타난다.
- receipt는 O4 5명×21일, completed lifecycle 10, comparison cohort, 단조 7-stage funnel,
  pre-sealed threshold, 21일 실제 기간, comprehension 혼동 0과 성공률 100%를 모두 만족한다.
- production 승인 레지스트리는 현재 빈 배열이다.

## 4. 5차원 projection의 절제

1. 결과·빈도는 독립 resolved source 수만 말한다.
2. 시간·저자 궤적은 authored provenance와 authority receipt를 원 사건과 분리한다.
3. 인과·전제는 causal hypothesis와 독립 causal cluster가 있을 때만 available이다.
4. 교차 결정은 명시된 project scope가 2개 이상일 때만 available이다.
5. 전이 코칭은 현재 판단과 검증된 relation이 없으므로 unavailable로 남긴다.

빈 차원을 LLM 문구로 채우지 않는다. 성격 점수·동의율·profile rank는 만들지 않는다.

## 5. 자동 검증

핵심 fixture:

- `src/lib/__tests__/jcr-j9-release-projection.test.ts`
- `src/lib/__tests__/jcr-j9-review-actions.test.ts`
- `src/components/patterns/__tests__/e3b-separation.test.tsx`
- `src/app/api/epistemic/review/__tests__/route.test.ts`

2026-07-18 최종 로컬 결과:

| 검증 | 결과 |
|---|---|
| `npm run test:coverage` | 263 files passed, 1 skipped / 3402 tests passed, 10 skipped / ratchet pass |
| J9 집중 fixture | 4 files / 12 tests pass |
| `npm --prefix argus-mcp test` | 104 files / 1000 tests pass |
| `npm run build` | Next.js production build + TypeScript pass, `/[locale]/patterns`와 API route 생성 확인 |
| `npm run lint` | 0 errors, 기존 warning 127 (limit 145 이내) |
| gates | `gates` pass, `gates:test` 29/29, `signals:test` 68/68, `eval:static` 16/16 |
| plugin | validator pass, push script syntax pass |
| diff | `git diff --check` pass |

첫 coverage 실행은 J9 카드의 왼쪽 accent bar를 저장소의 영구 금지 디자인 fixture가
탐지해 실패했다. 왼쪽 막대·source 세로선·grant 연결선을 모두 제거하고 배경 틴트와
활자 위계로 교체한 뒤 전체 coverage를 재실행해 통과했다. fixture를 우회하지 않았다.

## 6. 외부 완료 절차

1. O4 thresholds를 봉인한다.
2. 5명 이상을 21일 이상 관찰하고 7-stage funnel과 비교군을 수집한다.
3. comprehension protocol을 비유도 방식으로 실행한다.
4. 집계 증거를 hash하고 pass/hold/kill/iterate를 판정한다.
5. pass인 경우에만 receipt를 승인 레지스트리에 추가하는 별도 PR을 낸다.
6. server/client selector를 같은 receipt ID로 배포하고 cross-device revoke 및
   export→delete→restore smoke를 다시 실행한다.

O4나 comprehension이 실패하면 J9 구현은 main에 남아도 public surface는 계속 닫힌다.
