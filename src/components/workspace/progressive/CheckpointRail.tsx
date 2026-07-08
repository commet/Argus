'use client';

/* ═══ CheckpointRail — 실제 선택 단계가 보이고 클릭되는 정거장 상태바 ═══
 *
 * VoyagePhaseRail(묶기/듣기/닿기 3분할)의 교체품. 창업자 3차 지적의 결론:
 * "은유 3개로 뭉뚱그린 바는 예쁜 것에 불과하다 — 사용자가 실제로 끊어짐을
 * 느끼는(선택하는) 단계들이 상태바에 그대로 보여야 하고, 지나온 단계는
 * 클릭해서 돌아가 볼 수 있어야 한다."
 *
 * 그래서 이 레일의 노드는 은유가 아니라 실제 체크포인트다:
 *   상황 → 밧줄 → 질문1..N → 초안 → 검토 → 확인 → 봉인
 *
 * - 지나온 노드 = 손잡이 (클릭 → 그 산출물로 스크롤 회항. 상태 되감기 아님)
 * - 현재 노드 = 배가 정박해 있는 곳 (금빛, 큰 점)
 * - 미래 노드 = 흐린 점 (가짜 어포던스 없음 — 클릭 불가)
 * - 캡션: "지금: 질문 2 · 다음: 초안" — 어디로 가는 여정인지 한 줄로.
 *
 * 묶기/듣기/닿기 은유는 eyebrow의 그룹 표기로만 남는다 (정체성 유지,
 * 뼈대는 실단계). SPINE: 상태 서술만, 판정·점수 없음.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';

export type CheckpointState = 'done' | 'current' | 'future';

export interface RailCheckpoint {
  key: string;
  /** 짧은 실단계 이름 — '질문2', '초안', '봉인' */
  label: string;
  state: CheckpointState;
  /** 묶기/듣기/닿기 그룹 (eyebrow 표기용) */
  group: '묶기' | '듣기' | '닿기';
  groupEn: 'Bind' | 'Listen' | 'Land';
}

export function CheckpointRail({ checkpoints, onJump }: {
  checkpoints: RailCheckpoint[];
  /** 지나온 노드 클릭 → 그 산출물로 회항 (보는 것만, 상태 불변) */
  onJump?: (key: string) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const reduce = useReducedMotion();

  const n = checkpoints.length;
  if (n === 0) return null;
  // 명시적 current가 없는 과도기(질문 소진 직후 등)엔 마지막 done 정거장에 정박.
  let curIdx = checkpoints.findIndex(c => c.state === 'current');
  if (curIdx === -1) {
    for (let i = n - 1; i >= 0; i--) { if (checkpoints[i].state === 'done') { curIdx = i; break; } }
    if (curIdx === -1) curIdx = 0;
  }
  const cur = checkpoints[curIdx];
  const next = checkpoints[curIdx + 1];
  // 노드 위치: 양끝 여백 4% 안에서 균등 분배. 배는 현재 노드 위.
  const posOf = (i: number) => n === 1 ? 50 : 4 + (92 * i) / (n - 1);
  const shipLeft = `${posOf(curIdx).toFixed(1)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mb-6 px-1 mt-1"
      role="group"
      aria-label={L(
        `여정 ${curIdx + 1}/${n} 정거장: ${cur?.label ?? ''}`,
        `Voyage stop ${curIdx + 1}/${n}: ${cur?.label ?? ''}`,
      )}
    >
      {/* Eyebrow — 그룹(은유) · 현재 실단계 · 전체 중 몇 번째 */}
      <div className="flex items-baseline justify-between mb-2 px-0.5">
        <span className="text-[11px] font-bold tracking-[0.14em] text-[var(--accent)] tabular-nums uppercase">
          {locale === 'ko' ? cur?.group : cur?.groupEn}
          <span className="ml-1.5 text-[var(--text-primary)] normal-case tracking-normal">{cur?.label}</span>
          <span className="ml-1.5 normal-case tracking-normal font-normal text-[var(--text-tertiary)]">
            · {curIdx + 1}/{n}
          </span>
        </span>
        {/* 다음 정거장 예고 — "이런 단계로 진행되는구나"의 한 줄 */}
        {next && (
          <span className="text-[11px] text-[var(--text-tertiary)]">
            {L(`다음: ${next.label}`, `Next: ${next.label}`)}
          </span>
        )}
      </div>

      {/* 바닷길 + 정거장 노드들. 장식 모션은 aria-hidden — eyebrow가 상태를 말한다. */}
      <div className="relative h-[46px]" aria-hidden>
        {/* waterline */}
        <div className="absolute inset-x-0 top-[22px] h-[3px] rounded-full" style={{ background: 'var(--border-subtle)' }} />
        {/* 지나온 물길 */}
        <motion.div
          className="absolute left-0 top-[22px] h-[3px] rounded-full"
          style={{ background: 'var(--gradient-gold)', width: shipLeft }}
          initial={false}
          animate={{ width: shipLeft }}
          transition={{ duration: reduce ? 0 : 1.2, ease: EASE }}
        />
        {/* 배 — 현재 정거장 위에서 잔잔하게 */}
        <motion.div
          className="absolute top-[1px]"
          style={{ translateX: '-50%', left: shipLeft }}
          initial={false}
          animate={{ left: shipLeft }}
          transition={{ duration: reduce ? 0 : 1.2, ease: EASE }}
        >
          <motion.div
            animate={reduce ? undefined : { y: [0, -1.5, 0, -1, 0], rotate: [-2, 1.5, -2] }}
            transition={reduce ? undefined : {
              y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="text-[var(--accent)]"
          >
            <svg width="18" height="15" viewBox="0 0 20 17" fill="none">
              <path d="M10 1 L10 10 L3 10 Z" fill="currentColor" opacity="0.9" />
              <path d="M10.8 3.5 L10.8 10 L16 10 Z" fill="currentColor" opacity="0.5" />
              <path d="M2 11 L18 11 L15.5 15 L4.5 15 Z" fill="currentColor" />
            </svg>
          </motion.div>
        </motion.div>
        {/* 정거장들 */}
        {checkpoints.map((c, i) => {
          const done = c.state === 'done';
          const currentNode = c.state === 'current';
          const clickable = done && !!onJump;
          const left = `${posOf(i).toFixed(1)}%`;
          const Dot = (
            <span
              className={`block rounded-full border-2 transition-colors duration-300 ${
                currentNode ? 'w-[11px] h-[11px]' : 'w-[8px] h-[8px]'
              }`}
              style={{
                borderColor: done || currentNode ? 'var(--accent)' : 'var(--border-subtle)',
                background: currentNode ? 'var(--accent)' : 'var(--surface)',
              }}
            />
          );
          return (
            <div key={c.key} className="absolute top-[15px] flex flex-col items-center" style={{ left, transform: 'translateX(-50%)', width: 52 }}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onJump!(c.key)}
                  title={locale === 'ko' ? `${c.label}(으)로 돌아가 보기` : `Look back at ${c.label}`}
                  className="flex flex-col items-center gap-1 cursor-pointer group/cp -mt-[2px] pt-[2px] px-1 rounded-md hover:bg-[var(--accent)]/[0.07] transition-colors"
                >
                  <span className={currentNode ? 'mt-0' : 'mt-[1.5px]'}>{Dot}</span>
                  <span className="text-[10px] leading-none text-[var(--accent)]/85 group-hover/cp:text-[var(--accent)] font-medium whitespace-nowrap flex items-center gap-0.5">
                    {c.label}
                    <Check size={8} strokeWidth={3.5} className="opacity-70" />
                  </span>
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1 px-1 pt-[2px] -mt-[2px]">
                  <span className={currentNode ? 'mt-0' : 'mt-[1.5px]'}>{Dot}</span>
                  <span className={`text-[10px] leading-none whitespace-nowrap ${
                    currentNode ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-tertiary)]'
                  }`}>
                    {c.label}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
