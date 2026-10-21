import fs from 'node:fs';
import path from 'node:path';
import { BEGIN, END, MACHINE_NOTE_LEAD, exportPath, readBlock } from './export/emit.js';
import { decisionsDir } from './files.js';
import { splitDecisionFile, withoutAutoFooter } from './render.js';

/**
 * 출구 (§4.7 `dec leave`) — **입구는 둘인데 출구가 0이었다.**
 *
 * 떠나는 사람에게 무엇을 남길 것인가가 이 파일의 전부다. 셋을 한다:
 *
 *  ① **장부를 규칙 파일에 평문으로 굳힌다.** 표시(`argus:decisions`)와 지문을
 *     걷어내고 글만 남긴다. 남는 것은 남의 도구도 그냥 읽는 마크다운이다.
 *  ② **결정 파일에서 지문과 꼬리말을 걷는다.** 꼬리말은 "기계가 만든다 ·
 *     `dec-amend` 로 고쳐라"라고 적혀 있는데, 떠난 뒤엔 **없는 기계를 가리키고
 *     있지도 않은 명령을 가르치는 문장**이다.
 *  ③ **저장소에 걸린 훅을 뺀다.** 저장소의 `.claude/settings.json` 만 우리 것이다.
 *
 * ## 안 하는 것 — 그리고 그것을 말한다
 *
 * **떠남은 지움이 아니다.** 원장(`.argus/`)은 그대로 둔다 — 추가 전용 기록을
 * 우리가 지우면 그게 곧 불변식 ③ 위반이고, 지우는 것은 사람이 정한다.
 * 플러그인 자체는 여기서 못 끈다 (저장소 밖에 설치돼 있다). git 역사·이미
 * 나간 방출본·남의 클론도 못 건드린다. `dec redact` 가 자기 한계를 적어 두는
 * 것과 같은 규율이다 — **못 하는 것을 말하지 않으면 다 한 것처럼 보인다.**
 */

/** 저장소 뿌리 — `.argus` 의 부모. */
const repoOf = (argusDir: string): string => path.dirname(argusDir);

/** 화면에 적는 경로는 저장소 기준으로. 절대 경로는 길어서 안 읽힌다. */
const rel = (repo: string, target: string): string =>
  path.relative(repo, target).replace(/\\/g, '/') || '.';

export interface LeaveTarget {
  file: string;
  /** `inline` 표시를 걷고 평문으로 · `plain` 지문·꼬리말을 걷고 평문으로 · `skip` 할 것 없음 */
  action: 'inline' | 'plain' | 'skip';
  why?: string;
}

export interface HookTarget { file: string; removed: string[] }

export interface LeavePlan {
  /** 규칙 파일(`AGENTS.md`). 없으면 `null`. */
  rule_file: LeaveTarget | null;
  decisions: LeaveTarget[];
  hooks: HookTarget | null;
  /** 그대로 두는 것 — 사람이 정할 몫. */
  keeps: string[];
  /** 여기서 **못 하는 것**. 비워 두면 다 한 것처럼 보인다. */
  cannot: string[];
}

/** 훅 명령이 우리 것인가. 저장소의 다른 훅은 건드리지 않는다. */
const isOursHook = (command: string): boolean =>
  /argus/i.test(command) && !/session-guard/.test(command);

function planHooks(repo: string): HookTarget | null {
  const file = path.join(repo, '.claude', 'settings.json');
  let raw: string;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const hooks = (parsed as { hooks?: Record<string, unknown> } | null)?.hooks;
  if (!hooks || typeof hooks !== 'object') return null;

  const removed: string[] = [];
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const list = (group as { hooks?: unknown })?.hooks;
      if (!Array.isArray(list)) continue;
      for (const h of list) {
        const command = (h as { command?: unknown })?.command;
        if (typeof command === 'string' && isOursHook(command)) removed.push(`${event}: ${command}`);
      }
    }
  }
  return removed.length > 0 ? { file, removed } : null;
}

export function planLeave(argusDir: string): LeavePlan {
  const repo = repoOf(argusDir);

  let rule: LeaveTarget | null = null;
  const ruleFile = exportPath(argusDir);
  try {
    const text = fs.readFileSync(ruleFile, 'utf8');
    rule = readBlock(text)
      ? { file: ruleFile, action: 'inline' }
      : { file: ruleFile, action: 'skip', why: '우리 덩어리가 없다' };
  } catch { /* 방출한 적이 없다 */ }

  const decisions: LeaveTarget[] = [];
  const dir = decisionsDir(argusDir);
  let names: string[] = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort(); } catch { /* 없다 */ }
  for (const name of names) {
    const file = path.join(dir, name);
    let text: string;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    decisions.push(splitDecisionFile(text)
      ? { file, action: 'plain' }
      : { file, action: 'skip', why: '지문이 없다 — 이미 평문이거나 우리 것이 아니다' });
  }

  return {
    rule_file: rule,
    decisions,
    hooks: planHooks(repo),
    keeps: [
      // 저장소 기준으로 적는다 — 절대 경로는 화면에서 읽히지 않는다 (실측).
      `${rel(repo, path.join(argusDir, 'ledger'))} — 기록은 그대로 둔다. 지우는 것은 당신이 정한다.`,
      `${rel(repo, dir)} — 파일은 남는다. 평문이 되는 것뿐이다.`,
    ],
    cannot: [
      // **있는 이름을 적는다.** 처음엔 `argus-v2` 라고 썼는데 그런 플러그인은
      // 없다 (marketplace `argus` 의 플러그인 `argus`). 화면이 없는 명령을
      // 가르치는 것은 이 세션에서 이미 한 번 고친 결함이다 — 눈으로 읽어서 잡았다.
      '플러그인 자체는 여기서 못 끈다 — 저장소 밖에 깔려 있다. `/plugin` 에서 `argus@argus` 를 끄면 된다.',
      'git 역사에 이미 들어간 것은 못 건드린다 — 지금 표면만 평문이 된다.',
      '이미 나간 방출본·남의 클론·웹 거울은 못 건드린다.',
    ],
  };
}

export interface LeaveResult {
  rule_file: string | null;
  decisions_plain: number;
  hooks_removed: number;
  /** 손대려다 못 한 것 — 조용히 넘기지 않는다. */
  failed: { file: string; why: string }[];
}

/** 파일 하나를 통째로 바꿔 쓴다 (원자적으로). */
function replaceFile(file: string, next: string): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, next, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * 계획대로 손질한다. **원장에 떠남을 남긴 뒤에 부른다** — 순서가 반대면,
 * 파일은 평문인데 원장은 모르는 상태가 되고 다음 검사가 "전부 손으로 고쳤다"고
 * 비명을 지른다. 손댄 게 아니라 떠난 것인데.
 */
export function applyLeave(plan: LeavePlan): LeaveResult {
  const failed: { file: string; why: string }[] = [];

  let ruleDone: string | null = null;
  if (plan.rule_file && plan.rule_file.action === 'inline') {
    const file = plan.rule_file.file;
    try {
      const text = fs.readFileSync(file, 'utf8');
      const block = readBlock(text);
      if (block) {
        const start = text.indexOf(BEGIN);
        const end = text.indexOf(END);
        // 표시 둘과 지문을 걷고 본문만 남긴다. **밖은 바이트 그대로 둔다** —
        // 방출할 때 남의 글을 안 건드린 규율이 떠날 때도 같다.
        const body = inlineBody(block.body);
        replaceFile(file, text.slice(0, start) + body + text.slice(end + END.length));
        ruleDone = file;
      }
    } catch (e) { failed.push({ file, why: String((e as Error).message ?? e) }); }
  }

  let plain = 0;
  for (const target of plan.decisions) {
    if (target.action !== 'plain') continue;
    try {
      const text = fs.readFileSync(target.file, 'utf8');
      const split = splitDecisionFile(text);
      if (!split) continue;
      // **사람이 고친 파일도 그대로 굳힌다.** 이 저장소의 규율은 "고친 파일을
      // 덮어쓰지 않는다"인데, 여기서 쓰는 것은 원장이 다시 그린 본문이 아니라
      // **디스크에 있는 그대로**(`split.body`)다. 그의 글은 한 글자도 안 바뀌고
      // 지문과 꼬리말만 빠진다 — 떠나는 순간 디스크에 있는 것이 곧 그의 기록이다.
      replaceFile(target.file, `${withoutAutoFooter(split.body).replace(/\n*$/, '')}\n${LEFT_NOTE}`);
      plain++;
    } catch (e) { failed.push({ file: target.file, why: String((e as Error).message ?? e) }); }
  }

  let hooksRemoved = 0;
  if (plan.hooks) {
    try { hooksRemoved = stripHooks(plan.hooks.file); }
    catch (e) { failed.push({ file: plan.hooks.file, why: String((e as Error).message ?? e) }); }
  }

  return { rule_file: ruleDone, decisions_plain: plain, hooks_removed: hooksRemoved, failed };
}

/** 떠난 결정 파일의 꼬리말 — 없는 기계 대신 **있는 사실**을 적는다. */
const LEFT_NOTE = [
  '',
  '---',
  '',
  '이 파일은 이제 그냥 글이다. 아르고스는 이 저장소에서 떠났고, 여기 적힌 것을',
  '지키는지 봐 주는 기계는 없다. 고치고 싶으면 그냥 고치면 된다.',
  '',
].join('\n');

/** 규칙 파일에 굳힐 본문 — 기계 이야기를 사실로 바꾼다. */
function inlineBody(body: string): string {
  const at = body.indexOf(MACHINE_NOTE_LEAD);
  const kept = at < 0 ? body : body.slice(0, at);
  return `${kept.replace(/\n*$/, '')}\n\n`
    + '위는 아르고스가 남기고 간 기록이다. 이제 그냥 글이고, 지키는지 봐 주는\n'
    + '기계는 없다. 고치고 싶으면 그냥 고치면 된다.\n';
}

/** 우리 훅만 뺀다. 남의 훅과 다른 설정은 바이트 그대로. */
function stripHooks(file: string): number {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { hooks?: Record<string, unknown> };
  const hooks = parsed.hooks;
  if (!hooks) return 0;
  let removed = 0;

  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const keptGroups: unknown[] = [];
    for (const group of groups) {
      const list = (group as { hooks?: unknown })?.hooks;
      if (!Array.isArray(list)) { keptGroups.push(group); continue; }
      const kept = list.filter((h) => {
        const command = (h as { command?: unknown })?.command;
        const ours = typeof command === 'string' && isOursHook(command);
        if (ours) removed++;
        return !ours;
      });
      // 비어 버린 묶음은 남기지 않는다 — 빈 훅 묶음은 읽는 쪽을 헷갈리게 한다.
      if (kept.length > 0) keptGroups.push({ ...(group as object), hooks: kept });
    }
    if (keptGroups.length > 0) hooks[event] = keptGroups;
    else delete hooks[event];
  }
  if (Object.keys(hooks).length === 0) delete parsed.hooks;
  replaceFile(file, `${JSON.stringify(parsed, null, 2)}\n`);
  return removed;
}
