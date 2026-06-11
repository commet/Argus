# Argus

[English](./README.md) | [**한국어**](./README.ko.md)

**어려운 결정을 Argus에게 물어보세요. 약한 주장들을 뒤에서 검증한 뒤,
그 결정이 실제로 어디에 서 있는지 한 화면으로 알려줍니다.**

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
/argus:sail "막혀 있는 그 결정"        # 재시작 후
```

---

## 왜 Argus인가

AI 어시스턴트는 동의를 아주 잘합니다. 계획이 괜찮은지 물으면 대개
자신감 있고 매끄러운 **"네"** 가 돌아옵니다 — 아무도 검증하지 않은
주장들 위에 세워진 채로.

Argus는 그러지 않도록 설계됐습니다. 답하기 전에 먼저 진짜 질문이 무엇인지
벼리고, 에이전트 팀을 실제 코드·PR·문서 위에 투입해 일을 시키고, 그 결과의
**주장을 검증**합니다 — 근거가 있는 것과 그럴듯하게 들릴 뿐인 것을 분리한
뒤에야 답합니다. 그 답이 **Current Bearing**(현재 항로) 한 화면입니다:
지금 항로, 그 이유, 아직 검증 안 된 것, 의식적으로 접어둔 대안과 그 이유,
다음 한 수.

에이전트는 선원이지 무대가 아닙니다. 제품은 워크플로우 리포트가 아니라
**방향 감각**입니다.

---

## 받게 되는 것

Argus는 결정의 무게에 맞춰 일의 양을 조절합니다. 작고 되돌릴 수 있는
질문이면 30초 안에 바로 답합니다:

```text
/argus:sail "Workspace라는 이름을 Project로 바꿀까?"
```

```text
## Argus - Minimal - v0.1

권장: Project로 바꿔도 된다. 사용자 신호가 0이면 downside가 작다.
확인 1개 (<5분): 기존 이름을 언급한 support ticket이 있는가? 0이면 진행.
조심할 점: 출시 후 1주 안에 "어색하다"는 피드백이 나오면 롤백.

density: low - team, verification, boss skipped
Force full pipeline: /argus:sail --full "..."
```

무거운 질문이면 풀 파이프라인이 돌지만, 출력은 한 화면을 유지합니다:

```text
## Argus - Current Bearing - v0.1

현재 항로: 전체 통합을 결정하기 전에 4시간 migration spike를 먼저 한다.

왜 이 항로인가:
- 제품 정체성상 이점은 있지만, 비용 절감만으로는 이동을 정당화하기 어렵다.
- plugin과 webapp의 depth 차이가 사용 데이터로 아직 증명되지 않았다.

안개 / 암초: "plugin Boss가 6개월 안에 webapp depth를 따라잡는다"는 근거가 없다.
왜 중요한가: 이 주장이 맞아야 migration이 안전해 보인다.
필요 확인: surface별 DAU split을 확인한다.

가지 않은 길: 지금 전체 통합 - 수요를 증명하기 전에 migration 비용을 쓴다.

다음 조타: DAU split을 뽑고 migration spike를 실행한다.

계약 씨앗: plugin DAU가 30일 뒤 X보다 낮으면 webapp path를 흡수하지 않는다.
확인 시점: plugin release 30일 뒤.

자세히: .argus/sessions/2026-04-29-boss-absorption/versions/v0.1/
```

카드를 위에서 아래로 읽으면: **어디로 가는가**(현재 항로), **그 근거**,
**가장 위험한 미검증 주장**(안개/암초), **의식적으로 접어둔 대안**(가지
않은 길), **다음 구체적 행동**(다음 조타), 그리고 **나중에 현실과 대조할
수 있는 예측**(계약 씨앗). 전체 추론 — 모든 에이전트의 작업, 검증·반박된
주장 전부 — 은 `.argus/sessions/` 아래 파일로 보존됩니다.

---

## 언제 쓰면 좋은가

Argus는 코드 도구만이 아니라 판단 도구입니다. 잘 맞는 경우:

- "Firestore에서 Supabase로 옮길까?"
- "PR #42를 제품·리스크·구현 결정 관점에서 봐줘."
- "auth middleware 설계가 잘못됐나?"
- "이 전략 문서를 읽고 현재 항로를 잡아줘."
- "다음 분기에 EU 시장에 들어갈까, 한 분기 미룰까?"
- "시니어 IC 오퍼와 매니저 트랙 중 뭘 택할까?"
- "결제 벤더는 어디로 — 그리고 그 선택이 틀렸다면 뭐가 신호일까?"

비개발 결정은 아무 폴더에서나 실행하고, 핵심 사실을 붙여넣거나 로컬 문서를
지정하면 됩니다.

맞지 않는 경우:

- 문법 검색, 문서 찾기, boilerplate 생성.
- 점심 전에 혼자 결정해도 되는 가벼운 일.
- 이미 정한 답에 대한 검증 도장이 필요할 때 — Argus는 반박하도록
  설계되어 있습니다.

---

## 설치

Claude Code 안에서:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Claude Code를 재시작한 뒤, 아무 프로젝트에서:

```text
/argus:sail "결정해야 하는 질문"
/argus:sail @PR#123
/argus:sail @docs/strategy.md
```

**설정 제로.** 필요한 모든 것이 플러그인 안에 들어 있습니다. 첫 실행 때
`.argus/config.yaml`이 합리적인 기본값으로 자동 생성됩니다(언어는 자동
감지 — 바꾸거나 다른 이해관계자 페르소나를 고르려면 그 파일을 편집).
세션 기록은 기본적으로 **git-ignore**됩니다 — [프라이버시](#프라이버시--팀-공유) 참고.

### 요구사항

| 요구사항 | 용도 |
|---|---|
| Claude Code (최신) | 전부 |
| `git` | repo 인식 분석 (비개발 결정에는 불필요) |
| GitHub CLI `gh` | 선택 — `@PR#N` / `@issue#N` 자동 확장. 없으면 붙여넣기로 안내 |
| Node.js ≥ 16 | 선택 — statusline과 계약 리마인더 훅 |

macOS · Linux · Windows에서 동작합니다.

---

## 명령어

| 명령 | 하는 일 |
|---|---|
| `/argus:sail` | **여기서 시작.** 전체 흐름을 돌리고 Current Bearing을 렌더링. |
| `/argus:help` | 명령어 지도. 상황을 말하면 맞는 명령 하나를 짚어줌. |
| `/argus:chart` | 이 항해의 어디인가? 버전 트리, 미해결 확인, 다음 단계. promote/branch도 여기서. |
| `/argus:log` | 항해일지: 전체 세션의 과거 결정, 봉인된 계약, 예측 적중 기록. |
| `/argus:settle` | 확인일이 된 예측을 현실과 대조해 기록 — 캘리브레이션 히스토리가 쌓임. |
| `/argus:revise` | 리뷰 피드백을 새 초안에 반영하고 재검증 — 반복 루프. |
| `/argus:clarify` | 작업 전에 진짜 질문을 벼림 (sail이 가장 먼저 실행). |
| `/argus:team` | 에이전트 선원들을 실제 artifact에 투입 (sail이 체이닝). |
| `/argus:verify` | 선원들의 주장을 지지됨 / 반박됨 / 사람-확인-필요로 분리 (sail이 체이닝). |
| `/argus:boss` | 설정 가능한 페르소나의 이해관계자 압박 검토 (sail이 체이닝). |
| `/argus:helm` | *실험적.* 계획 승인 직전의 침묵 스캔 — 미검증 주장이 비가역 작업을 받칠 때만 발화. |

`sail` 플래그:

| 플래그 | 효과 |
|---|---|
| `--quick` | 질문 벼리기만; 파이프라인 없음. |
| `--full` | 작은 질문이라도 풀 파이프라인 강제. |
| `--no-boss` | 검증은 유지, 이해관계자 검토는 생략. |
| `--resume <session-id>` | 멈췄거나 막혔던 세션을 계속. |

---

## 작동 방식

무게 있는 결정에서 sail은 뒤에서 이 파이프라인을 돌립니다:

```text
clarify ──→ 선원 작업 ──→ verify ──→ 이해관계자 검토 ──→ Current Bearing
(진짜 질문)  (artifact를    (주장 분리:    (선택,            (한 화면)
             직접 작업)     지지/반박/     페르소나 기반)
                           사람 확인)
```

알아둘 세 가지 성질:

- **검증은 장식이 아니라 게이트입니다.** 핵심 주장에 근거가 없으면 카드는
  *보류*나 *근거 수집*이라고 말합니다 — 미검증 주장을 매끄러운 문장 속에
  숨기지 않습니다. 사람만 확인할 수 있는 건 추측하지 않고 직접 물어봅니다.
- **이견은 보존됩니다.** 에이전트들이 진짜로 충돌하면, 평균 내서 뭉개는
  대신 그 긴장과 해소 조건을 카드에 보여줍니다.
- **기계 장치는 숨겨집니다.** 에이전트 수, 스키마, phase 이름은 기본 출력에
  나오지 않습니다. 전체 흔적은 `.argus/sessions/<id>/`와 `/argus:chart`에
  있습니다.

### 정산 루프

결정에 가까워진 Current Bearing은 **계약 씨앗**으로 끝납니다: 확인 날짜가
박힌 반증 가능한 예측("plugin DAU가 30일 뒤 X 미만이면 webapp path를
흡수하지 않는다"). 루프는 이렇게 스스로 닫힙니다:

1. 조용한 세션 시작 훅 — 현재 프로젝트에 확인일이 지난 계약이 있을 때만
   **한 줄** 출력, 그 외엔 침묵. `/hooks`에서 언제든 끄기 가능.
2. `/argus:settle` — 현실이 어땠는지(적중/빗나감/부분/날짜 연기) 묻고
   append-only 원장에 기록.
3. `/argus:log` — 누적 기록을 보여주고, 정산이 충분히 쌓이면 새 항해가
   숨은 전제를 짚을 때 당신의 적중 기록을 조용히 참고합니다.

이게 복리가 붙는 부분입니다: 시간이 지나면 `.argus/`는 무엇을 결정했고,
무엇을 예측했고, 얼마나 맞았는지의 기록이 됩니다 — 새 도구가 돌려줄 수
없는 히스토리입니다.

---

## 비용과 실행 시간

풀 실행은 에이전트 여럿을 띄웁니다 — 공짜가 아닙니다. 멀티 에이전트 작업이
시작되기 전에 sail이 예상 시간 한 줄을 먼저 보여주므로, 가벼운 질문이
조용히 10분짜리 실행으로 변하지 않습니다. `Ctrl-C`로 중단, `--resume`으로
재개합니다.

| 경로 | 언제 | 시간 | 출력 토큰 |
|---|---|---|---|
| Minimal | 작고 가역적인 질문 | ~30초 | 적음 |
| 표준 (기본) | 대부분의 결정 | ~3–5분 | ~40–80k |
| Critical | 비가역 / 고영향 | ~6–10분 | ~100–180k |

API 예산이 빠듯하면 `--quick`을 권합니다.

---

## 프라이버시 & 팀 공유

`.argus/`에는 코드 diff, 파일 내용, 문제 텍스트가 들어갈 수 있습니다.
기본값은 프라이버시 우선입니다:

- `.argus/sessions/`는 **기본 git-ignore** — 결정 기록은 옵트인 전까지
  로컬에만 남습니다.
- 비밀로 보이는 것들(`.env*`, `*.key`, private key 블록, 고엔트로피 문자열)은
  diff가 모델로 가거나 디스크에 쓰이기 전에 **마스킹**됩니다.
- 팀과 공유하려면 `.argus/config.yaml`에서 `archive.commit_sessions: true`로
  바꾸고 ignore 줄을 지우세요 — 단, 커밋 전에 내용물을 확인하세요. 세션
  파일(그리고 질문에서 파생되는 세션 디렉토리 이름)에는 repo 접근 권한이
  있는 모두의 `git log`에 남을 업무 맥락이 들어 있습니다.

---

## 개발

```bash
# 로컬 클론으로 라이브 편집 (bash / Git Bash / WSL):
./argus-plugin-v2/install.sh --link
node ./argus-plugin-v2/scripts/validate-plugin.js   # 구조 + 계약 검사
node ./argus-plugin-v2/scripts/simulate-plugin.js   # 출력 품질 게이트
```

스킬 파일을 수정한 뒤에는 Claude Code를 재시작하세요 — 스킬 본문은 세션
시작 시 캐시됩니다. 참고: 복사 설치는 `argus:` 네임스페이스 없이(`/sail`,
`/team`, …) 노출되어 다른 스킬과 충돌할 수 있습니다. 위의 마켓플레이스
설치가 지원되는 경로입니다.

## 참고

- 변경 이력: `CHANGELOG.md`
- 에이전트 명단: `data/agents.yaml` · Boss 페르소나: `data/boss-types.yaml`
- 스키마: `data/schemas/*.json` (Current Bearing: `current-bearing.json`,
  검증 원장: `verification-ledger.json`)
- 버전 트리 메커니즘: `lib/session/version-numbering.md`
- 설계 방향: `../docs/ARGUS-FINAL-DIRECTION.md` ·
  빌드 로그: `BUILD_STATUS.md` · 테스트 플랜: `TEST_PLAN.md`

## 라이선스

MIT
