import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/share-guard';
import { renderMd } from '@/components/workspace/progressive/shared/renderMd';

// Token rows change independently of deploys; never statically cache.
export const dynamic = 'force-dynamic';

async function fetchLink(token: string) {
  try {
    const { data, error } = await adminClient()
      .from('shared_links')
      .select('title, content, context, view_count, created_at')
      .eq('token', token)
      .maybeSingle();
    if (error) {
      console.error('[d/token] lookup failed:', error.message);
      return null;
    }
    return data as { title: string | null; content: string; context: string | null; view_count: number; created_at: string } | null;
  } catch (error) {
    console.error('[d/token] lookup unavailable:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const row = await fetchLink(token);
  const title = row?.title ? `${row.title} — Argus` : 'Argus';
  // A share link is private-by-URL; keep it out of search indexes.
  return {
    title,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: row?.context === 'review_receipt'
        ? 'AI VERDICT -- NONE'
        : 'Shared Argus decision record',
      images: [{ url: `/d/${token}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: row?.context === 'review_receipt'
        ? 'AI VERDICT -- NONE'
        : 'Shared Argus decision record',
      images: [`/d/${token}/opengraph-image`],
    },
  };
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

        {row.context === 'review_receipt' ? (
          <SharedReceipt title={row.title || 'Judgment Receipt'} content={row.content} />
        ) : (
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
        )}

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

function SharedReceipt({ title, content }: { title: string; content: string }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-5 sm:px-7 py-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
          Judgment Receipt
        </div>
        <h1 className="mt-1 text-[24px] sm:text-[30px] font-bold leading-tight text-[var(--text-primary)]">
          {title}
        </h1>
      </div>
      <div className="px-5 sm:px-7 py-6 space-y-1">
        {renderMd(stripReceiptHeading(content))}
      </div>
      <div className="border-t border-[var(--border-subtle)] px-5 sm:px-7 py-5 bg-[var(--bg)]">
        <div className="font-mono text-[13px] sm:text-[14px] tracking-[0.08em] text-[var(--text-primary)]">
          AI VERDICT -- NONE
        </div>
      </div>
    </article>
  );
}

function stripReceiptHeading(content: string): string {
  const lines = content.split('\n');
  const firstLine = lines[0] || '';
  if (/^#\s+Judgment Receipt\b/i.test(firstLine)) {
    return lines.slice(1).join('\n').replace(/^\n+/, '');
  }
  return content;
}
