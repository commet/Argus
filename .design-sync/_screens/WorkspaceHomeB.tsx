'use client';
/** Direction B — VOYAGE-FORWARD, reconciled to the SHIPPED page.tsx idle block
 *  (2026-06-25): kept governed copy ("시작", "어떤 상황인가요?", section names),
 *  plate-label headers, gold masthead rule, plotted-route steps, ruled chart-field
 *  input with corner ticks + dashed footer, numbered logbook entries, chart cards.
 *  This is a faithful preview of what the real workspace home now renders. */
import { Button } from '../../src/components/ui/Button';
import { CrewFaces, HEADLINE, PLACEHOLDER, STEPS, RECENT, DEMOS } from './_shared';

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="h-px w-5 shrink-0" style={{ background: 'var(--accent)' }} />
      <span className="text-[10.5px] uppercase tracking-[0.2em] font-bold shrink-0" style={{ color: 'var(--accent)' }}>{children}</span>
      <span className="h-px flex-1" style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }} />
    </div>
  );
}

export function WorkspaceHomeB() {
  return (
    <div className="w-full px-6 md:px-8 py-10" style={{ background: 'var(--bg)', backgroundImage: 'var(--gradient-concert-hall)' }}>
      <div className="max-w-2xl mx-auto">
        {/* masthead: plate eyebrow + headline + gold rule + plotted route */}
        <div className="mb-7">
          <div className="flex items-center gap-2.5 mb-3">
            <CrewFaces size={24} />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] shrink-0" style={{ background: 'var(--gradient-gold-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>AI 의사결정 팀</span>
            <span className="h-px flex-1" style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }} />
          </div>
          <h1 className="text-[23px] md:text-[30px] font-bold leading-[1.3] tracking-[-0.015em] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{HEADLINE}</h1>
          <div className="h-[2px] w-full my-4" style={{ background: 'var(--gradient-gold)', opacity: 0.85 }} />
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11.5px] text-[var(--text-secondary)]">
            {STEPS.map((step, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="tracking-[2px]" style={{ color: 'var(--accent)' }}>· ·›</span>}
                <span className="inline-flex items-center gap-1.5"><span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--accent)' }} />{step}</span>
              </span>
            ))}
          </div>
        </div>

        {/* input — ruled chart field */}
        <div className="mb-10">
          <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1">어떤 상황인가요?</label>
          <p className="text-[12px] text-[var(--text-tertiary)] mb-2.5 leading-relaxed">분야·형식 상관없어요. 떠오르는 대로 편하게 적어주세요 — 나머지는 팀이 정리해요.</p>
          <div className="relative rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border))', boxShadow: 'var(--shadow-md)', backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, color-mix(in srgb, var(--accent) 7%, transparent) 27px, color-mix(in srgb, var(--accent) 7%, transparent) 28px)' }}>
            <div className="absolute top-0 inset-x-0 h-[3px] z-[1]" style={{ background: 'var(--gradient-gold)' }} />
            <span className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 z-[1]" style={{ borderColor: 'var(--accent)' }} />
            <span className="absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 z-[1]" style={{ borderColor: 'var(--accent)' }} />
            <div className="p-4">
              <p className="text-[15px] text-[var(--text-tertiary)] resize-none" style={{ lineHeight: '28px', minHeight: 84 }}>{PLACEHOLDER}</p>
              <div className="flex items-center justify-between gap-3 mt-2 pt-3 px-1" style={{ borderTop: '1px dashed color-mix(in srgb, var(--accent) 28%, transparent)' }}>
                <span className="text-[11px] text-[var(--text-tertiary)]">한 줄만 적어도 시작할 수 있어요</span>
                <Button variant="accent" size="md">시작 ›</Button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-tertiary)]">
            <span>AI 팀 소개</span><span>·</span><span>보고 상대 설정</span><span>·</span><span>팀</span><span>·</span><span>가이드</span>
          </div>
        </div>

        {/* continue — numbered logbook entries */}
        <div className="mb-10">
          <Plate>이어서 작업</Plate>
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {RECENT.map((p, i) => {
              // Sample ETA states (mirrors VoyageEta): due / scheduled countdown / none.
              const eta = i === 0
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-500/15 text-amber-700">지금 정산 · 2개</span>
                : i === 1
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold" style={{ color: 'var(--accent)', background: 'var(--gold-muted)' }}>⚓ 도착 예정 D-3</span>
                : null;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--surface)' }}>
                  <span className="text-[11px] text-[var(--accent)] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[13px] text-[var(--text-primary)] truncate flex-1">{p.name}</span>
                  {eta}
                  <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{p.when}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[11.5px] text-[var(--text-tertiary)]">전체 30개 보기 ▾</p>
        </div>

        {/* scenarios — chart cards */}
        <div>
          <Plate>처음이라면 — 시나리오로 둘러보기</Plate>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEMOS.map((d, i) => (
              <div key={i} className="text-left p-4 rounded-xl border border-[var(--border-subtle)]" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-xs)' }}>
                <div className="h-[2px] w-8 mb-3" style={{ background: 'var(--gradient-gold)' }} />
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[16px]">{d.icon}</span>
                  <span className="text-[13px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{d.title}</span>
                </div>
                <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">&ldquo;{d.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
