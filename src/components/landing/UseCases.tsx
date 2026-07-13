'use client';

/**
 * UseCases — "what people bring to Argus," built around the ONE loop the product
 * runs: seal the premises a decision rests on → surface the ones you (or the AI)
 * slid past → and when a sealed premise is shaken by reality, it comes BACK to
 * you, at that moment, to re-decide. Two doors (write a decision / upload a
 * document) run the exact same loop.
 *
 * The walkthrough is deliberately LOOP-shaped, not a linear checklist:
 *   ① 봉인    — the tentative call + 2 concrete, checkable premises it stands on
 *   ② 드러내기 — a premise the AI slipped in (or the weak-evidence flag), pulled out
 *   … 넉 달 뒤 … — a time gap
 *   ③ 돌아보기 — an ALERT: a premise broke in the real world; it loops back to the
 *              exact premise (which flashes), so the return is something you SEE.
 *
 * Motion is restrained (founder note: "not overdone"): the tracked-premise dots
 * breathe while in view; on the alert the return-arc draws itself in once and the
 * referenced premise flashes gold once. All of it is gated on scroll-in and off
 * under prefers-reduced-motion.
 *
 * On-spine: premises are concrete/checkable (a hiring manager reassigned, a market
 * index turning) — never a verdict about the user. The one product-level honesty
 * (no engine is perfectly neutral) is disclosed once, quietly, at the foot.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocale } from '@/hooks/useLocale';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';

type Premise = { ko: string; en: string; tagKo: string; tagEn: string };
type Door = {
  key: 'write' | 'file';
  doorKo: string; doorEn: string;
  seedKo: string; seedEn: string;
  sealLeadKo: string; sealLeadEn: string;
  premises: Premise[];
  surfaceKo: string; surfaceEn: string;
  surfaceTagKo: string; surfaceTagEn: string;
  laterKo: string; laterEn: string;
  alertKo: string; alertEn: string;
};

// A decision you type. Two premises the call rests on — both concrete enough that
// reality can later contradict them (the hiring manager, the project's funding),
// which is what makes the return alert real rather than decorative.
const WRITE_DOOR: Door = {
  key: 'write',
  doorKo: '쓰기 · 결정을 적는다', doorEn: 'WRITE · a decision',
  seedKo: '받은 이직 제안, 받아들일까?', seedEn: 'Take the job offer I just got?',
  sealLeadKo: '“옮기는 쪽으로 기울었습니다.” 이 판단이 기대는 전제부터 기록합니다.',
  sealLeadEn: '“Leaning toward taking it.” First, seal the premises it stands on.',
  premises: [
    {
      ko: '옮길 회사에서, 나를 뽑아준 그 팀장 밑에서 일한다',
      en: 'At the new company, I’ll work under the manager who hired me',
      tagKo: '오퍼의 진짜 이유 · 아직 미확인', tagEn: 'the real draw of the offer · unverified',
    },
    {
      ko: '그 팀이 맡은 신규 프로젝트가 내년에도 이어진다',
      en: 'That team’s new project keeps its funding into next year',
      tagKo: '내가 가려는 이유 · 아직 미확인', tagEn: 'why I’d go · unverified',
    },
  ],
  surfaceKo: '“지금이 아니면 이런 기회는 다시 없다” — 사용자가 말하지 않았지만 AI가 추가한 전제입니다.',
  surfaceEn: '“It’s now or never” — a premise the AI slipped in. You never said that.',
  surfaceTagKo: 'AI가 깐 전제', surfaceTagEn: 'surfaced from the AI',
  laterKo: '넉 달 뒤', laterEn: 'four months later',
  alertKo: '이직한 회사에서 채용을 결정한 팀장이 조직 개편으로 다른 본부로 이동했습니다. 그 사람과 일한다는 전제가 달라졌습니다. 결정을 다시 확인하시겠습니까?',
  alertEn: 'At your new company, the manager who hired you was just moved to another division. Your call rested on working under them — want to revisit it?',
};

// A document you upload. Same loop: pull the premises the proposal stands on, seal
// them to a watch-list, and ping you when one is contradicted by a real indicator.
const FILE_DOOR: Door = {
  key: 'file',
  doorKo: '올리기 · 문서를 올린다', doorEn: 'UPLOAD · a document',
  seedKo: 'AI랑 정리한 신사업 제안서.pdf', seedEn: 'New-business proposal (drafted with AI).pdf',
  sealLeadKo: '제안서가 기대는 전제를 찾아 추적 목록에 기록합니다.',
  sealLeadEn: 'Pull the premises the proposal stands on, and seal them to a watch-list.',
  premises: [
    {
      ko: '이 시장은 앞으로도 매년 커진다',
      en: 'This market keeps growing every year',
      tagKo: '제안서의 대전제 · 근거 칸은 비어 있음', tagEn: 'the keystone claim · evidence box empty',
    },
    {
      ko: '핵심 고객사가 내년 예산을 늘린다',
      en: 'The anchor client raises its budget next year',
      tagKo: '매출 계획이 기댄 가정 · 아직 미확인', tagEn: 'the revenue plan leans on it · unverified',
    },
  ],
  surfaceKo: '예산을 어디에 집중할지는 AI가 아니라 사람이 판단해야 합니다. 원문 7쪽에 표시합니다.',
  surfaceEn: 'Where to concentrate the budget is your call to own, not the AI’s — flagged on p.7.',
  surfaceTagKo: '사람이 판단할 대목', surfaceTagEn: 'a human’s call',
  laterKo: '두 달 뒤', laterEn: 'two months later',
  alertKo: '해당 시장의 올해 성장률이 처음으로 하락했다는 업계 지표가 발표됐습니다. 이 수치에 기대어 세운 계획을 다시 확인하시겠습니까?',
  alertEn: 'An industry index just showed that market’s growth turning down for the first time. The plan was built on that number — want to revisit it?',
};

// Reveal timing (seconds) — one beat after another, with the alert's return
// gestures (arc draw + premise flash) landing just after the alert card arrives.
const T_SEAL = 0.14;
const T_SURFACE = 0.52;
const T_GAP = 0.68;
const T_ALERT = 0.84;
const T_RETURN = 1.08;

export function UseCases() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const bk = locale === 'ko' ? 'break-keep' : '';
  const rm = !!useReducedMotion();

  // Which door the cursor is leaning into. Drives the A/B widen (same grammar as
  // the hero split-field): the hovered door grows and stays crisp, the other
  // narrows and softens, so the reader focuses on one path at a time.
  const [hoverSide, setHoverSide] = useState<'write' | 'file' | null>(null);
  const writeGrow = hoverSide === 'file' ? 0.74 : hoverSide === 'write' ? 1.3 : 1;
  const fileGrow = hoverSide === 'file' ? 1.3 : hoverSide === 'write' ? 0.74 : 1;

  // Reveal once the band scrolls into view; drives every entrance + the loop motion.
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.18 });
  const on = isVisible && !rm; // motion allowed

  // A beat that rises into place on scroll-in.
  const Beat = ({ delay, children }: { delay: number; children: React.ReactNode }) => (
    <motion.div
      className={bk}
      style={{ position: 'relative', paddingBottom: 16 }}
      initial={rm ? false : { opacity: 0, y: 7 }}
      animate={rm ? { opacity: 1, y: 0 } : isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 7 }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );

  // Rail node — the beat marker. Alert node is the one gold moment (loop payoff).
  const Node = ({ kind }: { kind: 'plain' | 'alert' }) => (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', left: -27, top: 2, width: 10, height: 10, borderRadius: '50%',
        background: kind === 'alert' ? 'var(--bp-gold)' : 'var(--bp-paper)',
        border: kind === 'alert' ? '1.5px solid var(--bp-gold)' : '1.5px solid var(--bp-ink-soft)',
        boxShadow: kind === 'alert' ? '0 0 0 4px color-mix(in srgb, var(--bp-gold) 16%, transparent)' : 'none',
      }}
    />
  );

  const BeatLabel = ({ ko, en, accent }: { ko: string; en: string; accent?: boolean }) => (
    <div
      className="bp-mono"
      style={{
        color: accent ? 'var(--bp-gold-deep)' : 'var(--bp-ink-soft)',
        fontSize: 10.5, letterSpacing: locale === 'ko' ? '0.06em' : '0.14em',
        textTransform: 'uppercase', fontWeight: 700, marginBottom: 6,
      }}
    >
      {L(ko, en)}
    </div>
  );

  // The tracked-premise row: a hollow "watch dot" that breathes while in view, the
  // premise text, and a quiet provenance tag. The first premise is the one the
  // later alert loops back to, so it can flash.
  const PremiseRow = ({ p, index, flash }: { p: Premise; index: number; flash: boolean }) => (
    <div style={{ position: 'relative', marginTop: index === 0 ? 12 : 9 }}>
      {flash && !rm && (
        <motion.span
          aria-hidden="true"
          style={{ position: 'absolute', inset: '-5px -9px', borderRadius: 7, background: 'color-mix(in srgb, var(--bp-gold) 20%, transparent)', zIndex: 0, pointerEvents: 'none' }}
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: [0, 1, 0] } : { opacity: 0 }}
          transition={{ delay: T_RETURN + 0.1, duration: 1.5, times: [0, 0.22, 1], ease: 'easeInOut' }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <motion.span
          aria-hidden="true"
          style={{ flex: 'none', marginTop: 4, width: 7, height: 7, borderRadius: '50%', border: '1.5px solid var(--bp-ink-soft)' }}
          animate={on ? { opacity: [0.4, 1, 0.4], scale: [1, 1.18, 1] } : { opacity: 0.7, scale: 1 }}
          transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut', delay: index * 0.35 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--bp-ink)', fontSize: 13.5, lineHeight: 1.5, fontWeight: 500 }}>
            {L(p.ko, p.en)}
          </div>
          <div style={{ color: 'var(--bp-ink-soft)', fontSize: 11, lineHeight: 1.4, marginTop: 2, fontStyle: 'italic', opacity: 0.9 }}>
            {L(p.tagKo, p.tagEn)}
          </div>
        </div>
      </div>
    </div>
  );

  // A small provenance chip (SURFACE / a human's call).
  const Tag = ({ ko, en }: { ko: string; en: string }) => (
    <span
      className="bp-mono"
      style={{
        display: 'inline-block', marginLeft: 7, padding: '1px 6px', borderRadius: 3,
        border: '1px solid var(--bp-ink-faint)', color: 'var(--bp-ink-soft)',
        fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
        verticalAlign: 'middle', whiteSpace: 'nowrap',
      }}
    >
      {L(ko, en)}
    </span>
  );

  // The return-arc: a short arrow that draws itself up the gutter on the alert
  // beat — the "loops back" gesture, paired with the premise flash above.
  const ReturnArc = () => (
    <svg width="30" height="52" viewBox="0 0 30 52" fill="none" aria-hidden="true" style={{ position: 'absolute', left: -46, top: -30, overflow: 'visible' }}>
      <motion.path
        d="M25 48 C 6 46, 6 14, 23 8"
        stroke="var(--bp-gold-deep)" strokeWidth="1.5" strokeLinecap="round"
        initial={rm ? false : { pathLength: 0, opacity: 0 }}
        animate={rm ? { pathLength: 1, opacity: 0.85 } : isVisible ? { pathLength: 1, opacity: 0.85 } : { pathLength: 0, opacity: 0 }}
        transition={{ delay: T_RETURN, duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
      />
      <motion.path
        d="M23 8 l 5 2.5 M23 8 l -1.5 5.5"
        stroke="var(--bp-gold-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        initial={rm ? false : { opacity: 0 }}
        animate={rm ? { opacity: 0.85 } : isVisible ? { opacity: 0.85 } : { opacity: 0 }}
        transition={{ delay: T_RETURN + 0.5, duration: 0.25 }}
      />
    </svg>
  );

  const BellIcon = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M8 2.2c-2 0-3.3 1.5-3.3 3.5 0 3-1.2 3.8-1.2 3.8h9s-1.2-.8-1.2-3.8c0-2-1.3-3.5-3.3-3.5Z" stroke="var(--bp-gold-deep)" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6.7 12.2a1.4 1.4 0 0 0 2.6 0" stroke="var(--bp-gold-deep)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );

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

      {/* the seed — a typed line (caret + italic) or an uploaded file chip */}
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

      {/* the loop, down the rail: seal the premises → surface the slipped one →
          time passes → an alert loops back to the premise that broke. */}
      <div style={{ marginTop: 20, position: 'relative', borderLeft: '1px solid var(--bp-ink-faint)', marginLeft: 7, paddingLeft: 24 }}>
        {/* ① SEAL */}
        <Beat delay={T_SEAL}>
          <Node kind="plain" />
          <BeatLabel ko="봉인 · 전제를 잠근다" en="SEAL · lock the premises" />
          <div style={{ color: 'var(--bp-ink)', fontSize: 13.5, lineHeight: 1.55 }}>{L(d.sealLeadKo, d.sealLeadEn)}</div>
          {d.premises.map((p, i) => (
            <PremiseRow key={i} p={p} index={i} flash={i === 0} />
          ))}
        </Beat>

        {/* ② SURFACE */}
        <Beat delay={T_SURFACE}>
          <Node kind="plain" />
          <BeatLabel ko="드러내기 · 놓친 전제를 꺼낸다" en="SURFACE · pull the one you slid past" />
          <div style={{ color: 'var(--bp-ink)', fontSize: 13.5, lineHeight: 1.55 }}>
            {L(d.surfaceKo, d.surfaceEn)}
            <Tag ko={d.surfaceTagKo} en={d.surfaceTagEn} />
          </div>
        </Beat>

        {/* … time gap … */}
        <Beat delay={T_GAP}>
          <span aria-hidden="true" style={{ position: 'absolute', left: -24.5, top: 0, bottom: 4, borderLeft: '1.5px dashed var(--bp-ink-faint)' }} />
          <span className="bp-mono" style={{ display: 'inline-block', color: 'var(--bp-ink-soft)', opacity: 0.75, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
            {L(`… ${d.laterKo} …`, `… ${d.laterEn} …`)}
          </span>
        </Beat>

        {/* ③ RETURN — the alert loops back to the premise that broke */}
        <Beat delay={T_ALERT}>
          <Node kind="alert" />
          <ReturnArc />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <BellIcon />
            <span className="bp-mono" style={{ color: 'var(--bp-gold-deep)', fontSize: 10.5, letterSpacing: locale === 'ko' ? '0.06em' : '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>
              {L('돌아보기 · 알림', 'RETURN · the alert')}
            </span>
          </div>
          <div style={{ color: 'var(--bp-ink)', fontSize: 13.5, lineHeight: 1.55 }}>{L(d.alertKo, d.alertEn)}</div>
          <div className="bp-mono" style={{ marginTop: 7, color: 'var(--bp-gold-deep)', fontSize: 10, letterSpacing: '0.04em', fontWeight: 700 }}>
            {L('↖ 봉인해둔 전제 ①로 되돌아왔어요', '↖ back to the sealed premise ①')}
          </div>
        </Beat>
      </div>
    </div>
  );

  return (
    <section className="bp-root relative overflow-hidden" style={{ background: 'var(--bp-paper-deep)' }}>
      <PaperGrain opacity={0.04} />
      <div className="relative w-full max-w-5xl mx-auto px-6 md:px-10" style={{ paddingTop: 'clamp(44px, 6vh, 84px)', paddingBottom: 'clamp(44px, 6vh, 84px)' }}>
        {/* Eyebrow + heading — now selling the loop, not a checklist */}
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <span aria-hidden="true" style={{ width: 26, height: 1, background: 'var(--bp-ink-faint)' }} />
          <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: locale === 'ko' ? '0.1em' : '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
            {L('USE CASES · 이렇게 한 바퀴 돕니다', 'USE CASES · the loop it runs')}
          </span>
        </div>
        <h2
          className={bk}
          style={{ fontFamily: 'var(--font-display)', color: 'var(--bp-ink)', fontSize: 'clamp(22px, 3.2vw, 32px)', fontWeight: 700, lineHeight: 1.28, letterSpacing: '-0.01em', maxWidth: 680 }}
        >
          {L('믿고 정한 전제가 흔들리면, 그때 다시 불러드려요.', 'When a premise you bet on shifts, we bring the call back.')}
        </h2>
        <p className={bk} style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(13.5px, 1.5vw, 15px)', lineHeight: 1.65, maxWidth: 680, marginTop: 12 }}>
          {locale === 'ko' ? (
            <>적어서 묻든, 써 둔 문서를 올리든 — 결정을 받친 전제를 봉인해 두면, 그게 현실에서 흔들리는 순간 당신에게 돌아와요. 한쪽을 따라 <span style={{ whiteSpace: 'nowrap' }}>한 바퀴</span> 돌아보세요.</>
          ) : (
            'Type a decision or upload one you’ve written — seal the premises under it, and when one is shaken in the real world, it comes back to you. Follow one side through the full loop.'
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

        {/* The loop, in one line + the one quiet product-level honesty */}
        <p className={bk} style={{ color: 'var(--bp-ink-soft)', fontSize: 12, lineHeight: 1.6, marginTop: 22, opacity: 0.9 }}>
          {L(
            '두 길 모두 같은 고리로 굴러가요 — 전제를 봉인하고, 그게 흔들리는 순간 당신에게 돌아오기. 결정은 늘 당신이 내려요. (저희가 던지는 질문에도 옅은 치우침은 남아요 — 아는 한계고요.)',
            'Both paths run the same loop — seal the premises, and when one is shaken, it comes back to you. You always make the call. (Even our questions carry a faint lean — a limit we own.)',
          )}
        </p>
      </div>
    </section>
  );
}
