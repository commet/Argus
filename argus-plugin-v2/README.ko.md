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
/argus:review "이걸 해야 할까?"
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
/argus:review "Firestore에서 Supabase로 옮길까?"
/argus:review "PR 123 머지해도 되나?"
/argus:review "docs/strategy.md 방향이 맞나?"
```

질문에 PR, 파일, 브랜치, 문서가 들어 있으면 Argus는 그 자료를 읽고 실제 일이
벌어지는 자리에서 판단을 다룹니다. 결정을 그냥 대화로 말하면 조용한 기본이
작동합니다 — 포착하고, 나중에 확인할 기준을 남겨줄 수는 있지만, 깊은 리뷰
파이프라인은 `/argus:review`를 직접 부를 때만 돌아갑니다.

지원 문서: `pdf`, `md`, `txt`, `pptx`, `docx`, `hwpx`. `xlsx`와 구형 Office/HWP
파일은 CSV/PDF로 내보낸 뒤 쓰는 편이 안전합니다.

### 설치 하나로 배선되는 것

설치가 곧 설정 전부입니다 — 별도 초기화 명령은 없습니다.

- **결정 도구(MCP) 자동 배선** — 동봉된 [`.mcp.json`](./.mcp.json)이
  `argus-decision-mcp` stdio 서버를 등록합니다(`npx -y argus-decision-mcp`).
  결정을 포착하고, 예측을 저장하고, 확인할 것을 보고, 실제 결과를 기록하는
  6개 도구(`argus_capture` / `argus_predict` / `argus_resolve` / `argus_check_in`
  / `argus_patterns` / `argus_settings`)를 바로 쓸 수 있습니다. (배선되는 것은
  npm 출시본입니다 — 리포의 최신 시공분은 `argus-mcp/`에서 다음 `npm publish`
  때 설치본에 반영됩니다.)
- **조용한 훅 2개** — 세션 시작 때 확인일이 도달한 결정을 알려주는 점검(뒤처진
  LOGBOOK은 `argus_check_in` 재생성으로 안내), 그리고 세션당 최대 1회(세션 밖
  4시간 쿨다운) due 항목 하나만 묻는 ambient 방아쇠. 침묵이 기본값이고, 끄기는
  `~/.argus/config.json`에 `{ "ambient": { "opt_out": true } }`.
- **`/argus:doctor`** — 설치·배선 읽기 전용 자가진단. 아무것도 고치지 않으며,
  각 줄에 고칠 수 있는 공개 도구 이름이 적혀 있습니다.
- **statusline (선택)** — [`statusline/index.js`](./statusline/index.js)가 결정
  원장을 읽습니다. 켜려면 `~/.claude/settings.json`에 1줄:
  `"statusLine": { "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/statusline/index.js" }`

결정 기록은 사용자 자산이라 **플러그인 제거가 절대 삭제하지 않는다**는 것이
저장 계약입니다 — `.argus/`와 `~/.argus`의 원장은 플러그인을 지워도 그대로
남습니다.

---

## 하는 일

Argus는 그럴듯한 답만으로는 부족한 결정에 씁니다.

핵심 루프는 작습니다 — 명령 다섯 개, 기본은 조용함.

```text
깊은 검토     /argus:review
귀환 루프     /argus:check
기록          /argus:history
설정·동기화   /argus:settings
지도          /argus:help
```

쉽게 말하면:

- `review`는 지금 하는 결정을 전체 리뷰 파이프라인으로 압박 검증합니다(질문
  벼리기 → 리뷰어 에이전트가 실제 산출물 위에서 작업 → 주장 검증 → 선택적
  이해관계자 검토). **명시적으로 부를 때만** 돌아갑니다 — 스스로 실행되는
  일은 없습니다.
- `check`는 귀환 루프입니다 — 지금 확인할 것, 지난 예측의 현실 정산, 후보
  봉인(`/argus:check <id>`), 전제 재확인(`/argus:check premises`).
- `history`는 기록입니다 — 결정 일지, 버전 트리, 예측 성적, 반복 원칙, 그리고
  과거 대화 회수(`/argus:history scan`).
- `settings`는 설정입니다 — 언어·보스 페르소나, 웹앱 연결과 동기화.

예전 이름 두 개는 별칭으로 남습니다: `/argus:sail`(= review),
`/argus:resolve`(= due 정산). 옛 단계 명령(clarify, team, verify, boss,
revise)은 더 이상 개별 명령이 아니라 review 안의 내부 단계입니다.

확인할 때가 되면 Argus가 로컬에서 짧게 알려줄 수 있습니다. 자동으로 판단하거나
정산하거나 웹앱에 보내지는 않습니다.

---

## 웹앱 동기화

플러그인은 local-first입니다. 웹앱 연동은 선택입니다.

프로젝트마다 처음 한 번 연결합니다.

```text
/argus:settings connect <argus_pat_...>
```

그 다음부터는:

```text
/argus:settings sync
```

sync는 먼저 웹앱에서 한 정산/연기를 로컬 ledger로 가져오고, 그 다음 갱신된
로컬 기록을 웹앱으로 보냅니다. 반복 실행해도 안전합니다.

직접 sync나 push를 실행하지 않으면 웹앱으로 아무것도 보내지 않습니다.

---

## 명령어

| 명령 | 언제 쓰나 |
|---|---|
| `/argus:review` | 결정·PR·문서를 전체 리뷰 파이프라인으로 압박 검증하고 싶을 때. |
| `/argus:check` | 확인일이 됐을 때 · 현실 정산 · 후보 봉인(`<id>`) · 전제 재확인(`premises`). |
| `/argus:history` | 결정 일지 · 버전 트리(`versions`) · 예측 성적 · 원칙 · 과거 대화 회수(`scan`). |
| `/argus:settings` | 언어·보스 설정, 웹앱 연결/동기화(`connect <token>`, `sync`). |
| `/argus:help` | 가장 짧은 명령어 지도가 필요할 때. |

유지되는 별칭: `/argus:sail`(= review) · `/argus:resolve`(= due 정산).
비상구: `/argus:doctor` (읽기 전용 설치·배선 자가진단).

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
