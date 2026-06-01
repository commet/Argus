# Context Contract Schema

> Argus 스킬 간 데이터 흐름의 공식 스키마.
> 각 스킬은 `.argus/{skill}.md` 하단에 Context Contract를 YAML로 저장한다.
> 다음 스킬은 이전 스킬의 컨트랙트를 자동으로 읽어 컨텍스트를 이어간다.

---

## Data Flow

```
/reframe → .argus/reframe.md
    ↓ reads
/recast  → .argus/recast.md
    ↓ reads reframe + recast
/rehearse → .argus/rehearse.md
    ↓ reads all above
/refine   → .argus/refine.md

/argus → .argus/last-run.md (all-in-one, includes all contracts)
```

---

## 1. Reframe Contract

**File:** `.argus/reframe.md`
**Producer:** `/reframe`
**Consumers:** `/recast`, `/rehearse`, `/argus`

```yaml
context: build | decide                    # REQUIRED — determines downstream behavior
reframed_question: string                  # REQUIRED — the sharpened question
framing_confidence: number                 # REQUIRED — 0-100, LLM self-assessment
assumption_pattern: confirmed | mixed | mostly_doubtful  # REQUIRED
strategy: string                           # strategy name used (e.g., "Narrow Scope")
interview_signals:                         # v2 fields — varies by context
  nature: known_path | needs_analysis | no_answer | on_fire
  goal: clear_goal | direction_only | competing | unclear
  stakes: irreversible | important | experiment | unknown_stakes
  # conditional (asked only when relevant)
  trigger: external_pressure | internal_request | opportunity | recurring
  history: failed | partial | first | unknown
  stakeholder: executive | team | client | self
assumptions:                               # evaluation-based grouping
  doubtful:                                # 의심 — downstream에서 최우선 검증 대상
    - assumption: string
      axis: customer_value | feasibility | business | org_capacity
      risk_if_false: string
      reason: string                       # 사용자가 의심하는 이유
  uncertain:                               # 불확실 — 검증 방법 포함
    - assumption: string
      axis: customer_value | feasibility | business | org_capacity
      risk_if_false: string
      reason: string
  confirmed:                               # 확인됨 — 계획의 전제로 사용
    - assumption: string
      axis: customer_value | feasibility | business | org_capacity
ai_limitations:                            # AI가 검증 불가능한 영역
  - string
blind_spot: string                         # 핵심 블라인드 스팟 (1문장)
```

### Consumer rules:
- `/recast` MUST read `context` to decide output mode (decide → execution steps, build → feature spec)
- `/recast` MUST inherit `assumptions.doubtful` and mark them `[from reframe]` — 최우선 검증 대상
- `/recast` reads `framing_confidence`: <60이면 보수적 설계, 검증 단계를 앞에 배치
- `/rehearse` uses `assumption_pattern` to calibrate persona harshness
- `interview_signals.stakes=irreversible` → `/recast`는 실행 전 검증 단계 필수 배치

---

## 2. Recast Contract

**File:** `.argus/recast.md`
**Producer:** `/recast`
**Consumers:** `/rehearse`, `/refine`

```yaml
governing_idea: string                     # REQUIRED — thesis of the plan
storyline:                                 # REQUIRED — Situation/Complication/Resolution
  situation: string
  complication: string
  resolution: string
design_rationale: string                   # 왜 이런 구조로 설계했는지
steps:                                     # REQUIRED — execution steps
  - task: string
    actor: 🤖 | 🧑 | ⚡ | 🧑→🤖 | 🤖→🧑    # AI / Human / Both / Human initiates→AI completes / AI initiates→Human completes
    actor_reasoning: string                # 왜 이 담당자인지
    expected_output: string
    checkpoint: boolean                    # true = human approval needed before next
    checkpoint_reason: string
    estimated_time: quick | short | medium | long
    parallel_with: number | null           # 병렬 실행 가능한 단계 번호
    ai_scope: string                       # ⚡일 때 AI가 하는 범위
    human_scope: string                    # ⚡일 때 사람이 하는 범위
role_distribution:
  ai: number
  human: number
  both: number
critical_path: [number]                    # 지연 시 전체에 영향을 주는 단계 번호들
total_estimated_time: string               # 전체 예상 소요 시간
key_assumptions:                           # REQUIRED — 계획의 핵심 가정
  - assumption: string
    importance: high | medium | low
    certainty: high | medium | low
    if_wrong: string                       # 틀렸을 때 결과
changes_from_original: number              # role changes made
key_insight: string
personas:                                  # auto-generated for /rehearse
  - name: string
    role: string
    organization: string
    influence: high | medium | low
    decision_style: analytical | intuitive | consensus | directive
    risk_tolerance: low | medium | high
    priorities: string
    communication_style: string
    known_concerns: string
    success_metric: string                 # 이 사람이 승인하는 기준
    primary_concern: string
    blocking_condition: string
    user_description: string | null        # 사용자가 자유형으로 서술한 원본 (있으면 시뮬레이션에 주입)
    completeness: number                   # 0-100, 페르소나 구체화 정도
    source: auto | user_refined | confirmed  # 생성 경로
```

### Consumer rules:
- `/rehearse` reads `.argus/personas.json` FIRST — confirmed/user_refined personas take priority
- `/rehearse` uses `personas` from recast for remaining slots (do not regenerate what user already defined)
- `/rehearse` reads `steps` to ground risk assessment in specific plan elements
- `/rehearse` reads `key_assumptions` as attack surface for stress testing
- `/refine` reads `governing_idea` as IMMUTABLE constraint
- `/refine` uses `critical_path` to prioritize which steps to protect during revision

---

## 3. Rehearse Contract

**File:** `.argus/rehearse.md`
**Producer:** `/rehearse`
**Consumers:** `/refine`

```yaml
persona_reviews:                           # REQUIRED
  - persona_name: string
    role: string
    decision_style: string
    risk_tolerance: string
    verdict: 조건부 | 거부 | 승인
    first_reaction: string                 # 직접 인용 스타일
    concerns:
      - text: string
        severity: critical | important | minor
        fix_suggestion: string             # REQUIRED — 실행 가능한 수정 방향
        plan_element: string               # 어떤 단계/가정을 공격하는지
    approval_condition: string             # what this persona needs to approve
    translated_approvals:                  # 승인 조건 → 구체적 계획 요소 매핑
      - condition: string
        translated_to_plan: string         # 어떤 단계에서 이걸 해결할 수 있는지
        affected_steps: [number]
risks_critical:                            # array of strings
  - string
risks_unspoken:                            # array of strings — highest value category
  - string
risks_manageable:
  - string
synthesis:
  common_agreements: [string]              # 페르소나들이 동의한 것
  key_conflicts:                           # 페르소나 간 의견 충돌
    - topic: string
      positions:
        - persona_name: string
          stance: string
  priority_actions:                        # 우선순위 행동 (critical → multi-persona → unspoken)
    - action: string
      requested_by: string
      priority: high | medium
  untested_assumptions: [string]           # 아무도 검증 못한 가정
sharpest_critique: string                  # single most impactful criticism
devils_advocate:
  realistic_failure: string
  silent_problem: string
  regret_test: string
pipeline: "reframe ✓ → recast ✓ → rehearse ✓ → refine ·"
```

### Consumer rules:
- `/refine` uses EXACT same `persona_reviews[].persona_name` — no softening, no adding new personas
- `/refine` targets `risks_critical` first, then `risks_unspoken`
- `/refine` tracks `sharpest_critique` as primary resolution target
- `/refine` uses `translated_approvals` to map fixes to specific plan steps
- `/refine` checks `synthesis.priority_actions` for fix ordering

---

## 4. Refine Contract

**File:** `.argus/refine.md`
**Producer:** `/refine`
**Consumers:** (terminal — or next /argus run)

```yaml
converged: boolean
rounds: number                             # actual rounds used
critical_remaining: number                 # critical risks still open
approval_conditions:                       # convergence targets
  - persona_name: string
    condition: string
    met: boolean
    met_at_round: number | null
changes:                                   # what was revised
  - what: string
    why: string
    addresses: string                      # which issue/persona concern
convergence_metrics:
  critical_risks: [before, after]          # e.g., [3, 0]
  total_issues: [before, after]
  conditions_met: [before, after]
sharpest_critique_resolved: string         # how the #1 critique was handled
root_question_check: boolean               # 수정된 계획이 여전히 reframed_question에 답하는가
pipeline: "reframe ✓ → recast ✓ → rehearse ✓ → refine ✓"
```

---

## 5. Argus Contract (All-in-One)

**File:** `.argus/last-run.md`
**Producer:** `/argus`
**Consumers:** `/recast` (for role redesign), next session

```yaml
context: build | decide
judge: string                              # decision maker name/role
reframed_question: string
framing_confidence: number                 # 0-100
assumption_pattern: confirmed | mixed | mostly_doubtful
assumptions_doubtful:
  - assumption: string
    axis: string
    risk_if_false: string
assumptions_confirmed: [string]
execution_plan:                            # from deepening rounds
  steps:
    - task: string
      who: ai | human | both
      output: string
convergence:
  score: number                            # 0-100
  rounds_used: number
  trend: improving | stable | declining
simulation:
  judge_name: string
  risks_critical:                          # with fix suggestions
    - risk: string
      fix: string
  risks_unspoken: [string]
  judge_approval_condition: string
  concerns_applied: number                 # 반영된 우려 수
  concerns_total: number                   # 전체 우려 수
deliverable_type: plan | spec | strategy
dq_score: number                           # 0-100 Decision Quality Score
```

---

## Immutable Fields

These fields MUST NOT change once set, regardless of which skill is running:

| Field | Set by | Rule |
|-------|--------|------|
| `governing_idea` | /recast | Plan thesis — revisions work within it, not around it |
| `ai_limitations` | /reframe | Permanent constraints — cannot be "resolved" by refinement |
| `context` | /reframe | build or decide — cannot switch mid-pipeline |
| `reframed_question` | /reframe | Root question — /refine checks plan still answers this |

---

## Reading Rules

1. **Auto-read:** Each skill checks `.argus/` for prior contracts on startup
2. **Offer to user:** "이전에 만든 [X]가 있습니다. 이걸로 이어갈까요?"
3. **Merge, don't replace:** New insights ADD to prior data; don't discard upstream work
4. **Mark inheritance:** `[from reframe]`, `[from recast]` markers on inherited data
5. **Validate chain:** `/doctor` checks that the contract chain is internally consistent
6. **Evaluation-based injection:** downstream 스킬은 assumption의 evaluation state(doubtful/uncertain/confirmed)에 따라 다르게 처리
7. **Signal-based guidance:** interview signals → 설계 지침으로 변환 (e.g., stakes=irreversible → 검증 단계 먼저)

---

## File Format

Each `.argus/{skill}.md` file has two sections:

```markdown
[Human-readable output — the actual deliverable]

---

## Context Contract
[YAML — machine-readable for downstream skills]
```

The top section is what the user reads and shares.
The bottom section is what the next skill reads and builds on.

---

## Convergence Metrics (Cross-Skill)

`/argus`의 progressive flow에서 사용하는 수렴 지표:

```yaml
convergence:
  score: number                            # 0-100
  trend: improving | stable | declining | unclear
  is_converged: boolean                    # score >= 75
  estimated_rounds_left: number
  guidance: string                         # 사용자에게 보여줄 한 줄 안내
```

**4가지 시그널:**
1. **Question Stability (0-40점):** 진짜 질문이 라운드 간 안정적인가
2. **Assumption Reduction (0-30점):** 숨겨진 가정이 줄어드는가
3. **Framing Confidence (0-30점):** 프레이밍 확신도
4. **Trend:** 최근 3 스냅샷의 유사도 추세

**수렴 임계값:** score >= 75 → Mix로 진행 가능
