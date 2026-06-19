import { WorkerReportBlock } from 'argus';

// The capture freezes the clock, stalling framer-motion's JS entrance animations
// at their `initial` (opacity:0) frame, so each status block renders blank. framer
// writes the frozen start values as INLINE styles; `!important` beats inline, so we
// force the end-state on exactly the elements framer touched. (See AnalysisCard.)
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

// WorkerReportBlock (exported as WorkerCard) — one crew member's report inside the
// progressive flow's step-by-step review. Renders very differently per status:
// a quiet inline indicator while running/pending, an input surface while waiting
// on the user (self / human tasks), and the full report block with key finding +
// approve/exclude when done. These cells cover the load-bearing states.

const noop = () => {};
const noopId = (_id: string) => {};
const noopInput = (_id: string, _v: string) => {};

const analyst = {
  id: 'p-retention',
  name: '규민',
  nameEn: 'Ethan',
  role: '수치 분석가',
  roleEn: 'Numbers Analyst',
  emoji: '📊',
  expertise: '리텐션 코호트, 전환율, 단위경제',
  tone: '숫자 먼저, 해석은 한 줄',
  color: '#2563EB',
} as any;

const pricer = {
  id: 'p-pricing',
  name: '민서',
  nameEn: 'Stella',
  role: '가격 전략가',
  roleEn: 'Pricing Strategist',
  emoji: '💸',
  expertise: '가격 의향, 패키징, 결제 동선',
  tone: '측정 가능한 지표로 말한다',
  color: '#7C3AED',
} as any;

function base(overrides: any) {
  return {
    id: 'w1',
    step_index: 0,
    task: '활성화 코호트 리텐션 분석',
    who: 'ai',
    expected_output: '활성화 vs 비활성 4주 리텐션 비교',
    status: 'done',
    persona: analyst,
    level: 'senior',
    stream_text: '',
    result: null,
    human_input: null,
    error: null,
    approved: null,
    completion_note: null,
    started_at: '2026-06-18T09:00:00.000Z',
    completed_at: '2026-06-18T09:01:30.000Z',
    ...overrides,
  } as any;
}

// Done — the main report block. Key finding pulled up front, completion note in
// the persona's voice, and the approve / exclude actions (with a hit-rate bar
// since agent_id is set).
export const DoneReport = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <WorkerReportBlock
      worker={base({
        agent_id: 'agent-retention-01',
        task_type: 'analysis',
        completion_note:
          '규민: 모수보다 활성화가 레버리지라는 게 숫자로 확인됐어요.',
        validation_score: 86,
        result:
          '핵심 발견: 활성화 유저의 4주 리텐션은 비활성 유저의 3.4배(61% vs 18%)입니다.\n\n' +
          '코호트 12주치를 보면 첫 주에 코어 액션 3회를 끝낸 유저만 유의미하게 남습니다. ' +
          '무료 유저 4,200명 중 활성화 비율은 18%에 그치고, 나머지 82%는 사실상 유료 전환 모수에서 빠집니다. ' +
          '따라서 모수를 키우는 캠페인보다 활성화율을 끌어올리는 온보딩 개선이 전환에 직접적입니다.',
      })}
      onApprove={noopId}
      onReject={noopId}
      onAdvance={noop}
    />
  </div>
);

// Waiting on the user — a SELF decision task. Shows the AI/me scope split, the
// AI key point, decision chips parsed from `decision`, and the input box.
export const WaitingSelfDecision = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <WorkerReportBlock
      worker={base({
        id: 'w2',
        task: '가격 모델 결정',
        agent_type: 'self',
        who: 'both',
        status: 'waiting_input',
        persona: pricer,
        ai_scope: '세 모델의 의향 데이터와 경쟁사 벤치마크 정리',
        self_scope: '우리 브랜드와 맞는 모델을 최종 판단',
        decision: '어떤 가격 모델로 갈까? 구독제 vs 사용량 기반 vs 하이브리드',
        ai_preliminary:
          'AI 핵심 정리: 코어 유저 인터뷰 8건에서 예측 가능한 월 비용을 선호했습니다.\n\n' +
          '구독제는 의향이 가장 안정적이지만 헤비 유저의 이탈 위험이 있고, ' +
          '사용량 기반은 상한이 없다는 불안이 컸습니다. 하이브리드(기본 구독 + 초과분 종량)는 ' +
          '두 우려를 모두 눌렀지만 결제 화면 복잡도가 올라갑니다.',
      })}
      onSubmitInput={noopInput}
      isFirstWaiting
      onAdvance={noop}
    />
  </div>
);

// Waiting on an external human — shows the 👤 marker, the question to send, and
// the "skip this person" escape.
export const WaitingHuman = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <WorkerReportBlock
      worker={base({
        id: 'w3',
        task: 'CFO 예산 확인',
        agent_type: 'human',
        who: 'human',
        status: 'waiting_input',
        persona: null,
        contact: { name: '재무팀 김이사', channel: 'email', address: 'cfo@company.com' },
        question_to_human:
          '시리즈 A 클로징 전, 시니어 1명 채용 예산을 이번 분기에 집행해도 될까요? 가능 시점도 알려주세요.',
      })}
      onSubmitInput={noopInput}
    />
  </div>
);

// Running — the quiet inline streaming indicator with a pulsing avatar.
export const Running = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <WorkerReportBlock worker={base({ status: 'running', completed_at: null })} />
  </div>
);

// Validation failed — quality gate caught a weak result; offers regenerate /
// use-anyway without dead-ending the user.
export const ValidationFailed = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <WorkerReportBlock
      worker={base({
        id: 'w4',
        status: 'validation_failed',
        validation_feedback:
          '리텐션 수치의 출처 코호트가 명시되지 않아 결론을 검증하기 어려워요. 측정 기간과 표본 크기를 추가하면 통과할 수 있어요.',
        result: '활성화 유저가 더 오래 남습니다.',
      })}
      onRetry={noopId}
    />
  </div>
);
