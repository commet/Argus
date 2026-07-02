# PLAN — Living Premises for argus-mcp (the model-agnostic surface)

- 날짜: 2026-07-02
- 상태: **계획(Phase 1, mcp-builder)** — 구현 전. 확인 후 착수.
- 왜: decision-items/living-premises를 **Claude Code 플러그인이 아니라 `argus-mcp`(MCP 서버,
  모델-무관)** 에 짓는다. 어떤 MCP 호스트(Claude/ChatGPT/Gemini)에서도 돌게.
- 근거 조사: argus-mcp 심층 맵(이 세션) + mcp-builder Phase 1(best-practices·TS 가이드).
- 관련: `docs/DESIGN-decision-items-living-premises-2026-07-01.md`(개념·스파인), `argus-mcp/README.md`.

---

## 0. 원칙 (사용자 지시)

1. **이식 아님 — 컨셉으로 재설계.** 순수 알고리즘(drift 판정)만 깨끗이 이식, 저장·툴 계층은
   argus-mcp 모델에 맞춰 새로 짓는다.
2. **겹침 회피.** 이미 있는 `unverified_assumption`/`load_bearing_assumption`을 일반화(1→N),
   병렬 시스템 신설 금지.
3. **기존 스타일 일치.** 저수준 `Server` + JSON Schema + 수동검증(Zod 아님) + 봉투(envelope)
   출력 + `argus_` snake_case 동사 + 판정 동사 금지(drift-guard). (mcp-builder는 Zod 권장이나
   서버 전체가 저수준이라 일치가 우선 — 마이그레이션은 별도 서버 결정.)
4. **프로덕트 완성.** 사용자 여정 전체가 MCP 툴로 실제 작동 + 테스트 + eval.

---

## 1. 사용자 여정 → 툴 매핑

기존 루프: `open_decision → seal → (check_in) → settle`, 회상 `recall`, 조정 `amend`/`dismiss`.
살아있는 전제가 얹히는 지점:

```
open_decision ──▶ [NEW] add_premises ──▶ [NEW] amend_premise ──▶ seal
   (결정 염)        (결정을 전제 N개로 분해)   (AI가 뽑은 전제 편집=신호)   (헤드라인 전제 포함)
                                                                        │
                          settle ◀── [NEW] reconsider ◀── [NEW] recheck_premise ◀── check_in(+due 전제)
                        (영수증에 전제)   (미결 재고)        (현실과 재확인=drift)     (재확인 due 표면화)
```

## 2. 신규 툴 (argus_ 규약, 저수준 스타일)

| 툴 | 목적 | 주요 입력 | 주석(annotations) |
|---|---|---|---|
| **`argus_add_premises`** | 결정을 추적 가능한 **전제 집합**으로 분해(호스트/AI가 뽑거나 사용자가 제공). 기존 단수 assumption의 일반화 | `argus_dir`, `id`, `premises[]`{text, kind(premise\|phenomenon\|open_question), external:bool, load_bearing:bool, source(ai\|user), ai_original?} | readOnly:false, idempotent:false |
| **`argus_amend_premise`** | 전제 하나 편집 = **신호**(refine/replace/retire). `ai_original`↔최종 보존(override 신호). 저작권 사용자 | `argus_dir`, `id`, `premise_id`, `action`(accept\|refine\|replace\|retire), `text?`, `note?` | readOnly:false, idempotent:false |
| **`argus_recheck_premise`** | **살아있는 재확인.** 호스트가 현재 사실값을 넘기면 툴은 **순수 drift 판정**(수치 임계/텍스트) → 바뀌었는지 + 되돌아볼지. **툴은 네트워크 안 함**(호스트가 웹검색) | `argus_dir`, `id`, `premise_id`, `current_value`(호스트가 조사한 현재 사실), `today_override?` | readOnly:false, idempotent:false |
| **`argus_reconsider`** | 사용자가 **명시로 남긴 미결**(open_question)을 예시 lean 2개와 함께 재고, 결정을 사용자 저작으로 기록. (닫은 결정 자동 재오픈 금지=mirror clause) | `argus_dir`, `id`, `premise_id`, `decision?`(사용자 결정 텍스트) | readOnly:false, idempotent:false |

**확장(신규 아님):**
- `argus_recall` 에 `view: 'premises'` 추가 — 결정의 전제 목록·상태·편집이력·재확인 due.
- `argus_check_in` 에 due 전제 재확인 포함 — "재확인할 전제 N개"(overdue 계약과 별개 라인).
- `argus_open_decision`/`argus_seal` — `load_bearing_assumption`/`unverified_assumption`을
  전제 집합의 **첫 전제**로 자동 승격(연결, 중복 저장 아님).

**next_actions 열거(닫힌 enum) 갱신:** `argus_add_premises`·`argus_amend_premise`·
`argus_recheck_premise`·`argus_reconsider` 추가 (envelope.ts NEXT_ACTIONS).

## 3. 저장 모델 — 기존 원장 확장

기존 `ledger.jsonl` 이벤트에 전제 이벤트 추가(append-only, 같은 원장, id로 fold):

```
premise_add     {id, premise_id, kind, text, external, load_bearing, source, ai_original?, ts}
premise_amend   {id, premise_id, action(accept|refine|replace|retire), from, to, ts}
premise_recheck {id, premise_id, last_value, current_value, drifted:bool, ts}
premise_resolve {id, premise_id, decision, ts}   // open_question → 사용자 결정
```

- `state-machine.ts`의 `LedgerEventType`에 4종 추가, `ledger-replay.ts` fold에 case 추가 →
  각 contract에 `premises: Map<premise_id, PremiseState>` 접힘.
- **불변식 유지:** `ai_verdict:null`, 판정 동사 없음, `skipped[]` 가시성, 편집이력 append-only.
- `premise_id` = 안정 해시(decision id + kind + 정규화 텍스트) — 재-add 시 grade 안 잃음
  (webapp `stableItemId` 개념 재사용, 구현은 argus-mcp 유틸로).

## 4. 재사용 vs 새로 짓기 (정직하게)

| 조각 | 처리 |
|---|---|
| **drift 판정 알고리즘**(수치 10%·부호반전·텍스트 변화) | ✅ 순수 함수라 **깨끗이 이식**(webapp `premise-drift.ts` → `argus-mcp/src/lib/premise-drift.ts`, 의존성 0). 단, 발화 게이트(빈도캡·후퇴)는 MCP 모델(원장 recheck 이벤트)로 재구성 |
| **전제 항목 스키마 개념** | ♻️ 개념만 — 저장은 ledger 이벤트로 재설계(webapp `DecisionItem` verbatim 아님) |
| **알림 기본값 opt-out·mirror clause·직설 카피** | ✅ 스파인 원칙 그대로 적용 |
| **webapp/플러그인 코드** | ❌ 이식 안 함 — MCP는 독립. (webapp Supabase, MCP는 `.argus/` 로컬) |

## 5. 스타일·검증·에러 (기존 일치)

- **입력검증:** 수동 `isOneOf()` + `GuardError(code, message, recovery)`. Zod 안 씀.
- **출력:** `ArgusEnvelope{ok, tool, surface(한 줄, 스파인-safe), next_actions, data, over_fire_gate?}`
  + `content[text]` 미러 + `outputSchema`(ENVELOPE_OUTPUT_SCHEMA 재사용).
- **에러코드 예:** `NO_SUCH_PREMISE`, `PREMISE_RETIRED`, `RECHECK_NO_BASELINE`(첫 재확인=baseline만),
  `NOT_AN_OPEN_QUESTION`(reconsider 대상 아님). 전부 recovery 힌트 동봉.
- **직렬화:** 기존 serialize 체인 그대로(원장 동시쓰기 방지).

## 6. 테스트 + 평가 (mcp-builder Phase 3·4)

- **유닛(vitest, tmpArgusDir/body/isError):** 각 툴 happy+에러; drift 시나리오(baseline→캡→발화→
  침묵→후퇴→텍스트 flip); override 집계; open_question 재고; ai_verdict:null drift-guard 유지.
- **eval 10문항(mcp-builder):** 현실적 다툴 시나리오(전제 분해→편집→재확인→정산) read-only 검증.
- `npm run build && npm run typecheck && npm test && npm run eval` green 게이트.

## 7. ⚠️ 코디네이션 (실무 최대 리스크)

**그 다른 세션이 지금 argus-mcp를 깊게 파고 있어.** 내가 같은 패키지에 기능을 얹으면
**핵심 파일에서 충돌** 확실: `tools/index.ts`(TOOLS 배열), `envelope.ts`(NEXT_ACTIONS enum),
`state-machine.ts`(LedgerEventType), `ledger-replay.ts`(fold). 이건 지난번 등록부 충돌보다 깊어.

**옵션:**
- **(A)** 내가 신규 파일(`tools/premises-*.ts`, `lib/premise-drift.ts`)로 최대한 격리 + 공유 4파일은
  **append만** 하고 그 세션과 "먼저 머지하는 쪽에 rebase" 규약. 
- **(B)** 순서 조율 — 그 세션이 현재 작업 머지 후 내가 착수(충돌 최소).
- **(C)** 계획서를 그 세션에 넘겨 **그쪽이 구현**(argus-mcp 소유권 일원화).

→ **이건 사용자가 정해야 함.** 두 세션이 동시에 같은 MCP 코어를 건드리는 건 위험.

## 8. 구현 순서 (의존)

1. `lib/premise-drift.ts`(순수 이식) + 유닛.
2. 원장 이벤트 4종(state-machine·replay·fold) + 유닛.
3. `argus_add_premises` + `argus_amend_premise` + 유닛.
4. `argus_recheck_premise`(호스트-값 순수판정) + 유닛.
5. `argus_reconsider` + 유닛.
6. `recall.view='premises'` + `check_in` due 전제 + open/seal 승격 연결.
7. NEXT_ACTIONS·TOOLS 등록, SERVER_INSTRUCTIONS 갱신.
8. eval 10문항 + 전체 게이트 green.
9. README 툴 문서 갱신.

## 9. 열린 결정 (착수 전 확정)

- **툴 개수:** 4 신규가 적정? (add/amend/recheck/reconsider) — 합쳐서 줄일 수도(예: amend에 resolve 포함).
- **전제↔영수증:** 영수증 헤드라인은 여전히 단수 `unverified_assumption`, 전제 집합은 recall/premises로?
  아니면 영수증도 전제 목록 렌더?
- **코디네이션 옵션 A/B/C.**
- **webapp↔MCP 동기화:** 지금은 각자 로컬(웹=Supabase, MCP=.argus). 나중에 공유 허브로 연결할지.
