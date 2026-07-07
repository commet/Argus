# 베팅② — MCP 유통망 실행 계획서

작성일 2026-07-03 · 대상: 창업자(비개발자) · 표면: `argus-mcp/`

---

## 0. 한 문단 요약 (먼저 읽으세요)

우리 MCP 서버(`argus-mcp/`)는 **코드·문서 완성도는 발사 직전**입니다. 그런데
"만든 것"과 "발견되는 것"은 다른 일이고, 지금은 발견 경로에 사실상 **부재**합니다.
동시에, **발사를 막는 치명적 문제 하나**가 확인됐습니다 — npm에 `argus-mcp`라는
이름은 **이미 다른 사람이 가져갔습니다**(브라우저 자동화 도구를 만든 Anthony
Desmet라는 사람, 실측 확인). 그래서 README에 적힌 설치 명령
(`npx -y argus-mcp`)을 지금 그대로 실행하면 **우리 것이 아니라 남의 프로그램이
깔립니다.** 첫 사용자가 이걸 만나면 첫인상이 끝납니다.

그래서 이 계획서의 순서는 못박혀 있습니다:
**① 이름부터 바꾼다 → ② 배포 위생·메타 정리 → ③ 데모+README 재구성 →
④ 공식 레지스트리 등재 → ⑤ 디렉토리·마켓 노출.**
이름을 안 바꾸고 ④⑤를 먼저 하면 **모든 등록처가 남의 패키지를 가리키게 되어
첫인상을 두 번 망칩니다.** (두 적대 판정이 공통으로 지목한 BLOCKER)

그리고 정직하게: **유통은 활성화(47개 열림 / 0개 정산)의 해결책이 아닙니다.**
사람을 더 데려와도, 봉인 후 2~3주 뒤 "정산"으로 돌아오게 만드는 건 별개 트랙
(귀환 cron/Companion Brief)입니다. 이 계획서의 성공 지표는 "발견됨"이지
"정산됨"이 아닙니다 — 둘을 섞으면 안 됩니다.

---

## 1. 채택안 (kill 판정 반영)

세 제안 모두 **방향은 채택**하되, 두 적대 판정이 건 조건을 **스펙으로 내장**합니다.
우선순위는 판정과 동일: **제안2(발사차단, 가장 정확) > 제안1(레지스트리 원천)
> 제안3(메시지, 활성화 해법 아님).**

### 채택 A — 이름 변경 (제안2, 절대 선행 / BLOCKER)
- npm의 `argus-mcp`는 타인 소유(실측: `npm view argus-mcp` → maintainer
  `adesmet`, latest 1.2.0, playwright 의존 = 브라우저 자동화 도구).
  → 우리는 `argus-mcp`로 **publish 자체가 불가**(403 not owner).
- **새 이름 = `argus-decision-mcp`** 를 1순위 권고. 근거:
  - 실측 사용가능(E404).
  - **무스코프**라 npm 조직 생성/`--access public` 실수 여지 없음(스코프드
    `@argus-voyage/mcp`는 조직 필요 + 공개 플래그 필수 → 창업자에게 함정).
  - 판정2 신규 발견: `Argus`라는 이름의 **다른 MCP 서버가 이미 디렉토리에 존재**
    (ironclawdevs27/argus, QA 하니스). 즉 `argus` 단독은 발견 공간에서 이미
    경합 중 → `argus-decision-mcp`가 **검색 변별에 오히려 유리**.
  - **금지 이름**: verdict/판정/권위를 암시하는 이름
    (`argus-judge`, `argus-verdict`, `argus-score`)은 Zero-Judgment 스파인
    위반 → 절대 사용 금지.
- **이 결정은 창업자 몫**(브랜드 판단). 계획서는 `argus-decision-mcp`를 가정하고
  작성하되, 창업자가 확정하면 그 이름으로 일괄 치환.

### 채택 B — 발사 위생 (제안2)
- `tsconfig.json`에 `exclude` 추가 → dist에서 테스트 18개 파일 제거.
- `package.json`에 `repository / homepage / bugs / author / mcpName` 보강.
- `PUBLISH.md` **전면 재작성**(아래 3항목 근거).

### 채택 C — 데모 + README 재구성 (제안1 + 제안3, 이름 확정 후)
- 30초 데모 자산(asciinema/GIF) 1개 — seal→(대기)→settle→Judgment Receipt.
- README 상단 재배치 + 뱃지행 + 클라이언트별 접힘 설치 블록.
- 히어로 문장을 개발자 정신모델로(제안3) — **단, 도구 첫 응답 카피 변경은
  이번 베팅에서 제외**(스파인 위험, §4 참조).

### 채택 D — 공식 레지스트리 등재 (제안1, 원천)
- `server.json` 작성 + `mcp-publisher` 절차. 이게 Smithery/mcp.so/glama가
  **크롤링하는 단일 원천** → 한 번 등재로 다수 디렉토리 자동 노출.

### 채택 E — 수동 디렉토리/마켓 (제안1)
- awesome-mcp-servers PR(수동) + Claude Code 플러그인 마켓 검토.

---

## 2. 구현 항목 목록 (파일:줄 수준, 작업량 S/M/L)

> 작업량: **S**=30분내 · **M**=반나절 · **L**=하루+ 또는 외부 의존.
> 순서는 **위→아래로 강제**(선행 조건 있음). ⚠️=창업자 결정/실행 필요.

### 페이즈 0 — 이름 확정 (⚠️ 선행, 이것 없이는 아무것도 시작 금지)

| # | 항목 | 파일:줄 | 작업량 | 비고 |
|---|------|---------|--------|------|
| 0.1 | ⚠️ 새 이름 확정 | (창업자 결정) | S | `argus-decision-mcp` 권고. 확정 전 §페이즈1~5 착수 금지 |

### 페이즈 1 — 이름 치환 + 발사 위생 (이름 확정 직후)

| # | 항목 | 파일:줄 | 작업량 | 비고 |
|---|------|---------|--------|------|
| 1.1 | `package.json` name 변경 | `argus-mcp/package.json:2` | S | `"name": "argus-decision-mcp"` |
| 1.2 | `bin` 키 변경 | `argus-mcp/package.json:7-9` | S | `"argus-decision-mcp": "dist/index.js"` (또는 짧은 `argus` 별칭 유지 검토) |
| 1.3 | 메타 필드 추가 | `argus-mcp/package.json:39 이후` | S | `repository`(github URL)·`homepage`(argus.voyage)·`bugs`·`author` + **`mcpName: "io.github.commet/argus-decision-mcp"`** |
| 1.4 | 버전 리셋 | `argus-mcp/package.json:3` | S | 새 이름은 **1.0.0부터** 시작(옛 1.3.0 서사 폐기) |
| 1.5 | README 설치 명령 치환 | `argus-mcp/README.md:52,62` | S | `npx -y argus-decision-mcp` / `claude mcp add argus -- npx -y argus-decision-mcp` |
| 1.6 | README 제목 치환 | `argus-mcp/README.md:1` | S | `# argus-decision-mcp` |
| 1.7 | 서버 식별자 치환 | `argus-mcp/src/server.ts:42` | S | `{ name: 'argus-decision-mcp', ... }` (호스트에 뜨는 서버 이름) |
| 1.8 | 전수 grep 동기화 | 아래 26파일 중 사용자향 | M | §3 검증표 참조. 로그 프리픽스(log.ts)·주석은 선택, **설치명령·매니페스트는 필수** |
| 1.9 | `tsconfig.json` exclude 추가 | `argus-mcp/tsconfig.json:12` | S | `"exclude": ["src/**/__tests__/**","src/**/*.test.ts","src/lib/test-helpers.ts"]` |
| 1.10 | dist 재빌드 후 테스트파일 부재 확인 | (빌드 산출물) | S | `find dist -name "*.test.js"` → 0건이어야 |

### 페이즈 2 — PUBLISH.md 전면 재작성 (제안2 파생 BLOCKER)

| # | 항목 | 파일:줄 | 작업량 | 비고 |
|---|------|---------|--------|------|
| 2.1 | 허구 서사 삭제 | `argus-mcp/PUBLISH.md:6-48` | M | "1.0.0~1.2.0을 우리가 게시했다" 전제 = **사실과 반대**(adesmet 소유). "1.2.1 tolerant-replay를 FIRST로" Step 1 = 허구(손상될 공유 ledger 0건). 이 런북대로 하면 `npm publish`에서 403 |
| 2.2 | 새 런북 작성 | `argus-mcp/PUBLISH.md` 전체 | M | 새 이름·1.0.0·clean-install 왕복·`--access` 주의(무스코프면 불필요) |

### 페이즈 3 — 공식 MCP 레지스트리 등재 (제안1, 이름 확정 후에만)

| # | 항목 | 파일:줄 | 작업량 | 비고 |
|---|------|---------|--------|------|
| 3.1 | `server.json` 작성 | `argus-mcp/server.json`(신규) | M | `name: io.github.commet/argus-decision-mcp`·description·`packages[{registry:npm, name:argus-decision-mcp, transport:stdio}]`·version. **packages가 새 이름을 가리키는지 재확인** |
| 3.2 | 스키마 실물 검증 | (mcp-publisher CLI) | M | 제안1 자인: `publish-server.md` 404 → 문서만으로 필드 확정 금지. **live CLI로 스키마 검증 후 작성** |
| 3.3 | ⚠️ `mcp-publisher login github` | (외부, OAuth) | S | `io.github.commet` 네임스페이스가 commet GitHub 계정에 바인딩됨을 확인 |
| 3.4 | ⚠️ `mcp-publisher publish` | (외부 공개) | S | npm 소유권 검증(`mcpName` 필드로) 통과해야 함 |
| 3.5 | 버전 동기화 4번째 등록부 | `PUBLISH.md` | S | repo/npm/`server.json` version을 **같은 커밋에서** bump하는 규칙 명문화 |

### 페이즈 4 — 데모 자산 + README 상단 (제안1 + 제안3, 이름 박제되므로 §3 이후)

| # | 항목 | 파일:줄 | 작업량 | 비고 |
|---|------|---------|--------|------|
| 4.1 | ⚠️ 30초 데모 녹화 | `argus-mcp/README.md` 상단 삽입 | L | asciinema/GIF: `argus_seal` → (대기 압축) → 정산일 `argus_settle` → Judgment Receipt(`AI VERDICT NONE`). **명령이 화면에 박히므로 이름 확정 후 녹화**. 창업자 머신 필요 |
| 4.2 | 뱃지행 추가 | `argus-mcp/README.md:2 부근` | S | npm version·downloads·MCP registry·MIT |
| 4.3 | ❌Without/✅With 대비 블록 | `README.md:33 "Why it's different" 재구성` | M | 현 산문형 → 스캔형 대비 포맷(Context7 검증 패턴). 기존 "no verdict tool" 구조증명은 상단 유지 |
| 4.4 | 클라이언트별 접힘 설치 블록 | `README.md:48-82 재구성` | M | `<details>` Cursor·Claude Desktop·VSCode·ChatGPT 각각 복붙 |
| 4.5 | 히어로 문장(제안3) | `README.md:3` | M | git commit 정신모델. **단 §4 게이트 통과 필수**, 2~3주 대기를 진입점에 명시(bait-and-switch 방지) |

### 페이즈 5 — 수동 디렉토리/마켓 (제안1, 최후)

| # | 항목 | 파일:줄 | 작업량 | 비고 |
|---|------|---------|--------|------|
| 5.1 | ⚠️ awesome-mcp-servers PR | (외부, punkpeye+wong2) | S | 새 이름으로 1줄 PR. 레지스트리 등재 후 대부분 봇 자동반영이나 이건 수동 |
| 5.2 | Claude Code 플러그인 마켓 검토 | `argus-plugin-v2/.claude-plugin/marketplace.json` | M | MCP와 **별개 발견 경로**. 이미 플러그인 존재 → 마켓화 검토(선택) |
| 5.3 | ⚠️ clean-install 스크린샷 1장 | (창업자 머신) | S | 새 환경에서 우리 서버가 뜨는지 눈으로 |

---

## 3. 검증 방법

발사 전, 창업자 머신에서 **실측 왕복 1회**가 최종 게이트입니다. 자동 가드로
대체 불가(자기채점 시뮬은 최종검증이 아님).

### 3.1 이름 동기화 전수 검증 (페이즈1 후)
```
# 옛 이름이 사용자향 표면에 남았는지 (0건이어야)
grep -rn "argus-mcp" argus-mcp/README.md argus-mcp/PUBLISH.md \
  argus-mcp/CHANGELOG.md argus-mcp/package.json argus-mcp/server.json
```
- **필수 치환 대상**: README:52,62,1 · package.json:2,8 · server.ts:42 ·
  PUBLISH.md 전체 · server.json.
- **선택(내부, 남아도 무해)**: `log.ts:8,13`(stderr 프리픽스) ·
  `ledger-replay.ts`·`surfaces.ts` 주석 · `seal/route.ts`(웹앱 extraction_tool
  라벨) · docs/* 감사문서.
- **한 문자열이라도 사용자향에 남으면 설치가 남의 패키지를 가리킴** → 반드시 0.

### 3.2 dist 위생 (페이즈1.10)
```
npm run build && find dist -name "*.test.js" -o -name "*test-helpers*"
# → 0건. README의 "grep dist/ — no verdict tool" 자기증명이 다시 깨끗해짐
```

### 3.3 실측 clean-install 왕복 (⚠️ 창업자, 최종 게이트)
```
mkdir /tmp/argus-test && cd /tmp/argus-test
npx -y argus-decision-mcp    # 우리 서버가 뜨는가? (남의 playwright 아님)
# tools list → argus_seal → argus_settle 1행 → Judgment Receipt 확인
```
- npm 로그인 상태 필수(현재 `npm whoami` → **E401**, 로그인+2FA 준비).

### 3.4 레지스트리 노출 확인 (페이즈3 후)
- registry.modelcontextprotocol.io 검색에서 `argus-decision-mcp`가 뜨는가.
  (현재 WebSearch 기준 우리 argus는 **레지스트리 미노출** 확인됨.)

### 3.5 빌드/테스트 회귀 (전 페이즈)
- `npm run build`(tsc 0) · `npm test`(현재 147 `it()` 블록, 전부 통과) 유지.
  ※ 제안2의 "185테스트/1.2.0"은 stale — repo는 1.3.0·약 147 `it()`. 판정 무관.

---

## 4. 스파인 위험표 (Zero-Judgment Gate 4조항 게이트)

CLAUDE.md 헌법: **사용자에 대한 평결·점수·등급 금지 / 가짜 소유권 금지 /
절제 기본값 / 강제 게이트 금지.** 이 베팅에서 스파인이 새는 지점:

| 위험 | 어디서 | 채택 조건 (스펙) |
|------|--------|------------------|
| **`AI VERDICT NONE`을 "자랑 배지"로** | 데모(4.1)·server.json description(3.1)·README 뱃지(4.2) | README:157이 이미 "not a badge... an asymptote, disclosed"라 명시. 데모/레지스트리 카피는 이 프레임을 **상속**할 것 — verdict-없음을 **루프의 사실**로만 보여주고 우월성 주장 금지. 모든 마케팅 라인을 4조항 개별 통과 |
| **제안3 도구 첫 응답 카피 = lean 누출** | (제안3의 argus_open_decision 발화 초안) | **이번 베팅에서 도구 응답 문자열 변경은 제외.** 헌법 4(b): disclaimed lean도 위반("태깅으로 verdict 세탁 불가"), per-output tilt-tag 금지. git-commit 비유가 crux 템플릿을 flat case에 만들어내면 rounds5-8 실패모드 재현. **fire-or-not 절제 게이트가 어떤 dev-프레임 템플릿보다 먼저** 돌아야 함 → 코드 변경은 별도 스파인 리뷰 트랙으로 분리 |
| **히어로 git-commit 비유 = 기대 불일치** | README:3(4.5) | 커밋=무료·즉각 vs Argus=2~3주 대기. **비유 진입점에서 지연-정산을 명시**(묻지 말 것) — 안 그러면 bait-and-switch로 읽힘 |
| **seal/settle 함수명 rename 유혹** | (제안3 어휘 노출) | **함수명은 grep 가능한 자산 → 변경 금지.** 어휘 *노출 순서*만 조정(개발자어 앞, 조어 뒤). 스파인 구조 도구명은 불변 |
| **유통 성과 = 활성화 성과 오인** | 성공 지표 전반 | 레지스트리 등재/유입은 **발견 트랙**. 47/0 정산은 **귀환 트랙**(cron/Companion Brief). 별개 계측. 등재를 활성화 진전으로 보고 금지 |

**공통 게이트**: 데모·레지스트리·README 카피의 **모든 줄**을 배포 전 4조항으로
재검토. 창업자 dogfood(≥3 seal + 1 real settle)가 진짜 점화 시험이며 이 베팅의
어떤 항목으로도 대체되지 않음.

---

## 5. 기각 목록 (하지 않기로 한 것)

| 기각 항목 | 사유 |
|-----------|------|
| **제안3의 도구 첫 응답 3종 카피 반영** | 스파인 최고위험(disclaimed lean도 위반). README 어휘 노출 순서는 채택하되 **런타임 도구 문자열 변경은 별도 스파인 리뷰 트랙**으로 분리 — 이번 유통 베팅에 섞지 않음 |
| **스코프드 이름 `@argus-voyage/mcp` 1순위** | 조직 생성 + `--access public` 필수 = 비개발자 창업자에게 함정. 무스코프 `argus-decision-mcp`가 단순·안전·검색 변별 우위 |
| **옛 PUBLISH.md의 1.2.1 tolerant-replay FIRST 서사 유지** | adesmet 소유 사실로 **허구**. 손상될 공유 ledger 0건. 재작성 대상이지 보존 대상 아님 |
| **`argus-judge`/`argus-verdict`/`argus-score` 이름** | Zero-Judgment 스파인 정면 위반 |
| **"유입 증가"를 이 베팅의 성공 지표로** | 유통≠활성화. 병목은 봉인 후 2~3주 귀환 |
| **디렉토리 트래픽 수치(7300/20222/Context7 44k스타)를 근거로 ROI 약속** | 제안1 자인: SEO블로그 근사치, 미검증. 등재는 하되 효과는 약속 안 함 |
| **Claude Code 플러그인 마켓 즉시 제출** | MCP 발견 경로와 별개·선택. 페이즈5 검토 항목으로만(우선순위 낮음) |

---

## 6. 창업자 버튼 (자율 실행이 못 하는 것 — 사람이 직접)

아래는 **외부 공개·계정·실측**이라 자동으로 못 합니다. 창업자가 직접:

1. **⚠️ 새 이름 확정** (0.1) — `argus-decision-mcp` 권고. 이거 없이는 아무것도
   시작 안 함.
2. **⚠️ npm 로그인 + 2FA** — 현재 `npm whoami` E401. `npm login` 후 준비.
3. **⚠️ 실측 clean-install 왕복 1회** (3.3) — 빈 폴더에서 새 이름으로 설치 →
   우리 서버 뜨는지 → seal→settle 1행 → **스크린샷 1장**. 발사 최종 게이트.
4. **⚠️ npm publish** — `npm run build && npm test`(prepublishOnly 게이트) →
   `npm publish`(무스코프면 `--access` 불필요) → `git tag`.
5. **⚠️ 공식 레지스트리** (3.3, 3.4) — `mcp-publisher login github`(commet 계정
   OAuth) → `mcp-publisher publish`. 선택이지만 이게 **다수 디렉토리 원천**.
6. **⚠️ 30초 데모 녹화** (4.1) — 창업자 터미널에서 실제 seal→settle 녹화
   (명령이 화면에 박히므로 이름 확정 후).
7. **⚠️ awesome-mcp-servers PR** (5.1) — GitHub에서 punkpeye+wong2 리스트에
   1줄 PR.
8. **⚠️ dogfood ≥3 seal + 1 real settle** — 이 베팅과 별개지만 진짜 점화
   시험. 유통이 이걸 대체하지 않음.

---

## 부록 — 실측 확인 사실 (2026-07-03, 이 세션)

- `npm view argus-mcp` → maintainer **`adesmet`**, latest **1.2.0**
  (= 타인 소유, 우리 publish 불가 확정).
- `npm view argus-decision-mcp` / `argus-voyage` / `@argus-voyage/mcp` →
  전부 **E404**(사용가능).
- `npm whoami` → **E401**(미로그인).
- `dist/`에 테스트 **18개 파일 + test-helpers.js** 실림(`files:["dist"]` +
  tsconfig exclude 부재).
- `argus-mcp/server.json` **부재**, `package.json`에 `mcpName`·`repository`·
  `homepage`·`bugs`·`author` **전무**.
- repo 버전 **1.3.0**(PUBLISH.md·package.json), 약 **147 `it()`** 블록.
- 사용자향 설치 명령은 **README:52,62** 2줄 + 서버 식별자 `server.ts:42`.
  settings 페이지(webapp)는 주석 언급뿐 = 안전.
