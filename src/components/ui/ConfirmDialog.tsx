'use client';

import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  dangerous = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  dangerous?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      widthClass="max-w-md"
      initialFocusRef={cancelRef}
      closeLabel={cancelLabel}
    >
      <div className="flex items-start gap-3">
        {dangerous && (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--danger)]/10 text-[var(--danger)]" aria-hidden="true">
            <AlertTriangle size={17} />
          </span>
        )}
        <p className="min-w-0 break-words text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button ref={cancelRef} variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={dangerous ? 'danger' : 'accent'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
