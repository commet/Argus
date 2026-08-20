# 리서치 B — 세션→규칙 자동 수확 도구 전수 조사 (2026-08-20)

> 조사 에이전트 보고 원문(경미 축약). 창업자 질문의 나머지 절반 — "사용
> 기록에서 규칙을 뽑아 CLAUDE.md류를 갱신"하는 모든 것. 방법: 웹 검색 + 공식
> 문서/저장소 직접 확인. 비공개·신생 도구 누락 가능.

**요약**: 수확(1단)은 업계 표준으로 포화. **사람 승인 단계를 가진 것도 최소
6곳**(Devin·Cursor·Augment·claude-reflect·CodeRabbit·신형 /init). 그러나
**만기·기계 집행·현실 정산까지 갖춘 단일 도구는 없다.**

## 비교표 (①방아쇠 ②사람 승인 ③출처 보존 ④만기 ⑤집행 ⑥백테스트 ⑦활동성)

| 도구 | ① | ② | ③ | ④ | ⑤ | ⑥ | ⑦ |
|---|---|---|---|---|---|---|---|
| Claude Code **auto memory** | 완전 자동 | **없음** (사후 열람·편집만) | 없음 (`modified` 시각만) | 없음 (한도 넛지뿐) | 없음 — 문서 명시 "context, not enforced" | 없음 | 기본 켜짐 |
| Claude Code **/init·/doctor** | 수동 명령 | NEW_INIT이면 쓰기 전 제안 검토 | 코드베이스 분석 | 없음 | 없음 | 없음 | 활발 |
| **Cursor Memories** | 자동 (사이드카 제안) | **있음** — 저장 전 승인/거부 | 없음 | 없음 | 없음 | 없음 | **2.1.x에서 기능 제거** (리서치 A) |
| Cursor /Generate Rules | 수동 (대화→규칙 파일) | 커밋 = 암묵 승인 | 없음 | 없음 | 없음 | 없음 | v0.49~, UI 변동 확인 필요 |
| **Windsurf Cascade Memories** | 완전 자동 + 요청 | **없음** | 없음 | 없음 | 없음 | 없음 | 활발 |
| **Devin Knowledge** | 자동 제안 | **있음** — 편집/저장/기각 | 없음 | 없음 ("주기적 갱신" 권고뿐) | 없음 | 없음 | 활발 |
| Google **Jules** memory | 완전 자동 (repo 단위) | **없음** (토글뿐) | 없음 | 없음 | 없음 | 없음 | 2025-09 출시 |
| **Augment Memory Review** | 자동 생성 | **있음** — Pending 승인/편집/폐기 | 없음 | 없음 | 없음 | 없음 | 활발 |
| **SpecStory** derived rules | 완전 자동 (채팅마다 규칙 도출) | **없음** — 파일 덮어씀(백업만) | 채팅 원문 통째 보존, 규칙별 인용 없음 | 없음 | 없음 | 없음 | 활발, 로그인 필수 |
| **CodeRabbit** learnings | 코멘트 발화 기반 | **있음(선택)** — approval_delay 관리자 심사 | **있음** — PR·파일·작성자·사용 이력 | 없음 ("분기 검토" 권고) | 부분 — 미래 리뷰 지적(소프트) | 없음 | 활발 |
| **Greptile** memory | 완전 자동 (반응·**반영 커밋** 학습) | 확인 필요 | 확인 필요 | 없음 | 부분 (무시 억제·채택 강조) | **제안 채택을 커밋으로 측정 = 정산 최근접** | 활발 |
| **claude-reflect** (OSS 1.4k★) | 훅 자동 캡처 → /reflect 수동 처리 | **있음** — Apply/Edit/Skip | 확인 필요 | 없음 | 없음 | **있음** — `--scan-history`(과거 소급 수확) + `--dry-run` | v2.6.0 MIT |
| Workshop (OSS 11★) | 훅 자동 캡처 | 옵션 (interactive 승인) | **있음** — UUID+신뢰도+시각 | 없음 | 없음 | 없음 | 소규모 |
| reflection.md 패턴류 | 수동 명령 | **있음** — 제안별 대기 | 없음 | 없음 | 없음 | 없음 | gist 129★ |
| cc-sessions (1.6k★) | (수확 아님 — 작업 프로토콜) | 있음 — 승인 전 도구 차단 | 태스크 frontmatter | — | **있음** — 훅이 도구 기계 차단(고정 프로세스 규칙) | 없음 | v0.3.0 |
| OpenAI Codex memories | AGENTS.md 수동 관행 · 네이티브 memories 실험 중("지금 쓰지 말라") | — | — | — | 없음 | 없음 | 미출시 |
| mem0 / **Zep(Graphiti)** | 완전 자동 (ADD/UPDATE/DELETE 자동 판정 — 오삭제 사례 보고) | **없음** | Zep: bi-temporal | **Zep만** — valid_at/invalid_at 자동 무효화(사람 없음, 기억 그래프 층) | 없음 | 없음 | 활발 |

## 5단 루프 지도

1. **수확** — 포화 (완전 자동 8곳+, 감지+수동 3곳, 발화 기반 2곳, 수동 명령 3곳).
2. **사람 승인** — 존재하나 **전부 '1회성 저장 게이트'**: (a) 승인 행위 자체가
   기록으로 남지 않고(누가·언제·무엇을 근거로) (b) scope·만료·철회·반례가
   승인에 결박되지 않으며 (c) fail-closed가 아님. 승인 메타데이터는
   CodeRabbit이 유일 근접. **Cursor·Augment이 승인을 도입한 명분 자체가 "무단
   기억은 동의 없는 시스템 프롬프트"** — 저자성 아픔의 시장 실증.
3. **만기/재확인** — 제품 수준 부재. 근사물: modified 시각 넛지 · "분기 검토"
   권고 · Zep bi-temporal(인프라 층, 사람 없음).
4. **집행** — 수확된 규칙을 집행하는 곳 없음(전부 주입). 집행 실재는 별개
   계층: hooks·cc-sessions 도구 차단·CI 가드. 소프트 집행: CodeRabbit/Greptile
   리뷰 지적.
5. **정산/백테스트** — 최빈 칸. **claude-reflect --scan-history+--dry-run이
   유일한 명시적 소급·시운전 장치**(단 성격은 '과거에서 교훈 수확+적용
   미리보기'지 '규칙의 영향평가'는 아님). Greptile의 반영-커밋 학습이 유일한
   결과 기반 신호(제안 단위·암묵). "채택된 규칙이 이후 현실에서 맞았는가"를
   재는 도구는 미발견.

## 최종 판정

- **5단 전부를 가진 도구: 없음.** 최다 보유 = CodeRabbit(수확+선택 승인+출처+
  소프트 집행+사용 실적 — 만기·백테스트 없음, 코드리뷰 한정)과
  claude-reflect(수확+항목 승인+소급+dry-run — 출처·만기·집행·정산 없음).
- 무게중심은 1~2단. 2단조차 저장 게이트지 계약이 아님. 3·4·5단은 파편.

## 출처 (원링크는 조사 로그)

code.claude.com/docs/en/memory · cursor.com/changelog/1-0 · localskills.sh(3rd
party) · forum.cursor.com(0.49) · docs.devin.ai(cascade/memories · knowledge) ·
jules.google/docs/changelog/2025-09-30 · augmentcode.com/changelog/memory-review
· docs.specstory.com · docs.coderabbit.ai/knowledge-base/learnings ·
greptile.com/docs(memory-and-learning) · github.com/BayramAnnakov/claude-reflect
· github.com/zachswift615/workshop · gist(a-c-m) · github.com/GWUDCAP/cc-sessions
· github.com/openai/codex/discussions/12567 · hindsight.vectorize.io ·
docs.mem0.ai · github.com/getzep/graphiti · dev.to(mem0 오삭제)

**확인 필요**: Cursor Memories 공식 문서 현 URL(승인 서술은 3rd party 근거) ·
Jules 열람/삭제 UI · Greptile 항목별 승인 · claude-reflect 출처 기록 ·
auto memory 도입 정확 버전(공식 changelog 미대조).
