'use client';

/**
 * 자동화 테스트 모드 — `?e2e-no-anim=1`이 URL에 있으면 framer-motion의 모든
 * 애니메이션을 즉시 완료로 바꾼다 (공식 MotionGlobalConfig.skipAnimations).
 *
 * 왜: headless/숨김 창에서는 rAF가 멈춰 exit 애니메이션이 영원히 안 끝나고,
 * `AnimatePresence mode="wait"`가 다음 화면을 영영 못 올린다 — Playwright
 * 재실사(공정 5 exit)와 로컬 E2E가 전부 여기 걸린다. 플래그는 명시적 opt-in
 * 이며 실사용 UX에는 아무 영향이 없다.
 */

import { MotionGlobalConfig } from 'framer-motion';

if (typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('e2e-no-anim')) {
  MotionGlobalConfig.skipAnimations = true;
  (window as unknown as Record<string, unknown>).__motionKilled = true;
}

export function E2EMotionKill() {
  return null;
}
