# decision-watch-eval — 결정-순간 감지 백테스트

> `docs/PIVOT-presence-not-place.md` §5 내기 1의 검증 장치.
> 게이트: **출하용 감지기의 precision ≥ 80%** (창업자의 실제 세션 아카이브 기준).

## 결과 (2026-06-11 실행)

| 지표 | 전체 | high+medium만 |
|---|---|---|
| **Precision** | **94.9%** (129 TP / 7 FP) | **94.8%** (110/6) |
| Recall | 84.9% (FN 23) | 87.3% (FN 16) |
| 픽스처 | 실제 세션 세그먼트 47개 (argus·fsk·overture·wedding-os·SAYU·letter, 채점 47/47) | |
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

## 한계 (정직 조항)

- GT 자체가 LLM 합의다 — 인간(창업자) 채점이 최종 판정이며, 이 수치는 그 대리 지표다.
  → `argus-watch dismiss`의 기각 기록이 진짜 인간 채점을 누적한다 (내기 2).
- 리더와 감지기가 같은 모델 계열(sonnet)이므로 공유 맹점은 측정 밖이다 (프레임 §2 잔여 사각과 동형).
  완화 후보: 교차-모델 리더.
- 픽스처는 한 사람의 대화 스타일이다. 일반화는 미검증 — 단, 첫 사용자가 그 한 사람이므로
  이 백테스트는 정확히 출하 대상 분포를 측정한 것이기도 하다.
