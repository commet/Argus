'use client';
// Shared data + tiny presentational atoms for the 3 WorkspaceHome direction
// studies. Design-sync-only. Korean sample copy matches the live screen.

export const CREW: { initial: string; emoji: string; color: string }[] = [
  { initial: '승', emoji: '🧭', color: '#2d4a7c' },
  { initial: '현', emoji: '📊', color: '#8b6914' },
  { initial: '지', emoji: '🎨', color: '#6b4c9a' },
  { initial: '예', emoji: '🗂️', color: '#1d7d3f' },
  { initial: '윤', emoji: '⚖️', color: '#b5651d' },
];

export const HEADLINE = '지금 들고 있는 결정, 어디서 갈리는지 봐 드릴게요';
export const PLACEHOLDER = '예: 다음 주까지 보고서를 써야 하는데 어디서 시작해야 할지 모르겠어';

export const STEPS = [
  '상황을 적으면',
  'AI 팀이 갈리는 자리를 보여드리고',
  '문서와 결론 요약 한 장이 남아요',
];

export const RECENT: { name: string; when: string }[] = [
  { name: '제조업 구매 직종에 근무하는데, 앞으로 향후 커리어를 어떻게 가져가야할지', when: '22일 전' },
  { name: '포워딩 물류회사의 AX를 어떻게 해야 할까?', when: '1달 전' },
  { name: 'AI를 전략 업무에 어떻게 도입해야 할지 모르겠어.', when: '1달 전' },
];

export const DEMOS: { icon: string; title: string; quote: string }[] = [
  { icon: '📝', title: '기획안', quote: '대표님이 갑자기 신사업 기획안을 2주 안에 만들어오라고 했어. 백…' },
  { icon: '🎯', title: '제안서', quote: '다음 주 금요일에 대형 유통사 물류 자동화 경쟁 PT야. 상대는 S사(대…' },
  { icon: '⚖️', title: '대응 전략', quote: '경쟁사 T사가 갑자기 구독 가격을 30% 내렸어. 우리는 B2B SaaS …' },
];

export function CrewFaces({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center" style={{ marginLeft: 0 }}>
      {CREW.map((c, i) => (
        <div
          key={i}
          className="relative rounded-full flex items-center justify-center"
          style={{
            width: size, height: size,
            marginLeft: i === 0 ? 0 : -6,
            background: `${c.color}18`,
            border: `1.5px solid ${c.color}40`,
            zIndex: CREW.length - i,
          }}
        >
          <span className="font-bold" style={{ color: c.color, fontSize: size * 0.42 }}>{c.initial}</span>
          <span className="absolute -bottom-0.5 -right-0.5 leading-none" style={{ fontSize: size * 0.3 }}>{c.emoji}</span>
        </div>
      ))}
    </div>
  );
}
