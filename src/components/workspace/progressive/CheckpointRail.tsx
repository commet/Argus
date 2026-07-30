'use client';

/* ═══ CheckpointRail — 3그룹 밴드 + 활성 그룹만 펼치는 정거장 상태바 ═══
 *
 * 이력의 두 지적을 화해시킨 형태다. ①VoyagePhaseRail(묶기/듣기/닿기 3은유
 * 분할)은 "예쁘기만 하고 무의미 — 실단계를 보여라"(창업자 3차)라 실단계를
 * 전부 편 평면 레일로 바뀌었고, ②그 평면 레일은 다시 "단계가 너무 많아
 * 무의미 — 묶어라"(창업자 4차)가 됐다. 합의점은 순수 3은유도, 평면 N노드도
 * 아닌 — 그룹으로 묶되 지금 있는 그룹의 실단계는 다 보이는 중간이다.
 *
 * 그래서 레일은 3개 밴드(정리/작성/확인)로 묶고, 현재 밴드만 실단계
 * 노드를 펼친다:
 *   - 활성 밴드   = 실단계 노드가 전부 펼쳐지고 배가 현재 노드 위에 있음
 *   - 지나온 밴드 = 손잡이 하나로 접힘 (클릭 → 그 그룹 산출물로 회항)
 *   - 미래 밴드   = 흐린 칩으로 접힘 (가짜 어포던스 없음 — 클릭 불가)
 *
 * 중요(창업자 5차): 질문1·2·3…은 카운터로 뭉치지 않는다 — 활성 밴드 안에서
 * 각 질문이 개별 손잡이로 남아 그 답으로 정확히 회항할 수 있어야 한다. 그룹
 * 접힘은 "너무 많다"를, 개별 질문 노드는 "다 넘어갈 수 있어야 한다"를 각각
 * 만족시킨다.
 *
 * SPINE(CLAUDE.md zero-judgment): 상태 서술만 — 판정·점수·가중 없음. 클릭은
 * '보기(스크롤 회항)'가 기본이고, 실제 되감기("이 답부터 다시")는 착지 지점의
 * 답 카드(AnsweredPills)가 제공한다 — 레일은 그 답으로 데려다줄 뿐이다.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';

export type CheckpointState = 'done' | 'current' | 'future' | 'skipped';

export interface RailCheckpoint {
  key: string;
  /** 짧은 실단계 이름 — '질문2', '초안', '봉인' */
  label: string;
  state: CheckpointState;
  /** 묶기/듣기/닿기 그룹 (밴드 묶음 + eyebrow 표기) */
  group: '정리' | '작성' | '확인';
  groupEn: 'Frame' | 'Draft' | 'Check';
  /** hover 설명 — done이면 그때의 내용 미리보기, 미래면 그 단계가 뭘 하는지. */
  title?: string;
}

type Band = {
  group: string;
  groupEn: string;
  nodes: RailCheckpoint[];
  bandState: 'done' | 'current' | 'future';
};

export function CheckpointRail({ checkpoints, onJump }: {
  checkpoints: RailCheckpoint[];
  /** 지나온 노드/밴드 클릭 → 그 산출물로 회항 (스크롤; 상태 불변) */
  onJump?: (key: string) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const reduce = useReducedMotion();

  if (checkpoints.length === 0) return null;

  // 1) 그룹을 첫 등장 순서로 묶는다 (묶기 → 듣기 → 닿기).
  const order: string[] = [];
  const byGroup = new Map<string, RailCheckpoint[]>();
  for (const c of checkpoints) {
    if (!byGroup.has(c.group)) { byGroup.set(c.group, []); order.push(c.group); }
    byGroup.get(c.group)!.push(c);
  }

  // 2) 밴드 모델 — 실단계 노드는 접지 않는다(질문 개별 유지).
  const bands: Band[] = order.map(g => {
    const nodes = byGroup.get(g)!;
    const hasCurrent = nodes.some(c => c.state === 'current');
    const allDone = nodes.every(c => c.state === 'done' || c.state === 'skipped');
    const bandState: Band['bandState'] = hasCurrent ? 'current' : allDone ? 'done' : 'future';
    return { group: g, groupEn: nodes[0].groupEn, nodes, bandState };
  });

  // 활성 밴드: current를 가진 밴드 → (없으면) 진행(done 노드)이 있는 가장 뒤
  // 밴드 → 첫 밴드. (부분만 done인 밴드도 미래 칩으로 접히지 않게: 초안만
  // 끝나고 검토는 아직인 듣기 밴드가 흐린 칩으로 죽지 않도록.)
  let activeIdx = bands.findIndex(b => b.bandState === 'current');
  if (activeIdx === -1) {
    for (let k = bands.length - 1; k >= 0; k--) { if (bands[k].nodes.some(c => c.state === 'done')) { activeIdx = k; break; } }
  }
  if (activeIdx === -1) activeIdx = 0;
  const activeBand = bands[activeIdx];
  // 배가 정박한 노드 — 현재 노드, 없으면 활성 밴드의 마지막 done 노드.
  const shipKey =
    activeBand.nodes.find(c => c.state === 'current')?.key
    ?? [...activeBand.nodes].reverse().find(c => c.state === 'done')?.key
    ?? null;

  // 3) eyebrow 진행 표기 — 전체 노드 중 현재 위치.
  const curIdx = (() => {
    const i = checkpoints.findIndex(c => c.state === 'current');
    if (i !== -1) return i;
    for (let k = checkpoints.length - 1; k >= 0; k--) { if (checkpoints[k].state === 'done') return k; }
    return 0;
  })();
  const cur = checkpoints[curIdx];
  const next = checkpoints[curIdx + 1] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mb-6 px-1 mt-1"
      role="navigation"
      aria-label={L(
        `진행 ${curIdx + 1}/${checkpoints.length}: ${locale === 'ko' ? activeBand.group : activeBand.groupEn} · ${cur?.label ?? ''}`,
        `Progress ${curIdx + 1}/${checkpoints.length}: ${activeBand.groupEn} · ${cur?.label ?? ''}`,
      )}
    >
      {/* Eyebrow — 그룹 · 현재 실단계 · 전체 중 몇 번째, 그리고 다음 정거장 */}
      <div className="flex items-baseline justify-between mb-2.5 px-0.5 gap-2">
        <span className="text-[12.5px] font-bold tracking-[0.14em] text-[var(--accent)] tabular-nums uppercase truncate">
          {locale === 'ko' ? activeBand.group : activeBand.groupEn}
          <span className="ml-1.5 text-[var(--text-primary)] normal-case tracking-normal">{cur?.label}</span>
          <span className="ml-1.5 normal-case tracking-normal font-normal text-[var(--text-tertiary)]">
            · {curIdx + 1}/{checkpoints.length}
          </span>
        </span>
        {next && (
          <span className="text-[12.5px] text-[var(--text-tertiary)] shrink-0 whitespace-nowrap">
            {L(`다음: ${next.label}`, `Next: ${next.label}`)}
          </span>
        )}
      </div>

      {/* Compact screens use two honest rows: the three real groups first, then
          the active group's actual checkpoints. Compressing both into one row
          made five question labels collide at 390px and turned progress into
          ornament. This keeps every reached checkpoint tappable. */}
      <div className="md:hidden">
        <div className="grid grid-cols-3 gap-1" aria-hidden>
          {bands.map((band, bi) => (
            <div
              key={band.group}
              className={`rounded-lg px-2 py-2 text-center ${
                bi === activeIdx
                  ? 'bg-[var(--accent)]/[0.08] text-[var(--accent)]'
                  : band.bandState === 'done'
                    ? 'text-[var(--text-secondary)]'
                    : 'text-[var(--text-tertiary)]'
              }`}
            >
              <span className="block text-[12px] font-bold">
                {locale === 'ko' ? band.group : band.groupEn}
              </span>
              <span className="mt-0.5 block text-[12.5px] font-normal">
                {band.bandState === 'done'
                  ? L('지나옴', 'Done')
                  : bi === activeIdx
                    ? L('지금', 'Now')
                    : L('다음', 'Later')}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.035] px-2 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center">
            {activeBand.nodes.map((node, ni) => {
              const done = node.state === 'done';
              const current = node.state === 'current';
              const skipped = node.state === 'skipped';
              const clickable = !!onJump && done;
              const label = node.title
                || (clickable ? L(`${node.label}(으)로 돌아가 보기`, `Look back at ${node.label}`) : undefined);
              const content = (
                <>
                  <span
                    className={`grid size-5 place-items-center rounded-full border text-[12.5px] ${
                      current
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                        : done
                          ? 'border-[var(--accent)]/45 bg-[var(--surface)] text-[var(--accent)]'
                          : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-tertiary)]'
                    }`}
                  >
                    {done ? <Check size={10} strokeWidth={3} /> : ni + 1}
                  </span>
                  <span className={`text-[12px] ${current ? 'font-bold text-[var(--text-primary)]' : skipped ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-secondary)]'}`}>
                    {node.label}
                  </span>
                </>
              );
              return (
                <div key={node.key} className="flex items-center">
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onJump!(node.key)}
                      title={label}
                      aria-label={label}
                      className="flex min-w-[58px] flex-col items-center gap-1 rounded-lg px-1 py-1"
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex min-w-[58px] flex-col items-center gap-1 px-1 py-1" aria-current={current ? 'step' : undefined}>
                      {content}
                    </div>
                  )}
                  {ni < activeBand.nodes.length - 1 && (
                    <span className={`h-px w-4 ${done ? 'bg-[var(--accent)]/55' : 'bg-[var(--border-subtle)]'}`} aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Wide screens can carry the active band and the collapsed peer bands
          on one row without sacrificing label legibility. */}
      <div className="hidden items-stretch gap-1.5 md:flex">
        {bands.map((band, bi) => {
          const isActive = bi === activeIdx;
          const chevron = bi < bands.length - 1 ? (
            <ChevronRight size={12} className="self-center shrink-0 text-[var(--text-tertiary)]/50" aria-hidden />
          ) : null;

          /* ── 활성 밴드: 실단계 노드를 전부 펼치고 배를 현재 노드 위에 ── */
          if (isActive) {
            return (
              <div key={band.group} className="contents">
                <div className="flex-1 min-w-0 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.04] pt-2 pb-2 px-3">
                  <div className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] mb-0.5">
                    {locale === 'ko' ? band.group : band.groupEn}
                  </div>
                  {/* 노드가 밴드 너비를 넘으면(질문 여러 개 + 좁은 화면) 페이지를
                      가로로 밀지 않고 밴드 안에서만 스크롤 — 노드가 잘리지 않게.
                      `pt`는 배의 자리다: overflow-x가 auto면 CSS는 overflow-y도
                      visible로 두지 못하므로(한 축이 visible이 아니면 나머지는
                      auto로 계산된다), 노드 위 -15px에 뜨는 배가 이 상자에
                      그대로 잘려 나갔다. 안쪽 여백으로 배를 상자 안에 들인다. */}
                  <div className="flex items-center gap-1 overflow-x-auto pt-[17px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {band.nodes.map((node, ni) => {
                      const isCur = node.state === 'current';
                      const showShip = node.key === shipKey;
                      const done = node.state === 'done';
                      const skipped = node.state === 'skipped';
                      const clickable = !!onJump && done; // 지나온 노드만 손잡이
                      const title = node.title
                        || (clickable ? L(`${node.label}(으)로 돌아가 보기`, `Look back at ${node.label}`) : undefined);
                      const dot = (
                        <span
                          className={`block rounded-full border-2 ${isCur ? 'w-[11px] h-[11px]' : 'w-[8px] h-[8px]'} ${skipped ? 'opacity-50' : ''}`}
                          style={{
                            borderColor: done || isCur ? 'var(--accent)' : 'var(--border-subtle)',
                            background: done || isCur ? 'var(--accent)' : 'var(--surface)',
                          }}
                        />
                      );
                      const inner = (
                        <span className="relative flex flex-col items-center gap-1" aria-current={isCur ? 'step' : undefined}>
                          {showShip && (
                            <motion.span
                              className="absolute -top-[15px] text-[var(--accent)]"
                              animate={reduce ? undefined : { y: [0, -1.5, 0], rotate: [-2, 1.5, -2] }}
                              transition={reduce ? undefined : {
                                y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                                rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                              }}
                              aria-hidden
                            >
                              <svg width="16" height="13" viewBox="0 0 20 17" fill="none">
                                <path d="M10 1 L10 10 L3 10 Z" fill="currentColor" opacity="0.9" />
                                <path d="M10.8 3.5 L10.8 10 L16 10 Z" fill="currentColor" opacity="0.5" />
                                <path d="M2 11 L18 11 L15.5 15 L4.5 15 Z" fill="currentColor" />
                              </svg>
                            </motion.span>
                          )}
                          {dot}
                          <span
                            className={`text-[12px] leading-none whitespace-nowrap flex items-center gap-0.5 ${
                              isCur ? 'text-[var(--text-primary)] font-bold'
                                : done ? 'text-[var(--accent)]/85 font-medium'
                                : skipped ? 'text-[var(--text-tertiary)] line-through opacity-70'
                                : 'text-[var(--text-tertiary)]'
                            }`}
                          >
                            {node.label}
                            {done && !isCur && <Check size={8} strokeWidth={3.5} className="opacity-70" />}
                          </span>
                        </span>
                      );
                      return (
                        // 마지막 노드만 내용폭: [노드][선][노드]…[노드]가 한 사슬로
                        // 이어져 선이 다음 점에 닿는다. justify-center로 각 칸에
                        // 점을 띄우면 선이 칸 경계에서 끊겨 "빈 자"가 남는다.
                        <div key={node.key} className={`flex items-center gap-1 min-w-0 ${ni < band.nodes.length - 1 ? 'flex-1' : ''}`}>
                          {clickable ? (
                            <button
                              type="button"
                              onClick={() => onJump!(node.key)}
                              title={title}
                              aria-label={title}
                              className="flex flex-col items-center rounded-md px-1 pt-[2px] -mt-[2px] hover:bg-[var(--accent)]/[0.08] transition-colors cursor-pointer"
                            >
                              {inner}
                            </button>
                          ) : (
                            <div className="flex flex-col items-center px-1" title={title}>{inner}</div>
                          )}
                          {ni < band.nodes.length - 1 && (
                            // 노드 사이를 끝까지 잇는 항로선. 창업자 스크린샷에서
                            // "빈 자"로 읽혔던 건 선이 길어서가 아니라 그 위에 있어야
                            // 할 배가 overflow에 잘려 사라진 채 선만 남아서였다 —
                            // 배가 돌아온 지금, 끊긴 토막선이 오히려 고장처럼 보인다.
                            <span
                              className="flex-1 min-w-[8px] h-[2px] rounded-full"
                              style={{ background: node.state === 'done' ? 'var(--accent)' : 'var(--border-subtle)' }}
                              aria-hidden
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {chevron}
              </div>
            );
          }

          /* ── 지나온 밴드: 손잡이 칩 (클릭 → 그 그룹 마지막 산출물로 회항) ── */
          if (band.bandState === 'done') {
            const rep = band.nodes[band.nodes.length - 1];
            const label = L(`${band.group} 단계로 돌아가 보기`, `Look back at the ${band.groupEn} stage`);
            const chipContent = (
              <>
                {locale === 'ko' ? band.group : band.groupEn}
                <Check size={9} strokeWidth={3.5} className="opacity-80" />
              </>
            );
            return (
              <div key={band.group} className="contents">
                {onJump ? (
                  <button
                    type="button"
                    onClick={() => onJump(rep.key)}
                    title={label}
                    aria-label={label}
                    className="flex-none self-center inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/[0.05] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--accent)]/90 hover:bg-[var(--accent)]/[0.1] transition-colors cursor-pointer"
                  >
                    {chipContent}
                  </button>
                ) : (
                  <div className="flex-none self-center inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/[0.05] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--accent)]/90">
                    {chipContent}
                  </div>
                )}
                {chevron}
              </div>
            );
          }

          /* ── 미래 밴드: 흐린 칩 (그룹명 + 실단계 미리보기, 클릭 불가) ── */
          const subLabels = band.nodes.map(c => c.label).join(' · ');
          return (
            <div key={band.group} className="contents">
              <div
                className="flex-none self-center inline-flex flex-col items-start justify-center rounded-full border border-[var(--border-subtle)] px-2.5 py-1.5"
                title={band.nodes.map(c => c.title).filter(Boolean).join('\n') || undefined}
              >
                <span className="text-[12px] font-semibold text-[var(--text-tertiary)] leading-none">
                  {locale === 'ko' ? band.group : band.groupEn}
                </span>
                <span className="text-[12.5px] text-[var(--text-tertiary)]/70 leading-none mt-0.5 whitespace-nowrap">
                  {subLabels}
                </span>
              </div>
              {chevron}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
