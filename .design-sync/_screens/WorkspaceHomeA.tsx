'use client';
/** Direction A — REFINED: disciplined cleanup. Crew anchor + gold kicker,
 *  elevated gold-topped input as the hero, gold-tick sections, card containment.
 *  High contrast, system-consistent, ships as-is. */
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { CrewFaces, HEADLINE, PLACEHOLDER, STEPS, RECENT, DEMOS } from './_shared';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="h-3.5 w-[3px] rounded-full" style={{ background: 'var(--gradient-gold)' }} />
      <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.12em] font-semibold">{children}</p>
    </div>
  );
}

export function WorkspaceHomeA() {
  return (
    <div className="w-full px-6 md:px-8 py-10" style={{ background: 'var(--bg)', backgroundImage: 'var(--gradient-concert-hall)' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-3.5">
            <CrewFaces />
            <Badge variant="gold">AI 의사결정 팀</Badge>
          </div>
          <h1 className="text-[22px] md:text-[28px] font-bold leading-[1.32] tracking-[-0.01em] text-[var(--text-primary)] mb-3.5" style={{ fontFamily: 'var(--font-display)' }}>
            {HEADLINE}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11.5px] text-[var(--text-secondary)]">
            {STEPS.map((step, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-[var(--text-tertiary)]/60">›</span>}
                <span className="w-[18px] h-[18px] rounded-full text-white flex items-center justify-center font-bold text-[10px]" style={{ background: 'var(--gradient-gold)', boxShadow: 'var(--shadow-xs)' }}>{i + 1}</span>
                {step}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1">어떤 상황인가요?</label>
          <p className="text-[12px] text-[var(--text-tertiary)] mb-2.5 leading-relaxed">분야·형식 상관없어요. 떠오르는 대로 편하게 적어주세요 — 나머지는 팀이 정리해요.</p>
          <Card variant="elevated" className="!p-0 overflow-hidden">
            <div className="p-4">
              <p className="text-[15px] text-[var(--text-tertiary)] leading-[1.65] min-h-[66px]">{PLACEHOLDER}</p>
              <div className="flex items-center justify-between gap-3 mt-2">
                <span className="text-[11px] text-[var(--text-tertiary)]">한 줄만 적어도 시작할 수 있어요</span>
                <Button variant="accent" size="md">시작 ›</Button>
              </div>
            </div>
          </Card>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-tertiary)]">
            <span>AI 팀 소개</span><span>·</span><span>보고 상대 설정</span><span>·</span><span>팀</span><span>·</span><span>가이드</span>
          </div>
        </div>

        <div className="mb-10">
          <SectionLabel>이어서 작업</SectionLabel>
          <div className="space-y-1.5">
            {RECENT.map((p, i) => (
              <Card key={i} variant="default" hoverable className="!p-0">
                <div className="flex items-center gap-2.5 px-3.5 py-3">
                  <span className="text-[var(--accent)] text-[13px]">▸</span>
                  <span className="text-[13px] text-[var(--text-primary)] truncate flex-1">{p.name}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>{p.when}</span>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-2 px-1 text-[11.5px] text-[var(--text-tertiary)]">전체 30개 보기 ▾</p>
        </div>

        <div>
          <SectionLabel>처음이라면 — 시나리오로 둘러보기</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEMOS.map((d, i) => (
              <Card key={i} variant="default" hoverable>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[16px]">{d.icon}</span>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{d.title}</span>
                </div>
                <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">&ldquo;{d.quote}&rdquo;</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
