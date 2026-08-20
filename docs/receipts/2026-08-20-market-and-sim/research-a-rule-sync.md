# 리서치 A — 규칙 파일 동기화·컴파일(fan-out) 도구 전수 조사 (2026-08-20)

> 조사 에이전트 보고 원문. 창업자 질문("시중에 이미 CLAUDE.md 매번 바꿔주고
> 변경해주는 제품이 있었던 것 같다")의 절반 — fan-out 층. 방법·한계: 웹 검색
> 8회 + GitHub API + 공식 문서 직접 열람, 도구 약 25종. "전무 확인"은 이 범위
> 안에서의 미발견이지 부재의 증명이 아니다. 스타·푸시 일자는 2026-08-20 기준.

## A. fan-out (하나의 원본 → 여러 도구의 규칙 파일) 도구

| 도구 | ① 무엇을 하나 | ② 승인 | ③ 만기 | ④ 세션 수확 | ⑤ 백테스트 | ⑥ 위반 집행 | ⑦ 정산 | ⑧ 활동성 · URL |
|---|---|---|---|---|---|---|---|---|
| **Ruler** | `.ruler/*.md` 원본 → 31개+ 에이전트 파일 배포. MCP 설정·`.gitignore` 자동 관리, `--dry-run`(쓰기 미리보기), `revert` | ✕ | ✕ | ✕ | ✕ (`--dry-run`은 파일 쓰기 미리보기일 뿐) | ✕ (README에 CI 드리프트 검사 예시 워크플로만) | ✕ | 2,877★, 2026-08-19 푸시. github.com/intellectronica/ruler |
| **rulesync** | `.rulesync/` 원본 → 30+ 도구 생성. rules·commands·subagents·MCP·skills·ignore까지 커버, `import`/`convert`(기존 파일 역흡수·상호 변환) | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | 1,329★, 2026-08-18 푸시. github.com/dyoshikawa/rulesync |
| **Rules CLI** (Continue) | `.rules/` + 공개 레지스트리(hub.continue.dev). `add`(팩 설치)/`render`(9개 포맷 변환)/`publish` — 커뮤니티 규칙 팩 배포가 핵심 | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | rules.so 접속 확인. GitHub 저장소는 현재 검색 불가(이동/비공개 추정) — **확인 필요** |
| **crag** | `governance.md` 1개 → 13~23개 포맷 컴파일. `crag audit`: 산출물 부실화 + 규칙이 참조하는 명령의 실재 검사. git hook `--drift-gate`, PR 드리프트 리포트 Action | ✕ | ✕ ("never stale"은 산출물 신선도이지 규칙 내용 만기 아님) | ✕ | ✕ | △ (동기화 드리프트만 게이트 — 규칙 *준수* 차단 아님) | △ (정적 실재 검사만 — 결과 정산 아님) | 40★, 2026-07-27. github.com/WhitehatD/crag |
| **vibe-rules** | 규칙 저장/로드/포맷 상호 변환(10개 에디터), **npm 패키지에 동봉된 규칙을 의존성 스캔으로 설치** | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | 529★, 2026-08-16. github.com/FutureExcited/vibe-rules |
| **airul** | 지정 문서 목록 → AGENTS.md/CLAUDE.md/.cursorrules 등 단일 컨텍스트 파일 생성 | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | 34★, 2025-09 이후 휴면. github.com/mitkury/airul |
| 소형 클론군 | ai-rules-sync(제로 의존성 변환) · rule-porter(양방향) · jpcaparas/rulesync(PHP) · yulinlina/rulesync(Python) · Ercixz/RuleSync(Ruler GUI) · Sync AI Agent Rules Action | ✕ (README 수준 확인 — 개별 심층 검증 **확인 필요**) | ✕ | ✕ | ✕ | ✕ | ✕ | 대부분 0~13★ |

## B. 인접층 — 표준 · 팩 · 플랫폼 기능 · 집행 · 수확

| 항목 | 무엇 | 해당 사항 | 현황 · URL |
|---|---|---|---|
| **AGENTS.md 표준** | 단일 파일 표준으로 fan-out 필요 자체를 잠식. 2025-08 OpenAI·Google·Cursor·Factory·Sourcegraph 공동 공식화, 2025-12 Linux Foundation AAIF 이관, 6만+ 저장소 채택(서드파티 집계). Codex·Cursor·Copilot·Gemini CLI·Aider·Windsurf·Zed 등 네이티브 판독 | 거버넌스 기능 없음(순수 파일 규약). **Claude Code는 미지원** — 최다 반응 이슈(#34235, 5,200+ 반응)가 열려 있고 심링크/`@import`가 공식 우회 | agents.md · 이슈 #34235 |
| **커뮤니티 규칙 팩** | awesome-cursorrules 40,615★(활발) · steipete/agent-rules 5,694★(**아카이브**) · continuedev/awesome-rules · cursor.directory | 템플릿 모음일 뿐 — 거버넌스 전무 | 활발 |
| **dotai** (udecode) | 현재 "재사용 스킬 라이브러리"로 피벗 — 컴파일러 아님 | 전무 | 1,153★, 2026-08-13 |
| **VS Code 확장군** | .cursorrules 템플릿 설치기 다수 | 전무 | 마켓플레이스 다수 |
| **SpecStory** | 세션 자동 저장 + **Derived Rules**: 대화에서 규칙성 발화를 스캔해 `.cursor/rules/derived-rules.mdc` 등 자동 생성 (v0.7.0+) | **④ 수확: 함**. 명시적 승인 단계는 문서 미확인 — **확인 필요**. 만기·백테스트·집행·정산 없음 | docs.specstory.com/integrations/cursor |
| **Cursor Memories** | 사이드카 모델이 채팅에서 기억 후보 제안 → **사용자 승인 후 저장**(2025, 0.51→1.0). 이후 **2.1.x에서 기능 제거**, Rules로 전환 안내 (포럼·서드파티 확인; 공식 체인지로그 원문 확인 필요) | ②승인+④수확을 함께 했던 유일한 대형 제품 기능 — **현재 철수** | forum.cursor.com/t/custom-modes-and-memories-gone-in-2-1/143744 |
| **Cupcake** (EQTY Lab) | OPA/Rego 정책을 에이전트 훅(Claude Code hooks·OpenCode·Cursor)에 걸어 **도구 호출을 차단·수정·자동 교정** + 감사 로그. 기계 판정 가능한 정책 대상 | **⑥ 집행: 함** (런타임 차단). 승인·만기·수확·백테스트·정산 없음 | 286★, 2025-12 공개, 2026-08 활동. github.com/eqtylab/cupcake |
| **세션 수확 스킬군** | claude-md-updater(교훈 추출 → CLAUDE.md 수정 **제안하고 승인 후 기록**) · CLAUDE.md Lessons Manager · Claude Error Collector MCP | ④수확 + (claude-md-updater 한정) ②승인. 소규모 커뮤니티 스킬 — 사용자 수·유지보수 **확인 필요** | skillsmp.com 등 |

## 최종 판정

**(a) fan-out 층은 커머디티인가 — 그렇다.** 기능이 사실상 동일한 무료 MIT
도구 8종+, "rulesync"라는 이름만 같은 구현이 3개+, GUI·Action·확장까지 존재.
선두 Ruler조차 무료 OSS라 지불 장벽 없음. AGENTS.md 표준화가 층 자체를
아래에서 잠식 중 — 단 **Claude Code가 AGENTS.md를 안 읽는 것**(이슈 5,200+
반응)이 잔존 수요를 유지시키는 유일하게 큰 마찰.

**(b) 항목별 — 서명·만기·시운전·집행·정산:**

| 항목 | 판정 |
|---|---|
| 서명(사람 채택) | **부분적으로 있었음**: Cursor Memories(승인 후 저장 — **2.1.x에서 기능 제거**) · claude-md-updater 스킬(제안→승인). fan-out 도구층에는 전무 — 승인은 git diff 리뷰에 암묵 위임 |
| 만기/재확인 | **전무 확인** (crag의 "stale"은 산출물 신선도 검사) |
| 시운전/백테스트 | **전무 확인** — "이 규칙을 과거 세션에 적용했으면"을 돌리는 도구 없음. `--dry-run`류는 전부 파일 쓰기 미리보기 |
| 위반 감지·차단 | **여기가 함: Cupcake** (훅 기반 런타임 차단, 기계 판정 정책 한정) · Claude Code hooks(플랫폼 원시) · crag(드리프트만). 자연어 규칙 준수 차단은 미발견 |
| 결과 정산 | **전무 확인** |

**조사 범위에서 "서명→만기→시운전→집행→정산"을 하나의 수명주기로 묶은 도구는
없다.** 조각들이 흩어져 있고(승인=Cursor Memories(철수)·수확=SpecStory·집행=
Cupcake), 만기·시운전·정산은 어디에도 없다.

## 출처 (원링크)

- github.com/intellectronica/ruler · github.com/dyoshikawa/rulesync · rules.so
- github.com/WhitehatD/crag · dev.to/whitehatd (46% 드리프트 주장 — 재현 자료 미공개)
- github.com/FutureExcited/vibe-rules · github.com/mitkury/airul
- agents.md · github.com/anthropics/claude-code/issues/34235 · tessl.io/blog (채택 집계)
- github.com/PatrickJS/awesome-cursorrules · github.com/steipete/agent-rules (아카이브) · github.com/udecode/dotai
- docs.specstory.com/integrations/cursor
- forum.cursor.com/t/0-51-memories-feature/98509 · forum.cursor.com/t/custom-modes-and-memories-gone-in-2-1/143744 · localskills.sh/blog/cursor-memories-guide
- github.com/eqtylab/cupcake · cupcake.eqtylab.io
- skillsmp.com (claude-md-updater) · mcpmarket.com (Lessons Manager) · glama.ai (Error Collector MCP)
