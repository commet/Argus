# 청사진 보완 (Addendum v1.1)

> 원본 청사진(`MCP-REDESIGN-BLUEPRINT-2026-06-30.md`)을 짓기 직전에 4명의 리뷰어가 4개 축(MCP 규격 완전성·엔지니어링 견고성·제품 스파인 완전성·채택/운영+재활용)에서 누락·증발한 점을 사냥했습니다. 이 부록 + 원본 청사진을 합치면 **시공 명세서 전체**입니다. 어려운 용어는 처음 나올 때 한 줄로 풉니다.
>
> 결론 먼저: 원본은 **상태기계·스파인 불변식** 축에선 거의 완전합니다. 빈 곳은 둘입니다 — (1) **MCP 배선 규격**(annotations·outputSchema·instructions = 호스트에게 "이건 읽기전용이다/포크 불가다"를 알리는 기계적 신호), (2) **6도구 붕괴가 일으킨 조용한 가치 누락**(영수증의 가장 풍부한 4필드가 입력받을 데가 사라짐). 둘 다 아래에서 닫습니다.

---

## 1. 새로 추가/수정할 점 (랭크)

4개 리포트의 진짜 발견을 **중복 제거**하고 랭크했습니다. 원본에 이미 있는 건 버렸습니다. 두 리뷰어가 충돌하면 제가 판정했습니다.

### SHOULD-ADD (v1에 반드시 넣음)

| # | 무엇이 빠졌나 | 구체적 수정 | 접히는 § |
|---|---|---|---|
| **A. `${workspaceFolder}` → 클로드코드에서 안 풀림 (BLOCKER급)** | §4.0 line 329의 설치 블록 `"ARGUS_DIR": "${workspaceFolder}/.argus"` — `${workspaceFolder}`는 **VS Code 변수**다. Claude Code(창업자 주력 호스트)는 `${CLAUDE_PROJECT_DIR}`만 푼다. 그대로 두면 `${workspaceFolder}`라는 *문자 그대로의 폴더*가 생기고, 귀환 루프 읽기가 전부 빗나가며 **조용히** 실패한다(M3가 고치려던 바로 그 실패모드를 M3 수정이 재도입). | (a) Claude Code 블록 = `${CLAUDE_PROJECT_DIR}/.argus`. (b) **호스트별 config 매트릭스** 추가(Claude Code=`${CLAUDE_PROJECT_DIR}`; ChatGPT/Gemini/Generic=절대경로 또는 `argus_init` 바인딩 의존). (c) env 보간은 호스트마다 다르니 **바닥(Tools)은 env에 의존하지 않게** — 아래 B 참조. | §4.0 |
| **B. `argus_init` 바인딩을 dir의 *1차* 소스로 (env는 꼴찌)** | §4.0은 env를 1차, init을 fallback으로 둔다. A 때문에 순서가 거꾸로다 — env 보간이 *가장* 비호환인데 load-bearing이다. 그런데 모든 Tool은 이미 `argus_dir`를 필수 인자로 받는다(=바닥엔 신뢰 가능한 per-call dir이 이미 있다). | 해석 순서: (1) per-call `argus_dir` 인자[모든 호스트 동작], (2) `argus_init`이 쓴 `.argus/.bound` 마커 파일을 Resource list 때 읽음, (3) `ARGUS_DIR` env 꼴찌. **v1 바닥은 env config 0으로 모든 호스트에서 동작.** | §4.0 |
| **C. 영수증 4필드 입력경로 증발 (조용한 가치 누락 — §2 상세)** | `argus_seal`/`argus_settle` 어느 스키마에도 `real_question`·`unverified_assumption`·`human_only`·`human_judgment` 입력 필드가 없는데, `Receipt` 인터페이스(§2.3)와 README hero 렌더(§5.2)는 이 4필드를 채워서 보여준다. 스키마 그대로면 `renderReceipt()`가 **4칸을 공백으로** 찍는다 — 그중 "…made by Me. (not the model)"는 anti-verdict의 하중 문장. | 이 4필드를 **`argus_seal`에 seal-time 입력으로 추가**. `human_judgment`는 `predicate_owner`처럼 owner 태깅 — CLAUDE.md 규칙 1에 따라 반드시 `user` 작성, 절대 `ai_surfaced` 상속 금지. settle은 `what_happened/outcome`만 패치. §0에 "2단계 영수증 보존(predicate+date로 붕괴 아님)" 행 추가. | §2.2, §2.3, §0 |
| **D. 기존 dogfood 데이터가 새 단일-id 모델에서 안 보임 (§3 상세)** | 청사진은 정체성을 `sessions/{id}/receipt.json`(라벨 고정 `current`)로 붕괴시키지만, 현재 데이터는 `sessions/{id}/versions/{label}/receipt.json`에 산다. 새 `resolveContract(id)`는 `versions/`를 안 봐서 **창업자 본인의 seal→settle 데이터가 전부 투명**해진다 — §7 성공지표("한 행이 도착했나")의 유일한 실재 행들이 버려지는 레이아웃에 있다. | `resolveContract`에 **back-compat 읽기 shim**: `sessions/{id}/receipt.json` 없으면 `sessions/{id}/versions/*/receipt.json`을 glob해서 최신을 `current`로 읽음(파괴적 이동 아님, 읽기경로만). 옛 레이아웃으로 시드한 G-tier eval 픽스처가 여전히 settle돼야 함. **단, §3의 판정 참조 — 실사용자 ~0이라 clean break도 허용 가능.** | §3.0 |
| **E. 영수증 settle 머지가 lost-update 레이스 (RMW)** | `receipt.ts:31-54`는 read→merge→write다. atomic *write*는 안전하나 read-merge-write는 두 settle 호출(또는 seal-time 쓰기 vs settle-time 쓰기)이 교차하면 seal-time 필드를 잃는다. 청사진 §0에 동시성 행이 없다. | 영수증을 **`replayLedger` 투영으로** settle 시점에 한 번만 쓴다(read-merge 제거). 청사진은 이미 status를 replay 투영으로 만들었으니(§3.2) 영수증도 그렇게 하면 레이스가 공짜로 사라진다. | §3.0, §3.2 |
| **F. 패키징이 publish 불가 — `npx -y argus-mcp`가 fresh install서 튕김** | `package.json`에 `bin → dist/index.js`는 있으나 `prepublishOnly`/`prepare` 빌드 없음, `files` 화이트리스트 없음, `dist/` 미커밋, `engines.node` 없음, **테스트 러너 devDep 자체가 없음**(vitest/jest 0). §5.4 헤드라인 `claude mcp add argus -- npx -y argus-mcp`가 첫인상인데 현재 바운스. | `"engines":{"node":">=18"}`, `"files":["dist"]`, `"prepublishOnly":"npm run build && npm test"`, `"typecheck":"tsc --noEmit"`, `"test":"vitest run"` 추가 + vitest devDep + `dist/` 커밋 or prepublishOnly 의존. **A3(Windows npx cold-start 5~15s) 주석**: §5.4에 "첫 시작 타임아웃 시 `npx -y argus-mcp --version` 1회로 캐시 워밍" 추가. | §5.3, §5.4 |
| **G. MCP `instructions` 필드 — 죽인 복붙프롬프트의 규격상 합법적 집** | 가장 큰 규격 누락. 청사진은 복붙 시스템프롬프트를 죽이지만 그 대체지를 명명 안 함. MCP `initialize` 결과의 `instructions` 문자열은 클라이언트가 시스템프롬프트 앞에 붙이는 **유일한 규격-인정·호스트-보편 자리**이고, 도구결과 내장보다 낫다(연결 시 1회 로드, 첫 호출 전). | `new Server(..., { capabilities, instructions: SPINE_INVARIANTS.serverInstructions })`를 `spine.ts` 단일소스에서. 단 규격이 "도구 설명 중복 금지"라 했고 스파인이 verdict-leak 금지라 — 이 문자열은 **restraint 프레이밍**("한 질문을 표면화, 절대 판결 아님")이어야지 복붙프롬프트 아님. | §4(복붙프롬프트의 집), §3.6 |
| **H. 도구 annotations — 6도구 전부 미선언** | 2025-06-18 규격의 `ToolAnnotations`(readOnlyHint 등)를 호스트가 신뢰/확인 UX에 쓴다. 읽기도구에 `readOnlyHint:true`를 다는 게 "읽기표면은 판결 못 씀"(§4 산문 주장)의 **배선 차원 증명**이다. annotations 없는 "프리미엄 호환" 서버는 2024년 서버로 읽힌다. | 매핑: `argus_recall`/`argus_check_in` → `{readOnlyHint:true, openWorldHint:false}`; `argus_open_decision`/`argus_seal` → `{readOnlyHint:false, idempotentHint:false}`; `argus_settle` → `{idempotentHint:true}`(append-only 종단, 재호출=`ALREADY_SETTLED`라 안전 멱등); `argus_config` → `{idempotentHint:true}`. | §2(각 도구), §4 |
| **I. outputSchema + structuredContent — 봉투를 어디로 반환?** | 청사진의 drift-guard 스토리(`ai_verdict===null`, `options/poles/lean/tilt` 부재, `next_actions` enum)는 *구조 계약*이다 — 정확히 2025-06-18 `outputSchema`+`structuredContent`가 호스트 스키마 검증기로 막아주는 것. 현재 코드는 `content:[{text:JSON.stringify}]`만. | 도구별 `outputSchema` 선언(`OpenDecisionData`/`Receipt` 형), `result.structuredContent`로 객체 반환 + **text 미러 유지**(비구조 클라 fallback, 규격 요구). "포크는 타입상 불가"가 *호스트* 검증기로도 강제되는 두 번째 공짜 벨트. | §2, §3.6 |
| **J. 페이즈별 capability 선언 — 핸드셰이크가 조용히 깨짐** | 현재 `capabilities:{tools:{}}` 하드코딩. 청사진은 Phase 2에 Resources/Prompts를 추가하지만 `capabilities:{resources:{},prompts:{}}` 선언 + `ListResources/ReadResource/ListPrompts/GetPrompt` 핸들러 등록을 안 적었다. capability 미선언이면 호스트가 Resource를 안 찔러봄 → "대화시작 자동주입"이 조용히 no-op(M3가 고치려던 실패를 핸드셰이크 층에 재도입). | §7 Phase 2에 **명시 체크리스트 항목**: capability 플래그 + 4핸들러 등록. `argus://contracts/due` 자동주입은 `resources` capability 선언 필수. | §4, §7 Phase 2 |
| **K. reframe/blindspot = "질문 날카롭게 + 사각 표면화" 표면 증발** | 6도구는 webapp의 진짜 pre-decision 능력(`reframe-core.ts`의 hidden-assumption 표면화, `blindspot`)을 떨군다. 이건 스파인의 **"최대 생성"** 반쪽이고 스파인-안전(가정을 표면화할 뿐 판단 안 함)이다. `argus_open_decision`은 의도적으로 반대(restraint 게이트)라 "내가 뭘 놓쳤나" 능력이 통째 사라진다. | **3번째 Prompt `/argus-reframe`**(7번째 *도구* 아님 — 상태전이 아니라 모델이 말하는 텍스트라 Tools 바닥 밖에 두고 우아하게 강등). `discipline.ts`/reframe-core *테제*에서 렌더, `hidden_assumptions[]`(axis + risk_if_false) 방출, **"참고:" 프레이밍(CLAUDE.md 주입규칙)**, `ai_surfaced` 태깅. `reframe-core.ts` 함수 자체는 import 금지(포크 모양) — 테제만 산문으로. | §4(Prompts, 3번째) |
| **L. 연속성(n=1 moat) — 지금 결정을 과거 settled와 잇는 표면 0** | 천명한 moat는 "네 n=1 이력 소유"인데 모든 도구가 단일 `id`를 고립 처리한다. `argus_open_decision`은 과거 영수증을 안 읽어 "비슷한 결정 지난번엔 현실이 어디로 갔다"를 못 준다. GTM 감사의 make-or-break("점화가 도느냐"). | `argus_open_decision`에 선택적 `related_to: string[]`(과거 id들) + 그 settled 영수증에서 **표본크기-스케일 frequency statement**("비슷하다 태깅한 3건: 2 held, 1 partial — 표본 작아 의미 약함"). CLAUDE.md 스파인규칙 2 준수, 절대 판결/"넌 ~하는 경향" 금지. | §2.1, §2.5 |
| **M. 온보딩/첫실행 — seal→settle 루프 발견 스토리 0** | §5.4/5.5는 GitHub 브라우징하는 사람용 README만 커버. 호스트가 막 연결한 신규 사용자는 루프 존재를 발견할 길이 없다. 루프가 반-직관적("결정 안 하는 결정 도구")이라 더 중요 — 넛지 없으면 문서화된 실패모드(서버 연결, 행 0)로 직행. §7 stop-recommendation이 의존하는 활성화 레버. | `argus_init`(또는 ledger 비었을 때 `argus://bearing/current` empty-state)에 결정적 온보딩 `surface`: "Argus는 답 안 함 — 예측+확인날짜를 기록하고 그날 현실과 만남. argus_open_decision으로 첫 결정 열기." 1문장, 스파인-안전, ledger 빌 때만. | §2.6, §5 |
| **N. `ARGUS_TZ`/`localToday` 비결정 DUE 버그가 *두* 콜사이트에 산다** | M4가 짚은 "today_override 무시" 버그는 `argus_ledger_replay` *와* `argus_contracts_due` 둘 다. `localToday()`(ledger-replay.ts:8)는 `new Date()` 로컬필드라 TZ env를 무시하고, 두 도구 fn이 override를 드롭한다. `ARGUS_TZ`는 `getFullYear/getMonth`를 Intl/UTC 포매터로 **갈아끼우는 재작성**이지 param 추가가 아니다. | §3.5에 두 패치사이트 명명 + "`localToday` 재작성(param 추가 아님)" 명시. | §3.5 |

### NICE (싸고 진짜지만 v1 데이터 깨짐은 아님)

| # | 무엇 | 수정 | §|
|---|---|---|---|
| **N1. 스키마 `version` 필드 부재** | ledger 이벤트·영수증·config에 버전 마커 0. 청사진 자체가 깨는 마이그레이션인데 다음 마이그레이션이 모양을 sniff해야 함. | ledger 이벤트마다 `v:1`, 영수증/config에 `schema_version:1`. `replayLedger`가 미지 `v`에 분기. | §3.0 |
| **N2. config 머지가 비-atomic RMW** | m1의 "없는 키만 채움"이 atomicity/concurrency 미명세. 현재 `config.ts:39`는 plain `fs.writeFile`. 크래시 시 `config.yaml` 절단. | `atomicWriteJson` 경유 + E와 같은 단일-쓰기 규율. | §2.6 |
| **N3. 손상시 quarantine가 `session.ts`에만, replay/영수증엔 없음** | `replayLedger`는 파싱불가 라인을 조용히 `continue`. 찢긴 마지막 라인(append 중 크래시) = seal이 `ok:true`로 사라짐 = B1 실패모드의 durability 버전. | `replayLedger`가 dropped 라인 카운트해 `argus://ledger`에 `integrity:{dropped_lines:n}` 노출. `resolveContract`는 파싱실패 영수증을 "부재" 아닌 quarantine(부재 vs 손상 = self-create vs data-loss). | §3.0 |
| **N4. stderr 로깅 규칙 미명세** | stdio 서버는 stdout에 절대 안 씀(JSON-RPC 프레임 손상). 현재 코드는 깨끗하나 청사진이 새 실패경로(게이트 로깅·경로차단·quarantine) 추가하며 채널 미명시. | §3에 1규칙: "모든 진단은 `process.stderr`; `ARGUS_DEBUG` env로 verbose; stdout은 JSON-RPC 전용." | §3 |
| **N5. config 우선순위 1표 부재** | per-call `argus_dir` vs `ARGUS_DIR` env vs init 바인딩, `today_override` vs config 바인딩 vs `ARGUS_TZ` — 충돌 시 승자 미명시. Tools는 `argus_dir` 받지만 Resources는 못 받아 두 표면이 다른 root를 풀 수 있음. | §4.0에 1순서표(A2 해석순서와 동일). | §4.0 |
| **N6. ledger 무한증식 + 매호출 byte-0부터 replay** | 매 도구호출이 전체 ledger를 `readFileSync`+fold = O(전체이력)/호출. compaction 스토리 없음. | §6 한계에 "선형스캔 천장 + v-later 스냅샷 compaction" 1문장(인정된 점근선화). | §6 |
| **N7. `basis`(luck vs judgment)가 seal서 잡히나 어디서도 안 읽힘** | `argus_seal`이 `basis`를 받지만 `Receipt`·`renderReceipt`·`track_record` 어디에도 없음 = write-only("UI 멀쩡, 데이터 미도착"). `basis:luck`+`outcome:held`가 운빨 적중과 좋은 판단을 가르는 신호. | `basis`를 `Receipt`에 싣고 영수증에 *중립* 1줄("You called this: judgment" — 채점 아님). | §2.3, §5.2 |
| **N8. dismiss 사유 미포착** | §3.2에 `dismissed` 종단 전이는 있으나 `dismiss_reason` 필드/도구 0. 왜 떠났나(마음변경/무관/오프-Argus 결정) 손실 — L의 연속성 데이터이기도. | `dismiss_reason: enum['became_irrelevant','decided_elsewhere','changed_mind','other']`(+선택 자유텍스트)를 dismiss 이벤트에 append, `view:contracts`에 표시. enum-only라 스파인-안전. | §2, §3.2 |
| **N9. amend 감사추적 비가시** | amend 가드(m4)는 스파인 승리인데 amend 이력 보여주는 표면 0 = write-only. "이 날짜를 봉인 전 1회 옮겼다"가 가드를 사용자에게 *신뢰가능*하게 만듦. | `receipt` view에 `amend_history[]`(replay 소스) + 영수증에 조용한 각주. 순수 읽기. | §2.5, §5.2 |
| **N10. SECURITY.md 위협모델 2벡터 누락** | (a) ledger 변조/replay 무결성 — `replayLedger`가 모든 JSONL 라인을 신뢰, 주입된 `settle` 라인이 track record 조용히 재작성. (b) Windows 심볼릭/junction 탈출 — `assertInside`의 `path.resolve`는 심링크 미해석. | (a) 신뢰경계 명시("`.argus`=신뢰 로컬 상태, 무결성=파일권한, v1은 서명 안 함"). (b) `fs.realpathSync`를 실제 방어로 명시 or out-of-scope 문서화. | §5.4 |
| **N11. `ajv` 의존성 제거 + dep-tree "텔레메트리 없음" 강제** | §5.4는 텔레메트리 없음을 *주장*하나 `package.json`에 미사용 `ajv` 잔존. "audit-me" 피치에서 dep surface가 위협모델. | v1 런타임 dep = `sdk`+`js-yaml`만; "`npm ls --prod`에 네트워크/분석 패키지 0, CI가 증가 시 실패." | §5.4 |
| **N12. completion/`_meta`/protocolVersion 핀/페이지네이션** | (NICE 묶음) `argus://receipts/{id}`+`/argus-settle`의 `id` 자동완성, 결과 `_meta`에 게이트 audit, 2025-06-18 protocolVersion 핀(README), list 반환 `nextCursor`. | 전부 NICE — 데이터 이미 도달가능/테스트 커버됨/founder 1명. v1.5+. | §4, §5.4 |

### SKIP (v1 명시 제외 — 판정 포함)

- **logging capability** — §5.4 "텔레메트리 없음" 가치와 정면 충돌. SKIP.
- **Resource subscribe / 진행알림 / 요청취소** — 청사진이 이미 Phase 3로 올바르게 연기(6도구 모두 sub-second 로컬 파일 op). 갭 아님.
- **recast / rehearse / refine / persona** — CLAUDE.md가 의도적 별개 브레인으로 명시. 조용한 드롭 아님. 미래 Prompt 후보일 뿐.
- **signal-recorder / hit-rate** — §7 stage 3("측정이 요구할 때만")이 올바른 집. `gate_input` 메타로깅(§3.3)이 씨앗.

### 충돌 판정 (리뷰어 disagree)

- **`reframe-core.ts` 재활용** — 제품 리뷰어는 "테제 포팅"을, 재활용 리뷰어는 "함수 import 절대 금지(포크 모양)"를 말함. **판정: 둘 다 맞음 → K번대로 함수 import 금지, 테제만 `discipline.ts` 산문으로**. 재활용 지도(§4)에 reframe-core = "DO NOT port (reference only)"로 못박음.
- **back-compat shim 필요성(D)** — 견고성 리뷰어는 shim 필수, 메모리는 실사용자 ~0. **판정 = §3.**

---

## 2. 조용한 가치 누락 (중요)

6도구 붕괴가 일으킨 **silent value drop** — 잡혔다고 보이나 입력/출력 경로가 사라진 것들. 각각 결정.

| 누락 | 진단 | 결정 |
|---|---|---|
| **영수증 seal-time 4필드** (`real_question`·`unverified_assumption`·`human_only`·`human_judgment`) | 가장 명백·가장 silent. `Receipt` 인터페이스와 README hero(§5.2)는 채워서 렌더하는데 **어떤 도구도 입력 못 받음**. "…made by Me. (not the model)"가 비면 영수증을 AI 판결과 구별하는 그 한 문장이 사라짐. | **`argus_seal`에 4필드 입력 추가**(seal-time 포착). `human_judgment`는 owner-태깅·`user` 작성 강제(`ai_surfaced` 상속 금지, CLAUDE.md 규칙 1). settle은 `what_happened/outcome`만 패치. 2단계 영수증을 **복원이 아니라 명시적 보존**으로 §0에 행 추가. |
| **reframe/blindspot (질문 날카롭게)** | 스파인의 "최대 생성" 반쪽이 MCP 표면에서 통째 증발. `argus_open_decision`은 restraint 전용이라 "내가 뭘 놓쳤나"가 사라짐. | **도구 아님, Prompt로 복원** = `/argus-reframe`. 상태전이가 아니라 모델이 말하는 텍스트라 Tools 바닥 밖. `hidden_assumptions[]`(axis+risk_if_false), "참고:" 프레이밍, `ai_surfaced` 태깅. reframe-core 함수 import 금지(테제만). |
| **track-record 연속성 / n=1 moat** | 모든 도구가 단일 id 고립. 지금 결정을 과거 settled와 잇는 표면 0 = 천명한 moat의 부재. | **기존 도구의 필드로 복원** = `argus_open_decision`에 선택적 `related_to: string[]` + 표본크기-스케일 frequency statement. 새 도구/표면 신설 아님. v1.5(점화 확인 후) 무게. |
| **`basis` (luck vs judgment)** | seal서 잡히나 영수증/track_record 어디서도 안 읽힘 = write-only. | **`Receipt` 필드로 복원** + 영수증 중립 1줄. 채점 금지. |
| **dismiss 사유 / amend 이력** | 둘 다 ledger에 이벤트는 있으나 표면 0 = write-only. | dismiss = enum 필드 추가(N8). amend = `receipt` view에 read-only 이력(N9). 둘 다 NICE. |

---

## 3. 데이터 마이그레이션 / 하위호환

**판정: 실사용자 ~0 (메모리: funnel = 13 users / 47 projects / **0 sealed / 0 settled**, 창업자 포함). 따라서 데이터 손실 위험이 있는 *유일한* 실재 행은 창업자 본인 dogfood다.**

그래서 **하이브리드 결정**:

1. **읽기경로 shim은 넣는다 (싸고 창업자 데이터 보존)** — `resolveContract(id)`에서 `sessions/{id}/receipt.json` 부재 시 `sessions/{id}/versions/*/receipt.json` glob → 최신을 `current`로 읽음. 파괴적 이동 없음, ~10줄. 창업자의 seal→settle dogfood(§7 성공지표의 유일한 실재 행)가 새 모델에서 계속 보임.
2. **마이그레이션 스크립트는 안 만든다 (clean break 허용)** — 0 sealed contract이므로 복잡한 이동 마이그레이션은 과잉. shim이 읽기를 받쳐주면 충분. 새 seal부터는 `sessions/{id}/receipt.json`(current)로 쓴다.
3. **G-tier eval 픽스처 1개**를 옛 `versions/` 레이아웃으로 시드 → 여전히 settle돼야 함(회귀 가드).

**한 줄: 마이그레이션 스크립트는 불필요(실사용자 ~0). 읽기 shim 1개 + eval 픽스처 1개로 창업자 본인 데이터만 안전하게 잇는다 — 누구도 데이터를 잃지 않는다.**

---

## 4. 코드 재활용 지도

기존 파일/함수 → reuse / adapt / rewrite. (재활용 리뷰어 표를 채택·정리.)

| 파일 / 함수 | 판정 | 노트 |
|---|---|---|
| `lib/atomic-write.ts` (`atomicWriteJson`) | **REUSE** | tmp+rename+round-trip 검증 이미 정확. 영수증/세션/bearing 다 이 위에. 변경 0. |
| `lib/deBom.ts` (`deBom`) | **REUSE** | BOM strip. ledger-replay 의존. 유지. |
| `lib/locale.ts` (`detectLocale`) | **REUSE** | §2.6/m1이 원하는 것 그대로(`auto` enum 제거). config.ts 이미 호출. 포팅 불필요. |
| `lib/ledger-replay.ts` (`replayLedger`) | **ADAPT (B1 패치)** | fold 루프+overdue 계산 통째 재사용. B1/B3 = `seal`/`settle` 케이스의 `if(cur)`(75·92줄)를 `if(!cur) create`로 — **3줄 변경**. `harvest` 케이스(71줄)는 이미 candidate 생성 → open→harvest 영속은 *이미 있음*. 청사진이 시사하는 것보다 훨씬 작음. |
| `lib/ledger-replay.ts` (`bearingContracts`) | **ADAPT (경로안전)** | seed 수집 로직 재사용. 141-148줄 `readdirSync` 결과가 raw `path.join`으로 흐름 → `id`/`label` 루프변수를 `safeSegment` 래핑(M5). 로직은 그대로. |
| `lib/ledger-replay.ts` (`localToday`, `asDate`) | **ADAPT** | `asDate` 그대로. `localToday` → `resolveToday(tz, override)` 재작성(N/M4 사이트, Intl/UTC 포매터). |
| `lib/layout.ts` (전 헬퍼) | **ADAPT** | 순수 `path.join` 빌더 → 각 segment를 `safeSegment` 경유 후 join. 함수 모양 유지. |
| `tools/receipt.ts` (`argus_receipt_write/read`, `Receipt`) | **EXTEND** | merge-on-patch(seal-time→settle-time) = §2.3 영수증 라이프사이클 그대로 재사용. **§2-C의 4필드 + `outcome`/`outcome_source`/`ai_verdict:null`(리터럴)/`basis`/`assumption_held` 확장.** `label` 인자 드롭(고정 `current`). **단 E(RMW 레이스): merge 대신 replay 투영으로.** |
| `tools/ledger.ts` (`argus_ledger_append`) | **REUSE (내부)** | O_APPEND atomic append + parse-back 검증 견고. `argus_seal`/`argus_settle`이 내부 호출(도구로 노출 안 함, 래핑). |
| `tools/config.ts` (`argus_init`, `argus_config_*`) | **REUSE/light-adapt** | `argus_init`(sessions/ledger/config mkdir + gitignore) = §2.6 init 그대로. **A2의 `.bound` 마커 쓰기 + M의 온보딩 surface 추가.** N2의 atomic 머지. |
| `tools/session.ts` (`argus_session_create`의 gitignore 부수효과) | **REUSE** | 36-44줄이 `sessions/`+`ledger/`를 `.argus/.gitignore`에 append = SECURITY.md "private decisions gitignored" 보증. `argus_open_decision` 붕괴 시 보존. |
| `tools/session.ts` (`argus_session_update` status 쓰기) | **REWRITE (삭제)** | `session_update no-op` 근원(쓰기가능 status를 replay가 덮음). §3.2대로 삭제. 비-스파인 필드 패치만 유지. |
| `tools/session.ts` (`quarantine`) | **REUSE** | 좋은 방어 패턴. N3대로 새 읽기경로(replay/영수증)에도 이식. |
| `prompts/system-prompt.ts` (`SYSTEM_PROMPT`) | **REWRITE** | 현재 "team analysis/clarify/offer to seal" = pre-spine. §3.6 `discipline.ts` 단일소스로. `argus_dir`/`project_root` 치환 헬퍼(32-37줄, Windows `\.argus` strip 포함)는 재사용. |
| `tools/types.ts` (`ok`, `err`, `ToolResult`) | **REUSE/extend** | `ArgusEnvelope`로 확장(`next_actions`/`surface`/`over_fire_gate`). I의 `structuredContent`+text 미러 여기서. |
| webapp `reframe-core.ts` | **DO NOT port (reference only)** | CLAUDE.md = web+Telegram 공유 브레인, fork/reframe 방출. 스파인이 포크 금지(§3.3). 함수 import 금지 — *테제*(hidden-assumption 표면화)만 `discipline.ts` 산문으로(K). |
| webapp `recast-core.ts` | **DO NOT port** | CLAUDE.md = 의도적 별개 브레인, rich output. 스파인-모양 아님. SKIP. |
| **WRITE FRESH** | — | `resolve-contract.ts`(+D shim), `state-machine.ts`/`guard.ts`, `overfire-gate.ts`, `validate-seal.ts`, `safe-path.ts`, `spine.ts`(+G의 `serverInstructions`), `discipline.ts`, `render-receipt.ts`, 7 테스트 스위트, `evals/`. |

**창업자용 재활용 헤드라인:** §0이 BLOCKER라 부른 두 조각은 읽히는 것보다 *덜* 신축이다 — B1/B3 영속은 `ledger-replay.ts` ~3줄 반전(`harvest`가 이미 candidate 생성), B2 정체성 붕괴는 대부분 `session_id`/`label`/`contract_id` 분산을 *삭제*. 진짜 새 표면은 guard/gate/path/spine lib 5종 + 테스트 + evals. 저장 프리미티브(atomic-write·append·deBom·locale·layout·receipt-merge·gitignore)는 전부 재사용.

---

## 5. 수정된 실행 순서

SHOULD-ADD 중 단계 배치를 바꾸는 것만 반영. **v1 stop-line(단계 0+1)은 유지** — 추가분은 대부분 단계 0/1 안에 흡수되거나 Phase 2로 명시 연기.

### 단계 0 — 버그-픽스 바닥 (**선결, ~2일 → ~2.5일**, +0.5d)
- (원본 그대로) 정체성 통합·open→harvest 영속·status=replay 파생·today_override·경로안전·7 테스트·amend 가드·ajv 제거
- **+D: `resolveContract`에 `versions/*` back-compat 읽기 shim** (~10줄) + 옛-레이아웃 G-tier 픽스처
- **+E: 영수증을 replay 투영으로**(RMW 레이스 제거 — status 투영과 같은 패턴이라 거의 공짜)
- **+N(M4 두 콜사이트): `localToday`→`resolveToday` 재작성**, `argus_ledger_replay`+`argus_contracts_due` 둘 다
- **+N1: 스키마 `v:1`/`schema_version:1`** (지금 안 넣으면 다음 마이그가 sniff)
- **+N4: stderr-only 로깅 규칙 1줄**

### 단계 1 — 얇고-정직한 출하 (**~3~4일 → ~4~5일**, +1d)
- (원본 그대로) 6도구 바닥·config 정렬·diff 영수증·README hero·배지·SECURITY/LICENSE·demo.gif
- **+C: `argus_seal`에 영수증 4필드 입력**(가장 중요 — README hero가 빈칸이면 첫인상 붕괴)
- **+N7: `basis`를 영수증에**
- **+H: 6도구 annotations** + **+I: outputSchema/structuredContent+text 미러**(공짜 두 번째 벨트, 도구 정의할 때 같이)
- **+G: `instructions` 필드**(`spine.ts` 단일소스, 연결 시 1회 로드 — Resource보다 보편)
- **+A/B: `${CLAUDE_PROJECT_DIR}` 수정 + 호스트 config 매트릭스 + `.bound` 마커 + per-call dir 1차** (BLOCKER급 — 안 고치면 창업자 호스트서 귀환 루프 침묵 실패)
- **+F: 패키징 publish-ready**(engines/files/prepublishOnly/vitest/typecheck — 안 하면 `npx` 첫인상 바운스)
- **+M: `argus_init` 온보딩 surface**(빈 ledger일 때, 활성화 레버)
- **+N10/N11: SECURITY.md 위협모델(ledger 변조·Windows 심볼릭) + ajv 제거 + dep-tree 강제**
- **🛑 v1 stop. 창업자 dogfood로 실제 1행(1 seal + 1 settle) 도착 관찰.**

### 단계 2 — 강제된-브레인 (**점화 확인 후, ~3일 → ~3.5일**, +0.5d)
- (원본) Resources + Prompts + Tier2 eval + 레지스트리
- **+J: 페이즈별 capability 선언 + 4핸들러 등록**(명시 체크리스트 — 빠지면 자동주입 no-op)
- **+K: 3번째 Prompt `/argus-reframe`**(생성 반쪽 복원, `discipline.ts` 단일소스)
- **+L: `argus_open_decision`의 `related_to` + frequency statement**(n=1 연속성 — 점화 후라야 데이터 있음)
- **+N8/N9: dismiss 사유 enum + amend 이력 view**

### 단계 3 — 선택적 고급 (**측정이 요구할 때만**)
- (원본) Resource 구독·Elicitation·Sampling·다중루트·자정 푸시
- **+N6: ledger compaction/스냅샷** + **+N12: completion/`_meta`/페이지네이션**

**효과 델타 요약:** 단계0 +0.5d, 단계1 +1d, 단계2 +0.5d. v1(단계0+1) = ~7~8d. **stop-line 불변** — A/B/C/F가 BLOCKER급이라 단계1 안에 흡수되지, 단계를 새로 안 만든다.

---

## 6. 최종 점검 한 줄

**시공 준비 됨 — 단, 단계1에 BLOCKER급 4개(A `${CLAUDE_PROJECT_DIR}` / C 영수증 4필드 입력 / F 패키징 publish / B per-call dir 1차)를 흡수한 후.** 이것들은 "additive"가 아니라 **첫인상이 침묵 실패하는 구멍**이라 v1 안에 있어야 한다. 나머지 SHOULD-ADD(G·H·I·J·K·L·M·N)는 단계 배치만 정해졌고 stop-line을 안 옮긴다.

**창업자가 코드 전 결정할 단 하나의 열린 질문:**
> **back-compat shim(§3)을 넣을까, 아니면 본인 dogfood 데이터를 버리는 clean break로 갈까?**
> 권고 = **shim 넣기**(~10줄, §7 성공지표의 유일한 실재 행이 창업자 본인 데이터이므로). 하지만 "내 옛 dogfood는 어차피 미완성 실험이라 버려도 된다"면 clean break도 정당하다 — 실사용자 0이라 누구도 안 잃는다. **이 한 줄만 창업자가 답하면 코드 시작 가능.**
