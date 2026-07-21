import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { LayoutShell } from '@/components/layout/LayoutShell';
import { Providers } from '@/components/layout/Providers';
import { Analytics } from '@/components/layout/Analytics';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { E2EMotionKill } from '@/components/E2EMotionKill';
import { LocaleProvider } from '@/contexts/LocaleProvider';
import { SkipLink } from '@/components/layout/SkipLink';

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ko' }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== 'en' && locale !== 'ko') notFound();

  return (
    <LocaleProvider locale={locale}>
      <Providers>
        <E2EMotionKill />
        <Analytics />
        <SkipLink locale={locale} />
        <ErrorBoundary>
          <div className="min-h-screen flex flex-col">
            <Header />
            <div className="flex flex-1">
              <LayoutShell>{children}</LayoutShell>
            </div>
          </div>
        </ErrorBoundary>
      </Providers>
    </LocaleProvider>
  );
}
