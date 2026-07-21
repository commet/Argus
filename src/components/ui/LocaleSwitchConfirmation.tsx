'use client';

import { ConfirmDialog } from './ConfirmDialog';

export function LocaleSwitchConfirmation({
  locale,
  pendingLocale,
  onConfirm,
  onCancel,
}: {
  locale: 'ko' | 'en';
  pendingLocale: 'ko' | 'en' | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ko = locale === 'ko';
  return (
    <ConfirmDialog
      open={pendingLocale !== null}
      title={ko ? '진행 중인 분석이 있어요' : 'Analysis in progress'}
      description={ko
        ? '언어를 바꾸면 페이지를 다시 불러오며 현재 분석이 중단됩니다. 그래도 전환할까요?'
        : 'Switching language reloads the page and interrupts the current analysis. Continue anyway?'}
      confirmLabel={ko ? '분석 중단하고 전환' : 'Interrupt and switch'}
      cancelLabel={ko ? '계속 분석하기' : 'Keep analyzing'}
      onConfirm={onConfirm}
      onCancel={onCancel}
      dangerous
    />
  );
}
