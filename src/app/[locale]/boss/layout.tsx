import type { Metadata } from 'next';
import { headers } from 'next/headers';

const META = {
  ko: {
    title: '팀장 시뮬레이터 — 말하기 전에 미리 연습',
    description: '팀장 성격유형과 생년월일을 넣으면, 그 사람이 뭐라 할지 미리 볼 수 있어.',
    ogTitle: '팀장 시뮬레이터',
    ogDesc: '팀장한테 할 말 있어? 미리 시뮬레이션 해봐.',
  },
  en: {
    title: 'Boss Simulator — Rehearse before you speak',
    description: "Enter your boss's personality type and birth date to preview what they'd actually say.",
    ogTitle: 'Boss Simulator',
    ogDesc: 'Got something to bring up with your boss? Rehearse it first.',
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const first = (h.get('accept-language') || '').split(',')[0]?.toLowerCase() ?? '';
  const lang: 'ko' | 'en' = first.startsWith('ko') ? 'ko' : 'en';
  const m = META[lang];
  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.ogTitle,
      description: m.ogDesc,
    },
  };
}

export default function BossLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="boss-layout">
      {children}
    </div>
  );
}
