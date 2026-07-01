'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { PersonalityType } from '@/lib/boss/personality-types';
import { SajuPreview } from './SajuPreview';
import { composeKyeol } from '@/lib/boss/kyeol';

interface BossConfirmationProps {
  typeData: PersonalityType;
  situation: string;
  birthYear: number;
  birthMonth?: number;
  birthDay?: number;
  sajuLoading: boolean;
  onContinue: () => void;
}

// Long enough to actually read the boss identity + saju + the situation echo
// before it auto-advances (1.8s was "blink and you miss it"). Users who want
// to move faster can click "대화 시작" to skip the wait.
const AUTO_ADVANCE_MS = 3800;

export function BossConfirmation({
  typeData,
  situation,
  birthYear,
  birthMonth,
  birthDay,
  sajuLoading,
  onContinue,
}: BossConfirmationProps) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Auto-advance once Saju load resolves (or immediately if no birth data)
  useEffect(() => {
    if (sajuLoading || autoTriggered) return;
    setAutoTriggered(true);
    const t = setTimeout(onContinue, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [sajuLoading, autoTriggered, onContinue]);

  // Focus the continue button so Enter/Space jumps to chat
  useEffect(() => {
    continueRef.current?.focus();
  }, []);

  const hasBirth = birthYear >= 1940;
  const kyeol = hasBirth ? composeKyeol(birthYear, locale) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ maxWidth: 520, margin: '40px auto', padding: '0 24px' }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 20,
          padding: 28,
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}
      >
        <div style={{ height: 2, width: '100%', background: 'var(--gradient-gold)', borderRadius: 1, marginBottom: 24 }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          {L('팀장 준비 완료', 'Boss ready')}
        </div>

        {/* Boss identity */}
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }} aria-hidden="true">{typeData.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {typeData.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          {typeData.bossVibe}
        </div>

        {/* Saju / zodiac mini-preview when birth data is set */}
        {hasBirth && (
          <div style={{ marginBottom: 18 }}>
            <SajuPreview year={birthYear} month={birthMonth} day={birthDay} />
            {kyeol && (
              <p style={{
                marginTop: 10, fontSize: 12, color: 'var(--text-secondary)',
                fontStyle: 'italic', lineHeight: 1.5, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto',
              }}>
                {kyeol.line}
                {/* Keep the playful framing consistent with the setup screen —
                    this is flavor, not a real personality claim. */}
                <span style={{ fontStyle: 'normal', color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  · {L('재미로', 'just for fun')}
                </span>
              </p>
            )}
            {sajuLoading && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                <Loader2 size={11} className="animate-spin" />
                <span>{L('팀장 프로필 준비 중', 'Preparing your boss…')}</span>
              </div>
            )}
          </div>
        )}

        {/* Situation echo */}
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '12px 14px',
            textAlign: 'left',
            margin: '0 0 20px',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            {L('이 상황을 토론합니다', 'You will discuss')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            &ldquo;{situation}&rdquo;
          </div>
        </div>

        <button
          ref={continueRef}
          onClick={onContinue}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 18px',
            borderRadius: 12,
            background: 'var(--gradient-gold)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(1px)'; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        >
          {L('대화 시작', 'Start chat')} <ArrowRight size={14} />
        </button>

        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 10 }}>
          {sajuLoading
            ? L('잠시만요…', 'One moment…')
            : L('자동으로 시작됩니다', 'Starts automatically')}
        </div>
      </div>
    </motion.div>
  );
}
