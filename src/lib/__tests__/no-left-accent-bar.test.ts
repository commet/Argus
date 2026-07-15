/**
 * 왼쪽 세로 악센트 바 금지 가드 (창업자 확정 지시, 2026-07-08).
 *
 * 텍스트 블록 왼쪽에 붙이는 금색 세로 바("손톱 모양" — border-l + accent)는
 * 화면마다 반복되며 싸구려 장치가 됐고, 창업자가 영구 금지했다 ("다신 쓰지마.
 * 절대 쓰지마"). 인용/강조가 필요하면 배경 틴트 블록이나 활자 위계를 쓴다.
 * 이 테스트는 사용자 대면 컴포넌트에서 그 패턴의 재등장을 CI에서 막는다.
 */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('디자인 금지 패턴 — 왼쪽 악센트 바', () => {
  it('src에 border-l + accent 세로 바가 없다', () => {
    let out = '';
    try {
      // -l: 파일명만. 히트가 없으면 grep이 exit 1 → catch에서 빈 결과로 처리.
      out = execFileSync(
        'git',
        // 임의-px(border-l-[3px])와 스케일 유틸(border-l-2) 두 형태 모두 잡는다 —
        // 텍스트 블록에 별도 border-[var(--accent)]로 세로 바를 그리는 패턴.
        ['grep', '-l', '-E', 'border-l-(\\[[0-9.]+px\\]|[0-9]+) border-\\[var\\(--accent\\)', '--', 'src/**/*.tsx'],
        { cwd: process.cwd(), encoding: 'utf8' },
      );
    } catch {
      out = '';
    }
    const offenders = out.split('\n').filter(Boolean);
    expect(
      offenders,
      `왼쪽 악센트 바(손톱 모양)는 영구 금지 — 배경 틴트 블록이나 활자 위계로 바꾸세요: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
