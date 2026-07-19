import { AgentHub } from '@/components/agents/AgentHub';
import type { Metadata } from 'next';

const META = {
  ko: { title: 'AI 검토자 — Argus', description: '결정을 서로 다른 관점에서 검토하는 AI 역할을 둘러보세요.' },
  en: { title: 'AI Reviewers — Argus', description: 'Meet AI roles that review decisions from different perspectives.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function AgentsPage() {
  return <AgentHub />;
}
