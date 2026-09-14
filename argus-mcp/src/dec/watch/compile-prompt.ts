import { stripControlChars } from '../../v2/sanitize.js';
import { watchProblems, type WatchRule } from './rule.js';
import type { WatchDraft } from './draft.js';
import type { Clause } from '../rules/split.js';

/**
 * 조항을 "어긋난 걸 아는 방법"으로 옮길 때 **모델에게 주는 말**과, 모델이 낸
 * 답을 받는 자리.
 *
 * 모델은 여기서 한 번만 부른다 — 사람이 확인하는 순간에. 걸렸는지 판정하는
 * 자리(런타임)에는 절대 안 들어간다. 시공 계획 §7: *"걸렸는지 판정하는 자리에
 * 모델을 넣으면 되돌릴 수 없다."*
 *
 * 받는 쪽 규율:
 *  - **모양이 안 맞으면 통째로 버린다.** 반쯤 맞는 규칙을 조용히 메워 쓰면
 *    사람은 자기가 뭘 서명했는지 모르게 된다.
 *  - **정규식을 안 받는다.** 사람이 못 읽는 규칙은 고칠 수도 서명할 수도 없다.
 *  - **버리면 초안으로 돌아간다.** 모델이 없거나 답이 이상하면 글자만 보고 만든
 *    초안이 그대로 쓰인다 — 아무것도 안 되는 것보다 낫다.
 */

/** 남의 글을 프롬프트에 넣을 때의 울타리 (CLAUDE.md 주입 규약). */
function fence(text: string): string {
  return `<user-data>\n${stripControlChars(text).slice(0, 4000)}\n</user-data>`;
}

export function compileWatchPrompt(clause: Clause, draft: WatchDraft): string {
  return [
    '아래는 이 사람이 이미 쓰고 있던 규칙 문서의 한 조항이다.',
    '이 조항을 어겼는지 기계가 알아채려면 무엇을 보면 되는지 정하라.',
    '',
    `조항이 있던 자리: ${clause.file} · "${clause.section}"`,
    fence(clause.text),
    '',
    '글자만 보고 뽑은 초안이다. 더 나으면 고치고, 아니면 그대로 둬라:',
    fence(JSON.stringify(draft.rule, null, 1)),
    '',
    '지켜야 할 것:',
    '- 정규식을 쓰지 마라. phrases 는 사람이 읽는 문자열 그대로다.',
    '- paths 는 저장소 안의 자리다. `*` `**` `?` 만 쓴다. 절대경로·`..` 금지.',
    '- blind_spots 를 반드시 채워라. 이 규칙이 **못 잡는 것**을 사람 말로 적는다.',
    '  하나도 못 적겠으면 그건 다 잡는다는 뜻이 아니라 네가 안 본 것이다.',
    '- 조항에 없는 것을 지어내지 마라. 조항이 말하지 않은 파일·명령을 넣지 않는다.',
    '- 기계가 볼 수 있는 자리가 없으면 mode 를 "inject_only" 로 하고',
    '  paths·phrases 를 비워라. 그건 실패가 아니라 정직한 답이다.',
    '',
    '오직 이 모양의 JSON 하나만 답하라. 설명을 붙이지 마라:',
    '{"paths":[],"phrases":[],"except_paths":[],"except_phrases":[],"blind_spots":[],"mode":"machine"}',
  ].join('\n');
}

const MAX_ITEMS = 20;
const MAX_LEN = 120;
const BAD_GLOB = /^\/|^[A-Za-z]:|\.\./;

function stringList(value: unknown, label: string, problems: string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { problems.push(`${label} 이 목록이 아니다`); return []; }
  if (value.length > MAX_ITEMS) { problems.push(`${label} 이 ${value.length}개다 (최대 ${MAX_ITEMS})`); return []; }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') { problems.push(`${label} 에 글자가 아닌 것이 있다`); continue; }
    const trimmed = item.replace(/\s+/g, ' ').trim();
    if (!trimmed) { problems.push(`${label} 에 빈 값이 있다`); continue; }
    if (trimmed.length > MAX_LEN) { problems.push(`${label} 의 값이 너무 길다`); continue; }
    out.push(trimmed);
  }
  return out;
}

export type CompiledWatch =
  | { ok: true; rule: WatchRule }
  | { ok: false; problems: string[] };

/** 모델의 답을 받는 유일한 문. 통과 못 하면 초안으로 돌아간다. */
export function parseCompiledWatch(raw: string): CompiledWatch {
  const problems: string[] = [];
  let parsed: unknown;
  try {
    // 앞뒤에 붙은 말·코드 울타리를 걷어낸다. 그래도 JSON 이 아니면 버린다.
    const body = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('JSON 이 없다');
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch (error) {
    return { ok: false, problems: [`답을 읽을 수 없다: ${error instanceof Error ? error.message : String(error)}`] };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, problems: ['답이 객체가 아니다'] };
  const object = parsed as Record<string, unknown>;

  const mode = object['mode'];
  if (mode !== 'machine' && mode !== 'inject_only') problems.push('mode 가 machine 도 inject_only 도 아니다');

  const paths = stringList(object['paths'], 'paths', problems);
  for (const glob of paths) if (BAD_GLOB.test(glob)) problems.push(`저장소 밖을 가리키는 자리: ${glob}`);

  const rule: WatchRule = {
    paths,
    phrases: stringList(object['phrases'], 'phrases', problems),
    except_paths: stringList(object['except_paths'], 'except_paths', problems),
    except_phrases: stringList(object['except_phrases'], 'except_phrases', problems),
    blind_spots: stringList(object['blind_spots'], 'blind_spots', problems),
    mode: mode === 'inject_only' ? 'inject_only' : 'machine',
  };
  problems.push(...watchProblems(rule));
  return problems.length > 0 ? { ok: false, problems } : { ok: true, rule };
}

/**
 * 모델의 답이면 그걸, 아니면 초안을 쓴다 — **어느 쪽을 썼는지 밝히면서.**
 * 조용히 대체하면 사람은 자기가 무엇을 보고 있는지 모른다.
 */
export function chooseWatch(draft: WatchDraft, modelAnswer: string | null): {
  rule: WatchRule; source: 'model' | 'draft'; problems: string[];
} {
  if (modelAnswer === null) return { rule: draft.rule, source: 'draft', problems: [] };
  const compiled = parseCompiledWatch(modelAnswer);
  if (compiled.ok) return { rule: compiled.rule, source: 'model', problems: [] };
  return { rule: draft.rule, source: 'draft', problems: compiled.problems };
}
