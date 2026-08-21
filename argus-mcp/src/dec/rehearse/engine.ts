import { matchWatch, type WatchRule } from '../watch/rule.js';

/**
 * 시운전 — 아직 서명하지 않은 규칙을 **지난 기록에 대본다.**
 *
 * 이게 이 제품의 첫 60초다. 빈 장부를 주지 않고, *"네 규칙 중 넷이 지난 한
 * 달 안에 실제로 안 지켜졌다"* 를 장면으로 보여준다. 서명이 믿음의 도약이
 * 아니라 **보고 난 뒤의 행위**가 된다.
 *
 * 여기는 **순수 함수**다. 과거를 어떻게 모으는지(git·대화 기록)는 부르는
 * 쪽 일이고, 여기서는 판정만 한다 — 그래서 테스트가 진짜 판정을 잰다.
 *
 * **말해도 되는 것과 안 되는 것** (기획서 §3 표기 규율):
 *  - 되는 것: *"이 규칙이 있었다면 여기서 물었을 것이다."* 걸리는 판정은
 *    결정론이라 이건 사실 진술이다.
 *  - **안 되는 것: "막았을 것이다."** 그 다음에 사람이 뭘 했을지는 사람 몫이고
 *    우리는 모른다. 이 파일은 그 문장을 만들지 않는다.
 */

export type PastEvent =
  /** `context` 는 그때 무슨 작업이었나 (커밋 제목). 장면을 사람이 알아보게 한다. */
  | { kind: 'file_change'; at: string; path: string; where: string; context?: string }
  | { kind: 'utterance'; at: string; text: string; where: string };

export interface RehearsalHit {
  at: string;
  channel: 'file' | 'word';
  /** 규칙의 어느 부분에 걸렸나. */
  matched: string;
  /** 어디서 있었던 일인가 — 커밋 짧은 해시나 세션 이름. */
  where: string;
  /** 그때의 장면 한 줄. 대화면 그 말, 파일이면 그 자리. */
  scene: string;
}

export interface RehearsalResult {
  /** 몇 번 걸렸나. */
  hit_count: number;
  hits: RehearsalHit[];
  /** 분모 — 무엇을 얼마나 훑었나. 이게 없으면 "5번"은 아무 뜻이 없다. */
  scanned: { file_changes: number; utterances: number; days: number };
  /** 걸린 날이 며칠이나 되나 — 한 커밋에서 열 번 걸린 것과 열흘에 걸쳐 걸린 것은 다르다. */
  hit_days: number;
  /** 기계가 못 잡는 규칙이면 시운전 자체가 성립하지 않는다. 숫자 대신 이걸 말한다. */
  not_watchable: boolean;
}

export interface RehearseOptions {
  /** 장면을 몇 개까지 들고 오나 (전부 다 보여주면 사람이 못 읽는다). */
  maxScenes?: number;
  /** 대화 한 줄을 몇 글자까지 보여주나. */
  sceneChars?: number;
  days?: number;
}

/** 이 이상 부딪히면 규칙을 좁히라고 말한다 (30일 기준 하루 한 번꼴). */
const TOO_BROAD = 30;

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

export function rehearse(
  rule: WatchRule, past: readonly PastEvent[], options: RehearseOptions = {},
): RehearsalResult {
  const maxScenes = options.maxScenes ?? 5;
  const sceneChars = options.sceneChars ?? 90;
  const scanned = {
    file_changes: past.filter((e) => e.kind === 'file_change').length,
    utterances: past.filter((e) => e.kind === 'utterance').length,
    days: options.days ?? 0,
  };

  if (rule.mode === 'inject_only') {
    return { hit_count: 0, hits: [], scanned, hit_days: 0, not_watchable: true };
  }

  const hits: RehearsalHit[] = [];
  const days = new Set<string>();
  for (const event of past) {
    const verdict = event.kind === 'file_change'
      ? matchWatch(rule, { kind: 'file_change', path: event.path })
      : matchWatch(rule, { kind: 'utterance', text: event.text });
    if (!verdict.fire) continue;
    days.add(event.at.slice(0, 10));
    hits.push({
      at: event.at,
      channel: verdict.channel,
      matched: verdict.matched,
      where: event.where,
      scene: event.kind === 'file_change'
        ? `${event.path} 를 고쳤다${event.context ? ` — ${clip(event.context, sceneChars)}` : ''}`
        : `"${clip(event.text.replace(/\s+/g, ' ').trim(), sceneChars)}"`,
    });
  }

  // 최근 것부터 — 사람은 어제 일을 먼저 보고 싶어 한다.
  hits.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return {
    hit_count: hits.length,
    hits: hits.slice(0, maxScenes),
    scanned,
    hit_days: days.size,
    not_watchable: false,
  };
}

/**
 * 사람이 읽는 한 문단. **여기 글자는 전부 화면에 나간다** — DESIGN.md 규율.
 */
export function sayRehearsal(result: RehearsalResult): string[] {
  if (result.not_watchable) {
    return ['이 규칙은 기계가 못 알아챈다. 지난 기록에 대볼 수가 없다.'];
  }
  const { scanned } = result;
  const scope = `지난 ${scanned.days}일 · 고친 파일 ${scanned.file_changes}건 · 오간 말 ${scanned.utterances}줄`;
  if (result.hit_count === 0) {
    return [`${scope} 을 훑었는데 한 번도 부딪히지 않았다.`,
            '지금 정해도 당장 달라지는 건 없다는 뜻이다.'];
  }
  const lines = [
    `${scope} 을 훑으니 ${result.hit_count}번 부딪혔다 (${result.hit_days}일에 걸쳐).`,
    '이 규칙이 있었다면 여기서 물었을 것이다:',
    '',
  ];
  for (const hit of result.hits) {
    lines.push(`  ${hit.at.slice(5, 10)}  ${hit.scene}`);
    lines.push(`         걸린 것: ${hit.matched}${hit.where ? ` · ${hit.where}` : ''}`);
  }
  if (result.hit_count > result.hits.length) {
    lines.push('', `  … 그리고 ${result.hit_count - result.hits.length}번 더`);
  }
  // 너무 자주 부딪히는 규칙은 좋은 규칙이 아니라 **너무 넓은** 규칙이다.
  // 서명하기 전에 깎으라고 말해 준다 — 이 말이 없으면 사람은 매일 스무 번
  // 부딪히는 규칙을 그대로 정해 놓고 며칠 만에 도구를 끈다.
  if (result.hit_count >= TOO_BROAD) {
    lines.push('', '이만큼 부딪히면 규칙이 너무 넓다는 뜻일 수 있다. 정하기 전에 좁히는 게 낫다.');
  }
  return lines;
}
