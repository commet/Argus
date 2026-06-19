import { CurrentBearingCard } from 'argus';

// CurrentBearingCard — the compressed, one-screen orientation the user KEEPS
// after a voyage: current course + status chip, why-this-course, fog/reef, road
// not taken, next helm, and a contract-seed prediction to check later. Reads
// locale from useLocale, so we seed sot_settings=ko at module scope (the card's
// internal labels — 현재 방위 / 복사 / 왜 이 항로인가 — then render in Korean).
// Go-states (proceed/anchor/fork) ride the accent; caution-states
// (collect_evidence/hold/revise) ride gold. Cells sweep both tones + density.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The card enters via framer-motion (initial opacity:0, y:16). A static capture
// reports no reduced-motion, so the JS entrance stays at frame 0 → blank. Force
// the rest state for the screenshot, scoped to .fm-static.
if (typeof document !== 'undefined' && !document.getElementById('fm-static-style')) {
  const s = document.createElement('style');
  s.id = 'fm-static-style';
  s.textContent = '.fm-static, .fm-static *{opacity:1 !important;transform:none !important}';
  document.head.appendChild(s);
}

const frame: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: 16,
  background: 'var(--bg)',
};

// A full proceed bearing — every row present, accent-toned status chip.
export const ProceedFull = () => (
  <div className="fm-static" style={frame}>
    <CurrentBearingCard
      label="v0.3"
      bearing={{
        current_course: {
          status: 'proceed',
          summary: '5명 중 2명을 빼서, 경쟁사가 못 하는 1일 세팅 베타를 4주 안에 시연한다.',
        },
        why_this_course: [
          { point: '경쟁사는 세팅 2주·월 80만 원이라 이커머스 셀러 구간이 통째로 비어 있다.', source: 'review' },
          { point: '사전학습으로 세팅을 1일로 줄이면 그 빈자리를 단독으로 연다.', source: 'draft' },
          { point: '4주 베타는 "완벽한 보고서"가 아니라 결재 한 줄을 만든다.', source: 'review' },
        ],
        fog_or_reef: {
          issue: '사전학습 모델이 이커머스 용어를 정말 1일 안에 적용 가능한지는 아직 미검증이다.',
          why_it_matters: '1일 세팅이 무너지면 핵심 차별점 전체가 무너진다.',
          required_check: '용어 50개로 PoC를 돌려 첫 1일 안에 작동 영상 1개를 확보한다.',
        },
        road_not_taken: [
          { option: '대기업 대상 고급형으로 정면 경쟁', why_not_now: '경쟁사가 선점했고 우리 인력으로 6개월 안엔 못 따라간다.' },
          { option: '5명 전원 투입 풀스펙 출시', why_not_now: '기존 제품 유지보수가 멈춰 더 큰 손실을 부른다.' },
        ],
        next_helm: '월요일까지 용어 50개 PoC를 돌려 1일 세팅 가정부터 깬다.',
        contract_seed: {
          predicate: '4주 차에 셀러 1명 앞에서 자동 답변 베타가 실제로 작동한다.',
        },
        blocked: false,
      }}
    />
  </div>
);

// A caution bearing — collect-evidence status (gold chip), named fog, no roads
// considered yet, no contract seed. The "근거 먼저" path.
export const CollectEvidenceCaution = () => (
  <div className="fm-static" style={frame}>
    <CurrentBearingCard
      label="v0.1"
      bearing={{
        current_course: {
          status: 'collect_evidence',
          summary: '가격을 확정하기 전에, 셀러가 진짜 사는 게 "가격"인지 "전환 비용"인지부터 확인한다.',
        },
        why_this_course: [
          { point: '월 29만 vs 39만 원은 가격 민감도 가정 위에 서 있는데 그 가정이 가장 약하다.', source: 'draft' },
        ],
        fog_or_reef: {
          issue: '셀러가 가격에 민감하다는 전제가 검증된 적이 없다.',
          required_check: '상위 문의 셀러 8명에게 "왜 지금 안 쓰는지" 30분 인터뷰.',
        },
        road_not_taken: [],
        next_helm: '이번 주에 셀러 8명 인터뷰를 잡고, 가격이 아니라 도입 장벽을 먼저 듣는다.',
        contract_seed: null,
        blocked: false,
      }}
    />
  </div>
);

// A sparse fork bearing — accent chip, single reason, no fog/roads/seed. Shows
// the card when the live flow surfaced little (rows omitted, never empty shells).
export const ForkMinimal = () => (
  <div className="fm-static" style={frame}>
    <CurrentBearingCard
      bearing={{
        current_course: {
          status: 'fork',
          summary: '채용을 지금 1명 할지, 분기 말까지 미룰지 — 런웨이 숫자 하나로 갈린다.',
        },
        why_this_course: [
          { point: '두 길의 차이는 결국 "6개월 뒤 현금이 버티는가" 하나로 수렴한다.' },
        ],
        fog_or_reef: null,
        road_not_taken: [],
        next_helm: '6개월 보수적 현금 흐름표를 그려, 채용 시 런웨이가 4개월 밑으로 가는지만 본다.',
        contract_seed: null,
        blocked: false,
      }}
    />
  </div>
);
