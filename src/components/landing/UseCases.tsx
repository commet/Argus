'use client';

/**
 * UseCases — the "what people actually bring to Argus" band, placed right under
 * the hero. It mirrors the hero's TWO DOORS (WRITE a decision / UPLOAD a doc):
 * left column = a decision you type, right column = a document you upload. Each
 * door is a CONCRETE worked example, walked step by step, so a first-timer who
 * isn't sure "is this for my decision?" sees exactly how each path goes.
 *
 * Interaction echoes the hero split-field: the two doors live in one plate, and
 * the cursor leans it — hovering one column widens it and softens the other, so
 * the visitor can focus on one path at a time. Steps reveal one line at a time
 * on scroll-in (useScrollReveal), so the process reads as a sequence, not a wall.
 *
 * On-spine: no invented metrics, no logos, no verdict language. Each path hands
 * the call back to the user (WRITE) or anchors flags to the source without
 * ruling (UPLOAD). The single product-level honesty — no engine is perfectly
 * neutral — is disclosed once, quietly, at the foot of the section.
 */

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';

type Step = { titleKo: string; titleEn: string; exKo: string; exEn: string };
type Door = {
  key: 'write' | 'file';
  doorKo: string; doorEn: string;
  seedKo: string; seedEn: string;
  steps: Step[];
};

// Two concrete, parallel worked examples — one universal held decision (the job
// offer) and one written artifact (a strategy memo). Same register as the hero's
// rotating prompts and ON FILE door, so the two surfaces read as one product.
const WRITE_DOOR: Door = {
  key: 'write',
  doorKo: '쓰기 · 결정을 적는다',
  doorEn: 'WRITE · a decision',
  seedKo: '받은 이직 제안, 받아들여도 될까?',
  seedEn: 'Take the job offer I just got?',
  steps: [
    {
      titleKo: '숨은 전제를 짚어요',
      titleEn: 'Names the hidden assumption',
      exKo: '“지금 자리에선 더 배울 게 없다” — 이 결정은 그 전제에 걸려 있어요. 정말 그런가요?',
      exEn: '“There’s nothing left to learn here.” The whole call rests on that. Is it actually true?',
    },
    {
      titleKo: '판단은 당신 몫이에요',
      titleEn: 'You keep the call',
      exKo: '답을 대신 내지 않아요. 당신의 결정과 그 근거를 항로로 남겨요.',
      exEn: 'It won’t decide for you — your call and its reasoning are kept as a course.',
    },
    {
      titleKo: '정산일에 돌아와요',
      titleEn: 'Returns on your date',
      exKo: '정한 날, “그래서 어떻게 됐어요?” 하고 결정을 현실과 대조해요.',
      exEn: 'On the day you set: “so, how did it go?” — the call, checked against what happened.',
    },
  ],
};

const FILE_DOOR: Door = {
  key: 'file',
  doorKo: '올리기 · 문서를 올린다',
  doorEn: 'UPLOAD · a document',
  seedKo: '3분기 전략안.pdf',
  seedEn: 'Q3-strategy-memo.pdf',
  steps: [
    {
      titleKo: '약한 근거를 짚어요',
      titleEn: 'Flags the weak evidence',
      exKo: '“시장은 계속 성장한다”(p.3) — 이 주장은 뒷받침이 비어 있어요.',
      exEn: '“The market keeps growing” (p.3) — nothing behind this claim.',
    },
    {
      titleKo: '책임질 판단을 표시해요',
      titleEn: 'Marks the judgment calls',
      exKo: '이 예산 배분은 사람이 정할 판단이에요. (p.7)',
      exEn: 'This budget split is a human’s call to make. (p.7)',
    },
    {
      titleKo: '고쳐서 다시 올려요',
      titleEn: 'Re-upload the fix',
      exKo: '남은 구멍만 다시 짚어, 문서가 한층 단단해져요.',
      exEn: 'It re-checks only what’s left — and the doc gets sturdier.',
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

  // Reveal the steps one line at a time once the band scrolls into view.
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

      {/* the seed — what the user brings. Typed line reads like the hero input
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

      {/* the process — one numbered step at a time, walking a rail down the page */}
      <div style={{ marginTop: 20, borderLeft: '1px solid var(--bp-ink-faint)', marginLeft: 7, paddingLeft: 20 }}>
        {d.steps.map((s, i) => (
          <div
            key={i}
            className={bk}
            style={{
              position: 'relative',
              paddingBottom: i === d.steps.length - 1 ? 0 : 18,
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity 460ms ease, transform 460ms cubic-bezier(.22,.61,.36,1)',
              transitionDelay: `${140 + i * 150}ms`,
            }}
          >
            {/* node on the rail — a small ink dot with the step numeral beside it */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', left: -25, top: 4, width: 9, height: 9, borderRadius: '50%',
                background: 'var(--bp-paper)', border: '1.5px solid var(--bp-ink-soft)',
              }}
            />
            <div className="flex items-baseline gap-2.5" style={{ marginBottom: 4 }}>
              <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 10.5, letterSpacing: '0.1em', fontWeight: 600 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ color: 'var(--bp-ink)', fontSize: 14.5, fontWeight: 700, lineHeight: 1.4 }}>
                {L(s.titleKo, s.titleEn)}
              </span>
            </div>
            <div style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, lineHeight: 1.6 }}>
              {L(s.exKo, s.exEn)}
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
        <p className={bk} style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(13.5px, 1.5vw, 15px)', lineHeight: 1.65, maxWidth: 620, marginTop: 12 }}>
          {L(
            '적어서 물어도, 이미 쓴 문서를 올려도 — 하는 일은 같아요. 커서를 올려 한쪽씩, 한 단계씩 따라가 보세요.',
            'Type a decision or upload one you’ve written — the work is the same. Hover a side and follow it, step by step.',
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

        {/* One quiet product-level honesty line — the spine's disclosed limit */}
        <p className={bk} style={{ color: 'var(--bp-ink-soft)', fontSize: 12, lineHeight: 1.6, marginTop: 22, opacity: 0.9 }}>
          {L(
            '어느 쪽도 당신의 결정을 대신 내리지 않아요. 다만 희미한 기울기까지 지우진 못해요 — 저희가 아는 한계예요.',
            'Neither door decides for you. No engine is perfectly neutral, though — a limit we own.',
          )}
        </p>
      </div>
    </section>
  );
}
