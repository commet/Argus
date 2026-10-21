/**
 * 아주 작은 글로브 — `*` · `**` · `?` 만.
 *
 * 라이브러리를 안 쓰는 이유: 이 저장소는 의존을 늘리지 않고, 무엇보다
 * **사람이 규칙을 읽고 고칠 수 있어야 한다.** 여기서 되는 것이 전부라고
 * 한 문장으로 말할 수 있는 크기를 유지한다.
 *
 * 규칙:
 *  - `*`  는 `/` 를 안 넘는다 (`src/*.ts` 는 `src/a/b.ts` 를 안 잡는다)
 *  - `**` 는 `/` 를 넘는다 (`src/**` 는 `src/a/b.ts` 를 잡는다)
 *  - `?`  는 `/` 가 아닌 글자 하나
 *  - 끝이 `/` 면 그 아래 전부 (`argus-mcp/` = `argus-mcp/**`)
 *  - 경로 구분자는 `/` 로 맞춰서 비교한다 (윈도우에서도 같은 답)
 */

const ESCAPE = /[.+^${}()|[\]\\]/g;

export function globToRegExp(glob: string): RegExp {
  let pattern = glob.trim().replace(/\\/g, '/');
  if (pattern.endsWith('/')) pattern += '**';
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // `a/**/b` 의 `/` 하나까지 삼켜서 `a/b` 도 잡는다.
        if (pattern[i + 2] === '/') { out += '(?:.*/)?'; i += 2; }
        else { out += '.*'; i += 1; }
      } else out += '[^/]*';
      continue;
    }
    if (ch === '?') { out += '[^/]'; continue; }
    out += ch.replace(ESCAPE, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

export function globMatches(glob: string, filePath: string): boolean {
  return globToRegExp(glob).test(filePath.replace(/\\/g, '/').replace(/^\.\//, ''));
}

export function anyGlobMatches(globs: readonly string[], filePath: string): string | null {
  for (const glob of globs) if (globMatches(glob, filePath)) return glob;
  return null;
}
