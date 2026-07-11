/**
 * git 발견 — subprocess 없이 git_common_dir을 알아낸다 (정본 II-D의 발견 축).
 *
 * 왜 subprocess가 아닌가: v1 statusline이 실증한 원칙 — 이 코드는 도구 호출마다
 * 돌 수 있고, `git` 스폰은 가장 비싼 단일 동작이다. .git 파일/디렉토리를 직접
 * 읽으면 같은 답을 μs에 얻는다. (worktree의 .git은 `gitdir: <path>` 포인터
 * 파일이고, 그 gitdir 안의 `commondir` 파일이 본체를 가리킨다 — git 문서의
 * 공식 레이아웃이며 v1 statusline getGitBranch가 수개월 실사용으로 검증한 경로.)
 *
 * 반환은 항상 realpath — registry(II-D)가 실경로를 키로 쓰기 때문. 발견 실패는
 * null (조용한 기본값 생성 금지 — INIT_REQUIRED 판정은 호출자의 몫).
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_WALK = 32; // 파일시스템 루프 방어 — 32단이면 어떤 정상 리포도 닿는다

/** startDir에서 위로 걸어 올라가 가장 가까운 git 저장소의 common dir 실경로를
 *  돌려준다. 일반 리포·worktree·submodule 전부 지원. 없으면 null. */
export function gitCommonDirOf(startDir: string): string | null {
  let dir: string;
  try {
    dir = fs.realpathSync(startDir);
  } catch {
    return null;
  }
  for (let i = 0; i < MAX_WALK; i++) {
    const dotGit = path.join(dir, '.git');
    let st: fs.Stats | null = null;
    try {
      st = fs.statSync(dotGit);
    } catch {
      /* 이 층엔 없음 — 위로 */
    }
    if (st) {
      const gitdir = st.isDirectory() ? dotGit : resolvePointerFile(dotGit, dir);
      if (!gitdir) return null; // .git 파일이 있는데 못 읽는다 = 모른다고 답한다
      return resolveCommonDir(gitdir);
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null; // 루트 도달
    dir = parent;
  }
  return null;
}

/** worktree/submodule의 `.git` 포인터 파일: `gitdir: <절대 또는 상대 경로>`. */
function resolvePointerFile(dotGitFile: string, containingDir: string): string | null {
  let content: string;
  try {
    content = fs.readFileSync(dotGitFile, 'utf8');
  } catch {
    return null;
  }
  const m = /^gitdir:\s*(.+?)\s*$/m.exec(content);
  if (!m) return null;
  return path.isAbsolute(m[1]) ? m[1] : path.resolve(containingDir, m[1]);
}

/** gitdir 안의 `commondir` 파일이 있으면 그것이 본체(.git)다 — worktree 케이스.
 *  없으면 gitdir 자신이 common dir이다 — 일반 리포·submodule 케이스. */
function resolveCommonDir(gitdir: string): string | null {
  const commondirFile = path.join(gitdir, 'commondir');
  let target = gitdir;
  try {
    const rel = fs.readFileSync(commondirFile, 'utf8').trim();
    target = path.isAbsolute(rel) ? rel : path.resolve(gitdir, rel);
  } catch {
    /* commondir 파일 없음 = worktree 아님 — gitdir 자신이 답 */
  }
  try {
    return fs.realpathSync(target);
  } catch {
    return null; // 가리키는 곳이 실재하지 않으면 발견 실패로 정직하게
  }
}
