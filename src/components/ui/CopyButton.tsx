'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './Button';
import { copyToClipboard } from '@/lib/export';
import { useLocale } from '@/hooks/useLocale';

interface CopyButtonProps {
  getText: () => string;
  label?: string;
  onCopied?: () => void;
}

export function CopyButton({ getText, label, onCopied }: CopyButtonProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const resolvedLabel = label ?? L('결과 복사', 'Copy result');
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(getText());
      setFailed(false);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Don't fail silently — the user clicked and saw nothing happen.
      console.error('Copy failed:', err);
      setFailed(true);
      setTimeout(() => setFailed(false), 2500);
    }
  };

  return (
    <Button
      variant={copied ? 'secondary' : 'primary'}
      onClick={handleCopy}
      className={copied ? '!border-[var(--success)] !text-[var(--success)]' : failed ? '!border-red-400 !text-[var(--danger)]' : ''}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? L('복사 완료!', 'Copied!') : failed ? L('복사 실패 — 다시 시도', 'Copy failed — retry') : resolvedLabel}
    </Button>
  );
}
