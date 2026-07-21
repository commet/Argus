# 세션 인계 — 2026-07-21 (감지 개선 출시 직후)

> 이전 세션(원격, branch `claude/argus-detection-review-j3p5wk`)에서 진행한
> "대화 중 결정 감지" 재설계 + 야간 자기-진화 루프 + v1.6.0/2.12.0 출시의
> 인계 문서. 새 세션은 이 문서 하나로 전체 맥락을 복원할 수 있어야 한다.
> 참고: 직전 인계본은 `docs/DETECTION-RESEARCH-HANDOFF-2026-07-20.md` (리서치 단계).

## 1. 지금 상태 (스냅샷, 2026-07-21 04:55 UTC)

| 항목 | 상태 |
|---|---|
| PR #234 (감지 개선 전체) | **머지 완료** — merge commit `dafc6b38`, main 반영 |
| 플러그인 2.12.0 | **출시 완료** — marketplace가 main 참조, `/plugin update argus`로 전파 |
| MCP 1.6.0 태그 | `v1.6.0` 푸시 완료, 정확히 `dafc6b38`에 찍힘 |
| **publish-mcp 워크플로** | ⚠️ **미결** — run `29802147731`이 러너 기동 실패(잡이 시작 못 하고 4초 만에 failure), 재실행 걸어둠(현재 queued). npm은 아직 1.5.0 |
| 로컬/원격 작업 브랜치 | `claude/argus-detection-review-j3p5wk` = origin/main에서 재시작됨 (머지된 PR에 새 커밋 금지 규칙 적용됨) |

### 새 세션이 가장 먼저 할 일 (미결 1건)

1. run `29802147731` (publish-mcp.yml, ref v1.6.0) 결과 확인:
   - 성공 → `npm view argus-decision-mcp version`이 1.6.0인지 + MCP 레지스트리 등록 확인 → 창업자에게 출시 완료 보고.
   - 또 러너 기동 실패 → 재실행 1회 더. 계속 실패하면 `workflow_dispatch`로 main에서 트리거해도 동일 (워크플로가 checkout된 ref의 package.json 버전을 읽고, 이미 npm에 있는 버전은 스킵하므로 안전).
2. 확인 SQL 아님, 확인 명령: `npm view argus-decision-mcp version` → `1.6.0`이면 끝.

## 2. 이번 사이클에서 만든 것 (인덱스)

### 감지 코어 (플러그인)
- `argus-plugin-v2/scripts/sense-signal.js` — UserPromptSubmit 훅. 3감각 진단 주입(①예측 포착 ②정산 감지+열린 예측 목록 ③숨은 전제), 슬라이딩 윈도 캡(2h당 3회, 세션 최대 12, 정산 캡 8), 제안은 결정당 1회, 늦은-발사 금지.
- `argus-plugin-v2/scripts/lib/decision-signals.js` — `prefilterTurn()`(사전필터, PROPOSAL 그룹 포함 disjunction), `lastAssistantText()`. `src/lib/detect-signals.ts`와 드리프트 가드로 미러.

### 감지 코어 (MCP)
- `argus-mcp/src/lib/spine.ts` — `SERVER_INSTRUCTIONS`(3감각+절제+늦은발사 금지+단일절 capture), `STANDING_SENSE_REFRESH`(툴 결과에 재주입되는 배경감각 한 줄).
- `argus-mcp/src/tools/public-tools.ts` — 구조 라이더 `attachOpenPredictions()`: 모든 공개 툴 결과에 열린 예측(상위 10)+standing_sense 동봉. **라이더 내부에서 `sanitizeOutput` 적용** (신뢰 경계 — 이 순서 바꾸면 보안 구멍).

### 측정·자기-진화 (evals)
- `argus-plugin-v2/evals/detection/corpus.mjs` — 라벨 코퍼스 31케이스.
- `.../measure.test.mjs` — skip-safety 100% CI 하드게이트.
- `.../mcp-firing-sim.mjs` — MCP 자율발동 시뮬 (실측: 78.3% 발동, 과발화 0/8).
- `.../transcript-recall.mjs` — 실세션 end-to-end recall (raw는 gitignore — 개인 대화).
- `.../auto-detect-eval.mjs` — 3역할 자기-진화 루프: 생성기(시나리오+planted 정답 매니페스트) → 감지기(실제 메커니즘, mcp/plugin A/B) → 판정기(judgeHidden/judgeSpine/judgeUserSim 적대적). 페이싱 `AUTO_MIN_DELAY_MS`, GENERATOR_HEALTH 라우드 실패.
- `.../frozen-bench.test.mjs` + `frozen-bench-baseline.json` — 회귀 래칫(TOL=2, 빈 run은 인프라 실패로 간주하고 스킵 — 회귀 오판 금지).
- `.../EVOLUTION-LOG.md` — R1~R9 진화 기록 (무엇을 왜 고쳤는지 전부 여기).
- `.github/workflows/auto-detect-eval.yml` — nightly 07:00 UTC + dispatch. `secrets.ANTHROPIC_API_KEY` 사용.

### 버전 정본 (2곳씩 — 드리프트 주의)
- MCP **1.6.0**: `argus-mcp/package.json` + `package-lock.json` + `server.json`(2곳).
- 플러그인 **2.12.0**: `argus-plugin-v2/.claude-plugin/plugin.json` + 루트 `.claude-plugin/marketplace.json`.
- CHANGELOG 두 곳 모두 항목 완료.

## 3. R1~R9에서 확정된 교훈 (재발 방지 요약)

- **자가채점 금지**: 세션 모델이 자기 감지를 채점하면 과발화가 숨는다. 생성기/감지기/판정기 3역할 분리가 정본.
- **늦은 발사 = 짜증의 주범**: 짜증 판정 14~18%가 전부 "신호가 지나간 뒤 발사" 패턴 → 규칙 3곳(sense-signal, SERVER_INSTRUCTIONS, STANDING_SENSE_REFRESH)에 "신호가 나타난 그 턴에, 지나갔으면 침묵" 명문화.
- **전제 쌓기 = 스파인 위반**: capture 제안은 "정확히 한 전제, 한 절" (실질 위반 1건의 수리).
- **judgeSpine max_tokens 500**: 200이면 한국어 사유가 절단돼 unparseable 폭주.
- **빈 run ≠ 회귀**: rate-limit로 시나리오 0개면 래칫 스킵 (인프라 실패를 품질 회귀로 오판 금지).
- **래칫 TOL=2**: 실API 요동으로 ±1은 정상.

## 4. 자동화 상태 (새 세션에서 이어받을 것)

- **nightly eval**: `.github/workflows/auto-detect-eval.yml`이 매일 07:00 UTC 자동 실행. 결과 아티팩트 업로드. 실패/회귀 시 EVOLUTION-LOG에 라운드 추가하고 수리하는 것이 루프의 본체.
- **시간별 하트비트 cron**: trigger id `trig_01LLSZCnKP1yAN1toptLY5xZ` (이전 원격 세션에 바인딩). **새 세션에서는 이 트리거가 옛 세션을 깨우므로, 필요 없으면 `delete_trigger`로 정리하거나 새 세션에 재바인딩할 것.**
- 루프 재개 명령: `node argus-plugin-v2/evals/detection/auto-detect-eval.mjs` (env: `ANTHROPIC_API_KEY`, `AUTO_MIN_DELAY_MS=1500` 권장, 동시성 1).

## 5. 남은 로드맵 (창업자 확정 방향)

1. **도그푸딩 며칠** → `transcript-recall.mjs`로 실사용 recall 최종 확증 (합성 eval의 알려진 한계: tool result를 대화에 되돌리지 않아 MCP 정산 라이더 효과는 하네스로 측정 불가 — 실사용에서만 검증됨).
2. 도그푸딩 중 발견 → EVOLUTION-LOG 라운드 추가 → 수리 → frozen-bench 래칫 통과 → 버전 범프(패치) 반복.
3. 캡 튜닝: 슬라이딩 윈도(2h당 3회)는 긴 세션 고려로 재설계된 값 — 도그푸딩에서 체감 짜증/누락으로 재조정.

## 6. 불변 규칙 리마인더 (이 트랙에서 걸렸던 것만)

- 머지된 PR에 새 커밋 금지 — 브랜치를 origin/main에서 재시작하고 새 PR.
- PR 본문 첫 줄: `공정 N · 겨냥 퍼널 단계 X→Y` (이 트랙은 "공정 O4 대기 · 겨냥 퍼널 단계 유지(대화 중 감지)" 사용).
- 앵커 테스트 전수 초록만 커밋. em-dash 린트(한글 인라인) 주의.
- transcript-recall raw(개인 대화 스니펫)는 절대 커밋/PR 금지 (gitignore 됨).
- API 키는 repo secret으로만. **2026-07-20 채팅에 실키가 노출된 적 있어 rotate 권고된 상태** — 새 세션에서 창업자에게 rotate 완료 여부 확인.
- `attachOpenPredictions`의 `sanitizeOutput`은 신뢰 경계 — 제거/순서 변경 금지.

## 7. 이 문서의 소비법

새 세션 시작 시: §1 미결 1건 처리 → §4 트리거 정리 → §5 로드맵 순서로.
과거 "왜"가 필요하면 `EVOLUTION-LOG.md`, 리서치 근거가 필요하면
`DETECTION-RESEARCH-HANDOFF-2026-07-20.md`.
