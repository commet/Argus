'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

/**
 * Trap keyboard focus inside `ref` while `active`, close on Escape, and restore
 * focus to the trigger on teardown. Extracted from Modal.tsx so bespoke dialogs
 * (ones that can't adopt the full <Modal> shell without a layout rewrite) get the
 * SAME correct behavior instead of letting Tab walk out behind the backdrop.
 *
 * onClose is held in a ref so callers can pass a fresh inline arrow each render
 * without tearing the effect down every keystroke (which would bounce focus and
 * break IME composition — see the Modal.tsx note).
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  { active, onClose }: { active: boolean; onClose: () => void },
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusFrame = requestAnimationFrame(() => {
      const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === first || !root.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [active, ref]);
}
