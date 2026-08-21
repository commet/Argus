import crypto from 'node:crypto';
import { scopeSay } from './scope.js';
import type { DecisionRecord } from './types.js';

/**
 * 결정 파일 그리기 — 원장에서 나온 상태 하나를 사람이 읽는 마크다운 한 장으로.
 *
 * 저자성 표기(`ai_surfaced`)는 앱 존 `src/lib/judgment-authorship.ts` 와 같은
 * 개념이지만 MIT 존에서 앱 존을 import 할 수 없어 여기서 따로 그린다.
 *
 * **여기 글자는 전부 사용자가 읽는다.** DESIGN.md 마지막 절의 규율을 따른다:
 * 설계 낱말 금지(주입·대조·집행·표면·승격·관할·정산) · 기계·감시 비유 금지
 * (경보·감시·집행) · 피동 금지 · 추상 동사 금지. 두 시험을 매번 통과시킨다 —
 * ① 처음 켠 사람이 사전 없이 읽고 뭘 할지 아는가 ② 우리 문서에서만 쓰는
 * 낱말인가.
 *
 * **바이트가 안정적이어야 한다.** `dec verify` 가 재생성해서 바이트로 비교하므로,
 * 여기에 "지금 시각" 같은 것이 한 글자라도 들어가면 매번 불일치가 난다.
 * 입력은 오직 레코드다.
 */

const FINGERPRINT_PREFIX = '<!-- argus:fingerprint sha256:';
const FINGERPRINT_SUFFIX = ' -->';

/** YAML 머리의 값은 **언제나** JSON 문자열로 적는다 — 콜론·따옴표·줄바꿈이 든
 *  문장이 머리를 깨뜨리는 일이 구조적으로 없다. */
const y = (v: string): string => JSON.stringify(v);

function head(record: DecisionRecord): string[] {
  const lines = [
    '---',
    `id: ${y(record.id)}`,
    `type: ${y(record.type)}`,
    `decision: ${y(record.decision)}`,
    `scope: ${y(record.scope)}`,
    `binds: ${y(record.binds)}`,
    `author: ${y(record.author)}`,
    `provenance: ${y(record.provenance)}`,
    `adopted: ${y(record.adopted)}`,
    `unattended: ${y(record.unattended)}`,
    `watch: ${y(record.watch)}`,
    `status: ${y(record.status)}`,
  ];
  if (record.review) lines.push(`review: ${y(record.review)}`);
  if (record.review_on_event) lines.push(`review_on_event: ${y(record.review_on_event)}`);
  if (record.check) lines.push(`check: ${y(record.check)}`);
  if (record.falsified_if) lines.push(`falsified_if: ${y(record.falsified_if)}`);
  if (record.source_origin) lines.push(`source_origin: ${y(record.source_origin)}`);
  if (record.succeeded_by) lines.push(`succeeded_by: ${y(record.succeeded_by)}`);
  lines.push('---');
  return lines;
}

const UNATTENDED_SAY: Record<DecisionRecord['unattended'], string> = {
  park: '내가 자리에 없을 때 이 규칙에 부딪히면, 멈춰 두고 나를 기다린다.',
  log: '내가 자리에 없을 때는 그냥 지나가되, 무슨 일이 있었는지는 남긴다.',
  deny: '내가 자리에 없으면 그 일은 하지 않는다.',
};

/** 개정 이력에 쓰는 이름 — **기계 칸 이름이 사람 눈에 닿으면 안 된다.**
 *  (처음 판에서 `decision: … → …` 이 그대로 새어 나갔다.) */
const FIELD_SAY: Record<string, string> = {
  decision: '문장',
  scope: '걸리는 곳',
  binds: '지키는 사람',
  review: '다시 볼 날',
  review_on_event: '다시 볼 계기',
  unattended: '자리 비웠을 때',
  watch: '어긋난 걸 아는 방법',
  because: '이유',
};

/** 칸 값도 기계 낱말이다 — 같은 이유로 옮겨 적는다. */
const VALUE_SAY: Record<string, string> = {
  park: '멈춰 두고 기다리기',
  log: '지나가되 남기기',
  deny: '하지 않기',
  machine: '파일과 말을 같이 보기',
  inject_only: '기계는 못 잡음 (읽어주기만)',
};

const say = (field: string, value: string): string =>
  (field === 'unattended' || field === 'watch') ? (VALUE_SAY[value] ?? value)
    : field === 'scope' ? scopeSay(value) : value;

const TYPE_SAY: Record<DecisionRecord['type'], string> = {
  pin: '한 쪽으로 정해 둔 것',
  ban: '하지 않기로 한 것',
  open: '아직 안 정한 것 — 정해진 척하지 마라',
  pred: '이렇게 될 거라고 미리 적어 둔 것',
};

/** 지문을 뺀 본문. 지문은 이 본문을 해시한 값이라, 자기 자신은 셈에서 빠진다. */
export function renderDecisionBody(record: DecisionRecord): string {
  const out: string[] = [...head(record), ''];

  out.push(`# ${record.decision}`, '');

  if (record.status === 'repealed') {
    out.push(`**${(record.repealed_at || '').slice(0, 10)}에 그만뒀다. 더는 지키지 않는다.**`, '');
    if (record.repealed_why) out.push(`그만둔 이유: ${record.repealed_why}`, '');
    if (record.succeeded_by) out.push(`대신 ${record.succeeded_by} 을 따른다.`, '');
  } else {
    out.push(`**${record.adopted}에 정했고, 지금 지키고 있다.** (${TYPE_SAY[record.type]})`, '');
  }

  out.push(`걸리는 곳: ${scopeSay(record.scope)} · 지키는 사람: ${record.binds}`, '');

  if (record.provenance === 'ai_surfaced') {
    // 저자성에 거짓말하지 않는다 (CLAUDE.md Zero-Judgment Gate 1항).
    out.push('이 문장은 아르고스가 먼저 꺼냈고, 당신이 그걸 골랐다.', '');
  }

  if (record.because) out.push('## 왜 이렇게 정했나', '', record.because, '');

  if (record.quote) {
    // 어디서 온 문장인지 **틀리게 말하지 않는다.** 규칙 파일에서 가져온 것을
    // "대화에서 옮겼다"고 하면 그건 출처를 지어내는 것이다 (2026-08-21 수리).
    const fromRuleFile = record.origin?.kind === 'rule_file';
    out.push(fromRuleFile ? '## 원래 이렇게 적혀 있었다' : '## 그때 한 말', '');
    for (const line of record.quote.split('\n')) out.push(`> ${line}`);
    const when = record.quote_at ? `${record.quote_at.slice(0, 10)} ` : '';
    const where = fromRuleFile
      ? `${(record.origin?.ref ?? '').split('#')[0]}${record.origin?.line_start ? ` ${record.origin.line_start}번째 줄` : ''}`
      : '대화';
    out.push('', `${when}${where}에서 그대로 옮겼다.`, '');
  }

  out.push('## 어긋나면 어떻게 아나', '');
  const watch = record.watch_rule;
  if (record.watch !== 'machine' || !watch) {
    out.push('이건 기계가 못 알아챈다. 그래서 알려주지 않고, 대신 늘 읽어준다.', '');
  } else {
    if (watch.paths.length > 0) out.push(`이 자리를 건드리면: ${watch.paths.join(' · ')}`);
    if (watch.phrases.length > 0) out.push(`이 말이 나오면: ${watch.phrases.map((p) => `"${p}"`).join(' · ')}`);
    if (watch.except_paths.length > 0) out.push(`봐주는 자리: ${watch.except_paths.join(' · ')}`);
    if (watch.except_phrases.length > 0) out.push(`봐주는 말: ${watch.except_phrases.map((p) => `"${p}"`).join(' · ')}`);
    out.push('');
  }
  // **못 잡는 것은 감추지 않는다.** 다 잡는 척이 이 제품에서 제일 나쁜 거짓말이다.
  if (watch && watch.blind_spots.length > 0) {
    out.push('### 못 잡는 것', '');
    for (const spot of watch.blind_spots) out.push(`- ${spot}`);
    out.push('');
  }

  if (record.review || record.review_on_event) {
    out.push('## 다시 볼 때', '');
    if (record.review) out.push(`${record.review}`, '');
    if (record.review_on_event) out.push(`${record.review_on_event}`, '');
  }

  if (record.check) out.push('## 무엇을 보면 아나', '', record.check, '');
  if (record.falsified_if) out.push('## 이럴 땐 틀린 것으로 친다', '', record.falsified_if, '');

  out.push('## 자리를 비웠을 때', '', UNATTENDED_SAY[record.unattended], '');

  if (record.amendments.length > 0) {
    out.push('## 바뀐 것', '');
    for (const a of record.amendments) {
      out.push(`- **${a.at.slice(0, 10)}** — ${a.why}${a.from_hand_edit ? ' (파일을 직접 고친 것을 받아들였다)' : ''}`);
      for (const c of a.changed) {
        out.push(`  - ${FIELD_SAY[c.field] ?? c.field}: ${c.from ? say(c.field, c.from) : '(없었음)'} → ${say(c.field, c.to)}`);
      }
    }
    out.push('');
  }

  if (record.reviews.length > 0) {
    out.push('## 다시 보고 정한 것', '');
    for (const review of record.reviews.slice(-5).reverse()) {
      out.push(`- ${review.at.slice(0, 10)} — ${review.outcome === 'keep' ? '그대로 두기로 했다' : '나중에 다시 보기로 했다'} (다음 ${review.next_review})`);
      if (review.lesson) out.push(`  배운 것: ${review.lesson}`);
      if (review.prevented) out.push(`  이게 막은 것: ${review.prevented}`);
    }
    out.push('');
  }

  if (record.fires.length > 0) {
    // §4.6 — 맥락은 복사하지 않고 **가리킨다.** 요약 한 줄 + 어디였나.
    out.push('## 이 규칙이 일한 때', '');
    for (const fire of record.fires.slice(-5).reverse()) {
      out.push(`- ${fire.at.slice(0, 10)} — ${fire.channel === 'file' ? fire.matched : `"${fire.matched}"`}${fire.where ? ` · ${fire.where}` : ''}`);
    }
    if (record.fires.length > 5) out.push(`- … 그전에도 ${record.fires.length - 5}번`);
    out.push('');
  }
  if (record.misfires > 0) {
    out.push(`잘못 잡았다고 ${record.misfires}번 들었다.`,
      record.misfires >= 3
        ? '그래서 이 규칙은 지금 말하기를 멈췄다. 어긋난 걸 아는 방법을 고치면 다시 말한다.'
        : '', '');
  }

  if (record.pauses.length > 0) {
    // 멈춘 것도 파일에 남는다. 원장에만 있고 얼굴에 없으면 "감사는 남는다"가
    // 반만 참이다 — 사람이 여는 것은 원장이 아니라 이 파일이다.
    out.push('## 막는 것을 멈춘 때', '');
    for (const pause of record.pauses.slice(-5).reverse()) {
      out.push(`- ${pause.at.slice(0, 10)} — ${pause.until}까지 · ${pause.why}` +
        (pause.by_tty ? '' : ' (터미널이 아닌 데서)'));
    }
    if (record.pauses.length > 5) out.push(`- … 그전에도 ${record.pauses.length - 5}번`);
    out.push('');
  }

  out.push('---', '');
  out.push('이 파일은 기록에서 자동으로 만들어진다. 여기를 고쳐도 규칙은 안 바뀐다 —');
  out.push('고친 게 보이면 다음에 "이대로 바꿀까요?" 하고 묻는다.');
  out.push(`바꾸려면: dec amend ${record.id}`);

  return out.join('\n') + '\n';
}

export function fingerprintOf(body: string): string {
  return crypto.createHash('sha256').update(body, 'utf8').digest('hex');
}

/** 파일에 실제로 쓰이는 전문 — 본문 + 지문 한 줄. */
export function renderDecisionFile(record: DecisionRecord): string {
  const body = renderDecisionBody(record);
  return `${body}${FINGERPRINT_PREFIX}${fingerprintOf(body)}${FINGERPRINT_SUFFIX}\n`;
}

/** 디스크의 파일을 본문과 지문으로 가른다. 지문이 없으면 `null`. */
export function splitDecisionFile(text: string): { body: string; fingerprint: string } | null {
  const index = text.lastIndexOf(`\n${FINGERPRINT_PREFIX}`);
  if (index < 0) return null;
  const body = text.slice(0, index + 1);
  const rest = text.slice(index + 1).trimEnd();
  if (!rest.startsWith(FINGERPRINT_PREFIX) || !rest.endsWith(FINGERPRINT_SUFFIX)) return null;
  return { body, fingerprint: rest.slice(FINGERPRINT_PREFIX.length, rest.length - FINGERPRINT_SUFFIX.length) };
}

export const decisionFileName = (id: string): string => `${id}.md`;
