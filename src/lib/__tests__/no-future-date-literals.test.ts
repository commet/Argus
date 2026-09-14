import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * **테스트에 미래 날짜를 글자로 박지 않는다.**
 *
 * 2026-08 에 `handlers.test.ts` 가 `dueDate: '2026-09-01'` 을 "미래"라고 적었다.
 * 09-02 부터 그것은 과거가 됐고, 기한을 미래로만 받는 핸들러가 거절해 테스트
 * 둘이 빨간불이 됐다 — **코드는 한 줄도 안 바뀌었는데 달력이 지나서** 깨진
 * 것이고, 18일 뒤에야 발견됐다.
 *
 * 오늘 기준 미래인 날짜 글자는 **전부 언젠가 반드시 과거가 된다.** 그래서
 * 지금 통과하는 것이 안전을 뜻하지 않는다. 상대 날짜로 적으면 안 터진다:
 *
 *   const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
 *
 * **과거 날짜는 안 잡는다** — "지난 약속"(`2020-01-01`)처럼 과거인 것이 뜻인
 * 값이 있고, 그건 시간이 지나도 과거로 남는다.
 *
 * ## 이 검사는 판정이 아니라 조기경보다 (2026-09-10 실측)
 *
 * 글자만 봐서는 **그 값이 실제 시계와 대조되는지 알 수 없다.** 그래서 이
 * 검사는 양쪽으로 틀린다 — 같은 날 실측으로 둘 다 확인했다:
 *
 * - **놓친다.** 앱 존의 `epistemic-agency-e2-control-plane.test.ts` 는 만기를
 *   `Date.parse(NOW) + 365일` 로 *계산*해서 글자가 없었지만, `NOW` 가 고정
 *   literal 이라 결국 터지는 폭탄이었다. 이 검사는 초록이었다.
 * - **헛짚는다.** MIT 존의 `schema-validation.test.ts` 는 `check_by` 에 미래
 *   날짜를 박았지만 zod 파싱만 해서 시계를 안 본다. 폭탄이 아니다.
 *
 * 판정은 `npm run test:future` 다 — 달력을 밀어 놓고 같은 스위트를 돌리므로
 * 놓치지도 헛짚지도 않는다. 이 검사는 스위트를 안 돌리고 빨리 답하는 값으로
 * 남긴다. **여기가 초록인 것을 "달력에 안 매였다"의 증거로 쓰지 않는다.**
 */

const ROOTS = ['src', 'method-harness'];

/**
 * **기한을 뜻하는 칸에 박힌 날짜만 본다.** 폭탄은 "저장된 기한이 *실제 시계*와
 * 비교될 때" 터진다. 그래서 셋을 안 잡는다:
 *  - 함수에 넘기는 **가짜 오늘** (`isCheckpointDue(h, '2027-01-01')`) — 실제
 *    시계를 안 보므로 시간이 지나도 안 깨진다
 *  - 일부러 둔 **먼 미래 표식** (`2099-…`) — 이 제품의 수명 안에 안 지나간다
 *  - 과거 날짜 — 시간이 지나도 과거로 남는다
 */
const DEADLINE_FIELD = /\b(due_?[aA]t|dueDate|expires?_?[aA]t|check_?by|check_?in_?at|next_review|review)\s*:\s*$/;
const DATE = /['"](\d{4}-\d{2}-\d{2})(?:T[\d:.]+Z?)?['"]/g;
/** 이 제품의 수명 안에 지나갈 날인가 — 넘으면 표식으로 본다. */
const HORIZON_YEARS = 5;

function testFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') testFiles(full, out); continue; }
    if (/\.test\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('테스트가 달력에 매여 있지 않다', () => {
  it('미래 날짜를 글자로 박은 테스트가 없다 (오늘 미래면 언젠가 과거다)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + HORIZON_YEARS * 365 * 86_400_000).toISOString().slice(0, 10);
    const bombs: string[] = [];

    for (const root of ROOTS) {
      for (const file of testFiles(root)) {
        const src = fs.readFileSync(file, 'utf8');
        const lines = src.split('\n');
        lines.forEach((line, i) => {
          if (line.includes('no-future-date-literals')) return;   // 이 파일의 설명
          for (const m of line.matchAll(DATE)) {
            const date = m[1]!;
            // 일부러 넣은 **잘못된 날짜**(`2026-13-45`)는 기한이 아니라 나쁜 입력
            // 표본이다. 글자 비교로만 보면 미래로 읽힌다.
            const parsed = new Date(`${date}T00:00:00Z`);
            // `toISOString()` 은 잘못된 날짜에 던진다 — 잡는 쪽이 죽으면 안 된다.
            if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue;
            if (date <= today || date > horizon) continue;
            // 이 날짜 바로 앞이 기한을 뜻하는 칸 이름인가.
            const before = line.slice(0, m.index ?? 0);
            if (!DEADLINE_FIELD.test(before)) continue;
            bombs.push(`${file}:${i + 1}  ${date}  — ${line.trim().slice(0, 70)}`);
          }
        });
      }
    }

    expect(
      bombs,
      '오늘 기준 미래인 날짜가 테스트에 박혀 있다. 그 날이 지나면 코드를 안 고쳐도 빨간불이 된다.\n'
        + '상대 날짜로 바꿔라 (예: new Date(Date.now() + 7 * 86_400_000).toISOString()).\n'
        + bombs.join('\n'),
    ).toEqual([]);
  });
});
