---
name: argus-help
description: "Show available Argus skills and how to use them. Use when the user asks about Argus, asks for help, or seems unsure which skill to use."
allowed-tools: Read
---

**Always respond in the same language the user uses.**

---

**Argus — 막막할 때 쓰는 구조화 도구**

내 전문 분야가 아닌 걸 해야 할 때. 질문 하나 던지면 30초 안에 뼈대가 나옵니다.
채울수록 날카로워지고, 대표님 반응까지 시뮬레이션합니다.

---

## 지금 뭘 해야 할지 모르겠다면

| 상황 | 추천 | 이유 |
|------|------|------|
| 기획안/제안서 써야 하는데 막막함 | `/argus` | 30초 뼈대 → 질문 2-3개 → 완성본 |
| 이미 만든 계획이 있는데 역할 분배가 애매 | `/recast` | AI/사람 역할 재설계 전문 |
| 계획은 있는데 약점이 궁금함 | `/rehearse` | 판단자 시뮬레이션 + 리스크 발견 |
| AI가 뻔한 답만 줄 때 | `/reframe` | 질문 자체를 리프레이밍 |
| /rehearse 피드백 반영하고 싶음 | `/refine` | 자동 수정 + 수렴 확인 |

---

## Quick Start

```
/argus "개발자인데 대표님이 기획안 짜오라고 했어"
```

→ **30초:** 상황 정리 + 진짜 질문 + 기획안 뼈대 + 숨겨진 전제
→ **2-3분:** 질문 2-3개에 답하면 초안이 구체적으로 진화
→ **4분:** "대표님은 뭐라고 할까?" — 우려 사항 + OK 조건
→ **5분:** 피드백 자동 반영 → **최종 결과물**

바로 보내도 되는 수준의 문서 + Sharpened Prompt + Thinking Summary.

---

## 스킬 전체 목록

### Core — 의사결정 파이프라인

| 스킬 | 한 줄 설명 | 소요 시간 |
|------|-----------|----------|
| **`/argus`** | **전체 파이프라인** — 입력→초안→심화→시뮬레이션→최종 | ~5분 |
| `/reframe` | 문제 재정의 — 숨겨진 전제 발견, 진짜 질문 도출 | ~2분 |
| `/recast` | 역할 재설계 — 기존 계획에서 AI/사람 역할 명확히 구분 | ~3분 |
| `/rehearse` | 사전 검증 — 판단자 반응 시뮬레이션 + Devil's Advocate | ~3분 |
| `/refine` | 수정 반영 — /rehearse 피드백을 계획에 반영, 수렴 확인 | ~2분 |

### Utility — 설정 및 분석

| 스킬 | 설명 |
|------|------|
| `/argus:setup` | 설치 확인 — 스킬/에이전트/데이터 검증 |
| `/argus:doctor` | 문제 진단 — 7가지 체크, 복구 안내 |
| `/argus:configure` | 설정 — 언어, 프리셋(Quick/Standard/Learning), 저널 |
| `/argus:patterns` | 사고 패턴 분석 — 3회 이상 사용 후 강점/블라인드 스팟 |

---

## 스킬 체인: 연결해서 쓰기

`/argus`는 전체를 한 번에 실행하지만, 각 스킬을 개별로 연결할 수도 있습니다:

```
/reframe → .argus/reframe.md에 저장
    ↓ 자동으로 읽힘
/recast  → .argus/recast.md에 저장
    ↓
/rehearse → .argus/rehearse.md에 저장
    ↓
/refine   → .argus/refine.md에 저장
```

각 스킬은 이전 스킬의 결과를 자동으로 읽고 이어갑니다.
"이전에 만든 결과가 있습니다. 이걸로 이어갈까요?" — 라고 물어봅니다.

---

## 결과물

| 만드는 것 (Build) | 판단하는 것 (Decide) |
|---|---|
| Implementation Prompt | Sharpened Prompt |
| Product Brief (MVP spec) | Thinking Summary (3000자, 공유용) |
| Scope cuts | Decision Quality Score (0-100) |

---

## 더 알고 싶다면

- `/argus:setup` — 설치 상태 확인
- `/argus:doctor` — 문제가 있을 때
- `/argus:configure` — 언어/프리셋 설정
- `.argus/journal.md` — 실행 기록 (자동 저장)
- `.argus/last-run.md` — 마지막 실행 결과
