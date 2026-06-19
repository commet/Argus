import { ContextChainBlock } from 'argus';

// ContextChainBlock — "이전 단계에서 / From the previous step". A checkpoint card
// shown at the top of a step (e.g. RehearseStep) that carries forward what the
// prior stage found. Each item is an expandable count: tap to reveal the details.

// Reframe → Rehearse handoff: the key question plus the unverified assumptions
// the previous reframe surfaced.
export const FromReframe = () => (
  <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
    <ContextChainBlock
      summary="항로 재설정에서 발견한 핵심 질문: 유료 전환을 언제 할지가 아니라, 무료 유저가 돈을 낼 만큼 한 가지 일을 잘 끝내고 있는가?"
      items={[
        {
          label: '검증되지 않은 가정',
          count: 3,
          color: 'text-amber-700',
          details: [
            '무료 유저 수가 많으면 전환 모수도 비례해 크다 → 활성화율이 낮으면 모수는 허수',
            '경쟁사가 유료화했으니 지금이 적기다 → 우리 리텐션 곡선과 무관할 수 있음',
            '가격만 정하면 결제는 따라온다 → 결제 동선 설계가 빠져 있음',
          ],
        },
      ]}
    />
  </div>
);

// Recast → Rehearse handoff: the key assumptions from crew assignment that this
// rehearsal will pressure-test. Two item rows.
export const FromRecast = () => (
  <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
    <ContextChainBlock
      summary="선원 배치의 핵심 가정 2건을 이 리허설에서 검증합니다."
      items={[
        {
          label: '선원 배치의 핵심 가정',
          count: 2,
          details: [
            '활성화 직후가 결제 의향이 가장 높은 순간이다',
            '무료 경험을 해치지 않고 업그레이드 동선을 삽입할 수 있다',
          ],
        },
        {
          label: '배치된 전문 역할',
          count: 3,
          color: 'text-blue-600',
          details: ['리텐션 분석가', '가격 전략가', '온보딩 UX 디자이너'],
        },
      ]}
    />
  </div>
);

// Summary only — no expandable items, the minimal checkpoint form.
export const SummaryOnly = () => (
  <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
    <ContextChainBlock
      summary="이전 단계에서 정리한 결정문: 활성화한 코어 유저에게 먼저 유료 동선을 테스트하고, 무료 활성화율이 5%p 떨어지면 철회한다."
      items={[]}
    />
  </div>
);
