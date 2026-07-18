<p align="center">
  <img src="public/voyage/voyage-mast.jpg" alt="Argus — 세이렌의 노래 앞에서 돛대에 스스로를 묶는 오디세우스" width="820">
</p>

<h1 align="center">Argus</h1>

<p align="center"><strong>Keeping Judgment Human.</strong></p>
<p align="center">AI가 실행을 가져간다. 판단은 어디에 쌓이나?</p>

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

Argus는 결정의 뒤편에 남는 것을 기록합니다. 그 결정이 무엇을 전제하고 있었는지,
그 전제가 내 것이었는지 AI의 것이었는지, 그리고 나중에 맞았는지 틀렸는지 가릴
예측 하나까지. 그러고는 현실이 답할 때가 되면 먼저 돌아옵니다. 더 나은 답을 주는
도구가 아니라, 내가 내린 판단이 실제로 어떻게 됐는지까지 남는 **살아 있는
기록**입니다.

---

## 왜 "Argus"인가

<img align="right" width="210" src="public/images/brand/argus-v2/argus-returning.jpg" alt="Argus — 변장한 오디세우스를 알아본 충견">

Argus는 20년 만에 거지 행색으로 돌아온 오디세우스를, 누더기 아래에서 단번에
알아본 개의 이름입니다. 겉모습이 아무리 변해도 끝내 남는 것 — 기억, 알아봄, 그리고
곁을 지키는 마음.

이 제품이 하려는 게 딱 그겁니다. AI와 오래 일하다 보면, 그 매끈한 말솜씨가 어느새
"내가 왜 그렇게 결정했더라"까지 대신 기억해 버립니다. Argus는 문 앞을 지키는
개입니다. 결정할 때 **내가 무엇을 믿었는지 기억하고**, 매끄러운 답 아래 **숨은
전제를 알아보고**, 내가 고른 신호를 **곁에서 지켜보다가**, 현실이 답할 때 **먼저
돌아옵니다.**

대신 결정해 주지는 않습니다. 영수증의 `AI VERDICT`은 언제나 `NONE`입니다. 채점은
모델이 아니라 현실이 하니까요.

---

## ⚡ 30초 만에 시작하기

들어가는 문은 셋, 안에서 도는 루프는 하나입니다. 편한 문으로 시작하세요.

| | 이런 분께 | 시작하기 |
|---|---|---|
| 🌐 **웹앱** | 누구나. 설치·가입 필요 없음. | **[argus.voyage](https://argus.voyage)** 열기 |
| 🧩 **MCP 서버** | MCP를 지원하는 AI 어시스턴트라면 어디든 — Claude Desktop, Claude Code, Cursor… | `claude mcp add argus "--" npx -y argus-decision-mcp` |
| 🔌 **Claude Code 플러그인** | 코드베이스 *안에서*, 실제 PR·파일 위에서 결정할 때. | `/plugin marketplace add commet/Argus`<br>`/plugin install argus@argus` |

<sub>잘 모르겠으면 **웹앱**이 제일 편합니다 — 아무것도 설치 안 해도 됩니다. 모든 AI 대화에서 쓰고 싶다면 **MCP 서버**가 답이고요. (MCP = Model Context Protocol, 어시스턴트가 도구를 불러올 때 쓰는 공개 표준입니다.) 자세한 설정과 도구 목록은 **[argus-mcp/README.md](./argus-mcp/README.md)**, **[argus-plugin-v2/README.ko.md](./argus-plugin-v2/README.ko.md)** 를 보세요.</sub>

---

## Argus가 하는 일

크게 두 가지입니다. 그리고 두 번째는 대부분의 도구가 그냥 지나치는 부분이죠.

### ① 결정하는 동안 — 내 판단과 AI의 판단을 갈라 둡니다

AI와 오래 일하다 보면 그쪽 가정이 슬그머니 내 생각에 섞여 듭니다. Argus는 그 둘을
떼어 놓고, 다시 섞이지 않게 지킵니다.

- **있는 그대로 기억합니다.** 내가 쓴 말, 내가 깔았던 전제, 내가 건 예측 —
  그리고 그게 누구 것인지까지. AI가 끄집어낸 문장이 슬그머니 내 것으로 둔갑하는
  일은 없습니다. 출처가 꼬리표로 붙고, 나에 대해 AI가 지레짐작한 것들은 내가
  허락하기 전엔 프롬프트에 끼어들지 못합니다(허락은 언제든 거둘 수 있고요).
- **표면 아래를 봅니다.** 매끄러운 답 밑에 깔린 숨은 전제와 진짜 질문을 짚어
  줍니다. 대신 어느 쪽이 맞다고 골라 주지는 않습니다.

### ② 결정한 뒤 — 곁에서 지켜보고, 채점은 현실에 맡깁니다

- **정직하게 지켜봅니다.** 내가 고른 신호만 지켜보고, 결정이 아직 열려 있는 동안
  그 결정을 떠받치는 전제를 현실과 계속 맞춰 봅니다. 금리 한 번 오르는 걸로 세
  결정의 전제가 한꺼번에 흔들리면, 확인도 세 번이 아니라 한 번이면 됩니다.
- **먼저 돌아옵니다.** 정한 날에, 혹은 지켜보던 전제가 크게 움직이면 그보다 앞서
  다시 찾아옵니다.
- **판정 없이 곁을 지킵니다.** 답하는 건 현실, 적는 건 나, Argus는 그 영수증을
  보관할 뿐입니다. `AI VERDICT`은 여전히 `NONE`이고요.

---

## 하나의 루프

Argus가 어디서 돌든 루프는 똑같습니다.

1. **적고, 가른다.** 결정과, 그 결정에 깔린 전제와, 그게 누구 전제인지(내 것 /
   AI 것)를 내 말로 남깁니다.
2. **봉인한다.** 나중에 맞았는지 틀렸는지 가릴 예측 하나에 확인 날짜를 붙입니다.
3. **조용히 기다린다.** 재촉하지 않습니다. 지켜보던 전제가 흔들리거나 그날이 오면
   딱 한 번 알려 줍니다.
4. **정산한다.** 실제로 어떻게 됐는지에 비춰 봅니다. 답은 내가 적고, 모델은
   채점하지 않습니다.
5. **영수증이 쌓인다.** 정산된 예측이 모여 나만의 기록이 됩니다. 눈으로 확인되는
   내 적중률, 그리고 내가 스스로 인정한 원칙.

<details>
<summary>문마다 어떻게 보이나</summary>

- **웹앱** — 상황을 한 줄 적거나 전략 문서를 올리면, AI 팀이 숨은 전제를 짚어
  주고, 사람만이 판단할 몫을 따로 표시하고, 전제가 바뀌면 알려 줍니다.
- **MCP 서버** — 아무 대화에서나 결정을 툭 꺼내 말하면, Argus가 알아서 포착하고,
  예측을 봉인하고, 그날이 되면 다시 불러 줍니다.
- **Claude Code 플러그인** — 실제 코드·PR 위에서 다섯 개 명령:
  `/argus:review`(깊은 압박 검증, 직접 부를 때만) · `/argus:check` ·
  `/argus:history` · `/argus:settings` · `/argus:help`.

</details>

---

## 판단 영수증

루프 끝에 남는 한 장입니다. **AI가 가정한 것**(아직 확인 안 됨)과 **나만이 내릴 수
있었던 판단**이 따로 적히고, 모델의 평결 칸은 설계상 늘 비어 있습니다.

```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  예측 저장 2026-04-02              결과 기록 2026-06-30

  진짜 질문
    사용자가 눈치채는 점검 시간 없이 전환할 수 있는가?
  검증 안 된 가정          (AI의 것)
    인덱스 재구축이 복제 지연 예산 안에 든다.
  사람만이 할 판단   5분 정지가 허용 가능한가.
  …판단한 사람       나. (모델이 아니라)

  나의 예측     "전환 다운타임 5분 미만"        (확인일 2026-06-30)
  실제 결과     전환 3분, 고객 문의 0건.
  ─────────────────────────────────────────────────────────
  이 결정에 대한 AI의 평결 ······················  없음
  모델은 당신을 채점하지 않았습니다. 현실이 답했습니다.
└──────────────────────────  argus · prediction → reality ─┘
```

---

## 답 도구와 무엇이 다른가

| | 답을 주는 도구 | **Argus** |
|---|---|---|
| 남는 것 | 더 그럴듯한 답 | **판단 영수증** — 예측 → 현실 |
| 누구 생각이 남나 | 모델의 답 | **내 것** — 내 전제와 예측을, AI 것과 갈라서 |
| 평가는 누가 | 모델 (점수·자신감) | **아무도 안 함** — `AI VERDICT: NONE`, 정한 날 현실이 정산 |
| 대화가 끝나면 | 생각이 증발 | Argus가 **돌아옴** — 확인 날짜, 전제 변화 알림 |
| 쌓이는 것 | 나에 대한 어렴풋한 프로필 | **내가 소유한 기록** — 정산된 예측, 내 적중률, 내가 인정한 원칙 |

---

## 데이터에 대한 정직한 약속

- **로컬이 먼저입니다.** 기록은 `~/.argus`(MCP·플러그인)와 브라우저(웹)에 남습니다.
  Argus를 지워도 내 기록까지 지워지지는 않습니다.
- **평결은 없습니다. 구조적으로요.** 애초에 채점할 도구 자체를 만들지 않았습니다.
  영수증 맨 아랫줄은 마케팅 문구가 아니라 그 약속의 서명입니다.
- **몰래 프로파일링하지 않습니다.** 나에 대해 AI가 뽑아낸 패턴은 기본적으로
  프롬프트에서 빠집니다. 굳이 쓰려면 범위를 정해 내가 허락해야 하고(언제든 거둘
  수 있고요), 쓰인 자리엔 흔적이 남습니다.

---

## 자세한 설치

### 🌐 웹 — 지금 바로

설치 없이 브라우저에서: **[argus.voyage](https://argus.voyage)**. 계정도 필요 없습니다.

### 🧩 MCP 서버

MCP를 지원하는 어시스턴트라면 어디든 붙습니다(Claude Desktop, Claude Code,
Cursor …). Claude Code에서는 이 한 줄이 가장 빠릅니다:

```bash
claude mcp add argus "--" npx -y argus-decision-mcp
```

설정은 필요 없습니다. 원장은 `~/.argus`에 쌓이고요. 자세한 설정(Claude Desktop,
Windows, 프로젝트별 원장, 계정 동기화)과 여섯 개 도구는
**[argus-mcp/README.md](./argus-mcp/README.md)** 를 보세요.

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
지난 대화 회수) · `/argus:settings` · `/argus:help`. 별칭도 그대로 씁니다:
`/argus:sail`, `/argus:resolve`. 자세히 → **[argus-plugin-v2/README.ko.md](./argus-plugin-v2/README.ko.md)**.

<details>
<summary>대안: 플러그인 시스템 없이 복사로 설치</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

이렇게 복사만 하면 `argus:` 접두사와 자동 알림이 빠집니다. 위의 플러그인 설치가
정식 경로예요.

</details>

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
tools/argus-watch/ # 독립 실행형 결정-감시 CLI
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
