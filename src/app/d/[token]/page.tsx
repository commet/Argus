import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/share-guard';
import { renderMd } from '@/components/workspace/progressive/shared/renderMd';

// Token rows change independently of deploys; never statically cache.
export const dynamic = 'force-dynamic';

async function fetchLink(token: string) {
  const { data } = await adminClient()
    .from('shared_links')
    .select('title, content, view_count, created_at')
    .eq('token', token)
    .single();
  return data as { title: string | null; content: string; view_count: number; created_at: string } | null;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const row = await fetchLink(token);
  const title = row?.title ? `${row.title} — Argus` : 'Argus';
  // A share link is private-by-URL; keep it out of search indexes.
  return { title, robots: { index: false, follow: false } };
}

export default async function SharedDeliverablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await fetchLink(token);
  if (!row) notFound();

  // Best-effort view counter (non-blocking, RLS-bypassing service role).
  adminClient()
    .from('shared_links')
    .update({ view_count: (row.view_count ?? 0) + 1 })
    .eq('token', token)
    .then(({ error }) => { if (error) console.error('[d/token] view bump:', error.message); });

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
        {/* Wordmark */}
        <header className="flex items-center justify-between mb-8 pb-5 border-b border-[var(--border-subtle)]">
          <Link href="https://argus.voyage" className="flex items-center gap-2 group">
            <span className="text-[15px] font-bold tracking-tight text-[var(--accent)]">Argus</span>
            <span className="text-[11px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">
              shared decision record
            </span>
          </Link>
        </header>

        {/* Deliverable */}
        <article className="space-y-1">
          {row.title && (
            <h1
              className="text-[26px] sm:text-[30px] font-bold leading-tight tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {row.title}
            </h1>
          )}
          {renderMd(row.content)}
        </article>

        {/* Footer CTA */}
        <footer className="mt-14 pt-6 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--text-tertiary)]">
            Made with <Link href="https://argus.voyage" className="text-[var(--accent)] hover:underline font-medium">Argus</Link> — the decision harness for AI
          </p>
          <Link
            href="https://argus.voyage"
            className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors border border-[var(--border)] rounded-lg px-3 py-1.5"
          >
            Try Argus →
          </Link>
        </footer>
      </div>
    </main>
  );
}
