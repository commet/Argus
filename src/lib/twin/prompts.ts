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

export const VERDICT_SCHEMA = {
  type: 'object' as const,
  properties: {
    verdict: { type: 'string', enum: ['supported', 'contradicted', 'indeterminate'] },
    quote: { type: 'string', description: '관찰문에서 그대로 인용한 근거. indeterminate 면 빈 문자열.' },
  },
  required: ['verdict', 'quote'],
};
