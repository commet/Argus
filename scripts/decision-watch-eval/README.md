# decision-watch-eval — 결정-순간 감지 백테스트

> `docs/PIVOT-presence-not-place.md` §5 내기 1의 검증 장치.
> 게이트: **출하용 감지기의 precision ≥ 80%** (창업자의 실제 세션 아카이브 기준).

## 결과 (2026-06-11 실행)

| 지표 | 전체 | high+medium만 |
|---|---|---|
| **Precision** | **94.9%** (129 TP / 7 FP) | **94.8%** (110/6) |
| Recall | 84.9% (FN 23) | 87.3% (FN 16) |
| 픽스처 | 실제 세션 세그먼트 47개 (argus 17 + 타 프로젝트 5곳 30, 채점 47/47) | |
| disputed (리더 1명만 발견 → 분모 제외) | 10 | |

**🚪 GATE G-W0: 통과** (80% 기준 대비 +14.9%p). → `tools/argus-watch/` 구축 진행 정당화.

특기: 감지기는 결정이 0개인 세그먼트 6개 전부에서 0개를 보고했다 (침묵 규율 작동).
FN의 주 패턴은 (a) 한 발화에 결정 여러 개가 압축된 경우의 일부 누락, (b) "커밋하기로 결정" 같은
실행성 결정 — 후자는 의도된 보수성에 가깝다. FP 7건 중 다수는 결정의 *재해석* (방향은 맞고
표현이 GT와 갈린 것)으로, 순수 환각은 드물다.

## 방법론

1. **픽스처**: `parse-transcript.mjs`로 Claude Code JSONL → 사람이 보이는 대화 다이제스트 세그먼트
   (~9KB, 사이드체인·툴 출력 제외). **개인 데이터 — `fixtures/`·`results/`는 gitignore.**
2. **Ground truth**: 세그먼트당 독립 리더 3명(서로 다른 렌즈: 비서실장/사학자/감사관, 동일 정의)
   → 의미 클러스터링 병합 → **2+ 합의만 GT**, 1명 발견은 disputed로 분리 (정밀도 분모에서 제외).
3. **감지기**: 출하용 단일-패스 프롬프트(`tools/argus-watch/prompts/detector.md`) 블라인드 실행.
4. **채점**: GT·disputed·감지 출력을 의미 정렬 → TP/FP/FN. 같은 GT에 중복 매칭 시 첫 건만 TP.

순환 논증 방지: GT를 만드는 리더(고비용 3중 합의)와 채점 대상인 감지기(저비용 단일 패스)는
역할·프롬프트가 다르다. 측정 대상은 "출하될 싼 감지기가 비싼 합의를 얼마나 재현하는가"다.

## 재실행

```bash
# 1. 픽스처 생성 (개인 트랜스크립트 → gitignored 디렉토리)
for f in ~/.claude/projects/-Users-yc-Documents-GitHub-argus/*.jsonl; do
  node scripts/decision-watch-eval/parse-transcript.mjs "$f" --out .argus/eval/fixtures
done
# 2. Claude Code에서 Workflow 도구로 backtest-workflow.js 실행 (args.files = 픽스처 절대경로 배열)
# 3. 결과는 .argus/eval/results/에 저장 (로컬 전용)
```

---

## 레버 백테스트 (W2.0 — `lever-backtest-workflow.js`)

> `docs/EXECUTION-PLAN-v4.1-rebuild.md` W2.0 · 모든 W2 코드의 선행 게이트 G0.
> 위 감지 백테스트와 **같은 파이프라인 골격**(블라인드 생성 → 블라인드 정렬 채점)을 재사용한다.
> 측정 대상이 "감지기"가 아니라 **멈칫 레버 4종**(flinch-spine §P0.2)이라는 점만 다르다.

### 무엇을 재는가
결정-전 문단에 4개 레버 + `/blindspot` 베이스라인을 블라인드로 돌리고, 각 출력이 **실제로 드러난
실패 지점**(`actual_failure_point`, ground truth)을 짚었는지 엄격 채점한다.

| 레버 | 부류 | 출력 |
|---|---|---|
| A 과주장 캐스케이드 | 감지형 | 강점 1 + 과장 사다리(전제별 인용 앵커) + 가장 위험한 전제 |
| B 차분 생성 | 감지형 | 대안 계획 + 갈리는 축 + ≤3행 차분표 + 고려 안 한 위험 |
| C 분기 탐침 | 측정형 | N개 독립 샘플(haiku) → 결정 필드 갈림(`flipped_user_claim` 없으면 폐기) |
| D 하중 탐침 | 측정형 | 문장별 제거 → 결정 바뀌는데 근거 없는 하중 주장만 |
| blindspot | 베이스라인 | 가장 위험한 구멍 1개 |

불변 규율은 모든 레버 프롬프트에 박혀 있다: 인용 앵커 강제 · 판정 금지 · 침묵 허용 ·
`flipped_user_claim` 없는 갈림 폐기.

### 채점·스왑
- **적중(hit)**: 채점자에 레버 은닉(블라인드). 출력이 GT 실패 지점을 같은 위험으로 짚으면 적중.
  막연한 "위험하다"는 불합격.
- **스왑(P0.3)**: 한 문단의 출력을 다음 문단에 붙여, 거기서도 그럴듯하면 비특이적(스왑 실패).
  스왑 통과율 = 출력이 원 문단에 고유한 비율.
- **구체성 분해**: vague/specific 픽스처별 적중률 (예측: vague에서 C, specific에서 B·D 강세).

### 픽스처
`.argus/eval/lever-fixtures/pre-decision.json` (결정-전 문단 + 알려진 실패 지점, **gitignore — 개인 데이터**).
세션 4 + 과거 피벗 + 공개 포스트모템 2 = 14건. 계획/결과 쌍은 `plan-result.json` (P0.B용).
문단은 **선택된 옵션을 숨긴다** (블라인드 프로브 입력).

### 재실행
```bash
# 픽스처는 .argus/eval/lever-fixtures/ 에 있어야 함 (gitignored)
# Claude Code Workflow 도구로:
#   Workflow({ scriptPath: "scripts/decision-watch-eval/lever-backtest-workflow.js" })
# 기본 경로(pre-decision.json) 전체 14건 사용. 부분 실행: args.fixturesPath 로 다른 파일 지정.
```
산출: 5열 비교표(적중률·스왑통과율·vague적중·specific적중·n) + `gate.G0_pass_measure_levers`.

### 🚪 GATE G0 (이 백테스트의 출구)
C 또는 D의 적중률 > blindspot 베이스라인 **AND** 해당 레버 스왑 ≥80% → W2.1 진행.
전부 베이스라인 이하 → **W2 전체 중지, W1만으로 재구축 완성**(미리 수용된 분기).
**최종 통과/실패 판정은 Fable/인간** (v4.1 §0 모델 운용 — 게이트 리뷰는 판단 마디).

## 한계 (정직 조항)

- GT 자체가 LLM 합의다 — 인간(창업자) 채점이 최종 판정이며, 이 수치는 그 대리 지표다.
  → `argus-watch dismiss`의 기각 기록이 진짜 인간 채점을 누적한다 (내기 2).
- 리더와 감지기가 같은 모델 계열(sonnet)이므로 공유 맹점은 측정 밖이다 (프레임 §2 잔여 사각과 동형).
  완화 후보: 교차-모델 리더.
- 픽스처는 한 사람의 대화 스타일이다. 일반화는 미검증 — 단, 첫 사용자가 그 한 사람이므로
  이 백테스트는 정확히 출하 대상 분포를 측정한 것이기도 하다.
