'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, Check, FileSearch, Scale, Search, UserRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLocale } from '@/hooks/useLocale';
import { locateSynthesisSource, type SynthesisSourceLocation } from '@/lib/synthesis-path';
import type { SynthesizeItem } from '@/stores/types';

interface SynthesisAlignmentMapProps {
  item: SynthesizeItem;
  onSelectConflict: (conflictId: string) => void;
}

interface SourceSelection {
  location: SynthesisSourceLocation;
  position: string;
}

export function SynthesisAlignmentMap({ item, onSelectConflict }: SynthesisAlignmentMapProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const analysis = item.analysis;
  const [sourceSelection, setSourceSelection] = useState<SourceSelection | null>(null);
  const sourceLines = useMemo(() => sourceSelection
    ? (item.sources[sourceSelection.location.sourceIndex]?.content || '').split(/\r?\n/)
    : [], [item.sources, sourceSelection]);

  if (!analysis) return null;

  const openSource = (sourceName: string, position: string) => {
    const location = locateSynthesisSource(item, sourceName, position);
    if (location) setSourceSelection({ location, position });
  };

  const matchLabel = (match: SynthesisSourceLocation['match']) => {
    if (match === 'direct') return L('원문 직접 일치', 'Direct source match');
    if (match === 'closest') return L('가장 가까운 원문 · 자동 추정', 'Closest source passage · inferred');
    return L('정확한 위치 확인 필요', 'Exact location needs review');
  };

  return (
    <section className="border-y border-[var(--border-subtle)] py-5" aria-labelledby="synthesis-map-title">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="synthesis-map-title" className="text-[15px] font-bold text-[var(--text-primary)]">
            {L('출처에서 판단까지', 'From sources to judgment')}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
            {L('각 입장을 눌러 원문의 정확한 줄 또는 가장 가까운 문단을 확인하세요.', 'Open any position to see the exact line or closest source passage.')}
          </p>
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)]">
          {analysis.conflicts.filter((conflict) => conflict.user_judgment).length}/{analysis.conflicts.length} {L('쟁점 판단 완료', 'conflicts decided')}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {analysis.sources_summary.map((source, index) => (
          <button
            key={`${source.name}:${index}`}
            type="button"
            onClick={() => openSource(source.name, source.core_claim)}
            className="group min-h-[92px] border border-[var(--border-subtle)] bg-[var(--ai)] p-3 text-left transition-colors hover:border-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span className="flex items-center justify-between gap-2 text-[12px] font-bold text-[var(--ai-fg)]">
              <span className="truncate">{source.name}</span>
              <FileSearch size={12} className="shrink-0 opacity-65 group-hover:opacity-100" />
            </span>
            <span className="mt-1.5 line-clamp-3 block text-[12px] font-semibold leading-relaxed text-[var(--text-primary)]">{source.core_claim}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-center py-2 text-[var(--text-tertiary)]" aria-hidden="true"><ArrowDown size={14} /></div>

      {analysis.agreements.length > 0 && (
        <div className="border border-[var(--success)]/25 bg-[var(--success)]/7 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--success)]"><Check size={12} /> {L('공통으로 남은 것', 'Common ground')}</p>
          <div className="mt-2 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
            {analysis.agreements.map((agreement, index) => (
              <p key={index} className="text-[12px] leading-relaxed text-[var(--text-primary)]">{agreement}</p>
            ))}
          </div>
        </div>
      )}

      {analysis.conflicts.length > 0 && (
        <div className="mt-3 border border-[var(--border-subtle)]">
          <div className="grid grid-cols-[minmax(0,1fr)_116px_minmax(0,1fr)] border-b border-[var(--border-subtle)] bg-[var(--bg)] px-2 py-1.5 text-center text-[12.5px] font-bold text-[var(--text-tertiary)]">
            <span>{L('입장 A', 'Position A')}</span>
            <span>{L('쟁점', 'Conflict')}</span>
            <span>{L('입장 B', 'Position B')}</span>
          </div>
          {analysis.conflicts.map((conflict) => (
            <div key={conflict.id} className="grid min-h-[112px] grid-cols-[minmax(0,1fr)_116px_minmax(0,1fr)] border-b border-[var(--border-subtle)] last:border-b-0">
              <button
                type="button"
                onClick={() => openSource(conflict.side_a.source, conflict.side_a.position)}
                className="group min-w-0 border-r border-[var(--border-subtle)] p-3 text-left hover:bg-[var(--bg-hover)] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--accent)]"
              >
                <span className="flex items-center gap-1 text-[12.5px] font-bold text-[var(--text-tertiary)]"><Search size={10} /> {conflict.side_a.source}</span>
                <span className="mt-1.5 line-clamp-4 block text-[12.5px] leading-relaxed text-[var(--text-primary)]">{conflict.side_a.position}</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectConflict(conflict.id)}
                className={`flex flex-col items-center justify-center gap-1.5 px-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--accent)] ${conflict.user_judgment ? 'bg-[var(--success)]/7 hover:bg-[var(--success)]/11' : 'bg-[var(--checkpoint)] hover:bg-[var(--warning)]/12'}`}
                aria-label={L(`${conflict.topic} 판단으로 이동`, `Go to judgment for ${conflict.topic}`)}
              >
                {conflict.user_judgment ? <UserRound size={14} className="text-[var(--success)]" /> : <Scale size={14} className="text-[var(--warning)]" />}
                <span className="line-clamp-3 text-[12px] font-bold leading-snug text-[var(--text-primary)]">{conflict.topic}</span>
                <span className={`text-[8px] font-bold ${conflict.user_judgment ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                  {conflict.user_judgment ? L('내 판단 있음', 'Decided') : L('판단 필요', 'Needs judgment')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openSource(conflict.side_b.source, conflict.side_b.position)}
                className="group min-w-0 border-l border-[var(--border-subtle)] p-3 text-left hover:bg-[var(--bg-hover)] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--accent)]"
              >
                <span className="flex items-center gap-1 text-[12.5px] font-bold text-[var(--text-tertiary)]"><Search size={10} /> {conflict.side_b.source}</span>
                <span className="mt-1.5 line-clamp-4 block text-[12.5px] leading-relaxed text-[var(--text-primary)]">{conflict.side_b.position}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(sourceSelection)}
        onClose={() => setSourceSelection(null)}
        title={L('출처 원문', 'Source text')}
        widthClass="max-w-3xl"
        closeLabel={L('닫기', 'Close')}
      >
        {sourceSelection && (
          <div>
            <div className="mb-3 border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[12px] font-bold text-[var(--text-primary)]">{sourceSelection.location.sourceName}</p>
                <p className={`shrink-0 text-[12px] font-bold ${sourceSelection.location.match === 'unresolved' ? 'text-[var(--warning)]' : 'text-[var(--accent)]'}`}>
                  {matchLabel(sourceSelection.location.match)}
                </p>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--text-tertiary)]">{L('비교한 입장', 'Compared position')} </span>{sourceSelection.position}
              </p>
            </div>
            <div className="overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg)] font-mono text-[12.5px] leading-[1.65]">
              {sourceLines.map((line, index) => {
                const lineNo = index + 1;
                const highlighted = sourceSelection.location.match !== 'unresolved'
                  && lineNo >= sourceSelection.location.lineStart
                  && lineNo <= sourceSelection.location.lineEnd;
                return (
                  <div key={lineNo} data-highlighted={highlighted ? 'true' : undefined} className={`grid grid-cols-[42px_1fr] ${highlighted ? 'bg-[var(--accent)]/12 text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    <span className={`select-none border-r px-2 py-0.5 text-right ${highlighted ? 'border-[var(--accent)]/25 text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{lineNo}</span>
                    <span className="whitespace-pre-wrap break-words px-3 py-0.5">{line || ' '}</span>
                  </div>
                );
              })}
            </div>
            {sourceSelection.location.match === 'unresolved' && (
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--warning)]">
                {L('이 입장은 원문을 요약하거나 재해석한 표현이라 특정 줄을 자동으로 단정하지 않았습니다.', 'This position appears summarized or reinterpreted, so Argus did not assert a specific source line.')}
              </p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
