# Argus 보강 실행 계획 — 앞문 보완 + 5대 공백 (2026-06-23)

> **맥락.** 생태계 벤치마크(`docs/MARKET-RESEARCH-ecosystem-vs-argus-2026-06-23.md`)에서 나온
> "Argus가 갖췄어야 하는데 못 갖춘 것"을 실행 계획으로 옮긴 문서. 앞문 수리(귀환 루프)는
> **다른 세션이 UIUX 감사 로드맵 §2.1 North-Star A~D로 진행 중** → 여기서는 **충돌 없이 보완할
> 부분**만 잡고, 나머지 5대 공백의 세부 계획을 세운다. 사용자는 비개발자 → 각 항목은 *왜 / 지금
> 있는 것 / 할 일 / 닿는 파일·충돌안전 / 노력·의존성 / 완료기준* 6칸으로.

## 충돌 회피 원칙 (모든 작업 공통)

다른 세션이 편집 중인 파일은 **건드리지 않는다.** (UIUX 로드맵 §0.3 + North-Star A~D 범위)

- **North-Star A~D가 만지는 앱 UI:** `Header.tsx`, `LayoutShell.tsx`, `public-paths.ts`,
  `app/[locale]/workspace/page.tsx`, `SealMoment.tsx`, `ProgressiveFlow.tsx`,
  `SynthesizeStep.tsx`, boss verdict 경로, `lib/decision-contract.ts`.
- **다른 활성 세션:** `api/email/**`, `api/telegram/**`, `lib/email-html.ts`,
  `lib/share-guard.ts`, `lib/telegram-*.ts`, `ShareBar.tsx`, **i18n locale 메시지 파일**.
- → 내 작업은 **플러그인(`argus-plugin-v2/`), 스크립트/CI(`scripts/`, `.github/`), 문서,
  읽기전용 analytics/admin, 프롬프트-위생 lib** 중심으로만. 앱 UI 공유 파일은 *읽기만*.

---

## 0. 앞문 수리 — 보완 (충돌 없이)

**판단: A~D는 UI 루프로는 거의 완전하다.** 진짜로 *빠진* 건 UI가 아니라 두 가지 — 둘 다
다른 세션 파일을 안 건드린다.

### 0-1. "루프가 실제로 닫혔나"를 보는 계측 (최우선 보완)
- **왜.** A~D는 루프를 *고치지만*, 고쳐졌는지는 **숫자로 보이지 않으면 모른다.** finishline
  진단의 결론이 정확히 "실제 한 행(sealed contract)을 관찰하라"였다. UI를 고쳐도 founder가
  "seal→return→settle 중 어디서 사람이 빠지는가"를 못 보면 다음 수를 못 정한다.
- **지금 있는 것.** launch instrumentation(e85c85e)이 seal/settle→`user_events`를 이미 기록.
  `/admin` 대시보드(5544de2) 존재. → **데이터는 들어오는데 *깔때기로 보는 화면*이 없음.**
- **할 일.**
  1. `user_events`에서 **seal→return(due strip 노출)→settle** 3단계 깔때기 카운트 쿼리(SQL view
     또는 `/admin`의 읽기 패널). 익명/로그인 코호트 분리.
  2. "오늘 새로 sealed N / due 도래 N / 실제 settle N / held·broke 분해" 한 줄.
  3. 누락 이벤트가 있으면(예: "due strip 노출" 이벤트 부재) **그 이벤트만** 추가(분석 레이어,
     UI 로직 불변).
- **닿는 파일·충돌안전.** `app/[locale]/admin/**`(읽기), `lib/analytics*`, Supabase view.
  **A~D 파일 0개.** 완전 안전.
- **노력·의존성.** 0.5~1일. A의 "due strip"이 붙은 뒤 그 이벤트를 읽으면 더 정확(느슨한 의존).
- **완료기준.** founder가 한 화면에서 "실제 settle 1건"이 0→1 되는 순간을 볼 수 있다.

### 0-2. 익명 seal이 가입 후에도 살아남는지 (데이터 연속성)
- **왜.** 익명 사용자가 봉인한 `decision_contract`는 휘발성 localStorage에만 있음(감사 Theme5).
  로그인 시 그게 계정으로 안 옮겨가면 **해자가 가입 순간 증발**한다.
- **지금 있는 것.** eager local→account 마이그레이션(0947558)이 *프로젝트*엔 있음.
  `decision_contract`는 project의 필드이므로 같이 옮겨갈 *가능성*이 큼 — **확인 필요, 단정 금지.**
- **할 일.** (a) 마이그레이션이 `decision_contract` 필드를 포함하는지 *읽어서 검증* →
  (b) 누락 시 마이그레이션 함수에만 필드 추가(스토어 레이어, UI 불변) → (c) `schema-drift.test`에
  연속성 가드 1줄.
- **닿는 파일·충돌안전.** `stores/*Store.ts` 마이그레이션 함수, `lib/db.ts`. **A~D는 SealMoment의
  *링크*만 바꾸지 마이그레이션 로직은 안 만짐** → 안전. 단 작업 전 `git fetch`로 충돌 재확인.
- **노력·의존성.** 0.5일. 독립.
- **완료기준.** 익명으로 봉인 → 로그인 → 같은 계약이 계정에 그대로 보인다(테스트로 고정).

---

## 1. 품질 보증 — 행동 eval 하니스 (Superpowers-evals + wshobson 3단계)

- **왜.** "규칙을 썼다" ↔ "규칙이 실제 발화한다" 사이가 비어 있음. 지금 검증은 *자기 채점/시뮬*
  (R29/R51 수동 스트레스). 압박 하 규칙은 무시됨(Superpowers #528, Argus R29 25~44% 실패).
- **지금 있는 것.** `scripts/simulate-plugin.js`, `validate-boss.ts`, `validate-progressive.ts`,
  `test-check-contracts.mjs`, `decision-watch-eval/`, 웹앱 테스트 95개. → **개별 검증기는 있으나
  "적대적 케이스 코퍼스 × 점수화된 게이트 발화 측정"이 없음.**
- **할 일 (3단계, 계층화).**
  1. **케이스 코퍼스를 데이터로.** 과거 STRESS 라운드(R5~R59)의 케이스를 `evals/cases/*.json`
     으로 추출: 입력 + 기대 라벨(should-fire / should-stay-silent / crisis / flat …).
  2. **static 게이트(싸다).** 정규식/구조 검사 — 금지 패턴(two-pole fork, 평결문, disclaimed
     lean)이 출력에 있나. CI에서 매 PR 실행.
  3. **LLM-judge(중간).** 모델 심판이 출력을 라벨과 대조해 채점(over-fire/under-fire/spine 위반).
  4. **반복 실행(비싸다, 야간/주간).** flat 케이스를 N회 돌려 over-fire 비율을 *숫자로* 산출 —
     "flat 60% over-fire" 같은 회귀를 자동 감지.
  5. 점수를 `evals/report.json` + README 배지로. 한 번에 다 말고 **C1(crisis)·over-fire부터**.
- **닿는 파일·충돌안전.** 신규 `evals/`, `scripts/`, `.github/workflows/`. 기존 `validate-*.ts`
  재사용. **앱 UI 0개** → 안전.
- **노력·의존성.** 2~4일(코퍼스 추출이 대부분). 독립. 이후 모든 작업의 안전망이 됨.
- **완료기준.** 규칙 1줄 고치면 `npm run eval`이 over-fire/spine 회귀를 점수로 잡아낸다.

## 2. 유지보수 — drift 탐지를 "단일 소스 생성"으로 승격 (wshobson `make generate-all`)

- **왜.** webapp(TS) + plugin(markdown) 두 몸, 공유 런타임 없음 → 규칙 고치면 두 곳 손수.
- **지금 있는 것 (중요).** **이미 drift *탐지* 가드가 있음**: parity 테스트 4종 + `schema-drift`
  + PARITY-MAP. 즉 어긋나면 CI가 *잡는다*. 없는 건 *예방* — 한 곳에서 양쪽을 *생성*.
- **할 일.**
  1. 손으로 양쪽에 중복되는 규칙 집합을 식별(crisis taxonomy, decision-states, course-status,
     probe-prompts — 이미 parity 테스트가 가리키는 바로 그것들).
  2. 그것들을 **단일 소스 데이터 파일**(`shared/contracts/*.json` 또는 yaml)로 추출.
  3. **생성기 스크립트**: 그 데이터 → webapp TS 상수 + plugin markdown 양쪽으로 컴파일
     (`scripts/generate-contracts.js`, wshobson `make generate-all` 모방).
  4. 기존 parity 테스트를 "생성물이 소스와 일치하는가"(=`make garden`) 가드로 전환.
- **닿는 파일·충돌안전.** 신규 `shared/`, `scripts/generate-*.js`. 생성 결과가 닿는 TS 상수가
  앱 UI 공유 파일이면 **그 부분만 다른 세션 종료 후 적용**(지금은 생성기·소스까지만 준비).
- **노력·의존성.** 2~3일. 부분적으로 다른 세션과 파일 겹칠 수 있어 **순서 뒤로**.
- **완료기준.** 공유 규칙을 한 파일에서 고치면 `npm run generate` 후 양쪽이 자동 일치.

## 3. 강제력 — 프로즈 규칙을 아키텍처 게이트로 (Superpowers #528)

- **왜.** *절대 건너뛰면 안 되는* 것(verify gate, route-contract, crisis-gate)이 지금은 "글로
  부탁". 압박 하 모델은 건너뛰고 위반을 인정함. → 잠금장치로.
- **지금 있는 것.** `argus-plugin-v2/hooks/hooks.json`(reminder hook 채널 존재),
  `check-contracts.js`, `validate-*.ts`. → **채널은 있는데 *차단형 게이트*로 안 씀.**
- **할 일.**
  1. 건너뛰면 안 되는 게이트 목록 확정: ①verify(미검증 critical 주장이 bearing으로) ②crisis
     off-ramp ③route-contract(over-fire된 plan).
  2. 각 게이트를 **PostToolUse / Stop hook 또는 validator**로: 산출물(세션 JSON)을 검사해
     게이트 미통과면 **진행 차단 + 사유 반환**(프로즈 지시가 아니라 실패).
  3. 웹앱은 동형으로 **런타임 가드**(이미 일부: route-contract 빈칸 처리) 강화.
  4. §1 eval로 "압박 시뮬에서 게이트가 실제 발화하나" 회귀 측정.
- **닿는 파일·충돌안전.** `argus-plugin-v2/hooks/`, `scripts/validate-*`, 웹앱은 **boss/progressive
  엔진 가드**(단, North-Star가 boss/Falsification 손보는 중 → 웹앱 부분은 그 세션 후).
  플러그인 부분은 즉시 안전.
- **노력·의존성.** 2~3일. §1(eval)이 먼저 있으면 검증이 쉬움.
- **완료기준.** 미검증 critical 주장이 있으면 bearing이 *물리적으로* 생성 안 된다(테스트로 증명).

## 4. 유통·발견 — 등재 + 설치 신뢰성 (awesome-claude-code)

- **왜.** 앞문을 고쳐도 *주소를 아무도 모름.* 조사에서 awesome-claude-code(47k★)가 "Argus가
  발견될 레이어"로 지목. Argus는 포장(marketplace.json v2.6)은 됐으나 **등재 0.**
- **지금 있는 것.** `.claude-plugin/marketplace.json`(잘 작성됨), README(ko/en),
  CHANGELOG, BUILD_STATUS.
- **할 일.**
  1. **클린 머신 설치 검증**: 빈 환경에서 marketplace add → `/argus:setup` → `doctor`까지
     실제로 도는지(스크린샷). 깨지면 그것부터 수리(설치 신뢰성 = 1차 진입).
  2. **버전드 릴리스**: mutable-main 대신 `v2.6.0` git tag + GitHub Release(wshobson 비판 반영:
     "버전 없는 main = 신뢰/재현성 구멍").
  3. **등재 PR**: awesome-claude-code 등 큐레이션 목록에 한 줄 등재 PR. *정직한* 한 줄 설명
     (과장 금지 — Git의 "reference 수준" 규율).
  4. README 상단에 30초 "이게 뭐고 왜"(조사: 좋은 도구는 docs로 채택을 만든다).
- **닿는 파일·충돌안전.** `.claude-plugin/`, `argus-plugin-v2/README*`, git tag, 외부 PR.
  **앱 0개** → 완전 안전.
- **노력·의존성.** 1~2일. 독립. 단 §5(신뢰 선언)와 묶으면 등재 품질↑.
- **완료기준.** 빈 머신에서 한 줄로 설치되고, 최소 1개 공개 목록에 등재 PR이 올라간다.

## 5. 신뢰·보안 하드닝 — 적대적 입력 + 정직한 위협 모델 (toxic-flow / ContextCrush 교훈)

- **왜.** Argus는 신뢰 못 할 외부 내용(PR/문서/repo/문서추출)을 읽어 프롬프트·boss 역할극에
  주입 → 조사의 #1 아키텍처 위험(toxic-flow) 모양. 주입된 문서가 crew/boss를 조종할 수 있음.
- **지금 있는 것.** `sanitizeForPrompt()` + `<user-data>` 래핑(persona-prompt), backend audit
  (b08b384)에서 prompt-sanitizer는 **deferred(미적용)**으로 남음.
- **할 일.**
  1. **신뢰 경계 명문화**: 외부 콘텐츠(PR/문서/repo)는 *데이터*지 *지시*가 아님 — 모든 주입
     지점에서 `sanitizeForPrompt` + 출처 태그를 *강제*(backend audit의 deferred 항목 완료).
  2. **plugin 문서 추출 경로**(unzip pptx/docx) 입력을 동일 위생 통과.
  3. **boss 조종 테스트**: 주입 문구가 verdict를 뒤집는지 §1 eval에 적대 케이스로 추가.
  4. **정직한 위협 모델 README**: "Argus는 외부 입력을 신뢰하지 않는다 / 이건 reference 수준 /
     익명 seal은 휘발성"을 Supabase·Git README처럼 *명시*(마케팅 "우린 판단 안 함" 대신).
- **닿는 파일·충돌안전.** `lib/sanitize*`, `persona-prompt.ts`, `argus-plugin-v2/skills/*`(주입
  지점), README. **boss UI 자체는 안 만짐**(North-Star가 작업 중) — 위생 lib + 스킬 프롬프트 +
  문서만. 안전.
- **노력·의존성.** 2~3일. §1(eval) 적대 케이스와 함께면 효율적.
- **완료기준.** 주입된 "무시하고 승인해줘" 류가 §1 eval에서 verdict를 못 뒤집는다 + 위협 모델
  README 존재.

---

## 추천 실행 순서 (충돌·레버리지·비개발자 가시성 기준)

| 순서 | 항목 | 이유 | 충돌위험 |
|---|---|---|---|
| 1 | **0-1 닫힌 루프 계측** | finishline 목표("실제 1행 관찰") 직결, 즉시 가시, 0충돌 | 없음 |
| 2 | **1 eval 하니스** | 이후 3·5의 안전망, 수동 스트레스 자동화 | 없음 |
| 3 | **4 유통·발견** | 앞문 고친 효과가 사람으로 연결, 0충돌, 빠름 | 없음 |
| 4 | **5 신뢰·보안** | eval 위에 적대 케이스로 검증, 위협모델 문서 | 낮음(lib/문서) |
| 5 | **3 강제력(플러그인분)** | eval로 검증 가능해진 뒤 | 낮음 |
| 6 | **0-2 연속성 / 2 단일소스 / 3·5 웹앱분** | **다른 세션 종료 후** (앱 UI 겹침) | 중간 → 대기 |

> 원칙: 0충돌·고레버리지·눈에 보이는 것 먼저. 앱 UI를 공유하는 부분은 North-Star 세션이
> 끝난 뒤로 미뤄 두 번 일/충돌을 막는다.
