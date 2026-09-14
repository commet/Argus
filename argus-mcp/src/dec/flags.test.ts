import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * **모르는 깃발은 조용히 버려지지 않는다** — 그리고 그 규율이 새 명령에서
 * 저절로 지켜지게 한다.
 *
 * 2026-09-09 에 `dec-rehearse` 가 `--clause` 를 조용히 버려서, 내가 안 물은
 * 질문의 답이 답처럼 돌아왔다. 그때 그 명령 하나만 고쳤다.
 *
 * 2026-09-10 에 `dec-sign --adopted 2026-07-01` 을 쳤더니 **오늘 날짜로
 * 서명됐다.** `--adopted` 라는 깃발이 아예 없는데(`--today` 다) 조용히
 * 버려진 것이다. 서명 날짜는 불변식 ②(서명 대리 불가)가 지키는 값인데,
 * 부른 사람이 말한 날 대신 기계가 고른 날이 들어갔다. 세어 보니 **16개 중
 * 14개가 같은 상태였다** — 고친 것이 일반화되지 않았다.
 *
 * 손으로 관리하는 목록은 같이 늙는다. 그래서 소스를 읽어서 강제한다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = fs.readFileSync(path.join(HERE, 'dec-cli.ts'), 'utf8');

/** `runDec*Cli` 함수 하나하나의 본문. */
function commandBodies(): { name: string; body: string }[] {
  const heads = [...SOURCE.matchAll(/export (?:async )?function (runDec\w+Cli)\(/g)];
  return heads.map((head, i) => ({
    name: head[1]!,
    body: SOURCE.slice(head.index!, i + 1 < heads.length ? heads[i + 1]!.index! : SOURCE.length),
  }));
}

/** 그 명령이 **실제로 읽는** 깃발. */
function flagsRead(body: string): string[] {
  return [...new Set([
    ...[...body.matchAll(/flag\(args,\s*'(--[a-z-]+)'\)/g)].map((m) => m[1]!),
    ...[...body.matchAll(/args\.includes\('(--[a-z-]+)'\)/g)].map((m) => m[1]!),
    // `dec-amend` 는 `put('decision', '--decision')` 처럼 헬퍼를 거쳐 읽는다.
    // 이걸 안 보면 멀쩡한 깃발 여섯을 "아무도 안 읽는다"고 신고한다 (실측).
    ...[...body.matchAll(/put\('[a-z_]+',\s*'(--[a-z-]+)'\)/g)].map((m) => m[1]!),
    // `argusDirOf` 가 대신 읽는다.
    ...(/argusDirOf\(args/.test(body) ? ['--argus-dir'] : []),
  ])];
}

/** 그 명령이 **받는다고 선언한** 깃발. */
function flagsDeclared(body: string): string[] | null {
  const call = /rejectUnknownFlags\(args,\s*'[a-z-]+',\s*\[([^\]]*)\]\)/.exec(body);
  if (!call) return null;
  return [...call[1]!.matchAll(/'(--[a-z-]+)'/g)].map((m) => m[1]!);
}

describe('CLI 깃발 — 조용한 무시가 없다', () => {
  it('모든 dec 명령이 모르는 깃발을 거절한다', () => {
    const silent = commandBodies()
      .filter((c) => flagsDeclared(c.body) === null)
      .map((c) => c.name);
    expect(silent, `이 명령들이 모르는 깃발을 조용히 버린다: ${silent.join(', ')}`).toEqual([]);
  });

  it('읽는 깃발은 전부 선언돼 있다 (자기 깃발을 자기가 거절하지 않는다)', () => {
    const problems: string[] = [];
    for (const { name, body } of commandBodies()) {
      const declared = flagsDeclared(body);
      if (!declared) continue;
      const missing = flagsRead(body).filter((f) => !declared.includes(f));
      if (missing.length > 0) problems.push(`${name}: ${missing.join(' ')}`);
    }
    expect(problems, `읽으면서 선언 안 한 깃발: ${problems.join(' · ')}`).toEqual([]);
  });

  it('선언한 깃발은 전부 읽힌다 (아무도 안 읽는 깃발을 받아 주지 않는다)', () => {
    const problems: string[] = [];
    for (const { name, body } of commandBodies()) {
      const declared = flagsDeclared(body);
      if (!declared) continue;
      const read = flagsRead(body);
      const dead = declared.filter((f) => !read.includes(f));
      if (dead.length > 0) problems.push(`${name}: ${dead.join(' ')}`);
    }
    expect(problems, `받는다고 해 놓고 안 읽는 깃발: ${problems.join(' · ')}`).toEqual([]);
  });

  it('명령이 하나라도 잡혀 있다 (정규식이 죽으면 이 파일 전체가 거짓 초록이 된다)', () => {
    expect(commandBodies().length).toBeGreaterThan(10);
  });
});

/** `src/dec/` 전체의 화면 글에서 "명령 + 깃발" 을 뽑는다 (주석은 걷는다). */
function screenCommands(): { file: string; command: string; flags: string[] }[] {
  const root = path.resolve(HERE);
  const out: { file: string; command: string; flags: string[] }[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.ts$/.test(e.name) || /\.test\.ts$/.test(e.name)) continue;
      const text = fs.readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')   // 블록 주석
        .replace(/^\s*\/\/.*$/gm, '');       // 줄 주석
      for (const line of text.split('\n')) {
        // 한 줄에 명령이 둘일 수 있다 — 각 명령부터 줄 끝까지를 그 명령의 몫으로 본다.
        const hits = [...line.matchAll(/\b(dec-[a-z-]+)\b/g)];
        hits.forEach((hit, i) => {
          const until = i + 1 < hits.length ? hits[i + 1]!.index! : line.length;
          const tail = line.slice(hit.index! + hit[1]!.length, until);
          const flags = [...tail.matchAll(/(--[a-z-]+)/g)].map((m) => m[1]!);
          if (flags.length > 0) out.push({ file: path.relative(root, full), command: hit[1]!, flags });
        });
      }
    }
  };
  walk(root);
  return out;
}

describe('화면이 가르치는 명령은 그대로 쳐서 돈다', () => {
  it('화면에 적힌 깃발을 그 명령이 실제로 받는다', () => {
    // 명령 이름 → 받는 깃발
    const accepts = new Map<string, string[]>();
    for (const { body } of commandBodies()) {
      const call = /rejectUnknownFlags\(args,\s*'([a-z-]+)',\s*\[([^\]]*)\]\)/.exec(body);
      if (call) accepts.set(call[1]!, [...call[2]!.matchAll(/'(--[a-z-]+)'/g)].map((m) => m[1]!));
    }

    const broken: string[] = [];
    for (const { file, command, flags } of screenCommands()) {
      const known = accepts.get(command);
      if (!known) continue; // 이 저장소 밖 명령이거나 이름만 언급한 것
      const bad = flags.filter((f) => !known.includes(f));
      if (bad.length > 0) broken.push(`${file}: ${command} ${bad.join(' ')}`);
    }
    expect(broken, `화면이 안 받는 깃발을 가르친다: ${broken.join(' · ')}`).toEqual([]);
  });
});
