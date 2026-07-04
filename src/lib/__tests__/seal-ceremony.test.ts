/**
 * Seal-ceremony contract (P1-A3, polish audit 2026-07-03 — 07 S1~S4).
 *
 * The preview-screenshot check may not run in every environment, so the
 * ceremony's ADOPTION CONDITIONS (master §4) are pinned as text-level
 * assertions, the same way design-register-contract.test.ts works:
 *
 *   1. reduced-motion stops every seal-* animation (정지 프레임).
 *   2. the ceremony is skippable by tap (건너뛰기 affordance).
 *   3. new classes live in the seal-* namespace only — never bp-*
 *      (the landing's ceremony register must not leak into the app).
 *   4. the certificate never silently promotes an AI line to user-authored
 *      (ai_surfaced fallback carries its honest label).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
const sealMoment = readFileSync(
  join(ROOT, 'components', 'workspace', 'progressive', 'SealMoment.tsx'),
  'utf8',
);
const sealStamp = readFileSync(
  join(ROOT, 'components', 'workspace', 'progressive', 'SealStamp.tsx'),
  'utf8',
);

const SEAL_ANIMS = ['seal-press', 'seal-thud', 'seal-ink-ring', 'seal-line-write', 'seal-glint-app'];

describe('seal ceremony — CSS keyframes (07 S1)', () => {
  it('defines every ceremony keyframe in the app register', () => {
    for (const name of SEAL_ANIMS) {
      expect(css, `@keyframes ${name} missing`).toContain(`@keyframes ${name}`);
      expect(css, `.${name} class missing`).toContain(`.${name}`);
    }
  });

  it('prefers-reduced-motion freezes every seal-* animation', () => {
    // The reduced-motion block must name all five classes with animation: none.
    const rmBlocks = css
      .split('@media (prefers-reduced-motion: reduce)')
      .slice(1)
      .map((b) => b.slice(0, b.indexOf('}\n}') + 3));
    const joined = rmBlocks.join('\n');
    for (const name of SEAL_ANIMS) {
      expect(joined, `${name} not stopped under reduced motion`).toContain(name);
    }
    // the ink line must also resolve to its final frame, not a hidden one
    expect(joined).toContain('clip-path: none');
  });
});

describe('seal ceremony — component contract (07 S2~S4)', () => {
  it('ceremony scene is tap-skippable (의식은 제안이지 구속이 아니다)', () => {
    expect(sealMoment).toContain("setScene('sealed')");
    expect(sealMoment).toContain('건너뛰기');
  });

  it('reduced motion bypasses the ceremony scene entirely', () => {
    expect(sealMoment).toContain('useReducedMotion');
    expect(sealMoment).toMatch(/reducedMotion \? 'sealed' : 'sealing'/);
  });

  it('uses only the seal-* namespace — the landing bp-* register must not leak', () => {
    for (const src of [sealMoment, sealStamp]) {
      expect(src).not.toMatch(/bp-seal-stamp/);
      expect(src).not.toMatch(/--bp-/);
      expect(src).not.toMatch(/className=["'`][^"'`]*\bbp-/);
    }
  });

  it('certificate keeps honest provenance — the AI fallback line is labeled', () => {
    // human_judgment is the first-class quote; the predicate fallback must carry
    // the "AI가 대신 적어둔 확인 질문" label (never relabeled as the user's own).
    expect(sealMoment).toContain('human_judgment');
    expect(sealMoment).toContain('AI가 대신 적어둔 확인 질문');
  });

  it('the stamp carries only name and date — no verdict vocabulary', () => {
    for (const re of [/\bscore\b/, /\bgrade\b/, /\btier\b/, /점수/, /등급/, /잘했/, /훌륭/]) {
      expect(sealStamp.toLowerCase()).not.toMatch(re);
    }
  });
});

// The CLOSING seal (닫는 봉인, 2026-07-04). An early rope tied at OPEN makes a
// contract, and the closing SealMoment used to short-circuit straight to the
// plain DecisionContractCard — the engaged user who bound early never saw the
// stamp→certificate ceremony. These pin the fix so it can't silently regress.
describe('seal ceremony — closing scene (닫는 봉인)', () => {
  it('accepts a `closing` prop', () => {
    expect(sealMoment).toMatch(/closing\??\s*[:=]/);
  });

  it('a not-yet-closed contract in the closing scene plays the ceremony instead of delegating', () => {
    // The 298 delegate-to-card gate must be conditioned on NOT playing the closing ceremony.
    expect(sealMoment).toContain('closing && !contract?.closed_at');
    expect(sealMoment).toMatch(/scene === 'ask' && !playClosingCeremony/);
  });

  it('stamps closed_at when closing so a reload shows the calm card, not a replay', () => {
    // Both seal paths (main + manual recovery) must stamp closed_at under closing.
    const stamps = sealMoment.match(/closing \? new Date\(now\)\.toISOString\(\)/g) || [];
    expect(stamps.length).toBeGreaterThanOrEqual(2);
  });

  it('the closing recovery seal augments an existing rope — never clobbers it', () => {
    // manualSeal must augmentContract when a contract already exists (preserve the
    // user's early lean) rather than rebuilding a fresh one.
    expect(sealMoment).toMatch(/existing\s*\?\s*augmentContract\(existing, \[\], now, iv\)/);
  });
});
