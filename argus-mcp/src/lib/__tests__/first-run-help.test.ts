import { describe, expect, it } from 'vitest';
import { buildFirstRunHelp, isHumanTerminal } from '../first-run-help.js';

/**
 * 첫 화면 가드 (2026-07-30) — 사람이 직접 실행한 순간이 "조용한 매달림"이면
 * 고장과 구분되지 않는다. 빨간불 조건:
 *   · 연결 명령 두 줄(Claude Code / Codex)이 빠지는 것
 *   · 카드가 화면 하나를 넘게 자라는 것 (여기서 강의 금지)
 *   · 파이프(호스트) 실행을 사람 터미널로 오판하는 것
 */

describe('first-run help', () => {
  it('두 호스트의 연결 명령이 양쪽 언어에 다 있다', () => {
    for (const loc of ['ko', 'en'] as const) {
      const s = buildFirstRunHelp(loc);
      expect(s).toContain('claude mcp add argus');
      expect(s).toContain('codex mcp add argus-decision');
      expect(s).toContain('argus-decision-mcp connect');
    }
  });

  it('화면 하나를 넘지 않는다 (언어당 16줄 이하)', () => {
    for (const loc of ['ko', 'en'] as const) {
      expect(buildFirstRunHelp(loc).split('\n').length).toBeLessThanOrEqual(16);
    }
  });

  it('배울 명령이 없다는 핵심 온램프가 들어 있다', () => {
    expect(buildFirstRunHelp('ko')).toContain('평소처럼 결정을 말하면');
    expect(buildFirstRunHelp('en')).toContain('nothing to learn');
  });

  it('파이프 stdin(호스트)은 사람 터미널이 아니다', () => {
    expect(isHumanTerminal({ isTTY: undefined })).toBe(false);
    expect(isHumanTerminal({ isTTY: false })).toBe(false);
    expect(isHumanTerminal({ isTTY: true })).toBe(true);
  });
});
