/**
 * O3 방2 activation 계약 — 자동 deep review 0 (BLUEPRINT exit②).
 *
 * "deep review는 /argus:review만, auto-trigger는 CI 빨강"을 산문 규칙이 아니라
 * 구조로 고정한다 (instructions are not guards):
 *  ① 공개 명령 메뉴 = 정확히 5축 (review·check·history·settings·help).
 *     세부 워크플로는 skills/ 밖에 있어 명령이나 상시 컨텍스트가 아니다.
 *  ② deep-review 문(review)은 disable-model-invocation — 모델은 이 스킬을
 *     자동으로 열 수 없다(설명 자체가 ambient 컨텍스트에 실리지 않는다). 자동
 *     deep review는 프롬프트 규율이 아니라 플랫폼 구조로 0이 된다.
 *  ③ fan-out 폐포: 에이전트 fan-out 어휘(워커 이름·subagent 마커)는
 *     skills/review/ 서브트리 안에만 존재한다. 다른 어떤 스킬/훅에도 등장하면
 *     여기가 빨간불 — 조용한 경로에 fan-out 와이어를 꽂는 회귀를 막는다.
 *  ④ 구 단계 스킬 디렉토리(clarify/team/verify/boss/revise)는 부활 금지 —
 *     본문은 review/의 step 파일로만 존재한다.
 *  ⑤ help는 공개 표면만 가르친다 (은퇴 명령 재교육 금지).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');
const SKILLS = path.join(REPO_ROOT, 'argus-plugin-v2', 'skills');

/** 스킬 frontmatter를 조야하게 파싱한다 (name / user-invocable / disable-model-invocation). */
function frontmatter(file: string): Record<string, string> {
  const body = fs.readFileSync(file, 'utf8');
  const m = /^---\n([\s\S]*?)\n---/.exec(body);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1]!.split('\n')) {
    const kv = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]!] = kv[2]!.trim();
  }
  return out;
}

function skillDirs(): string[] {
  return fs.readdirSync(SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(SKILLS, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();
}

// team.md가 실제로 쓰는 fan-out 어휘의 지문: 워커 에이전트 스폰 마커.
// (one-install 이전 조사에서 이 패턴은 스킬 20개 중 team 한 곳에만 존재했다.)
const FANOUT = /argus:(domain-reviewer|evidence-reviewer|risk-reviewer|synthesizer)|\b(domain-reviewer|evidence-reviewer|risk-reviewer|synthesizer)\b|subagent_type|Task tool.*parallel|에이전트를 spawn/;

describe('activation 계약 — 자동 deep review 0 (O3 방2, exit②)', () => {
  it('① 공개 메뉴는 제품 루프를 포함한 정확히 6축 — 내부 워크플로는 명령이 아니다', () => {
    const visible: string[] = [];
    for (const dir of skillDirs()) {
      const fm = frontmatter(path.join(SKILLS, dir, 'SKILL.md'));
      if (fm['user-invocable'] !== 'false') visible.push(dir);
    }
    expect(visible.sort()).toEqual(['check', 'help', 'history', 'loop', 'review', 'settings']);
  });

  it('② deep-review 문(review)은 모델이 자동으로 열 수 없다', () => {
    const fm = frontmatter(path.join(SKILLS, 'review', 'SKILL.md'));
    expect(fm['disable-model-invocation'], 'review: disable-model-invocation 필수').toBe('true');
    // 조용한 축(check/history/settings/help)은 모델-호출 가능해야 한다 —
    // 전부 잠그면 자연어 기본이 죽는다 (침묵이 아니라 서비스가 목표).
    for (const quiet of ['check', 'history', 'loop', 'settings', 'help']) {
      const fm = frontmatter(path.join(SKILLS, quiet, 'SKILL.md'));
      expect(fm['disable-model-invocation'], `${quiet}: 조용한 축은 잠그지 않는다`).not.toBe('true');
    }
  });

  it('③ fan-out 어휘는 skills/review/ 안에만 존재한다 (훅 포함 폐포)', () => {
    const offenders: string[] = [];
    const sweep = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { sweep(p); continue; }
        if (!/\.(md|js|mjs|json)$/.test(e.name)) continue;
        if (p.includes(path.join('skills', 'review'))) continue; // 유일한 허용 구역
        if (FANOUT.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(REPO_ROOT, p));
      }
    };
    sweep(SKILLS);
    sweep(path.join(REPO_ROOT, 'argus-plugin-v2', 'hooks'));
    expect(offenders).toEqual([]);
    // 그리고 그 어휘가 review/team.md에 실재해야 한다 — 문만 있고 기계가 없으면
    // 이 게이트는 빈 폐포를 지키는 셈이다.
    expect(FANOUT.test(fs.readFileSync(path.join(SKILLS, 'review', 'team.md'), 'utf8'))).toBe(true);
  });

  it('④ 구 단계 스킬 디렉토리는 부활 금지 — step 파일은 review/ 안에 실재', () => {
    for (const retired of ['clarify', 'team', 'verify', 'boss', 'revise']) {
      expect(fs.existsSync(path.join(SKILLS, retired)), `skills/${retired}는 은퇴했다`).toBe(false);
    }
    for (const step of ['pipeline', 'clarify', 'team', 'verify', 'boss', 'revise']) {
      expect(fs.existsSync(path.join(SKILLS, 'review', `${step}.md`)), `review/${step}.md 실재`).toBe(true);
    }
  });

  it('⑤ help는 공개 표면만 가르친다', () => {
    const help = fs.readFileSync(path.join(SKILLS, 'help', 'SKILL.md'), 'utf8');
    const taught = new Set([...help.matchAll(/\/argus:([a-z-]+)/g)].map((m) => m[1]!));
    const allowed = new Set(['loop', 'review', 'check', 'history', 'settings', 'help', 'doctor']);
    const leaks = [...taught].filter((t) => !allowed.has(t));
    expect(leaks, 'help가 은퇴 명령을 다시 가르친다').toEqual([]);
  });
});
