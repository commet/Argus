'use client';
/** Direction C — INPUT-FOCUSED: radical focus. Above the fold is ONE thing —
 *  a big confident input with a tight crew+headline above it. Everything else
 *  (continue, scenarios) is demoted below a divider, smaller and quieter.
 *  Maximum "just type here" clarity; generous whitespace. */
import { Button } from '../../src/components/ui/Button';
import { CrewFaces, HEADLINE, PLACEHOLDER, RECENT, DEMOS } from './_shared';

export function WorkspaceHomeC() {
  return (
    <div className="w-full px-6 md:px-8 py-14" style={{ background: 'var(--bg)', backgroundImage: 'var(--gradient-concert-hall)' }}>
      <div className="max-w-xl mx-auto">
        {/* tight hero */}
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <CrewFaces size={26} />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ background: 'var(--gradient-gold-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>AI 의사결정 팀</span>
        </div>
        <h1 className="text-center text-[26px] md:text-[32px] font-bold leading-[1.3] tracking-[-0.02em] text-[var(--text-primary)] mb-7 max-w-lg mx-auto" style={{ fontFamily: 'var(--font-display)' }}>
          {HEADLINE}
        </h1>

        {/* THE input — big, the single thing to do */}
        <div
          className="rounded-2xl border-2 overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))', boxShadow: 'var(--shadow-xl)' }}
        >
          <div className="h-[3px] w-full" style={{ background: 'var(--gradient-gold)' }} />
          <div className="p-5">
            <p className="text-[17px] text-[var(--text-tertiary)] leading-[1.7] min-h-[92px]">{PLACEHOLDER}</p>
            <div className="flex items-center justify-between gap-3 mt-3">
              <span className="text-[12px] text-[var(--text-tertiary)]">한 줄만 적어도 시작할 수 있어요</span>
              <Button variant="accent" size="lg">시작하기 ›</Button>
            </div>
          </div>
        </div>
        <p className="text-center text-[12px] text-[var(--text-tertiary)] mt-4">
          상황을 적으면 · AI 팀이 갈리는 자리를 보여드리고 · 결론 한 장이 남아요
        </p>

        {/* quiet divider — everything below is secondary */}
        <div className="flex items-center gap-3 mt-14 mb-6">
          <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] font-semibold">이어서 · 둘러보기</span>
          <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
        </div>

        {/* continue — compact muted rows */}
        <div className="space-y-0.5 mb-7">
          {RECENT.map((p, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
              <span className="text-[var(--text-tertiary)] text-[12px]">▸</span>
              <span className="text-[12.5px] truncate flex-1">{p.name}</span>
              <span className="text-[11px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-mono)' }}>{p.when}</span>
            </div>
          ))}
          <p className="px-2.5 pt-1 text-[11px] text-[var(--text-tertiary)]">전체 30개 보기 ▾</p>
        </div>

        {/* scenarios — small quiet chips */}
        <div className="flex flex-wrap gap-2">
          {DEMOS.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <span>{d.icon}</span>{d.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
