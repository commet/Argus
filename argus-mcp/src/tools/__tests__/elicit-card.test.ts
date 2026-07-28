/**
 * Elicitation 카드 실증 — 봉인 때 "질문 형식 카드"가 실제로 발사되는가.
 * 카드의 정본은 MCP elicitation/create (lib/elicit.ts → server.elicitInput).
 * Claude Code는 이걸 네이티브 다이얼로그로 자동 렌더(문서 확인). 여기서는 서버가
 * 그 요청을 **올바른 메시지·스키마로 실제 발사하는지**를 mock elicitor로 가로채
 * 증명한다 — 호스트 렌더는 CC 문서가 보증, 발사는 이 테스트가 보증.
 *
 * 부수 발견도 못박는다: 미지원 호스트(elicitInput throw)에서 confirm_draft가
 * 어떻게 되는지 — 현재 동작을 명시(도구 설명과 어긋나면 그게 버그다).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../init-config.js';
import { seal } from '../seal.js';
import { setElicitor } from '../../lib/elicit.js';

let home: string, repoDir: string, argusDir: string, savedHome: string | undefined;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-elicit-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-elicit-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  argusDir = path.join(repoDir, '.argus');
  savedHome = process.env['ARGUS_HOME'];
  process.env['ARGUS_HOME'] = home;
});
afterEach(() => {
  setElicitor(null);
  if (savedHome === undefined) delete process.env['ARGUS_HOME']; else process.env['ARGUS_HOME'] = savedHome;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

async function call(tool: { handler: (a: Record<string, unknown>) => Promise<unknown> }, args: Record<string, unknown>) {
  const res = (await tool.handler(args)) as { structuredContent: { ok: boolean; surface: string; data: Record<string, unknown> } };
  return res.structuredContent;
}

const SEAL_ARGS = {
  id: 'q3-cutover', predicate: 'cutover downtime stays under five minutes', check_by: '2099-01-01',
  predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: '2026-07-13',
} as const;

describe('elicitation 카드 발사 (봉인 confirm_draft)', () => {
  it('카드가 예측 문구·확인일을 담아, 입력칸 없는 Accept/Decline으로 발사된다', async () => {
    let seen: { message: string; schema: Record<string, unknown> } | null = null;
    setElicitor(async (message, schema) => { seen = { message, schema }; return { action: 'accept', content: {} }; });

    await call(init, { argus_dir: argusDir });
    const res = await call(seal, { argus_dir: argusDir, ...SEAL_ARGS });

    // 카드가 실제로 발사됐다.
    expect(seen, '카드(elicitInput)가 발사되지 않음').not.toBeNull();
    const s = seen!;
    expect(s.message).toContain('cutover downtime stays under five minutes'); // 예측 원문
    expect(s.message).toContain('2099-01-01'); // 확인일
    const schema = s.schema as { required?: string[]; properties: Record<string, { type: string }> };
    expect(schema.required ?? []).toEqual([]);
    // 입력칸이 하나도 없어야 한다 (2026-07-28). 이 테스트는 2026-07-24에
    // `reword`/`check_by`가 있다는 것을 고정했는데, 그 두 칸이 바로 창업자의
    // Accept가 세 번 먹히지 않은 이유였다. Claude Code는 필드가 하나라도 있으면
    // Accept를 미리 선택하지 않고, 텍스트칸 안에서 Return은 제출이 아니라 다음
    // 줄로 이동한다. 그래서 "읽고 Accept"가 아무것도 보내지 않은 채 60초 뒤
    // 타임아웃으로 끝났다 (호스트 로그 60.018초). 확인만 받는 픽커는 칸을
    // 두지 않는다 — 고쳐 쓰기는 사용자가 대화로 말하면 모델이 다시 부른다.
    expect(Object.keys(schema.properties)).toEqual([]);

    // Accept(빈칸) → 사용자가 확언 → 그의 것으로 봉인.
    expect(res.ok).toBe(true);
    expect(res.data['status']).toBe('sealed');
    expect(res.data['predicate_owner']).toBe('user');
  });

  it('Decline → 아무것도 기록하지 않는다 (비-yes 존중)', async () => {
    setElicitor(async () => ({ action: 'decline' }));
    await call(init, { argus_dir: argusDir });
    const res = await call(seal, { argus_dir: argusDir, ...SEAL_ARGS });
    expect(res.ok).toBe(true);
    expect(res.data['sealed']).toBe(false);
  });

  it('미지원 호스트(elicitation capability 미선언)에서 confirm_draft는 봉인을 진행한다 (버그 수정)', async () => {
    // 실제 호스트를 충실히 재현: elicitor는 set이지만 capability 프로브가 false
    // (클라이언트가 elicitation을 선언하지 않음). canElicit()이 이제 프로브를 보므로
    // seal은 피커를 건너뛰고 봉인을 진행한다 — 조용한 드롭 없음.
    let elicitorCalled = false;
    setElicitor(async () => { elicitorCalled = true; throw new Error('should not be called'); }, () => false);
    await call(init, { argus_dir: argusDir });
    const res = await call(seal, { argus_dir: argusDir, ...SEAL_ARGS });
    expect(res.ok).toBe(true);
    expect(res.data['status']).toBe('sealed'); // 진행됨 (드롭 아님)
    // 피커를 못 띄우니 초안 출처를 위조하지 않는다 — ai_surfaced 그대로(정직한 미확인).
    expect(res.data['predicate_owner']).toBe('ai_surfaced');
    expect(elicitorCalled).toBe(false); // 미선언이면 elicitInput을 아예 부르지 않는다
  });
});
