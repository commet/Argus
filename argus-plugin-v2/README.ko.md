# Argus (Plugin v2.1)

[English](./README.md) | [**Korean**](./README.ko.md)

**Claude Code용 검증 우선 판단 도구.** Argus는 코드를 대신 짜거나 계획을
칭찬하려고 만든 도구가 아닙니다. 실제 결정 질문을 먼저 정리하고, agent team을
worker로 배치한 뒤, 그 결과를 supported, challenged, unresolved,
human-required claim으로 검증한 다음에야 decision scaffold로 보여줍니다.

---

## 바로 받는 결과

대부분의 결정은 되돌릴 수 있고, 30분짜리 팀 리뷰가 필요하지 않습니다.

```text
/argus:sail "Workspace라는 이름을 Project로 바꿀까?"
```

가벼운 결정이면 Argus는 minimal scaffold만 반환합니다.

```text
## Argus - Minimal - v0.1

권장: Project로 바꿔도 된다. 사용자 신호가 0이면 downside도 낮다.
확인 1개 (<5분): 기존 이름을 언급한 지원 티켓이 있는가? 0이면 진행.
조심할 점: 출시 후 1주 안에 "어색하다"는 피드백이 나오면 롤백.

density: low - team, verification, boss 생략
전체 파이프라인 강제: /argus:sail --full "..."
```

중요하거나 되돌리기 어려운 결정이면 전체 체인이 실행됩니다.

```text
clarify -> team -> verify -> boss -> final decision card
```

v2.1의 핵심은 `verify`입니다. agent team 결과를 바로 최종 카드로 승격하지
않고, 무엇이 근거 있는 주장인지, 무엇이 약하거나 반박되는지, 무엇이 아직
갈등으로 남는지, 무엇은 사람이 확인해야 하는지 먼저 분리합니다.

---

## 예시 흐름

> **질문:** "이번 분기 EU 출시를 강행할까, 한 분기 미룰까? GDPR 준비는 70%."

```text
clarify: critical stakes, framing confidence 76 - 사용자 확인
team: research, scenario, legal, risk worker 4명 배치
verify: supported claim 5개, challenged claim 2개, human check 3개
boss: 외부 GDPR 자문 확인 전에는 승인 불가
```

최종 카드는 이런 정보를 보여줍니다.

- **근거 있는 주장:** EU 수요는 일부 파이프라인 신호로 확인된다.
- **반박된 주장:** "GDPR 70%면 출시 가능"은 외부 자문 없이 근거 부족.
- **남은 긴장:** 출시 타이밍 이점 vs 컴플라이언스 손실 범위.
- **사람 확인:** 현재 GDPR gap이 launch-blocking인지 EU 자문가에게 확인.
- **판정 조건:** 자문가가 launch-blocking이 아니라고 하면 kill criteria와
  함께 출시, 아니면 한 분기 연기.

이게 제품 정체성입니다. Argus는 사람의 결정을 대체하지 않습니다. AI 팀이
그럴듯하지만 검증되지 않은 답을 자신 있게 내놓는 위험을 줄입니다.

---

## 언제 쓰면 좋은가

좋은 경우:

- "Firestore에서 Supabase로 마이그레이션할까?"
- "PR #42를 제품, 리스크, 구현 결정 관점에서 봐줘."
- "auth middleware 설계가 잘못됐나?"
- "이 기능은 webapp에 남길까, plugin으로 흡수할까?"

맞지 않는 경우:

- 문법 검색이나 공식 문서 확인.
- boilerplate 코드 생성.
- 점심 전에 혼자 바로 결정해도 되는 일.
- 이미 답을 정했고 검증받고 싶은 경우. Argus는 반대 근거와 갈등을 보존합니다.

---

## 설치

Argus는 Claude Code **플러그인**입니다. 명령이 `/argus:*`로 네임스페이스되려면
플러그인 마켓플레이스로 설치해야 합니다 (이게 `/argus:sail`을 작동하게 하는
핵심입니다). Claude Code 안에서:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Claude Code를 재시작한 뒤 아무 repo에서 실행합니다.

```text
/argus:sail "결정해야 하는 질문"
```

별도 설정은 필요 없습니다. `.argus/config.yaml`이 자동 생성됩니다. 기본적으로
`.argus/sessions/`는 **git-ignore**됩니다 (코드 diff·업무 맥락이 들어갈 수
있어서). 팀과 공유하려면 아래 "프라이버시/팀 공유"를 참고하세요.

> **왜 복사 스크립트가 아니라 마켓플레이스인가?** Claude Code는 설치된
> 플러그인의 명령에만 `argus:` 네임스페이스를 붙입니다. skill 폴더를
> `~/.claude/skills/`로 복사하면(기존 `install.sh` 방식) `/sail`, `/team` 처럼
> 네임스페이스 없는 이름이 되어 다른 skill과 충돌하고 문서의 `/argus:*`와
> 안 맞습니다.

### 사전 요구사항

- **Claude Code** (최신)
- **git** — repo 인식 분석에 필요
- **GitHub CLI (`gh`)** — *선택(권장).* `@PR#N`/`@issue#N` 자동 확장에 필요.
  없으면 붙여넣기로 안내됩니다.
- **Node.js ≥ 16** — *선택.* statusline을 쓸 때만.

### 플랫폼

macOS / Linux / Windows 모두 동작합니다(스킬은 Claude Code가 실행). 개발용
헬퍼 스크립트(`install.sh --link`, 로컬 클론으로 스킬 파일 실시간 편집)는
bash이므로 Windows에서는 **Git Bash 또는 WSL**에서 실행하세요.

```bash
# 로컬 개발(bash / Git Bash / WSL):
./argus-plugin-v2/install.sh --link
```

skill 파일을 수정한 뒤에는 Claude Code를 재시작해야 합니다. skill body는 세션
시작 시 캐시됩니다.

---

## Full Decision Card

`clarify`가 중요하거나 critical한 질문으로 판단하면 `sail`이 전체 체인을
자동 실행하고 compact card를 출력합니다.

```text
## Argus - 2026-04-29-boss-absorption - v0.1

질문: 두 surface의 사용자층이 정말 분리되어 있어서 Boss 코드를 중복 유지할
      가치가 있는가?

검증: mixed - supported 4개, challenged 2개, human check 1개
Top challenge: Plugin Boss가 6개월 안에 webapp depth를 따라잡는다는 근거 부족.

Boss (ISTJ Park): 4시간 migration spike와 rollback kill criteria를 정의한 뒤 진행.

이번 주 action: surface별 DAU split 확인 - 4시간 migration spike 실행.

의심 가정: plugin 사용자와 webapp 사용자의 Boss 니즈가 같다.

남은 긴장: 비용 절감은 작지만, 제품 포지셔닝상 통합이 맞을 수 있다.

사람 확인: DAU 비율 확인. 이 데이터는 사용자만 접근 가능.

.argus/sessions/2026-04-29-boss-absorption/versions/v0.1/
전체 트리: /argus:chart
```

뒤에는 clarify snapshot, worker results, mix result, verification ledger,
boss feedback, final scaffold, draft, session metadata가 JSON으로 남습니다.

---

## 라우팅

`/argus:sail "..."`은 `decision_density`와 `stakes_confidence`로 경로를
정합니다.

| 질문 모양 | 출력 | 이유 |
|---|---|---|
| 되돌릴 수 있는 단일 action, framing confidence 높음 | MinimalScaffold, team 없음 | 전체 팀은 과합니다. |
| important/critical, stakes confidence 높음 | `team -> verify -> boss` | raw agent output이 아니라 검증된 갈등을 먼저 봅니다. |
| borderline stakes | `AskUserQuestion` 1회 | routing 경계에서는 사람 선택권이 중요합니다. |
| verification이 blocker 발견 | 사람 선택 또는 team revision | 근거 없는 주장을 polished card에 숨기지 않습니다. |

Override:

- `/argus:sail --full "..."` 전체 파이프라인 강제.
- `/argus:sail --quick "..."` clarify만 실행.
- `/argus:sail --no-boss "..."` verification은 유지하고 boss만 생략.
- `/argus:sail --resume <session-id>` 멈춘 세션 재개.

---

## Commands

`/argus:sail`: 전체 흐름 orchestrator.

`/argus:clarify`: 질문을 정리하고 density/stakes를 판단.

`/argus:team`: 실제 artifact나 결정에 2-4명의 worker agent 배치.

`/argus:verify`: team output의 positive/negative validation 수행.

`/argus:boss`: verification 이후 stakeholder review 실행.

`/argus:chart`: version tree와 session artifact 확인.

---

## 다른 도구와 다른 점

1. **Panel critic이 아니라 worker.** agent는 실제 문제 위에서 domain work를 합니다.
2. **Polish 전에 verification.** supported, challenged, unresolved,
   human-required를 최종 카드 전에 분리합니다.
3. **갈등 보존.** agent disagreement를 평균내서 없애지 않습니다.
4. **사람 선택권.** AI가 확인할 수 없는 항목은 Claude Code의 terminal-native
   `AskUserQuestion` 흐름으로 선택권을 줍니다.
5. **Decision scaffold.** 무엇을 결정 중인지, 무엇을 알고 있는지, 무엇이 약한지,
   다음에 무엇을 해야 하는지를 보여줍니다.

---

## 참고

- Agent roster: `data/agents.yaml`
- Boss MBTI personalities: `data/boss-types.yaml`
- Verification ledger schema: `data/schemas/verification-ledger.json`
- JSON schemas: `data/schemas/*.json`
- Version tree mechanics: `lib/session/version-numbering.md`
- Build status and decision log: `BUILD_STATUS.md`
- Webapp: [argus.voyage](https://argus.voyage)
- License: MIT
