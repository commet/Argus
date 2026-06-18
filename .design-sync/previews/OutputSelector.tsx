import { OutputSelector } from 'argus';

// OutputSelector — the end-of-voyage "outputs" panel. By default it exposes ONE
// format card (판단 근거서 · Decision Rationale) plus a quiet toggle to reveal the
// 4 preserved formats, and a collapsible Logbook (post-voyage reflection). The
// preview pane and download only appear after a click, so a static capture shows
// the format selector + the Logbook toggle (which reads "저장됨/Saved" because the
// project carries a meta_reflection). We seed the locale to Korean so the copy
// matches the rest of the set; the generators read localStorage, but none run
// until a card is clicked, so the card is fully self-describing as captured.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  } catch {}
}

const PROJECT = {
  id: 'proj-cs-ai',
  name: 'AI 고객 상담 — 이커머스 셀러 1차 진입',
  description: '경쟁사가 먼저 출시한 AI 상담 시장에서, 이커머스 셀러 전용으로 진입할지 결정하는 항해.',
  refs: [],
  meta_reflection: {
    understanding_change:
      '처음엔 "2주 안에 완벽한 기획서"가 과제인 줄 알았는데, 대표님이 진짜 원한 건 "빨리 결정하게 해주는 한 장"이었다.',
    surprising_discovery:
      '경쟁사가 먼저 출시한 게 위협이 아니라, 시장 교육비를 대신 내준 기회였다는 것.',
    next_time_differently:
      '가정 검증(셀러가 월 29만 원을 낼까)을 마지막이 아니라 첫 주에 했을 것이다.',
    created_at: '2026-06-16T09:30:00.000Z',
  },
  created_at: '2026-06-10T02:00:00.000Z',
  updated_at: '2026-06-16T09:30:00.000Z',
};

export const Default = () => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <OutputSelector project={PROJECT as any} />
);
