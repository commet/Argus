// 도구 표면 — 여섯 개, 그 이상 만들지 않는다 (기획서 §4).
//
// 이 파일은 도구의 **선언**만 갖는다. 각 도구가 하는 일은 method-harness가
// 정하며, 여기서 방법 규칙을 다시 쓰지 않는다 (단일 정본).
//
// 없는 도구가 왜 없는지도 기록한다 — 나중에 "왜 채택 도구가 호스트 승인으로
// 안 되지?"를 다시 묻지 않도록.
//
// **선언이 곧 계약이다.** 이 스키마는 모델이 읽는 유일한 사양이므로, 핸들러가
// 실제로 읽는 인자는 전부 여기 선언돼 있어야 하고(안 그러면 모델이 보낼 줄
// 모른다), 여기 선언된 인자는 전부 핸들러가 소비해야 한다(안 그러면 모델은
// 반영됐다고 믿는다). 둘 다 tools-contract.test.ts 가 기계로 대조한다.

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

const STEP_SCHEMA = {
  type: 'object',
  properties: {
    what: { type: 'string', description: '무엇을 하는가. 한 문장.' },
    kind: { type: 'string', enum: ['prepare', 'investigate', 'execute'], description: '준비 / 조사 / 실행' },
    byOrWhen: { type: 'string', description: '언제까지 또는 어떤 조건에서. 사람이 읽는 표현.' },
    dueDate: { type: 'string', description: 'ISO 8601 날짜. 붙이면 이 단계가 돌아보기 약속이 된다.' },
  },
  required: ['what', 'kind', 'byOrWhen'],
} as const;

export const TOOLS: ToolDef[] = [
  {
    name: 'argus_open',
    title: '결정 열기',
    description:
      '사용자가 앞에 둔 결정을 연다. 사용자가 이미 말한 것에서 현재 기울기와 이유를 추출해 함께 기록한다(심문하지 않는다). 아직 조언하지 않는다. 결정이 열려 있지 않거나 평평한 상황이면 이 도구를 부르지 말 것 — 서버도 같은 관문을 다시 돌리며, 통과하지 못하면 열지 않는다.',
    inputSchema: {
      type: 'object',
      properties: {
        utterance: { type: 'string', description: '사용자가 결정을 말한 원문. 요약하지 말고 그대로.' },
        lean: { type: 'string', description: '사용자가 밝힌 현재 기울기. 말하지 않았으면 생략(지어내지 말 것).' },
        statedReasons: { type: 'array', items: { type: 'string' }, description: '사용자가 실제로 말한 이유만.' },
        consideredAlternatives: { type: 'array', items: { type: 'string' }, description: '사용자가 이미 저울질한 대안만.' },
        userInvoked: {
          type: 'boolean',
          description:
            '사용자가 **명시적으로** Argus를 부르거나 "기록해줘"라고 했는가. 당신이 이 도구를 부르기로 판단한 것은 여기에 해당하지 않는다 — 그때는 false 로 두고 관문에 맡길 것.',
        },
      },
      required: ['utterance'],
    },
  },
  {
    name: 'argus_sharpen',
    title: '한 가지만 점검',
    description:
      '**두 번 부른다.** 처음에 caseId만 보내면 무엇을 지켜야 하는지와 사용자가 실제로 말한 것을 돌려준다. 그다음 당신이 정한 짚기를 assumption·falsifier와 함께 다시 보내면 검증기를 통과시켜 원장에 남긴다. 두 번째 호출을 하지 않으면 그 짚기는 기록되지 않는다. 한 턴에 한 가지만, 방향은 정해주지 않는다. **생각의 노동은 당신 몫이다**: 사용자에게 "이게 틀렸다면 뭘 보면 알까요?"를 백지로 묻지 말 것 — 반증 지표는 당신이 구체적으로 제안하고, 사용자는 맞는지 확인하거나 고치기만 하게 한다.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        assumption: { type: 'string', description: '하중이 가장 큰 가정 하나. 방향 문장이 아니라 가정이어야 한다.' },
        falsifier: {
          type: 'string',
          description:
            '이 가정이 틀렸음을 보여줄 관찰 가능한 사실. **당신이 제안한다** — 사용자에게 숙제로 넘기지 말 것 ("지난 3개월 수주 건수가 꺾였는가"처럼 구체적으로). 없으면 검증기가 짚기를 질문으로 낮춘다.',
        },
        whyNow: { type: 'string', description: '왜 지금 이것을 짚는가.' },
        moveType: {
          type: 'string',
          enum: ['reframe', 'value_clarification', 'competing_hypotheses', 'premortem', 'outside_view'],
          description: '기본값 reframe.',
        },
        abstentions: { type: 'array', items: { type: 'string' }, description: '모르는 채로 비워 둔 것을 이름 붙여 남긴다.' },
      },
      required: ['caseId'],
    },
  },
  {
    name: 'argus_plan',
    title: '실행 계획',
    description:
      '**사용자가 채택한 결정에 대해서만** 준비·조사·실행 목록과 순서·기한을 만든다. dueDate가 붙은 앞의 세 단계가 곧 돌아보기 약속이 된다. 모르는 것은 지어내지 말고 openQuestions에 "확인 필요: …"로 남긴다. 채택 전에 부르면 서버가 거부한다.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        steps: { type: 'array', items: STEP_SCHEMA, description: '실행 순서. 비우면 형태 안내만 돌려준다.' },
        openQuestions: {
          type: 'array',
          items: { type: 'string' },
          description: '아직 모르는 것. 단계로 지어내는 대신 여기에 남긴다.',
        },
        horizonDays: { type: 'number', description: '계획 기간(일). 기본 21.' },
      },
      required: ['caseId'],
    },
  },
  {
    name: 'argus_adopt',
    title: '사용자 채택',
    description:
      '사용자가 명시적으로 "이대로 하겠다"고 말했을 때만 부른다. 이 호출만이 결정을 사용자의 것으로 기록한다. 모델의 판단이나 호스트의 승인으로 대신할 수 없다. stakes를 보내지 않으면 서버가 가장 엄격한 쪽(major / one_way)으로 닫고 그 사실을 응답에 밝힌다.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        choiceOrPolicy: { type: 'string', description: '사용자가 채택한 선택. 사용자가 고쳤으면 고친 문장으로.' },
        question: {
          type: 'string',
          description:
            '이 결정이 답하는 **질문**. 선택이 아니다 — 돌아볼 때 선택을 감춘 채 이 질문만 먼저 보여준다. 생략하면 결정을 연 원문을 쓴다.',
        },
        edited: { type: 'boolean', description: '사용자가 제안을 수정했는가.' },
        adoptedState: {
          type: 'string',
          enum: ['decide', 'test', 'research', 'defer', 'reframe', 'stop'],
          description: '무엇으로 채택했는가. 기본 decide.',
        },
        stakes: {
          type: 'object',
          properties: {
            weight: { type: 'string', enum: ['minor', 'significant', 'major'] },
            reversibility: { type: 'string', enum: ['reversible', 'costly', 'one_way'] },
          },
          description: '이 결정의 하중. 사용자의 말에서 판단하고, 모르면 보내지 말 것(지어내지 말 것).',
        },
        values: { type: 'array', items: { type: 'string' }, description: '사용자가 말한 가치 기준만.' },
        materialBeliefs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              belief: { type: 'string' },
              confidence: {
                type: 'string',
                enum: ['confident', 'uncertain', 'contested'],
                description:
                  '사용자가 이 믿음에 대해 실제로 표현한 확신 정도. **추측해서 채우지 말 것** — 이 등급은 정산 때 현실과 대조되어 사용자의 보정 기록이 된다. 사용자가 말하지 않았으면 그 믿음은 보내지 말 것.',
              },
            },
            required: ['belief', 'confidence'],
          },
          description: '이 선택을 떠받치는 사실 믿음. 틀리면 결정이 바뀌는 것만.',
        },
        rejectedAlternative: {
          type: 'object',
          properties: { alternative: { type: 'string' }, reason: { type: 'string' } },
          description: '사용자가 버린 대안과 그 이유.',
        },
        delegation: {
          type: 'object',
          description:
            '사용자가 **스스로** "앞으로 이런 조건에서는 늘 이렇게 하겠다"고 말했을 때만 보낸다. 다음 결정에서 이 정책이 자동으로 꺼내진다. 사용자가 말하지 않은 위임을 제안하거나 대신 만들지 말 것 — userWords 가 없으면 서버가 거부하고 그 사실을 응답에 밝힌다.',
          properties: {
            policy: { type: 'string', description: '사용자가 승인한 규칙 문장. 사용자의 말 그대로.' },
            scopeDomain: { type: 'string', description: '적용 영역 한 단어 (예: 채용, 가격, 일정).' },
            scopeCondition: { type: 'string', description: '어떤 조건에서 적용되는가. 사용자의 말로.' },
            userWords: { type: 'string', description: '사용자가 위임을 말한 **원문 인용**. 요약이 아니라 그대로.' },
            days: { type: 'number', description: `유효 기간(일). 기본 30, 최대 90 — 넘으면 서버가 자르고 밝힌다.` },
          },
          required: ['policy', 'scopeDomain', 'scopeCondition', 'userWords'],
        },
        appliedDelegationId: {
          type: 'string',
          description: '이 채택이 argus_open 응답에 나온 위임 정책을 따른 것이면 그 위임 id. 아니면 보내지 말 것.',
        },
      },
      required: ['caseId', 'choiceOrPolicy'],
    },
  },
  {
    name: 'argus_return',
    title: '돌아보기',
    description:
      '기한이 된 결정을 돌아본다. **순서가 규칙이다**: 먼저 실제로 무슨 일이 있었는지 듣고, 그다음 당시 왜 그렇게 정했는지 기억을 묻고, 그러고 나서야 그때의 기록을 연다. 기록을 먼저 보여주면 기억이 오염된다. 서버가 이 순서를 강제하므로 건너뛸 수 없다.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        observation: { type: 'string', description: '실제로 일어난 일. 해석 말고 사실.' },
        recall: { type: 'string', description: '당시 왜 그렇게 정했는지에 대한 사용자의 기억. 관찰을 받은 뒤에만.' },
        observedAt: { type: 'string', description: '그 일이 실제로 일어난 시각(ISO 8601). 지금이 아니면 반드시.' },
        relayed: { type: 'boolean', description: '사용자가 직접 본 것이 아니라 전해 들은 것인가.' },
      },
      required: ['caseId'],
    },
  },
  {
    name: 'argus_recall',
    title: '지난 결정 불러오기',
    description:
      '**비슷한 결정을 다시 만났을 때 먼저 부른다.** 지난번에 무엇을 골랐고, 정산 직전에 이유를 어떻게 기억했고, 현실이 실제로 무엇이라 답했는지를 돌려준다. 새로 조언하기 전에 이것부터 확인하십시오 — 일반적인 조언은 어디서나 얻을 수 있지만 이 사람의 지난 정산은 여기에만 있습니다. caseId를 주면 그 한 건을 자세히, 없으면 목록(정산된 것 먼저)을 돌려준다.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: '한 건을 자세히 볼 때. 그때의 선택·기억·실제가 나란히 나온다.' },
        query: { type: 'string', description: '결정 질문·선택·실제 결과에서 찾을 말. 비우면 최근 순 전체.' },
        limit: { type: 'number', description: '최대 건수 (1–20, 기본 10).' },
      },
    },
  },
];

// 의도적으로 만들지 않은 도구 — 지워지지 않도록 여기 남긴다.
export const DELIBERATELY_ABSENT = {
  argus_score: '사용자에 대한 점수·등급 조회. 영구 금지 (zero-judgment 규칙 2).',
  argus_host_approve: '호스트의 승인으로 채택. 호스트 승인은 사용자 행위가 아니다 (v1.0 §11.2).',
  argus_execute: '계획 자동 실행. 실행은 사람이 한다 — 이 제품의 전제.',
} as const;
