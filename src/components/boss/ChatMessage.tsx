'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import type { PersonalityType } from '@/lib/boss/personality-types';
import { useLocale } from '@/hooks/useLocale';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  bossType?: PersonalityType;
}

export function ChatMessage({ role, content, isStreaming, bossType }: ChatMessageProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const isUser = role === 'user';
  const [showCopy, setShowCopy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyQuote = async () => {
    const bossLabel = L('팀장', 'Boss');
    const text = `${bossType?.emoji || '👔'} ${bossType?.code || ''} ${bossLabel}:\n"${content}"\n\n▸ argus.voyage/boss`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => { setCopied(false); setShowCopy(false); }, 1500);
  };

  return (
    <motion.div
      className={`bm ${isUser ? 'bm-user' : 'bm-boss'}`}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {!isUser && (
        <div className="bm-avatar">
          <span className="bm-avatar-emoji">{bossType?.emoji || '👔'}</span>
        </div>
      )}
      <div
        className={`bm-bubble ${isUser ? 'bm-bubble-user' : 'bm-bubble-boss'}`}
        onClick={!isUser && !isStreaming ? () => setShowCopy(!showCopy) : undefined}
        style={!isUser && !isStreaming ? { cursor: 'pointer', position: 'relative' } : { position: 'relative' }}
      >
        <p className="bm-text">
          {content}
          {isStreaming && (
            <motion.span
              className="bm-cursor"
              animate={{ opacity: [1, 0.2] }}
              transition={{ repeat: Infinity, duration: 0.6, ease: 'easeInOut' }}
            >
              &thinsp;|
            </motion.span>
          )}
        </p>

        {/* Tap-to-copy — boss messages only */}
        {showCopy && !isUser && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => { e.stopPropagation(); handleCopyQuote(); }}
            style={{
              position: 'absolute', top: -8, right: -4,
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 20,
              background: copied ? 'var(--success)' : 'var(--text-primary)',
              color: 'var(--bg)',
              border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: 700,
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
            }}
          >
            {copied
              ? <><Check size={10} /> {L('복사됨', 'Copied')}</>
              : <><Copy size={10} /> {L('이 대사 공유', 'Share this line')}</>}
          </motion.button>
        )}
      </div>
      {isUser && (
        <div className="bm-tail-user" />
      )}
    </motion.div>
  );
}
