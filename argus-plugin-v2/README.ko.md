# Argus (Plugin v2)

[English](./README.md) · [**한국어**](./README.ko.md)

**Claude Code를 위한 판단 도구.** 에이전트 팀이 당신의 코드베이스 안에서 의사결정을 구조화해줍니다 — 코드 생성도, PR 리뷰도 아닌, **판단**.

---

## 한 화면에 받는 답

대부분의 결정은 가역적이고 30분짜리 팀 검토가 필요 없습니다. `/argus:sail "질문"` 한 줄이면:

```
## Argus · Minimal · v0.1

권장: 그냥 '작업실'로 바꿔. 사용자 신호 0이면 손해 0.
확인 한 가지 (5분 이내): 지원 티켓에 '워크스페이스 헷갈린다' 0건이면 진행.
조심: 출시 후 1주 내 어색 피드백 누적되면 롤백.

─────
density: low (가역적 UI 라벨) · 팀 배치 / Boss 검토 생략
재실행: /argus:sail --full "..."
```

라벨 하나 바꿀지 결정에 이게 끝입니다. **팀 배치 없음. JSON 없음. 30초.**

질문이 묵직할 땐 trade-off와 미해결 갈등을 보존한 15줄짜리 결정 카드를 받습니다 (아래 § "다른 모양" 참조).

---

## 실제 결정 흐름 (case study)

> **질문:** *"이번 분기 EU 출시 강행할까, 한 분기 미룰까? GDPR 준비 70%"*

```
→ clarify: critical 스테이크, framing 신뢰도 76 → 사용자에게 1회 확인
→ team 4명 배치: 다은(시장조사) · 승현(시나리오) · 윤석(법) · 동혁(리스크)
→ stage-1에서 ship_or_halt 축에 윤석 ↔ 승현 충돌 감지 → debate.json 작성
→ Boss(ISTJ 박 팀장) 검토: "미해결 갈등 1건 + critical 우려 2건 —
                              외부 자문 없이 승인 불가"
```

최종 카드에 나오는 것:
- **미해결 갈등 보존**: *"승현: kill criteria 도달. 윤석: GDPR fine 위험."*
- **해소 조건**: *"외부 EU GDPR 자문가가 '70%로 출시 가능' 답하면 승현 옳음"*
- **사용자 작업 3건**: 자문가 컨택 · EU DAU 실측 · 경쟁사 진입 일정 확인

사용자가 다음 주에 자문가 컨택 후 돌아와 `/argus:sail --resume <session>`. 새 정보 반영된 v0.2 산출. 출시 GO — 단 kill criteria 명시 + 누가 어떤 stance 냈는지 기록 보존된 채로 `git`에 남음.

이게 `team_contradictions[]` + `human_required_checkpoints[]`의 실제 모양입니다. 답이 아니라, **사용자가 행동할 수 있는 구조**.

---

## 언제 쓰고, 언제 쓰지 말지

**잘 맞는 경우**
- "Firestore에서 Supabase로 마이그레이션할까?" — 다중 이해관계자, 되돌리기 어려움, trade-off 보고 싶을 때
- "PR #42 검토" — 코드 컨텍스트 native, 실제 산출물 위에서 작업
- "auth middleware 설계가 잘못된 건 아닌가?" — 기술 + 리스크 + UX 관점 동시에 필요
- "Boss 기능 webapp에 둘까, plugin이 흡수할까?" — 프레임 충돌이 있는 제품 전략

**안 맞는 경우 (ChatGPT 쓰거나 그냥 결정하세요)**
- "X 문법이 어떻게 되지?" — Cursor나 docs가 빠름
- "Y boilerplate 짜줘" — 코드 생성, 판단 아님
- 점심 전에 혼자 commit할 작은 변경
- 답을 이미 알고 있고 검증만 받고 싶은 결정 — Argus는 의견 차이를 보존합니다. 검증이 목적이라면 mismatch

---

## 설치 (30초)

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

Claude Code 재시작. 그 다음 아무 repo에서:

```
/argus:sail "결정해야 할 질문"
```

별도 설정 불필요. 첫 실행에 `.argus/config.yaml`이 자동 생성됩니다 (ISTJ 박 팀장 기본, locale은 `$LANG`에서 자동 감지). 다른 boss 페르소나 원하면 그 파일만 편집.

---

## 다른 모양: full 결정 카드

clarify가 "이건 가벼운 게 아니다"라고 판단하면 (important/critical 스테이크, 프레임 충돌 존재) sail이 자동으로 chain합니다: clarify → 3-4 에이전트 병렬 → boss 검토 → 통합 카드. 단계 사이엔 한 줄 진행 표시:

```
## Argus · 2026-04-29-boss-absorption · v0.1

질문: 두 surface(웹앱, 플러그인)에서 같은 Boss 기능을 둘 다 유지할 만큼
      두 사용자층이 분리되어 있는가?

Boss(ISTJ 박 팀장) 결론: (1) 4시간 마이그레이션 spike 박고
                          (2) rollback kill criteria 명시 후 진행 가능.

이번 주 우선 행동: surface별 DAU 비율 정리 · 마이그레이션 spike 4hr 투자

⚠ 의심 가정: Plugin Boss가 webapp 수준(16 MBTI, deep mode,
  mass consultation)을 6개월 안에 따라잡을 수 있다.

⚠ 미해결 갈등 (1건): 절감액 $1,520/6개월은 작음 —
  포지셔닝 논거 vs 순수 비용 논거.

👤 사용자 작업 (3건): DAU 비율 실측 (본인만 접근 가능)

📁 .argus/sessions/2026-04-29-boss-absorption/versions/v0.1/
🗺  전체 트리: /argus:chart
```

뒤에는 5개 JSON 파일이 있습니다 — 각 에이전트 voice + 발생한 debate 보존. 깊이 보고 싶으면 `/argus:chart`로 열람.

---

## sail이 라우팅하는 방식

`/argus:sail "..."`이 항상 full 파이프라인 돌리진 않습니다. clarify가 몇 초 안에 산출하는 `decision_density`와 `stakes_confidence`로 자동 라우팅:

| 질문 모양 | 출력 | 이유 |
|---|---|---|
| 가역적 단일 액션 (rename, label, toggle) + framing 신뢰도 높음 | **MinimalScaffold** — 3줄: 권장 + 확인 1개 + 선택적 caveat. 팀/Boss 생략 | 라벨 하나 바꿀지 5단 스캐폴드는 over-engineering |
| Important/critical + stakes 신뢰도 ≥80 | 자동 chain: 팀 → boss → ~15줄 통합 카드. 단계 사이 한 줄 진행 표시 | 명백히 important일 때 "어떻게 진행?" 물으면 첫 입력 낭비 |
| Borderline 스테이크 (clarify 신뢰도 60–79) | AskUserQuestion 1회: "X 정도(N/100)로 보이는데 맞나요?" → 자동 진행 | 사용자 에이전시는 필요한 곳에만 |
| 그 외 | 표준 4-옵션 dialog (full / 팀까지만 / 빠른 / 멈춤) | 마지막 fallback |

**오버라이드**
- `/argus:sail --full "..."` — density 무관 full 파이프라인 강제
- `/argus:sail --quick "..."` — clarify만, 정규 스캐폴드 (MinimalScaffold 스킵)
- `/argus:sail --no-boss "..."` — 마지막 boss 검토 생략
- `/argus:sail --resume <session-id>` — 멈춘 세션 이어서

---

## 설정

첫 실행: 세팅 0. 처음 `/argus:sail` 호출 시 `.argus/config.yaml` 자동 생성. ISTJ 박 팀장 기본. 다른 MBTI / locale / role 원할 때만 편집:

```yaml
boss:
  mbti_code: ISTJ        # ISTJ ISFJ INFJ INTJ ISTP ISFP INFP INTP
                         # ESTP ESFP ENFP ENTP ESTJ ESFJ ENFJ ENTJ
  name: "박 팀장"
  gender: 남             # 남 | 여 (KR) or male | female (EN)
  role: "팀장"
locale: ko               # ko | en
```

repo별. 코드와 함께 commit. `.argus/sessions/`도 repo와 같이 ship하므로 팀이 git으로 의사결정 history 공유.

**Dev mode** (symlink install `--link`): skill `.md` 편집 → Claude Code 재시작 후 적용. Skill body는 세션 시작 시 캐시되므로 symlink 변경도 같은 세션 안에선 안 보임.

---

## 내부 구성

`/argus:sail`이 4개 sub-skill을 orchestrate:
- `/argus:clarify` — 질문 다듬기 (low-density면 여기서 답까지 나옴)
- `/argus:team` — 2~4 에이전트를 worker로 실제 산출물 위에 배치
- `/argus:boss` — 본인이 설정한 stakeholder 검토 (16 MBTI 중 하나)
- `/argus:chart` — 버전 트리 뷰 + draft 관리

**17 agent 팀**은 task type에 따라 세션당 2~4명 자동 선택. 각 에이전트 voice 구별됨 (리서치 / 전략 / 숫자 / UX / 법 / 리스크 등). Critical-stakes 결정엔 동혁(리스크 검토자) 의무 추가 — stage-2 critique.

**Cursor / Copilot Review / ChatGPT와 다른 3가지:**
1. **Worker, not critic.** 에이전트가 실제 도메인 산출물 (리서치 노트, ROI 표, UX 검토)을 만듦. 비평은 분리된 한 단계 (boss 검토)로만, 인터랙션 전체가 아님.
2. **갈등 보존.** Critical 스테이크에서 에이전트 의견 충돌 시 `team_contradictions[]`에 unresolved=true로 보존. 평균 내지 않음. 긴장 보고 사용자가 결정.
3. **결정 스캐폴드, 솔루션 아님.** 출력 모양: `reframed_question` + `key_trade_offs[]` + `hidden_assumptions[]` + `human_required_checkpoints[]`. 무엇을 할지 알려주지 않고 무엇을 결정 중인지 알려줌.

---

## 참고

- 17 에이전트 명단 — `data/agents.yaml` (다은/현우/규민/혜연/지은/동혁/...)
- Boss MBTI 페르소나 — `data/boss-types.yaml` (16개 타입 각각 speech_pattern + example_dialogue)
- JSON 스키마 — `data/schemas/*.json` (analysis-snapshot, minimal-scaffold, final-scaffold, draft, session 등)
- 버전 트리 메커니즘 — `lib/session/version-numbering.md`
- Build status, 결정 log, fix history — `BUILD_STATUS.md`
- **Webapp** — [argus.voyage](https://argus.voyage) (Next.js, 더 풍부한 UI). 에이전트 정체성 + MBTI 아키타입 + draft 트리 모델 공유. plugin은 출력 모양(스캐폴드 vs 마크다운), 에이전트 역할(worker vs reviewer), 환경(코드 native vs 산문), 영속화(filesystem vs Supabase)에서 분기.
- **라이선스** — MIT
