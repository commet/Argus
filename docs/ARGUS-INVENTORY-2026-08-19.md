# 전수 인벤토리 — 계획됐으나 끝나지 않은 모든 것 (2026-08-19)

> 창업자 지시: *"과거에 내가 기획하고 구현하려던 것 중에 구현되지 않았거나, 제대로
> 연결 안 됐는데 내가 놓쳐서 까먹은 것 … 이것들 다 한데 쭉 모아서 쭉 다 써서 일단
> 리스트업을 해보자."* 그리고: *"심각하다고 생각하고 엄격하고 냉정하게 접근해줘."*

**방법**: 병렬 검수 7회 — 살아있는 문서 27개 전수(84건) + 은퇴·삭제 문서 86개 전수
(BLUEPRINT 1,439줄·METHOD V0.1~0.8 복원 포함, 91건) + 코드 감사 5종(웹앱·MCP코어·
플러그인·데이터/실DB·테스트). 모든 항목은 출처와 상태 검증(코드 grep·실DB 대조·변이
실증)을 동반한다. 상태 어휘: **안 지음 / 반쯤 / 지었는데 안 이음 / 판정 필요 /
잊힘 / 미확인**.

## §0. 냉정한 진단 — 이 목록이 말하는 것

**미완 항목 약 175건.** 개수보다 무거운 것은 패턴 셋이다.

1. **제품이 자기 자신에게 한 봉인 약속들이 미정산이다.** 이 제품의 존재 이유가
   "봉인하고 현실로 정산한다"인데, 제품 자신의 봉인 4건(KEYSTONE 준공검사 ·
   BLUEPRINT 마지막 장 · §9.6 코호트 · v2 일정 10-03)이 전부 정산되지 않았다.
2. **사전 봉인된 검증 게이트 5개가 전부 미실행이고, 그 게이트 뒤에 있어야 할 것들이
   먼저 지어졌다.** O4(숫자 봉인된 판정 — 실행 0) · R3-A(30케이스 3-arm) ·
   R3-B(10명 스크립트, SEALED 인 채 archive 행) · E3B(이해도 연구, /patterns 404 유지) ·
   DKK-P5(재개 조건 추적자 없음).
3. **만들고 시동을 안 거는 일이 체계적으로 반복됐다.** 죽은 엔진 6개(~3,700줄 —
   다섯은 전용 테스트까지 완비, persona-refiner 만은 참조도 테스트도 0) · DB 테이블 7개(RLS·삭제등록 완비, 쓰기 0) · "유일한 진실" 통합
   스키마(흐르는 데이터 0) · 리소스 템플릿(빈 목록 반환) · outbox 상태머신(진입점 0).

~175 의 산술: 살아있는 문서 수확 84 + 은퇴·삭제 문서 수확 91 (겹침 소수 —
loop:demo·zone-purity·outbox 등). 본 문서의 번호는 묶음 행을 포함해 102행이다.
상태 분포(수확 2회 합산 감): 안 지음/안 함 ~70 · 잊힘 ~40(그중 BLUEPRINT §8
대기목록이 37건) · 지었는데 안 이음 ~25 · 판정 필요 ~25 · 반쯤 ~12 · 미확인 ~8.

---

## §1. 가장 무거운 것 — 제품 자신의 약속과 검증 게이트 (9건)

| # | 항목 | 출처 | 상태 |
|---|---|---|---|
| 1 | **4걸음 — 창업자 실달력 1회 완주 (H-B 첫 증거)**. 오늘 심고 내일 아침 "뭐 있나". 전 문서가 "사업의 전부"라 부름 | COMPLETION-PLAN 4걸음 · PRODUCT-PLAN §6 외 5문서 | **0건. 창업자만 가능** |
| 2 | **R3-A — 블라인드 3-arm 30케이스** (카드 프롬프트 vs 워크시트 vs Argus, 20/30 선호 필요). "제품은 이 카드 한 장을 이겨야 한다" | METHOD §15.4 · R3A-CONTRACT(SEALED) | 미실행, 리시트 0 |
| 3 | **R3-B — 10명 스모크** ("5분만 부탁" 스크립트 + 사전등록 판정표, SEALED) | archive/R3B-INTERVIEW-SCRIPT | 미실행. 봉인 스크립트가 archive 행 — COMPLETION-PLAN 의 "10명"이 이 스크립트를 참조하지 않음 |
| 4 | **O4 증거 관문 판정** — 착수 전 봉인된 숫자(D0=07-18, D+21=08-08), PASS/ITERATE/HOLD/KILL | BLUEPRINT §9.7 | **판정 자체가 실행된 적 없음.** 게이트에 걸린 7건+ 전부 붕 뜸 |
| 5 | **E3B 이해도 연구** (5명×10과업, endorse≠grant 혼동 0) — 통과 전 /patterns 404 | archive/PROTOCOL-e3b | 미실행. 코드·게이트 존재, 승인 레지스트리 빈 채 404 |
| 6 | **DKK-P5 가치 게이트** (완주 10사이클+대조군+블라인드 재구성 채점) | ADR-p5 · MCP-V2-SPEC I-4 | HOLD 동결. 재개 조건 추적자 없음 |
| 7 | **제품 자신의 봉인 4건 미정산** — KEYSTONE 준공검사(외부인 1명 30일 완주) · BLUEPRINT 마지막 장(신규 코호트 7일 귀환) · §9.6 당직 코호트 · **v2 일정 봉인(check_by 2026-10-03, 실서버 봉인)** | KEYSTONE §10 · BP · receipts/2026-07-11 | 전부 미정산. 10-03 정산 약속은 어느 산 문서도 추적 안 함 |
| 8 | H-C — recall 이 물어온 과거 정산이 다음 계획에 인용되는가 | PRODUCT-PLAN §6 | 증거 0 |
| 9 | 재정초 탐색 봉인 발효 (predicate_owner:user, 기각 사유 기록 조건) | receipts/e0-baseline §7 | 결정 셋은 CANON §9 로 갔으나 형식 봉인·기각 기록 미이행 |

## §2. 지었는데 안 이은 것 (25건)

| # | 항목 | 출처 | 규모 |
|---|---|---|---|
| 10 | **cognition 4,658줄 대화 루프 편입** — 창업자 봉인의 남은 반쪽 (화면 철거만 완료) | CANON §9 결정 3 | 큼 |
| 11 | cognitive_* DB 테이블 7개 — 테이블·매퍼·RLS·삭제등록 완비, **지속 호출 0** | 데이터 감사 D4 | 중간 |
| 12 | 죽은 엔진 6: persona-refiner 576줄(참조 0) · **control-plane 692줄("파생 기억의 유일한 권위", 승인·철회·반례 API 7개 프로덕션 호출 0)** · judgment-vitality 760 · decision-quality 535 · context-compiler 폐쇄그래프 801 · skill-quality-eval 531. **죽은 export 전체 138개/3,430줄** | 웹 감사 W6 | 큼 |
| 13 | **LedgerDecision "통합 스키마"** — "single source of truth" 자칭, 변환기 2개 호출처 0 | ledger-schema.ts · 웹 감사 W1 | 중간 |
| 14 | `listResourceTemplates()` 빈 배열 반환 — receipts/premises 템플릿 구현돼 있는데 광고 0 | MCP 감사 M2 | 작음 |
| 15 | `v2/outbox.ts` 88줄 — 계정 sync 상태머신, 진입점 0 (사슬 전체) | MCP 감사 · MCP-V2-SPEC 규칙 12 | 작음 |
| 16 | epistemic 서버면 ~10파일 1,400줄 (context-compiler·local-adapter·server-* 등) | MAP §5.1 · JCR J4·J5 | 중간 |
| 17 | `/api/epistemic/commands` HTTP 문 — 라우트 존재, 호출처 0 | MAP §7.2 | 작음 |
| 18 | lib 낱개 미배선 10파일 ~2,200줄 (routing-default·analysis-routing·request-type-classifier·item-extract-core·notification-copy·retrospective·agent-stats·workflow-review 등 — 전부 전용 테스트 보유) | MAP §5.1 | 중간 |
| 19 | `decisive-premises.ts` 194줄 (MCP) — 정본 문구 갖고 한 번도 안 물음. 봉인 믿음창 불리언 대체 자리 설계돼 있음 | MAP · 계획 B-2 | 작음 |
| 20 | `detect-signals.ts` 194줄 (MCP) — 플러그인 정본 원천으로만 생존 | MAP | 작음 |
| 21 | v3 잔여 3파일 540줄 (store·legacy-v2·p5-gate) + `ARGUS_DKK_V6_PILOT` 플래그는 주석에만 존재 | MCP 감사 M4 | 작음 |
| 22 | E3B 표면 (J9) — 코드·게이트 검증 완료, 공개 활성화만 잠김 (§1-5 와 한 몸) | JCR §17·§24 | 중간 |
| 23 | BranchMap 129줄 · ArgusCompanionNote 47줄 | MAP §5.1 | 작음 |
| 24 | 페르소나 피드백 프롬프트 중앙화분 — 소비자 테스트뿐 (의도적 대기) | CLAUDE.md | 작음 |
| 25 | Turnstile 클라이언트 배선 — 서버 검증만, INERT BY DEFAULT | OPS-RUNBOOK §3-③ | 작음 |
| 26 | premise-watch 크론 — 기본 꺼짐, 프로덕션 on 여부 미확인 | OPS-RUNBOOK | 작음 |
| 27 | `loop:demo` — CANON·CORE 가 안내하는데 main 에 없음 (#402 브랜치에만) | CANON §8 | **머지만 하면 됨** |
| 28 | zone-purity 제안 가드 — 3경로 검증 끝난 채 proposed-guard/ 대기 (그런데 vitest 가 이미 주워 돌림 + fail-open) | receipts/g-agent · 테스트 감사 T3 | 작음 |
| 29 | G 실험 session-guard 훅 — 가동 중인데 적중률 측정 약속은 잊힘 | receipts/g-agent | 작음 |
| 30 | fleet check_in — 설계 주석 남고 `const fleetLine = ''` 하드코딩 | BP §9.4 M2 | 작음 |
| 31 | 당직 루프 잔해 — watch.ts 도구는 삭제, fold(`WatchState.anchors`)·미러는 잔존, 쓰는 손 0. "당직" 개념이 산 문서에 없음 (기록 없는 반제거) | BP §9.1~9.3 | 중간 |
| 32 | 웹 delegation 의 로컬 MCP 이식 | BP §8 | 중간 |
| 33 | J7 로컬 검색 승격 게이트 — recall-index/projector 존재, 게이트 통과 기록 없음 | JCR §15.4 | 중간 |
| 34 | J8 아카이브 restore 프로덕션 게이트 실행 기록 없음 | archive/EVIDENCE-jcr-j8 | 중간 |

## §3. 계획하고 안 지은 것 — 웹 루프·표면 (17건)

| # | 항목 | 출처 |
|---|---|---|
| 35 | DLP-1 정본 케이스 상태·Next Move (`next_move` 세 존 전체 0건) | HANDOFF-08-10 §7 |
| 36 | DLP-3 나머지 절반 — adopted_judgment + research/defer/reframe | 〃 |
| 37 | DLP-4 평평한 케이스 compact close | 〃 |
| 38 | DLP-6 Desk 4그룹 IA + 단일 projection | 〃 |
| 39 | DLP-7 첫 기여가 기록 설정보다 먼저 | 〃 |
| 40 | DLP-8 타이포 스케일 정합 | 〃 |
| 41 | DLP-9 주 크롬 어휘 교체 | 〃 |
| 42 | DLP-10 현재 결정 폭 유지 | 〃 |
| 43 | **§8.1 DecisionLoopCore 심층 모듈** — 열린 DLP 4건의 공통 뿌리로 지목된 제안 | HANDOFF-08-10 §8 |
| 44 | §9 Stage C~H 실행열 | 〃 §9 |
| 45 | 구형 4-tab 퇴역 (11단계 철거 순서 문서 존재, `?step=` live) | E-doc §15.1·§15.9 |
| 46 | Progressive 분해 (3,230줄 monolith) | E-doc §15.4 |
| 47 | 웹 계정 아카이브 계약 S2·S3 (완전 restore) | E-doc §15.5 |
| 48 | BYOK 키 localStorage 탈출 | E-doc §15.3 |
| 49 | S6 durable home 사용자 표면 (손잡이 8종) | E-doc §15.8 |
| 50 | 웹 귀환 화면 (귀환 메일 returnUrl 복원 조건) | REMOTE-MCP 부록 A |
| 51 | 랜딩 히어로 "시그니처 장면" 원칙 7줄 | archive/IMPL-REPORT §11.3 |

## §4. 계획하고 안 지은 것 — MCP·플러그인·방법 (20건)

| # | 항목 | 출처 |
|---|---|---|
| 52 | 계획 수정(re-plan) — PLAN_ALREADY_ADOPTED 유일, `plan_superseded` 없음 | BP §8 |
| 53 | 형제 봉인 묶기 (16회 중 6회 쪼개짐 실측) | BP §8 |
| 54 | `INVALID_INPUT: needs checking` 막다른 거절 원인 미규명 (5연속 실측) | BP §8 |
| 55 | Antefact 제품 접점 C1~C8 (봉인 린트·정산 4값·treatment 깃발·as-of·영수증 리소스…) | BP §8 + AF |
| 56 | antefact `tripwires[]` — 스펙만, 구현 0 | antefact/SPEC §3.1 |
| 57 | MCP Apps 픽커 위젯 (리서치 완료, 승인 대기인 채 잊힘) | BP §8 |
| 58 | MCPB Desktop 번들 · `npx argus install` 범용 설치기 · Apps 위젯 2종 · Codex 플러그인 v1 | BP §8 [O4 뒤] |
| 59 | v2 미러 catch-up → read-canonical 승격 | BP §8·§9.7 |
| 60 | legacy plugin importer (items.jsonl 멱등 임포트) — "가장 중요한 미완 원장 항목" | HANDOFF-07-27 §4.3 |
| 61 | 공유 이벤트 봉투 4.2 · 테이블 projection 재분류 4.5 · 휴대용 export 4.6 · E2E 매트릭스 11종 4.7 | HANDOFF-07-27 |
| 62 | MCP·플러그인 완전 정리 Phase 2~8 (버전 폴더 해체 → 책임 이름) — "같은 이름 25종"으로 증상 재발견 | archive/PLAN-TOTAL-CLEANUP |
| 63 | R4 자산 수렴 · R5 좁은 vertical + 플러그인 승격 (게이트 뒤) | METHOD §15.6 |
| 64 | Playbook §7.6 (lesson 3개 군집 → 사용자 소유 승격) | METHOD |
| 65 | 효능 텔레메트리 §7.7 (opt-in) | METHOD |
| 66 | 성능 예산·단위 경제 리포트 (R3-B 동반) | METHOD §10.2 |
| 67 | R1 exit 판정 기록 미확인 · P0 수요 prior 해소 세션 | METHOD §15.2 · R3A §4 |
| 68 | 5차원 Patterns + 전이 코칭 카드 — v4 삭제로 기반 소멸, 개념이 산 문서에 없음 | archive/DESIGN-jkc §8 |
| 69 | 전제 알림 피드백 루프 · 강한 E2E · 구조화 API 감지(금리·환율) · 모바일 푸시 | BP §8 |
| 70 | 이른 봉인 판정 — 계기는 시공됨, **숫자를 읽는 일이 한 번도 없었음** | BP §8 |
| 71 | 두 번째 독자 (기록의 독자 확장 — 가치가 기록 순간 발생) — 창업자 결정 대기인 채 소멸 | BP §8 |

## §5. 판정만 필요한 것 — 창업자 결정 대기 (18건)

| # | 결정 | 출처 |
|---|---|---|
| 72 | HANDOFF §12 열린 결정 8 (첫 기여 종류 · Decision Case 노출 · owner/기한 필수 · Lesson 시점 · 플러그인 범위 · sea map …) | HANDOFF-08-10 §12 |
| 73 | PRODUCT.md 열린 결정 4 (카테고리 언어 · 첫 채택 상태 · 주간 리듬 · 플러그인 수렴) | PRODUCT.md |
| 74 | JCR §28 정책 6 (retention 일수 · 로컬 암호화 기본 · sync scope · forget 영수증 · export 서명 UX …) | JCR §28 |
| 75 | **ROADMAP.md 571줄의 거취** — 정본도 archive 도 아닌 유령. 교차 사용자 패턴 집계 등 어디에도 재등장 않는 아이디어 포함 | 수확 G |
| 76 | 구 로컬 stdio MCP 폐기/통합 | REMOTE-MCP §2 |
| 77 | #398 감시 엔진 브랜치 거취 | COMPLETION-PLAN 0걸음 |
| 78 | epistemic 미소비 export 49 판정 (래칫 상한만 고정) | HANDOFF-08-07 §6(D) |
| 79 | 같은 파일명 다른 내용 19종 정리 | CORE §6.4 |
| 80 | K0 봉인 F2(한 카드 승인)·F4(Vault)·F5(전송 미리보기) 후속 — 봉인이 archive 에만 존재 | archive/ADR-k0 |
| 81 | 텔레그램 3번째 귀환 채널 판단 (전제인 이메일 완주율 측정이 미실행) | BP §8 |
| 82 | 17명 에이전트 명부 거취 · 대량 due UX · 공개 rollback 계획 · 첫 100명 채널 | archive 각처 |
| 83 | 미판정 낱개: R35+ 감지 중단 제안 · tools/list_changed 통로 · 발사 빈도 튜닝 · TWIN 옵트인 토글 · 보정 도메인 분해 시점 | 각처 |
| 84 | FINDINGS 관찰 2 (선택지 저자 추적 · 봉인 기록 빈 스키마) — 2걸음 결과가 정할 것 | FINDINGS §3 |
| 85 | VoyageFilm 771줄 폐기 (가드 2개 동반 수술) — MASTER-PLAN 이 KILL 로 **제안**, D10 승인 대상 | MAP §5.1 |
| 86 | 런타임 순환 1번(control-plane 고리) 해소 방식 | CORE §6.1 |
| 87 | 이름 어휘 통일 — premise/assumption 타입 5·필드 3이름, return 어휘 5종, context 4뜻, agent/worker/persona 3ID | 웹 감사 W4·W5 |
| 88 | 문서-현실 불일치 수리 — COMPLETION-PLAN 0걸음 "머지 대기" 낡음 · README 가 은퇴한 BLUEPRINT 를 "빌드 정본"으로 안내 | 수확 · README:258 |
| 89 | 잊힌 봉인 · 실험 잔해 — 판별 B 의 M3 시계 돌기 시작한 채 방치 · 원형 C·D·F 미실행 (기각 기록 없음) | receipts/b-premise-sensor · REFOUNDATION §4 |

## §6. 확정 결함 — 즉시 수리 대상 (13건, 전부 검증 완료)

| # | 결함 | 근거 |
|---|---|---|
| 90 | 플러그인 push-webapp 락: mtime 30초 steal (MCP 가 이미 고친 버그의 사본) — 살아있는 락 도둑질 | 플러그인 감사 P1, 직접 확인 |
| 91 | semantic-v3.jsonl 을 두 writer 가 **다른 락 파일**로 지킴 = 상호배제 0 | P2, 직접 확인 |
| 92 | push-webapp HTTPS 강제 없음 — Bearer 토큰 평문 경로 | P3, 직접 확인 |
| 93 | 손 복제 3쌍(validate-gates↔validate-seal · 락 규율 · OAuth) 기계 가드 0 — 오늘은 일치 | P4 |
| 94 | 플러그인 임계구역이 쓰기만 보호 (read-check-append 락 밖 6곳) + fail OPEN/CLOSED 비대칭 | P5·P6 |
| 95 | review_receipts 삭제 기기 간 미전파 (유령·부활) | 데이터 D1, 직접 확인 |
| 96 | feedback_records updated_at 부재 — 기기 간 편집 소실 | D2, 직접 확인 |
| 97 | 스키마 변경의 리포 이탈 구조 (가드 3종 동시 실명) — 전례 2건 | D3 |
| 98 | state-machine 빈 가드 5블록 (변이 실증: 재정산 허용해도 초록) | 테스트 T1, 직접 확인 |
| 99 | atomic-write(영수증 내구성) 동작 테스트 0 | T2, 직접 확인 |
| 100 | e0-baseline 테스트가 삭제된 semantic-v4 경로를 문서에 강제 (문서 정리 시 빨간불) | T4 |
| 101 | spine 금지어휘 런타임 독자 0 — 집행은 코어 밖 별개 목록 | MCP M1, 직접 확인 |
| 102 | 반대 교리의 귀환 메일 cron 둘 동시 등록 | 웹 W2, 직접 확인 |

## §7. 폐기 기록이 있는 것 — 다시 짓지 말 것 (15군)

7 archetype router · EDQI · BLUEPRINT 본문·공정N 규약 · `watch` 어휘·PR-A3 ·
MCP sampling 추출 · 시간 기반 decline 추론 · MBTI Boss · argus_record ·
17명 플러그인 명부 · v4 shadow · semantic-v4 · landing voyage/films ·
팀/조직·제3언어(영구 보류 명기) · TUI due-inbox(위젯 대체) · stakes 진단(철회) ·
정산 id 비대칭(근거 무효).

## §8. 이행 확인된 것 (오해 방지)

notification-gate·T1~T5 문안·email-html·4-tap 정산·FirstSettlementCard·/d 공유·
/import·reforge·checkpoint 5타입·질문 규칙·seal-cost 계기·plan 3이벤트·MCP Lesson·
원격 MCP v2(OAuth 포함)·A0 연결·웹 delegation·npm provenance·standing_sense·
apply_to_matching — 전부 실재·배선 확인.

---

**다음 문서**: 이 인벤토리를 자르는 계획 —
[`ARGUS-MASTER-PLAN-2026-08-19.md`](./ARGUS-MASTER-PLAN-2026-08-19.md) (초안,
창업자 확정 전).
