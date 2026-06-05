'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import { PERSONALITY_TYPES } from '@/lib/boss/personality-types';
import { useLocale } from '@/hooks/useLocale';

export interface BossCollectionEntry {
  typeCode: string;
  verdict: 'approved' | 'rejected' | 'conditional';
  situation: string;
  completedAt: string;
  emoji: string;
}

export function getCollection(): BossCollectionEntry[] {
  return getStorage<BossCollectionEntry[]>(STORAGE_KEYS.BOSS_COLLECTION, []);
}

export function recordCollection(entry: BossCollectionEntry) {
  const collection = getCollection();
  // 같은 유형 이미 있으면 덮어쓰기
  const filtered = collection.filter(c => c.typeCode !== entry.typeCode);
  filtered.push(entry);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.BOSS_COLLECTION, JSON.stringify(filtered));
  }
}

const VERDICT_INDICATOR: Record<string, { color: string; label: string }> = {
  approved: { color: 'var(--success)', label: '✅' },
  conditional: { color: 'var(--warning)', label: '🤔' },
  rejected: { color: 'var(--danger)', label: '❌' },
};

const ALL_TYPES = Object.keys(PERSONALITY_TYPES);
const MILESTONE_MESSAGES_KO: Record<number, string> = {
  4: '25% 클리어!',
  8: '절반 돌파! 설득력 중급 🎖️',
  12: '75%! 거의 다 왔어요',
  16: '전유형 클리어! 직장인 마스터 🏆',
};
const MILESTONE_MESSAGES_EN: Record<number, string> = {
  4: '25% unlocked!',
  8: 'Halfway there — intermediate persuader 🎖️',
  12: '75%! Almost there',
  16: 'All types cleared — Workplace Master 🏆',
};

export function CollectionProgress() {
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const collection = useMemo(() => getCollection(), []);
  const completedSet = useMemo(() => new Set(collection.map(c => c.typeCode)), [collection]);
  const count = completedSet.size;

  if (count === 0) return null;

  const milestone = (locale === 'ko' ? MILESTONE_MESSAGES_KO : MILESTONE_MESSAGES_EN)[count];

  return (
    <div style={{ marginTop: 4 }}>
      {/* Name the purpose — the dots alone don't say WHY you'd collect types.
          The point is comparing how different boss types react to you. */}
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 6px' }}>
        {locale === 'ko' ? '유형별 팀장 반응 모으기' : 'Boss reactions, by type'}
      </p>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 10,
          background: 'var(--bg)', border: '1px solid var(--border-subtle)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          transition: 'border-color 0.15s',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 3, flex: 1 }}>
          {ALL_TYPES.map(code => {
            const entry = collection.find(c => c.typeCode === code);
            return (
              <div
                key={code}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: entry ? VERDICT_INDICATOR[entry.verdict]?.color || 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.3s',
                }}
              />
            );
          })}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {count}/16
        </span>
      </button>

      {milestone && (
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textAlign: 'center', margin: '6px 0 0' }}>
          {milestone}
        </p>
      )}

      {/* Expanded 4x4 grid */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
              marginTop: 8, padding: 8, borderRadius: 12,
              background: 'var(--bg)', border: '1px solid var(--border-subtle)',
            }}>
              {ALL_TYPES.map(code => {
                const type = PERSONALITY_TYPES[code];
                const entry = collection.find(c => c.typeCode === code);
                const done = !!entry;
                return (
                  <div
                    key={code}
                    style={{
                      padding: '6px 4px', borderRadius: 8, textAlign: 'center',
                      background: done ? 'var(--surface)' : 'transparent',
                      opacity: done ? 1 : 0.35,
                      border: done ? '1px solid var(--border-subtle)' : '1px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{type.emoji}</span>
                    <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0' }}>{code}</p>
                    {entry && (
                      <span style={{ fontSize: 10 }}>{VERDICT_INDICATOR[entry.verdict]?.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
