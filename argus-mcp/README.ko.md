# Argus Decision MCP

[English](./README.md) | [**한국어**](./README.ko.md)

Argus는 무게 있는 결정을 대화 너머로 이어 줍니다. 사용자가 채택한 예측, 현실에서
확인할 신호, 돌아올 때, 실제로 일어난 일을 함께 보존하고 그 결과를 다음 판단의
맥락으로 돌려줍니다. 사람을 채점하거나 결과를 지어내지 않습니다.

[Argus](https://github.com/commet/Argus) 프로젝트의 일부 · 웹앱
[argus.voyage](https://argus.voyage) · MIT 라이선스.

## 쓰면 이런 모습입니다

평소처럼 말하면 됩니다. Argus는 현실로 확인할 수 있는 한 가지를 남기자고 제안하고,
현실이 답할 때 다시 가져옵니다.

```text
2026-08-19
나      DynamoDB 말고 Postgres로 간다. 안 그러면 조인 패턴에서 죽는다.

       ┌ 이걸 예측으로 저장할까요?          (창은 사용하는 호스트가 그립니다)
       │ "Postgres가 읽기 복제본 없이 우리 조인 패턴을 4분기까지 감당한다"
       │ 확인일 2026-10-01
       └ 그대로 저장 · 문장이나 날짜 고치기 · 안 함

… 6주 뒤, 전혀 다른 대화에서 …

2026-10-01
argus  확인할 게 하나 있습니다 — 2026-08-19에 저장하신 문장입니다:
       "Postgres가 읽기 복제본 없이 우리 조인 패턴을 4분기까지 감당한다"
       실제로 어떻게 됐나요?

나      9월에 읽기 복제본 붙였다. 조인이 아니라 분석 쿼리 때문이었지만.

       기록했습니다. 처음 쓴 문장은 그대로 남고, 답이 그 옆에 덧붙습니다.
       점수는 매기지 않습니다.
```

내가 수락하지 않으면 아무것도 저장되지 않고, 결과를 Argus가 대신 채우는 일도
없습니다.

## 설치

**필요한 것:** **Node.js 18 이상** — 20 LTS로 검증했습니다 (`node --version`으로
확인, 없으면 [nodejs.org](https://nodejs.org)에서 설치). API 키도 계정도 필요
없습니다. 기록은 첫 호출부터 로컬 파일로 남습니다.

쓰시는 호스트에 맞는 절만 보세요. 어느 경로든 같은 서버가 설치됩니다.

### Claude Code

플러그인이 이 서버를 대신 배선해 주고, 그 위에 결정 명령까지 얹어 줍니다.

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Claude Code를 다시 시작한 뒤 `/argus:settings doctor`로 배선을 확인하세요.

명령 없이 서버만 원한다면 직접 붙여도 됩니다.

```bash
claude mcp add argus -- npx -y argus-decision-mcp          # 이 프로젝트에만
claude mcp add -s user argus -- npx -y argus-decision-mcp  # 모든 프로젝트에
```

`claude mcp add`는 기본이 **현재 프로젝트**입니다. 어디서나 쓰고 싶으면 `-s user`.

### Claude Desktop

설정 → 개발자 → **설정 편집(Edit Config)** 을 누르면 파일이 바로 열립니다.
파일 위치는 이렇습니다.

- **macOS** — `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** — `%APPDATA%\Claude\claude_desktop_config.json`

여기에 Argus를 추가한 뒤 **Claude Desktop을 완전히 종료했다가 다시 켜세요**
(창만 닫는 것으로는 부족합니다).

```json
{
  "mcpServers": {
    "argus-decision": {
      "command": "npx",
      "args": ["-y", "argus-decision-mcp"],
      "env": {
        "ARGUS_DIR": "/기록을/남길/절대경로/.argus"
      }
    }
  }
}
```

여기서도 `ARGUS_DIR`는 선택입니다 — 데스크탑 앱에는 "현재 프로젝트"라는 게 없어서,
기본적으로 기록이 흩어지지 않도록 개인 홈 원장(`~/.argus`)에 쌓입니다. 특정 위치에
남기고 싶을 때만 지정하세요. Windows에서는 역슬래시를 두 번 씁니다
(`"C:\\Users\\이름\\decisions\\.argus"`).

<details>
<summary>Windows: 서버가 안 나타날 때</summary>

- 먼저 손으로 실행해 보세요. `npx -y argus-decision-mcp`는 안내 한 줄을 출력한
  뒤 클라이언트를 기다립니다 — **멈춘 게 아니라 정상입니다** (Ctrl-C로 종료).
  그 외의 출력이 나오면 그게 진짜 오류입니다.
- 터미널에서는 되는데 `npx`가 실패하면 대개 npm이 전역 설치되지 않은 경우입니다.
  `%APPDATA%\npm` 폴더가 있는지 확인하고, 없으면 `npm install -g npm`.
- 로그에 치환되지 않은 `${APPDATA}`가 보이면 위 `env` 블록에
  `"APPDATA": "C:\\Users\\이름\\AppData\\Roaming\\"` 을 추가하세요.
- 로그 위치: `%APPDATA%\Claude\logs\mcp*.log` (macOS는 `~/Library/Logs/Claude`).

</details>

### Codex (CLI 또는 앱)

```bash
codex mcp add argus-decision -- npx -y argus-decision-mcp
codex mcp list        # argus-decision이 목록에 있고 켜져 있어야 합니다
```

추가한 뒤 Codex를 다시 시작하세요. `mcp add` 전에 열어 둔 대화에는 새로 등록한
도구가 들어가지 않습니다 — 앱을 껐다 켜거나 새 CLI 세션을 시작하세요.

<details>
<summary>Codex: 확인 창이 안 뜰 때</summary>

Argus는 예측을 저장하기 전에 한 번 누르는 확인 창을 띄웁니다. Codex는 기본 승인
정책에서 그 창을 그려 줍니다. 정책이 `never`이거나
`approval_policy.granular.mcp_elicitations = false`이면, Codex는 창을 아예 그리지
않고 프로토콜 `decline`을 돌려줍니다. MCP에는 그 정책 응답과 사용자가 빠르게
거절한 것을 구분할 표시가 없어서, Argus는 그것을 거절로 존중할 수밖에 없습니다.
확인 창이 필요하면 MCP elicitation을 켜고 다시 시도하세요.

AI가 초안한 **전제**에는 대화 경로가 하나 더 있습니다. 확인 창이 사용자에게
닿지 못하면 초안이 응답에 담겨 돌아오고, 사용자가 대화에서 승인하면 어시스턴트가
`chat_confirmed: true`로 다시 호출해 기록합니다. 어느 경로든 출처는
`ai_surfaced`로 남습니다.

</details>

### 그 밖의 MCP 호스트

```json
{
  "mcpServers": {
    "argus-decision": {
      "command": "npx",
      "args": ["-y", "argus-decision-mcp"],
      "env": {
        "ARGUS_DIR": "/프로젝트/절대경로/.argus"
      }
    }
  }
}
```

한 번 설치하면 손으로 갱신할 일이 없습니다. 위처럼 **버전을 적지 마세요** —
`npx`는 버전 없는 이름이면 실행할 때마다 레지스트리에 다시 물어보므로, 매 세션이
최신 빌드로 시작합니다.

<details>
<summary>왜 버전 범위를 쓰면 안 되는가</summary>

`@^2` 같은 **범위를 쓰지 마세요.** 범위는 npx 캐시에 이미 있는 사본으로 충족되기
때문에 레지스트리를 다시 조회하지 않고, 겉보기엔 멀쩡한 채로 몇 주씩 낡은 빌드에
얼어붙을 수 있습니다. 2026-07-29 실측 — 같은 스펙 문자열, 캐시에는 범위를 만족하는
낡은 버전이 있는 상태:

| 스펙 | 실제로 뜬 것 |
|---|---|
| `argus-decision-mcp` | 최신 발행본 |
| `argus-decision-mcp@^2.0.0` | 캐시에 있던 낡은 빌드 |

정확한 버전을 박는 것은 맞지만, 누가 고칠 때까지 거기서 얼어붙습니다. 어느 빌드가
답했는지 확인해야 할 때는 `argus_check_in`이 실제로 돌고 있는 버전
(`data.server_version`)을 알려 줍니다.

</details>

## 기록이 어디 남는가

첫 호출부터 내 디스크에 남습니다 — 따로 준비할 게 없습니다.

`ARGUS_DIR`는 선택입니다. 기본값은 한 가지 규칙을 따릅니다 —
*프로젝트의 증거가 원장의 자리를 정한다*:

- 작업 디렉터리가 **git 저장소 안**이거나 이미 `.argus` 폴더가 있으면
  → `<그-프로젝트>/.argus` (프로젝트별 격리, 기존과 동일)
- 그 외(임시 폴더, 또는 대화마다 새 폴더를 만드는 앱 — Codex 데스크탑 앱이
  그렇습니다) → **개인 홈 원장**(`~/.argus`). 대화마다 흩어져 고아가 되는
  대신 한곳에 쌓이게 하기 위해서입니다.

호출마다 넘기는 절대 경로 `argus_dir`가 전부를 덮어쓰고, `ARGUS_DIR`가 이 규칙을
덮어씁니다.

Argus는 다른 프로젝트를 뒤지지 않습니다. 홈 디렉터리에 있던 기존 원장을 조용히
옮기거나 합치지도 않습니다 — 들여다봐야 한다면 `ARGUS_DIR`로 명시해 주세요.

## 선택: 계정 동기화

켜기 전까지는 꺼져 있습니다. 브라우저에서 승인하기 전에는 아무것도 기기 밖으로
나가지 않습니다.

```bash
npx argus-decision-mcp connect       # 브라우저 승인 1회, 인증 정보는 로컬에 저장
npx argus-decision-mcp disconnect    # 이 기기에서 해제
```

브라우저가 없는 기기라면 `--headless`를 붙여 기기 코드 방식으로 진행합니다. CI에서는
`connect` 대신 웹앱 설정 페이지의 동기화 토큰을 `ARGUS_TOKEN`에 넣으세요. 인증 정보가
없으면 동기화는 조용히 아무 일도 하지 않습니다 — 로컬 기록은 그대로입니다.

## 내 데이터

기록은 `.argus/` 아래의 덧붙이기 전용 평범한 파일입니다. 내 것이니까
**그 폴더를 복사하면 백업이고, 지우면 삭제입니다.** 서버를 지워도 이 폴더는
건드리지 않습니다.

이사와 워크트리를 넘어 남는 내구 저장소를 위해 CLI에 `archive-export`,
`archive-restore`, `local-purge`도 있습니다. 셋 다 인자를 반드시 요구합니다 —
`--repository-id`, 절대 경로 `--archive-dir`, 그리고 무언가 지워지기 전에는
문자열 그대로의 `--confirm-repository`. 일부러 그렇게 만들었습니다. 판단 기록을
지우는 일이 한 단어짜리 명령이어서는 안 되니까요. 인자 없이 실행하면 무엇이
필요한지 이름을 알려 줍니다.

## 도구

호출 가능한 표면 전부는 여섯 개입니다.

| 도구 | 하는 일 |
|---|---|
| `argus_capture` | 결정과 사용자 소유의 맥락을 포착합니다. |
| `argus_predict` | 반증 가능한 주장 하나와 확인일을 기록합니다. |
| `argus_check_in` | 지금 볼 필요가 있는 기록을 읽습니다. |
| `argus_resolve` | 사용자가 직접 말한 결과를 덧붙입니다. |
| `argus_patterns` | 결정·영수증·타임라인·패턴을 읽습니다. |
| `argus_settings` | 언어·알림·명시적 동기화를 읽거나 바꿉니다. |

2.0 이전 이름들은 호출 가능한 별칭이 아닙니다. 그 이름으로 호출하면
`UNKNOWN_TOOL`이 돌아오므로, 호스트가 낡은 계약을 모르고 계속 쓰는 일이 없습니다.

## 설계 경계

- 로컬 우선, 덧붙이기 전용 기록.
- 기본은 프로젝트 격리.
- 사용자가 쓴 문장과 AI가 꺼낸 문장은 출처가 끝까지 구분됩니다.
- 기록된 텍스트는 신뢰하지 않는 데이터로 다룹니다.
- 평결·등급·정확도 점수·연속 기록·순위표 없음.
- 네트워크 동기화는 명시적으로만. 익명 텔레메트리는 `ARGUS_TELEMETRY=1`이 아니면
  꺼져 있습니다.
- 예기치 못한 오류는 서버 쪽에 기록하고 모델에는 일반화된 메시지만 돌려줍니다
  (경로나 스택을 노출하지 않습니다).

## 개발

```bash
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

발행되는 패키지에는 번들된 런타임 진입점 하나만 들어갑니다. 내부 구현과 실험
모듈은 별도로 호출하거나 import할 수 있는 파일로 배포하지 않습니다.

보고 절차와 신뢰 경계는 [SECURITY.md](SECURITY.md)를 보세요.
