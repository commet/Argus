import { AttributedSection } from 'argus';

// AttributedSection — one paragraph of the synthesized draft with bidirectional
// hover + per-source attribution. Renders a heading and either a sentence-level
// stream (each sentence individually hoverable, with trailing contributor dots)
// or a fallback paragraph. Contributor avatars/dots resolve worker ids against
// the live progressive session; in the isolated preview no session is loaded, so
// the dots/avatars don't paint — the heading + body text render exactly as
// shipped. Korean locale. (Set to cardMode column — it's a full-width doc block.)

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The capture freezes the clock, stalling framer-motion's JS-driven entrance
// animation at its `opacity:0` start frame (the block renders blank). framer
// writes that start value as an INLINE style; `!important` beats inline, so force
// the end-state on exactly the elements framer touched.
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

// Sentence-level mode: the body is split into individually attributable
// sentences (the inline span treatment + per-sentence contributor dots).
const sentenceSection = {
  heading: '왜 지금인가',
  content: '경쟁사 출시로 시장은 검증됐지만 그들의 세팅 비용과 가격이 SMB 셀러를 밀어내고 있다. 이 공백은 6개월 내 누군가 메운다.',
  contributor_names: ['다은', '민서'],
  contributor_worker_ids: ['w1', 'w2'],
  sentences: [
    { text: '경쟁사 출시로 이 시장이 실재한다는 건 이미 증명됐다.', contributor_worker_ids: ['w1'] },
    { text: '하지만 세팅 2주·월 80만 원이라는 진입 장벽이 이커머스 셀러를 통째로 밀어내고 있다.', contributor_worker_ids: ['w1', 'w2'] },
    { text: '이 공백은 우리가 안 잡으면 6개월 안에 다른 누군가가 메운다.', contributor_worker_ids: ['w2'] },
  ],
};

export const SentenceLevel = () => (
  <div style={{ maxWidth: 560, padding: 20 }}>
    <AttributedSection section={sentenceSection} index={0} />
  </div>
);

// Fallback mode: no sentence split — a single attributed paragraph.
const paragraphSection = {
  heading: '어떻게 검증하나',
  content: '4주차에 셀러 1명 앞에서 작동하는 베타를 시연하고, 8주차 Go/No-Go 게이트에서 유료 전환율로 계속할지 멈출지를 가른다. 시연이 안 되거나 전환율이 기준에 미달하면, 매몰 비용을 더 쌓기 전에 접는다.',
  contributor_names: ['마야'],
  contributor_worker_ids: ['w3'],
};

export const ParagraphFallback = () => (
  <div style={{ maxWidth: 560, padding: 20 }}>
    <AttributedSection section={paragraphSection} index={1} />
  </div>
);
