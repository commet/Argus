'use client';

/**
 * UseCases — the "what people actually bring to Argus" band, placed right under
 * the hero. It mirrors the hero's TWO DOORS (WRITE a decision / UPLOAD a doc):
 * left column = a decision you type, right column = a document you upload.
 *
 * Each door is NOT a generic "step 1 / step 2" list — it walks Argus's REAL
 * stages (the same names the product uses live: 진짜 질문 · AI가 채운 전제 ·
 * 갈리는 지점 · 봉인·정산 for a decision; 주장 지도 · 근거 약한 주장 · 책임질 판단
 * for a document) and, at each stage, shows the CONCRETE output that this
 * specific question produces. So a first-timer sees the product actually
 * running on one real case, not a marketing checklist. Both doors converge on
 * the same last stage — 봉인·정산 — which is the whole product thesis.
 *
 * Interaction echoes the hero split-field: the cursor leans the plate (hovered
 * door widens, the other softens), and the stages reveal one at a time on
 * scroll-in, so the run reads as a sequence.
 *
 * On-spine: no invented metrics, no logos, no verdict language. The decision
 * door hands the call back; the document door anchors flags to the source
 * without ruling. The one product-level honesty — no engine is perfectly
 * neutral — is disclosed once, quietly, at the foot.
 */

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';

// A real Argus stage + the concrete thing it produces for THIS example.
type Stage = { labelKo: string; labelEn: string; outKo: string; outEn: string; seal?: boolean };
type Door = {
  key: 'write' | 'file';
  doorKo: string; doorEn: string;
  seedKo: string; seedEn: string;
  stages: Stage[];
};

// One universal held decision, walked through the real decision flow. The stage
// labels are the product's own (StreamSnippet "진짜 질문", MirrorBeat "AI가 채운
// 전제", LeadSynthesis "이 결정이 갈리는 지점", the seal→settle spine).
const WRITE_DOOR: Door = {
  key: 'write',
  doorKo: '쓰기 · 결정을 적는다',
  doorEn: 'WRITE · a decision',
  seedKo: '받은 이직 제안, 받아들일까?',
  seedEn: 'Take the job offer I just got?',
  stages: [
    {
      labelKo: '진짜 질문',
      labelEn: 'The real question',
      outKo: '“이직할까?”가 아니라 — 지금 도망치고 싶은 건지, 정말 가고 싶은 건지가 먼저예요.',
      outEn: 'Not “should I leave?” — first: am I running from here, or actually going somewhere?',
    },
    {
      labelKo: 'AI가 채운 전제',
      labelEn: 'A premise the AI filled in',
      outKo: 'AI는 “지금 회사엔 미래가 없다”를 깔고 답했어요. 당신은 그런 말 한 적 없죠 — 맞아요?',
      outEn: 'The AI answered as if “there’s no future here.” You never said that — is it true?',
    },
    {
      labelKo: '갈리는 지점',
      labelEn: 'Where it turns',
      outKo: '연봉도 직함도 아니라 — “3년 뒤 나는 어떤 사람이 돼 있을까” 한 축에서 갈려요.',
      outEn: 'Not the pay or the title — it turns on one axis: who am I three years from now?',
    },
    {
      labelKo: '봉인 · 정산',
      labelEn: 'Seal, then settle',
      outKo: '지금의 선택과 이유를 봉인해요. 석 달 뒤 — “그래서, 어떻게 됐어요?”',
      outEn: 'Seal your call and your reasons. Three months on — “so, how did it go?”',
      seal: true,
    },
  ],
};

// A written artifact, walked through the real review pipeline. Labels match the
// product: claims + dependency map, weak-evidence flags anchored to the source
// line, the judgment calls a human must own — converging on the same seal→settle.
const FILE_DOOR: Door = {
  key: 'file',
  doorKo: '올리기 · 문서를 올린다',
  doorEn: 'UPLOAD · a document',
  seedKo: 'AI랑 정리한 신사업 제안서.pdf',
  seedEn: 'New-business proposal (drafted with AI).pdf',
  stages: [
    {
      labelKo: '주장 지도',
      labelEn: 'Claim map',
      outKo: '제안서가 기댄 핵심 주장들을 뽑아, 무엇이 무엇에 얹혀 있는지 한눈에 그려요.',
      outEn: 'Pulls the claims the proposal leans on and maps what rests on what.',
    },
    {
      labelKo: '근거 약한 주장',
      labelEn: 'Weak evidence',
      outKo: '“시장은 계속 커진다”(3쪽) — 근거 칸이 비어 있어요. AI가 매끄럽게 지나간 자리죠.',
      outEn: '“The market keeps growing” (p.3) — the evidence box is empty. A gap the AI smoothed over.',
    },
    {
      labelKo: '책임질 판단',
      labelEn: 'A human’s call',
      outKo: '예산을 어디에 몰지는 AI가 아니라 당신이 책임질 판단이에요. (7쪽)',
      outEn: 'Where to concentrate the budget is your call to own, not the AI’s. (p.7)',
    },
    {
      labelKo: '봉인 · 정산',
      labelEn: 'Seal, then settle',
      outKo: '고친 제안서를 봉인하고, 정한 날 현실과 대조해요.',
      outEn: 'Seal the fixed proposal, and check it against reality on your date.',
      seal: true,
    },
  ],
};

export function UseCases() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const bk = locale === 'ko' ? 'break-keep' : '';

  // Which door the cursor is leaning into. Drives the A/B widen (same grammar as
  // the hero split-field): the hovered door grows and stays crisp, the other
  // narrows and softens, so the reader focuses on one path at a time.
  const [hoverSide, setHoverSide] = useState<'write' | 'file' | null>(null);
  const writeGrow = hoverSide === 'file' ? 0.74 : hoverSide === 'write' ? 1.3 : 1;
  const fileGrow = hoverSide === 'file' ? 1.3 : hoverSide === 'write' ? 0.74 : 1;

  // Reveal the stages one at a time once the band scrolls into view.
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.18 });

  const renderDoor = (d: Door, grow: number, dimmed: boolean) => (
    <div
      onMouseEnter={() => setHoverSide(d.key)}
      onMouseLeave={() => setHoverSide(null)}
      className="relative text-left"
      style={{
        flexGrow: grow, flexShrink: 1, flexBasis: 0, minWidth: 0,
        padding: '20px 22px 22px',
        opacity: dimmed ? 0.55 : 1,
        transition: 'flex-grow 380ms cubic-bezier(.22,.61,.36,1), opacity 300ms ease',
      }}
    >
      {/* door label — same mono register as the hero's two doors */}
      <div className="flex items-center gap-2" style={{ marginBottom: 13 }}>
        <span aria-hidden="true" style={{ width: 16, height: 1, background: 'var(--bp-ink-soft)', opacity: 0.55 }} />
        <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: locale === 'ko' ? '0.1em' : '0.2em', textTransform: 'uppercase', fontWeight: 500 }}>
          {L(d.doorKo, d.doorEn)}
        </span>
      </div>

      {/* the seed — what the user brings. A typed line reads like the hero input
          (caret + italic + baseline rule); a document reads as a file chip. */}
      {d.key === 'write' ? (
        <div>
          <div className={`flex items-start gap-2 ${bk}`} style={{ color: 'var(--bp-ink)', fontSize: 16, fontWeight: 600, fontStyle: 'italic', lineHeight: 1.5 }}>
            <span className="bp-caret" aria-hidden="true" style={{ height: 19, marginTop: 3 }} />
            <span style={{ flex: 1, minWidth: 0 }}>&ldquo;{L(d.seedKo, d.seedEn)}&rdquo;</span>
          </div>
          <div aria-hidden="true" style={{ height: 1.5, background: 'var(--bp-ink-soft)', opacity: 0.45, marginTop: 8 }} />
        </div>
      ) : (
        <div
          className="inline-flex items-center gap-2.5"
          style={{ background: 'var(--bp-paper-deep)', border: '1px solid var(--bp-ink-faint)', borderRadius: 3, padding: '8px 12px', maxWidth: '100%' }}
        >
          <svg width="15" height="18" viewBox="0 0 15 18" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
            <path d="M1 1.5h8L14 6v10.5H1V1.5Z" stroke="var(--bp-ink-soft)" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M9 1.5V6h5" stroke="var(--bp-ink-soft)" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span className="bp-mono" style={{ color: 'var(--bp-ink)', fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {L(d.seedKo, d.seedEn)}
          </span>
        </div>
      )}

      {/* down the rail: each REAL Argus stage, and the concrete line it produces
          for this exact question — the product actually running, one beat at a
          time (not an abstract numbered checklist). */}
      <div style={{ marginTop: 18, borderLeft: '1px solid var(--bp-ink-faint)', marginLeft: 7, paddingLeft: 20 }}>
        {d.stages.map((s, i) => (
          <div
            key={i}
            className={bk}
            style={{
              position: 'relative',
              paddingBottom: i === d.stages.length - 1 ? 0 : 17,
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity 460ms ease, transform 460ms cubic-bezier(.22,.61,.36,1)',
              transitionDelay: `${140 + i * 150}ms`,
            }}
          >
            {/* node on the rail — the seal beat gets the gold node, since that is
                where both doors converge (and where the product spends gold). */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', left: -25, top: 3, width: 9, height: 9, borderRadius: '50%',
                background: s.seal ? 'var(--bp-gold)' : 'var(--bp-paper)',
                border: s.seal ? '1.5px solid var(--bp-gold)' : '1.5px solid var(--bp-ink-soft)',
              }}
            />
            {/* the real stage name — leads the beat (no bare numerals) */}
            <div
              className="bp-mono"
              style={{
                color: s.seal ? 'var(--bp-gold-deep)' : 'var(--bp-ink-soft)',
                fontSize: 10.5, letterSpacing: locale === 'ko' ? '0.06em' : '0.14em',
                textTransform: 'uppercase', fontWeight: 700, marginBottom: 4,
              }}
            >
              {L(s.labelKo, s.labelEn)}
            </div>
            {/* the concrete output this specific question produces at that stage */}
            <div style={{ color: 'var(--bp-ink)', fontSize: 13.5, lineHeight: 1.55 }}>
              {L(s.outKo, s.outEn)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="bp-root relative overflow-hidden" style={{ background: 'var(--bp-paper-deep)' }}>
      <PaperGrain opacity={0.04} />
      <div className="relative w-full max-w-5xl mx-auto px-6 md:px-10" style={{ paddingTop: 'clamp(44px, 6vh, 84px)', paddingBottom: 'clamp(44px, 6vh, 84px)' }}>
        {/* Eyebrow + heading */}
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <span aria-hidden="true" style={{ width: 26, height: 1, background: 'var(--bp-ink-faint)' }} />
          <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: locale === 'ko' ? '0.1em' : '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
            {L('USE CASES · 이런 결정에 씁니다', 'USE CASES · what people bring')}
          </span>
        </div>
        <h2
          className={bk}
          style={{ fontFamily: 'var(--font-display)', color: 'var(--bp-ink)', fontSize: 'clamp(22px, 3.2vw, 32px)', fontWeight: 700, lineHeight: 1.28, letterSpacing: '-0.01em', maxWidth: 640 }}
        >
          {L('복잡한 결정일수록, 갈리는 자리부터.', 'The harder the call, the more it turns on one thing.')}
        </h2>
        <p className={bk} style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(13.5px, 1.5vw, 15px)', lineHeight: 1.65, maxWidth: 640, marginTop: 12 }}>
          {locale === 'ko' ? (
            <>적어서 묻든, 써 둔 문서를 올리든 — 거치는 길은 같아요. 한쪽에 커서를 올려, <span style={{ whiteSpace: 'nowrap' }}>한 사례가 실제로 어떻게 흘러가는지</span> 따라가 보세요.</>
          ) : (
            'Type a decision or upload one you’ve written — the stages are the same. Hover a side and watch one real case move through them.'
          )}
        </p>

        {/* Two doors in one plate — the divider glides as the cursor leans in */}
        <div ref={ref} className="mt-8 flex flex-col sm:flex-row sm:items-stretch" style={{
          background: 'var(--bp-paper)',
          borderRadius: 4,
          boxShadow: '0 10px 30px -14px rgba(48,34,14,0.22), inset 0 1px 0 rgba(255,255,255,0.4)',
          overflow: 'hidden',
        }}>
          {renderDoor(WRITE_DOOR, writeGrow, hoverSide === 'file')}

          {/* divider — hairline + "또는 / or" chip on desktop, a row on mobile */}
          <div aria-hidden="true" className="hidden sm:flex" style={{ position: 'relative', flex: 'none', width: 1, background: 'var(--bp-ink-faint)', alignItems: 'center', justifyContent: 'center' }}>
            <span className="bp-mono" style={{ position: 'absolute', background: 'var(--bp-paper)', padding: '4px 0', color: 'var(--bp-ink-soft)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, writingMode: 'vertical-rl' }}>
              {L('또는', 'or')}
            </span>
          </div>
          <div aria-hidden="true" className="flex sm:hidden items-center gap-3" style={{ padding: '0 22px' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--bp-ink-faint)' }} />
            <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>{L('또는', 'or')}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--bp-ink-faint)' }} />
          </div>

          {renderDoor(FILE_DOOR, fileGrow, hoverSide === 'write')}
        </div>

        {/* Convergence + the one quiet product-level honesty (the disclosed limit) */}
        <p className={bk} style={{ color: 'var(--bp-ink-soft)', fontSize: 12, lineHeight: 1.6, marginTop: 22, opacity: 0.9 }}>
          {L(
            '두 길은 결국 한 곳에서 만나요 — 봉인하고, 정한 날 다시 꺼내 정산하기. 결정은 늘 당신이 내려요. (저희가 던지는 질문에도 옅은 치우침은 남아요 — 아는 한계고요.)',
            'Both paths meet in the same place — seal it, then reopen it on your date to settle up. You always make the call. (Even our questions carry a faint lean — a limit we own.)',
          )}
        </p>
      </div>
    </section>
  );
}
