# Argus

[English](./README.md) | [**한국어**](./README.ko.md)

Argus는 Claude Code에서 쓰는 결정 루프입니다.

세 가지를 돕습니다.

1. 결정이 무엇에 기대는지 벼리고,
2. 내가 남길 문장과 다시 볼 조건을 확정하고,
3. 시간이 지난 뒤 그때 문장부터 보고 내 답을 덧붙입니다.

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
# Claude Code를 다시 시작한 뒤:
/argus:review "이걸 해야 할까?"
```

결정 뒤에는 현실이 답할 생각, 내가 지킬 약속, 내가 세운 기준, 또는 오늘 그대로
남길 기록 중 무엇에 가까운지 고릅니다. 돌아올 사건이나 날짜가 오면 Argus가 원문을
먼저 보여주고 내 답을 덧붙입니다. 점수나 승률은 만들지 않습니다.

남는 것은 판단 영수증입니다 — 예측과 실제가 나란히, 평가는 없이:

```text
┌─ ARGUS · 판단 영수증 ────────────────────────────────────────┐

  내가 예측한 것                               2026-07-02 저장
    "신규 요금제 출시 후 30일 내 이탈률이 지금 수준을 유지한다"
    확인일 2026-08-01

  실제로 일어난 일                             2026-08-03 확인
    이탈률이 2%p 올랐다. 요금제 안내 부족이 컸다.

  이 판단을 내린 사람: 나 (모델 아님)

  ───────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  모델은 당신을 채점하지 않았습니다. 현실이 답했습니다.
└─────────────────────  argus · 예측 저장 → 실제 결과 기록 ⚓ ─┘
```

남는 것은 판단 영수증입니다 — 예측과 실제가 나란히, 평가는 없이:

```text
┌─ ARGUS · 판단 영수증 ────────────────────────────────────────┐

  내가 예측한 것                               2026-07-02 저장
    "신규 요금제 출시 후 30일 내 이탈률이 지금 수준을 유지한다"
    확인일 2026-08-01

  실제로 일어난 일                             2026-08-03 확인
    이탈률이 2%p 올랐다. 요금제 안내 부족이 컸다.

  이 판단을 내린 사람: 나 (모델 아님)

  ───────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  모델은 당신을 채점하지 않았습니다. 현실이 답했습니다.
└─────────────────────  argus · 예측 저장 → 실제 결과 기록 ⚓ ─┘
```

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
  `argus-decision-mcp` stdio 서버를 **정확한 버전으로 핀해서** 등록합니다.
  결정 도구(포착·판단 기록·예측·확인·답변·조회·설정)를 모델이 바로 쓸 수 있습니다.
  핀은 의도된 선택입니다 — `npx`는 스펙이 범위(`@^1` 등)면 캐시에 있는 설치본을
  계속 재사용해서, 배선이 옛 빌드에 얼어붙은 채 남을 수 있습니다.
  `argus_check_in`이 실제로 돌고 있는 버전(`data.server_version`)을 보고하고
  `/argus:doctor`가 그걸 핀과 대조하므로, 낡은 배선은 "기능이 없는 느낌"이 아니라
  눈에 보이는 사실이 됩니다.
- **조용한 훅 2개** — 세션 시작 때 확인일이 도달한 결정을 알려주는 점검(뒤처진
  결정 뷰는 새로 고침), 그리고 세션당 최대 1회(세션 밖 4시간 쿨다운) due 항목
  하나만 묻는 ambient 방아쇠. 침묵이 기본값이고, 끄기는
  `~/.argus/config.json`에 `{ "ambient": { "opt_out": true } }`.
- **`/argus:doctor`** — 설치·배선 읽기 전용 자가진단. 아무것도 고치지 않으며,
  각 줄에 고칠 수 있는 공개 도구 이름이 적혀 있습니다.
- **statusline (선택)** — [`statusline/index.js`](./statusline/index.js)가 로컬 판단
  기록을 읽습니다. 켜려면 `~/.claude/settings.json`에 1줄:
  `"statusLine": { "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/statusline/index.js" }`

결정 기록은 사용자 자산이라 **플러그인 제거가 절대 삭제하지 않는다**는 것이
저장 계약입니다 — `.argus/`와 `~/.argus`의 판단 기록 파일은 플러그인을 지워도 그대로
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
- `check`는 귀환 루프입니다 — 지금 확인할 것, 원문을 먼저 본 뒤 내 답 덧붙이기,
  후보 저장(`/argus:check <id>`), 전제 재확인(`/argus:check premises`).
- `history`는 기록입니다 — 결정 일지, 버전 트리, 중립적인 시간 순서, 그리고
  과거 대화 회수(`/argus:history scan`).
- `settings`는 설정입니다 — 언어·보스 페르소나, 웹앱 연결과 동기화.

예전 이름 두 개는 별칭으로 남습니다: `/argus:sail`(= review),
`/argus:resolve`(= 때가 된 기록에 답하기). 옛 단계 명령(clarify, team, verify, boss,
revise)은 더 이상 개별 명령이 아니라 review 안의 내부 단계입니다.

확인할 때가 되면 Argus가 로컬에서 짧게 알려줄 수 있습니다. 자동으로 판단하거나
답을 만들거나 웹앱에 보내지는 않습니다.

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

sync는 먼저 웹앱에서 한 답변/미루기를 로컬 ledger로 가져오고, 그 다음 갱신된
로컬 기록을 웹앱으로 보냅니다. 반복 실행해도 안전합니다.

직접 sync나 push를 실행하지 않으면 웹앱으로 아무것도 보내지 않습니다.

---

## 명령어

| 명령 | 언제 쓰나 |
|---|---|
| `/argus:review` | 결정·PR·문서를 전체 리뷰 파이프라인으로 압박 검증하고 싶을 때. |
| `/argus:check` | 다시 볼 때가 됐을 때 · 내 답 덧붙이기 · 후보 저장(`<id>`) · 전제 재확인(`premises`). |
| `/argus:history` | 결정 일지 · 버전 트리(`versions`) · 중립적인 시간 순서 · 과거 대화 회수(`scan`). |
| `/argus:settings` | 언어·보스 설정, 웹앱 연결/동기화(`connect <token>`, `sync`). |
| `/argus:help` | 가장 짧은 명령어 지도가 필요할 때. |

유지되는 별칭: `/argus:sail`(= review) · `/argus:resolve`(= 때가 된 기록에 답하기).
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
- 제한된 리뷰어 역할: `agents/`
- Boss 말투 스킨 (목소리 전용 — 리뷰의 실질은 설정된 자리): `data/boss-types.yaml`
- 스키마: `data/schemas/*.json`
- 빌드 로그 (동결된 역사 기록): `BUILD_STATUS.md`
- 테스트 계획 (동결된 역사 기록): `TEST_PLAN.md`

## 라이선스

MIT
