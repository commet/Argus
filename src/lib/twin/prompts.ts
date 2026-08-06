// TWIN 프롬프트 단일 정본 (Single Source of Truth for Prompts 규약).
//
// 이 파일의 프롬프트는 전부 **예측**을 만든다 — 조언이 아니다. 분신은 사용자
// 대신 판단하지 않고, "이 사람이라면 / 현실이라면"을 맞히려 시도할 뿐이다.
// 그 시도의 성적이 정산 때 매겨진다는 것을 프롬프트 자신이 알고 있어야
// 반증 가능한 문장이 나온다.

export interface ShadowOpening {
  utterance: string;
  lean?: string;
  statedReasons: string[];
  consideredAlternatives: string[];
}

// 프로필 항목은 M2에서 주입된다. 비어 있으면 비어 있다고 말한다 —
// 없는 프로필을 있는 척 요약하는 것이 정확히 LLM-glue 함정이다.
export function buildShadowSystem(profileLines: string[]): string {
  return (
    '너는 이 사용자의 판단 분신(judgment twin)이다. 임무는 조언이 아니라 **예측**이다.\n' +
    '지금 예측을 봉인하고, 결정이 정산될 때 현실과 대조된다 — 그럴듯한 문장이 아니라\n' +
    '틀릴 수 있는 문장을 써야 성적이 존재한다.\n\n' +
    '규칙:\n' +
    '· outcome_expectation 은 **반증 가능**해야 한다: 무엇이 관찰되면 이 예측이\n' +
    '  틀린 것인지가 문장 안에서 읽혀야 한다. ("잘 될 것" 금지, "3개월 안에 X가\n' +
    '  Y를 넘는다/넘지 못한다" 형태)\n' +
    '· 사용자가 말하지 않은 사실을 지어내지 말 것. 모르면 확신도를 낮출 것.\n' +
    '· 어느 쪽이 낫다는 조언 문장 금지 — 예측만.\n\n' +
    (profileLines.length > 0
      ? '이 사용자의 판단 프로필 (정산으로 채점된 항목만):\n' + profileLines.map((l) => `· ${l}`).join('\n')
      : '판단 프로필: 아직 없음 (정산 표본 부족). 결정 원문만으로 예측하고, 확신도를 그에 맞게 낮출 것.')
  );
}

export function buildShadowUser(opening: ShadowOpening): string {
  const parts = [`사용자가 연 결정 (원문):\n"${opening.utterance}"`];
  if (opening.lean) parts.push(`사용자가 밝힌 현재 기울기: "${opening.lean}"`);
  if (opening.statedReasons.length > 0) parts.push(`사용자가 말한 이유: ${opening.statedReasons.join(' / ')}`);
  if (opening.consideredAlternatives.length > 0)
    parts.push(`저울질한 대안: ${opening.consideredAlternatives.join(' / ')}`);
  parts.push(
    opening.lean
      ? '기울기가 이미 밝혀져 있으므로 choice 예측은 자명하다. 대신 **이탈 여부**를 예측하라: ' +
        '이 사용자가 최종 채택에서 저 기울기를 뒤집을 것인가? (deviation_expectation)'
      : '기울기가 없다. 이 사용자가 최종적으로 무엇을 채택할지 예측하라 (choice_expectation).',
  );
  return parts.join('\n\n');
}

// callAnthropicJson 의 tool schema. 필드 의미는 마이그레이션 주석과 1:1.
export const SHADOW_SCHEMA = {
  type: 'object' as const,
  properties: {
    outcome_expectation: {
      type: 'string',
      description: '이 결정이 정산될 때 현실이 무엇이라 답할지 — 반증 가능한 한 문장.',
    },
    outcome_confidence: { type: 'number', minimum: 0, maximum: 1 },
    second_expectation: {
      type: 'string',
      description:
        '기울기가 있었으면: 사용자가 그 기울기에서 이탈할지(한다/안 한다 + 근거 조건). 없었으면: 사용자가 무엇을 채택할지.',
    },
    second_confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string', description: '두 예측의 공통 근거. 지어낸 사실 금지.' },
  },
  required: ['outcome_expectation', 'outcome_confidence', 'second_expectation', 'second_confidence', 'reasoning'],
};

// ── 정산 채점 (3치 판정) ──────────────────────────────────────────────────
//
// 자유 텍스트 관찰에 소수점 성적을 붙이지 않는다. supported / contradicted /
// indeterminate 셋뿐이고, 판정에는 관찰문 인용이 필수다 — 인용 못 하면
// indeterminate 다 (그럴듯함이 맞음으로 위장하는 것의 방지선).

export function buildVerdictSystem(): string {
  return (
    '봉인됐던 예측과 실제 관찰을 대조해 판정한다. 셋 중 하나만:\n' +
    '· supported — 관찰이 예측을 뒷받침한다. 근거 문장을 관찰문에서 **그대로 인용**할 것.\n' +
    '· contradicted — 관찰이 예측과 어긋난다. 근거 문장을 그대로 인용할 것.\n' +
    '· indeterminate — 관찰만으로는 판정할 수 없다. **의심스러우면 이쪽이다.**\n' +
    '인용 없는 supported/contradicted 는 무효다.'
  );
}

export function buildVerdictUser(expectation: string, observation: string): string {
  return `봉인됐던 예측:\n"${expectation}"\n\n정산 때 사용자가 말한 실제 관찰:\n"${observation}"`;
}

// choice/deviation 예측의 채점 — 현실이 아니라 **사용자의 실제 채택**과 대조한다.
// 여기가 match rate 의 재료다 ("분신이 나를 얼마나 아는가"). 문자열 비교로는
// 안 되는 이유: "3개월 계약직"과 "단기 계약으로 먼저"는 같은 선택이다.
export function buildChoiceVerdictUser(
  target: 'choice' | 'deviation',
  expectation: string,
  adoptedChoice: string,
  lean?: string,
): string {
  if (target === 'deviation') {
    return (
      `봉인됐던 이탈 예측:\n"${expectation}"\n\n` +
      `결정을 열 때 사용자가 밝힌 기울기: "${lean ?? '(없음)'}"\n` +
      `최종적으로 채택한 것: "${adoptedChoice}"\n\n` +
      '실제로 기울기에서 이탈했는지를 먼저 판단하고, 그것이 예측과 맞는지 판정하라.'
    );
  }
  return `봉인됐던 선택 예측:\n"${expectation}"\n\n사용자가 실제로 채택한 것:\n"${adoptedChoice}"`;
}

export const VERDICT_SCHEMA = {
  type: 'object' as const,
  properties: {
    verdict: { type: 'string', enum: ['supported', 'contradicted', 'indeterminate'] },
    quote: { type: 'string', description: '관찰문에서 그대로 인용한 근거. indeterminate 면 빈 문자열.' },
  },
  required: ['verdict', 'quote'],
};

// ── 판단 프로필 추출 (정산 직후) ──────────────────────────────────────────
//
// 추출은 **이번에 정산된 케이스 하나**에서만 한다. 여러 케이스에 걸친 일반화는
// 표본이 쌓인 뒤의 일이고, 그때도 증거 링크가 실존 검사를 통과해야 한다.
// 프로필은 사용자를 판정하는 문장이 아니라 **관찰된 패턴 + 증거**다.

export interface SettledCaseFacts {
  caseId: string;
  question: string;
  choice: string;
  statedReasons: string[];
  observation: string;
  recall: string;
}

export function buildExtractSystem(): string {
  return (
    '정산이 끝난 결정 하나를, 이 사용자의 기존 판단 프로필에 비추어 읽는다.\n' +
    '할 일은 셋이고, 셋 다 하지 않아도 된다 (빈 답이 정직한 답일 수 있다):\n\n' +
    '1. items — 이번에 **새로** 관찰된 패턴\n' +
    '2. reinforces — 기존 항목 중 이번 정산이 **뒷받침한** 것의 번호\n' +
    '3. contradicts — 기존 항목 중 이번 정산이 **어긋난** 것의 번호\n\n' +
    '층 구분:\n' +
    '· L1 가치·기준 — 이 선택에서 드러난, 사용자가 무겁게 치는 기준\n' +
    '· L2 믿음·보정 — 사용자의 가정이 현실과 어떻게 맞았/틀렸는가\n' +
    '· L3 정책 — "이 조건에서는 이렇게 한다"로 읽히는 규칙\n\n' +
    '규칙 (위반 항목은 기계 검증이 버린다):\n' +
    '· 이 케이스에서 **실제로 관찰된 것만**. 일반화·추측 금지 — 한 건은 한 건이다.\n' +
    '· 사용자에 대한 판정 언어 금지: "~한 사람", "~형", 점수, 등급, 성향 진단 전부.\n' +
    '  패턴은 "이 결정에서 X를 Y보다 무겁게 쳤다" 형태의 관찰 문장으로.\n' +
    '· 기존 항목과 **같은 말이면 items 에 새로 쓰지 말고 reinforces 에 번호를 넣을 것.**\n' +
    '  같은 관찰이 항목 다섯 개로 흩어지면 근거 다섯 건짜리 패턴 하나가 영영 생기지 않는다.\n' +
    '· 애매하면 아무 번호도 넣지 말 것 — 억지 연결은 반례를 조작하는 것과 같다.\n' +
    '· 확신도는 쓰지 않는다. 그것은 근거·반례 개수에서 기계가 계산한다.'
  );
}

/** 기존 항목은 번호와 함께 보여 준다 — 모델이 돌려주는 것은 번호뿐이다. */
export function buildExtractUser(f: SettledCaseFacts, existing: string[] = []): string {
  const head =
    `결정 질문: "${f.question}"\n` +
    `채택한 것: "${f.choice}"\n` +
    (f.statedReasons.length > 0 ? `그때 말한 이유: ${f.statedReasons.join(' / ')}\n` : '') +
    `정산 직전의 기억: "${f.recall}"\n` +
    `실제로 일어난 일: "${f.observation}"`;
  if (existing.length === 0) return `${head}\n\n기존 프로필 항목: 없음.`;
  return `${head}\n\n기존 프로필 항목 (번호로 참조):\n${existing.map((l, i) => `${i}. ${l}`).join('\n')}`;
}

export const EXTRACT_SCHEMA = {
  type: 'object' as const,
  properties: {
    items: {
      type: 'array',
      maxItems: 3,
      description: '이번 정산에서 새로 관찰된 패턴. 기존 항목과 같은 말이면 여기 넣지 말 것.',
      items: {
        type: 'object',
        properties: {
          layer: { type: 'string', enum: ['L1', 'L2', 'L3'] },
          domain: { type: 'string', description: '결정의 영역 한 단어 (예: 채용, 가격, 일정)' },
          content: { type: 'string', description: '관찰 문장. 판정 언어 금지.' },
        },
        required: ['layer', 'domain', 'content'],
      },
    },
    reinforces: {
      type: 'array',
      description: '이번 정산이 뒷받침한 기존 항목의 번호들. 없으면 빈 배열.',
      items: { type: 'number' },
    },
    contradicts: {
      type: 'array',
      description: '이번 정산이 어긋난 기존 항목의 번호들. 없으면 빈 배열. 애매하면 넣지 말 것.',
      items: { type: 'number' },
    },
  },
  required: ['items', 'reinforces', 'contradicts'],
};
