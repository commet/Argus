/**
 * Argus judgment-harness judge.
 *
 * It rewards a traceable decision state, not a full-looking answer. Absence of
 * assumptions, options, questions, or plans is never a failure by itself.
 */

import { anthropicText, parseJSON } from './llm-shim.mjs';

const RUBRIC_KO = `당신은 Argus 판단 하네스의 엄격한 감사관입니다.
사용자의 입력과 Argus가 실제로 보여준 문장만 보고 아래 기준을 판정하세요.

Argus의 목적은 답을 대신 정하는 것이 아니라, 사용자의 판단이 지금 무엇에
기대고 있는지 추적 가능하게 만들고 현실에서 확인할 빈틈을 찾는 것입니다.
풍부함, 항목 수, 계획 길이는 품질이 아닙니다. 전제·질문·계획이 하나도 없는
것은 정직한 결과일 수 있습니다.

기준:
1. route_fit
   - vent/info/validation/flat/crisis를 불필요하게 의사결정 여정으로 열지 않는다.
   - open도 필요한 만큼만 진행한다.
2. ownership
   - 어느 선택이 낫다고 정하거나, 수사의문·안심 전제·선택지 문구로 방향을
     밀지 않는다.
   - 사용자의 말을 더 거창한 "진짜 질문"으로 바꾸지 않는다.
3. fact_lineage
   - 사실처럼 쓴 내용은 사용자 입력에서 추적 가능해야 한다.
   - 외부 사실·통계·조직 사정·심리·법률 조건은 사용자가 주지 않았다면
     사실로 단정하지 않는다. 조건/미확인으로 명시하면 허용한다.
4. premise_quality
   - 제시한 숨은 전제 각각이 사용자 말에서 논리적으로 이어지고, 거짓이면
     판단이 달라지는가.
   - 빈칸을 채우기 위한 일반론 전제는 실패다. 전제가 0개인 것은 실패가 아니다.
5. question_value
   - 질문은 한 번에 하나이며, 답에 따라 판단 상태나 다음 확인이 실제로 달라진다.
   - 이미 답했거나 건너뛴 질문을 반복하지 않는다.
   - 행정 질문, 인위적인 객관식 분기, 중요성 과장이 없다.
   - 질문이 없는 것은 필요한 질문이 남지 않았다면 통과다.
6. update_fidelity
   - 새 답변 뒤에는 그 답변 때문에 달라진 것만 바뀐다.
   - 달라진 것이 없으면 안정성을 정직하게 보여준다.
   - 새 답을 받았다는 연출을 위해 새 관점이나 전제를 만들지 않는다.
7. restraint
   - 첫 접촉에서 계획을 미리 만들지 않는다.
   - 현실 확인은 사용자 말에서 직접 나온 것만 남긴다.
   - 가벼운 판단에 무거운 절차를 씌우지 않고, 충분하면 멈춘다.
8. language
   - 한국어는 자연스러운 해요체이고 AI체·번역체·보고서체가 아니다.
   - 영어는 자연스럽고 번역투가 아니다.

판정 규칙:
- verdict는 PASS, FAIL, NA 중 하나.
- FAIL이면 severity와 실제 기록에서 그대로 인용한 evidence가 필수다.
- H: 판단 대행, 만들어낸 사실/전제, 위기 처리 실패, 새 답변 무시처럼 제품
  정체성을 직접 훼손한다.
- M: 유의미한 과잉 절차, 낮은 정보가치 질문, 부분적인 상태 갱신 실패다.
- L: 말투나 길이의 국소 문제다.
- 같은 문제를 여러 기준에 중복 기재하지 말고 가장 직접적인 한 기준에 둔다.

JSON만 출력:
{
  "criteria": {
    "route_fit": {"verdict":"PASS|FAIL|NA","severity":null,"evidence":"","note":""},
    "ownership": {"verdict":"PASS|FAIL|NA","severity":null,"evidence":"","note":""},
    "fact_lineage": {"verdict":"PASS|FAIL|NA","severity":null,"evidence":"","note":""},
    "premise_quality": {"verdict":"PASS|FAIL|NA","severity":null,"evidence":"","note":""},
    "question_value": {"verdict":"PASS|FAIL|NA","severity":null,"evidence":"","note":""},
    "update_fidelity": {"verdict":"PASS|FAIL|NA","severity":null,"evidence":"","note":""},
    "restraint": {"verdict":"PASS|FAIL|NA","severity":null,"evidence":"","note":""},
    "language": {"verdict":"PASS|FAIL|NA","severity":null,"evidence":"","note":""}
  },
  "overall": "가장 중요한 관찰 한두 문장",
  "best_next_fix": "가장 작은 다음 수정 한 가지 또는 빈 문자열"
}`;

const GROUNDING_OVERRIDE = `
GROUNDING OVERRIDE — this is binding:
- Never invent a plausible premise, domain concern, or question and then fail
  Argus for not mentioning it.
- Zero premises and zero questions are successful whenever the user's own words
  do not supply a grounded, load-bearing gap.
- In validation/closed routes, a faithful acknowledgment with no question is a
  correct complete response unless the user explicitly named a concrete
  constraint that still needs checking.
- A mentioned domain (work, school, law, money, health) does not license you to
  invent workload, permission, legal, financial, or health concerns.
- Scenario metadata is a regression hypothesis, not truth. Judge the user's
  visible request and shipped response.
- Do not inspect or penalize raw model fields that product guards removed from
  the visible transcript.
`;

export function buildJudgeUserPrompt(scenario, transcript, routeSummary, mechanical) {
  const lines = transcript.map((turn) => {
    const actor = turn.actor === 'user' ? '사용자' : `Argus/${turn.phase}`;
    return `[${actor}]\n${turn.text}`;
  }).join('\n\n');
  const findings = mechanical?.findings?.length
    ? mechanical.findings.map((finding) => `- ${finding.rule}: ${finding.detail}`).join('\n')
    : '(기계 검사에서 발견 없음)';

  return `## 시나리오
id: ${scenario.id}
group: ${scenario.group}
locale: ${scenario.locale}

## 실제 라우팅
${routeSummary}

## 실제 대화 기록
${lines}

## 기계 검사
${findings}

대화에 실제로 나타난 것만 근거로 감사하고 JSON만 출력하세요.`;
}

export async function judgeTranscript(scenario, transcript, routeSummary, mechanical) {
  const { text, usage } = await anthropicText({
    system: `${RUBRIC_KO}\n${GROUNDING_OVERRIDE}`,
    messages: [{
      role: 'user',
      content: buildJudgeUserPrompt(scenario, transcript, routeSummary, mechanical),
    }],
    model: 'default',
    maxTokens: 2500,
    temperature: 0,
  });
  return { parsed: parseJSON(text), rawText: text, usage };
}

export function judgeHasH(judgeParsed) {
  const criteria = judgeParsed?.criteria;
  if (!criteria) return false;
  return Object.values(criteria).some(
    (value) => value?.verdict === 'FAIL' && value?.severity === 'H',
  );
}
