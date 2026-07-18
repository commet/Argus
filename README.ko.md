<p align="center">
  <img src="public/voyage/voyage-poster.jpg" alt="Argus — 결정의 항해" width="820">
</p>

<h1 align="center">Argus</h1>

<p align="center"><strong>Keeping Judgment Human.</strong></p>
<p align="center">AI가 실행을 가져갑니다. 판단은 어디에 쌓입니까?</p>

<p align="center">
  <a href="https://www.npmjs.com/package/argus-decision-mcp"><img src="https://img.shields.io/npm/v/argus-decision-mcp?color=A8842F&label=npm%20%C2%B7%20argus-decision-mcp" alt="npm 버전"></a>
  <img src="https://img.shields.io/badge/Claude%20Code%20plugin-argus%402.10.0-667572" alt="Claude Code 플러그인">
  <img src="https://img.shields.io/badge/license-open--core-6E8261" alt="라이선스: open-core">
  <img src="https://img.shields.io/badge/local--first-계정%20불필요-242321" alt="로컬 우선">
</p>

<p align="center">
  <a href="https://argus.voyage"><strong>웹앱</strong></a> ·
  <a href="#-30초-만에-시작하기">설치</a> ·
  <a href="#argus가-하는-일">하는 일</a> ·
  <a href="#판단-영수증">영수증</a> ·
  <a href="#라이선스">라이선스</a> ·
  <a href="./README.md">English</a>
</p>

Argus는 결정 *뒤에 있던* 판단을 기록합니다 — 그 결정에 깔린 전제와, **그게
누구의 전제인지(내 것인지 AI의 것인지)**, 그리고 반증 가능한 예측 하나를. 그런
다음 현실이 답할 때 다시 돌아옵니다. 더 나은 답이 아니라, **실제로 어떻게
됐는지로 정산되는, 살아 있는 판단의 기록**입니다.

---

## 왜 "Argus"인가

<img align="right" width="210" src="public/images/brand/argus-v2/argus-returning.jpg" alt="Argus — 변장한 오디세우스를 알아본 충견">

Argus는 20년 만에 거지꼴로 돌아온 오디세우스를, 누더기 아래에서 알아본 개의
이름입니다. 겉모습이 바뀌어도 남는 것 — 기억, 알아봄, 그리고 곁을 지키는 충심.

그게 이 제품의 전부입니다. AI와 함께 일하다 보면, 그 매끈한 목소리가 어느새 내가
*왜* 그렇게 결정했는지에 대한 기억을 대신하기 쉽습니다. Argus는 문 앞의 개입니다.
결정할 때 **내가 무엇을 믿었는지 기억하고**, 유창한 답 아래 **숨은 전제를
알아보고**, 내가 고른 신호를 **곁에서 지켜보다가**, 현실이 답할 때 **먼저
돌아옵니다.**

대신 결정해 주지는 않습니다. `AI VERDICT`은 `NONE`으로 남습니다 — 채점은 현실이
합니다.

---

## ⚡ 30초 만에 시작하기

문은 셋, 루프는 하나. 자신에게 맞는 것부터 시작하세요.

| | 이런 사람에게 | 시작하기 |
|---|---|---|
| 🌐 **웹앱** | 누구나. 설치·가입 불필요. | **[argus.voyage](https://argus.voyage)** 열기 |
| 🧩 **MCP 서버** | MCP를 지원하는 모든 AI 어시스턴트 — Claude Desktop, Claude Code, Cursor… | `claude mcp add argus -- npx -y argus-decision-mcp` |
| 🔌 **Claude Code 플러그인** | 코드베이스 *안에서*, 실제 PR·파일 위에서 결정할 때. | `/plugin marketplace add commet/Argus`<br>`/plugin install argus@argus` |

<sub>처음이라 잘 모르겠다면 **웹앱**이 설치가 전혀 필요 없습니다. 모든 AI 대화에서 쓰고 싶다면 **MCP 서버**가 그것입니다. (MCP = Model Context Protocol — 어시스턴트가 도구를 불러오는 공개 표준.) 전체 설정·도구 목록은 **[argus-mcp/README.md](./argus-mcp/README.md)**, **[argus-plugin-v2/README.ko.md](./argus-plugin-v2/README.ko.md)** 참고.</sub>

---

## Argus가 하는 일

두 가지 — 그리고 두 번째가 대부분의 도구가 건너뛰는 부분입니다.

### ① 결정하는 동안 — 내 판단을 AI의 판단과 갈라 둡니다

AI와 오래 일하다 보면 그 가정이 슬그머니 내 것에 섞여 듭니다. Argus는 그걸 떼어내
정직하게 유지합니다.

- **정확히 기억하기.** 내 말, 내 전제, 내 예측 — 그리고 그게 *누구의* 것인지.
  기계가 끄집어낸 문장이 조용히 내 것으로 기록되는 일은 없습니다. 저작권이
  태깅되고, 나에 대한 파생 추론은 명시적·철회 가능한 허가 없이는 프롬프트에 새어
  들지 않습니다.
- **표면 아래를 알아보기.** 유창한 답 아래 숨은 전제와 진짜 질문을 짚어냅니다 —
  대신 한쪽을 고르지 않고.

### ② 결정한 뒤 — 곁에서 지켜보고, 채점은 현실에 맡깁니다

- **정직하게 지켜보기.** *내가* 고른 신호만 추적하고, 베팅이 열려 있는 동안
  하중을 받는 전제를 현실과 다시 대조합니다. 금리 인상 하나가 세 결정의 전제를
  깨면, 재확인은 세 번이 아니라 **한 번**입니다.
- **먼저 돌아오기.** 정한 날에 — 또는 지켜보던 전제가 크게 움직이면 그보다 먼저 —
  다시 옵니다.
- **판정 없이 곁에 있기.** 현실이 답하고, 내가 기록하고, Argus는 영수증을
  지킵니다. `AI VERDICT`은 `NONE`으로 남습니다.

---

## 하나의 루프

Argus가 어디서 돌든 루프는 같습니다.

1. **기록하고 가르기** — 결정과, 그 결정에 깔린 전제와, 그게 누구의 전제인지(내
   것 vs AI의 것)를 내 말로.
2. **봉인** — 반증 가능한 예측 하나에 확인 날짜를 붙여.
3. **조용히 대기** — 재촉 없이. 지켜보던 전제가 흔들리거나 날짜가 오면 한 번만
   알립니다.
4. **정산** — 실제로 어떻게 됐는지에 대고. 답은 내가, 채점은 모델이 하지 않습니다.
5. **영수증 보관** — 정산된 예측이 쌓여 나만의 기록이 됩니다: 눈에 보이는 정확도,
   내가 비준한 원칙.

<details>
<summary>문마다 어떻게 보이나</summary>

- **웹앱** — 상황을 한 줄 적으면(또는 전략 문서를 올리면) AI 팀이 숨은 전제를
  짚고, 사람만 판단할 것을 표시하고, 전제가 바뀌면 알려줍니다.
- **MCP 서버** — 어떤 대화에서든 결정을 자연스럽게 말하면 Argus가 포착하고,
  예측을 봉인하고, 확인 날짜에 다시 불러냅니다.
- **Claude Code 플러그인** — 실제 코드·PR 위에서 다섯 명령:
  `/argus:review`(깊은 압박 검증, 명시적 opt-in) · `/argus:check` ·
  `/argus:history` · `/argus:settings` · `/argus:help`.

</details>

---

## 판단 영수증

끝에 남는 산출물. **AI가 가정한 것**(아직 미검증)이 **나만이 내릴 수 있었던
판단**과 따로 놓이고, 모델의 판정은 설계상 `NONE`입니다.

```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Prediction saved 2026-04-02      Result recorded 2026-06-30

  THE REAL QUESTION
    Can we cut over without a maintenance window users notice?
  THE UNVERIFIED ASSUMPTION      (the AI's)
    The index rebuild fits inside the replication lag budget.
  HUMAN-ONLY CALL   Whether a 5-minute blip is acceptable.
  …made by          Me. (not the model)

  YOU PREDICTED   "Cutover downtime is under 5 minutes"   (check-by 2026-06-30)
  WHAT HAPPENED   Cutover took 3 minutes, no customer reports.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└──────────────────────────  argus · prediction → reality ─┘
```

---

## 답 도구와 무엇이 다른가

| | 답 도구 | **Argus** |
|---|---|---|
| 산출물 | 더 그럴듯한 답 | **판단 영수증** — 예측 → 현실 |
| 누구의 사고를 남기나 | 모델의 답 | **당신의 것** — 내 전제와 예측을, AI의 것과 갈라서 |
| 평가하는 자 | 모델 (점수·자신감) | **없음** — `AI VERDICT: NONE`, 정한 날 현실이 정산 |
| 대화가 끝난 뒤 | 사고가 증발 | Argus가 **돌아옴** — 확인 날짜, 전제 변화 알림 |
| 쌓이는 것 | 나에 대한 암묵적 프로필 | **내가 소유한 기록**: 정산된 예측, 내 정확도, *내가* 비준한 원칙 |

---

## 데이터에 대한 정직한 약속

- **로컬 우선.** 원장은 `~/.argus`(MCP·플러그인)와 브라우저(웹)에 있습니다. 제거해도
  기록은 지워지지 않습니다.
- **판정 없음 — 구조적으로.** 호출할 채점 도구가 없습니다. 영수증의 마지막 줄은
  마케팅 슬로건이 아니라 제품의 서명입니다.
- **조용한 프로파일링 없음.** 나에 대한 파생 패턴은 기본적으로 프롬프트에서
  제외됩니다. 그걸 쓰려면 명시적·범위 한정·철회 가능한 허가가 필요하고, 흔적이
  남습니다.

---

## 자세한 설치

### 🌐 웹 — 지금 바로

설치 없이 브라우저에서: **[argus.voyage](https://argus.voyage)**. 계정 불필요.

### 🧩 MCP 서버

MCP를 지원하는 모든 AI 어시스턴트(Claude Desktop, Claude Code, Cursor …)에 붙입니다.
Claude Code에서 가장 빠른 길:

```bash
claude mcp add argus -- npx -y argus-decision-mcp
```

설정 불필요 — 원장은 `~/.argus`에. 전체 설정(Claude Desktop·Windows·프로젝트별
원장·선택적 계정 동기화)과 여섯 도구는 **[argus-mcp/README.md](./argus-mcp/README.md)**
참고.

### 🔌 Claude Code 플러그인

설치 하나로 전부 배선됩니다 — 스킬·MCP 서버·조용한 알림까지:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Claude Code를 다시 시작한 뒤, 아무 리포에서나:

```text
/argus:review "결정해야 하는 질문"
```

**명령 5개:** `/argus:review`(깊은 압박 검증, 명시적 opt-in) ·
`/argus:check`(due 정산 · 봉인 · 전제) · `/argus:history`(결정 일지 · 버전 트리 ·
과거 대화 회수) · `/argus:settings` · `/argus:help`. 별칭 유지: `/argus:sail`,
`/argus:resolve`. 자세히 → **[argus-plugin-v2/README.ko.md](./argus-plugin-v2/README.ko.md)**.

<details>
<summary>대안: 플러그인 시스템 없이 복사-설치</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

평면 설치한 스킬은 `argus:` 접두사와 자동 알림을 잃습니다 — 위 플러그인 설치가
정식 경험입니다.

</details>

<details>
<summary>로컬 개발 &amp; 선택적 API 키</summary>

```bash
git clone https://github.com/commet/Argus.git
cd Argus
npm install
npm run dev            # http://localhost:3000 에서 실행
```

리포 구조·CI 검사·리뷰어가 보는 관례는 [CONTRIBUTING.md](./CONTRIBUTING.md) 참고.

**API 키(선택, 웹).** 웹앱은 기본적으로 서버 프록시로 동작합니다. 속도 제한 없이
쓰려면 설정 페이지에서 "Direct Key" 모드를 골라 Anthropic API 키를 넣으세요 —
키는 브라우저 localStorage에만 저장되고 서버로 전송되지 않습니다.

</details>

---

## 리포 구조

```
src/               # 웹앱 (Next.js — argus.voyage)
argus-mcp/         # MCP 서버 (npm: argus-decision-mcp, MIT)
argus-plugin-v2/   # Claude Code 플러그인 (marketplace: argus, MIT)
tools/argus-watch/ # 독립 실행형 결정-감시 CLI
docs/ARGUS-BLUEPRINT.md   # 빌드 정본 (무엇을 어떤 순서로 짓는가)
```

자세히 → [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 라이선스

Argus는 **오픈코어(open-core)** 입니다: 널리 퍼져야 할 부분은 오픈소스로, 제품
자체는 소스공개(source-available)로 둡니다. 이 저장소는 **부분마다 라이선스가
다릅니다** (자세한 설명 → [LICENSING.md](./LICENSING.md)):

| 부분 | 라이선스 | 상업적 이용 |
|---|---|---|
| `argus-plugin-v2/`, `argus-mcp/` (플러그인 · MCP) | **MIT** (오픈소스) | ✅ 자유롭게 가능 |
| 그 외 전부 — **웹앱 코어** (`src/` 등) | **PolyForm Noncommercial 1.0.0** | ❌ 별도 상업 라이선스 필요 |

즉 **플러그인과 MCP는 오픈소스(MIT)** 라 상업적 사용을 포함해 자유롭게 쓸 수 있고,
**웹앱 소스는 공개(source-available)** 되어 읽고 배우고 개인적으로 실행할 수 있지만
**상업적 이용은 금지**됩니다. 상업 라이선스 문의는 [이슈](https://github.com/commet/Argus/issues)로.

상표: "Argus" 이름 · 로고 · argus.voyage는 상표이며 위 라이선스에 포함되지 않습니다.

---

<p align="center">
  <em>Argus는 전략기획이라는 직무에 숨어 있던 사고방식을 누구나 쓸 수 있는 형태로<br>옮긴 프로젝트입니다 — 그리고 판단을 원래 있어야 할 자리, 당신에게 남깁니다.</em>
</p>
