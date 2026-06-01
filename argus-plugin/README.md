# Argus

**막막할 때 쓰는 구조화 도구.** 생각을 문서 언어로 번역합니다.

개발자가 기획안을 써야 할 때. PM이 전략 제안서를 만들어야 할 때.
내 전문 분야가 아닌 걸 해야 하는 순간 — `/argus`를 치세요.

## 30초 안에 초안이 나옵니다

```
/argus "개발자인데 대표님이 기획안 짜오라고 했어"
```

→ **30초:** 상황 정리 + 진짜 질문 + 기획안 뼈대 + 숨겨진 전제
→ **2-3분:** 질문 2-3개에 답하면 초안이 구체적으로 진화
→ **4분:** "대표님은 뭐라고 할까?" — 우려 사항 + OK 조건
→ **5분:** 피드백 자동 반영 → **바로 제출 가능한 문서**

멈추고 싶으면 언제든 멈추세요. 그 시점까지의 결과가 이미 쓸 만합니다.

## 설치

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin/install.sh | bash
```

Claude Code를 재시작하고, `/argus "고민"` 을 입력하세요.

## 결과물

| 만드는 것 (Build) | 판단하는 것 (Decide) |
|---|---|
| Implementation Prompt — Cursor/Claude Code에 바로 붙여넣기 | Sharpened Prompt — AI에 바로 붙여넣기 |
| Product Brief (MVP spec + scope cuts) | Thinking Summary (3000자, Slack/이메일 공유용) |
| | Decision Quality Score (0-100) |

## 스킬

| 스킬 | 한 줄 설명 | 소요 시간 |
|------|-----------|----------|
| **`/argus`** | **전체 파이프라인** — 초안→심화→시뮬레이션→최종 | ~5분 |
| `/reframe` | 문제 재정의 — 숨겨진 전제 발견, 진짜 질문 도출 | ~2분 |
| `/recast` | 역할 재설계 — 기존 계획에서 AI/사람 역할 명확히 구분 | ~3분 |
| `/rehearse` | 사전 검증 — 판단자 반응 시뮬레이션 + Devil's Advocate | ~3분 |
| `/refine` | 수정 반영 — /rehearse 피드백을 계획에 반영, 수렴 확인 | ~2분 |

```
/reframe → /recast → /rehearse → /refine
각 스킬은 독립 사용 가능. /argus는 전체를 한 번에 실행.
결과는 .argus/ 에 자동 저장되고, 다음 스킬이 자동으로 읽어감.
```

유틸리티: `/argus:setup` · `/argus:doctor` · `/argus:configure` · `/argus:patterns`

## 이게 뭐가 다른데?

**"지금 해주기" 모델.** AI가 "이런 걸 해보세요" 리스트를 주는 게 아니라, 이 세션 안에서 AI가 할 수 있는 건 직접 하고, 사람이 해야 할 건 "다음에 이 질문을 대표님에게 하세요" 수준까지 구체화합니다.

**Anti-sycophancy.** AI는 기본적으로 당신에게 동의합니다. Argus의 모든 스킬은 "반박"이 핵심 원칙입니다. 판단자 시뮬레이션은 까다롭게 기본 설정되어 있고, 피드백이 전부 긍정적이면 더 세게 돌립니다.

**Unspoken risk.** "다들 알지만 회의에서 안 꺼내는 것"을 찾는 전용 카테고리. Devil's Advocate 에이전트가 3가지 렌즈(현실적 실패, 침묵하는 문제, 1년 후 후회)로 공격합니다.

**쓸수록 똑똑해짐.** 실행 기록이 `.argus/journal.md`에 쌓이고, `/argus:patterns`로 반복되는 블라인드 스팟을 분석합니다. 각 스킬은 저널을 읽고 적응합니다.

**Framing confidence.** 질문의 정확도를 0-100으로 자가 평가하고, 낮으면 검증 단계를 앞에 배치합니다. 사용자가 프레이밍을 거부하면 처음부터 재분석합니다.

**Structured context chain.** 가정을 확인/불확실/의심으로 분류하고, 축(가치/실현/사업/역량)을 표기합니다. 다음 스킬이 의심된 가정을 최우선으로 검증합니다.

## 아무 언어나 됩니다

영어로 입력하면 영어로, 한국어로 입력하면 한국어로 답합니다.

## 스킬 체인

각 스킬은 `.argus/`에 Context Contract(YAML)를 저장합니다. 다음 스킬이 자동으로 읽고 이어갑니다.

```
/reframe → .argus/reframe.md (진짜 질문 + 평가된 전제 + 프레이밍 확신도)
    ↓
/recast  → .argus/recast.md  (Storyline + 실행 계획 + 역할 배분 + 핵심 가정 + 페르소나)
    ↓
/rehearse → .argus/rehearse.md (리스크 + 우려 + 승인 조건 매핑 + 구조적 종합)
    ↓
/refine   → .argus/refine.md  (변경 추적 + 승인 조건 달성 + 수렴 지표)
```

**v0.5 컨텍스트 파이프라인:**
- 가정: 확인/불확실/의심 × 4축 평가
- 역할: 🤖/🧑/⚡/🧑→🤖/🤖→🧑 5종
- 계획: Storyline(S/C/R) + critical path(★) + 시간 추정
- 검증: severity+fix + 승인 조건→계획 매핑 + 구조적 종합(합의/충돌/미검증)
- 수렴: 변경 추적 + 승인 조건 달성 + 원래 질문 정렬 확인

스키마 상세: [`CONTEXT-CONTRACT.md`](CONTEXT-CONTRACT.md)

## Research

- Spetzler (2016) — Decision Quality framework
- Sharma/Anthropic (2023) — structural sycophancy mitigation
- Dell'Acqua/Harvard-BCG (2023) — structured AI outperforms free-form by 12%
- Du/MIT (2023) — multi-agent debate improves reasoning accuracy by 8pp
- Klein/HBR — premortem improves risk identification by 30%

## License

MIT
