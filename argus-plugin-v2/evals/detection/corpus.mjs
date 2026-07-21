/**
 * 감지 품질 측정용 라벨 코퍼스 (2026-07-20 — "개선보다 측정이 먼저").
 *
 * 각 케이스 = 한 턴: 직전 어시스턴트 발화(있으면) + 사용자 메시지. 훅과 동일한
 * 창(window = assistant + "\n" + user)으로 측정한다.
 *
 * labels 의미 (사람이 붙인 정답 — 의미 기준, 패턴 기준 아님):
 *   prediction         참/거짓으로 판명될 미래 상태를 함의한다
 *   outcome            열린 예측(open)에 현실이 답한 사실이 드러난다
 *   assumption         발화에 명시된(marked) 하중 전제가 있다
 *   hidden_assumption  결정이 딛고 선 전제가 있으나 발화에 표지가 없다 —
 *                      추출은 생성적 작업이라 규칙로는 원리적으로 불가
 *   (빈 배열)          잡담/명령/질문 — 감지 대상 없음
 *
 * 이 코퍼스가 고정하는 CI 불변식 (measure.test.mjs):
 *   사전필터(prefilterTurn)는 라벨된 양성을 절대 스킵하지 않는다 (recall 1.0).
 *   음성의 오통과는 허용된다 — 그 비용은 지시 주입 토큰이지 사용자 방해가
 *   아니다 (발화 절제는 주입되는 지시문의 min-fire 규칙이 진다).
 *
 * 규칙 감지기(detectSignals)의 수치는 참고로만 출력한다 — 규칙이 왜 감지기가
 * 아니라 사전필터+최저선으로 강등됐는지를 숫자로 문서화하는 용도다.
 * LLM 감지 품질 평가는 같은 코퍼스로 나중에 잇는다 (evals/README.md의 live
 * 레이어와 같은 방식 — 정답 라벨은 이미 여기 있다).
 */

export const CORPUS = [
  // ── PREDICTION — 규칙도 잡는 쉬운 면 ────────────────────────────────────
  { id: 'pred-ko-measurable', user: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.', labels: ['prediction'] },
  { id: 'pred-en-measurable', user: 'We will cut churn below 3% by Q3.', labels: ['prediction'] },
  { id: 'pred-en-completion', user: 'We are going to ship to TestFlight by Friday.', labels: ['prediction'] },
  { id: 'pred-ko-completion', user: '이번 채용으로 배포가 주 1회로 빨라질 거예요.', labels: ['prediction'] },

  // ── PREDICTION — 표지가 약해 규칙이 놓치는 면 (판정 가능성은 의미 판단) ──
  { id: 'pred-ko-vague-horizon', user: '이 방향이면 나중에 무리가 올 것 같긴 한데, 일단 갑니다.', labels: ['prediction'], note: '숫자·완료동사 없음 — 규칙 미스, 의미상 판정 가능' },
  { id: 'pred-en-contraction', user: "We'll probably be fine on capacity when it goes live.", labels: ['prediction'], note: "'ll/probably — FUTURE 그룹 밖" },
  { id: 'pred-ko-yearend', user: '이대로면 연말쯤 리텐션이 심각해질 거예요.', labels: ['prediction'] },
  { id: 'pred-ko-mixed-done', user: 'Redis로 가기로 했어. 마이그레이션은 이번 주 안에 끝날 거야.', labels: ['prediction'], note: '결정 종결 + 예측 혼합 턴' },

  // ── PREDICTION — 어시스턴트 발화에서 나온 예측 (창이 없으면 원리적 미스) ─
  {
    id: 'pred-assistant-latency',
    assistant: '이 인덱스를 추가하면 p95 레이턴시가 절반 아래로 내려갈 겁니다.',
    user: '좋아, 그렇게 가자.',
    labels: ['prediction'],
    note: '예측은 어시스턴트가 말했고 사용자는 채택만 — 사용자-단독 스캔은 못 잡는다',
  },

  // ── OUTCOME — 명시 참조 (규칙의 토큰 겹침이 잡는 면) ─────────────────────
  { id: 'out-ko-explicit', user: '서버 이전은 결국 무중단으로 끝났어요.', open: ['서버 이전 후에도 다운타임은 없다'], labels: ['outcome'] },
  { id: 'out-en-explicit', user: 'Turns out the hire really did get us to weekly deploys.', open: ['this hire gets us to weekly deploys'], labels: ['outcome'] },

  // ── OUTCOME — 대명사/암시 참조 (토큰 대조 원리적 불가 — AI의 몫) ─────────
  { id: 'out-ko-pronoun', user: '아 그거 결국 잘 됐어요.', open: ['서버 이전 후에도 다운타임은 없다'], labels: ['outcome'], note: '"그거"=서버 이전 — 맥락 해석 필요' },
  { id: 'out-en-pronoun', user: 'yeah that ended up working out fine.', open: ['this hire gets us to weekly deploys'], labels: ['outcome'] },
  { id: 'out-ko-failed', user: '그 계약 결국 무산됐어요.', open: ['6월 안에 물류 계약 체결'], labels: ['outcome'], note: '부정 결과 — 겹침 토큰 1개뿐' },

  // ── ASSUMPTION — 표시된 전제 (쉬운 10%) ─────────────────────────────────
  { id: 'asm-en-marked', user: 'This only works as long as the vendor API stays under 200ms.', labels: ['assumption'] },
  { id: 'asm-ko-marked', user: '배포를 주 1회로 늘리는 건 새 채용이 6월까지 온보딩된다는 전제로 가능해요.', labels: ['assumption'] },
  {
    id: 'asm-assistant-marked',
    assistant: 'Postgres로 가면 됩니다 — 트래픽이 지금 수준을 유지하는 한 단일 인스턴스로 충분해요.',
    user: 'ㅇㅋ 그걸로 진행하자.',
    labels: ['assumption'],
    note: '전제를 어시스턴트가 말했다 — 창이 없으면 미스',
  },

  // ── HIDDEN ASSUMPTION — 표지 없음: 규칙로는 원리적으로 추출 불가 (핵심 90%) ─
  // 각 케이스에 기계-대조용 정답 3종을 심는다 (Stage 2, 2026-07-21):
  //   gold        — 이 결정이 딛고 선 '특정' 하중 전제 (판정기가 대조할 기준 정답).
  //   gold_para   — gold의 충실한 패러프레이즈 (판정기 recall 프로브: match여야 함).
  //   counter     — 같은 주제지만 하중 전제가 '아닌' 그럴듯한 오답. 대개 발화에 이미
  //                 적힌 이유를 되풀이하거나(전제 아님) 일반적 참을 말한다. 판정기가
  //                 이걸 기각 못 하면(match) hidden_extraction 지표는 theater —
  //                 validate-judge.mjs가 이 기각 실패를 CI 빨간불로 잡는다.
  {
    id: 'hid-ko-freetier', user: '무료 플랜 없애자. 결제 전환이 낮은 건 무료가 너무 넉넉해서예요.',
    labels: ['hidden_assumption'],
    note: '숨은 전제: 무료 사용자가 조이면 유료로 전환한다 / 무료가 신규 유입 동력이 아니다',
    gold: '무료 사용자를 압박하면 유료로 전환한다 — 즉 무료 티어가 신규 유입·바이럴의 동력이 아니라는 전제',
    gold_para: '무료를 없애도 신규 유입은 안 줄고, 조여진 무료 사용자들이 돈을 내기 시작할 것이다',
    counter: '무료 플랜은 서버·지원 비용을 발생시킨다',
  },
  {
    id: 'hid-en-freetier', user: "Let's drop the free tier — conversion is low because free is too generous.",
    labels: ['hidden_assumption'],
    gold: 'squeezing free users converts them to paid — i.e. the free tier is not what drives signups / top-of-funnel',
    gold_para: 'killing free will not shrink new signups, and the squeezed free users will start paying',
    counter: 'the free tier is expensive to operate',
  },
  {
    id: 'hid-ko-pricing', user: '가격 두 배로 올리자 — 경쟁사보다 아직 싸니까.',
    labels: ['hidden_assumption'],
    note: '숨은 전제: 구매 결정 변수가 가격이다 / 비교 대상이 그 경쟁사다',
    gold: '구매 결정을 좌우하는 변수가 가격이고, 고객이 우리를 하필 그 경쟁사와 비교한다는 전제',
    gold_para: '고객은 가격으로 산다 — 그리고 그 경쟁사가 고객의 실제 비교 기준이다',
    counter: '가격을 올리면 건당 매출이 오른다',
  },
  {
    id: 'hid-ko-defer', user: '결제 연동은 다음 스프린트로 미루자.',
    labels: ['hidden_assumption'],
    note: '숨은 전제: 지금 결제가 없어도 잃는 사용자가 없다',
    gold: '지금 결제 연동이 없어도 이탈하는 사용자가 없다 — 미루는 동안 잃는 게 없다는 전제',
    gold_para: '결제를 늦춰도 그 사이 떠나는 고객은 없다',
    counter: '다음 스프린트에 결제 연동을 할 여력(엔지니어링 시간)이 있다',
  },
  {
    id: 'hid-en-pivot', user: 'We should pivot to B2B — enterprise deals close themselves once you have SSO.',
    labels: ['hidden_assumption'],
    gold: 'enterprise deals close on their own once SSO exists — i.e. SSO is the binding constraint and little sales motion is needed',
    gold_para: 'having SSO is what unblocks enterprise deals, and they will largely close without a sales team',
    counter: 'enterprise customers pay more than B2C customers',
  },
  {
    id: 'hid-en-hiring', user: "Let's hire two more sales reps — pipeline is thin because we don't have enough hands.",
    labels: ['assumption', 'hidden_assumption'],
    note: '표시된 전제(손이 모자라다) 뒤에 숨은 전제(병목이 인력이다)',
    gold: 'the pipeline bottleneck is headcount (more reps → more pipeline), not lead quality, targeting, or the product',
    gold_para: 'adding sales headcount is what grows pipeline — the constraint is hands, not lead quality or fit',
    counter: 'the sales team is currently understaffed',
  },

  // ── 음성 — 사전필터가 스킵해야 비용이 절약되는 면 (스킵 기대) ────────────
  { id: 'neg-weather', user: '오늘 날씨 어때?', labels: [], expectSkip: true },
  { id: 'neg-explain', user: '이 함수가 뭐 하는 건지 설명해줘.', labels: [], expectSkip: true },
  { id: 'neg-refactor', user: '리팩토링 해줘', labels: [], expectSkip: true },
  { id: 'neg-run-tests', user: 'run the tests and show me the output', labels: [], expectSkip: true },
  { id: 'neg-thanks-en', user: 'thanks, looks good!', labels: [], expectSkip: true },
  { id: 'neg-thanks-ko', user: '고마워요 딱 원하던 거네요.', labels: [], expectSkip: true },

  // ── 음성 — 오통과가 허용되는 면 (주입 1회 비용, 사용자 무접촉) ───────────
  { id: 'neg-meeting-digit', user: '회의 3시로 옮겨줘, 캘린더도 같이.', labels: [], note: '숫자 단서로 오통과 허용 — AI가 flat 판정 후 침묵' },
  { id: 'neg-because-tired', user: 'I skipped lunch because I was tired, anyway where were we.', labels: [], note: 'because 오통과 허용' },
];
