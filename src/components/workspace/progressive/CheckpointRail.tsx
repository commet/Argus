'use client';

/**
 * A quiet progress rail for the heavy path.
 *
 * The three stable groups explain the overall journey. Only reached checkpoints
 * are listed below them, so future questions never compete with the question the
 * user is answering now. Completed checkpoints remain jump targets.
 */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';

export type CheckpointState = 'done' | 'current' | 'future' | 'skipped';

export interface RailCheckpoint {
  key: string;
  label: string;
  state: CheckpointState;
  group: '짚어보기' | '작성' | '확인';
  groupEn: 'Frame' | 'Writing' | 'Check';
  title?: string;
}

type Band = {
  group: RailCheckpoint['group'];
  groupEn: RailCheckpoint['groupEn'];
  nodes: RailCheckpoint[];
  state: 'done' | 'current' | 'future';
};

export function CheckpointRail({
  checkpoints,
  onJump,
}: {
  checkpoints: RailCheckpoint[];
  onJump?: (key: string) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  if (checkpoints.length === 0) return null;

  const bands = checkpoints.reduce<Band[]>((result, checkpoint) => {
    let band = result.find(item => item.group === checkpoint.group);
    if (!band) {
      band = {
        group: checkpoint.group,
        groupEn: checkpoint.groupEn,
        nodes: [],
        state: 'future',
      };
      result.push(band);
    }
    band.nodes.push(checkpoint);
    if (checkpoint.state === 'current') band.state = 'current';
    else if (
      band.state !== 'current' &&
      band.nodes.every(node => node.state === 'done' || node.state === 'skipped')
    ) {
      band.state = 'done';
    }
    return result;
  }, []);

  const currentIndex = (() => {
    const current = checkpoints.findIndex(checkpoint => checkpoint.state === 'current');
    if (current >= 0) return current;
    const lastDone = checkpoints.findLastIndex(checkpoint => checkpoint.state === 'done');
    return Math.max(0, lastDone);
  })();
  const current = checkpoints[currentIndex];
  const currentBand = bands.find(band => band.state === 'current')
    ?? [...bands].reverse().find(band => band.state === 'done')
    ?? bands[0];
  const reached = checkpoints.filter(checkpoint => checkpoint.state !== 'future');
  const progress = Math.max(4, ((currentIndex + 1) / checkpoints.length) * 100);

  return (
    <motion.nav
      role="navigation"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="mb-3 mt-0 px-1"
      aria-label={L(
        `진행 ${currentIndex + 1}/${checkpoints.length}: ${current.label}`,
        `Progress ${currentIndex + 1}/${checkpoints.length}: ${current.label}`,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">
          <span className="mr-2 text-[12px] font-bold uppercase tracking-[0.13em] text-[var(--accent)]">
            {locale === 'ko' ? currentBand.group : currentBand.groupEn}
          </span>
          {current.label}
        </p>
        <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-tertiary)]">
          {currentIndex + 1}/{checkpoints.length}
        </span>
      </div>

      <div className="relative mt-3">
        <div className="absolute left-0 right-0 top-[22px] h-px bg-[var(--border-subtle)]" aria-hidden />
        <motion.div
          className="absolute left-0 top-[22px] h-px bg-[var(--accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.45, ease: EASE }}
          aria-hidden
        />
        <div className="relative grid grid-cols-3 gap-4">
          {bands.map(band => {
            const active = band === currentBand;
            return (
              <div key={band.group} className="min-w-0 pb-3">
                <span
                  className={`block truncate text-[12px] font-semibold ${
                    active
                      ? 'text-[var(--accent)]'
                      : band.state === 'done'
                        ? 'text-[var(--text-secondary)]'
                        : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {locale === 'ko' ? band.group : band.groupEn}
                </span>
                <span
                  className={`mt-[8px] block size-[7px] rounded-full border ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : band.state === 'done'
                        ? 'border-[var(--accent)] bg-[var(--surface)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface)]'
                  }`}
                  aria-hidden
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label={L('지나온 단계', 'Reached checkpoints')}>
        {reached.map(checkpoint => {
          const done = checkpoint.state === 'done';
          const skipped = checkpoint.state === 'skipped';
          const isCurrent = checkpoint.state === 'current';
          const label = checkpoint.title
            ?? L(`${checkpoint.label}(으)로 돌아가 보기`, `Look back at ${checkpoint.label}`);

          if (done && onJump) {
            return (
              <button
                key={checkpoint.key}
                type="button"
                onClick={() => onJump(checkpoint.key)}
                title={label}
                aria-label={label}
                className="inline-flex min-h-8 items-center gap-1 text-[12px] text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
              >
                <Check size={10} strokeWidth={2.5} className="text-[var(--accent)]" />
                {checkpoint.label}
              </button>
            );
          }

          return (
            <span
              key={checkpoint.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={`inline-flex min-h-8 items-center text-[12px] ${
                isCurrent
                  ? 'font-semibold text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)]'
              } ${skipped ? 'line-through' : ''}`}
            >
              {checkpoint.label}
            </span>
          );
        })}
      </div>
    </motion.nav>
  );
}
