/**
 * 뮤테이션 프로브 — "초록이 무엇을 보장하는가"를 숫자로 답한다.
 *
 * 왜 있는가: 2026-07-29까지 이 리포는 테스트 3,893개가 전부 초록인 채로
 *   · 익명 사용자의 봉인된 판단이 가입 순간 사라지고
 *   · 공유·이메일·텔레그램·팀초대가 18일간 죽어 있고
 *   · 규칙 하나가 브라우저의 재확인을 크래시시키는
 * 상태였다. 초록은 "테스트가 돌았다"는 뜻이지 "코드가 지켜진다"는 뜻이 아니다.
 *
 * 이 스크립트는 대상 파일의 코드를 **일부러 망가뜨리고** 지정한 테스트가 빨간불이
 * 되는지 본다. 안 되면 그 줄은 사실상 아무도 안 지키고 있는 것이다(= survivor).
 * 손으로 한 번씩 하던 "일부러 깨보기"(인계 문서 §2 규율)를 기계에 맡긴 것.
 *
 * 새 의존성 없음 — Stryker 같은 정식 도구보다 훨씬 얕지만, 설치 0·설정 0이고
 * 파일 하나를 몇 분 안에 답해준다. 정식 도구로 갈지는 이 숫자를 본 뒤에 정한다.
 *
 * 사용법:
 *   node scripts/mutation-probe.mjs <소스파일> <테스트경로...>
 *
 * 예:
 *   node scripts/mutation-probe.mjs src/lib/decision-contract.ts \
 *     src/lib/__tests__/contract-phase.test.ts src/lib/__tests__/decision-contract.test.ts
 *
 * 출력:
 *   killed    = 망가뜨리자 테스트가 빨개짐 (가드가 진짜)
 *   SURVIVED  = 망가뜨려도 초록 (그 줄은 지켜지지 않는다) ← 읽어야 할 것
 *   kill rate = killed / (killed + survived)
 *
 * 안전: 원본을 메모리에 담고 매 시도마다 되돌린다. Ctrl-C/예외에도 finally로 복원한다.
 * 그래도 실행 전 커밋해 두는 걸 권한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [target, ...tests] = process.argv.slice(2);
if (!target || tests.length === 0) {
  console.error('사용법: node scripts/mutation-probe.mjs <소스파일> <테스트경로...>');
  process.exit(2);
}

/** 각 뮤테이터는 [설명, 정규식, 치환]. 의미를 뒤집되 파싱은 깨지 않는 것만 고른다. */
const MUTATORS = [
  ['비교 뒤집기 >=  → <',   /([^<>=!])>=/g, '$1<'],
  ['비교 뒤집기 <=  → >',   /([^<>=!])<=/g, '$1>'],
  ['비교 뒤집기 === → !==', /===/g, '!=='],
  ['비교 뒤집기 !== → ===', /!==/g, '==='],
  ['논리 && → ||',          /&&/g, '||'],
  ['논리 || → &&',          /\|\|/g, '&&'],
  ['부정 제거 (!x → x)',     /\(!([a-zA-Z_$][\w$.?]*)\)/g, '($1)'],
  ['true → false',          /\btrue\b/g, 'false'],
  ['false → true',          /\bfalse\b/g, 'true'],
  ['옵셔널 체이닝 제거',      /\?\./g, '.'],
];

const original = readFileSync(target, 'utf8');

/**
 * 주석·문자열 안의 위치는 세지 않는다. JSDoc 안의 `true`를 뒤집으면 절대 죽지 않고,
 * 그건 "가드가 없다"가 아니라 "코드가 아니다"다. 그걸 survivor로 세면 kill rate가
 * 실제보다 나쁘게 나오고, 나쁜 숫자를 못 믿게 되면 이 도구는 안 읽힌다.
 */
function codeMask(src) {
  const mask = new Uint8Array(src.length); // 1 = 주석/문자열 → 건너뜀
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      while (i < src.length && src[i] !== '\n') mask[i++] = 1;
    } else if (two === '/*') {
      while (i < src.length && src.slice(i, i + 2) !== '*/') mask[i++] = 1;
      mask[i++] = 1; mask[i++] = 1;
    } else if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
      const q = src[i]; mask[i++] = 1;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') mask[i++] = 1; mask[i++] = 1; }
      mask[i++] = 1;
    } else {
      i++;
    }
  }
  return mask;
}
const MASK = codeMask(original);

function runTests() {
  try {
    execFileSync('npx', ['vitest', 'run', ...tests, '--reporter=dot'], {
      stdio: 'pipe', shell: process.platform === 'win32', timeout: 600_000,
    });
    return 'green';
  } catch {
    return 'red';
  }
}

console.log(`대상: ${target}`);
console.log(`테스트: ${tests.join(' ')}`);
console.log('');
process.stdout.write('기준선 확인… ');
if (runTests() !== 'green') {
  console.error('\n🔴 손대기 전부터 빨간불이다. 먼저 테스트를 초록으로 만들어라.');
  process.exit(2);
}
console.log('초록 ✓\n');

let killed = 0;
const survivors = [];

try {
  for (const [label, re, replacement] of MUTATORS) {
    // 같은 뮤테이터로 만들 수 있는 자리들을 하나씩(첫 5개만) 시도한다.
    const positions = [...original.matchAll(re)]
      .map((m) => m.index)
      .filter((at) => !MASK[at])
      .slice(0, 5);
    for (const at of positions) {
      let applied = false;
      const mutated = original.replace(re, (match, ...rest) => {
        const offset = rest[rest.length - 2];
        if (offset !== at || applied) return match;
        applied = true;
        return match.replace(re.source.includes('$1') ? re : re, replacement).replace(/\$1/g, rest[0] ?? '');
      });
      if (!applied || mutated === original) continue;

      writeFileSync(target, mutated);
      const verdict = runTests();
      writeFileSync(target, original);

      const line = original.slice(0, at).split('\n').length;
      if (verdict === 'red') {
        killed++;
        process.stdout.write('.');
      } else {
        survivors.push({ label, line, snippet: original.split('\n')[line - 1]?.trim().slice(0, 90) ?? '' });
        process.stdout.write('S');
      }
    }
  }
} finally {
  writeFileSync(target, original); // 어떤 경로로 빠져나가도 원본 복원
}

const total = killed + survivors.length;
console.log('\n');
console.log(`시도 ${total}건 · killed ${killed} · SURVIVED ${survivors.length}`);
console.log(`kill rate: ${total ? Math.round((killed / total) * 100) : 0}%`);
if (survivors.length) {
  console.log('\n살아남은 뮤테이션 — 이 줄들은 지금 아무도 지키고 있지 않다:');
  for (const s of survivors) console.log(`  ${target}:${s.line}  [${s.label}]  ${s.snippet}`);
  console.log('\n각각에 대해 물어라: "이게 틀렸을 때 사용자에게 무슨 일이 나는가?"');
  console.log('답이 있으면 테스트를 추가하고, 없으면 그 코드가 왜 있는지 물어라.');
}
process.exit(0);
