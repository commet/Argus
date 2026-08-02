import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(
  new URL('../../../../app/[locale]/workspace/page.tsx', import.meta.url),
  'utf8',
);

describe('first heavy-path wait', () => {
  it('describes the real work without staging a fictional crew', () => {
    expect(page).toContain("L('내 기준과 상황을 읽는 중'");
    expect(page).toContain("L('내가 적은 상황'");
    expect(page).not.toContain('<AvatarRow personas={previewPersonas} />');
    expect(page).not.toContain('<WorkerAvatar persona={p} size="sm" />');
  });

  it('labels the streamed real question as a question, not as a summary', () => {
    expect(page).toContain("L('지금 확인할 질문', 'The question to check now')");
    expect(page).not.toContain("L('지금 이해한 상황', 'What I heard')");
  });
});
