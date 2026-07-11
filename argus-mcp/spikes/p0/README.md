# P0 스파이크 보고서 (2026-07-11 착공 — 정본 I-4의 P0)

> **이 디렉토리의 지위**: 정본(`docs/ARGUS-MCP-V2-SPEC.md`) I-4가 정한 P0 스파이크
> 5건의 산출물이다. npm 패키지에 포함되지 않고(`package.json`의 `files`가 `dist`
> 등만 배송), `tsc --noEmit`/`tsconfig.build`의 컴파일 대상도 아니다 — 테스트는
> vitest가 직접 실행한다(`vitest.config.ts`의 include에 `spikes/**`가 있다).
> 각 산출물의 "졸업 경로"(P1~P3에서 어디로 승격되는지)를 아래에 명시했다.

## 판정 요약

| 스파이크 | 판정 | 산출물 |
|---|---|---|
| ① statusline 배선 | **가능 — 확정** | 사실 확인 (아래 §1) |
| ② 마켓플레이스 설치 | **경로 실존 — 확정** | 워크스루 (아래 §2) |
| ③ 실전 transcript 픽스처 | **확보** | `fixtures/session-ko.jsonl` · `session-en.jsonl` |
| ④ 라우팅 eval 하네스 골격 | **가동 (CI red 게이트 포함)** | `routing-skeleton.ts` · `routing-eval.test.ts` |
| ⑤ 앵커 키워드 말뭉치 | **확보 (선언형·유예형·부정 가드)** | `src/v2/gate-keywords.ts`(P3-1 승격) · `routing-cases.json` |

추가 실증 1건: **`${CLAUDE_PLUGIN_DATA}`는 실존한다** — 공식 문서에는 없지만
Claude Code CLI 2.1.207 바이너리에 문자열로 존재함을 확인했다
(`grep -ao "CLAUDE_PLUGIN_[A-Z_]*" $(which claude)` → `CLAUDE_PLUGIN_DATA` ·
`CLAUDE_PLUGIN_ROOT` · `CLAUDE_PLUGIN_OPTION_`). 정본 규칙 3(저장 3분할)의 의존은
유효하다. 단 문서화가 뒤따르지 않은 API이므로, P2 시공 시 미설정 fallback
(`~/.argus/tmp/` 등)을 한 줄 두는 것을 권고한다.[^1]

## §1 · 스파이크 ① — statusline 배선 가능성: 가능

- 플러그인은 자기 루트의 `settings.json`으로 **기본 statusline을 직접 배송할 수
  있다** (공식 문서 확인: https://code.claude.com/docs/en/statusline.md).
- statusline 스크립트는 stdin으로 JSON을 받는다 — `cwd` · `session_id` ·
  `transcript_path` · `model.*` · `context_window.*` 등 50+ 필드. 갱신은
  이벤트 구동(assistant 메시지 후 등, 300ms 디바운스), `refreshInterval`로 주기
  갱신 가능. ANSI 색 허용, 여러 줄 허용.
- **v1 자산 재사용 판정**: `argus-plugin-v2/statusline/index.js`는 이미 due 우선순위
  계층·CJK 폭 계산·zero-dependency·절대 무예외 원칙까지 갖춘 완성형이다. v2에서
  바꿀 것은 **데이터 소스뿐**: 현재 `<repo>/.argus/ledger/ledger.jsonl`(v1 위치)을
  읽는 부분을, 정본 II-D의 발견 메커니즘(`~/.argus/registry.json`에서
  `git_common_dir → repository_id` 조회 → `~/.argus/projects/{repository_id}/ledger.jsonl`)
  으로 교체한다. 나머지(렌더 계층·우선순위)는 그대로 승격한다. — **P2 시공 항목.**
- 파일 경로 어포던스(정본 규칙 18): 절대 경로의 열기/첨부 렌더는 **문서화되지 않은
  동작**임을 확인했다 — 규칙 18의 "진행형 강화로만 취급, 기능 의존 금지" 스탠스가
  옳았음을 재확인. 스펙 변경 불요.

## §2 · 스파이크 ② — 마켓플레이스 설치 워크스루: 경로 실존

리포에 이미 필요한 두 파일이 실존한다: 루트 `.claude-plugin/marketplace.json`
(마켓플레이스 정의) + `argus-plugin-v2/.claude-plugin/plugin.json`(manifest,
v2.7.0). 사용자 설치 경로(공식 문서 대조 확인):

```
/plugin marketplace add commet/Argus     # 1회
/plugin install argus@<marketplace-name> # scope 선택 UI (user/project/local)
```

- 플러그인 번들이 `.mcp.json`을 루트에 두면 **설치만으로 MCP 서버가 자동 배선**된다
  — v2의 "얇은 드라이버 플러그인 + MCP 본체" 구조가 설치 1회로 완성됨을 의미.
  현 `argus-plugin-v2`에는 `.mcp.json`이 없다 — **P2에서 신규 드라이버 플러그인에
  포함**할 것.
- 훅 계약(공식 문서 확인): SessionStart/SessionEnd 입력에 `transcript_path` 포함
  (수확 클레임에 필요한 전부), PostToolUse 입력에 `tool_name`/`tool_input`/
  `tool_response` 포함(verified commit signal의 발화 조건 관측에 충분).
  SessionStart 훅의 stdout은 컨텍스트로 주입된다. 타임아웃 기본 600초 /
  UserPromptSubmit만 30초 — 정본 규칙 4의 latency budget은 이 30초/600초보다
  훨씬 짧게 잡아야 한다(사용자 체감 기준이지 훅 한도 기준이 아니다).
- 이 환경(원격 컨테이너)에서는 대화형 `/plugin` UI를 실행할 수 없어 **실설치
  클릭-스루는 미완**이다. Release Matrix의 Distribution 행(clean install)이 이를
  P5 전에 실기기로 검증한다 — 여기서 끝난 것이 아니라 구조 요건 충족까지만 확인.[^2]

## §3 · 스파이크 ③ — 실전 transcript 픽스처 (ko + en)

`fixtures/session-ko.jsonl` · `fixtures/session-en.jsonl`.

- **구조는 실물, 내용은 합성**: 라인 스키마(필드명·중첩 구조)는 실제 Claude Code
  2.1.207 세션 transcript에서 검증해 그대로 옮겼다 — user 라인의
  `parentUuid/isSidechain/promptId/message{role,content:string}/uuid/timestamp/
  permissionMode/origin/promptSource/userType/entrypoint/cwd/sessionId/version/
  gitBranch`, assistant 라인의 `message{model,id,type,role,content:[{type,text}],
  stop_reason,usage}/requestId/…`. 대화 내용 자체는 합성이다(실사용자 데이터를
  픽스처로 커밋하지 않는다).[^3]
- 실물 transcript에는 이 외에도 `queue-operation`·`attachment`·`system`·`mode` 등의
  라인 타입이 존재함을 확인했다. 그 상세 shape는 검증하지 못했으므로 **픽스처에
  지어내서 넣지 않았다** (정직한 구조 > 그럴듯한 조작 — CLAUDE.md LLM-glue 불변식).
  대신 `type: "unknown-future-line"` 합성 라인 1개를 넣어 **파서가 미지 타입을
  crash 없이 건너뛰는 경로**(정본 II-E의 `skipped_unknown`에 대응)를 고정했다.
- ko 픽스처의 결정 발화는 한글(멀티바이트)이라 **UTF-8 byte offset ≠ 문자 index**
  임을 `evidence-pointer.test.ts`가 실증한다 — 정본 II-C가 byte offset을 명시한
  이유가 이 픽스처에서 그대로 드러난다.

## §4 · 스파이크 ④ — 라우팅 eval 하네스 골격

`routing-skeleton.ts`(결정론 검출 floor) + `routing-eval.test.ts`(하네스).

- **하네스가 영속 자산이고 검출기는 교체 부품이다**: `detect()`는 키워드+가드의
  결정론 floor일 뿐, P3의 캡처 게이트(모델 계층 포함)가 이것을 **대체**한다.
  말뭉치·케이스·CI 게이트는 그대로 남아 새 검출기를 같은 잣대로 잰다.
- **CI red 게이트 2개** (Release Matrix "Capture" 행의 선행 형태):
  1. `expect: "silent"` 전 케이스(≥20 flat 포함)에서 발화 0 — **한 건이라도
     fire하면 빌드가 죽는다** (over-fire는 스파인 위반이므로 하드 게이트).
  2. `expect: "fire"` 케이스의 재현율이 기록된 floor 밑으로 **후퇴하면** 죽는다 —
     floor는 현재 측정값으로 고정했고, P3에서 검출기가 좋아지면 floor를 올린다.
     (키워드 floor의 재현율을 100%로 사칭하지 않는다 — 그건 이 말뭉치에
     과적합했다는 뜻일 뿐이다.)
- 픽스처 연동: 하네스는 ③의 두 transcript에서 user 발화를 추출해 같은 검출기에
  통과시킨다 — 말뭉치(문장 단위)와 실전 형태(JSONL 라인) 양쪽에서 동일 판정.

## §5 · 스파이크 ⑤ — 앵커 키워드 말뭉치

`src/v2/gate-keywords.ts`(검출 데이터 — P3-1에서 JSON에서 TS 모듈로 승격) + `routing-cases.json`(판정 케이스, ground truth).

- 구성: **선언형**(ko "~기로 했다/하자/함/확정", en "decided to / settled on /
  we'll go with" 류) · **유예형**(ko "보류/미루자/나중에 다시", en "hold off /
  park it / revisit" 류 — **유예도 결정이다**, 캡처 후보에 포함) ·
  **부정 가드**(ko "~한 건 아니야/아직 결정 못", en "haven't decided" 류 —
  선언형 키워드를 포함해도 침묵) · **의문문 가드**(끝이 `?`면 침묵 — 질문은
  약속이 아니다).
- 함정 케이스를 의도적으로 포함: "we could go with A or B"(옵션 나열 — 침묵),
  "Let's go over the failing tests"("go with" 유사 표면 — 침묵),
  "commit this and push"(git 동사 ≠ 결정 — 침묵), 부정 선언("~가기로 한 건
  아니야" — 침묵).
- 케이스는 데이터 파일에만 추가한다 — 러너에 하드코딩 금지
  (기존 `argus-plugin-v2/evals` 규약과 동일).

## 졸업 경로 (P0 exit 후 이 디렉토리의 운명)

| 산출물 | 승격처 | 시점 |
|---|---|---|
| transcript 픽스처 | P1 원장/증거 계약 테스트 + P3 수확 테스트의 공용 픽스처 | **이행** — routing-eval·gate.test가 소비 |
| evidence-pointer 검증 로직 | `src/v2/evidence.ts` (II-C 구현) | **P6-1 졸업 완료** — 수확 처리 단계가 소비 |
| routing-cases + gate-keywords | P3 캡처 게이트의 eval 말뭉치 (계속 성장) | **P3-1 졸업 완료** — 검출기=src/v2/gate.ts, 스켈레톤은 재수출 |
| routing-skeleton | 재수출 껍데기로 축소 (하네스가 배송 검출기를 직접 잰다) | **P3-1 완료** |
| statusline 판정 | P2 드라이버 플러그인 시공 근거 | **P2-2·P2-4 이행** — v2 소스 개조 + argus-driver 배송 |

[^1]: 바이너리 문자열 존재는 "이 버전에서 코드가 참조한다"의 증거이지 안정 API
  계약이 아니다. fallback 한 줄이 이 차이를 흡수한다.
[^2]: 이 구분을 뭉개면 "스파이크 통과 = 설치 검증 완료"로 읽히는 조용한 품질
  저하가 생긴다 — 실설치는 Release Matrix가 소유한 미완 항목이다.
[^3]: 실물 검증 방법: 이 세션 자신의 transcript JSONL에서 라인 타입 분포와
  user/assistant 라인의 필드 목록을 추출·대조했다 (2026-07-11, CLI 2.1.207).
