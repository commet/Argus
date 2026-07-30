<p align="center">
  <img src="public/voyage/voyage-mast.jpg" alt="Argus — 세이렌의 노래 앞에서 돛대에 스스로를 묶는 오디세우스" width="820">
</p>
<p align="center"><em>
오디세우스는 세이렌의 노래를 듣기 전에 스스로를 묶었습니다.<br>
Argus는 유창한 답이나 사후 확신이 덮어쓰기 전에, 결정을 그 전제와 다시 볼 조건에 묶어 둡니다.
</em></p>

<h1 align="center">Argus</h1>

<p align="center"><strong>Keeping Judgment Human.</strong></p>
<p align="center">AI가 실행을 가져간다. 판단은 어디에 쌓이나?</p>

<p align="center">
  <a href="https://www.npmjs.com/package/argus-decision-mcp"><img src="https://img.shields.io/npm/v/argus-decision-mcp?color=A8842F&label=npm%20%C2%B7%20argus-decision-mcp" alt="npm 버전"></a>
  <img src="https://img.shields.io/badge/Claude%20Code%20plugin-argus-667572" alt="Claude Code 플러그인">
  <img src="https://img.shields.io/badge/license-open--core-6E8261" alt="라이선스: open-core">
  <img src="https://img.shields.io/badge/local--first-계정%20불필요-242321" alt="로컬 우선">
</p>

<p align="center">
  <a href="https://argus.voyage"><strong>웹앱</strong></a> ·
  <a href="#-30초-만에-시작하기">설치</a> ·
  <a href="#argus가-하는-일">하는 일</a> ·
  <a href="#판단-기록">판단 기록</a> ·
  <a href="#라이선스">라이선스</a> ·
  <a href="./README.md">English</a>
</p>

Argus는 결정의 뒤편에 남는 것을 기록합니다. 처음 한 말, 결정이 기대던 전제,
내가 직접 확정한 문장, AI 제안을 채택했는지, 그리고 무엇이 생기면 다시 볼지까지요.
기록은 현실이 답할 생각일 수도, 내가 지킬 약속이나 세운 기준일 수도, 그저 오늘
그대로 남길 순간일 수도 있습니다. 더 나은 답을 주는 도구가 아니라, 시간이 지나도
과거를 덮어쓰지 않는 **살아 있는 판단 기록**입니다.

---

## 왜 "Argus"인가

<img align="right" width="210" src="public/images/brand/argus-v2/argus-returning.jpg" alt="Argus — 변장한 오디세우스를 알아본 충견">

위의 돛대와 **Argus**라는 이름은 이 제품의 두 축입니다. 오디세우스는 세이렌의
노래가 판단을 삼키기 전에 스스로를 묶었습니다. 그의 개 Argus는 20년 뒤 거지
행색으로 돌아온 주인을 누더기 아래서 알아봤습니다. 하나는 설득 앞에서 선택을
붙들고, 다른 하나는 시간과 겉모습 너머의 기억과 알아봄, 곁을 지키는 마음을
간직합니다.

이 제품이 하려는 게 딱 그겁니다. AI와 오래 일하다 보면, 그 매끈한 말솜씨가 어느새
"내가 왜 그렇게 결정했더라"까지 대신 기억해 버립니다. Argus는 문 앞을 지키는
개입니다. 결정할 때 **내가 무엇을 믿었는지 기억하고**, 매끄러운 답 아래 **숨은
전제를 알아보고**, 내가 고른 신호를 **곁에서 지켜보다가**, 현실이 답할 때 **먼저
돌아옵니다.**

대신 결정해 주지 않고, 사람을 채점하지도 않습니다. 현실은 사실에 답할 수 있지만,
약속이나 기준이 지금 어떻게 되었는지는 오직 내가 답합니다.

---

## ⚡ 30초 만에 시작하기

들어가는 문은 셋, 안에서 도는 루프는 하나입니다. 편한 문으로 시작하세요.

| | 이런 분께 | 시작하기 |
|---|---|---|
| 🌐 **웹앱** | 누구나. 설치·가입 필요 없음. | **[argus.voyage](https://argus.voyage)** 열기 |
| 🧩 **MCP 서버** | MCP를 지원하는 AI 어시스턴트라면 어디든 — Claude Code, Claude Desktop, Codex, Cursor… | `claude mcp add argus -- npx -y argus-decision-mcp`<br><sub>다른 호스트 → [argus-mcp/README.md](./argus-mcp/README.md)</sub> |
| 🔌 **Claude Code 플러그인** | 코드베이스 *안에서*, 실제 PR·파일 위에서 결정할 때. | `/plugin marketplace add commet/Argus`<br>`/plugin install argus@argus` |

<sub>잘 모르겠으면 **웹앱**이 제일 편합니다 — 아무것도 설치 안 해도 됩니다. 모든 AI 대화에서 쓰고 싶다면 **MCP 서버**가 답이고요. (MCP = Model Context Protocol, 어시스턴트가 도구를 불러올 때 쓰는 공개 표준입니다.) 자세한 설정과 도구 목록은 **[argus-mcp/README.md](./argus-mcp/README.md)**(영문), **[argus-plugin-v2/README.ko.md](./argus-plugin-v2/README.ko.md)** 를 보세요.</sub>

<sub>**필요한 것:** 웹앱은 브라우저만 있으면 됩니다. MCP 서버와 플러그인은 `PATH`에 **Node.js 18 이상**이 필요합니다 — `node --version`으로 확인하고, 아무것도 안 나오면 [nodejs.org](https://nodejs.org)에서 설치하세요 (20 LTS로 검증했습니다). API 키도, 계정도, 설정 파일도 필요 없습니다 — 기록은 처음 쓰는 순간부터 로컬 파일로 남습니다.</sub>

---

## Argus가 하는 일

크게 두 가지입니다. 그리고 두 번째는 대부분의 도구가 그냥 지나치는 부분이죠.

### ① 결정하는 동안 — 내 판단과 AI의 판단을 갈라 둡니다

AI와 오래 일하다 보면 그쪽 가정이 슬그머니 내 생각에 섞여 듭니다. Argus는 그 둘을
떼어 놓고, 다시 섞이지 않게 지킵니다.

- **있는 그대로 기억합니다.** 내가 쓴 말, 내가 깔았던 전제, 내가 확정한 문장 —
  그리고 그게 누구 것인지까지. 모든 전제에는 내 것인지 AI의 것인지 꼬리표가
  붙어서, 모델이 꺼낸 생각이 슬그머니 내 믿음으로 둔갑하지 않습니다.
- **표면 아래를 봅니다.** 매끄러운 답 밑에 깔린 숨은 전제와 진짜 질문을 짚어
  줍니다. 대신 어느 쪽이 맞다고 골라 주지는 않습니다.

### ② 결정한 뒤 — 곁에서 지켜보고, 답할 수 있는 때 돌아옵니다

- **정직하게 지켜봅니다.** 내가 고른 신호만 지켜보고, 결정이 아직 열려 있는 동안
  핵심 전제가 여전히 맞는지 확인합니다. 여러 결정이 같은 전제에 기대고 있다면,
  중요한 변화가 생겼을 때 한 번의 재확인에 함께 모아 보여 줍니다. 같은 알림을
  쌓는 대신, 그 결정들이 왜 함께 흔들리는지 보여 주는 겁니다.
- **먼저 돌아옵니다.** 정한 날에, 혹은 지켜보던 전제가 크게 움직이면 그보다 앞서
  다시 찾아옵니다.
- **평결 대신 시간 순서가 남습니다.** 먼저 그때 문장을 보여주고, 현실에서 확인한
  것과 약속·기준의 현재 상태, 처음 질문이 여전히 유효한지를 따로 덧붙입니다.
  점수나 승률은 저장하지 않습니다.

---

## 하나의 루프

Argus가 어디서 돌든 루프는 똑같습니다.

1. **적고, 가른다.** 첫 발화와 확정한 문장을 남기고, AI 제안을 채택했다면 그 족보도
   따로 기록합니다.
2. **답할 수 있게 만든다.** 무엇을 확인할 기록인지, 어떤 사건이나 날짜에 다시 볼지
   정합니다. 오늘을 그대로 남기는 기록은 돌아올 약속이 없어도 됩니다.
3. **조용히 기다린다.** 재촉하지 않습니다. 정한 사건이 생기거나 날짜가 오면 딱 한
   번 알려 줍니다.
4. **원문부터 다시 본다.** 현실, 약속, 질문의 유효성을 따로 답합니다. 모델은 답을
   추측하지 않습니다.
5. **시간 순서가 쌓인다.** 나중 문장과 답은 덧붙고, 과거 문장은 그대로 남습니다.
   사람에 대한 점수나 적중률은 저장하지 않습니다.

<details>
<summary>문마다 어떻게 보이나</summary>

- **웹앱** — 상황을 한 줄 적거나 전략 문서를 올리면, AI 팀이 숨은 전제를 짚어
  주고, 사람만이 판단할 몫을 따로 표시하고, 전제가 바뀌면 알려 줍니다.
- **MCP 서버** — 아무 대화에서나 결정을 툭 꺼내 말하면, 사용자가 확정한 기록과
  다시 볼 사건·날짜를 보존하고 때가 되면 다시 불러 줍니다.
- **Claude Code 플러그인** — 실제 코드·PR 위에서 다섯 개 명령:
  `/argus:review`(깊은 압박 검증, 직접 부를 때만) · `/argus:check` ·
  `/argus:history` · `/argus:settings` · `/argus:help`.

</details>

---

## 판단 기록

한 번 끝나고 마는 문서가 아니라, 시간에 따라 이어지는 기록입니다. **AI가 제안한
것**과 **내가 확정한 문장**은 따로 남고, 나중 답은 과거 문장을 고치지 않고
덧붙습니다.

```
┌─ ARGUS · JUDGMENT RECORD ─────────────────────────────────┐
  확정 2026-04-02                     다시 봄 2026-06-30

  처음 한 말
    "사용자가 눈치채는 점검 시간 없이 전환할 수 있는가?"
  AI가 짚은 전제
    인덱스 재구축이 복제 지연 예산 안에 든다.
  내가 확정한 판단
    "실측 중단 시간이 5분 안일 때만 진행한다."
  다시 볼 조건
    실제 전환 뒤 · 늦어도 2026-06-30

  현실에서 확인한 것    전환 3분, 고객 문의 0건.
  지금의 기준           그대로 유지.
  처음 질문             여전히 유효.
  ─────────────────────────────────────────────────────────
  사람에 대한 점수나 승률은 저장하지 않습니다.
└────────────────────── argus · 문장 → 귀환 → 나의 답 ─────┘
```

---

## 답 도구와 무엇이 다른가

| | 답을 주는 도구 | **Argus** |
|---|---|---|
| 남는 것 | 더 그럴듯한 답 | **덧붙여지는 판단 기록** |
| 누구 생각이 남나 | 모델의 답 | **내 것**, AI 제안과 채택 족보는 따로 |
| 평가는 누가 | 모델 (점수·자신감) | **사람을 채점하지 않음** — 현실과 나중의 내 답을 별도 사실로 보존 |
| 대화가 끝나면 | 생각이 증발 | Argus가 **돌아옴** — 정한 사건과 fallback 날짜 |
| 쌓이는 것 | 나에 대한 어렴풋한 프로필 | **내가 소유한 시간 순서** — 원문, 수정, 조건, 관찰, 답 |

---

## 데이터에 대한 정직한 약속

- **로컬이 먼저입니다.** 기록은 현재 프로젝트의 `.argus`(MCP·플러그인)와 브라우저(웹)에 남습니다.
  Argus를 지워도 내 기록까지 지워지지는 않습니다.
- **사람에 대한 점수는 없습니다. 구조적으로요.** 애초에 채점할 도구가 없고, 새
  판단 기록은 저장 경계에서 점수 모양 필드까지 거부합니다.
- **몰래 프로파일링하지 않습니다.** 나에 대해 AI가 뽑아낸 패턴은 기본적으로
  프롬프트에서 빠집니다. 굳이 쓰려면 범위를 정해 내가 허락해야 하고(언제든 거둘
  수 있고요), 쓰인 자리엔 흔적이 남습니다.

---

## 자세한 설치

### 🌐 웹 — 지금 바로

설치 없이 브라우저에서: **[argus.voyage](https://argus.voyage)**. 계정도 필요 없습니다.

### 🧩 MCP 서버

MCP를 지원하는 어시스턴트라면 어디든 붙습니다(Claude Code, Claude Desktop, Codex,
Cursor …). Claude Code에서는 이 한 줄이 가장 빠릅니다:

```bash
claude mcp add argus -- npx -y argus-decision-mcp          # 이 프로젝트에만
claude mcp add -s user argus -- npx -y argus-decision-mcp  # 모든 프로젝트에
```

설정은 필요 없습니다. 원장은 현재 프로젝트의 `.argus`에 쌓입니다. 자세한 설정(Claude Desktop,
Windows, 프로젝트별 원장, 계정 동기화)과 여섯 개 도구는
**[argus-mcp/README.md](./argus-mcp/README.md)**(영문) 를 보세요.

### 🔌 Claude Code 플러그인

설치 한 번이면 스킬·MCP 서버·조용한 알림까지 한꺼번에 붙습니다:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Claude Code를 다시 켠 다음, 아무 리포에서나:

```text
/argus:review "결정해야 하는 질문"
```

**명령 다섯 개:** `/argus:review`(깊은 압박 검증, 직접 부를 때만) ·
`/argus:check`(정산 · 봉인 · 전제 재확인) · `/argus:history`(결정 일지 · 버전 트리 ·
지난 대화 회수) · `/argus:settings` · `/argus:help`. 이 다섯 개가 공개 명령의
전부입니다. 자세히 → **[argus-plugin-v2/README.ko.md](./argus-plugin-v2/README.ko.md)**.

<details>
<summary>로컬 개발 &amp; API 키(선택)</summary>

```bash
git clone https://github.com/commet/Argus.git
cd Argus
npm install
npm run dev            # http://localhost:3000 에서 뜹니다
```

리포 구조, CI 검사, 리뷰 관례는 [CONTRIBUTING.md](./CONTRIBUTING.md) 에 있습니다.

**API 키(웹, 선택).** 웹앱은 기본적으로 서버 프록시를 거칩니다. 사용량 제한 없이
쓰고 싶으면 설정 페이지에서 "Direct Key" 모드를 골라 Anthropic API 키를
넣으세요 — 키는 브라우저 localStorage에만 저장되고 서버로는 전송되지 않습니다.

</details>

---

## 리포 구조

```
src/               # 웹앱 (Next.js — argus.voyage)
argus-mcp/         # MCP 서버 (npm: argus-decision-mcp, MIT)
argus-plugin-v2/   # Claude Code 플러그인 (marketplace: argus, MIT)
docs/ARGUS-BLUEPRINT.md   # 빌드 정본 (무엇을 어떤 순서로 짓는가)
```

자세히 → [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 라이선스

Argus는 **오픈코어(open-core)** 입니다. 널리 퍼져야 할 부분은 오픈소스로 열고,
제품 자체는 소스는 공개하되 상업 이용은 막아 둡니다. 그래서 저장소가 **부분마다
라이선스가 다릅니다** (자세한 설명 → [LICENSING.md](./LICENSING.md)):

| 부분 | 라이선스 | 상업적 이용 |
|---|---|---|
| `argus-plugin-v2/`, `argus-mcp/` (플러그인 · MCP) | **MIT** (오픈소스) | ✅ 자유롭게 |
| 그 외 전부 — **웹앱 코어** (`src/` 등) | **PolyForm Noncommercial 1.0.0** | ❌ 별도 상업 라이선스 필요 |

즉 **플러그인과 MCP는 MIT** 라 상업적 용도까지 마음껏 쓸 수 있고, **웹앱 소스는
공개(source-available)** 라 읽고 배우고 개인적으로 돌려 볼 수는 있지만 **상업적
이용은 안 됩니다.** 상업 라이선스가 필요하면 [이슈](https://github.com/commet/Argus/issues)로
알려 주세요.

상표: "Argus" 이름과 로고, argus.voyage는 상표이며 위 라이선스에 포함되지 않습니다.

---

<p align="center">
  <em>전략기획이라는 일 속에 숨어 있던 사고방식을, 누구나 쓸 수 있는 형태로 옮긴<br>프로젝트입니다. 그리고 판단은 원래 있어야 할 자리 — 당신에게 남겨 둡니다.</em>
</p>
