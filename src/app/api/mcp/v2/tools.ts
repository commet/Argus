// 도구 표면 — 여섯 개, 그 이상 만들지 않는다 (기획서 §4).
//
// 이 파일은 도구의 **선언**만 갖는다. 각 도구가 하는 일은 method-harness가
// 정하며, 여기서 방법 규칙을 다시 쓰지 않는다 (단일 정본).
//
// 없는 도구가 왜 없는지도 기록한다 — 나중에 "왜 채택 도구가 호스트 승인으로
// 안 되지?"를 다시 묻지 않도록.

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export const TOOLS: ToolDef[] = [
  {
    name: 'argus_open',
    title: '결정 열기',
    description:
      '사용자가 앞에 둔 결정을 연다. 사용자가 이미 말한 것에서 현재 기울기와 이유를 추출해 함께 기록한다(심문하지 않는다). 아직 조언하지 않는다. 결정이 열려 있지 않거나 평평한 상황이면 이 도구를 부르지 말 것.',
    inputSchema: {
      type: 'object',
      properties: {
        utterance: { type: 'string', description: '사용자가 결정을 말한 원문. 요약하지 말고 그대로.' },
        lean: { type: 'string', description: '사용자가 밝힌 현재 기울기. 말하지 않았으면 생략(지어내지 말 것).' },
        statedReasons: { type: 'array', items: { type: 'string' }, description: '사용자가 실제로 말한 이유만.' },
      },
      required: ['utterance'],
    },
  },
  {
    name: 'argus_sharpen',
    title: '한 가지만 점검',
    description:
      '이 결정에서 가장 하중이 큰 가정 하나와, 그 짚기가 틀렸음을 보여줄 관찰 가능한 사실을 돌려준다. 한 턴에 한 가지만. 평평한 결정에는 침묵한다.',
    inputSchema: {
      type: 'object',
      properties: { caseId: { type: 'string' } },
      required: ['caseId'],
    },
  },
  {
    name: 'argus_plan',
    title: '실행 계획',
    description:
      '**사용자가 채택한 결정에 대해서만** 준비·조사·실행 목록과 순서·기한을 만든다. 각 마일스톤이 곧 돌아보기 약속이 된다. 모르는 것은 지어내지 말고 "확인 필요"로 남긴다. 채택 전에는 부르지 말 것.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        horizonDays: { type: 'number', description: '계획 기간(일). 기본 21.' },
      },
      required: ['caseId'],
    },
  },
  {
    name: 'argus_adopt',
    title: '사용자 채택',
    description:
      '사용자가 명시적으로 "이대로 하겠다"고 말했을 때만 부른다. 이 호출만이 결정을 사용자의 것으로 기록한다. 모델의 판단이나 호스트의 승인으로 대신할 수 없다.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        choiceOrPolicy: { type: 'string', description: '사용자가 채택한 선택. 사용자가 고쳤으면 고친 문장으로.' },
        edited: { type: 'boolean', description: '사용자가 제안을 수정했는가.' },
      },
      required: ['caseId', 'choiceOrPolicy'],
    },
  },
  {
    name: 'argus_return',
    title: '돌아보기',
    description:
      '기한이 된 결정을 돌아본다. **순서가 규칙이다**: 먼저 실제로 무슨 일이 있었는지 듣고, 그다음 당시 왜 그렇게 정했는지 기억을 묻고, 그러고 나서야 그때의 기록을 연다. 기록을 먼저 보여주면 기억이 오염된다.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        observation: { type: 'string', description: '실제로 일어난 일. 해석 말고 사실.' },
        recall: { type: 'string', description: '당시 왜 그렇게 정했는지에 대한 사용자의 기억. 관찰을 받은 뒤에만.' },
      },
      required: ['caseId'],
    },
  },
  {
    name: 'argus_recall',
    title: '지난 결정 불러오기',
    description:
      '지난 결정·계획·정산 결과를 불러온다. 비슷한 결정을 다시 만났을 때 지난번에 무엇을 가정했고 실제로 어떻게 됐는지 확인하는 용도.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
    },
  },
];

// 의도적으로 만들지 않은 도구 — 지워지지 않도록 여기 남긴다.
export const DELIBERATELY_ABSENT = {
  argus_score: '사용자에 대한 점수·등급 조회. 영구 금지 (zero-judgment 규칙 2).',
  argus_host_approve: '호스트의 승인으로 채택. 호스트 승인은 사용자 행위가 아니다 (v1.0 §11.2).',
  argus_execute: '계획 자동 실행. 실행은 사람이 한다 — 이 제품의 전제.',
} as const;
