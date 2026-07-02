'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Tailwind max-width class for the dialog. Defaults to `max-w-lg`. */
  widthClass?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

// Ref-counted body scroll-lock so stacked modals don't clobber each other:
// the page only unlocks once the LAST open modal closes.
let scrollLockCount = 0;
function lockScroll() {
  if (scrollLockCount++ === 0) document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = '';
}

export function Modal({ open, onClose, title, children, widthClass = 'max-w-lg' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Hold the latest onClose in a ref so the focus-trap effect below does NOT list
  // it as a dependency. Callers pass a fresh inline arrow (`onClose={() => ...}`)
  // every render, so an onClose dep made the effect tear down + re-run on EVERY
  // keystroke — the cleanup yanked focus back to the trigger button and the
  // re-run refocused the input one frame later. That focus bounce broke IME
  // composition (Korean died, English dropped characters) and made the input feel
  // like it only accepted one character ("한 글자 이상 안 쳐짐").
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Portal target only exists in the browser — gate on mount to avoid an
  // SSR/hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // Wait for portal mount so focus targets the real (portaled) dialog node.
    if (!open || !mounted) return;

    lockScroll();
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (first focusable, else the close button) on next paint
    const focusFrame = requestAnimationFrame(() => {
      const root = dialogRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? closeBtnRef.current)?.focus();
    });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKey);
      unlockScroll();
      // Return focus to the trigger that opened the dialog
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  // Portal to <body> so the fixed overlay is positioned against the viewport,
  // not a transformed ancestor (framer-motion parents create a containing
  // block that would otherwise mis-place the modal and clip the backdrop).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.58) 100%)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className={`relative bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-xl)] border border-[var(--border-subtle)] w-full ${widthClass} mx-4 max-h-[85vh] overflow-hidden animate-fade-in`}
      >
        <div className="h-[2px] w-full" style={{ background: 'var(--gradient-gold)' }} />
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="modal-title" className="text-[16px] font-bold text-[var(--text-primary)]">{title}</h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-60px)]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
