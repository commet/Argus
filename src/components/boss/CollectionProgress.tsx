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

/**
 * Rehearsal record — counts-only.
 *
 * §2.4-4: this was a "collect all 16 MBTI" Pokedex — a 16-slot grid with
 * 25/50/75/100% milestone badges and a "직장인 마스터 / Workplace Master"
 * completion. That is the gamification the thesis forbids: a mastery tier is a
 * verdict about who the user is, and "collect them all" manufactures a chase.
 * Replaced with a plain ledger of what actually happened — how many rehearsals,
 * with what verdicts — no denominator-to-fill, no milestone, no tier. Honest
 * n=1 history, counts-only (the spine's held/broke/marked-as-luck shape).
 */
export function CollectionProgress() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [expanded, setExpanded] = useState(false);
  // Storage dedupes by typeCode, so each entry is one boss type rehearsed.
  const collection = useMemo(() => getCollection(), []);
  const count = collection.length;

  const tally = useMemo(() => ({
    approved: collection.filter(c => c.verdict === 'approved').length,
    conditional: collection.filter(c => c.verdict === 'conditional').length,
    rejected: collection.filter(c => c.verdict === 'rejected').length,
  }), [collection]);

  if (count === 0) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 6px' }}>
        {L('지금까지의 리허설', 'Your rehearsals so far')}
      </p>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 10,
          background: 'var(--bg)', border: '1px solid var(--border-subtle)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
          transition: 'border-color 0.15s',
        }}
      >
        {/* Counts only — what happened, no goal to complete. */}
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {L(`리허설 ${count}번`, `${count} rehearsal${count === 1 ? '' : 's'}`)}
        </span>
        <span style={{ flex: 1, display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-secondary)', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
          {tally.approved > 0 && <span>✅ {tally.approved}</span>}
          {tally.conditional > 0 && <span>🤔 {tally.conditional}</span>}
          {tally.rejected > 0 && <span>❌ {tally.rejected}</span>}
        </span>
      </button>

      {/* Expanded — a list of the rehearsals done, a record (not a grid of
          empty slots to fill). */}
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
              display: 'flex', flexDirection: 'column', gap: 4,
              marginTop: 8, padding: 8, borderRadius: 12,
              background: 'var(--bg)', border: '1px solid var(--border-subtle)',
            }}>
              {collection.slice().reverse().map(entry => {
                const type = PERSONALITY_TYPES[entry.typeCode];
                return (
                  <div key={entry.typeCode} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
                    <span style={{ fontSize: 15 }}>{type?.emoji ?? entry.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', minWidth: 36 }}>{entry.typeCode}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.situation}</span>
                    <span style={{ fontSize: 12 }}>{VERDICT_INDICATOR[entry.verdict]?.label}</span>
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
