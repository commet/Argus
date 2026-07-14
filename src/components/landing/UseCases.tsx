'use client';

/**
 * UseCases — the recognition band. Its ONLY job: a first-timer scrolling past the
 * hero should see a decision like their own and think "oh — that's me." It is not
 * a mini product demo (that's the Trail below); it does not re-teach the loop's
 * vocabulary. It makes ONE abstract hero promise — "전제가 바뀌면 다시 알려드립니다"
 * — concrete and *felt*, through real, first-person decisions people lose sleep over.
 *
 * Why the old version was scrapped (founder: "엉망진창 · 너무 어려워 · 공감도 못 해"):
 * it repeated the hero's two-door split right beneath it, then buried it under
 * product-internal jargon (봉인·전제·드러내기·돌아보기 + provenance tags) and a
 * two-column, four-beat animated loop. The reader had to parse ~16 novel blocks
 * to grasp one idea, and it opened on machinery, not on a human moment — so there
 * was nothing to relate TO.
 *
 * The rebuild: three light cards, each a tiny plain-language story with no product
 * vocabulary on first read —
 *   the decision (quoted, in the reader's own voice)
 *   → the one thing it was really counting on ("믿고 간 것")
 *   → … months pass …
 *   → Argus taps back with a QUESTION (the differentiator; the one gold moment).
 * "쓰기"와 "올리기"는 구조 축이 아니라 카드의 출처 칩으로만 남는다 — 히어로가 이미
 * 두 문을 세웠으니 여기서 다시 세우지 않는다.
 *
 * On-spine: the "믿고 간 것" is always concrete/checkable (a manager, a market
 * number, a location) — never a verdict about the user. The tap-back is a bare
 * question ("다시 볼까요?"), never a directional statement. Motion is restrained
 * (founder: "not overdone") — a single scroll-gated fade-up, staggered; no
 * breathing dots, no self-drawing arcs, no flash. The one product-level honesty
 * (no engine is perfectly neutral) is disclosed once, quietly, at the foot.
 */

import { useLocale } from '@/hooks/useLocale';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';

type Origin = 'write' | 'file';
type Case = {
  origin: Origin;
  originKo: string; originEn: string;
  seedKo: string; seedEn: string;
  betKo: string; betEn: string;
  laterKo: string; laterEn: string;
  shiftKo: string; shiftEn: string;
  tapKo: string; tapEn: string;
};

// Three recognizable decisions, spanning a career move, a business plan, and a
// personal leap — so more readers see themselves. Each "bet" is one concrete
// thing reality can later contradict, which is what makes the tap-back real
// rather than decorative. Two are typed, one is an uploaded document, so both
// doors appear without the page organizing itself around them.
const CASES: Case[] = [
  {
    origin: 'write',
    originKo: '적어 둔 결정', originEn: 'a decision you typed',
    seedKo: '받은 이직 제안, 받아들일까?', seedEn: 'Take the job offer I just got?',
    betKo: '나를 뽑아준 그 팀장 밑에서 일하려고 가는 거였다.',
    betEn: 'The whole draw was working under the manager who hired me.',
    laterKo: '넉 달 뒤', laterEn: 'four months later',
    shiftKo: '그 팀장이 조직 개편으로 다른 본부로 옮겼습니다.',
    shiftEn: 'That manager was just moved to another division.',
    tapKo: '가려던 이유가 달라졌어요. 이 결정, 다시 볼까요?',
    tapEn: 'The reason you went just changed — want to look again?',
  },
  {
    origin: 'file',
    originKo: '올린 문서', originEn: 'a document you uploaded',
    seedKo: '신사업 제안서.pdf', seedEn: 'New-business proposal.pdf',
    betKo: '계획 전체가 “이 시장은 앞으로도 매년 커진다”에 기대고 있었다.',
    betEn: 'The whole plan leaned on “this market keeps growing every year.”',
    laterKo: '두 달 뒤', laterEn: 'two months later',
    shiftKo: '그 시장의 성장률이 처음으로 꺾였다는 지표가 나왔습니다.',
    shiftEn: 'An index showed that market’s growth turning down for the first time.',
    tapKo: '계획이 기댄 그 숫자가 흔들려요. 다시 볼까요?',
    tapEn: 'The number your plan rested on just moved — want to look again?',
  },
  {
    origin: 'write',
    originKo: '적어 둔 결정', originEn: 'a decision you typed',
    seedKo: '회사를 그만두고, 이 자리에 가게를 열까?', seedEn: 'Quit my job and open a shop on this street?',
    betKo: '권리금까지 준 건 이 골목에 사람이 계속 몰릴 거라서였다.',
    betEn: 'I paid the premium betting the foot traffic here would hold.',
    laterKo: '다섯 달 뒤', laterEn: 'five months later',
    shiftKo: '바로 앞 대형 오피스가 이전을 발표했습니다.',
    shiftEn: 'The big office right across the street announced it’s relocating.',
    tapKo: '가게를 연 이유였던 그 목이 흔들려요. 다시 볼까요?',
    tapEn: 'The very reason you signed the lease just shifted — want to look again?',
  },
];

const BellIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M8 2.2c-2 0-3.3 1.5-3.3 3.5 0 3-1.2 3.8-1.2 3.8h9s-1.2-.8-1.2-3.8c0-2-1.3-3.5-3.3-3.5Z" stroke="var(--bp-gold-deep)" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M6.7 12.2a1.4 1.4 0 0 0 2.6 0" stroke="var(--bp-gold-deep)" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="17" viewBox="0 0 15 18" fill="none" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}>
    <path d="M1 1.5h8L14 6v10.5H1V1.5Z" stroke="var(--bp-ink-soft)" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M9 1.5V6h5" stroke="var(--bp-ink-soft)" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

export function UseCases() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const bk = locale === 'ko' ? 'break-keep' : '';
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.14 });

  const renderCard = (c: Case, i: number) => (
    <div
      key={i}
      className={`flex flex-col ${bk}`}
      style={{
        flex: '1 1 0', minWidth: 0,
        background: 'var(--bp-paper)',
        borderRadius: 4,
        padding: 'clamp(20px, 2.4vw, 26px)',
        boxShadow: '0 10px 30px -16px rgba(48,34,14,0.20), inset 0 1px 0 rgba(255,255,255,0.4)',
        // Scroll-gated fade-up, staggered card to card. Holds the resolved frame
        // under prefers-reduced-motion (handled in globals.css bp-reveal rules).
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: `opacity 620ms cubic-bezier(.22,.61,.36,1) ${i * 110}ms, transform 620ms cubic-bezier(.22,.61,.36,1) ${i * 110}ms`,
      }}
    >
      {/* origin chip — the quiet "which door", not a structural axis */}
      <div className="flex items-center gap-2" style={{ marginBottom: 13 }}>
        <span aria-hidden="true" style={{ width: 14, height: 1, background: 'var(--bp-ink-soft)', opacity: 0.5 }} />
        <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 10, letterSpacing: locale === 'ko' ? '0.08em' : '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>
          {L(c.originKo, c.originEn)}
        </span>
      </div>

      {/* the decision — quoted in the reader's own voice (or a file chip) */}
      {c.origin === 'write' ? (
        <div className="flex items-start gap-2" style={{ color: 'var(--bp-ink)', fontSize: 'clamp(17px, 1.9vw, 19px)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, lineHeight: 1.4 }}>
          <span className="bp-caret" aria-hidden="true" style={{ height: 20, marginTop: 3 }} />
          <span style={{ flex: 1, minWidth: 0 }}>&ldquo;{L(c.seedKo, c.seedEn)}&rdquo;</span>
        </div>
      ) : (
        <div className="inline-flex items-start gap-2.5" style={{ background: 'var(--bp-paper-deep)', border: '1px solid var(--bp-ink-faint)', borderRadius: 3, padding: '9px 12px', alignSelf: 'flex-start', maxWidth: '100%' }}>
          <FileIcon />
          <span className="bp-mono" style={{ color: 'var(--bp-ink)', fontSize: 13, fontWeight: 500, lineHeight: 1.45 }}>
            {L(c.seedKo, c.seedEn)}
          </span>
        </div>
      )}

      {/* what it was really counting on — the "premise" idea, without the word */}
      <div style={{ marginTop: 18 }}>
        <div className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 10, letterSpacing: locale === 'ko' ? '0.06em' : '0.13em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
          {L('믿고 간 것', 'what it counted on')}
        </div>
        <div style={{ color: 'var(--bp-ink)', fontSize: 14, lineHeight: 1.55, fontWeight: 500 }}>
          {L(c.betKo, c.betEn)}
        </div>
      </div>

      {/* … time passes … */}
      <div className="flex items-center gap-2.5" style={{ marginTop: 18, marginBottom: 12 }}>
        <span aria-hidden="true" style={{ flex: 1, borderTop: '1px dashed var(--bp-ink-faint)' }} />
        <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', opacity: 0.8, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {L(`… ${c.laterKo} …`, `… ${c.laterEn} …`)}
        </span>
        <span aria-hidden="true" style={{ flex: 1, borderTop: '1px dashed var(--bp-ink-faint)' }} />
      </div>

      {/* the tap-back — the one gold moment. A tint block (no border, no left bar),
          the reality shift, then Argus's return as a bare question. Sits at the
          card's foot (mt-auto) so the three tap-backs line up. */}
      <div style={{ marginTop: 'auto' }}>
        <div style={{ color: 'var(--bp-ink-soft)', fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>
          {L(c.shiftKo, c.shiftEn)}
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 9,
            background: 'color-mix(in srgb, var(--bp-gold) 6%, transparent)',
            borderRadius: 8, padding: '12px 14px',
          }}
        >
          <span style={{ marginTop: 1 }}><BellIcon /></span>
          <div style={{ minWidth: 0 }}>
            <div className="bp-mono" style={{ color: 'var(--bp-gold-deep)', fontSize: 9.5, letterSpacing: locale === 'ko' ? '0.06em' : '0.13em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
              {L('Argus가 먼저 돌아옵니다', 'Argus comes back first')}
            </div>
            <div style={{ color: 'var(--bp-ink)', fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
              {L(c.tapKo, c.tapEn)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="bp-root relative overflow-hidden" style={{ background: 'var(--bp-paper-deep)' }}>
      <PaperGrain opacity={0.04} />
      <div className="relative w-full max-w-5xl mx-auto px-6 md:px-10" style={{ paddingTop: 'clamp(44px, 6vh, 84px)', paddingBottom: 'clamp(44px, 6vh, 84px)' }}>
        {/* eyebrow */}
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <span aria-hidden="true" style={{ width: 26, height: 1, background: 'var(--bp-ink-faint)' }} />
          <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: locale === 'ko' ? '0.1em' : '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
            {L('USE CASES · 이런 결정에 씁니다', 'USE CASES · decisions people bring')}
          </span>
        </div>

        {/* heading — lead with the recognizable feeling, not the mechanism */}
        <h2
          className={bk}
          style={{ fontFamily: 'var(--font-display)', color: 'var(--bp-ink)', fontSize: 'clamp(22px, 3.2vw, 32px)', fontWeight: 700, lineHeight: 1.28, letterSpacing: '-0.01em', maxWidth: 680 }}
        >
          {L('정하고 나면, 세상은 말없이 바뀝니다.', 'You decide — then the world quietly moves on.')}
        </h2>
        <p className={bk} style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(13.5px, 1.5vw, 15px)', lineHeight: 1.65, maxWidth: 620, marginTop: 12 }}>
          {L(
            '결정을 받치던 “믿고 간 것” 하나가 흔들리는 순간 — 대개는 아무도 알려주지 않죠. 그때 Argus가 먼저 당신에게 돌아옵니다. 실제로 이런 순간들이에요.',
            'The one thing your decision was counting on shifts — and usually, no one tells you. That’s the moment Argus comes back to you. Real ones:',
          )}
        </p>

        {/* three light cards — a recognition gallery, not a loop diagram */}
        <div ref={ref} className="mt-9 flex flex-col md:flex-row md:items-stretch gap-5">
          {CASES.map(renderCard)}
        </div>

        {/* the loop in one line + the one quiet product-level honesty */}
        <p className={bk} style={{ color: 'var(--bp-ink-soft)', fontSize: 12, lineHeight: 1.6, marginTop: 24, opacity: 0.9, maxWidth: 720 }}>
          {L(
            '무엇을 정하든 같아요 — 결정을 받친 것을 기억해 뒀다가, 그게 흔들리면 당신에게 돌려드립니다. 결정은 늘 당신이 내려요. (저희가 던지는 질문에도 옅은 치우침은 남아요 — 아는 한계고요.)',
            'Whatever you decide, it’s the same — we remember what it stood on, and when that shifts, we hand it back to you. You always make the call. (Even our questions carry a faint lean — a limit we own.)',
          )}
        </p>
      </div>
    </section>
  );
}
