// TWIN case bank 시드 — 결과가 이미 나온 공개 사례 12건.
//
// **형태가 곧 정직성이다**: 각 항목은 "무엇을 골라야 했나"를 묻지 않는다 —
// 그것은 반사실이라 채점할 수 없고, 채점하는 척하면 그럴듯한 가짜 성적이 된다
// (LLM-glue 함정). 대신 "그 결정이 내려진 뒤 실제로 무슨 일이 일어났나"를
// 묻는다 — 해소된 예측 문제이므로 진짜 채점이 가능하다 (FutureSim 방법론).
//
// situation 에는 **결정 시점에 알 수 있던 것 + 내려진 결정**까지만 적는다.
// 결과를 암시하는 표현이 섞이면 그 항목은 시험지가 아니라 답안지다.
// 출처 없는 사례는 넣지 않는다 (스키마 not null).

export interface CaseBankItem {
  id: string;
  domain: string;
  situation: string;
  options: Array<{ key: string; label: string }>;
  outcome_key: string;
  outcome_note: string;
  source_url: string;
}

export const CASE_BANK_SEED: CaseBankItem[] = [
  {
    id: 'netflix-qwikster-2011',
    domain: '제품 전략',
    situation:
      '2011년, DVD 우편 대여와 스트리밍을 함께 하던 Netflix 가 DVD 사업을 "Qwikster"라는 별도 브랜드·별도 사이트로 분리하겠다고 발표했다. 가입자는 두 서비스에 각각 가입해야 하고 요금도 사실상 인상된다. 발표 직후 가입자 항의가 시작된 상태다.',
    options: [
      { key: 'stuck', label: '분리를 밀고 나가 Qwikster 가 정착했다' },
      { key: 'reversed', label: '몇 주 안에 분리 계획을 철회했다' },
    ],
    outcome_key: 'reversed',
    outcome_note: '발표 3주 만에 철회. 그 분기에만 가입자 80만 명이 이탈했고 주가가 급락했다.',
    source_url: 'https://en.wikipedia.org/wiki/Qwikster',
  },
  {
    id: 'new-coke-1985',
    domain: '브랜드',
    situation:
      '1985년, 펩시에 시장을 잠식당하던 Coca-Cola 가 190,000회의 블라인드 시음 테스트에서 더 높은 선호를 받은 새 배합("New Coke")으로 기존 콜라를 완전히 교체하기로 결정하고 출시했다.',
    options: [
      { key: 'adopted', label: '소비자가 새 맛에 적응해 교체가 정착했다' },
      { key: 'backlash_return', label: '반발이 거세 몇 달 안에 기존 배합이 돌아왔다' },
    ],
    outcome_key: 'backlash_return',
    outcome_note: '항의 전화가 하루 수천 건. 79일 만에 "Coca-Cola Classic"으로 원배합 복귀.',
    source_url: 'https://en.wikipedia.org/wiki/New_Coke',
  },
  {
    id: 'blockbuster-netflix-2000',
    domain: '인수',
    situation:
      '2000년, 오프라인 비디오 대여 1위 Blockbuster 에게 작은 DVD 우편 대여 스타트업 Netflix 가 5천만 달러 인수를 제안했다. Blockbuster 는 제안을 거절하고 오프라인 매장 중심 전략을 유지하기로 했다.',
    options: [
      { key: 'blockbuster_prevailed', label: 'Blockbuster 가 규모의 힘으로 시장을 지켰다' },
      { key: 'blockbuster_bankrupt', label: 'Netflix 가 시장을 재편했고 Blockbuster 는 파산했다' },
    ],
    outcome_key: 'blockbuster_bankrupt',
    outcome_note: 'Blockbuster 는 2010년 파산 신청. Netflix 는 스트리밍 전환까지 성공하며 시장을 지배했다.',
    source_url: 'https://en.wikipedia.org/wiki/Blockbuster_(retailer)',
  },
  {
    id: 'excite-google-1999',
    domain: '인수',
    situation:
      '1999년, 포털 Excite 에게 스탠퍼드 대학원생 둘이 만든 검색 기술 스타트업 Google 이 약 75만 달러에 인수를 제안했다. Excite 는 거절했다. 당시 검색은 포털의 여러 기능 중 하나로 여겨졌다.',
    options: [
      { key: 'search_stayed_minor', label: '검색은 포털 기능의 하나로 남았다' },
      { key: 'google_dominant', label: 'Google 이 검색 중심으로 웹의 지배적 기업이 됐다' },
    ],
    outcome_key: 'google_dominant',
    outcome_note: 'Google 은 검색 중심 모델로 세계 최대 기업 중 하나가 됐고, Excite 는 2001년 파산했다.',
    source_url: 'https://en.wikipedia.org/wiki/Excite',
  },
  {
    id: 'quibi-2020',
    domain: '신사업',
    situation:
      '2020년 4월, 할리우드 거물 제프리 카첸버그가 이끄는 Quibi 가 "모바일 전용 10분 이하 프리미엄 영상"이라는 새 카테고리에 17.5억 달러를 조달해 출시했다. 출시 시점은 팬데믹 초기로, 사람들의 이동이 급감한 상태였다.',
    options: [
      { key: 'new_category', label: '새 카테고리로 자리잡아 성장했다' },
      { key: 'shut_down', label: '1년 안에 서비스를 접었다' },
    ],
    outcome_key: 'shut_down',
    outcome_note: '출시 6개월 만에 폐업 발표. 콘텐츠는 Roku 에 헐값 매각됐다.',
    source_url: 'https://en.wikipedia.org/wiki/Quibi',
  },
  {
    id: 'daimler-chrysler-1998',
    domain: '합병',
    situation:
      '1998년, 독일 Daimler-Benz 와 미국 Chrysler 가 360억 달러 규모의 "대등 합병"을 발표했다. 프리미엄과 대중 브랜드, 독일과 미국의 기업 문화를 합쳐 규모의 경제를 노린다는 논리였다.',
    options: [
      { key: 'synergy', label: '시너지가 실현되어 합병이 정착했다' },
      { key: 'unwound_at_loss', label: '문화 충돌 끝에 큰 손실을 보고 되팔았다' },
    ],
    outcome_key: 'unwound_at_loss',
    outcome_note: '2007년 Chrysler 를 74억 달러에 사모펀드에 매각 — 인수가의 5분의 1 수준.',
    source_url: 'https://en.wikipedia.org/wiki/DaimlerChrysler',
  },
  {
    id: 'amazon-aws-2006',
    domain: '신사업',
    situation:
      '2006년, 온라인 소매 기업 Amazon 이 자사 인프라 기술을 외부에 파는 클라우드 서비스(S3·EC2)를 출시하기로 했다. 소매 기업이 왜 기업용 인프라를 파느냐는 회의론이 지배적이었고, 이익률 낮은 본업에 집중하라는 압박이 있었다.',
    options: [
      { key: 'stayed_side', label: '부업 수준에 머물렀다' },
      { key: 'became_core', label: '회사의 핵심 이익 엔진이 됐다' },
    ],
    outcome_key: 'became_core',
    outcome_note: 'AWS 는 이후 Amazon 영업이익의 대부분을 내는 핵심 사업이 됐다.',
    source_url: 'https://en.wikipedia.org/wiki/Amazon_Web_Services',
  },
  {
    id: 'apple-retail-2001',
    domain: '유통',
    situation:
      '2001년, Apple 이 직영 소매점을 열기로 결정했다. 당시 Gateway 등 PC 제조사 직영점이 줄줄이 실패하고 있었고, 전문가들은 "2년 안에 문 닫고 비싼 실수로 기록될 것"이라고 공개적으로 예측했다.',
    options: [
      { key: 'failed_like_gateway', label: '다른 PC 제조사 직영점처럼 실패했다' },
      { key: 'succeeded', label: '소매업 역사에 남는 성공이 됐다' },
    ],
    outcome_key: 'succeeded',
    outcome_note: '단위면적당 매출 미국 소매업 최상위권. 브랜드 경험의 핵심 채널이 됐다.',
    source_url: 'https://en.wikipedia.org/wiki/Apple_Store',
  },
  {
    id: 'nokia-windows-phone-2011',
    domain: '플랫폼',
    situation:
      '2011년, 스마트폰 점유율이 급락하던 Nokia 가 자사 OS(Symbian·MeeGo)를 버리고 Microsoft Windows Phone 에 올인하기로 결정했다. Android 진영 합류라는 대안이 있었으나 "차별화가 불가능하다"는 이유로 기각했다.',
    options: [
      { key: 'third_ecosystem', label: 'Windows Phone 이 제3 생태계로 자리잡았다' },
      { key: 'collapsed_sold', label: '점유율이 무너져 휴대폰 사업을 매각했다' },
    ],
    outcome_key: 'collapsed_sold',
    outcome_note: '2013년 휴대폰 사업을 Microsoft 에 매각. Windows Phone 도 이후 단종됐다.',
    source_url: 'https://en.wikipedia.org/wiki/Nokia',
  },
  {
    id: 'google-glass-2013',
    domain: '제품 출시',
    situation:
      '2013년, Google 이 안경형 웨어러블 Google Glass 를 1,500달러의 "Explorer Edition"으로 일반 소비자 가까이에 출시하기로 했다. 프라이버시 논란(몰래 촬영 우려)이 출시 전부터 제기되고 있었다.',
    options: [
      { key: 'consumer_hit', label: '소비자 제품으로 자리잡았다' },
      { key: 'withdrawn', label: '소비자 시장에서 철수했다' },
    ],
    outcome_key: 'withdrawn',
    outcome_note: '2015년 소비자 판매 중단. 이후 기업용으로만 명맥을 유지하다 그마저 종료됐다.',
    source_url: 'https://en.wikipedia.org/wiki/Google_Glass',
  },
  {
    id: 'instagram-acquisition-2012',
    domain: '인수',
    situation:
      '2012년, Facebook 이 직원 13명·매출 0원의 사진 공유 앱 Instagram 을 10억 달러에 인수하기로 결정했다. 언론과 업계는 "매출도 없는 앱에 10억"이라며 거품의 상징으로 조롱했다.',
    options: [
      { key: 'overpaid', label: '고평가 인수로 판명됐다' },
      { key: 'massive_success', label: '인수가를 수십 배 상회하는 핵심 자산이 됐다' },
    ],
    outcome_key: 'massive_success',
    outcome_note: 'Instagram 은 이후 수천억 달러 가치로 평가되는 Meta 의 핵심 성장 엔진이 됐다.',
    source_url: 'https://en.wikipedia.org/wiki/Instagram',
  },
  {
    id: 'webvan-2001',
    domain: '신사업',
    situation:
      '1999–2000년, 온라인 식료품 배달 Webvan 이 26개 도시로의 공격적 확장을 결정하고 도시당 3천만 달러 이상의 자동화 물류센터를 선건설했다. 단일 도시에서의 수익성이 증명되기 전이었다.',
    options: [
      { key: 'scaled', label: '규모의 경제가 실현되어 시장을 선점했다' },
      { key: 'bankrupt', label: '수익성 증명 전의 확장이 파산으로 이어졌다' },
    ],
    outcome_key: 'bankrupt',
    outcome_note: '2001년 파산. 닷컴 버블의 대표적 과확장 사례로 기록됐다.',
    source_url: 'https://en.wikipedia.org/wiki/Webvan',
  },
];
