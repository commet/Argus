# 해결안 — webapp/plugin 드리프트 · 확정 버그 · 모니터 다리 (R1~11 → 실행)

> Date: 2026-06-17
> 입력: solve 워크플로(진단 3 + 다양한 해법 4 + 판정 2 + 종합 1). webapp↔plugin 동시 출시 전제. 트랙 1(드리프트 닫기)·2(모니터 다리)·3(라운드 계속)를 *연구에서 실행으로* 옮긴 첫 수.
> 한 줄: **이 세션에 저위험·코드확인 버그 3개를 실제로 고치고 테스트를 박았다(8 pass, 기존 94 pass 유지). med/high 위험 4개(bearing 다단계·falsifiability 게이트·crisis 분류기·드리프트 포팅)는 *blind 적용 금지* — 거친 proxy가 zero-judgment 미러절을 위반하거나 결정 기록을 조용히 떨굴 수 있어 founder 사인오프로 묶었다. shared-core는 "Stage 0: webapp에 v2.6 판단 포팅 먼저"가 결론.**

---

## 0. 이 세션에 *실제로 고친 것* (저위험·코드확인, 테스트 포함)

| 수정 | 파일 | 내용 | 테스트 |
|---|---|---|---|
| 삭제 누락 | `src/lib/db.ts` | `deleteAllUserData`에 `synthesize_items` 추가 → "영구삭제"가 실제 전 테이블 삭제. 모니터 다리의 *삭제-신뢰 전제*도 동시 해소 | 기존 db 테스트 유지 |
| 트로피 진열장 | `src/lib/decision-contract.ts` | `CrossProjectRecord`에 `betsBroke`·`risksHappened` 추가 + `summarizeRecord` 집계 → 기록이 *손실도* 보임(반증 가능). in-memory 파생이라 마이그레이션 0 | `summarizeRecord` shape 가드 |
| 인젝션 방어 | `src/lib/persona-prompt.ts` | `sanitizeForPrompt`에 *자연어 인젝션*(EN "ignore all previous instructions", KO "위 지시 다 무시하고") anchored 패턴 추가. 영어 토큰만 막던 약점 보강 | **false-positive 가드 포함** — '시스템 기획자, 지시받는 걸 싫어함' 등 정상 한국어/영어 prose는 *안* 깎임(8 tests pass) |

검증: `npx vitest run` — 변경 3파일 영향권 5파일 94 pass, 신규 8 pass. 마이그레이션·UI 파괴 없음. (CrossProjectRecord 5필드 UI 렌더는 작은 follow-on.)

## 1. 드리프트 진단 — webapp에 *없는* 판단 게이트 (plugin v2.6엔 있음)
`frame_status`가 `src/`에 **전무**(grep 확인). webapp이 빠뜨린 4개:
1. **step-0 request-type 게이트**(open/validation/vent/info) — 없어서 *닫힌 결정을 crew가 재개방*.
2. **frame_status(flat/load_bearing)** — 없어서 *평탄 결정 ~60%에 probe/crew 발화*(검증된 over-fire harm).
3. **low-density 쇼트서킷** — 없어서 *가역 결정 과잉설계*.
4. **Current Bearing 상태 범위** — proceed/collect_evidence만, hold/fork/anchor 못 냄.

→ 포팅 액션은 기계적·고립적·독립 구현 가능. **단 parity로 *먼저 잠그면* 어긋난 둘을 동결할 뿐이라, 포팅이 shared-core보다 선행해야 함(Stage 0).**

## 2. 확정 버그 6 — 3 고침 / 3 사인오프 대기
- ✅ 고침: synthesize_items 삭제 · CrossProjectRecord 손실 · sanitizeForPrompt 자연어.
- ⏸ **blind 금지(드리프트 포팅에 흡수 + 사인오프):**
  - **CourseStatus 다단계**(hold/fork/anchor 활성화) — 진단의 "challenge 길이→fork" proxy는 *fork 제조 = 미러절 위반* 위험. 진짜 2-pole load-bearing 발산에서만, parity 렌더(엔진 가중 폴 금지)로.
  - **§0 falsifiability 게이트** — regex `isFalsifiable`는 *정당한 결정 sealing을 조용히 거부*할 위험. strictness가 founder 콜.
  - **crisis 분류기**(high) — 게이트 동작(hard-block vs 2차검토 vs warn-with-override)이 spine 콜. (R11: 현재 substrate 반사가 위기 14/14 막으나 defense-in-depth 0.)

## 3. shared-core 결정 (재드리프트 방지)
**우승: 단일 `data/` 디렉터리(plugin-owned) + webapp이 import + content-type별 parity 테스트.** 단계:
- **Stage 0(선행, 필수):** webapp에 v2.6 판단 포팅(frame_status, 2단 under-fire 게이트, leverage-ranking). *어긋난 둘을 parity로 잠그기 전에 정렬.*
- **Stage 1(지금, CI 차단):** `MAX_PROBE_QUESTIONS`(현재 `fork-to-question.ts:26` 인라인)·enums(CourseStatus/frame_status)·verdict-free 카피·over-fire/금지 목록·draft-07 스키마를 `argus-plugin-v2/data/`로 → webapp import(resolveJsonModule 이미 on) + "validates + 실제 import됨 + 값 동일" 가드 테스트. **동시에** R5~R8 케이스를 `judgment-fixtures.json`으로 증류해 *실제 결정 게이트*(enforceForks→cap→contract empty-predicate)에 통과시키는 vitest PR 게이트 + ci.yml에 plugin `simulate-plugin` shape-lint 추가(현재 CI는 eslint+vitest뿐).
- **Stage 2(점진):** probe-prompts.ts 쌍둥이를 `gen:check` 코드젠으로, byte-parity 테스트를 stale-artifact 체크로 승격.
- **Stage 3(릴리스 의례, PR마다 아님):** divergence band에 cross-surface blind 패널(= R12 literal-pipeline run).
- **Approach 4(공유 판단 서비스/thin-client) 기각** — plugin 오프라인·repo-native를 죽임. 단 *calibration-oracle* carve-out만 미래 인증/유료 plugin용으로 보류.

## 4. 모니터 다리 (plugin 런을 webapp에서, 같은 계정)
- **v1 = 파일 import/업로드**(git-bridge보다 우선; plugin 무수정, repo `.argus/`를 webapp이 읽음, 비실시간).
- **v2 = opt-in live push**(device token = 같은 계정 신원).
- **전제(먼저):** (a) 삭제-신뢰 — *이번에 synthesize_items 수정으로 1보 전진*, soft-delete 잔여 점검 남음; (b) 스키마 단일화(Stage 1); (c) 명시 opt-in·고지.
- **전략 가치:** 쪼개진 n=1 moat(plugin=repo, webapp=계정)를 한 계정 히스토리로 합쳐 moat 실재화. *히스토리를 합치지 판단을 합치진 않음 → parity와 보완재.*

## 5. 순서화된 실행 계획
1. ✅ 저위험 버그 3개(이번 세션, 완료).
2. **Stage 0 포팅**(frame_status/request_type/decision_density + 2단 under-fire 게이트) — *출시 차단 항목.* 사인오프 필요(아래 §6).
3. CourseStatus fork-parity + §0 sealing 로직(사인오프) → med 버그 2개 흡수.
4. Stage 1 단일-소스 데이터 + 차단 parity CI.
5. crisis 게이트(사인오프) — 동작 결정 후.
6. 삭제-신뢰 마무리(soft-delete) → 모니터 다리 v1(파일 import).
7. R12 literal-pipeline run = Stage 3 cross-surface 패널 겸 settle 재측정.
8. v2 live push + 한 계정 히스토리(출시 후).

## 6. founder 결정 대기 (6개 — spine/출시 차단)
1. **over-fire 절제 정책**(flat/low-density 디폴트: ≤1 전제 명명 + 핸들 반환, 가중 2-pole 금지; low-density는 directive 예외 1곳). *미러절 콜.*
2. **계약 sealing strictness** — routine+reversible+high-conf는 무계약(단일 체크) vs soft-flag seal? (너무 strict=기록 누락, 너무 loose=모호한 베팅.)
3. **crisis 게이트 동작** — hard-block vs 2차검토 vs warn-with-override(VerificationGate 철학) + 그 자체가 over-fire 안 되게.
4. **CourseStatus fork 방출 규칙** — 진짜 2-pole load-bearing에서만, parity 렌더(challenge-length 휴리스틱 폐기).
5. **모니터 신원·프라이버시** — device token 발급, 계정 바인딩(git email vs 명시 로그인), opt-in 기제, web-prefers-web 머지, MVP는 flatten-versions(option A).
6. **기각 재확인** — git-bridge transport 스킵; thin-client(Approach 4) 주력 기각, calibration-oracle만 미래 유료용 보류.
