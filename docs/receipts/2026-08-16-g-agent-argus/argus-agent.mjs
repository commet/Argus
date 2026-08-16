#!/usr/bin/env node
/**
 * 판별 실험 G — 에이전트의 아르고스 (재정초 브리프 §4 G)
 *
 * 브리프의 실험 정의 그대로: "에이전트가 세션마다 하중 가정 3개를 봉인하고,
 * 훅·CI가 가정 위반 시 귀환을 강제한다. 측정: 조용한 오답이 시끄러운 귀환으로
 * 전환된 건수."
 *
 * 핵심 설계 규칙 (P5 시끄러운 실패):
 *   가정은 **기계 가독 술어**여야 한다. 산문 가정은 검사할 수 없고, 검사할 수
 *   없는 가정은 봉인이 아니라 메모다. 그래서 각 가정은 실행 가능한 check를
 *   갖고, check가 없으면 봉인 자체가 거부된다.
 *
 * 사용법:
 *   node argus-agent.mjs seal   <ledger.jsonl> <assumptions.json>   가정 봉인
 *   node argus-agent.mjs check  <ledger.jsonl> [--at <git-ref>]     가정 검사
 *
 * check의 종료 코드: 0 = 전 가정 유지, 1 = 위반 있음(= 귀환 강제).
 */
import { readFileSync, existsSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [, , cmd, ledgerPath, arg3] = process.argv;

// ---------------------------------------------------------------- 검사기 종류
// 각 검사기는 {holds:boolean, detail:string}을 낸다. 판단 개입 0 — 전부 기계.
const CHECKERS = {
  /**
   * 세션에 업로드된 정본 문서가 산출물에서 참조되는가.
   * 이 검사기가 이 실험의 이유다 — 파생물이 원본을 조용히 대체하는 실패를
   * 잡는 유일한 기계 장치. (§5.6의 사고가 이것으로 잡혔을 것)
   */
  uploads_referenced({ uploads_dir, search_paths, at }) {
    // 세션마다 경로가 다르므로 자동 해석을 허용한다 (훅에서 재사용하려면 필수).
    // 'auto' 또는 미지정이면 CLAUDE_SESSION_ID, 없으면 가장 최근 업로드 디렉토리.
    if (!uploads_dir || uploads_dir === 'auto') {
      const root = process.env.CLAUDE_UPLOADS_ROOT || `${process.env.HOME || '/root'}/.claude/uploads`;
      if (!existsSync(root)) return { holds: true, detail: '업로드 루트 없음' };
      const sid = process.env.CLAUDE_SESSION_ID;
      if (sid && existsSync(`${root}/${sid}`)) {
        uploads_dir = `${root}/${sid}`;
      } else {
        const dirs = readdirSync(root)
          .map((d) => ({ d, p: `${root}/${d}` }))
          .filter(({ p }) => { try { return statSync(p).isDirectory(); } catch { return false; } })
          .sort((a, b) => statSync(b.p).mtimeMs - statSync(a.p).mtimeMs);
        if (!dirs.length) return { holds: true, detail: '업로드 없음' };
        uploads_dir = dirs[0].p;
      }
    }
    if (!existsSync(uploads_dir)) {
      return { holds: true, detail: '업로드 없음 — 공백 아님(검사 대상 부재)' };
    }
    const files = readdirSync(uploads_dir).filter((f) => !f.startsWith('.'));
    if (files.length === 0) return { holds: true, detail: '업로드 없음' };

    // 정규화 대조: 사람은 같은 문서를 ARGUS-REFOUNDATION-BRIEF-2026-08-16 처럼
    // 하이픈을 넣어 부른다. 문자열 그대로 찾으면 위양성이 난다 — 양쪽에서
    // 영숫자만 남기고 비교한다. (첫 판이 실제로 여기서 위양성을 냈다)
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const haystack = [];
    for (const dir of search_paths || ['docs']) {
      let list = [];
      try {
        list = at
          ? execSync(`git ls-tree -r --name-only ${at} -- ${dir}`, { encoding: 'utf8' }).split('\n').filter(Boolean)
          : execSync(`find ${dir} -type f \\( -name '*.md' -o -name '*.json' -o -name '*.txt' -o -name '*.mjs' \\)`, { encoding: 'utf8' }).split('\n').filter(Boolean);
      } catch { /* 경로 없음 */ }
      for (const p of list) {
        if (!/\.(md|json|txt|mjs)$/.test(p)) continue;
        try {
          haystack.push(norm(at ? execSync(`git show ${at}:${p}`, { encoding: 'utf8', maxBuffer: 40e6 }) : readFileSync(p, 'utf8')));
        } catch { /* 읽기 실패는 건너뛴다 */ }
      }
    }
    const blob = haystack.join('\n');

    const unreferenced = [];
    for (const f of files) {
      // 업로드 파일명은 해시 접두사가 붙는다. 의미 있는 몸통만 뽑아 대조한다.
      const stem = f.replace(/^[0-9a-f]{6,}-/, '').replace(/\.[^.]+$/, '');
      const needle = norm(stem);
      if (needle.length < 8) continue; // 너무 짧은 이름은 우연 일치가 나온다
      if (!blob.includes(needle)) unreferenced.push(f);
    }
    return unreferenced.length === 0
      ? { holds: true, detail: `업로드 ${files.length}건 전부 산출물에서 참조됨` }
      : { holds: false, detail: `업로드된 정본이 산출물에서 한 번도 참조되지 않음: ${unreferenced.join(', ')}` };
  },

  /** 명령이 성공 종료하는가 (테스트·타입체크·린트 등) */
  cmd_exit_zero({ cmd: c, cwd }) {
    try {
      execSync(c, { stdio: 'pipe', cwd: cwd || process.cwd(), timeout: 900_000 });
      return { holds: true, detail: `성공: ${c}` };
    } catch (e) {
      const tail = String(e.stdout || e.stderr || e.message).trim().split('\n').slice(-3).join(' | ');
      return { holds: false, detail: `실패(${e.status}): ${c} — ${tail.slice(0, 200)}` };
    }
  },

  /** 파일이 존재하는가 */
  file_exists({ path }) {
    return existsSync(path)
      ? { holds: true, detail: `존재: ${path}` }
      : { holds: false, detail: `없음: ${path}` };
  },

  /** 변경이 한 라이선스 존에만 머무는가 (CLAUDE.md의 PR 규약) */
  zone_purity({ base }) {
    let files;
    try {
      files = execSync(`git diff --name-only ${base || 'origin/main'}...HEAD`, { encoding: 'utf8' })
        .split('\n').filter(Boolean);
    } catch (e) {
      return { holds: false, detail: `diff 실패 — ${String(e.message).slice(0, 120)}` };
    }
    const zone = (f) => (f.startsWith('argus-mcp/') || f.startsWith('argus-plugin-v2/') ? 'MIT' : f.startsWith('src/') ? 'app' : 'docs');
    const zones = [...new Set(files.map(zone))].filter((z) => z !== 'docs');
    return zones.length <= 1
      ? { holds: true, detail: `존 ${zones.length ? zones[0] : 'docs만'} · 파일 ${files.length}건` }
      : { holds: false, detail: `한 PR이 두 존을 건드림: ${zones.join(' + ')}` };
  },

  /** 원격 브랜치와 어긋나지 않았는가 */
  branch_synced({ remote }) {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      execSync(`git fetch ${remote || 'origin'} ${branch}`, { stdio: 'pipe' });
      const behind = execSync(`git rev-list --count HEAD..${remote || 'origin'}/${branch}`, { encoding: 'utf8' }).trim();
      return behind === '0'
        ? { holds: true, detail: `${branch} 최신` }
        : { holds: false, detail: `${branch}가 원격보다 ${behind}커밋 뒤처짐 — 남의 변경 위에 짓고 있다` };
    } catch (e) {
      return { holds: false, detail: `확인 불가 — ${String(e.message).slice(0, 120)}` };
    }
  },
};

// ---------------------------------------------------------------- seal
if (cmd === 'seal') {
  const spec = JSON.parse(readFileSync(arg3, 'utf8'));
  const stamp = spec.sealed_at;
  if (!stamp) { console.error('sealed_at을 명시하라 (결정론 — 스크립트가 시각을 지어내지 않는다)'); process.exit(2); }
  let n = 0;
  for (const a of spec.assumptions) {
    if (!a.check || !CHECKERS[a.check.type]) {
      console.error(`거부: "${a.id}" — 검사 불가능한 가정은 봉인이 아니라 메모다 (check.type 필요)`);
      process.exit(2);
    }
    appendFileSync(ledgerPath, JSON.stringify({ v: 1, event: 'assumption_sealed', session: spec.session, sealed_at: stamp, ...a }) + '\n');
    n += 1;
  }
  console.log(`봉인 ${n}건 → ${ledgerPath}`);
  process.exit(0);
}

// ---------------------------------------------------------------- check
if (cmd === 'check') {
  if (!existsSync(ledgerPath)) { console.error(`원장 없음: ${ledgerPath}`); process.exit(2); }
  const atIdx = process.argv.indexOf('--at');
  const at = atIdx > -1 ? process.argv[atIdx + 1] : null;
  const sealed = readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).filter((e) => e.event === 'assumption_sealed');

  const L = [];
  L.push('판별 실험 G — 봉인된 하중 가정 검사 (브리프 §4 G)');
  L.push('='.repeat(64));
  if (at) L.push(`검사 시점: ${at} (과거 상태 대조)`);
  L.push('');
  let violated = 0;
  for (const a of sealed) {
    const args = { ...(a.check.args || {}), at };
    const r = CHECKERS[a.check.type](args);
    if (!r.holds) violated += 1;
    L.push(`${r.holds ? '유지' : '위반'} · ${a.id}`);
    L.push(`     가정: ${a.stated}`);
    L.push(`     검사: ${a.check.type} → ${r.detail}`);
    if (!r.holds) L.push(`     귀환: ${a.on_violation}`);
    L.push('');
  }
  L.push('-'.repeat(64));
  L.push(`가정 ${sealed.length}건 · 유지 ${sealed.length - violated} · 위반 ${violated}`);
  L.push(violated
    ? '결과: 시끄러운 귀환 — 에이전트는 계속 진행하지 않는다.'
    : '결과: 전 가정 유지 — 진행 가능.');
  console.log(L.join('\n'));
  process.exit(violated ? 1 : 0);
}

console.error('사용법: argus-agent.mjs seal|check <ledger.jsonl> [...]');
process.exit(2);
