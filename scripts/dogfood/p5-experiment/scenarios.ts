/**
 * P5 reconstruction-delta experiment — scenario definitions with ground truth.
 *
 * COHORT LABEL (constitutional honesty): these cycles are AGENT-DRIVEN dogfood.
 * A model agent plays the deciding user; every command really flows through the
 * production builders/gateway (DKK arm) or a plain journal template (baseline
 * arm), and reconstruction is scored blind. This is NOT a human-user cohort;
 * the ADR recording the gate outcome must carry this label and scope any claim
 * accordingly (v6 §11.3 separates synthetic/real; this cohort is a third,
 * explicitly named kind).
 *
 * Each scenario provides:
 *  - a realistic AI-assisted decision conversation (the transcript both arms
 *    consume), deliberately containing the messy-reality traps from the P1
 *    corpus: AI drafts partially adopted, hindsight information arriving after
 *    the seal, authorship ambiguity, defer before close, moot/indeterminate
 *    endings;
 *  - machine-checkable ground truth for the reconstruction questionnaire.
 *
 * The traps are the measurement: a recording system earns its keep only if the
 * blind reconstructor, reading its record months later, does NOT fall into
 * them.
 */

export interface P5GroundTruth {
  /** Verbatim sealed statement (the user's own words at seal time). */
  sealed_statement: string;
  /** Who originated the sealed statement text: 'human' | 'ai_draft_adopted' | 'ai_draft_reworded'. */
  statement_origin: 'human' | 'ai_draft_adopted' | 'ai_draft_reworded';
  /** Premises the user explicitly adopted at seal time (verbatim-ish keys). */
  adopted_premises: readonly string[];
  /** Claims present in the conversation the user did NOT adopt (AI suggestions left on the table). */
  unadopted_claims: readonly string[];
  /** Subset of adopted_premises whose TEXT was first proposed by the AI (provenance for the ledger). */
  ai_premises?: readonly string[];
  /** Facts that arrived AFTER the seal — a faithful reconstruction of "known at seal time" must exclude these. */
  post_seal_facts: readonly string[];
  /** The return contract. */
  review_question: string;
  review_at: string;
  resolution_criterion?: string;
  /** Was the return deferred before closing? */
  deferred: boolean;
  deferred_to?: string;
  /** Terminal resolution. */
  resolution_kind: 'answered' | 'indeterminate' | 'moot';
  answer_summary?: string;
  criterion_result?: 'met' | 'not_met' | 'partial' | 'not_applicable';
  /** Observations cited as evidence at resolution time. */
  evidence_observations: readonly string[];
  /** Did a separate human close follow the resolution? (always true in these cycles) */
  closed: true;
}

export interface P5Scenario {
  id: string;
  title: string;
  /** Conversation between USER and AI, in order. Includes post-seal turns. */
  transcript: ReadonlyArray<{ role: 'user' | 'ai'; at: string; text: string }>;
  /** Index into transcript: the seal happens right after this turn. */
  seal_after_turn: number;
  truth: P5GroundTruth;
}

export const P5_SCENARIOS: readonly P5Scenario[] = [
  {
    id: 'S01-pricing',
    title: '가격 유지 판단 (기준 스레드 — v6 §14 실례의 변주)',
    transcript: [
      { role: 'user', at: '2026-05-04T09:12:00+09:00', text: '전환율이 아직 약해서 9월 전에는 가격을 유지하는 편이 낫겠어. 신규 전환율이 3% 아래라는 게 내 판단의 바탕이야.' },
      { role: 'ai', at: '2026-05-04T09:12:20+09:00', text: '구조화 제안: 판단 "2026-09-01까지 기존 가격을 유지한다", 전제 "신규 전환율이 3% 아래다", 검토 질문 "9월 1일에 신규 전환율이 3.2% 이상 2주 연속 유지됐는가". 추가로 "경쟁사 B가 가격을 내리지 않는다"도 전제로 넣을까요?' },
      { role: 'user', at: '2026-05-04T09:13:05+09:00', text: '판단으로 남겨. 문구는 그대로 좋아. 경쟁사 B 전제는 넣지 마 — 그건 내 판단의 근거가 아니야. 9월 1일에 보자. 기준은 완결된 주간 코호트 두 개가 각각 3.2% 이상.' },
      { role: 'ai', at: '2026-08-26T10:00:00+09:00', text: '참고: 8월 셋째 주 신규 전환율이 3.4%로 집계됐어요 (analytics 대시보드). 아직 한 주뿐이라 기준에는 못 답해요.' },
      { role: 'user', at: '2026-09-01T09:00:00+09:00', text: '완결된 두 번째 주가 아직 없어. 9월 15일에 다시 보자.' },
      { role: 'user', at: '2026-09-15T09:30:00+09:00', text: '8월 마지막 주 3.3%, 9월 첫째 주 3.4%. 두 주 모두 3.2%를 넘었어. 조건 충족으로 닫아줘.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: '2026-09-01까지 기존 가격을 유지한다',
      statement_origin: 'ai_draft_adopted',
      adopted_premises: ['신규 전환율이 3% 아래다'],
      unadopted_claims: ['경쟁사 B가 가격을 내리지 않는다'],
      post_seal_facts: ['8월 셋째 주 신규 전환율 3.4%', '8월 마지막 주 3.3%', '9월 첫째 주 3.4%'],
      review_question: '신규 전환율이 3.2% 이상으로 2주 연속 유지됐는가?',
      review_at: '2026-09-01',
      resolution_criterion: '완결된 주간 코호트 두 개가 각각 3.2% 이상',
      deferred: true,
      deferred_to: '2026-09-15',
      resolution_kind: 'answered',
      answer_summary: '완결된 두 주가 각각 3.2% 이상이었다',
      criterion_result: 'met',
      evidence_observations: ['8월 마지막 주 3.3%', '9월 첫째 주 3.4%'],
      closed: true,
    },
  },
  {
    id: 'S02-contractor',
    title: '계약직 채용 — AI 초안을 고쳐 쓴 판단, 빗나간 결과',
    transcript: [
      { role: 'user', at: '2026-04-10T14:00:00+09:00', text: '백엔드 계약직을 뽑을지 고민이야. 지금 팀 속도로는 6월 마감을 못 맞출 것 같아.' },
      { role: 'ai', at: '2026-04-10T14:00:30+09:00', text: '초안: "계약직 1명을 4월 안에 채용해 6월 15일 마감을 지킨다". 전제 후보: (a) 온보딩에 2주면 충분하다, (b) 예산 승인이 이번 주에 난다, (c) 지금 지원자 풀에 적합자가 있다.' },
      { role: 'user', at: '2026-04-10T14:02:10+09:00', text: '문구를 이렇게 바꿔: "4월 안에 계약직 1명을 뽑되, 6월 15일 마감은 스코프 축소와 병행해서 지킨다". 전제는 (a)랑 (b)만 채택할게. (c)는 모르겠어 — 풀은 아직 안 봤어. 확인은 6월 16일, 질문은 "마감을 지켰는가".' },
      { role: 'ai', at: '2026-05-20T11:00:00+09:00', text: '알림: 예산 승인이 5월 19일에야 났습니다 (재무팀 메일). 전제 (b)는 봉인 당시 기대와 다르게 5주 늦었어요.' },
      { role: 'user', at: '2026-06-16T10:00:00+09:00', text: '마감 못 지켰어. 6월 30일로 밀렸고, 원인은 채용이 5월 말에야 된 것. 빗나간 걸로 기록하고 닫아.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: '4월 안에 계약직 1명을 뽑되, 6월 15일 마감은 스코프 축소와 병행해서 지킨다',
      statement_origin: 'ai_draft_reworded',
      adopted_premises: ['온보딩에 2주면 충분하다', '예산 승인이 이번 주에 난다'],
      unadopted_claims: ['지금 지원자 풀에 적합자가 있다'],
      ai_premises: ['온보딩에 2주면 충분하다', '예산 승인이 이번 주에 난다'],
      post_seal_facts: ['예산 승인이 5월 19일에 남', '마감이 6월 30일로 밀림', '채용이 5월 말에 됨'],
      review_question: '마감을 지켰는가',
      review_at: '2026-06-16',
      deferred: false,
      resolution_kind: 'answered',
      answer_summary: '마감을 지키지 못했다 — 6월 30일로 밀렸고 원인은 채용 지연',
      criterion_result: 'not_met',
      evidence_observations: ['마감이 6월 30일로 밀림', '채용이 5월 말에 됨'],
      closed: true,
    },
  },
  {
    id: 'S03-vendor',
    title: '벤더 교체 — 질문 자체가 소멸한 판단 (moot)',
    transcript: [
      { role: 'user', at: '2026-03-02T10:00:00+09:00', text: '결제 벤더를 A에서 B로 옮길지 6월에 결정하려고 해. 일단 "B의 정산 지연이 48시간 이내로 안정화되면 옮긴다"로 적어둘래. 6월 2일에 B의 5월 정산 지표를 보고 판단하자.' },
      { role: 'ai', at: '2026-03-02T10:00:40+09:00', text: '기록했습니다. 전제를 하나 제안해요: "A의 수수료 인상이 예정대로 7월에 시행된다" — 이게 무너지면 옮길 이유가 약해져요.' },
      { role: 'user', at: '2026-03-02T10:01:30+09:00', text: '그 전제 채택할게. 그게 사실 이 판단의 뿌리야.' },
      { role: 'ai', at: '2026-05-28T09:00:00+09:00', text: '뉴스: 벤더 B가 5월 27일 국내 서비스 종료를 공지했습니다 (공식 블로그).' },
      { role: 'user', at: '2026-06-02T09:00:00+09:00', text: 'B가 사라졌으니 이 질문은 의미가 없어졌네. 질문 소멸로 닫아줘.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: 'B의 정산 지연이 48시간 이내로 안정화되면 결제 벤더를 A에서 B로 옮긴다',
      statement_origin: 'human',
      adopted_premises: ['A의 수수료 인상이 예정대로 7월에 시행된다'],
      unadopted_claims: [],
      post_seal_facts: ['벤더 B가 5월 27일 국내 서비스 종료를 공지'],
      ai_premises: ['A의 수수료 인상이 예정대로 7월에 시행된다'],
      review_question: 'B의 5월 정산 지연 지표가 48시간 이내로 안정화됐는가',
      review_at: '2026-06-02',
      deferred: false,
      resolution_kind: 'moot',
      answer_summary: 'B가 국내 서비스를 종료해 질문의 대상이 사라졌다',
      evidence_observations: ['벤더 B가 5월 27일 국내 서비스 종료를 공지'],
      closed: true,
    },
  },
  {
    id: 'S04-campaign',
    title: '브랜드 캠페인 — 증거 부족으로 판정 불가 (indeterminate)',
    transcript: [
      { role: 'user', at: '2026-02-14T13:00:00+09:00', text: '브랜드 캠페인에 2천을 쓴다. 내 예측: 4월 말까지 브랜드 검색량이 30% 이상 오른다. 4월 30일에 확인하자.' },
      { role: 'ai', at: '2026-02-14T13:00:30+09:00', text: '전제 제안: (a) 검색량 데이터를 주 단위로 얻을 수 있다, (b) 경쟁 캠페인이 같은 기간에 없다. 채택하시겠어요?' },
      { role: 'user', at: '2026-02-14T13:01:10+09:00', text: '(a)만 채택. (b)는 통제 못 하는 거라 전제로 안 삼을래.' },
      { role: 'ai', at: '2026-04-28T09:00:00+09:00', text: '문제: 검색량 API 제공사가 3월부터 집계 방식을 바꿔 2월 이전과 비교가 불가능하다고 공지했어요.' },
      { role: 'user', at: '2026-04-30T10:00:00+09:00', text: '기준선 자체가 무너졌으니 30% 상승 여부는 알 수 없게 됐어. 판정 불가로 닫아줘 — 이유는 집계 방식 변경으로 비교 기준선 소실.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: '브랜드 캠페인에 2천을 쓴다 — 4월 말까지 브랜드 검색량이 30% 이상 오른다는 예측으로',
      statement_origin: 'human',
      adopted_premises: ['검색량 데이터를 주 단위로 얻을 수 있다'],
      unadopted_claims: ['경쟁 캠페인이 같은 기간에 없다'],
      ai_premises: ['검색량 데이터를 주 단위로 얻을 수 있다'],
      post_seal_facts: ['검색량 API 집계 방식 변경으로 2월 이전과 비교 불가'],
      review_question: '4월 말까지 브랜드 검색량이 30% 이상 올랐는가',
      review_at: '2026-04-30',
      deferred: false,
      resolution_kind: 'indeterminate',
      answer_summary: '집계 방식 변경으로 비교 기준선이 소실되어 답할 수 없다',
      evidence_observations: ['검색량 API 집계 방식 변경 공지'],
      closed: true,
    },
  },
  {
    id: 'S05-europe',
    title: '회고 봉인 — 지난달 이미 내린 결정을 오늘 기록',
    transcript: [
      { role: 'user', at: '2026-06-20T09:00:00+09:00', text: '사실 지난달(5월 18일쯤) 이미 결정했는데 기록을 못 했어: 유럽 진출은 2027년으로 미룬다. 이유는 환율이랑 현지 인증 비용. 지금이라도 남겨줘. 12월 1일에 "미룬 게 옳았는지 — 경쟁사가 그 사이 유럽에서 유의미한 점유율을 가져갔는지"를 보자.' },
      { role: 'ai', at: '2026-06-20T09:00:40+09:00', text: '회고 기록으로 남깁니다 — 결정 시점은 5월 18일(당신의 진술), 기록·승인 시점은 오늘 6월 20일. 전제로 "현지 인증 비용이 5천 이상이다"를 명시할까요?' },
      { role: 'user', at: '2026-06-20T09:01:20+09:00', text: '응, 그 전제 채택. 견적서 기준이야.' },
      { role: 'ai', at: '2026-11-25T09:00:00+09:00', text: '참고: 경쟁사 C가 11월 24일 독일 진출을 발표했습니다.' },
      { role: 'user', at: '2026-12-01T10:00:00+09:00', text: 'C가 진출은 했지만 점유율은 아직 무의미한 수준이야. 질문에는 "아니오 — 유의미한 점유율 이동 없음"으로 답하고 닫아.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: '유럽 진출은 2027년으로 미룬다',
      statement_origin: 'human',
      adopted_premises: ['현지 인증 비용이 5천 이상이다'],
      unadopted_claims: [],
      post_seal_facts: ['경쟁사 C가 11월 24일 독일 진출 발표'],
      ai_premises: ['현지 인증 비용이 5천 이상이다'],
      review_question: '미룬 게 옳았는지 — 경쟁사가 그 사이 유럽에서 유의미한 점유율을 가져갔는가',
      review_at: '2026-12-01',
      deferred: false,
      resolution_kind: 'answered',
      answer_summary: '아니오 — 유의미한 점유율 이동 없음',
      evidence_observations: ['경쟁사 C 독일 진출 발표', '점유율은 무의미한 수준'],
      closed: true,
    },
  },
  {
    id: 'S06-sunset',
    title: '기능 일몰 — 부분 충족(partial)으로 닫힌 판단',
    transcript: [
      { role: 'user', at: '2026-01-15T11:00:00+09:00', text: '레거시 리포트 기능을 3월 말에 내린다. 조건: 신규 대시보드로의 주간 활성 이전율이 80% 이상이면. 4월 1일에 확인.' },
      { role: 'ai', at: '2026-01-15T11:00:30+09:00', text: '전제 제안: (a) 이전 안내 배너가 2월부터 노출된다, (b) 대시보드의 핵심 지표 패리티가 2월 안에 완성된다.' },
      { role: 'user', at: '2026-01-15T11:01:00+09:00', text: '둘 다 채택. 둘 다 우리가 통제하는 거니까.' },
      { role: 'ai', at: '2026-03-10T09:00:00+09:00', text: '경고: 패리티 작업 중 엑셀 내보내기가 3월 말까지 안 됩니다 (엔지니어링 리포트).' },
      { role: 'user', at: '2026-04-01T10:00:00+09:00', text: '이전율은 84%로 넘었는데 엑셀 내보내기 사용자들이 강하게 반발 중이야. 부분 충족으로 기록해줘 — 이전율 조건은 됐지만 패리티 전제가 깨져서 일몰은 5월로 연기했어. 그리고 닫아.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: '레거시 리포트 기능을 3월 말에 내린다 — 신규 대시보드 주간 활성 이전율 80% 이상 조건으로',
      statement_origin: 'human',
      adopted_premises: ['이전 안내 배너가 2월부터 노출된다', '대시보드의 핵심 지표 패리티가 2월 안에 완성된다'],
      unadopted_claims: [],
      post_seal_facts: ['엑셀 내보내기가 3월 말까지 미완 (패리티 미완성)', '이전율 84%', '일몰 5월로 연기'],
      ai_premises: ['이전 안내 배너가 2월부터 노출된다', '대시보드의 핵심 지표 패리티가 2월 안에 완성된다'],
      review_question: '신규 대시보드로의 주간 활성 이전율이 80% 이상인가',
      review_at: '2026-04-01',
      resolution_criterion: '주간 활성 이전율 80% 이상',
      deferred: false,
      resolution_kind: 'answered',
      answer_summary: '이전율 84%로 조건은 넘었으나 패리티 전제가 깨져 일몰은 연기됨',
      criterion_result: 'partial',
      evidence_observations: ['이전율 84%', '엑셀 내보내기 미완'],
      closed: true,
    },
  },
  {
    id: 'S07-oncall',
    title: '온콜 개편 — 두 번 미룬 뒤 answered로 닫힘',
    transcript: [
      { role: 'user', at: '2026-02-01T10:00:00+09:00', text: '온콜을 주 단위에서 일 단위 로테이션으로 바꾼다. 내 내기: 3월 1일까지 야간 페이지 응답시간 중앙값이 15분 아래로 내려간다.' },
      { role: 'ai', at: '2026-02-01T10:00:30+09:00', text: '전제 제안: "페이지 볼륨이 현 수준(주 40건)을 유지한다". 볼륨이 급증하면 응답시간 악화가 로테이션 탓인지 알 수 없게 돼요.' },
      { role: 'user', at: '2026-02-01T10:01:00+09:00', text: '채택. 3월 1일에 보자.' },
      { role: 'user', at: '2026-03-01T09:00:00+09:00', text: '2월에 장애 폭풍이 있어서 데이터가 오염됐어. 4월 1일로 미루자.' },
      { role: 'user', at: '2026-04-01T09:00:00+09:00', text: '3월 데이터도 반쪽이야 — 대시보드 이관 때문에. 5월 1일로 한 번만 더.' },
      { role: 'user', at: '2026-05-01T09:00:00+09:00', text: '4월 중앙값 12분. 내기 성립. 닫아줘.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: '온콜을 주 단위에서 일 단위 로테이션으로 바꾼다',
      statement_origin: 'human',
      adopted_premises: ['페이지 볼륨이 현 수준(주 40건)을 유지한다'],
      unadopted_claims: [],
      post_seal_facts: ['2월 장애 폭풍으로 데이터 오염', '3월 대시보드 이관', '4월 중앙값 12분'],
      ai_premises: ['페이지 볼륨이 현 수준(주 40건)을 유지한다'],
      review_question: '야간 페이지 응답시간 중앙값이 15분 아래로 내려갔는가',
      review_at: '2026-03-01',
      deferred: true,
      deferred_to: '2026-05-01',
      resolution_kind: 'answered',
      answer_summary: '4월 중앙값 12분으로 15분 아래',
      criterion_result: 'met',
      evidence_observations: ['4월 야간 페이지 응답시간 중앙값 12분'],
      closed: true,
    },
  },
  {
    id: 'S08-sdk',
    title: '오픈소스 전환 — AI가 강하게 민 초안을 거의 그대로 채택',
    transcript: [
      { role: 'user', at: '2026-03-20T15:00:00+09:00', text: 'SDK를 오픈소스로 풀지 말지 계속 고민 중이야.' },
      { role: 'ai', at: '2026-03-20T15:00:40+09:00', text: '초안 제안: "SDK 코어를 4월 15일 MIT로 공개한다. 예측: 8월 15일까지 외부 기여 PR이 10건 이상 들어온다." 전제 후보: (a) 경쟁 우위는 SDK가 아니라 데이터에 있다, (b) 문서화 부채가 공개 전에 해소된다.' },
      { role: 'user', at: '2026-03-20T15:02:00+09:00', text: '그 문구 그대로 봉인해. 전제는 (a)만 — (b)는 희망사항이지 전제가 아니야.' },
      { role: 'ai', at: '2026-07-30T09:00:00+09:00', text: '현황: 외부 기여 PR 4건. 그중 2건이 문서 수정입니다.' },
      { role: 'user', at: '2026-08-15T10:00:00+09:00', text: 'PR 6건으로 끝났어. 10건 미달 — 빗나감으로 닫아줘.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: 'SDK 코어를 4월 15일 MIT로 공개한다. 예측: 8월 15일까지 외부 기여 PR이 10건 이상 들어온다.',
      statement_origin: 'ai_draft_adopted',
      adopted_premises: ['경쟁 우위는 SDK가 아니라 데이터에 있다'],
      unadopted_claims: ['문서화 부채가 공개 전에 해소된다'],
      ai_premises: ['경쟁 우위는 SDK가 아니라 데이터에 있다'],
      post_seal_facts: ['7월 말 외부 기여 PR 4건', '최종 PR 6건'],
      review_question: '8월 15일까지 외부 기여 PR이 10건 이상 들어왔는가',
      review_at: '2026-08-15',
      deferred: false,
      resolution_kind: 'answered',
      answer_summary: 'PR 6건으로 10건에 미달',
      criterion_result: 'not_met',
      evidence_observations: ['최종 외부 기여 PR 6건'],
      closed: true,
    },
  },
  {
    id: 'S09-teamsplit',
    title: '팀 분리 — 전제 폐기(retire) 후에도 판단은 유지, met로 종결',
    transcript: [
      { role: 'user', at: '2026-01-08T10:00:00+09:00', text: '플랫폼팀을 인프라/개발경험 둘로 나눈다. 예측: 2분기 배포 빈도가 주 10회를 넘는다. 7월 1일 확인. 전제: 채용 두 명이 3월까지 합류한다.' },
      { role: 'ai', at: '2026-01-08T10:00:30+09:00', text: '기록했습니다. 전제 "채용 두 명이 3월까지 합류한다"가 깨지면 알려드릴게요.' },
      { role: 'user', at: '2026-04-02T09:00:00+09:00', text: '채용이 한 명만 됐어. 그 전제는 폐기할게 — 근데 판단 자체는 유지야. 분리 효과는 채용과 무관하게 이미 보이고 있어.' },
      { role: 'ai', at: '2026-06-28T09:00:00+09:00', text: '집계: 2분기 주당 배포 빈도 평균 12.3회.' },
      { role: 'user', at: '2026-07-01T10:00:00+09:00', text: '주 12회 넘었네. 충족으로 닫아.' },
    ],
    seal_after_turn: 1,
    truth: {
      sealed_statement: '플랫폼팀을 인프라/개발경험 둘로 나눈다',
      statement_origin: 'human',
      adopted_premises: ['채용 두 명이 3월까지 합류한다'],
      unadopted_claims: [],
      post_seal_facts: ['채용이 한 명만 됨 (전제 폐기)', '2분기 주당 배포 빈도 평균 12.3회'],
      review_question: '2분기 배포 빈도가 주 10회를 넘는가',
      review_at: '2026-07-01',
      deferred: false,
      resolution_kind: 'answered',
      answer_summary: '주당 평균 12.3회로 10회를 넘었다',
      criterion_result: 'met',
      evidence_observations: ['2분기 주당 배포 빈도 평균 12.3회'],
      closed: true,
    },
  },
  {
    id: 'S10-abtest',
    title: '가격 실험 — 사용자가 AI 해석을 거부하고 자기 해석으로 닫음',
    transcript: [
      { role: 'user', at: '2026-05-10T10:00:00+09:00', text: '연간 플랜 가격을 20% 올린 A/B를 6월 한 달 돌린다. 예측: 순매출(전환×단가)이 최소 5% 오른다. 7월 5일 확인. 전제: 표본이 플랜별 최소 400 전환은 된다.' },
      { role: 'ai', at: '2026-05-10T10:00:30+09:00', text: '기록했습니다.' },
      { role: 'ai', at: '2026-07-03T09:00:00+09:00', text: '집계: 전환 -9%, 단가 +20%, 순매출 +9.2%. 표본은 각 460/470 전환. 제 해석으로는 명확한 성공입니다.' },
      { role: 'user', at: '2026-07-05T10:00:00+09:00', text: '숫자는 그대로 기록해. 근데 "명확한 성공"은 네 해석이고 — 내 해석은 "조건은 충족했지만 이탈 코호트의 LTV를 아직 몰라서 성공 단정은 이르다"야. 조건 충족(met)으로 하되 내 문장으로 답을 남기고 닫아.' },
    ],
    seal_after_turn: 1,
    truth: {
      sealed_statement: '연간 플랜 가격을 20% 올린 A/B를 6월 한 달 돌린다',
      statement_origin: 'human',
      adopted_premises: ['표본이 플랜별 최소 400 전환은 된다'],
      unadopted_claims: [],
      post_seal_facts: ['전환 -9%, 단가 +20%, 순매출 +9.2%', '표본 460/470'],
      review_question: '순매출(전환×단가)이 최소 5% 올랐는가',
      review_at: '2026-07-05',
      resolution_criterion: '순매출 +5% 이상',
      deferred: false,
      resolution_kind: 'answered',
      answer_summary: '조건은 충족했지만 이탈 코호트의 LTV를 아직 몰라서 성공 단정은 이르다',
      criterion_result: 'met',
      evidence_observations: ['전환 -9%, 단가 +20%, 순매출 +9.2%'],
      closed: true,
    },
  },
  {
    id: 'S11-lease',
    title: '사무실 재계약 — 봉인 당시 몰랐던 사실이 나중에 큰 소음으로 등장',
    transcript: [
      { role: 'user', at: '2026-04-01T10:00:00+09:00', text: '사무실을 2년 재계약한다. 예측: 하이브리드 3일 출근제 기준으로 좌석 가동률이 연말까지 70%를 넘는다. 12월 20일 확인. 전제: 인원이 연말까지 20% 이상 늘지 않는다.' },
      { role: 'ai', at: '2026-04-01T10:00:30+09:00', text: '기록했습니다.' },
      { role: 'ai', at: '2026-09-15T09:00:00+09:00', text: '중요: 건물주가 내년 리모델링 계획을 공지했어요. 6개월 부분 폐쇄 가능성이 있습니다.' },
      { role: 'user', at: '2026-12-20T10:00:00+09:00', text: '가동률 11~12월 평균 74%. 충족으로 닫아. 리모델링 건은 이 판단과 별개 결정으로 다룰게 — 이 기록에 섞지 마.' },
    ],
    seal_after_turn: 1,
    truth: {
      sealed_statement: '사무실을 2년 재계약한다',
      statement_origin: 'human',
      adopted_premises: ['인원이 연말까지 20% 이상 늘지 않는다'],
      unadopted_claims: [],
      post_seal_facts: ['건물주 리모델링 계획 공지 (6개월 부분 폐쇄 가능성)', '가동률 11~12월 평균 74%'],
      review_question: '좌석 가동률이 연말까지 70%를 넘는가',
      review_at: '2026-12-20',
      deferred: false,
      resolution_kind: 'answered',
      answer_summary: '11~12월 평균 74%로 70%를 넘었다',
      criterion_result: 'met',
      evidence_observations: ['가동률 11~12월 평균 74%'],
      closed: true,
    },
  },
  {
    id: 'S12-dbmove',
    title: 'DB 이관 — 판정 불가 직전까지 갔다가 answered/not_met으로 닫힘',
    transcript: [
      { role: 'user', at: '2026-06-01T10:00:00+09:00', text: '7월 둘째 주에 주 DB를 이관한다. 내 내기: 고객 체감 다운타임 5분 이내. 7월 15일에 확인. 전제: 인덱스 리빌드가 복제 지연 예산 안에 든다.' },
      { role: 'ai', at: '2026-06-01T10:00:30+09:00', text: '기록했습니다. "고객 체감"의 측정 기준을 정할까요 — 상태페이지 신고 기준인지, APM 오류율 기준인지?' },
      { role: 'user', at: '2026-06-01T10:01:10+09:00', text: '상태페이지+지원 티켓 기준으로. 그게 기준(criterion)이야.' },
      { role: 'ai', at: '2026-07-12T09:00:00+09:00', text: '이관 완료. APM상 12분간 오류율 상승. 지원 티켓 3건, 상태페이지 신고 1건.' },
      { role: 'user', at: '2026-07-15T10:00:00+09:00', text: '티켓이 왔으니 "체감 없음"은 아니야. 12분이면 5분 예산 초과 — 빗나감(not met)으로 닫아. 다만 롤백 없이 끝난 건 별도로 기록해줘: 관찰로만.' },
    ],
    seal_after_turn: 2,
    truth: {
      sealed_statement: '7월 둘째 주에 주 DB를 이관한다',
      statement_origin: 'human',
      adopted_premises: ['인덱스 리빌드가 복제 지연 예산 안에 든다'],
      unadopted_claims: [],
      post_seal_facts: ['APM상 12분 오류율 상승', '지원 티켓 3건, 상태페이지 신고 1건'],
      review_question: '고객 체감 다운타임이 5분 이내였는가',
      review_at: '2026-07-15',
      resolution_criterion: '상태페이지 신고 + 지원 티켓 기준',
      deferred: false,
      resolution_kind: 'answered',
      answer_summary: '12분 오류율 상승과 티켓 발생으로 5분 예산 초과',
      criterion_result: 'not_met',
      evidence_observations: ['APM 12분 오류율 상승', '지원 티켓 3건, 상태페이지 신고 1건'],
      closed: true,
    },
  },
];
