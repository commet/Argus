# Argus

*English → [README.md](./README.md) · 한국어(현재 문서)*

**Keeping Judgment Human.**

**AI가 실행을 가져갑니다. 판단은 어디에 쌓입니까?**

Argus는 결정 *뒤에 있던* 판단을 기록합니다 — 그 결정에 깔린 전제와, 반증
가능한 예측을 남기고, 현실이 답할 때 다시 돌아옵니다. 더 나은 답이 아니라,
**실제로 어떻게 됐는지로 정산되는, 살아 있는 판단의 기록**입니다.

## ⚡ MCP 서버 설치 (30초)

> 아무것도 설치하기 싫다면? **[웹앱](https://argus.voyage)** 은 설치가 전혀
> 필요 없습니다 — 브라우저에서 바로 결정하세요. 아래 MCP 서버는 Argus를 AI
> 어시스턴트 *안에서* 쓰는 방법입니다.

Argus는 **MCP 서버**(Model Context Protocol — AI 어시스턴트가 도구를 불러오는
공개 표준)로 제공됩니다. Claude Code, Claude Desktop, Cursor 등 MCP 호스트에
넣으면 AI가 *결정 책임(decision-accountability)* 루프를 갖게 됩니다. Claude
Code에서는 한 줄이면 끝:

```bash
claude mcp add argus -- npx -y argus-decision-mcp
```

**설정 불필요** — API 키도, 계정도 없이. 데이터는 `~/.argus`에 로컬로 남습니다.
그다음 AI에게 *"<날짜>까지 …할 거라는 예측을 봉인해줘"* 라고 말하면 됩니다.

- 📦 npm: [`argus-decision-mcp`](https://www.npmjs.com/package/argus-decision-mcp)
- 🛠️ 전체 설정(Claude Desktop, Windows, 프로젝트별 원장) + 툴 목록 → **[argus-mcp/README.md](./argus-mcp/README.md)**
- 🔌 **Claude Code** 사용자라면 슬래시 명령(`/argus:review`, `/argus:check`)이 있는 네이티브 플러그인도 있습니다. 설치는 두 줄: `/plugin marketplace add commet/Argus` 다음 `/plugin install argus@argus` → **[플러그인 문서](./argus-plugin-v2/README.ko.md)**

---

### Argus를 쓰는 세 가지 방법

자신에게 맞는 문을 고르세요 — 각 문마다 별도 설치 가이드로 연결됩니다.

| | 이런 사람에게 | 시작하기 |
|---|---|---|
| 🌐 **웹앱** | 누구나. 설치·가입 불필요. | **[argus.voyage](https://argus.voyage)** 열기 |
| 🧩 **MCP 서버** | MCP를 지원하는 모든 AI 어시스턴트 — Claude Desktop, Claude Code, Cursor 등. | `claude mcp add argus -- npx -y argus-decision-mcp` → [MCP 문서](./argus-mcp/README.md) |
| 🔌 **Claude Code 플러그인** | 코드베이스 *안에서* 결정할 때 (PR·파일 위에서). | `/plugin marketplace add commet/Argus`<br>`/plugin install argus@argus` → [플러그인 문서](./argus-plugin-v2/README.ko.md) |

처음이라 잘 모르겠다면 **[웹앱](https://argus.voyage)부터 시작하세요** — 설치가
필요 없습니다. AI 어시스턴트 안에서 살고, 모든 대화에서 Argus를 쓰고 싶다면
**[MCP 서버](./argus-mcp/README.md)** 가 바로 그것입니다.

> *Argus*는 오디세우스가 20년 만에 변장하고 돌아왔을 때, 누더기 아래 진짜 주인을 알아본 개의 이름입니다.
> 매끄러운 표면이 아니라 그 아래의 진짜를 보는 눈 — Argus가 하는 일이 그것입니다.

---

## 왜 필요한가

AI에게 무엇이든 물으면 몇 초 만에 자신 있는 답이 옵니다. 그런데 정작 *당신의
것*은 어디에도 기록되지 않습니다 — 무엇을 결정했는지, 무엇에 걸었는지, 그리고
몇 달 뒤 **현실이 그 판단에 동의했는지**.

Argus는 또 하나의 답 도구가 아닙니다. 판단을 지키는 도구입니다:

```
Argus 없이:   결정 → 실행 → 판단의 근거는 증발
Argus 있이:   결정 → 반증 가능한 예측 봉인 → 현실이 정산 → 나의 기록이 자람
```

## 하나의 루프, 세 개의 문

Argus가 도는 곳 어디서나 루프는 같습니다:

1. **기록** — 결정과, 그 결정이 기대는 전제를 당신의 말로 남깁니다.
2. **봉인** — 반증 가능한 예측 하나에 확인일을 붙입니다.
3. **조용히 대기** — 잔소리 없이. 전제가 흔들리거나 확인일이 오면 한 번만
   알립니다.
4. **정산** — 실제로 어떻게 됐는지는 당신이 답합니다. 모델은 채점하지 않습니다.
5. **영수증** — 정산된 예측이 쌓여 당신의 성적표가 됩니다: 눈에 보이는
   calibration, 당신이 직접 비준한 원칙.

문마다 이렇게 보입니다:

- **웹앱** — 결정을 한 줄로 적거나 전략 문서를 올리면, 여러 관점으로 검토하고,
  사람이 판단할 지점을 표시하고, 전제가 바뀌면 다시 알려줍니다.
- **MCP 서버** — 아무 대화에서나 결정을 자연스럽게 말하면 포착·봉인되고,
  확인일에 다시 불려옵니다.
- **Claude Code 플러그인** — 실제 코드·PR 위에서 명령 5개:
  `/argus:review`(깊은 압박 검증, 명시 호출 전용) · `/argus:check` ·
  `/argus:history` · `/argus:settings` · `/argus:help`.

루프 끝에 남는 실물이 **판단 영수증(Judgment Receipt)** 입니다:

```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  예측 저장 2026-04-02              결과 기록 2026-06-30

  진짜 질문
    사용자가 눈치채는 점검 시간 없이 전환할 수 있는가?
  검증 안 된 가정
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

## 답 도구와 다른 점

| | 답을 주는 도구 | **Argus** |
|---|---|---|
| 산출물 | 더 그럴듯한 답 | **판단 영수증** — 예측 → 현실 |
| 평가하는 자 | 모델 (점수·자신감) | **없음** — `AI VERDICT: NONE`, 당신이 정한 날짜에 현실이 정산 |
| 대화가 끝나면 | 판단의 근거는 증발 | Argus가 **되돌아옴** — 확인일, 전제 변경 알림 |
| 쌓이는 것 | 당신에 대한 암묵적 프로파일 | **당신이 소유한 기록** — 정산된 예측, 나의 calibration, 내가 비준한 원칙 |

## 데이터에 대한 정직한 약속

- **로컬 우선.** 원장은 `~/.argus`(MCP·플러그인)와 브라우저(웹)에 삽니다.
  제거해도 기록은 삭제되지 않습니다.
- **평결 없음 — 구조적으로.** 채점할 도구 자체가 없습니다. 영수증의 마지막
  줄이 이 제품의 서명입니다.
- **조용한 프로파일링 없음.** 당신에 대한 파생 패턴은 기본적으로 프롬프트에서
  배제됩니다; 쓰려면 명시적·범위 한정·철회 가능한 허가가 필요하고, 영향은
  흔적으로 남습니다.

---

## 시작하기

### 웹 (바로 사용)

설치 없이 브라우저에서 — **[argus.voyage](https://argus.voyage)**

### MCP 서버

MCP를 지원하는 모든 AI 어시스턴트(Claude Desktop, Claude Code, Cursor 등)에
Argus를 붙입니다. Claude Code에서 가장 빠른 방법:

```bash
claude mcp add argus -- npx -y argus-decision-mcp
```

설정이 전혀 필요 없습니다 — 원장(ledger)은 `~/.argus`에 저장됩니다. 전체 설정
(Claude Desktop, Windows, 프로젝트별 원장, 선택적 계정 동기화)과 툴 목록은
**[argus-mcp/README.md](./argus-mcp/README.md)** 를 보세요.

### Claude Code 플러그인

설치 하나로 전부 배선됩니다(스킬 + MCP 서버 + 조용한 알림). Claude Code에서:

```
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Claude Code 재시작 후, 아무 repo에서:

```
/argus:review "결정해야 할 질문"
```

명령 5개: `/argus:review` (깊은 압박 검증, 명시 호출 전용) · `/argus:check`
(due 정산 · 봉인 · 전제 재확인) · `/argus:history` (결정 일지 · 버전 트리 ·
과거 대화 회수) · `/argus:settings` · `/argus:help` — 별칭 유지:
`/argus:sail`, `/argus:resolve`
자세히 → [argus-plugin-v2/README.ko.md](./argus-plugin-v2/README.ko.md)

<details>
<summary>대안: 플러그인 시스템 없이 복사 설치</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

복사 설치는 `argus:` 접두사와 자동 알림이 빠집니다 — 위의 플러그인 설치가
정식 경험입니다.
</details>

### 로컬 개발

```bash
git clone https://github.com/commet/Argus.git
cd Argus
npm install
npm run dev
```

`http://localhost:3000`에서 실행됩니다. repo 구조·CI 검사·리뷰 관례는
[CONTRIBUTING.md](./CONTRIBUTING.md)를 보세요.

### API 키 설정 (선택, 웹)

기본적으로 서버 프록시를 통해 작동합니다. 사용량 제한 없이 쓰려면 설정
페이지에서 "직접 키" 모드를 선택해 Anthropic API Key를 입력하세요. 키는
브라우저 localStorage에만 저장되며 서버로 전송되지 않습니다.

---

## 저장소 구조

```
src/               # 웹앱 (Next.js — argus.voyage)
argus-mcp/         # MCP 서버 (npm: argus-decision-mcp, MIT)
argus-plugin-v2/   # Claude Code 플러그인 (marketplace: argus, MIT)
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

*Argus는 전략기획이라는 직무에 숨어있던 사고방식을 누구나 사용할 수 있는 형태로
옮긴 프로젝트입니다 — 그리고 판단을 원래 있어야 할 자리, 당신에게 남깁니다.*
