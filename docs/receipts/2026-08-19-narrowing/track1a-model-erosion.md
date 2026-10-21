# 1a — 모델이 좋아지면 이 아픔은 사라지는가 (침식 분석)

> 조사 에이전트 보고 원문 (2026-08-19). 주 세션 검수: 출처 표본 확인 예정.

**이 조사가 기각하면 무너지는 것**: "AI가 결정을 어기거나 잊는다"는 아픔이 모델 개선만으로 소멸한다면, 그 아픔 위의 제품은 시한부다. 판정: **기각 아님 — 단, ①만은 시한부가 맞다.** 잠정 가설 "입구는 녹는 얼음, 땅은 구조적"은 대체로 검증되며, 보정 두 가지가 붙는다.

## 4분해 판정

**① 위반 — 침식됨 (단, 이중 시계).**
- 단순·명시·단발 규칙은 빠르게 녹는 중: IFEval에서 GPT-4(2023.11)가 prompt-strict 76.9%였고([Zhou et al. 2023](https://arxiv.org/abs/2311.07911)), 2026.08 상위 모델은 95%다([BenchLM 리더보드](https://benchlm.ai/benchmarks/ifeval)). 오류율 23%→5%.
- 그러나 조건이 겹치면 위반은 프론티어에서도 지속: 규칙 500개에서 최고 모델도 명령당 68%([IFScale](https://arxiv.org/abs/2507.11538)), 멀티턴에서 평균 -39%·비신뢰성 +112%로 상위 모델 전부 하락([Microsoft/ICLR](https://arxiv.org/abs/2505.06120)), 긴 입력에서 30–50% 하락은 GPT-4.1·Claude 4·Gemini 2.5에서도 재현([Chroma Context Rot](https://www.trychroma.com/research/context-rot))되고 2026년 모델에서도 관찰된다([arXiv 2605.12366](https://arxiv.org/html/2605.12366v1)). GPT-5·Claude 4.1 Opus도 함수호출 안의 기본 포맷 규칙을 "frequently fail"([IFEval-FC](https://arxiv.org/abs/2509.18420)).

**② 유실 — 구조적 (부분 침식 중).**
- 기록 자체가 안 되는 것은 모델 이전의 워크플로 문제: 설계결정 문서화(ADR) 실증 연구에서 응답자 83%가 "rarely/occasionally"만 기록했고, 미기록 결정은 같은 문제 재발견·제약 위반 재발로 이어진다(knowledge vaporization, [ECSA 2024 액션리서치](https://rebekkaa.github.io/files/2024_ECSA.pdf)).
- 반대 압력: OpenAI Dreaming V3(2026.06)는 명시적 "기억해" 없이 암묵 선호를 자동 포집한다([OpenTools 보도](https://opentools.ai/news/chatgpt-memory-just-got-5x-smarter-inside-openai-s-dreaming-v3-upgrade)) — "완전 유실"의 면적은 벤더가 갉는 중. 다만 포집돼도 준수는 71.3%(3할 미적용)이고, 자동 추론된 선호는 "사용자가 채택한 결정"이 아니다 — 유실 아픔이 오귀속(추측을 결정으로 취급) 아픔으로 전이된다. 명시적 채택·출처 문제는 남는다.

**③ 낡음 — 핵심부 구조적, 주변부 침식.**
- 최신성 가중·시점 검색은 급개선: OpenAI 시간민감 문맥 9.4%(2024)→52.2%→75.1%(2026)([OpenTools](https://opentools.ai/news/chatgpt-memory-just-got-5x-smarter-inside-openai-s-dreaming-v3-upgrade)), LongMemEval 지식갱신 96.2% 도달 사례([mem0 2026 리포트](https://mem0.ai/blog/state-of-ai-agent-memory-2026)).
- 그러나 업계 자체 진단이 "고관련 기억의 staleness는 더 어려운 미해결 문제"다: "이직하는 순간 confidently wrong"([mem0 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)). 새 신호가 시스템에 안 들어온 낡음(현실이 바뀌었는데 아무도 말 안 함)은 어떤 검색·가중으로도 못 고친다 — 재확인 워크플로의 문제. 대규모 시간 질의도 1M→10M 토큰에서 64.1→48.6으로 하락(같은 출처).

**④ 무정산 — 구조적.**
- 정의상 모델 밖: 결과 데이터가 들어오지 않으면 어떤 모델도 채점할 수 없다. 기록 없는 사후 평가는 사후확신 편향으로 체계적으로 왜곡되고, 추적+빠른 피드백이 있어야 판단이 개선된다는 것이 Tetlock 계열의 실증([HBR 2016](https://hbr.org/2016/05/superforecasting-how-to-upgrade-your-companys-judgment)). 경영진 72%가 "나쁜 결정이 좋은 결정만큼 흔하거나 더 흔하다"([McKinsey](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/flaws-in-strategic-decision-making-mckinsey-global-survey-results)).
- METR 스스로 "신뢰성-결정적이고 검증이 어려운 과제엔 98%+가 필요하며 시간지평이 그걸 말해주지 않는다"고 명시([METR 2026.01](https://metr.org/notes/2026-01-22-time-horizon-limitations/)). 벤더 메모리 평가축(선호 준수·사실 회상·시간민감)에 '결과 정산' 항목 자체가 없다 — 확인 범위 내에서 정산을 내장한 주류 제품은 미발견 (**확인 필요**).

## 곱셈의 함정 — 실측 검증: 지지, 단 임계 보정

- 지지: [IFScale](https://arxiv.org/abs/2507.11538) 실측은 곱셈보다 나쁘다 — 명령당 순종률 p가 상수가 아니라 N이 늘면 p 자체가 하락한다(임계 150–200 후 급락, 앞쪽 명령 우선 편향). 500개에서 명령당 68%면 "전부 지킴" 확률은 사실상 0. 시간축 등가물: 상수 위험률→지수 생존곡선([Toby Ord](https://www.tobyord.com/writing/half-life)). METR 실측에서 80% 신뢰 지평은 50% 지평의 1/4–1/6([METR 2025.03](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)).
- 보정: 임계 안쪽(최신 추론 모델 ~150개 미만, 단발·정돈된 문맥)에선 거의 완벽 — 개인 사용자의 규칙 수십 개는 이미 임계 안이다. 함정이 발동하는 것은 규칙 수 × 문맥 길이 × 턴 수 × 시간의 결합 조건에서다.
- (주 세션 주석: 단 실전 세션은 "정돈된 문맥"이 아니다 — 긴 컨텍스트·멀티턴 하락이 결합해 CLAUDE.md 위반이 세션의 ~50%로 보고되는 것이 현재 실전값. 벤치 임계와 실전 사이의 이 간극 자체가 ①이 아직 뜨거운 이유다.)

## ①의 침식 시계 (거친 추정)

- 명시 규칙 단발 위반 오류: 23.1%→5% (2023.11→2026.08) → **반감 ~14–15개월**.
- 메모리 선호 준수 오류: 68.6→44.7→28.7% (2024→25→26) → **반감 ~19개월** (자사 평가 — 확인 필요).
- 종합: **단순 위반 아픔의 반감기 ≈ 1.5년 ± 0.5년.** 단 고신뢰 축적 조건은 별도 시계: 50%와 80% 지평의 배가속도가 동일해 신뢰성 격차는 '상수 랙'으로 유지되고, 99% 신뢰는 50% 지평 대비 **~4년 랙**([Ord](https://www.tobyord.com/writing/half-life)).
- 함의: ①(입구) 위에 3년 이상 버틸 제품을 세우면 위험. "결정 N개를 전부, 오래, 확실히"의 꼬리는 4년+ 남는다.

## 정직한 반대 사례 (가설에 불리한 발견)

1. **②③은 순수 구조가 아니다** — "벤더 스택이 좋아지면"으로 넓히면 자동 포집과 시간민감 검색이 유실·낡음의 상당 면적을 이미 갉고 있다.
2. **곱셈의 함정은 개인 스케일에선 아직 안 발동** (벤치 기준) — 함정 서사를 개인 아픔에 그대로 적용하면 과장.
3. **신뢰성도 능력과 같은 속도로 성장 중** — 80% 지평 배가율이 50%와 동일: "지금 50%로 되는 일"은 ~14개월 뒤 80%로 된다.
4. IFScale 세대 추이는 임계 자체가 세대마다 밖으로 밀림을 시사 — 다중 규칙 위반도 침식 중.

## 결론

- **① 침식됨** (단순 조건 반감 ~1.5년; 고신뢰 꼬리 ~4년 랙). **② 구조적이되 부분 침식** — 남는 핵은 '명시적 채택과 출처'. **③ 핵심부(무신호 낡음) 구조적.** **④ 구조적** — 유일하게 어떤 벤더 지표도 겨냥하지 않는 땅.
- 제품 함의: **"위반을 막아주는" 가치는 시한부, "무엇을 채택했고(출처) · 현실이 바뀌었는지 재확인하고(무신호 낡음) · 맞았는지 정산하는(④)" 가치는 모델 무관. 넷 중 가장 단단한 땅은 ④다.**

## 출처

- IFEval 원논문: https://arxiv.org/abs/2311.07911 · BenchLM 리더보드: https://benchlm.ai/benchmarks/ifeval · IFEval-FC: https://arxiv.org/abs/2509.18420
- IFScale: https://arxiv.org/abs/2507.11538 (https://distylai.github.io/IFScale/)
- Chroma Context Rot: https://www.trychroma.com/research/context-rot · 2026 후속: https://arxiv.org/html/2605.12366v1
- 멀티턴 하락 (Microsoft/ICLR): https://arxiv.org/abs/2505.06120
- METR 장기과제: https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/ · 한계 해명: https://metr.org/notes/2026-01-22-time-horizon-limitations/ · Toby Ord: https://www.tobyord.com/writing/half-life
- OpenAI Dreaming V3 보도: https://opentools.ai/news/chatgpt-memory-just-got-5x-smarter-inside-openai-s-dreaming-v3-upgrade (자사 평가 — 1차 출처 재확인 필요)
- mem0 2026: https://mem0.ai/blog/state-of-ai-agent-memory-2026 · LongMemEval: https://arxiv.org/abs/2410.10813
- ADR 액션리서치: https://rebekkaa.github.io/files/2024_ECSA.pdf · HBR: https://hbr.org/2016/05/superforecasting-how-to-upgrade-your-companys-judgment · McKinsey: https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/flaws-in-strategic-decision-making-mckinsey-global-survey-results
