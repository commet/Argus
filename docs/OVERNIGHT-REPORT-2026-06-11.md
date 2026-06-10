# 야간 작업 보고 — 2026-06-11

> 전제: `docs/PIVOT-presence-not-place.md` (전날 세션의 결론). 지시: "토큰을 불태워 Argus를
> 개선하거나 대체할 수 있는 새 도구를 만들 것."
> 결과물: **argus-watch** — 결정을 입력받는 앱이 아니라, 이미 일어난 대화에서 결정을 알아보는 눈.

## 한눈에

| 단계 | 결과 |
|---|---|
| P-A 게이트 백테스트 | **통과 — precision 94.9%** (기준 80%), recall 84.9%. 실제 세션 47세그먼트, 에이전트 275개, 3중 리더 합의 GT |
| P-B 도구 구축 | `tools/argus-watch/` CLI 완성 (scan/seal/amend/dismiss/due/settle/ledger) + 적대 리뷰로 버그 7개 수정 |
| P-C 실데이터 수확 | 전 프로젝트 대화 구간 94개+6개 스캔 → 원장 생성 (아래 수치) |
| P-D 박제 | 코드·방법론 커밋+푸시 (개인 데이터는 전부 로컬 전용), `/watch` 스킬 추가 |

## 아침에 가장 먼저 — 내기 2의 정산

PIVOT §5 내기 2: *"수확된 원장을 본 창업자가 '내 결정들이 맞다 + 정산하고 싶다'는 반응이 아니면 형태 재고."*

```bash
node tools/argus-watch/cli.mjs list            # 당신의 지난 결정들 — 후보 전체
node tools/argus-watch/cli.mjs list --status sealed   # 시연으로 봉인해둔 1건
node tools/argus-watch/cli.mjs ledger          # 원장 요약
```

읽으면서 스스로 관찰할 것: ① "맞아, 내가 이거 결정했지"가 몇 %인가 ② 틀린 건 `dismiss <id>`
(기각도 보정 자료) ③ **정산하고 싶은 충동이 드는가** — 이게 내기 2의 판정 기준.

## P-A — 게이트 백테스트 (상세: `scripts/decision-watch-eval/README.md`)

- 픽스처: 당신의 실제 Claude Code 세션 47세그먼트 (argus 17 + 타 프로젝트 5곳 30 — 이름은 로컬 기록에만).
- GT: 세그먼트당 독립 리더 3명(비서실장/사학자/감사관 렌즈) → 2+ 합의만 인정. 감지기는 출하용
  단일-패스 프롬프트(`tools/argus-watch/prompts/detector.md`)로 블라인드 실행.
- **Precision 94.9% (TP 129 / FP 7), recall 84.9% (FN 23), disputed 10 (분모 제외).**
  high+medium만: 94.8% / 87.3%. 결정 없는 세그먼트 6개 전부에서 침묵 정상 작동.
- 메타: 감지기가 어제 세션의 결정("기존 방향 재검토하기로")까지 정확히 잡아냄.

## P-B — argus-watch (사용법: `tools/argus-watch/README.md`)

- 의존성 0, API 키 불요(headless `claude -p`), 원장은 append-only(.argus/ledger/, gitignore).
  amend는 이력 보존 — 조용한 덮어쓰기 없음 (기존 P3.5 원칙 이식).
- 적대 리뷰 에이전트가 찾은 실버그 7개 수정: 재개 오프셋 손실(중복 수확 위험), assistant 병합으로
  인한 구간 누락, seal/dismiss 상태 가드 부재, UTC/KST 날짜 오프바이원, 코드펜스 파싱, 개인 데이터
  기본 출력 경로, gitignore 구멍(.argus 전체 차단으로 해소).
- 실전 검증: website 프로젝트 scan → 결정 6건 수확, 그중 1건(`5913a183` 커피챗 캘린더 전환)을
  봉인 — LLM이 초안한 내기: *"4주 안에 예약 완료 ≥1건 / 유입은 있는데 예약 0건이면 반증"*
  (check_by 2026-07-09). 판정 어휘 0, 전부 관측 가능한 신호.

## P-C — 수확 결과 (당신의 원장)

7주치 대화(2026-04-20 → 06-10), 프로젝트 10개, 대화 구간 100개 스캔:

- **결정 219건 수확** — high 48 · medium 129 · low 42
- 종류: adopt 72 · direction 52 · approval 41 · constraint 23 · scope 13 · kill 11 · defer 7
- 상태: 후보 218 + 봉인 1 (시연용)
- 구체 내용(결정 텍스트·프로젝트별 분해)은 public 레포에 안 올림 — 로컬
  `.argus/eval/results/harvest-summary.txt`와 `argus-watch list`로 확인.

원래 설계의 치명 순환("원장이 가치인데 아무도 수동 봉인을 안 해서 원장이 안 쌓임")에 대한 답이
이 숫자다: **당신이 한 번도 입력하지 않았는데 원장에 219건이 있다.**

## 통합

- **`/watch` 스킬** (`.claude/skills/watch/SKILL.md`): 세션 끝에 `/watch` — due 정산부터, 그다음
  scan, 무게 있는 것 봉인 제안. `/watch all`, `/watch ledger`.
- 세션 시작마다 due가 인사하게 하려면 README의 SessionStart 훅(opt-in) 참고.

## 정직 조항 — 밤새 하지 *않은* 것

- **웹앱은 한 줄도 안 건드렸다.** 기존 EXECUTION-PLAN(시험 항해 웹 이식)은 그대로 있다 — PIVOT
  문서가 게이트를 통과했으니 이제 *대체 후보*지만, 무엇을 죽일지는 당신의 결정이다.
- GT는 LLM 합의다 — 진짜 판정은 아침의 당신 (내기 2). 리더·감지기가 같은 모델 계열이라 공유
  맹점은 측정 밖 (프레임 §2 잔여 사각과 동형).
- 내기 3 (1주 내 자발적 2회 사용, check_by 2026-06-18)은 도구가 못 채워준다 — 그게 핵심 실험.

## 다음 갈림길 (당신 몫의 결정 3개)

1. 내기 2 정산 — 원장이 맞는가, 정산 충동이 드는가. (틀리면: 감지 카테고리 보정 1회 → 재실패 시 중지)
2. 웹앱과의 관계 — argus-watch가 본체가 되고 웹은 Ledger 뷰어가 되는가, 아니면 병행인가.
3. 횡단 — ChatGPT 내보내기 파서 추가 여부 (PIVOT §4 플랫폼 의존 완화, 시장 면에서는 깔때기 확장).
