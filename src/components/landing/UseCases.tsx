'use client';

/**
 * UseCases — the "what people actually bring to Argus" band, placed right
 * under the hero so a first-timer who isn't sure "is this for my decision?"
 * sees concrete, real held-decisions and the honest thing Argus does with each.
 *
 * On-spine: no invented metrics, no logos, no verdict language. The value is
 * stated as the product's real loop — surface the load-bearing assumption,
 * keep the judgment as a course, return on the settlement date — not as a
 * promise to decide for the user. Blueprint/logbook material, so it reads as
 * more of the same log page, not a generic marketing strip.
 */

import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';

export function UseCases() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  // Real held-decisions (same register as the hero's rotating examples) + the
  // honest, concrete thing Argus does for each. `door` tags which entry it fits.
  const CASES: Array<{ q: string; help: string; door: string }> = [
    {
      q: L('받은 이직 제안, 받아들여도 될까?', 'Take the job offer I just got?'),
      // Spine rule 4 (rounds 5–8): never sell the absolute "it never decides
      // for you" claim — hand the call back and own the faint-lean limit.
      // The single product-level disclosure lives in the guide FAQ.
      help: L('결정이 걸린 숨은 전제 하나를 짚어, 판단을 당신에게 돌려드려요. 희미한 기울기까지 지우진 못해요 — 저희가 아는 한계예요.', 'It surfaces the one hidden assumption the call rests on, then hands the call back to you. No engine is perfectly neutral — a limit we own.'),
      door: L('쓰기', 'write'),
    },
    {
      q: L('이 기능, 이번 분기에 낼까 더 다듬을까?', 'Ship this quarter, or polish it more?'),
      help: L('AI 크루가 의견이 갈리는 자리를 보여주고, 조타는 당신 몫으로 남겨요.', 'An AI crew shows you exactly where it forks — you keep the helm.'),
      door: L('쓰기', 'write'),
    },
    {
      q: L('이미 써둔 전략안·기획안, 구멍 없을까?', 'Is there a hole in the strategy memo I already wrote?'),
      help: L('문서를 올리면 근거 약한 주장과 책임질 판단을 원문 위치까지 짚어줘요.', 'Upload the doc — weak claims and judgment calls get flagged, anchored to the source line.'),
      door: L('올리기', 'file'),
    },
    {
      q: L('이 결정, 상사에게 어떻게 받아들여질까?', 'How will my boss react to this call?'),
      help: L('보고 전에 이해관계자 반응을 리허설해, 약한 고리를 미리 만나요.', 'Rehearse the stakeholder reaction before you present, and meet the weak links early.'),
      door: L('쓰기', 'write'),
    },
  ];

  // The product's real loop, stated as three honest benefits (not verdicts).
  const LOOP: Array<{ n: string; title: string; body: string }> = [
    {
      n: '01',
      title: L('전제를 짚어요', 'Names the assumption'),
      body: L('결정이 무엇에 걸려 있는지 — 그 한 자리를 질문으로 되돌려줘요.', 'It hands back the one load-bearing question your decision turns on.'),
    },
    {
      n: '02',
      title: L('항로로 남겨요', 'Keeps it as a course'),
      body: L('결정과 그 근거가 항해일지에 남아, 다음 결정의 자산이 돼요.', 'The call and its reasoning stay in the logbook — an asset for the next decision.'),
    },
    {
      n: '03',
      title: L('정산일에 돌아와요', 'Returns to settle'),
      body: L('당신이 정한 날, 결정을 현실과 대조해 확인해요.', 'On the date you set, it checks the call against what actually happened.'),
    },
  ];

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
          className={locale === 'ko' ? 'break-keep' : ''}
          style={{ fontFamily: 'var(--font-display)', color: 'var(--bp-ink)', fontSize: 'clamp(22px, 3.2vw, 32px)', fontWeight: 700, lineHeight: 1.28, letterSpacing: '-0.01em', maxWidth: 640 }}
        >
          {L('복잡한 결정일수록, 갈리는 자리부터.', 'The harder the call, the more it turns on one thing.')}
        </h2>

        {/* Case slips — concrete held-decisions + the honest help line */}
        <div className="grid sm:grid-cols-2 gap-3.5" style={{ marginTop: 28 }}>
          {CASES.map((c, i) => (
            <div
              key={i}
              className={`relative ${locale === 'ko' ? 'break-keep' : ''}`}
              style={{
                background: 'var(--bp-paper)',
                borderRadius: 4,
                padding: '18px 20px',
                boxShadow: '0 6px 20px -12px rgba(48,34,14,0.18), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              <div className="flex items-center justify-between gap-3" style={{ marginBottom: 9 }}>
                <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500 }}>
                  § {String(i + 1).padStart(2, '0')}
                </span>
                <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, opacity: 0.85 }}>
                  {c.door}
                </span>
              </div>
              <div style={{ color: 'var(--bp-ink)', fontSize: 15.5, fontWeight: 600, lineHeight: 1.4 }}>
                &ldquo;{c.q}&rdquo;
              </div>
              <div style={{ color: 'var(--bp-ink-soft)', fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
                {c.help}
              </div>
            </div>
          ))}
        </div>

        {/* The loop — three honest benefits, ink numerals, no gold, no verdict */}
        <div className="grid sm:grid-cols-3 gap-x-8 gap-y-6" style={{ marginTop: 40, borderTop: '1px solid var(--bp-ink-faint)', paddingTop: 30 }}>
          {LOOP.map((s) => (
            <div key={s.n} className={locale === 'ko' ? 'break-keep' : ''}>
              <div className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 12, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>
                {s.n}
              </div>
              <div style={{ color: 'var(--bp-ink)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 5 }}>
                {s.title}
              </div>
              <div style={{ color: 'var(--bp-ink-soft)', fontSize: 13, lineHeight: 1.6 }}>
                {s.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
