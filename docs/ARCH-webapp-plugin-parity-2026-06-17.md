# Argus 아키텍처 노트 — webapp ↔ plugin: 일치·드리프트·모니터 다리

> Date: 2026-06-17
> 맥락: 스트레스 캠페인(R1~11)이 *추상 엔진 스펙*과 *webapp 코드*를 검증하면서, "내가 plugin을 보고 있던 건가?"라는 질문이 떠올랐고 → 두 표면의 관계를 실코드로 점검. webapp(`src/`)·plugin(`argus-plugin-v2/`, v2.6.0) 동시 출시 전제.

## 1. 사실 — 두 표면은 별개 substrate다
| | webapp (`src/`) | plugin (`argus-plugin-v2/`) |
|---|---|---|
| 기술 | TS/React/Next.js, `src/lib/*.ts` ~100개, 프롬프트를 만들어 LLM API 호출 | 마크다운 `SKILL.md`(clarify/sail/team/verify/settle/helm…), Claude Code가 직접 따름 |
| LLM | 네가 API로 돌리는 모델 | 사용자의 Claude Code 자신 |
| 상태 | localStorage + Supabase(user_id) | 로컬 파일 `.argus/sessions/`, `.argus/ledger/ledger.jsonl` |
| 강점 | 시각 UI·영속·n=1 moat·공유 | repo/PR/git 직접 읽음(code-native)·오프라인·in-context |

→ **런타임 공유 코어 없음.** 같은 철학의 *두 독립 구현*.

## 2. 현 공유 지점은 단 하나 (그리고 이미 드리프트)
- 동기화되는 것: **probe 프롬프트만** — `src/lib/prompts/probe-prompts.ts` ↔ `argus-plugin-v2/data/prompts/probe-prompts.md`, `src/lib/__tests__/probe-prompts-parity.test.ts`가 byte-parity 강제. (스키마는 plugin이 `data/schemas/*.json`을 쓰나 webapp은 자체 TS 타입 → 부분만 공유.)
- **드리프트 실측:** plugin v2.6 `clarify` 스킬엔 R1~4 수정이 *전부* 박힘(Step 1.7 request-type 게이트, `frame_status: flat|load_bearing` under-fire 다이얼 rule 1b, ~60% over-fire 미러절, M-flat 메타체크). **webapp은 미반영**(R10 확인: `current-bearing.ts` always-go, `CrossProjectRecord` 승리만 합산 등). → **plugin이 판단에서 앞서 있다.**

## 3. 결론 — "완전 일치"는 함정, "같은 뇌·다른 몸"이 정답
- 사용자가 공유해야 할 건 *UX 픽셀*이 아니라 **판단의 성격**(한 질문으로 자른다·아첨 안 한다·over-fire 안 한다). 이건 parity로 강제 *가능*. 전체 UX 일치는 substrate가 달라 *불가·비최적*(plugin의 repo-native, webapp의 시각·moat를 서로 죽임).
- 동시-출시 표준 패턴 3 중 Argus 적합 = **(다) 선언적 자산 단일 원천 + parity 테스트.** (가) CLI=web API 얇은 클라이언트는 plugin 오프라인·native를 죽여 부적합; (나) 공유 라이브러리는 TS vs 마크다운이라 불가.

## 4. 실행 순서
1. **드리프트 닫기(최우선):** plugin v2.6의 under-fire/frame_status/step-0 게이트 + R10 확정 버그 6개를 webapp으로 포팅 → 판단을 같은 출발선에.
2. **선언적 코어 단일화:** probe 외에 reframe 프롬프트·bearing 필드·contract 로직·임계값·사용자 카피를 `data/`로 올려 양쪽이 읽고 parity 테스트.
3. **동작 fixture로 절차 로직 일치:** 마크다운-Claude vs TS-API는 실행로직 공유 불가 → **R1~11 스트레스 케이스를 cross-surface parity harness로 재활용**(입력→동일 frame_status/발화/surfaced). 연구가 곧 일치 장치.

## 5. 모니터 다리 (plugin 런을 webapp에서 열어보기, 같은 계정)
- **근본적으로 어렵지 않음** — 흔한 "로컬 도구 + 클라우드 대시보드" 패턴. plugin이 이미 구조화 JSON(session/analysis/ledger)을 쓰고 webapp엔 Bearing/contract 렌더러가 있음. 빠진 건 **전송 + 신원** 한 겹(plugin은 현재 네트워크·계정 0).
- **같은 계정 로그인 = join key:** webapp 설정이 device token 발급 → plugin `setup`이 받아 `.argus/`에 저장 → push를 token으로 태깅 → webapp이 `user_id`로 필터해 읽기전용 렌더.
- **단계:** v1 = git 브리지/import(plugin 무수정, repo의 `.argus/`를 webapp이 읽음, 비실시간) → v2 = opt-in live push(실시간).
- **전제(먼저):** (a) 삭제버그 수정(`deleteAllUserData`가 `synthesize_items` 누락 — 클라우드로 들이기 전 신뢰 가능한 삭제 필수), (b) 스키마 단일화(드리프트 시 모니터가 조용히 필드 떨굼), (c) 명시 opt-in·고지(repo 결정이 기계를 떠남 = R9 privacy 책임).
- **전략 가치:** 쪼개진 n=1 moat(plugin=repo, webapp=계정)를 *한 계정 히스토리로 합쳐 moat를 실재화.* "같은 뇌·다른 몸"에 **공유 기억** 한 겹 추가: plugin=일꾼, webapp=영속기억·시각화·대시보드.
- **한계:** 모니터는 *히스토리*를 합치지 *판단*을 합치진 않음 → parity(드리프트 닫기)와 *보완재*. 둘 다 필요.

## 6. 권고
지금 = 드리프트 닫기(webapp 포팅) + 삭제버그·스키마 단일화 → 그다음 모니터 다리 v1(git/import) → v2(live push)·한 계정 히스토리. **공유할 것은 판단, 살릴 것은 각 표면 강점.**
