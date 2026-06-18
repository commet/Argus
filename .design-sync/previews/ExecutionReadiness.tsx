import { ExecutionReadiness } from 'argus';

// ExecutionReadiness — a 5-check "is this decision ready to run?" scorecard. It
// reads reframe / recast / persona-feedback / judgment data from Zustand stores
// by projectId; those stores hydrate from localStorage on mount, so we seed two
// realistic voyages at module scope (BEFORE the stores' loadItems runs in their
// mount effect). Two cells show the two ends of the visual vocabulary: a near-ready
// voyage (greens + one amber, 88%) and an early one (partials + missing + the
// "→ next action" hints, 16%). Without seeding, every check is "missing" and the
// component renders null by design.

const READY = 'proj-cs-ai';
const EARLY = 'proj-pricing';
const T0 = '2026-06-10T02:00:00.000Z';
const T1 = '2026-06-15T08:00:00.000Z';

if (typeof window !== 'undefined') {
  try {
    const ls = window.localStorage;
    ls.setItem('sot_settings', JSON.stringify({ language: 'ko' }));

    // ── Reframe (항로 재설정) ──
    ls.setItem('sot_reframe_list', JSON.stringify([
      {
        id: 'rf-ready',
        project_id: READY,
        input_text: '대표님이 신사업 AI 고객 상담 기획안을 2주 안에 만들어오라고 하셨다.',
        analysis: {
          surface_task: '신사업 기획안을 2주 안에 작성한다.',
          reframed_question: '5명 중 2명을 빼서, 경쟁사가 못 하는 걸 4주 안에 만들 수 있는가?',
          why_reframing_matters: '"완벽한 보고서"가 아니라 "빨리 결정하게 해주는 한 장"이 진짜 과제다.',
          reasoning_narrative: '대표가 지금 이걸 시킨 이유 → 경쟁사 약점 → 결재 한 줄 순으로 좁혔다.',
          hidden_assumptions: [
            { assumption: '2주는 분량이 아니라 결정 속도를 의미한다.', risk_if_false: '50장을 써도 대표는 안 읽는다.', evaluation: 'likely_true' },
            { assumption: '이커머스 셀러가 월 29만 원을 낼 의향이 있다.', risk_if_false: '수익 모델 전체가 무너진다.', evaluation: 'uncertain' },
            { assumption: '2명을 빼도 3명으로 유지보수가 굴러간다.', risk_if_false: '기존 제품 장애 시 신사업이 멈춘다.', evaluation: 'uncertain' },
          ],
          hidden_questions: [],
          ai_limitations: ['실제 셀러 구매 의향은 인터뷰로만 검증 가능.'],
        },
        selected_question: '5명 중 2명을 빼서, 경쟁사가 못 하는 걸 4주 안에 만들 수 있는가?',
        status: 'done',
        created_at: T0,
        updated_at: T1,
      },
      {
        id: 'rf-early',
        project_id: EARLY,
        input_text: '구독 가격을 월 29만 원으로 갈지, 39만 원으로 갈지 정해야 한다.',
        analysis: {
          surface_task: '신규 구독 상품의 월 가격을 확정한다.',
          reframed_question: '우리가 파는 게 "가격"인가 "전환 비용 절감"인가?',
          why_reframing_matters: '가격표가 아니라 셀러가 느끼는 가치 기준으로 봐야 한다.',
          reasoning_narrative: '가격 민감도보다 대안 대비 절감액이 결정 변수일 수 있다.',
          hidden_assumptions: [
            { assumption: '셀러는 가격에 가장 민감하다.', risk_if_false: '엉뚱한 축으로 경쟁하게 된다.', evaluation: 'doubtful' },
          ],
          hidden_questions: [],
          ai_limitations: [],
        },
        selected_question: '',
        status: 'review',
        created_at: T1,
        updated_at: T1,
      },
    ]));

    // ── Recast (선원 배치 | 실행 설계) — only the ready voyage has one ──
    const step = (task: string, actor: string, output: string, checkpoint = false, reason = '') => ({
      task, actor, actor_reasoning: '', expected_output: output,
      checkpoint, checkpoint_reason: reason, estimated_time: '0.5d',
    });
    ls.setItem('sot_recast_list', JSON.stringify([
      {
        id: 'rc-ready',
        project_id: READY,
        input_text: '4주 MVP를 어떻게 사람/AI로 나눠 실행할까.',
        analysis: {
          governing_idea: '경쟁사가 못 하는 한 가지를 4주 뒤에 작동하는 베타로 증명한다.',
          storyline: {
            situation: '경쟁사가 대기업 대상 AI 상담을 먼저 출시했다.',
            complication: '이커머스 셀러는 세팅 2주·월 80만 원이 부담이라 비어 있다.',
            resolution: '사전학습으로 1일 세팅 + 월 29만 원으로 그 자리를 연다.',
          },
          goal_summary: '4주 안에 셀러 1명 앞에서 작동하는 베타를 시연한다.',
          steps: [],
          key_assumptions: [
            { assumption: '사전학습 모델이 이커머스 용어를 1일 안에 적용 가능하다.', importance: 'high', certainty: 'medium', if_wrong: '세팅 1일이라는 핵심 차별점이 무너진다.' },
            { assumption: '2명 전담으로 4주 안에 MVP가 가능하다.', importance: 'high', certainty: 'medium', if_wrong: '시연 일정 자체가 밀린다.' },
          ],
          critical_path: [0, 1, 4],
          total_estimated_time: '4주',
          ai_ratio: 55,
          human_ratio: 45,
          design_rationale: '판단이 필요한 지점만 사람이 잡고, 반복 생성은 AI에 맡겼다.',
        },
        steps: [
          step('이커머스 용어 50개로 사전학습 PoC', 'ai', '작동 영상 1개', true, '1일 세팅 가정의 첫 검증 지점'),
          step('자동 답변 API + 업종 템플릿', 'ai→human', 'API 테스트 결과'),
          step('간단 대시보드', 'ai', '시연 영상'),
          step('셀러 1명 베타 시연 설계', 'human', '시연 시나리오', true, '고객이 "쓸래요"가 Go/No-Go'),
          step('대표님 1장 보고 + Go/No-Go 결정', 'human', '결재 한 장', true, '계속/중단 판단'),
        ],
        status: 'done',
        created_at: T0,
        updated_at: T1,
      },
    ]));

    // ── Personas + persona feedback (리허설) — only the ready voyage ──
    ls.setItem('sot_personas', JSON.stringify([
      { id: 'p-ceo', name: '김 대표', role: 'CEO', organization: '본사', priorities: '속도와 결정', communication_style: '직설', known_concerns: '실행 가능성', relationship_notes: '', influence: 'high', extracted_traits: [], feedback_logs: [], created_at: T0, updated_at: T0 },
      { id: 'p-exec', name: '박 이사', role: '사업 총괄 이사', organization: '본사', priorities: '숫자 근거', communication_style: '분석적', known_concerns: '매몰 비용', relationship_notes: '', influence: 'high', extracted_traits: [], feedback_logs: [], created_at: T0, updated_at: T0 },
    ]));
    ls.setItem('sot_feedback_history', JSON.stringify([
      {
        id: 'fb-ready',
        project_id: READY,
        document_title: 'AI 고객 상담 — 이커머스 셀러 진입 기획안',
        document_text: '...',
        persona_ids: ['p-ceo', 'p-exec'],
        feedback_perspective: '경영진',
        feedback_intensity: '보통',
        results: [
          {
            persona_id: 'p-ceo',
            overall_reaction: '경쟁사를 직접 써보고 약점 짚은 건 좋아. 근데 세팅 1일을 진짜 지킬 수 있어?',
            failure_scenario: '사전학습이 1일 안에 안 되면 핵심 차별점이 무너진다.',
            untested_assumptions: ['사전학습 1일 세팅'],
            classified_risks: [
              { text: '세팅 1일이 안 되면 다른 게 다 무너진다.', category: 'manageable' },
              { text: '손익분기 25곳을 어디서 데려올지 빠져 있다.', category: 'unspoken' },
            ],
            first_questions: ['첫 25곳은 어디서 데려올 거야?'],
            praise: ['경쟁사를 직접 써본 한 줄.'],
            concerns: ['확보 경로가 비어 있다.'],
            wants_more: ['CS 문의 유형별 비율'],
            approval_conditions: ['첫 25곳 확보 경로가 구체화되면 임원 회의에 올린다.'],
          },
          {
            persona_id: 'p-exec',
            overall_reaction: '구조는 괜찮은데, CFO가 첫 번째로 물을 숫자가 부족해.',
            failure_scenario: '고객당 확보 비용 근거가 없으면 회의에서 막힌다.',
            untested_assumptions: ['마케팅 300만 원으로 25곳 확보'],
            classified_risks: [
              { text: '고객당 확보 비용 12만 원 근거가 부족하다.', category: 'manageable' },
              { text: '기존 사업과의 시너지가 안 보인다.', category: 'unspoken' },
            ],
            first_questions: ['6개월 뒤 실패하면 매몰 비용이 얼마야?'],
            praise: ['1/3 가격 포지셔닝은 명확하다.'],
            concerns: ['시너지 설명 부재'],
            wants_more: ['채널별 전환율'],
            approval_conditions: ['상세 비용 테이블이 보강되면 안건으로 올린다.'],
          },
        ],
        synthesis: '방향은 강하다. 첫 고객 확보 경로와 CS 효과 수치를 채우면 임원 회의로 갈 수 있다.',
        created_at: T1,
      },
    ]));

    ls.setItem('sot_judgments', JSON.stringify([
      { id: 'j1', type: 'hidden_question_selection', context: '재정의 질문 선택', decision: '4주 안에 만들 수 있는가', original_ai_suggestion: '경쟁사를 어떻게 이길까', user_changed: true, project_id: READY, tool: 'reframe', created_at: T1 },
    ]));
  } catch {}
}

export const ReadyToReview = () => <ExecutionReadiness projectId={READY} />;
export const EarlyVoyage = () => <ExecutionReadiness projectId={EARLY} />;
