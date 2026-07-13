# ARGUS DECISION KNOWLEDGE KERNEL v2

## v0에 대한 판정과 재설계 — 재건축이 아니라 승격

Date: 2026-07-14<br>
Revision: v2.0 — v0.1(`DESIGN-decision-knowledge-kernel-v0-2026-07-14.md`)에 대한
비판적 응답이자 대체 후보<br>
Status: **PROPOSAL · 코드 구현 전 · 창업자 판정 대기**<br>
Authoring context: 창업자의 명시적 요청("좋은 점은 잘 챙기고, 비판할 점은
비판해서 또 한 레이어 더 개선")으로 작성한 BLUEPRINT §7 문서 신설 금지의 계획
수립 예외. v0과 같은 지위다.<br>
Relationship:

- v0을 **대체 후보**로 제안한다. 채택되면 v0은 연구 기록(선행 체계 조사 §1–§3,
  출처 §20)으로 보존하고, 규범(헌법·온톨로지·공정)은 이 문서가 정본이 된다.
- `docs/DESIGN-judgment-record-system-2026-07-14.md`의 상위 층이라는 v0의 위치를
  계승하되, 그 문서의 Phase 0 진입 조건을 §10에서 **완화**한다 (K0–K3 → G0–G2).
- 채택 전에는 v0과 함께 BLUEPRINT §8 대기 항목이다.

방법 선언: 이 문서의 모든 "현재 코드" 주장은 2026-07-14 기준
`argus-mcp/src/v2/*`·웹 스토어·가드 테스트를 **실측**한 결과다. v0이 공개 사양
조사에 강했다면, v2는 우리 자신의 코드베이스 조사에 강해야 한다 — 빈칸을
찾는 곳이 바깥이 아니라 안이기 때문이다.

---

## 0. 한 문단 판정

v0의 가장 깊은 기여는 헌법이고, 가장 깊은 오류는 시공 전략이다. "의사결정이
어떤 지식으로 구성되고, 누가 무엇을 말할 권한이 있으며, 시간이 지나면서 어떻게
변하는가"를 제품 화면 아래의 정본으로 두자는 방향 전환은 옳다 — 이번 분기 우리가
publicCopy 누수, 표면별 어휘 분열, receipt/contract/ledger 삼중 진실을 하나씩
수리하며 몸으로 배운 것과 정확히 같은 결론이다. 그러나 v0은 "추출과 수렴"(§15)을
말하면서 공정(K1–K2)에서는 **새 스키마 패키지와 새 레퍼런스 커널의 신축**을
지시한다. 실측하면 그럴 필요가 없다: v0이 설계하자는 것의 대부분 — append-only
원장, 필드 단위 provenance, 증거 포인터, **Proposal Plane까지** — 이 이미
`argus-mcp/src/v2`에 시공되어 시험을 통과하며 돌고 있다. 따라서 v2의 한 문장은:

> **커널은 지을 것이 아니라 승격할 것이다. 헌법은 v0에서 물려받아 다듬고,
> 온톨로지는 절반으로 줄이고, 공정은 "옆에 새로 짓기"에서 "제자리 승격 뒤
> 표면 수렴"으로 뒤집는다.**

---

## 1. v0이 맞힌 것 — 그대로 채택

아래 항목은 v2에서 재논의하지 않는다. v0의 해당 절이 계속 유효하다.

1. **중심의 재발견** (v0 §0): Argus의 자산은 화면이 아니라 판단 지식 체계이고,
   Web·MCP·Plugin·Telegram은 그 항구다. 이번 분기의 실제 사고들(같은 판단이
   표면마다 다른 사실이 되는 것)이 이 명제의 증거다.
2. **헌법이 스키마보다 위** (v0 §5): schema가 허용해도 헌법을 어기는 command는
   거절된다. C1(인간 주권)·C4(append-only)·C12(정직한 미완성)는 이미
   CLAUDE.md의 LLM-glue 불변식·Zero-Judgment Gate로 살아 있는 법이다.
3. **제안 평면과 채택의 분리** (v0 §4.3, §9.3): AI 산출물은 원장에 바로 들어가지
   않고, 채택은 원본의 저자를 세탁하지 않으며, 거절·무응답을 사용자 평가에 쓰지
   않는다. v0 전체에서 가장 정확한 조각이다.
4. **판단 품질과 결과 품질의 분리** (v0 §4.1): outcome은 evidence이지 사용자
   점수가 아니다.
5. **raw ledger와 compiled memory의 분리** (v0 §4.4): summary는 materialized
   view이고 원본을 대체하지 못한다.
6. **Claim, not Fact** (v0 C3): `verified`는 진실 선언이 아니라 "누가 무엇으로
   확인했다"는 관계다. AI가 여러 번 동의해도 승격되지 않는다.
7. **fuzzy merge 금지, 명시적 alias만** (v0 §7.6): 문장이 비슷하다고 같은 판단이
   아니다.
8. **conformance는 문서가 아니라 기계 증거** (v0 §14): golden journey, authority
   negative test, unknown field 보존, stale terminal-state reversal 금지. 이 절은
   v0에서 가장 실행 가능한 부분이며 G4가 그대로 물려받는다.
9. **실패 신호와 kill criteria를 설계에 포함** (v0 §17): 비전 문서가 자기 사망
   조건을 명시한 것은 드물고 옳다. §8이 계승·강화한다.
10. **선행 체계 조사** (v0 §1–§3, §20): 연구 기록으로 영구 보존. 특히 "MCP는
    transport이지 decision semantics가 아니다"와 Palantir의
    nouns+verbs+security 삼위는 앞으로도 인용할 기준점이다.

---

## 2. v0이 틀린 것 — 여섯 비판

### 2.1 "추출"이라 쓰고 재건축을 계획했다

v0 §15은 "MCP 안에서 이미 태어난 좋은 헌법을 domain kernel로 추출"이라 말한다.
그런데 K1은 새 versioned schema package 신축, K2는 "저장소나 UI 없이" pure
TypeScript 레퍼런스 커널 신축, K3에서야 기존 소스 5종을 shadow adapter로 읽고,
K4에서 기존 MCP를 새 protocol에 **적합시킨다**. 이것은 추출이 아니라 옆에 새로
짓고 이사하는 계획이다 — 전형적인 second-system 경로다.

이 경로의 비용은 취향 문제가 아니라 우리 자신의 근원 분석이 이미 명명한 위험이다.
LLM-glue 불변식: **구조적 이중 진실은 조용한 품질 저하로 나타난다.** 새 스키마와
기존 v2 스키마가 수개월 병존하는 동안, 둘 사이의 lossless mapping은 "그럴듯하게
맞아 보이는" 상태로 표류할 수 있고, 그걸 빨간불로 만들 ground truth는 없다.
2026-06-13의 교훈(동기화 인터페이스와 실DB 컬럼의 드리프트가 조용히 행 전체를
버리던 사례)을 스키마 층에서 반복하는 셈이다.

실측이 보여주는 대안: `argus-mcp/src/v2`는 이미 다음을 갖췄다.

| v0이 "만들자"는 것 | 현재 코드의 실물 |
|---|---|
| append-only event ledger | `~/.argus/projects/{repository_id}/ledger.jsonl` + `REPOSITORY_MISMATCH` 명시 거절 |
| versioned strict schema | `events.ts` — zod discriminated union **24종**, `v: 2`, 과거 버전 영구 읽기(v1-reader의 하향 원칙 포함) |
| 필드 단위 provenance | `provenanced()` — 값과 출처가 한 몸으로만 존재 |
| 증거 포인터 | `zEvidencePointer` — byte offset + sha256 + `byte_verified > pasted > host_reported` 등급, 등급 사칭은 refine이 거절 |
| **Proposal Plane** | **candidate 축이 그대로 이것이다**: `candidate_created`(quote·화자·검증등급·증거) → `candidate_surfaced` → `candidate_action`(promote/drop/snooze). promote는 `promoted_to` 참조를 남기고 **원본은 원장에 그대로**(이동 아님) — v0 §9.3 "채택은 원본을 변조하지 않는다"의 구현이 이미 존재 |
| command→event 관문 | `bridge.ts` — "MCP 툴이 v2 원장에 쓰는 유일한 관문", envelope 조립이 한 곳 |
| reducer transition guard | `reducer.ts` — terminal 이후 재호출 거절, stale 되돌림 금지 |
| idempotency | envelope `idempotency_key` + 툴 네임스페이스 규약 |
| sync 상태머신 | outbox 4사건(`sync_pending/attempted/succeeded/abandoned`) |
| 게이트 계측 | `gate_result` — fire 판정 자체가 이벤트 |

즉 K0–K6의 절반은 이미 준공되어 있다. **v2의 공정은 이 코드를 정본으로 승격하고
(패키지 경계만 새로), 표면들을 이 위로 수렴시킨다** (§7).

### 2.2 "Minimum Viable Ontology"라 쓰고 9종 노드를 실었다

v0 §7은 스스로 최소라 부르지만 실제로는: core node 9종 + core relation 12종
(각 relation이 epistemic_state·provenance를 지닌 first-class assertion) + 3축
epistemic state + AdoptionRecord + VerificationRecord. 이것은 부인 상태의 그래프
데이터베이스다. 사용자 N=1, 실원장 결정 수십 건인 제품에서, `Question`이
`Judgment`와 별도 노드여야 한다는 증거는 아직 없다 — 현재 `seal` 이벤트의
`real_question` 필드로 충분히 살고 있다.

이것은 v0 자신의 C7(필요 최소 구조)을 온톨로지 설계 자체에 적용하지 않은 것이고,
CLAUDE.md의 mirror clause(over-fire도 spine 위반)를 개발자 쪽에서 범한 것이다:
모든 판단에 9종 노드의 자리를 마련하는 것은 평평한 판단에 의식을 제조하는 일이다.
§4에서 committed 4종 + proposal 1평면으로 줄인다.

### 2.3 4-역할 provenance를 하루아침에 wire format으로 요구했다

originator/recorder/adopter/verifier 분리(v0 §4.2, §9)는 **의미론으로서 옳다.**
그러나 v0은 이를 새 `ContentProvenance` 구조체 + ActorRef + 별도
AdoptionRecord/VerificationRecord 테이블로, 즉 기록 시점의 필수 표현으로
설계했다. 현재의 `PROVENANCE` enum(`elicited_user/direct_user_command/
host_reported/ai_surfaced`)은 v0 말대로 capture method와 semantic origin을 한
축에 섞지만 — **집행되고 시험된다**: v1-reader는 하향만 허용하고("위로 위조
금지"가 테스트 문구다), `byte_verified` 사칭은 스키마가 거절한다.

v2의 결정: **4-역할은 파생 뷰로 먼저 산다.** `(provenance enum × event 종류 ×
candidate 계보)`에서 네 역할을 결정론적으로 유도할 수 있다 —

```text
originator  ← provenance(elicited_user/direct_user_command → user;
              ai_surfaced → model; host_reported → unknown 하향)
recorder    ← envelope(producer_version + surface)
adopter     ← candidate_action(promote).actor — 현재는 정의상 user뿐
verifier    ← premise_recheck / evidence 등급 — method는 현재 두 가지뿐
```

유도가 불가능한 실사례가 G0 red-team에서 나올 때만 wire에 필드를 추가한다.
이벤트 이름·기존 필드는 어떤 경우에도 개명하지 않는다(내구 데이터 호환 —
창업자 확정). 새 의미는 언제나 **새 optional 필드 또는 새 이벤트**다.

### 2.4 집행 지점이 비어 있다 — 커널은 서버가 아니라 라이브러리다

v0의 authority 표(§11.3)는 "Kernel이 거절한다"고 쓰지만, local-first 세계에서 그
Kernel이 **어느 프로세스에서 도는지**를 말하지 않는다. 실제 지형: MCP 커널은
사용자 기계의 로컬 프로세스다. 웹은 localStorage 우선에 Supabase RLS다. 중앙
authority 서버는 없고, 만들면 local-first(C9)와 모순된다.

정직한 답을 헌법에 못박아야 한다(§3 C14): **커널은 각 표면이 링크하는
라이브러리이고, 따라서 C1(인간 주권)의 보증은 "커널 패키지를 통해서만 원장에
쓴다 + conformance suite가 그 사실을 감시한다"는 두 겹이다.** 악의적 클라이언트가
JSONL에 직접 쓰는 것까지 막는 보증이 아니다 — 그건 사용자 자신의 파일이므로
막아서도 안 된다. 우리가 막는 것은 *우리 코드*의 우회이고, 그 집행 수단은
가드 테스트다(웹의 "store가 supabase.from을 직접 부르지 못한다" 규약과 동형).

### 2.5 헌법에서 빠뜨린 두 조항 — 삭제권과 정체성

**삭제권.** v0은 "deletion과 append-only 충돌"을 §18 미결표에 주차했다. 판단
원문이 Supabase로 동기화되는 제품에서 이것은 주차 가능한 질문이 아니다 — 이미
계정 삭제·내보내기 누락 사고(2026-07-03, decision_items·review_receipts)를 겪고
`erasure-coverage.test.ts`라는 헌법급 가드를 만들었다. 원칙은 이미 발견되어
있으므로 조문화만 하면 된다(§3 C13): **append-only는 "정본 안에서 역사를
다시 쓰지 않는다"이지 "정본을 파기할 수 없다"가 아니다.** 재작성 금지는
시스템의 의무, 파기는 사용자의 권리다.

**정체성.** v0 §7.6은 alias 해석을 다뤘지만, 이 코드베이스의 진짜 어려운 정체성
문제는 그보다 앞에 있다: MCP 원장은 `registry.json`(git_common_dir 실경로 →
repository_id)으로 **저장소 단위**로 나뉘고, 웹은 git이 없는 **계정/익명
단위**다. "표면은 여러 개, 원장은 하나"가 성립하려면 두 네임스페이스를 잇는
공간 모델이 필요하다. v2는 이름만 확정하고(`space`: repo space / personal
space) 병합 규칙은 G2의 실데이터로 결정한다(§5). 이 질문을 건너뛴 채 alias
resolver를 설계하면 없는 문제를 풀고 있는 것이다.

### 2.6 §19가 §15.3과 모순된다

v0 §15.3은 "문서 ontology와 코드 schema를 별도 관리하지 않는다. schema가
executable SSOT"라고 옳게 선언하고, §19는 후속 문서 7종(정본 후보, normative
example 20건, 권한표, mapping, schema proposal, fixture spec, 통합 공정표)을
계획한다. 그 7종의 올바른 서식은 문서가 아니라 **코드**다: 헌법 조항은 가드
테스트로(각 조항당 최소 1개의 failing fixture — v0 K0 exit가 이미 이렇게 말한다),
normative example은 fixture 디렉터리로, 권한표는 authority matrix 타입 +
negative test로, mapping은 adapter + round-trip 테스트로. 산문으로 남길 것은
헌법 전문과 의도뿐이며, 그것은 이 문서 §3 하나로 족하다. DESIGN-* 증식 금지는
CLAUDE.md의 제1규칙이기도 하다.

---

## 3. Decision Knowledge Constitution v1

v0 C1–C12를 계승하되 세 조항을 수정하고 두 조항을 신설한다. 전문이 정본이며,
채택 시 각 조항은 같은 커밋에서 최소 1개의 집행 지점(스키마 refine, reducer
guard, 가드 테스트)과 연결되어야 한다 — 집행 지점 없는 조항은 조항이 아니라
소망이다.

- **C1. Human Sovereignty** — 유지. 집행 실물: `predicate_owner` 검증,
  reducer의 terminal guard, 공개 표면에서 AI가 seal/settle을 대행할 수 없는
  스키마 경계. *(v0 원문 유지)*
- **C2. No Authorship Laundering** — 유지하되 표현 수단을 수정: 4-역할은
  의미론이고, wire는 현행 provenance enum + 파생 뷰다(§2.3). 하향만 허용
  ("위로 위조 금지"), 불명은 `host_reported/unknown`.
- **C3. Claim, Not Fact** — 유지. 집행 실물: `premise_recheck.result`와 증거
  등급이 "확인"의 유일한 어휘이고, 어디에도 `is_true`가 없다.
- **C4. Append, Do Not Rewrite History** — 유지. 집행 실물: `amend`류 이벤트가
  새 사건을 만들 뿐 과거 행을 덮지 않는다. **단서 신설**: C13의 파기권과
  충돌하지 않는다 — 재작성 금지와 파기 가능은 양립한다.
- **C5. Return Is Semantic** — 유지. `check_by`·`snooze`는 지식 구조, 채널
  전달 실패는 delivery state.
- **C6. Outcome Is Not Verdict on the Person** — 유지. 집행 실물:
  judgment_tier/judgment_score 영구 null 가드, 빈도 문장만 허용.
- **C7. Minimal Necessary Structure** — 유지 + **적용 범위 확장**: 이 조항은
  사용자 표면만이 아니라 **온톨로지 설계 자체**에 적용된다(§2.2). 노드 종류의
  추가는 그것 없이는 표현 불가능한 실원장 사례가 있어야만 한다.
- **C8. Deterministic Spine, Generative Edges** — 유지. 이미 F3/F4(결정론
  라우터·선언된 DAG)로 살아 있는 원칙의 커널판.
- **C9. Local Ownership and Portability** — 유지. 원장은 사용자 기계의 파일이고
  sync는 복제다.
- **C10. Model Independence** — 유지. AI artifact에는 run provenance,
  커널 패키지는 model SDK를 import하지 않는다.
- **C11. Explain Retrieval** — 유지하되 지위 조정: ContextPack이 core 계약이
  아니라 **기존 세 소비자의 공통 반환형**으로 산다(§6). 원칙(포함 이유·기준
  시점 기록)은 그대로.
- **C12. Honest Incompleteness** — 유지. `unfilled`·명시적 unknown·빈 맥락이
  그럴듯한 기본값보다 낫다.
- **C13. Right of Erasure (신설)** — 원장 재작성은 금지되지만 파기는 사용자의
  권리다. 로컬 원장의 파기는 파일 삭제로 완결된다. 원장에서 파생되어 서버에
  복제된 모든 projection은 열거 가능해야 하며(웹의 USER_DATA_TABLES 규약과
  동형), 계정 삭제·내보내기가 그 열거를 소비한다. **동기화되는 새 projection의
  추가 = 같은 커밋에서 erasure 열거 갱신**, 아니면 CI가 막는다.
- **C14. Enforcement Locus (신설)** — 커널은 라이브러리다. C1–C13의 보증 범위는
  "커널 관문을 통과하는 모든 쓰기"이고, 관문 우회 금지의 집행 수단은 각 표면의
  가드 테스트 + 교차 표면 conformance suite다. 중앙 authority 서버를 세우지
  않으며, 그것이 보증의 정직한 한계임을 문서화한다(사용자 자신의 파일 직접
  편집은 권리이지 위협이 아니다).

---

## 4. 온톨로지 다이어트 — 이미 배로 지어진 것 위에

### 4.1 committed 4종 + proposal 1평면

v0의 9종을 다음으로 줄인다. 오른쪽 열이 핵심이다: **모두 현행 이벤트 축에
이미 대응물이 있다.** 새 개념의 발명이 아니라 있는 것의 이름 정리다.

| v2 committed 종류 | 뜻 | 현행 실물 (이벤트 축) |
|---|---|---|
| `DecisionRecord` | 사용자가 소유한 판단의 aggregate root | 결정 축: `harvest → seal → amend/snooze → settle\|dismiss` |
| `Claim` | 판단이 기댄 전제·사실·열린 질문 | 전제 축: `premise_add(kind: premise\|fact\|question) → premise_amend/recheck/resolve` |
| `ReturnContract` | 언제·무엇으로 현실과 다시 만나는가 | `seal.check_by` + `snooze.until` + `premise_add.recheck_cadence_days` |
| `Observation/Settlement` | 현실이 한 일 + 인간 권한의 종결 | `settle(outcome, note)` + `premise_recheck(result)` — 이미 human-gated |

| v2 proposal 평면 | 현행 실물 |
|---|---|
| 후보 (AI/스캔이 발견한 인용) | candidate 축 전체 — quote·화자·검증등급·증거 포인터·`surfaced` 이력·promote/drop/snooze |

v0 노드 중 나머지 5종의 처분:

- `Question` → `seal.real_question` 필드로 계속 산다. 독립 노드 승격은 "한
  질문에 여러 판단이 명시적으로 매달린 실사례"가 G0에서 나올 때만.
- `Evidence` → 이미 **값 타입**(`zEvidencePointer`)으로 존재하며 그게 더 옳다.
  노드로 승격하면 참조 무결성 관리만 늘고 얻는 게 없다.
- `Checkpoint`와 `ReturnPromise`의 분리 → 통합(`ReturnContract`). 현재 코드에서
  둘을 나눠야 했던 사례가 없다. "확인할 질문"과 "돌아올 때"가 독립으로 여러 개
  매달리는 실사례가 나오면 그때 나눈다.
- `Reflection` → 확장 보류. 오늘 출시한 `argus_patterns view=reflection`이 읽기
  표면이고, 쓰기는 `settle.note`가 담당 중이다. "결과 기록"과 "배움"이 한
  필드에 뭉개져 문제가 된 실사례가 나오면 `reflection` **이벤트**(노드 아님)를
  추가한다.
- `ContextSnapshot` → 확장 보류. append-only 원장에서 `as_of(봉인 시점)` 재생이
  이미 가능하므로(reducer를 그 시점까지 fold), 별도 manifest는 성능 최적화가
  필요해질 때의 캐시다. 의미론이 아니라 구현 세부다.

### 4.2 관계도 다이어트

v0의 12종 first-class relation(각각 epistemic_state·provenance를 지닌 assertion)
대신, v2의 관계는 **이벤트 payload의 참조 필드**다: `premise_add.decision_id`
(relies_on), `candidate_action.promoted_to`(adoption), `premise_add.from_candidate`
(derived_from), settle의 broken premise 참조(challenged_by). 관계의 provenance는
그 관계를 만든 **이벤트의** provenance다 — 별도 assertion 객체가 필요 없다.
연결 읽기(`same_premise`/`shared_fact`)는 이미 `connection.ts`가 결정론으로
계산하는 **파생**이며, 저장하지 않는 것이 옳다(C8).

`causes`/`proves`/`is_true` 제외는 v0 그대로 계승한다.

### 4.3 Adoption — 새 서브시스템이 아니라 있는 패턴의 일반화

v0의 AdoptionRecord가 요구하는 성질 세 가지: (a) 원본 보존, (b) 채택이 별도
사건, (c) 수정 채택 시 계보 유지. candidate 축이 셋 다 이미 만족한다:
`candidate_action(promote)`가 별도 사건이고, 원본 candidate는 원장에 그대로
남으며, 승격된 premise가 `from_candidate`로 계보를 가리킨다. v2에서 할 일은
이 패턴을 "candidate → premise" 한 쌍에서 **모든 proposal → committed 이동의
유일한 문법**으로 승격 선언하는 것뿐이다. 새 테이블·새 이벤트 불필요.

### 4.4 시간 모델

envelope에 이미 `occurred_at`·`logical_date`·`tz`가 있고 기록 시점은 append
순서가 담보한다. v0의 `valid_from/valid_until`은 보류 — 전제의 시간 변화는
`premise_recheck(result: holds|drifted|broken)`가 이벤트로 담고 있어서, 유효
기간 필드가 없어 표현 못 한 실사례가 아직 없다. 회고 기록(`origin: retro`)의
occurred/recorded 분리 요구는 웹 어댑터(G2)의 계약 테스트로 들어간다.

---

## 5. 정체성 — space 모델 (이름만 확정, 규칙은 증거로)

```text
space = repo space (registry.json: git_common_dir → repository_id)   ← 현행
      | personal space (계정 단위; 웹·Telegram의 기본 서식)            ← 신설 예정
```

확정하는 것: 두 종류의 space가 존재한다는 사실, space를 넘는 자동 병합은 없다는
것(C2·fuzzy merge 금지), 연결은 명시적 bridge 사건으로만 생긴다는 것.

G2에서 증거로 결정하는 것: personal space의 원장 위치(웹 localStorage의 이벤트
로그인가, Supabase가 첫 저장인가 — C9와의 긴장을 실측으로 푼다), repo space
결정이 personal space에 언제·어떻게 투영되는가(현행 sync outbox의 연장인가).

이 절이 v0의 alias 해석 규칙(§7.6)을 대체하는 것은 아니다 — 그 규칙들은 space
**안**에서 그대로 유효하다. 이 절은 그 앞의 질문이다.

---

## 6. Context Compiler → 세 소비자의 공통 반환형

일반 컴파일러를 먼저 짓지 않는다(rule of three). 현재 "과거 판단을 지금 맥락에
다시 채우는" 실소비자는 정확히 셋이다:

1. SessionStart 훅의 due 한 줄 주입 (플러그인)
2. capture 시점 연결 표면 (`connection-io.ts` — 오늘 출시)
3. `argus_patterns view=reflection` (오늘 출시)

G1에서 이 셋의 반환형을 하나의 얇은 `ContextSlice` 타입으로 통일한다: 포함된
항목마다 `{id, 포함 이유, 기준 시점}` — C11의 원칙을 지금 있는 코드에 소급
적용하는 것이고, 그게 전부다. purpose enum·token budget·excluded count는 네
번째 소비자가 실제로 등장해 필요를 증명할 때 추가한다. "AI 요약만 있고 원문
포인터 없는 항목을 load-bearing으로 쓰지 않는다"는 v0의 불변식은 `ContextSlice`
의 스키마 제약으로 지금 넣는다(증거 포인터 optional이되, 없으면 load_bearing
불가 — refine 한 줄).

---

## 7. 승격 공정 G0–G4

각 단계는 **시간상자**를 갖는다(세션 수로 표기; 초과 시 자동 중단·재평가 —
§8.3). 각 단계는 끝났을 때 사용자 또는 다음 단계가 소비하는 실물을 남긴다.
어떤 단계도 퍼널 단계의 수리를 막지 못한다 — 커널 공정과 제품 공정이 경합하면
제품이 이긴다(솔로 창업자 예산의 명시).

### G0 · 실원장 red-team — 상자: 2세션

v0 K0의 정신을 계승하되 재료를 바꾼다: **발명한 픽스처 20건이 아니라, 창업자의
실제 도그푸딩 원장에서 실결정을 익명화해 쓴다.** 이미 12시나리오 도그푸딩
하네스가 있다 — 그 실데이터가 발명 픽스처보다 반증 능력이 세다. 모자라는
유형(회고, 애매 정산, 협업)만 발명으로 보충한다.

- 각 결정을 §4의 4종+1평면으로 표현해 본다 — 표현 불가 사례가 나오면 그것이
  확장 승격의 첫 증거다.
- 헌법 C1–C14 각각에 대해 "이 조항을 어기는 이벤트 시퀀스" fixture를 만들고
  현행 코드가 실제로 거절하는지 확인한다. 거절 못 하면 그 간극이 G1의 작업
  목록이다.
- 4-역할 파생(§2.3)을 실원장에 돌려 유도 불가 사례를 센다.

**Exit**: 실결정 표현 손실 0 또는 명시적 확장 요구 목록 / C1–C14 × fixture
대조표(통과·간극) / 4-역할 파생 실패 사례 수와 판정.

### G1 · 제자리 승격 — 상자: 2세션

`argus-mcp/src/v2` → `@argus/kernel` 워크스페이스 패키지. **스키마 변경 0,
이벤트 개명 0, 동작 변경 0** — 이동과 경계 선언뿐.

- 경계 규칙을 lint/테스트로: 커널 패키지는 MCP SDK·model SDK·React·Supabase를
  import하지 않는다(v0 §6.7 계승 — 이 부분 v0이 옳다). 스토리지는 현행 JSONL
  구현을 `EventStore` port 뒤로.
- G0에서 발견된 헌법 간극 중 "새 optional 필드/이벤트로 풀리는 것"만 여기서
  수리한다.
- `ContextSlice` 통일(§6)을 여기서 한다 — 세 소비자 모두 커널 패키지의 타입을
  쓰게 된다.
- MCP 서버는 이 패키지의 첫 소비자로 리팩터링된다. 780개 시험 전부 초록 유지가
  회귀 기준.

**Exit**: 패키지 경계 lint 초록 / 기존 전체 시험 초록 / MCP 툴 계약 회귀 0
(공개 6도구 표면 불변) / import 위반 0.

### G2 · 첫 수렴 — 웹이 같은 reducer로 읽는다 — 상자: 3세션

웹이 커널 패키지를 링크하고, sync outbox로 서버에 복제된 이벤트를 **MCP와
동일한 reducer로 fold**해서 읽는다. 쓰기는 아직 기존 경로 그대로(§10의
judgment-record Phase 1 shadow comparison과 접합하는 지점이 정확히 여기다).

- space 모델(§5)의 미결 둘을 실데이터로 판정한다.
- due count의 shadow 대조: 기존 웹 계산 vs 커널 fold — 숫자 단위 일치.
- 회고 기록의 occurred/recorded 분리 계약 테스트.
- C13 집행: 이 수렴으로 서버에 새로 놓이는 모든 projection을 erasure 열거에
  같은 커밋으로 추가.

**Exit**: shadow mismatch 0 / space 판정 2건 기록 / erasure 열거 초록 /
성능(현행 10k replay 기준선 대비 회귀 없음).

### G3 · 첫 명령 — 웹 settle이 커널 command로 — 상자: 2세션

수직 1종만: 웹의 정산 쓰기를 커널 관문(bridge 동사)으로 이관한다. v0 K5의 "한
번에 한 vertical event만"을 계승하되 첫 동사를 settle로 확정한다 — 이유: 이미
reducer의 terminal guard·멱등성이 가장 두꺼운 곳이라 커널의 가치(stale 되돌림
금지, 중복 정산 금지)가 즉시 사용자 보증으로 나타난다.

**Exit**: 웹→커널 settle의 golden journey 반쪽(MCP seal → 웹 settle → 같은
record 종결) 실측 / stale client 되돌림 negative test / feature flag rollback
실증.

### G4 · conformance suite 정본화 — 상자: 2세션

v0 §14를 거의 그대로 실행한다(그 절이 v0의 최고 자산이다): golden journey
전 구간, authority negative, unknown field 보존, idempotency, 신규 표면 승인
7항목. 여기서부터 "새 표면 추가"는 이 suite 통과가 정의다 — Telegram·Plugin의
커널 수렴은 G4 이후 각각 독립 수직으로 진행하며, 이 문서는 그 순서를 미리
정하지 않는다(증거로 정한다).

**Exit**: suite가 CI에서 MCP(전체)와 웹(read+settle) profile로 초록 / 승인
기준 문서화가 suite README 하나로 완결(추가 DESIGN 문서 0).

---

## 8. 판정 기준

### 8.1 성공 증거 — v0 §17.1 계승, 두 항목 교체

v0의 8항목 중 "새 surface가 conformance profile만으로 호환"·"vendor-neutral
export"는 유지. "한 query로 4-역할 답변"은 **파생 뷰로 답하면 성공**으로 완화.
추가:

- 커널 승격 전후 사용자 체감 표면(공개 6도구, 웹 여정)의 회귀 0 — 승격은
  사용자에게 **보이지 않아야** 성공이다.
- 같은 결정의 MCP 봉인·웹 정산이 실사용 1건에서 성립 (G3 exit의 실사용판).

### 8.2 실패 신호 — v0 §17.2 계승 + 추가

v0의 9신호 전부 유효. 추가:

- G-단계가 시간상자를 넘기며 "거의 다 됐다"가 반복됨 (second-system의 냄새)
- 커널 작업이 퍼널 수리를 지연시킴 (예산 위반)
- 파생으로 답할 수 있는 질문에 새 저장 구조가 생김 (C7·C8 위반)

### 8.3 Kill criteria

- **G0 kill**: 실원장 결정들이 4종+1평면으로 손실 없이 표현되고 헌법 fixture가
  현행 코드로 이미 전부 통과한다면 — 즉 간극이 없다면 — G1의 패키지 추출만
  하고 G2 이후를 중단한다. 간극 없는 추상화는 야심이지 필요가 아니다.
- **시간상자 kill**: 어느 단계든 상자 2배 초과 시 무조건 중단하고, 남은 것을
  BLUEPRINT §8로 되돌린다. "매몰 비용" 없이 — 각 단계가 독립 가치를 남기도록
  설계된 이유가 이것이다 (G1만 해도 경계 선언의 가치가 있고, G2만 해도 웹
  읽기 통일의 가치가 있다).
- v0의 kill(구조가 free-text + append history보다 명확한 이점을 못 만들면
  온톨로지 확장 중단)은 확장 승격 심사 기준으로 상시 유효.

---

## 9. v0에서 삭제한 것과 이유 (한눈표)

| v0 항목 | v2 처분 | 이유 |
|---|---|---|
| K1–K2 신축 (schema package + in-memory 레퍼런스 커널) | 삭제 → G1 제자리 승격 | 이중 진실 위험(§2.1); 레퍼런스는 이미 프로덕션에 있다 |
| core node 9종 | 4종+1평면, 5종은 증거 대기 | C7을 온톨로지 자신에 적용(§2.2) |
| first-class relation 12종 | 이벤트 payload 참조 + 결정론 파생 | 관계 provenance는 이벤트 provenance로 충분(§4.2) |
| ContentProvenance 4-역할 wire 구조 | 파생 뷰, wire는 현행 enum | 집행되는 enum > 아름다운 미집행 구조(§2.3) |
| AdoptionRecord/VerificationRecord 신설 | candidate promote 패턴의 일반화 선언 | 이미 구현돼 있다(§4.3) |
| ContextPack + Compiler 일반화 | `ContextSlice` — 세 실소비자의 공통형 | rule of three(§6) |
| DKK 7-profile capability 매트릭스 | G4 suite의 profile 2종(MCP 전체·웹 부분)부터 | 표면 2개가 실제 수렴하기 전의 7분류는 로드맵 그림(§13은 그때 다시) |
| §19 후속 문서 7종 | 코드(fixture·테스트·suite README)로 흡수 | §15.3과의 자기모순 해소(§2.6) |
| graph DB·RDF export 보류 | 동일하게 보류 (v0과 일치) | — |

삭제는 아이디어의 폐기가 아니라 **증거 대기열로의 강등**이다. 되살리는 문법은
언제나 같다: G0/실사용에서 그것 없이는 표현·집행 불가능한 사례 1건.

---

## 10. `DESIGN-judgment-record-system`과의 관계 재정의

그 문서의 Phase 0 entry는 "K0–K3 통과 또는 명시적 예외"를 요구했다. v2 채택 시
이렇게 완화된다:

- Phase 0 (설계 봉인) — **G0과 병행 가능.** 어휘·생애주기 봉인은 커널 승격과
  독립이다.
- Phase 1 (통합 읽기 모델) — **G2와 같은 작업의 두 얼굴이다.** judgment-record의
  `DecisionRecordView` projection과 v2의 "웹이 커널 reducer로 읽기"를 별도로
  두 번 짓지 않는다: Phase 1의 source adapter가 커널 fold를 소비하는 형태로
  한 번만 짓는다. 이 접합이 v2가 그 문서에 주는 가장 실질적인 수정이다.
- Phase 2 이후 (Return Desk·영수증·기록실·지도) — 커널과 독립적으로 진행
  가능하되, 쓰기 이관(Phase 3의 정산 계약)은 G3와 접합한다.

그 문서의 제품 결정(1–11), 화면 설계, 검증 매트릭스는 이 문서가 건드리지
않는다 — 상위 층은 하위 층의 UI를 소유하지 않는다.

---

## 11. 봉인

v0이 바깥의 선행 체계 조사로 증명한 것: 조각들은 발명되어 있고, 빈칸은 "인간만
판단을 소유한다"는 헌법 아래의 조합이다. v2가 안의 코드베이스 조사로 증명한
것: **그 조합의 절반은 이미 우리 손으로 시공되어 시험을 통과하며 돌고 있다.**
따라서 남은 일은 상상한 커널을 짓는 것이 아니라, 이미 있는 커널에 헌법의
이름을 붙이고, 경계를 세우고, 표면들을 하나씩 그 위로 수렴시키는 것이다.

> **모델은 바뀌고 화면은 복제된다. 남는 것은 사용자가 쌓은 원장과, 그 원장의
> 의미를 어느 표면에서도 똑같이 집행하는 헌법이다. v2의 전부는 그 둘을 지금
> 있는 코드에서 출발시키는 것이다.**

채택 판정 요청 — 창업자가 정할 것: (1) v0 대비 v2 채택 여부, (2) 채택 시
BLUEPRINT 공정표에 G0–G4를 어느 위치로 편입할지 (현행 미완 exit들과의
우선순위), (3) G0의 실원장 재료 제공(도그푸딩 원장 익명화) 승인.
