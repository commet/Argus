# Argus (Plugin v2.1)

[English](./README.md) | [**Korean**](./README.ko.md)

**Claude Code 안에서 쓰는 결정 항해 도구.** Argus는 현재 작업 폴더의 repo,
PR, 파일, 문서, 결정 맥락을 읽고 약한 주장과 확인 가능한 근거를 뒤에서
분리한 뒤, 한 화면의 `Current Bearing`을 돌려줍니다.

즉, 지금 항로가 무엇인지, 왜 그 항로인지, 무엇이 아직 안개인지, 어떤 길을
가지 않기로 했는지, 다음 조타가 무엇인지, 나중에 현실로 검증할 예측이
무엇인지 보여줍니다.

Argus는 multi-agent 대시보드가 아닙니다. Agent는 선원이고, 사용자가 보는
제품은 현재 항로입니다.

---

## 바로 받는 결과

가벼운 결정이면 Argus는 minimal scaffold만 주고 멈춥니다.

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

중요한 결정이면 내부에서는 더 많은 일을 하지만, 화면은 한 장으로 유지합니다.

```text
## Argus - Current Bearing - v0.1

현재 항로: 전체 통합을 결정하기 전에 4시간 migration spike를 먼저 한다.

왜 이 항로인가:
- 제품 정체성상 이점은 있지만, 비용 절감만으로는 이동을 정당화하기 어렵다.
- plugin과 webapp의 depth 차이가 사용 데이터로 아직 증명되지 않았다.

안개 / 암초: "plugin Boss가 6개월 안에 webapp depth를 따라잡을 수 있다"는 근거가 없다.
왜 중요한가: 이 주장이 맞아야 migration이 안전해 보인다.
필요 확인: surface별 DAU split을 확인한다.

가지 않은 길: 지금 전체 통합 - 수요를 증명하기 전에 migration 비용을 쓴다.

다음 조타: DAU split을 뽑고 migration spike를 실행한다.

계약 씨앗: plugin DAU가 30일 뒤 X보다 낮으면 webapp path를 흡수하지 않는다.
확인 시점: plugin release 30일 뒤.

자세히: .argus/sessions/2026-04-29-boss-absorption/versions/v0.1/
```

핵심은 긴 리포트가 아니라, 지금 어디로 가야 하는지 알 수 있는 한 화면입니다.
전체 과정은 `.argus/sessions/`에 남습니다.

---

## 언제 쓰면 좋은가

잘 맞는 경우:

- "Firestore에서 Supabase로 옮길까?"
- "PR #42를 제품, 리스크, 구현 결정 관점에서 봐줘."
- "auth middleware 설계가 잘못됐나?"
- "이 기능은 webapp에 남길까, plugin으로 흡수할까?"
- "이 전략 문서를 읽고 현재 항로를 잡아줘."

잘 맞지 않는 경우:

- 문법 검색이나 공식 문서 확인.
- boilerplate 코드 생성.
- 점심 전에 혼자 결정해도 되는 가벼운 일.
- 이미 결론을 정했고 검증받고 싶은 경우.

---

## 설치

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

Claude Code를 재시작한 뒤 아무 repo에서 실행합니다.

```text
/argus:sail "결정해야 하는 질문"
/argus:sail @PR#123
/argus:sail @docs/strategy.md
```

별도 설정은 필요 없습니다. `.argus/config.yaml`은 자동 생성되고,
`.argus/sessions/`는 decision history를 repo 안에 저장하므로 git으로 같이
옮길 수 있습니다.

개발 중에는:

```bash
./argus-plugin-v2/install.sh --link
node ./argus-plugin-v2/scripts/validate-plugin.js
node ./argus-plugin-v2/scripts/simulate-plugin.js
```

skill 파일을 수정한 뒤에는 Claude Code를 재시작해야 합니다.

---

## 내부 흐름

중요한 결정은 내부적으로 이 경로를 탑니다.

```text
clarify -> crew work -> verify -> optional stakeholder review -> Current Bearing
```

기본 `/argus:sail` 화면은 아래를 숨깁니다.

- worker 수
- verification count
- schema
- model name
- phase name
- 긴 workflow transcript

대신 JSON artifact는 남습니다: clarify snapshot, worker results, mix result,
verification ledger, boss feedback, current bearing, final scaffold, draft,
session metadata.

---

## 명령어

`/argus:sail`: 전체 흐름을 실행하고 Current Bearing을 보여줍니다.

`/argus:clarify`: 목적지와 결정 무게를 정리합니다.

`/argus:team`: 실제 artifact나 결정에 대해 crew agent가 작업합니다.

`/argus:verify`: crew output을 positive/negative로 검증합니다.

`/argus:boss`: verification 뒤 stakeholder review를 실행합니다.

`/argus:revise`: 검증, boss feedback, 사용자 지시에 따라 child draft를 만듭니다.

`/argus:chart`: version tree와 session artifact를 보여줍니다.

---

## 다른 도구와 다른 점

1. **Current Bearing 우선.** 기본 제품은 workflow transcript가 아니라 현재
   항로입니다.
2. **Panel critic이 아니라 crew.** Agent는 뒤에서 실제 문제에 대한 일을 합니다.
3. **Polish 전에 verification.** supported, challenged, unresolved,
   human-required를 먼저 분리합니다.
4. **가지 않은 길을 보존.** 버린 선택지가 없는 추천은 너무 쉽게 꾸며집니다.
5. **사람 확인을 숨기지 않음.** AI가 확인할 수 없는 것은 terminal-native
   `AskUserQuestion`으로 분리합니다.
6. **Decision-contract seed.** 정박에 가까워지면 나중에 현실로 확인할 수 있는
   예측을 남깁니다.
7. **Git-native memory.** 항해 기록은 `.argus/sessions/`에 남아 commit, 공유,
   재개가 가능합니다.

---

## 참고

- 최종 방향성: `../docs/ARGUS-FINAL-DIRECTION.md`
- Agent roster: `data/agents.yaml`
- Boss MBTI personalities: `data/boss-types.yaml`
- Verification ledger schema: `data/schemas/verification-ledger.json`
- Current Bearing schema: `data/schemas/current-bearing.json`
- JSON schemas: `data/schemas/*.json`
- Version tree mechanics: `lib/session/version-numbering.md`
- Build status and decision log: `BUILD_STATUS.md`
- Simulation harness: `scripts/simulate-plugin.js`
