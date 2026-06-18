import { CollectionProgress } from 'argus';

// CollectionProgress — the "boss reactions, by type" tracker that sits in the
// BossSetup sidebar. It reads the user's collected verdicts from localStorage
// (STORAGE_KEYS.BOSS_COLLECTION = 'sot_boss_collection') on mount via useMemo,
// and renders NOTHING when the collection is empty — so we seed a realistic
// half-finished run at module scope (8 of 16 MBTI boss types cleared, mixed
// verdicts). 8 cleared trips the "절반 돌파" milestone line under the dot bar.
// Locale is forced to Korean (this is a Korean-workplace feature).

if (typeof window !== 'undefined') {
  try {
    const ls = window.localStorage;
    ls.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
    ls.setItem('sot_boss_collection', JSON.stringify([
      { typeCode: 'ESTJ', verdict: 'approved',    situation: '신규 채용 1명 충원 요청',           completedAt: '2026-06-02T01:00:00.000Z', emoji: '👔' },
      { typeCode: 'INTJ', verdict: 'conditional',  situation: 'AI 상담 베타 4주 일정 승인',         completedAt: '2026-06-04T02:00:00.000Z', emoji: '🎯' },
      { typeCode: 'ENFP', verdict: 'approved',     situation: '사내 해커톤 이틀 차출',             completedAt: '2026-06-06T05:00:00.000Z', emoji: '🌈' },
      { typeCode: 'ISTP', verdict: 'rejected',     situation: '레거시 결제 모듈 전면 재작성',       completedAt: '2026-06-08T07:00:00.000Z', emoji: '🛠' },
      { typeCode: 'ESFJ', verdict: 'approved',     situation: '고객사 방문 출장 결재',             completedAt: '2026-06-10T03:00:00.000Z', emoji: '🤝' },
      { typeCode: 'INFP', verdict: 'conditional',  situation: '브랜드 리뉴얼 외주 계약',           completedAt: '2026-06-12T06:00:00.000Z', emoji: '🌙' },
      { typeCode: 'ENTJ', verdict: 'rejected',     situation: '경쟁사 인수 검토 TF 신설',          completedAt: '2026-06-14T08:00:00.000Z', emoji: '♟' },
      { typeCode: 'ISFJ', verdict: 'approved',     situation: '재택근무 주 2일 영구 전환',         completedAt: '2026-06-16T01:00:00.000Z', emoji: '🛡' },
    ]));
  } catch {}
}

// Sidebar placement — the real width it lives at inside BossSetup.
export const HalfwayCollected = () => (
  <div style={{ width: 280, padding: 16, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
    <CollectionProgress />
  </div>
);

// Same seeded state, wider container — shows the dot bar stretching to fill.
export const WideContainer = () => (
  <div style={{ width: 420, padding: 20, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
    <CollectionProgress />
  </div>
);
