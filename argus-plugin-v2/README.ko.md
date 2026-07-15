# Argus

[English](./README.md) | [**한국어**](./README.ko.md)

Argus는 Claude Code에서 쓰는 결정 루프입니다.

세 가지를 돕습니다.

1. 결정을 정리하고,
2. 나중에 맞고 틀림을 확인할 기준을 남기고,
3. 시간이 지난 뒤 실제로 어땠는지 다시 묻습니다.

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
/argus:sail "이걸 해야 할까?"
```

결정 뒤 Argus가 “나중에 확인할 기준을 남길까요?”라고 물을 수 있습니다. 나중에는
“실제로 어떻게 됐나요?”라고 묻습니다. 사용자는 예측대로, 빗나감, 부분, 나중에
중 하나로 답하면 됩니다. Argus가 결과를 대신 판단하지 않습니다.

---

## 설치

Claude Code에서:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Claude Code를 다시 시작한 뒤:

```text
/argus:sail "Firestore에서 Supabase로 옮길까?"
/argus:sail "PR 123 머지해도 되나?"
/argus:sail "docs/strategy.md 방향이 맞나?"
```

자연어로 그냥 물어도 됩니다. 질문에 PR, 파일, 브랜치, 문서가 들어 있으면
Argus는 그 자료를 읽고 실제 일이 벌어지는 자리에서 판단을 다룹니다.

지원 문서: `pdf`, `md`, `txt`, `pptx`, `docx`, `hwpx`. `xlsx`와 구형 Office/HWP
파일은 CSV/PDF로 내보낸 뒤 쓰는 편이 안전합니다.

---

## 하는 일

Argus는 그럴듯한 답만으로는 부족한 결정에 씁니다.

핵심 루프는 작습니다.

```text
결정하기      /argus:sail
되찾기        /argus:scan
기준 남기기   /argus:predict
나중에 확인   /argus:resolve
```

쉽게 말하면:

- `sail`은 지금 하고 있는 결정을 다룹니다.
- `scan`은 과거 Claude Code 대화에서 지나간 결정 후보를 되찾습니다.
- `seal`은 `sail`의 결정 씨앗이나 `scan`의 후보 중 하나를 나중에 확인할 기준으로 남깁니다.
- `settle`은 시간이 지난 뒤 실제로 어땠는지 묻습니다.

그 아래에는 결정 과정을 실제로 굴리는 명령들이 있습니다. `/argus:sail`이 보통
대신 호출합니다: `/argus:clarify`, `/argus:team`, `/argus:verify`,
`/argus:boss`, `/argus:revise`. 기록을 보고 싶으면 `/argus:journal`와
`/argus:versions`, 웹앱과 맞추려면 `/argus:connect`와 `/argus:sync`를 씁니다.

확인할 때가 되면 Argus가 로컬에서 짧게 알려줄 수 있습니다. 자동으로 판단하거나
정산하거나 웹앱에 보내지는 않습니다.

---

## 웹앱 동기화

플러그인은 local-first입니다. 웹앱 연동은 선택입니다.

프로젝트마다 처음 한 번 연결합니다.

```text
/argus:connect <argus_pat_...>
```

그 다음부터는:

```text
/argus:sync
```

`/argus:sync`는 먼저 웹앱에서 한 정산/연기를 로컬 ledger로 가져오고, 그 다음
갱신된 로컬 기록을 웹앱으로 보냅니다. 반복 실행해도 안전합니다.

`/argus:sync` 또는 `/argus:push`를 실행하지 않으면 웹앱으로 아무것도 보내지
않습니다.

---

## 명령어

| 명령 | 언제 쓰나 |
|---|---|
| `/argus:sail` | 결정해야 할 일이 있을 때. 여기서 시작합니다. |
| `/argus:scan` | 과거 Claude Code 대화에서 결정 후보를 회수할 때. |
| `/argus:predict` | 나중에 확인할 기준을 남길 때. |
| `/argus:resolve` | Argus가 실제로 어땠는지 묻거나, 확인할 때가 됐을 때. |
| `/argus:journal` | 결정 기록과 예측 기록을 볼 때. |
| `/argus:versions` | 항해/버전 트리를 볼 때. |
| `/argus:connect` | 이 프로젝트를 웹앱과 처음 연결할 때. |
| `/argus:sync` | 로컬 플러그인과 웹앱을 맞출 때. |
| `/argus:help` | 가장 짧은 명령어 지도가 필요할 때. |

`/argus:sail` 안에서 쓰이는 고급 명령: `/argus:clarify`, `/argus:team`,
`/argus:verify`, `/argus:boss`, `/argus:revise`, `/argus:preapprove`.

---

## 잘 맞는 경우

- "Firestore에서 Supabase로 옮길까?"
- "PR #42를 제품, 리스크, 구현 관점에서 봐줘."
- "auth middleware 설계가 잘못됐나?"
- "이 전략 문서를 읽고 지금 방향이 맞는지 봐줘."
- "다음 분기에 EU 시장에 들어갈까, 기다릴까?"
- "어떤 벤더를 골라야 하고, 뭐가 보이면 틀린 선택일까?"

개발자에게 가장 잘 맞는 순간:

- 머지 직전: "이 PR 머지해도 되나?"
- 큰 변경 전: "이 migration 지금 해도 되나?"
- AI plan 승인 전: "이 Claude Code plan 그대로 실행해도 되나?"
- 낯선 영역 진입 전: "billing/auth/permission 구조 어디부터 건드려야 하나?"

좋은 답은 일반론이 아닙니다. Argus는 파일, PR, 테스트, 실패 모드, 다음 작은
패치를 한 장에 남기려고 합니다.

잘 맞지 않는 경우:

- 문법 검색.
- boilerplate 생성.
- 점심 전에 바로 결정해도 되는 가벼운 일.
- 이미 정한 답을 확인받고 싶을 때.

---

## 프라이버시

Argus는 프로젝트 안의 `.argus/`에 기록을 남깁니다.

- `.argus/sessions/`에는 판단 과정이 저장되고, 기본적으로 git-ignore 됩니다.
- `.argus/ledger/`에는 나중에 확인할 기준과 웹앱 sync token이 저장되고,
  기본적으로 git-ignore 됩니다.
- 웹앱 동기화는 명시적으로 실행할 때만 일어납니다.

공유하거나 커밋하기 전에는 `.argus/` 내용을 확인하세요.

---

## 개발

```bash
./argus-plugin-v2/install.sh --link
node ./argus-plugin-v2/scripts/validate-plugin.js
node ./argus-plugin-v2/scripts/simulate-plugin.js
```

skill 파일을 바꾼 뒤에는 Claude Code를 다시 시작하세요. skill 본문은 세션 시작
시점에 캐시됩니다.

## 참고

- 변경 이력: `CHANGELOG.md`
- 에이전트 명단: `data/agents.yaml`
- Boss 페르소나: `data/boss-types.yaml`
- 스키마: `data/schemas/*.json`
- 빌드 로그: `BUILD_STATUS.md`
- 테스트 계획: `TEST_PLAN.md`

## 라이선스

MIT
