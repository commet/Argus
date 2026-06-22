import type { Metadata } from 'next';

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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  const m = META[lang];
  return {
    title: m.title,
    description: m.description,
    // Next overrides (not merges) nested metadata, so re-include the fields the
    // root layout sets or the boss page loses og:url / site_name / type / locale.
    openGraph: {
      title: m.ogTitle,
      description: m.ogDesc,
      url: `https://argus.voyage/${lang}/boss`,
      siteName: 'Argus',
      locale: lang === 'ko' ? 'ko_KR' : 'en_US',
      type: 'website',
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
