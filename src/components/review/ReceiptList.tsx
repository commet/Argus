'use client';

/**
 * Active Course — the return door (design doc §"돌아올 진입점 / Active Course").
 *
 * The seal→settle loop is worthless without a way back in. This is the list of
 * saved receipts, sorted so what needs the user *now* (a due prediction) sits
 * on top. Clicking a card returns to the full receipt where seal/settle live.
 * No verdict, no score — just "here's where your open judgments are."
 */

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { RecordStrip } from '@/components/ui/RecordStrip';
import { useLocale } from '@/hooks/useLocale';
import {
  type JudgmentReceipt,
  summarizeReceipt,
  sortByUrgency,
  type DerivedStatus,
} from '@/lib/review';

const STATUS_STYLE: Record<DerivedStatus, string> = {
  due: 'text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/30',
  sealed: 'text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/30',
  owned: 'text-[var(--human-fg)] bg-[var(--human-fg)]/10 border-[var(--human-fg)]/20',
  reviewed: 'text-[var(--text-secondary)] bg-[var(--bg)] border-[var(--border-subtle)]',
  settled: 'text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/25',
};

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReceiptList({
  receipts,
  onOpen,
  onNew,
  onRemove,
}: {
  receipts: JudgmentReceipt[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onRemove?: (id: string) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const today = todayYMD();
  const ordered = sortByUrgency(receipts, today);
  const dueCount = ordered.filter((r) => summarizeReceipt(r, today).urgent).length;

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--text-primary)]">{L('내 판단 항로', 'My judgment course')}</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {dueCount > 0
            ? L(
                `확인할 차례가 된 예측이 ${dueCount}개 있습니다.`,
                `${dueCount} prediction${dueCount === 1 ? ' is' : 's are'} due for a check-in.`,
              )
            : L(
                '검수하고 봉인한 판단들이 여기 모입니다. 확인일이 오면 위로 올라옵니다.',
                'Judgments you review and seal collect here. When a check-in date arrives, they rise to the top.',
              )}
        </p>
        {/* Workbench entry — two doors (design doc §Home/Workbench). The wedge is
            "기존 문서 검수하기"; "초안 만들기" is the low-barrier secondary entry. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="accent" size="sm" onClick={onNew}>
            {L('기존 문서 검수하기', 'Review an existing document')}
          </Button>
          <LocaleLink href="/workspace">
            <Button variant="secondary" size="sm">{L('초안 만들기', 'Create a draft')}</Button>
          </LocaleLink>
        </div>
      </div>

      {/* 자차표 — the same <RecordStrip/> as /project (P1-A2, one display
          brain): review settles and project loops are one record, whichever
          door the user returns through. Renders nothing while empty. */}
      <RecordStrip />

      {ordered.length === 0 ? (
        <Card variant="muted">
          <p className="text-[14px] text-[var(--text-primary)]">{L('아직 검수한 문서가 없어요.', 'No documents reviewed yet.')}</p>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {L(
              '전략안·기획안·AI 답변을 넣으면 첫 검수가 시작돼요 — 봉인한 판단은 확인일에 여기로 돌아와요.',
              'Drop in a strategy doc, proposal, or AI answer to start your first review — sealed judgments return here on their check-in day.',
            )}
          </p>
          <div className="mt-3">
            <Button variant="accent" size="sm" onClick={onNew}>
              {L('첫 문서 검수하기', 'Review your first document')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {ordered.map((r) => {
            const s = summarizeReceipt(r, today);
            return (
              <Card
                key={r.receipt_id}
                variant={s.urgent ? 'default' : 'muted'}
                className="cursor-pointer transition-colors hover:border-[var(--accent)]/40"
                onClick={() => onOpen(r.receipt_id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                      {r.source_title || L('제목 없는 문서', 'Untitled document')}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--text-secondary)] line-clamp-2">
                      {r.core_question}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_STYLE[s.derived]}`}
                  >
                    {s.label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
                  {s.next_check_by && <span>{L(`확인일 ${s.next_check_by}`, `Check by ${s.next_check_by}`)}</span>}
                  {s.sealed_count > 0 && (
                    <span>
                      {L(
                        `예측 ${s.settled_count}/${s.sealed_count} 정산`,
                        `${s.settled_count}/${s.sealed_count} predictions settled`,
                      )}
                    </span>
                  )}
                  <span>{(r.updated_at || r.created_at || '').slice(0, 10)}</span>
                  {onRemove && (
                    <button
                      className="ml-auto min-w-[44px] min-h-[44px] px-2 -my-3 inline-flex items-center justify-center text-[var(--text-tertiary)] hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(L('이 검수 기록을 지울까요?', 'Delete this review record?'))) onRemove(r.receipt_id);
                      }}
                    >
                      {L('삭제', 'Delete')}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
