/**
 * 가벼운 전역 토스트 — 네이티브 alert()를 대체한다. alert는 OS 다이얼로그라
 * 실패/성공 순간에 디자인 언어를 깨뜨렸다. dispatch만 하고, <Toast/>가 그린다.
 */
export type ToastVariant = 'info' | 'success' | 'error';

export function toast(message: string, variant: ToastVariant = 'info'): void {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent('argus:toast', { detail: { message, variant } }));
}
