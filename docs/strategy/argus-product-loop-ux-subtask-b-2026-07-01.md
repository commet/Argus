# Argus 전략 정리 서브태스크 B

Date: 2026-07-01

Scope: 제품 루프 / UX 관점. 사용자가 말한 "기존 기획안/전략안 검수, judgment receipt 축적, 주기적 리마인더가 아니라 같이 고민하고 제안"을 웹앱과 MCP/플러그인 양쪽에 걸친 제품 구조로 정리한다.

## 결론

Argus의 첫 제품 표면은 "의사결정 앱"이 아니라 **AI 시대의 전략안/기획안 Judgment Review**여야 한다.

사용자는 "판단력을 기르고 싶다"보다 훨씬 자주 이렇게 말한다.

> 이 전략안, 기획안, PRD, 보고서, 투자 메모, Claude가 만든 답변을 그대로 믿고 진행해도 되나?

여기서 Argus가 해야 할 일은 더 좋은 초안을 대신 쓰는 것이 아니다. 이미 초안은 ChatGPT/Claude/Codex가 만든다. Argus의 역할은:

1. 문서가 실제로 주장하는 것을 분해하고,
2. 사람이 책임져야 할 판단 지점을 뽑고,
3. 근거가 약한 주장과 반증 조건을 고정하고,
4. 이후 일정에 맞춰 다시 불러와 같이 고민하게 만드는 것이다.

Duolingo 비유는 쓸 수 있지만, 그대로 따라가면 안 된다. Argus는 streak 제품이 아니다. 매일 괴롭히는 앱이 아니라 **사용자가 과거에 직접 봉인한 판단을 근거로 다시 찾아오는 동행자**여야 한다.

## 제품 명제

### 외부 문장

> AI가 만든 답을 실행하기 전에, 사람이 책임져야 할 판단을 찾아냅니다.

### 사용자 경험 문장

> Argus는 당신의 기획안에서 "지금 결정해야 할 것", "아직 믿으면 안 되는 것", "나중에 현실이 답할 것"을 분리해 둡니다.

### 내부 제품 원칙

> Review creates the receipt. The receipt creates the return.

검수가 끝나면 답변이 아니라 receipt가 남아야 한다. 그리고 retention은 알림이 아니라 이 receipt의 미해결 쟁점에서 나와야 한다.

## 핵심 Artifact

핵심 artifact는 **Judgment Receipt**다. 기존 repo의 `Decision Contract`, `Current Heading`, `seal/settle`을 소비자/전략 문서 표면으로 재명명한 것이다.

### Judgment Receipt 구성

1. **Source**
   - 사용자가 직접 입력한 문제, 업로드한 문서, PRD, 전략안, PDF, 링크, PR, branch, Claude/ChatGPT 답변.
   - 웹앱에서는 업로드/붙여넣기/URL/직접 작성.
   - MCP/플러그인에서는 파일 경로, PR, repo 상태, 문서 경로, 현재 대화 맥락.

2. **Core Question**
   - 문서가 겉으로 말하는 질문이 아니라 실제로 결정해야 하는 질문.
   - 예: "이 기능을 만들까?"가 아니라 "지금 retention 증거 없이 onboarding 리빌드에 3주를 써도 되는가?"

3. **Judgment Obligations**
   - AI나 문서가 대신 결정하면 안 되는 항목.
   - 각 항목은 `owner`, `why human`, `decision needed by`, `evidence needed`를 가진다.
   - 이 필드가 Argus의 가장 중요한 차별점이다.

4. **Claim Ledger**
   - 문서 속 주장들을 `supported`, `weak`, `unsupported`, `human-check`, `contradicted`로 나눈다.
   - "좋은/나쁜 문서" 평점이 아니라 "무엇을 근거로 믿어도 되는가"의 지도다.

5. **Hidden Assumptions**
   - 근거 없이 깔린 가정.
   - 단순 목록이 아니라 `if false, what breaks?`가 붙어야 한다.

6. **Forks / Road Not Taken**
   - 실제 대안이 있을 때만 표시한다.
   - 억지로 양자택일을 만들면 Argus의 신뢰가 깨진다.

7. **Falsifiable Follow-ups**
   - 나중에 현실이 답할 수 있는 1-3개 predicate.
   - 예: "2주 안에 기존 사용자 5명 중 3명이 이 검수 결과를 다시 열어본다."
   - pass/fail 조건과 check-by가 있어야 한다.

8. **Companion Thread**
   - receipt 이후의 대화 기록.
   - 알림이 아니라 "그때 봉인한 판단을 기준으로 지금 무엇을 다시 봐야 하는가"를 이어가는 thread.

### Artifact 상태

Receipt는 정적 문서가 아니라 상태를 가진다.

- `draft`: 분석 전 또는 분석 중.
- `reviewed`: 검수 완료, 아직 사용자가 소유한 판단을 고르지 않음.
- `owned`: 사용자가 "내가 책임질 판단"을 1개 이상 선택.
- `sealed`: check-by가 있는 predicate가 봉인됨.
- `active`: 아직 현실 확인 전.
- `due`: 확인 날짜 도래.
- `settled`: 사용자가 현실 결과를 기록.
- `reopened`: settlement 후 다시 판단해야 할 새 decision으로 이어짐.
- `archived`: 더 이상 추적하지 않음.

## 입력 아키텍처: Artifact-first Ingestion

대부분의 실제 사용은 직접 입력보다 PDF/DOCX/PPTX/기존 문서 업로드에서 시작할 가능성이 높다. 따라서 파일 업로드는 "추후 기능"이 아니라 처음부터 데이터 모델에 들어가야 한다.

단, MVP에서 모든 파일 포맷을 완벽하게 처리하려 하면 안 된다. 원칙은:

> 입력 포맷은 다양하게 받되, 분석 전에는 모두 하나의 Canonical Artifact로 정규화한다.

### 입력 유형

MVP에서 허용할 입력:

1. **Paste / 직접 입력**
   - 가장 단순한 경로.
   - 아이디어, 짧은 전략 메모, Claude/ChatGPT 답변.

2. **Markdown / TXT**
   - MCP/플러그인과 가장 잘 맞는 경로.
   - repo 안의 `docs/*.md`, `proposal.txt`, `adr.md`.

3. **PDF**
   - 실제 사용자가 가장 많이 기대할 경로.
   - 보고서, 제안서, 외부 리서치, 투자자 메모, 정책 문서.
   - 첫 버전에서는 OCR이 필요한 스캔 PDF를 완벽히 지원하지 않는다. `text_pdf`, `scan_pdf`, `mixed_pdf`를 구분해서 품질 상태를 표시한다.

4. **DOCX**
   - 전략기획/회사 문서에서 중요하다.
   - 섹션, heading, bullet, table을 최대한 보존한다.

5. **PPTX / Slide Deck**
   - 전략기획/보고/투자/세일즈 문서에서 매우 중요하다.
   - deck은 일반 문서가 아니라 **설득의 순서**다.
   - 슬라이드 제목, 본문 bullet, speaker notes, 표 텍스트, 슬라이드 순서를 보존한다.
   - 첫 버전에서는 차트 수치/이미지/시각 디자인을 완전 해석하지 않는다.

6. **회의록 / Transcript**
   - 완성 문서가 아니라 raw material이다.
   - 이 경우 Review가 아니라 "decision extraction" lens가 먼저 적용돼야 한다.

7. **MCP/플러그인 artifact**
   - local file.
   - PR diff.
   - Codex/Claude plan.
   - repo state.

나중 입력:

- Google Docs/Drive.
- Notion.
- web URL.
- image-heavy PDF.
- email thread.

### Canonical Artifact

모든 입력은 분석 전 아래 객체로 바뀐다.

```ts
type CanonicalArtifact = {
  artifact_id: string;
  source_kind:
    | 'paste'
    | 'markdown'
    | 'txt'
    | 'pdf'
    | 'docx'
    | 'pptx'
    | 'transcript'
    | 'mcp_file'
    | 'pr_diff'
    | 'llm_answer';
  source_title: string;
  source_fingerprint: string;
  extraction_quality: 'high' | 'medium' | 'low' | 'unsupported';
  privacy_mode: 'receipt_only' | 'store_source' | 'local_only';
  units: ArtifactUnit[];
  detected_structure: ArtifactStructure;
  detected_profile: DocumentProfile;
};

type ArtifactUnit = {
  unit_id: string;
  kind:
    | 'heading'
    | 'paragraph'
    | 'bullet'
    | 'table'
    | 'quote'
    | 'slide_title'
    | 'slide_body'
    | 'speaker_note'
    | 'shape_text'
    | 'chart_label'
    | 'diff_hunk'
    | 'transcript_turn';
  text: string;
  source_anchor: {
    page?: number;
    slide?: number;
    shape_id?: string;
    section_path?: string[];
    paragraph_index?: number;
    line_start?: number;
    line_end?: number;
    char_start?: number;
    char_end?: number;
  };
  confidence: number;
};
```

`source_anchor`가 핵심이다. Argus가 "근거가 약하다"고 말할 때 사용자는 반드시 원문 위치로 돌아갈 수 있어야 한다. 이게 없으면 그냥 긴 AI 답변이다.

### PDF/DOCX/PPTX 처리 원칙

PDF/DOCX/PPTX는 처음부터 지원하되, 첫 버전의 목표는 "완벽한 문서 파서"가 아니다.

목표:

- 텍스트 추출.
- 페이지/섹션/슬라이드 anchor 보존.
- 표는 최소한 row text로 보존.
- PPTX는 slide title/body/speaker notes/shape text를 보존.
- extraction quality 표시.
- 분석 결과에서 원문 페이지/섹션/슬라이드 참조.

비목표:

- 완벽한 레이아웃 재현.
- 스캔 PDF OCR 완전 대응.
- 복잡한 표 계산.
- 이미지/차트 내용의 완전 해석.
- deck의 시각 디자인 완전 평가.
- Google Docs 수준의 문서 편집기.

사용자에게 보여줄 정직한 상태:

- "텍스트 추출 품질이 높습니다."
- "표/이미지 일부는 분석에서 빠질 수 있습니다."
- "이 PDF는 스캔본이라 OCR이 필요합니다. 현재는 제한적으로만 분석합니다."
- "이 deck은 슬라이드 텍스트와 순서를 기준으로 검수했습니다. 차트/이미지 해석은 제한적입니다."

초기 신뢰는 완벽함보다 정직함에서 나온다.

### Deck은 문서가 아니라 설득 순서다

PPTX를 일반 문서처럼 paragraph 목록으로만 다루면 핵심을 놓친다. Deck 검수에서는 다음을 별도로 본다.

- 첫 3장 안에 핵심 질문과 ask가 드러나는가.
- 슬라이드 순서가 결론을 밀고 가는가.
- 각 슬라이드가 하나의 역할을 갖는가.
- 핵심 claim이 어느 슬라이드에서 처음 등장하고, 어디서 근거를 받는가.
- appendix로 밀린 근거가 본문 주장과 연결되는가.
- 청중이 의사결정해야 할 지점이 deck 끝에 명확히 남는가.

따라서 PPTX의 `ArtifactUnit`은 slide 단위 anchor를 반드시 가져야 한다. finding도 "문서 전체"가 아니라 "slide 4의 시장 규모 claim", "slide 8의 GTM sequence"처럼 돌아갈 수 있어야 한다.

### 저장 원칙

전략 문서, PDF, deck은 민감할 수 있다. 따라서 저장 기본값은 source 전체 보관이 아니라 receipt 중심이어야 한다.

초기 옵션:

- `receipt_only`: 원문은 분석 후 버리고 구조화된 receipt와 source fingerprint만 저장.
- `store_source`: 사용자가 명시적으로 원문 저장 허용.
- `local_only`: MCP/플러그인에서 로컬 `.argus/`에만 저장.

제품 카피도 이 구조와 맞아야 한다.

> 원문을 저장하지 않고도, 당신이 책임지기로 한 판단과 확인 조건은 남길 수 있습니다.

## 분석 아키텍처: Normalize Before Review

Argus가 Claude/ChatGPT와 달라지려면 "문서를 잘 비판해줘"가 아니라 정규화된 분석 파이프라인이 있어야 한다.

전체 흐름:

```text
Raw input
  -> Canonical Artifact
  -> Document Profile
  -> Document Judgment Map
  -> Lens Routing
  -> Lens Reviews
  -> Judgment Receipt
  -> Ownership / Seal
  -> Companion Brief
```

### Document Profile

문서마다 특성이 다르므로 먼저 profile을 잡는다.

```ts
type DocumentProfile = {
  artifact_maturity: 'idea' | 'rough_draft' | 'working_draft' | 'near_final' | 'final' | 'raw_notes';
  document_type:
    | 'strategy_memo'
    | 'prd'
    | 'rfc'
    | 'adr'
    | 'strategy_deck'
    | 'pitch_deck'
    | 'board_deck'
    | 'sales_deck'
    | 'investor_update'
    | 'research_report'
    | 'meeting_notes'
    | 'llm_answer'
    | 'proposal'
    | 'unknown';
  intent:
    | 'decide'
    | 'persuade'
    | 'inform'
    | 'align'
    | 'pitch'
    | 'request_approval'
    | 'explore'
    | 'record';
  audience: 'self' | 'team' | 'executive' | 'customer' | 'investor' | 'technical_review' | 'unknown';
  stakes: 'low' | 'medium' | 'high';
  source_confidence: number;
};
```

`artifact_maturity`가 중요하다. 아이디어 수준 문서에 최종본 기준의 엄격한 근거 검증을 들이대면 제품이 무례해진다. 반대로 최종본에 "아이디어가 흥미롭습니다" 식으로 반응하면 쓸모가 없다.

### Document Judgment Map

Profile 이후에는 문서를 판단 가능한 중간 객체로 바꾼다.

```ts
type DocumentJudgmentMap = {
  core_question: string;
  explicit_recommendation?: string;
  implicit_recommendation?: string;
  main_claims: Claim[];
  evidence_items: EvidenceItem[];
  assumptions: Assumption[];
  tradeoffs: Tradeoff[];
  stakeholders: Stakeholder[];
  open_questions: OpenQuestion[];
  decision_points: DecisionPoint[];
  missing_sections: MissingSection[];
};
```

이 객체가 없으면 Lens Review가 매번 흔들린다. Lens는 원문을 직접 대충 읽는 게 아니라, 원문 anchor가 붙은 map 위에서 작동해야 한다.

### Dynamic Lens Routing

문서마다 같은 렌즈를 쓰면 안 된다. Argus의 품질은 좋은 lens를 많이 만드는 것보다 **맞는 lens를 고르는 것**에서 나온다.

Lens router는 다음을 기준으로 렌즈를 고른다.

- document_type.
- artifact_maturity.
- intent.
- audience.
- stakes.
- 사용자가 선택한 concern.
- 추출된 weak signal.

예:

| 상황 | 우선 렌즈 |
|---|---|
| `strategy_memo` + `request_approval` | strategic coherence, evidence burden, executive objection, sequencing |
| `prd` + `working_draft` | customer problem, success metrics, scope, dependency, launch risk |
| `rfc/adr` | tradeoff, reversibility, migration risk, operational burden, rollback |
| `strategy_deck/board_deck` | deck narrative, executive ask, evidence burden, objection path, decision slide clarity |
| `pitch_deck/sales_deck` | audience promise, proof sequence, objection handling, metric credibility, ask clarity |
| `meeting_notes` | decision extraction, unresolved owner, commitment tracking |
| `llm_answer` | unsupported fluency, hallucination risk, user-owned judgment, actionability |
| `research_report` | source quality, inference leap, missing counterevidence, decision relevance |

Lens router의 출력은 숨기지 말고 보여줘야 한다.

> 적용한 검수 렌즈: 근거 부담, 실행 리스크, 이해관계자 반론. 이유: 이 문서는 승인 요청형 전략안이고, 핵심 주장이 시장 수요 가정에 의존합니다.

이 설명이 있으면 사용자는 Argus가 임의로 비판하는 게 아니라 문서 유형에 맞춰 검수한다는 느낌을 받는다.

## Lens Library: 좋은 렌즈가 제품 품질이다

렌즈는 프롬프트 조각이 아니라 구조화된 검수 단위여야 한다.

```ts
type JudgmentLens = {
  id: string;
  label: string;
  applies_to: DocumentProfileFilter;
  purpose: string;
  input_requirements: string[];
  review_questions: string[];
  output_schema: unknown;
  failure_modes: string[];
};
```

### MVP Lens

처음부터 30개 렌즈를 만들지 않는다. deck까지 포함한 MVP는 9개면 충분하다.

1. **Core Question Lens**
   - 이 문서가 실제로 결정하려는 것은 무엇인가.
   - 겉 질문과 진짜 질문이 다른가.

2. **Claim-Evidence Lens**
   - 핵심 주장마다 근거가 있는가.
   - 근거가 원문 안에 있는가, 추정인가.

3. **Hidden Assumption Lens**
   - 문서가 말하지 않았지만 의존하는 가정은 무엇인가.
   - 틀리면 무엇이 무너지는가.

4. **Human Judgment Lens**
   - AI나 문서가 대신 결정하면 안 되는 지점은 무엇인가.
   - 사용자가 직접 lean을 가져야 하는 항목은 무엇인가.

5. **Stakeholder Objection Lens**
   - CFO, PM, engineering lead, customer, investor가 가장 먼저 물을 질문은 무엇인가.
   - 단, generic persona roleplay가 아니라 문서 claim에 anchor되어야 한다.

6. **Execution Risk Lens**
   - 실행 단계에서 막힐 dependency, sequencing, owner gap은 무엇인가.

7. **Reversibility Lens**
   - 이 결정은 되돌릴 수 있는가.
   - 되돌릴 수 없다면 어떤 proof가 더 필요한가.

8. **Falsifiable Follow-up Lens**
   - 나중에 현실이 답할 수 있는 predicate는 무엇인가.
   - 언제 무엇을 보면 맞고 틀렸다고 할 수 있는가.

9. **Deck Narrative Lens**
   - deck이 어떤 순서로 청중을 설득하는가.
   - 핵심 ask가 언제 드러나는가.
   - slide 간 논리 점프, 반복, 근거 없는 claim은 어디인가.

### Lens 품질 기준

좋은 lens는 다음 조건을 만족한다.

- 원문 anchor를 요구한다.
- generic advice를 금지한다.
- "더 검토" 대신 "무엇을 확인"으로 끝난다.
- 사람의 판단과 AI의 작업을 구분한다.
- 출력이 Judgment Receipt 필드로 바로 들어간다.

나쁜 lens:

- "리스크를 고려하세요."
- "고객 니즈를 더 조사하세요."
- "경쟁사를 분석하세요."
- "명확한 KPI를 설정하세요."

이런 문장은 누구나 말할 수 있다. Argus의 lens는 반드시 문서의 특정 claim과 연결되어야 한다.

## LLM Handoff Protocol

Claude/GPT에게 구조적으로 잘 전달하려면, 매번 원문 전체와 "잘 봐줘"를 보내면 안 된다. 단계마다 역할과 출력 스키마가 달라야 한다.

### 1. Extraction Call

목적: Canonical Artifact에서 Document Judgment Map을 만든다.

입력:

- document profile.
- artifact units with anchors.
- 사용자 concern 0-3개.

출력:

- main claims.
- evidence items.
- assumptions.
- decision points.
- missing sections.

금지:

- 평가/비판.
- recommendation.
- 사용자 대신 판단.

### 2. Routing Call

목적: 적용할 lens 선택.

입력:

- document profile.
- judgment map summary.
- stakes.
- artifact maturity.

출력:

- selected lenses.
- skipped lenses.
- 이유.

금지:

- 아직 리뷰하지 않는다.

### 3. Lens Review Calls

목적: 각 lens가 자기 output만 만든다.

입력:

- lens definition.
- relevant claims/units only.
- source anchors.

출력:

- lens-specific findings.
- severity.
- source anchors.
- suggested action.

금지:

- 전체 결론.
- 중복 일반론.
- 원문에 없는 fact invent.

### 4. Synthesis Call

목적: lens outputs를 Judgment Receipt로 압축.

입력:

- document profile.
- map.
- lens findings.
- user concern.

출력:

- core question.
- top judgment obligations.
- claim ledger summary.
- hidden assumptions.
- current heading.
- follow-up predicates.

금지:

- 사용자가 결론을 냈다고 말하기.
- "proceed"만 내는 default tilt.
- 원문 anchor 없는 finding.

### 5. Revision Call 선택

목적: 사용자가 원할 때만 문서 보완안을 만든다.

입력:

- receipt.
- 원문 관련 units.
- 사용자가 선택한 direction.

출력:

- patch-style edits.
- rebuilt outline.
- revised section draft.

주의:

> Review가 기본이고 Revision은 후속 action이다. Argus가 처음부터 문서를 다시 써버리면 판단 검수 도구가 아니라 문서 생성기로 흘러간다.

## Activation Event

Argus의 activation을 "회원가입", "문서 업로드", "분석 완료"로 잡으면 안 된다. 그건 사용자가 가치를 느낀 순간이 아니다.

진짜 activation은:

> 사용자가 검수 결과에서 "이 판단은 내가 책임지고 가져간다"를 선택하고, 하나의 falsifiable follow-up을 seal하는 순간.

### Activation metric

MVP에서 추적해야 할 핵심 지표:

- `review_completed`: 문서/직접 입력 검수 완료.
- `judgment_obligation_selected`: 사용자가 사람이 판단할 항목을 선택.
- `receipt_sealed`: check-by가 있는 follow-up 생성.
- `return_opened`: 후속 알림/동행 메시지로 돌아옴.
- `settled`: 현실 결과 기록.
- `reopened_or_revised`: 결과를 바탕으로 새 판단 또는 수정 판단 생성.

가장 중요한 early signal은 `judgment_obligation_selected / review_completed`다. 사용자가 seal까지 안 가더라도 "이건 내가 판단해야 한다"를 고르면 Argus가 사고를 움직인 것이다.

## 제품 루프

### 두 개의 제품 모드: Create와 Review

Argus에는 처음부터 두 입구가 있어야 한다. 하지만 둘은 같은 제품이 아니다.

#### A. 초안 만들기 / Create

사용자가 아직 artifact를 갖고 있지 않을 때의 모드다.

예:

- "신규 온보딩 전략안을 만들어야 한다."
- "이 아이디어를 PRD 초안으로 바꾸고 싶다."
- "회의 전에 논점 정리가 필요하다."

이 모드에서 Argus의 역할은 문서를 대신 써주는 것이 아니라, **초안이 나올 수 있는 판단 구조를 먼저 잡는 것**이다.

Create 모드의 출력:

- core question.
- target audience.
- decision frame.
- required evidence.
- draft outline.
- first Judgment Receipt seed.

주의: Create 모드는 ChatGPT/Claude와 가장 직접적으로 경쟁한다. 따라서 MVP에서 Create는 "빈 화면을 피하는 보조 입구"로만 둔다. 주력 wedge는 아니다.

#### B. 기존 문서 검수 / Review

사용자가 이미 artifact를 갖고 있을 때의 모드다.

예:

- 최종본에 가까운 전략안.
- 아직 거친 기획 초안.
- 아이디어 메모.
- 회의록.
- Claude/ChatGPT가 만든 답변.
- PDF 보고서.
- DOCX 제안서.
- PRD/RFC/ADR.
- 투자자 업데이트.

이 모드에서 Argus의 역할은 **artifact를 판단 가능한 객체로 바꾸는 것**이다. 문서가 완성본인지 초안인지, formal memo인지 회의록인지에 따라 같은 방식으로 리뷰하면 안 된다.

Review 모드의 출력:

- Document Judgment Map.
- 적용된 lens 목록과 이유.
- Judgment Receipt.
- suggested revision path.
- optional rebuilt draft.

중요한 구분:

> Create는 판단 구조에서 문서를 만든다. Review는 문서에서 판단 구조를 복원한다.

이 차이를 구현에서 섞으면 제품이 흔들린다. 사용자가 "초안 만들기"로 들어왔는지, "기존 문서 검수하기"로 들어왔는지는 session의 root mode로 남겨야 한다.

### 1. Review

사용자가 기획안/전략안/AI 답변/PRD를 넣는다.

웹앱 진입 버튼은 두 개면 충분하다.

- **초안 만들기**
- **기존 문서 검수하기**

단, 실제 wedge는 두 번째다. "초안 만들기"는 진입 장벽을 낮추는 보조 입구고, Argus의 차별점은 기존 산출물 검수다.

MCP/플러그인은 자연어로 충분해야 한다.

```text
/argus:sail docs/strategy.md 방향 맞는지 검수해줘
/argus:sail PR 42 merge해도 되는지 봐줘
/argus:sail 이 Claude 답변 그대로 실행해도 될까?
```

### 2. Receipt

Argus가 한 화면짜리 Judgment Receipt를 만든다.

첫 화면에 많이 보여주면 안 된다. 사용자가 처음 봐야 하는 것은 세 가지다.

- 지금 이 문서의 핵심 판단
- 사람이 직접 판단해야 할 3개 항목
- 그대로 진행하면 가장 위험한 1개 가정

나머지는 펼쳐보는 구조다.

### 3. Ownership

사용자는 receipt에서 하나를 고른다.

> 이건 내가 책임지고 판단한다.

이 행동이 제품의 중심 클릭이다. "저장"보다 중요하다. "좋아요"보다 중요하다. "export"보다 중요하다.

이 순간 Argus는 질문한다.

- 언제 다시 확인할까?
- 어떤 현실 신호가 나오면 맞았다고 볼까?
- 어떤 신호가 나오면 틀렸다고 볼까?

### 4. Companion

Argus는 날짜만 기다리지 않는다. 다음 세 가지 trigger가 있으면 다시 온다.

- check-by 날짜가 가까워짐.
- 사용자가 새 버전의 문서를 올림.
- 사용자가 같은 course 안에서 새 대화를 시작함.

이때 메시지는 "리마인더"가 아니라 **Companion Brief**여야 한다.

### 5. Settle

정해진 날짜가 오면 Argus는 판정하지 않는다. 현실을 묻는다.

- happened
- avoided
- partial
- still unclear

중요한 것은 Argus가 "당신이 틀렸습니다"라고 말하지 않는 것이다. Argus는 과거 receipt와 현재 현실을 같은 화면에 놓고, 사용자가 정산하게 한다.

### 6. Learn

settlement 이후 Argus는 다음 검수에서 더 좋아져야 한다.

단, 초반 MVP에서는 "자동 학습 엔진"을 만들면 안 된다. 먼저 사용자에게 보여줄 수 있는 얕은 memory면 충분하다.

- 자주 약한 근거로 넘어가는 주장 유형.
- 자주 놓치는 stakeholder.
- 자주 미루는 human judgment.
- 자주 빗나가는 predicate 유형.

## Retention Loop

Retention은 알림 빈도로 만들면 안 된다. Argus의 retention은 다음 구조여야 한다.

> 내가 남긴 판단이 아직 살아 있고, Argus가 그 판단을 나보다 더 잘 기억한다.

### Loop A: Due Judgment

가장 기본 루프.

1. 사용자가 follow-up predicate를 seal.
2. Argus가 check-by 2-3일 전 또는 당일 연락.
3. 메시지는 과거 receipt를 압축해서 보여줌.
4. 사용자가 settled outcome 기록.
5. Argus가 다음 판단으로 이어갈지 묻지 않고, 필요한 경우에만 "새 decision으로 열기"를 제공.

### Loop B: Version Drift

전략안/기획안에 특히 중요하다.

1. 사용자가 같은 문서의 새 버전을 업로드.
2. Argus가 이전 receipt와 비교.
3. 새 버전이 해결한 판단, 악화시킨 가정, 새로 생긴 claim을 보여줌.
4. 기존 sealed predicate를 유지/수정/폐기할지 묻는다.

이 루프가 있으면 Argus는 단발성 문서 리뷰어가 아니라 "기획안의 판단 이력"이 된다.

### Loop C: Companion Sprint

사용자가 중요한 판단을 앞두고 3-7일 동안 같이 고민하는 루프.

예:

- Day 0: 전략안 검수.
- Day 1: 가장 약한 assumption에 대한 evidence request.
- Day 3: 수정안 검수.
- Day 5: stakeholder objection rehearsal.
- Day 7: final receipt seal.

Duolingo식 "계속 하세요"가 아니라, 사용자가 고른 판단을 중심으로 작은 고민 단위를 이어준다.

### Loop D: Personal Judgment Pattern

settled receipt가 3개 이상 쌓였을 때만 연다.

초반부터 "당신의 판단 패턴"을 보여주면 허세가 된다. 3개 전에는 잠그는 것이 낫다.

3개 이후:

- 내 판단이 자주 강했던 영역.
- 자주 과신한 주장 유형.
- 계속 human-check로 남긴 영역.
- AI가 잘 도와준 영역과 사람이 직접 봐야 했던 영역.

## UI 화면 / 상태

### 1. Home / Workbench

첫 화면은 랜딩이 아니라 작업대여야 한다.

주요 CTA:

- `기존 문서 검수하기`
- `초안 만들기`

보조:

- 최근 receipt
- due soon
- active course

텍스트는 설명보다 행동 중심이어야 한다.

### 2. Import Screen

입력 옵션:

- 붙여넣기
- 파일 업로드: md, txt, pdf, docx, pptx
- URL (post-MVP)
- MCP에서 가져온 artifact
- 직접 작성

여기서 사용자가 고르는 것은 "무엇을 넣을지"뿐 아니라 "어떤 검수를 원하는지"다.

검수 모드:

- 전략 적합성
- 근거/주장 검증
- stakeholder objection
- 실행 리스크
- AI 답변 신뢰성
- 전체 judgment review

MVP에서는 "전체 judgment review"를 기본값으로 두고, 나머지는 chips로만 둔다.

Import Screen에서 사용자가 문서 유형을 꼭 맞히게 만들면 안 된다. 기본은 auto-detect다.

사용자에게 묻는 최소 맥락은 3개다.

1. 이 문서는 누구에게 보여줄 문서인가?
2. 이 문서로 어떤 결정을 얻으려는가?
3. 지금 가장 불안한 부분은 무엇인가?

모르면 비워둘 수 있어야 한다. Argus가 추론하되, 추론한 값에는 `inferred` 표시를 붙인다.

### 3. Review Workspace

좌측: 원문 문서.

우측: Argus receipt.

상단 상태:

- `Analyzing claims`
- `Finding human judgments`
- `Checking weak evidence`
- `Building receipt`

핵심은 문서와 판단을 같은 화면에 두는 것이다. 사용자가 "Argus가 진짜 문서를 읽었다"를 느껴야 한다.

### 4. Receipt Summary

첫 화면 구조:

```text
핵심 판단
이 문서는 결국 [X]를 결정하려고 합니다.

사람이 직접 판단해야 할 것
1. ...
2. ...
3. ...

그대로 진행하면 위험한 가정
...

다음 행동
[이 판단을 내가 소유하기] [문서 수정안 만들기] [더 검증하기]
```

버튼은 세 개까지만 둔다. "공유", "다운로드", "export"는 overflow로 숨긴다.

### 5. Claim Ledger

문서의 주장 단위 검수 화면.

필터:

- weak
- unsupported
- human-check
- contradicted
- supported

각 claim은 원문 위치, Argus 판단, 필요한 근거, 수정 제안을 가진다.

여기서 중요한 것은 "문서 첨삭"이 아니라 "판단 검수"다. 문장을 예쁘게 고치는 기능은 secondary action이어야 한다.

### 6. Judgment Ownership Modal

receipt에서 선택한 항목을 seal하는 화면.

필드:

- 내가 책임질 판단
- 지금 내 lean
- 내가 믿고 있는 핵심 가정
- 맞았다고 볼 조건
- 틀렸다고 볼 조건
- 확인 날짜

UX 원칙:

- 사용자가 직접 lean을 쓰게 해야 한다.
- Argus가 pole을 대신 써주면 tilt가 생긴다.
- Argus는 "이렇게 표현하면 더 falsifiable하다" 정도만 제안한다.

### 7. Active Course Dashboard

진행 중인 receipt들의 목록.

카드 필드:

- source title
- current status: reviewed / owned / sealed / due
- next check date
- unresolved judgment count
- last companion note

이 화면은 project management가 아니라 "살아 있는 판단" 목록이다. todo 앱처럼 보이면 안 된다.

### 8. Companion Brief

알림을 클릭하면 바로 이 화면으로 와야 한다.

구성:

1. 그때의 판단 한 줄.
2. 그때 봉인한 pass/fail 조건.
3. 지금 확인해야 할 현실 신호.
4. Argus의 제안 1-2개.
5. 사용자 선택: happened / avoided / partial / still unclear / revise.

중요: Argus의 제안은 "정답"이 아니라 "지금 확인할 구체적 행동"이어야 한다.

### 9. Settlement View

좌측: 과거 receipt.

우측: 현재 현실/결과 입력.

아래: 배운 점.

문구 원칙:

- 칭찬/비난 금지.
- "현실이 어떻게 답했나요?" 중심.
- missed outcome이라도 자동으로 다시 판단을 열지 않는다.

## 알림 / 동행 방식

### 금지해야 할 알림

- "Argus를 다시 열어보세요."
- "판단을 계속 훈련하세요."
- "오늘의 decision streak을 놓치지 마세요."
- "7일째 고민 중입니다."

이런 알림은 Argus를 가벼운 습관 앱으로 만든다.

### 허용되는 알림

알림은 항상 사용자의 receipt에서 출발해야 한다.

예:

> 6월 28일에 "기존 전략안 검수 수요가 실제로 있는가"를 7월 5일까지 확인하기로 했습니다. 그때의 fail 조건은 "5명 중 3명이 자기 문서를 다시 넣지 않는다"였습니다. 지금 확인할 차례입니다.

또는:

> 새 버전의 전략안에서 "반복 사용 수요" 가정은 해결되지 않았고, 대신 "문서 검수 wedge"가 더 강해졌습니다. 이전 receipt를 유지할지 수정할지 보세요.

### Companion Brief 형식

매번 같은 틀:

1. **Recall**: 우리가 무엇을 봉인했는가.
2. **Reality Check**: 지금 확인할 사실은 무엇인가.
3. **Delta**: 그 이후 무엇이 바뀌었는가.
4. **Suggestion**: 지금 할 수 있는 작은 행동 1-2개.
5. **Choice**: settle / revise / push date / archive.

이 형식이면 Argus는 reminder가 아니라 "기억을 가진 전략 파트너"처럼 느껴진다.

### 빈도 원칙

- 기본은 receipt당 check-by 기준 1회.
- due 전 사전 알림은 high-stakes일 때만 1회.
- 사용자가 companion sprint를 켰을 때만 더 자주.
- settled 후 자동 follow-up 금지. 사용자가 revise를 누를 때만 이어간다.

## 웹앱과 MCP/플러그인 구조

### 같은 것

웹앱과 MCP/플러그인은 같은 Judgment Receipt 객체를 만들어야 한다.

공통 필드:

- source
- core_question
- judgment_obligations
- claim_ledger
- assumptions
- forks
- recommendation / current_heading
- falsifiable_followups
- state
- companion_thread
- settlements

이 공통 객체가 없으면 웹앱과 플러그인이 서로 다른 제품이 된다.

### 웹앱이 잘해야 하는 것

웹앱은 시각적 비교와 축적에 강해야 한다.

- 문서 원문과 receipt side-by-side.
- claim ledger 필터링.
- receipt timeline.
- active course dashboard.
- settlement view.
- 개인 판단 패턴.

웹앱의 역할:

> 내 판단들이 살아 있는 곳.

### MCP/플러그인이 잘해야 하는 것

MCP/플러그인은 실제 작업 흐름 안에서 잡아채야 한다.

- PR merge 전.
- 전략 문서 커밋 전.
- Claude/Codex가 만든 plan 실행 전.
- repo 안의 `docs/strategy.md`, `proposal.pdf`, `board-update.pptx` 검수.

플러그인의 역할:

> 지금 하려는 일을 진행해도 되는지, 작업 현장에서 바로 판단 검수하는 곳.

### 연결 방식

1. MCP/플러그인에서 만든 receipt는 local `.argus/`에 저장.
2. 사용자가 명시적으로 sync하면 웹앱에 올라감.
3. 웹앱에서 만든 receipt는 플러그인이 `/argus:sync`로 가져올 수 있음.
4. 웹앱은 보기/축적/정산에 강하고, 플러그인은 캡처/검수/현장 판단에 강함.

## MVP 범위

MVP는 작아야 한다. 핵심은 "품질 좋은 문서 검수 + receipt + 한 번 돌아오게 만들기"다.

### MVP에 포함

1. **기존 문서 검수하기**
   - paste, md/txt/pdf/docx/pptx 업로드.
   - 전략안/기획안/AI 답변을 대상으로 한다.
   - PDF/DOCX/PPTX는 텍스트 추출과 anchor 보존까지만 목표로 한다.
   - PPTX는 slide title/body/speaker notes/shape text와 slide order를 보존한다.
   - extraction quality를 UI에 표시한다.

2. **Judgment Receipt 생성**
   - core question.
   - top 3 judgment obligations.
   - top 5 weak/unsupported claims.
   - top 3 hidden assumptions.
   - 1 current heading.
   - 1-3 falsifiable follow-ups.

3. **Ownership + Seal**
   - 사용자가 judgment obligation 하나를 선택.
   - pass/fail/check-by를 정함.

4. **Companion Brief 1회**
   - check-by 날짜에 이메일 또는 앱 내 알림.
   - recall, reality check, suggestion, choice.

5. **Settle**
   - happened / avoided / partial / unclear.
   - 짧은 note.
   - receipt 상태 업데이트.

6. **MCP/플러그인 최소 parity**
   - `/argus:review <file or prose>` 또는 `/argus:sail <file or prose>`로 document review 가능.
   - current heading + contract seed 출력.
   - `/argus:seal`, `/argus:settle`, `/argus:sync` 유지.

7. **품질 기준**
   - 사용자가 준 문서에서 최소 3개 이상의 source-specific reference를 보여줘야 한다.
   - generic advice가 나오면 실패로 본다.
   - "더 검토하세요", "리스크를 고려하세요" 같은 문장은 구체적 근거 없이 금지한다.
   - applied lens와 그 이유를 표시해야 한다.
   - top finding 중 최소 80%는 source_anchor를 가져야 한다.
   - PPTX finding은 가능한 한 slide 번호와 slide title을 가져야 한다.

### MVP에서 금지

1. **풀 기능 문서 에디터**
   - Notion/Google Docs를 만들면 안 된다.
   - 문서 수정 제안은 가능하지만 편집기가 핵심이면 안 된다.

2. **매일 streak/gamification**
   - Duolingo의 집착성은 참고하되, Argus는 streak 제품이 아니다.
   - daily prompt는 품격을 떨어뜨린다.

3. **자동으로 모든 것을 모니터링**
   - 이메일, 캘린더, Slack, Drive 전부 연결해서 감시하는 제품은 MVP가 아니다.
   - 사용자가 넣은 receipt만 따라간다.

4. **팀 협업/멀티플레이어**
   - 좋은 기능이지만 MVP에는 무겁다.
   - 먼저 개인이 자기 문서 3개를 다시 넣는지 봐야 한다.

5. **자기계발/라이프코치 톤**
   - "판단력을 성장시키세요"보다 "이 기획안의 위험한 가정은 여기입니다"가 강하다.

6. **완전한 self-learning engine**
   - settled receipt가 0-3개인 상태에서 learning을 말하면 허세다.
   - 초반에는 visible memory만 둔다.

7. **과한 항해 메타포**
   - Current Heading, course 정도는 살릴 수 있다.
   - 첫 사용자는 "내 문서가 제대로 검수됐는가"만 판단한다.

8. **AI가 사용자를 대신 판단**
   - 추천은 가능하다.
   - 사람의 lean, pass/fail 조건, settlement outcome은 사용자가 소유해야 한다.

9. **완전한 시각 디자인/차트/이미지 분석**
   - PPTX 입력 자체는 MVP에 포함한다.
   - 다만 디자인 퀄리티, 차트 수치 검산, 이미지 의미 해석은 MVP가 아니다.
   - PDF/PPTX 안 이미지와 차트는 "분석 제한 가능"으로 정직하게 표시한다.

10. **완전 자동 문서 재작성**
   - Review 이후 사용자가 선택한 섹션만 보완한다.
   - 처음부터 전체 문서를 새로 써버리면 판단 검수의 중심이 흐려진다.

## 제3자 비판: 현재 문서의 부족한 점

이 문서는 방향은 맞지만, 실제 구현 문서로는 아직 낙관적인 부분이 있다. 제3자 제품/엔지니어링 리뷰 기준으로 가장 아쉬운 점은 아래다.

### 1. MVP가 여전히 크다

"MVP는 작아야 한다"고 말하지만 실제로는 paste, md/txt, PDF, DOCX, PPTX, 웹앱, MCP, lens routing, companion, settle까지 들어간다. 이건 MVP라기보다 v0.5에 가깝다.

보완:

- **MVP 기능 범위**와 **MVP 데이터 모델 범위**를 분리한다.
- 데이터 모델은 처음부터 PDF/DOCX/PPTX를 수용한다.
- 제품 표면에서 "정식 지원"으로 여는 것은 품질 게이트를 통과한 포맷부터다.

지원 단계:

| 단계 | 입력 | 제품 표면 |
|---|---|---|
| Tier 0 | paste, md/txt | 정식 지원 |
| Tier 1 | text PDF, simple DOCX, text-first PPTX | 베타 지원, extraction quality 표시 |
| Tier 2 | scanned PDF, image-heavy PPTX, complex charts | 제한 지원 또는 post-MVP |

즉 "처음부터 고려"와 "처음부터 완성"을 혼동하면 안 된다.

### 2. Claude/ChatGPT 대비 우위 검증이 약하다

문서 전체가 "Argus가 더 잘할 것이다"를 전제로 한다. 하지만 사용자는 이미 Claude/ChatGPT에 "비판적으로 봐줘"라고 할 수 있다. 별도 제품을 열게 하려면 구조적 우위가 증명돼야 한다.

보완:

- baseline eval을 Phase 0에 포함한다.
- 같은 artifact에 대해:
  1. Claude/ChatGPT 단일 프롬프트 리뷰.
  2. Argus pipeline 리뷰.
  3. 사람이 만든 gold review.
  를 비교한다.

측정 항목:

- source-specific finding 비율.
- generic advice 비율.
- false/invented criticism 비율.
- 사용자가 실제 수정한 finding 비율.
- 사용자가 "내가 책임질 판단"으로 선택한 finding 비율.
- receipt seal 비율.

Argus가 baseline보다 명확히 낫지 않으면 UI를 만들수록 손실이 커진다.

### 3. Lens 품질 관리가 아직 추상적이다

"좋은 렌즈가 중요하다"는 맞지만, 렌즈가 어떻게 추가/수정/폐기되는지의 운영 규칙이 부족하다. 렌즈가 늘어나면 prompt soup가 되기 쉽다.

보완:

각 lens는 코드처럼 관리한다.

- `lens_id`
- `lens_version`
- 적용 조건
- golden examples
- counterexamples
- severity rubric
- 금지 문장
- expected output schema
- regression tests

렌즈 출시 기준:

- golden example 5개 이상.
- bad generic output counterexample 3개 이상.
- source anchor 없는 finding을 high severity로 내지 않음.
- 같은 문서에서 이전 버전보다 generic advice가 늘지 않음.

렌즈 삭제 기준:

- 사용자가 선택하지 않는 finding을 반복 생성.
- source-specificity가 낮음.
- 다른 lens와 중복.
- action으로 이어지지 않음.

### 4. 긴 문서/큰 deck의 비용과 지연 시간이 빠져 있다

전략 보고서, PDF, PPTX는 길다. 모든 artifact unit을 매번 LLM에 넣으면 느리고 비싸며, context window 안에서 중요한 부분이 희석된다.

보완:

분석 예산을 명시한다.

```ts
type AnalysisBudget = {
  max_units: number;
  max_tokens: number;
  max_lens_calls: number;
  depth: 'quick' | 'standard' | 'deep';
};
```

Depth별 동작:

- `quick`: core question, top risks, top human judgments만.
- `standard`: full receipt + top claim ledger.
- `deep`: lens별 상세, revision suggestions, companion seed.

긴 문서 처리:

1. artifact units를 먼저 요약하지 말고, claim 후보를 찾는다.
2. relevant unit만 lens call에 전달한다.
3. appendix/backup slide는 deck narrative에서 근거 연결 여부만 본다.
4. finding에 필요한 unit만 source context로 다시 불러온다.

UI도 async job이어야 한다. 사용자는 "Analyzing deck narrative", "Mapping claims", "Running evidence lens" 같은 단계 상태를 봐야 한다.

### 5. 실패 UX가 부족하다

좋은 케이스만 설계돼 있다. 실제로는 extraction 실패, decision 없음, lens 충돌, 너무 generic한 결과가 자주 나온다.

보완:

실패 상태를 first-class로 둔다.

| 실패 | 사용자 표시 | 다음 행동 |
|---|---|---|
| extraction low | "이 파일은 텍스트 추출 품질이 낮습니다" | paste text 요청, OCR 안내 |
| no decision found | "이 문서는 판단 요청보다 정보 기록에 가깝습니다" | decision extraction으로 전환 |
| no source anchors | "원문 근거가 충분히 연결되지 않았습니다" | low-confidence review로 제한 |
| lens conflict | "렌즈 간 평가가 갈립니다" | conflicting findings를 나란히 표시 |
| generic result | 내부 실패로 간주 | 재시도 또는 narrower concern 질문 |

Argus는 실패를 숨기면 안 된다. "이번 문서는 제대로 검수하기 어렵다"고 말할 수 있어야 신뢰가 생긴다.

### 6. Revision의 출력 단위가 아직 모호하다

"문서 보완안"은 너무 넓다. DOCX/PPTX를 실제로 수정할지, 수정 지시를 줄지, 새 초안을 만들지 구분해야 한다.

보완:

Revision output은 artifact별로 다르게 정의한다.

| 입력 | Revision output |
|---|---|
| paste/md/txt | rewritten section 또는 patch-style edit |
| DOCX | section-level replacement suggestion |
| PDF | source 문서 수정 불가, memo-style revision guidance |
| PPTX | slide-level edit instruction: title/body/insert/delete/reorder |
| meeting notes | decision memo draft |

PPTX 예:

```text
Slide 4: 시장 규모 claim은 근거가 뒤 appendix에만 있습니다.
Action: slide 4 하단에 source metric 1개 추가하거나, slide 11을 앞으로 당기세요.
```

이렇게 해야 "문서를 새로 써주는 AI"가 아니라 "판단 리스크를 줄이는 수정 제안"으로 남는다.

### 7. Schema/version/provenance가 부족하다

나중에 receipt가 쌓이면, 어떤 모델/렌즈/파서로 만든 finding인지 모르면 비교와 학습이 불가능하다.

보완:

모든 주요 객체에 version/provenance를 넣는다.

```ts
type ReviewProvenance = {
  schema_version: string;
  extraction_tool: string;
  extraction_version: string;
  lens_versions: Record<string, string>;
  model_provider: 'anthropic' | 'openai' | 'local' | 'unknown';
  model_name: string;
  prompt_hash: string;
  created_at: string;
};
```

나중에 "Argus가 좋아졌다"를 증명하려면 이 provenance가 필요하다.

### 8. 보안/프라이버시 약속이 더 구체적이어야 한다

receipt 중심 저장 원칙은 좋지만, 실제 사용자는 전략 문서/PPT를 올릴 때 민감도를 걱정한다. "저장 안 함"만으로는 부족하다.

보완:

MVP에서 최소한 아래를 제공한다.

- upload 전 privacy mode 선택.
- 분석 후 source 삭제.
- receipt 삭제.
- local-only mode for MCP.
- source fingerprint만 저장 가능.
- 민감정보 redaction은 post-MVP로 두되, roadmap에 명시.

카피:

> 원문을 보관하지 않고도, 검수 결과와 당신이 선택한 판단만 남길 수 있습니다.

### 9. "좋은 결과"의 정의가 여전히 감탄에 가깝다

문서가 "source-specific"을 말하지만, 제품 성공 기준은 더 엄격해야 한다.

보완:

첫 20개 dogfood artifact에서 기록할 것:

- 사용자가 실제로 수정한 문장/슬라이드 수.
- 삭제/보류한 주장 수.
- 새로 만든 evidence request 수.
- 사용자가 ownership으로 선택한 judgment 수.
- 7일 내 재업로드/재검수 수.
- check-back 응답 수.

핵심 성공 문장:

> "좋은 리뷰였다"가 아니라 "이 finding 때문에 문서/판단이 실제로 바뀌었다."

## 보완된 구현 게이트

각 Phase는 기능 완료가 아니라 품질 게이트를 통과해야 다음으로 간다.

| Phase | Gate |
|---|---|
| Schema Lock | 모든 finding이 source_anchor/provenance/confidence를 담을 수 있음 |
| Sample Corpus | 20개 dogfood artifact와 gold review가 준비됨 |
| Ingestion | 10개 샘플 파일에서 90% 이상 unit anchor가 보존됨 |
| Reviewability | 낮은 품질 파일에서 full receipt 대신 downgrade/failure UX가 작동함 |
| Lens Quality | baseline Claude/ChatGPT 대비 source-specific finding 비율이 높음 |
| Review Workspace | 사용자가 30초 안에 core question/top risks/human judgments를 찾음 |
| Ownership | reviewed artifact 중 40% 이상에서 judgment_obligation_selected 발생 |
| Companion | opened brief 중 30% 이상에서 settle/revise/push-date 행동 발생 |
| MCP Parity | 같은 artifact에서 웹앱과 MCP가 같은 receipt schema를 생성 |

이 게이트를 통과하지 못하면 다음 UI/기능을 더 만들지 않는다.

## 마지막 다각도 리뷰: 더 보완해야 할 것

이 섹션은 "큰 MVP가 필요하다"는 전제를 받아들인 상태에서, 그래도 구현이 산으로 가지 않게 잡아두는 마지막 안전장치다.

### 1. MVP가 아니라 Minimum Credible Version으로 봐야 한다

이 범위는 일반적인 MVP보다 크다. 하지만 Argus는 파일 입력, source anchor, lens review, receipt, ownership 중 하나라도 빠지면 기존 Claude/ChatGPT 프롬프트와 구분이 약해진다.

따라서 이름을 다르게 잡는다.

> MVP = 작은 기능 묶음이 아니라, 사용자가 "이건 그냥 프롬프트가 아니다"라고 느끼는 최소 신뢰 버전.

Minimum Credible Version의 필수 조건:

- artifact를 실제로 읽는다.
- 원문 위치로 돌아갈 수 있다.
- 문서 유형에 맞는 lens를 고른다.
- generic advice를 줄인다.
- 사용자가 책임질 판단을 분리한다.
- 적어도 하나의 follow-up predicate를 남긴다.

이 중 하나가 빠지면 제품의 핵심 차별점이 무너진다.

### 2. 그래도 구현은 vertical slice로 잘라야 한다

큰 MVP를 한 번에 열면 안 된다. 사용자에게 보이는 최종 범위는 크더라도, 내부 구현은 아래 순서로 수직 절단한다.

| Slice | 목표 | 포함 | 제외 |
|---|---|---|---|
| Slice 1 | 텍스트 전략안 1개를 receipt로 바꾼다 | paste/md, 3개 lens, source anchors | PDF/DOCX/PPTX, companion |
| Slice 2 | 파일 입력을 같은 객체로 정규화한다 | text PDF, simple DOCX/PPTX, extraction quality | OCR, chart/image interpretation |
| Slice 3 | lens routing이 실제로 다르게 작동한다 | strategy memo vs deck vs PRD | 모든 문서 유형 |
| Slice 4 | side-by-side workspace로 신뢰를 만든다 | anchor jump, claim ledger, lens disclosure | full editor |
| Slice 5 | ownership/seal로 단발 리뷰를 넘는다 | judgment obligation 선택, pass/fail/check-by | full memory engine |
| Slice 6 | companion이 잔소리가 아니라 가치인지 본다 | 1회 Companion Brief, settle/revise/push date | repeated automation |
| Slice 7 | MCP parity를 만든다 | local file review, same receipt schema | workspace-wide sync automation |

각 slice는 end-to-end로 돌아가야 한다. "PDF 파서만 만들었다"는 제품 진척이 아니다. "간단한 PDF 하나가 receipt로 바뀌고 source anchor가 클릭된다"가 진척이다.

### 3. 샘플 코퍼스가 먼저 필요하다

렌즈 품질은 추상 토론으로 좋아지지 않는다. 구현 전에 최소 샘플 코퍼스를 만든다.

초기 20개 dogfood artifact:

| 유형 | 개수 | 예 |
|---|---:|---|
| strategy memo | 3 | Argus 포지셔닝, GTM, 가격 전략 |
| PRD/product plan | 3 | onboarding, plugin/webapp, import flow |
| PPTX/deck | 4 | board update, pitch deck, strategy deck, product review deck |
| PDF report | 3 | Anthropic report, market report, policy report |
| DOCX/proposal | 2 | 전략 제안서, 내부 보고서 |
| meeting notes | 2 | 회의록/브레인스토밍 |
| LLM answer | 2 | Claude/GPT가 만든 전략 답변 |
| intentionally bad doc | 1 | 근거 없는 주장, 모순, 애매한 ask가 섞인 문서 |

각 artifact마다 gold review를 만든다.

Gold review 필드:

- core question.
- top 3 judgment obligations.
- top 5 claim/evidence issues.
- top 3 hidden assumptions.
- expected source anchors.
- expected revision actions.
- expected follow-up predicate.

이 코퍼스가 없으면 lens quality loop는 감으로 흐른다.

### 4. Reviewability Score가 필요하다

모든 문서가 같은 수준으로 검수 가능하지 않다. Argus는 검수 가능성을 먼저 판단해야 한다.

```ts
type ReviewabilityScore = {
  score: number; // 0-100
  extraction: number;
  structure: number;
  decision_clarity: number;
  evidence_availability: number;
  anchor_coverage: number;
  reasons: string[];
};
```

사용:

- 80-100: normal review.
- 60-79: review with caveats.
- 40-59: limited review, ask for missing context.
- <40: do not produce full receipt; produce "what is missing" instead.

이 장치가 없으면 image-heavy deck이나 스캔 PDF에도 Argus가 자신 있게 말하게 된다. 그건 신뢰를 잃는 빠른 길이다.

### 5. UI는 "많이 보여주기"보다 "증거로 데려가기"가 중요하다

side-by-side라고 해서 모든 finding을 한 번에 뿌리면 안 된다. 초기 화면은 좁아야 한다.

첫 화면:

- Core Question.
- Current Reviewability.
- Top 3 Judgment Obligations.
- Top 3 Findings.
- Applied lenses.

두 번째 화면:

- Claim Ledger.
- hidden assumptions.
- deck narrative map.
- revision actions.

Deck 전용 UI:

- 왼쪽: slide thumbnails 또는 slide list.
- 가운데: selected slide text/notes.
- 오른쪽: slide-level findings.
- 상단: deck narrative path.

PPTX 검수는 "슬라이드별 첨삭"이 아니라 "설득 흐름의 판단 리스크"가 중심이어야 한다.

### 6. 비동기 job과 재현성이 필요하다

PDF/PPTX/DOCX 분석은 즉시 응답으로 끝나지 않을 수 있다. 처음부터 async job으로 설계한다.

```ts
type ReviewJob = {
  job_id: string;
  artifact_id: string;
  status:
    | 'queued'
    | 'extracting'
    | 'profiling'
    | 'mapping'
    | 'routing'
    | 'reviewing'
    | 'synthesizing'
    | 'ready'
    | 'needs_context'
    | 'failed';
  progress_label: string;
  partial_receipt?: Partial<JudgmentReceipt>;
  error?: ReviewFailure;
};
```

운영 원칙:

- 같은 artifact fingerprint + 같은 lens version + 같은 prompt hash면 cache 가능.
- extraction 결과와 lens output은 재현 가능해야 한다.
- 사용자가 새 버전을 올리면 diff review로 전환한다.
- 실패한 job은 재시도 가능해야 한다.

### 7. 모델 전략은 provider-agnostic이어야 한다

Argus의 차별점은 Claude/GPT 중 어느 모델을 쓰느냐가 아니라 pipeline/lens/receipt다. 따라서 모델 호출 계층은 provider-agnostic이어야 한다.

원칙:

- extraction, review, synthesis call을 분리한다.
- 각 call은 structured output schema를 가진다.
- model output은 바로 UI에 내보내지 않고 validator를 통과한다.
- validator 실패 시 repair call 또는 downgrade.
- provider별 prompt 차이는 adapter에 숨긴다.

나중에 더 좋은 모델이 나와도 Argus의 핵심 asset은 lens library, sample corpus, receipt history여야 한다.

### 8. Guardrail은 "위험 차단"보다 "소유권 정직성"이다

Argus는 사용자를 대신 판단하지 않는다는 spine을 지켜야 한다. 문서 검수에서도 같은 원칙이 중요하다.

금지:

- "이 전략은 틀렸습니다."
- "진행하세요."
- "당신의 판단 패턴은 X입니다." (데이터 부족 상태)
- "이 문서는 설득력이 없습니다." (근거 없이)

허용:

- "이 문서는 X 결정을 요구하지만, Y 근거가 없습니다."
- "이 주장을 믿으려면 Z를 사람이 판단해야 합니다."
- "slide 6의 claim은 slide 12 appendix 근거와 연결되지 않습니다."
- "이 조건을 2주 뒤 확인하면 판단을 정산할 수 있습니다."

Argus의 tone은 critic이 아니라 accountable reviewer다.

### 9. 초기에는 "팀 협업"을 닫되, 공유 가능한 receipt는 열어둔다

팀 기능은 무겁지만, 전략 문서 검수는 누군가에게 보여줘야 가치가 커진다. 따라서 팀 협업은 MVP 밖으로 두되, receipt 공유는 가볍게 허용할 수 있다.

MVP 허용:

- receipt export markdown.
- receipt share link optional.
- source 없이 receipt만 공유.
- redacted receipt.

MVP 금지:

- comments.
- assignees.
- permissions matrix.
- shared workspaces.

이렇게 해야 팀 제품으로 빨려 들어가지 않으면서도 "이 검수 결과를 동료에게 보여주고 싶다"는 사용자의 자연스러운 행동을 막지 않는다.

### 10. Kill criteria도 구현 문서에 박아야 한다

기능을 많이 만들수록 멈추기 어렵다. 그래서 kill criteria를 implementation doc 안에 둔다.

초기 20개 artifact dogfood에서 아래가 나오면 멈추고 재설계한다.

- source-specific finding이 baseline보다 높지 않다.
- 사용자가 finding을 보고 문서/슬라이드를 거의 수정하지 않는다.
- judgment_obligation_selected가 30% 미만이다.
- extraction quality 때문에 PDF/PPTX 사용자가 반복적으로 이탈한다.
- companion brief가 열리지만 settle/revise 행동이 없다.
- 사용자가 receipt를 저장하지 않고 결과만 복사한다.

이 경우 방향은 둘 중 하나다.

1. "Strategy Judgment Review"가 아니라 더 좁은 "deck/memo critique tool"로 줄인다.
2. Review 후 receipt/companion을 버리고 pure revision workflow로 전환한다.

둘 다 실패가 아니라 학습이다. 하지만 이 신호를 무시하고 계속 만들면 다시 생각의 수레바퀴로 돌아간다.

## 구현 순서

구현은 UI부터 만들면 안 된다. 먼저 객체와 파이프라인을 고정해야 한다.

### Phase 0: Schema Lock

목표: 흔들리지 않을 중간 객체를 먼저 정의한다.

만들 것:

- `CanonicalArtifact`.
- `DocumentProfile`.
- `DocumentJudgmentMap`.
- `JudgmentLens`.
- `LensFinding`.
- `JudgmentReceipt`.
- `ReviewProvenance`.
- `AnalysisBudget`.
- `ReviewabilityScore`.
- `ReviewJob`.

완료 기준:

- paste/md/txt/pdf/docx/pptx가 모두 `CanonicalArtifact`로 들어갈 수 있다.
- `source_anchor`가 없는 finding은 high-confidence finding이 될 수 없다.
- Create session과 Review session이 같은 `JudgmentReceipt`로 수렴하되 root mode는 다르게 남는다.
- schema version, lens version, prompt hash, extraction tool이 receipt에 남는다.
- review job state와 reviewability score가 schema에 포함된다.

### Phase 0.5: Sample Corpus and Baseline

목표: 구현 전에 무엇이 좋은 결과인지 정한다.

만들 것:

- 20개 dogfood artifact.
- 각 artifact의 gold review.
- Claude/ChatGPT baseline output.
- Argus expected output.
- generic/bad output counterexamples.

완료 기준:

- 최소 5개는 deck/PPTX다.
- 최소 3개는 PDF다.
- 최소 3개는 일부러 나쁜 문서다.
- 각 artifact마다 expected source anchors가 있다.
- baseline보다 나아야 할 항목이 명시되어 있다.

### Phase 1: Ingestion Thin Slice

목표: 가장 단순한 파일들을 실제로 받는다.

순서:

1. paste.
2. markdown/txt.
3. text PDF.
4. DOCX.
5. PPTX text/slide structure.

완료 기준:

- 원문이 ArtifactUnit으로 쪼개진다.
- page/section/paragraph/slide anchor가 남는다.
- extraction quality가 표시된다.
- source 저장 모드를 선택할 수 있다.
- extraction low/unsupported 상태가 UI와 API에 그대로 드러난다.
- reviewability score가 계산된다.

하지 않을 것:

- OCR.
- 차트 해석.
- deck visual design scoring.
- 복잡한 표 구조 복원.

### Phase 2: Strategy/Plan Review Only

목표: 모든 문서가 아니라 전략안/기획안/AI 답변만 잘 본다.

초기 supported profile:

- `strategy_memo`.
- `strategy_deck`.
- `pitch_deck`.
- `prd`.
- `llm_answer`.
- `meeting_notes`는 experimental.

완료 기준:

- Document Profile 자동 추론.
- Document Judgment Map 생성.
- lens routing.
- Judgment Receipt 생성.

### Phase 3: Lens Quality Loop

목표: 좋은 렌즈를 만든다.

초기 9개 lens를 구현하고, 각 lens마다 golden examples를 둔다.

각 example은 다음을 포함한다.

- input snippet.
- expected finding.
- source anchor.
- bad generic finding example.
- why bad.
- expected user action.

완료 기준:

- 같은 문서를 Claude/ChatGPT에 "비판적으로 봐줘" 한 결과보다 더 source-specific하다.
- findings가 바로 문서 수정 또는 판단 선택으로 이어진다.
- generic advice 비율, false criticism 비율, selected finding 비율을 기록한다.

### Phase 4: Review Workspace

목표: 결과를 긴 리포트가 아니라 작업 가능한 화면으로 보여준다.

만들 것:

- side-by-side source/receipt.
- claim ledger filters.
- finding click -> source anchor jump.
- applied lens disclosure.
- "이 판단을 내가 소유하기" CTA.

완료 기준:

- 사용자가 첫 화면에서 core question, top risks, human judgments를 30초 안에 파악한다.
- finding을 클릭하면 원문 위치로 간다.

### Phase 5: Ownership and Companion

목표: 단발 검수에서 살아 있는 판단으로 넘어간다.

만들 것:

- ownership modal.
- pass/fail/check-by.
- receipt state transition.
- Companion Brief 1회.
- settle view.

완료 기준:

- 사용자가 최소 1개 judgment obligation을 선택한다.
- check-by 날짜에 과거 receipt 기반의 구체적 brief가 생성된다.

### Phase 6: MCP Parity

목표: 실제 작업 흐름에서 같은 객체를 만든다.

만들 것:

```text
/argus:review docs/strategy.md
/argus:review proposal.pdf
/argus:review board-update.pptx
/argus:review "이 Claude 답변 그대로 실행해도 될까?"
```

출력:

- Current Bearing.
- top judgment obligations.
- weak claims.
- contract seed.
- local receipt path.

완료 기준:

- 웹앱과 MCP가 같은 receipt schema를 쓴다.
- MCP 결과를 웹앱으로 sync할 수 있다.

## 개발 순서에서 지켜야 할 원칙

1. **문서 포맷보다 judgment map이 먼저다.**
   - PDF 지원을 넓히기보다 map 품질을 먼저 높인다.

2. **렌즈는 UI보다 먼저 검증한다.**
   - 좋은 UI에 generic findings가 올라가면 제품 신뢰가 더 빨리 깨진다.

3. **Revision은 Review 이후 action이다.**
   - 사용자가 선택한 판단/섹션에 대해서만 보완안을 만든다.

4. **모든 finding은 source-specific해야 한다.**
   - 원문에 닿지 않는 말은 숨기거나 낮은 confidence로 처리한다.

5. **초기에는 supported scope를 정직하게 좁힌다.**
   - "모든 문서 검수"가 아니라 "전략안/기획안/AI 초안 판단 검수"다.

## 가장 먼저 만들어야 하는 데모

데모는 "인생 결정"이 아니라 사용자가 방금 말한 흐름이어야 한다.

입력:

> 내가 만든 Argus 전략안 또는 Anthropic 리서치 기반 포지셔닝 메모.

Argus 출력:

1. 이 문서의 진짜 판단은 "Argus를 decision app이 아니라 strategy-document judgment review로 좁힐 것인가"다.
2. 사람이 직접 판단해야 할 것:
   - 내가 실제로 이 검수를 주 2회 이상 쓸 것인가.
   - 문서 검수 결과가 Claude 단독 답변보다 충분히 날카로운가.
   - receipt가 다시 돌아올 이유를 만드는가.
3. 약한 가정:
   - "좋은 UI/UX면 쓴다"는 가정은 아직 검증되지 않았다.
   - "리마인더가 아니라 동행이면 retention이 생긴다"는 가정은 매력적이지만 미검증이다.
4. Follow-up:
   - 7일 안에 창업자 본인이 실제 전략 문서 3개를 넣고, 그중 2개에서 판단을 바꾸거나 수정하면 proceed.
   - 5명의 타깃 사용자 중 3명이 자기 문서를 다시 넣고 싶어하면 proceed.
   - 둘 다 실패하면 "문서 검수 wedge"도 아직 wishful이다.

이 데모가 창업자 본인에게 가치가 없으면 시장에도 어렵다. 반대로 이 데모가 진짜로 매일 쓰고 싶을 정도로 날카로우면, Argus의 첫 wedge는 결정된다.

## 한 문장 전략

Argus는 AI 시대의 전략안/기획안 검수 레이어다. 사용자가 만든 문서와 AI가 만든 답변에서 사람이 책임질 판단을 뽑아 Judgment Receipt로 남기고, 그 판단이 현실에서 답을 얻을 때까지 같이 따라간다.
