#!/usr/bin/env node
/**
 * 능력 중복 검사기 — **짓기 전에 이미 있는지 훑었는가**를 기계로 묻는다.
 *
 * ── 왜 생겼나 (2026-08-18 사고) ──────────────────────────────────────
 *
 * 대화 로그에서 결정을 뽑는 기능을 앱 존에 새로 지었다. 그런데
 * `argus-mcp/src/v2/` 에 이미 있었다 — 훅 자동 발견, 큐, 게이트, 민감정보
 * 차단, 인용 byte 검증, 주간 캡, 그리고 **추출기를 갈아끼우는 포트**까지.
 * 심지어 사용자에게는 파일을 직접 고르라는, 있는 것보다 훨씬 나쁜 경로를 냈다.
 *
 * 원인은 "코드가 커서"가 아니다. **짓기 전에 훑는 기계적 단계가 없어서다.**
 * 결심("다음엔 잘 찾아보겠다")은 이 저장소가 이미 측정한 바로 그 실패다 —
 * 기계가 검사하지 않는 규약의 준수율은 90%였다 (n=60).
 *
 * ── 무엇을 검사하나 ──────────────────────────────────────────────────
 *
 * 1. 이 브랜치에서 **새로 추가된** 제품 소스 파일을 git 에서 찾는다 —
 *    커밋된 것과 **아직 커밋 안 한 것 둘 다.**
 *    (docs/receipts/ 의 일회성 실측 스크립트는 아키텍처가 아니라 제외.)
 * 2. 각 파일이 어떤 능력을 **주제로** 다루는지 본다 — 스침이 아니라 주제여야
 *    한다: 서로 다른 키워드 2개 이상, 또는 한 키워드 4번 이상, 또는 강한
 *    키워드(`extractCandidates` 처럼 그 능력에만 쓰이는 이름) 1개.
 * 3. 그 능력이 이미 사는 곳(`lives_at`)을 그 파일이 **한 번이라도 언급**했는지
 *    본다 — import 든 주석이든.
 * 4. 안 했으면 위반. "안 보고 지었다"로 간주한다.
 *
 * 스침을 봐주는 이유: 첫 판은 "전제" 한 단어에 51건이 터졌다. 그렇게 시끄러운
 * 검사기는 아무도 안 보고, 안 보는 검사기는 없는 것과 같다.
 *
 * 언급만 요구하는 이유: 재사용을 강제하면 정당한 재구현까지 막는다. 물어야
 * 하는 것은 "왜 안 썼는지 알고 있느냐"이지 "무조건 써라"가 아니다.
 * (창업자 지시: 기존 것이라고 다 좋은 것도 아니다. 활용·참고하되 목적을 봐라.)
 *
 * 실행: node scripts/check-capability-duplication.mjs [base-ref]
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'origin/main';

/**
 * git 을 부른다. 실패는 **빈 문자열이 아니라 null** 이다.
 * 빈 문자열로 뭉개면 "검사할 게 없다"로 조용히 통과한다 — 이 저장소가 이름 붙인
 * 바로 그 실패(공백을 조용히 메우기)를 검사기 자신이 저지르게 된다.
 */
const sh = (c) => {
  try {
    return execSync(c, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const map = JSON.parse(readFileSync(join(here, 'capability-map.json'), 'utf8'));

/** 제품 코드만 검사한다 — 리시트의 일회성 실측 스크립트는 아키텍처가 아니다. */
const PRODUCT_DIRS = ['src/', 'argus-mcp/src/', 'argus-plugin-v2/src/', 'method-harness/', 'scripts/'];

/** 문자열이 body 에 몇 번 나오는가 (겹침 없음). */
const countOf = (haystack, needle) => {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
};

/**
 * 그 파일을 가리켰는가. 전체 경로·파일명·확장자 뺀 이름·사는 디렉토리 중
 * 어느 것이든 인정한다 — 훑었다는 증거지 특정 표기법의 시험이 아니다.
 */
function mentions(body, loc) {
  const base = loc.split('/').pop();
  const stem = base.replace(/\.[^.]+$/, '');
  const dir = loc.slice(0, loc.length - base.length);
  // 디렉토리 언급은 그 디렉토리가 **구체적일 때만** 인정한다. `argus-mcp/src/v2/`
  // 는 그 능력이 사는 곳을 가리키지만 `src/lib/` 는 저장소 절반이라 아무 말도
  // 안 한 것과 같다. 세 칸 이상일 때만 증거로 친다.
  const dirSpecific = dir.split('/').filter(Boolean).length >= 3;
  return body.includes(loc) || body.includes(base) || body.includes(stem) || (dirSpecific && body.includes(dir));
}

/**
 * 이 파일이 그 능력을 **주제로** 다루는가.
 * 스침(약한 키워드 하나가 1~3번)은 주제가 아니다.
 */
function subjectOf(body, lower, cap) {
  const strong = (cap.strong_keywords || []).find((k) => lower.includes(k.toLowerCase()));
  if (strong) return { hit: strong, why: '고유 이름' };

  const counts = cap.keywords.map((k) => ({ k, n: countOf(lower, k.toLowerCase()) })).filter((x) => x.n > 0);
  if (counts.length === 0) return null;
  if (counts.length >= 2) return { hit: counts.map((c) => c.k).join('+'), why: '키워드 여럿' };
  if (counts[0].n >= 4) return { hit: counts[0].k, why: `${counts[0].n}번 반복` };
  return null;
}

// 1) 이 브랜치에서 새로 추가된 소스 파일.
const mergeBase = sh(`git merge-base ${BASE} HEAD`);
if (mergeBase === null) {
  console.error(`능력 중복 검사를 돌릴 수 없습니다 — '${BASE}' 와의 merge-base 를 못 찾았습니다.`);
  console.error(`base 를 인자로 주거나(예: node scripts/check-capability-duplication.mjs origin/main),`);
  console.error(`얕은 클론이면 fetch-depth: 0 으로 받으세요. 조용히 통과시키지 않습니다.`);
  process.exit(2);
}

const diff = sh(`git diff --name-only --diff-filter=A ${mergeBase}...HEAD`);
if (diff === null) {
  console.error(`git diff 가 실패했습니다 (base ${mergeBase}). 조용히 통과시키지 않습니다.`);
  process.exit(2);
}

// 아직 커밋 안 한 새 파일도 본다. 이걸 빼면 **짓는 동안에는 검사기가
// 조용하고**, 커밋한 뒤에야 말한다 — 물어야 할 때를 정확히 놓친다.
const untracked = sh('git ls-files --others --exclude-standard') ?? '';

const added = [diff, untracked]
  .filter(Boolean)
  .join('\n')
  .split('\n')
  .filter(Boolean)
  .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f))
  .filter((f) => !/__tests__|\.test\.|\.spec\./.test(f))
  .filter((f) => PRODUCT_DIRS.some((d) => f.startsWith(d)))
  .filter((f) => existsSync(f));

const violations = [];
const surveyed = [];

for (const file of added) {
  let body = '';
  try {
    body = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lower = body.toLowerCase();

  for (const cap of map.capabilities) {
    // 자기 자신이 그 능력의 정본이면 검사 대상이 아니다.
    if (cap.lives_at.includes(file)) continue;

    const subject = subjectOf(body, lower, cap);
    if (!subject) continue;

    const mentioned = cap.lives_at.some((loc) => mentions(body, loc));
    if (mentioned) {
      surveyed.push({ file, cap: cap.id, hit: subject.hit });
    } else {
      violations.push({ file, cap: cap.id, label: cap.label, hit: subject.hit, why: subject.why, livesAt: cap.lives_at });
    }
  }
}

const out = [];
out.push('능력 중복 검사 — 짓기 전에 훑었는가');
out.push('='.repeat(64));
out.push(`기준: ${BASE} · 새 제품 소스 파일 ${added.length}개`);
out.push('');

if (added.length === 0) {
  out.push('새로 추가된 소스 파일이 없습니다 — 검사할 것이 없습니다.');
} else {
  for (const f of added) out.push(`  + ${f}`);
  out.push('');
}

if (surveyed.length > 0) {
  out.push('훑은 흔적이 있는 것 (기존 자리를 언급함):');
  for (const s of surveyed) out.push(`  ✓ ${s.file} · ${s.cap} ("${s.hit}")`);
  out.push('');
}

out.push('-'.repeat(64));
if (violations.length === 0) {
  out.push('중복 의심 0 — 새 파일들이 건드리는 능력의 기존 자리를 모두 언급했습니다.');
} else {
  out.push(`중복 의심 ${violations.length}건 — 이미 있는 것을 안 보고 지었을 수 있습니다:`);
  out.push('');
  for (const v of violations) {
    out.push(`  ✗ ${v.file}`);
    out.push(`      능력: ${v.label} (${v.why}: "${v.hit}")`);
    out.push(`      이미 여기 있음: ${v.livesAt.join(', ')}`);
    out.push(`      → 쓰거나, 안 쓰는 이유를 파일 주석에 한 줄 적으세요.`);
    out.push('');
  }
  out.push('언급만 하면 통과합니다. 재사용을 강제하지 않습니다 — 기존 것이라고');
  out.push('다 좋은 건 아니므로, 물어야 하는 건 "알고 안 썼느냐"입니다.');
}

console.log(out.join('\n'));
process.exitCode = violations.length === 0 ? 0 : 1;
