import path from 'node:path';
import { syncDecisionFiles, verifyDecisionFiles } from './files.js';
import fs from 'node:fs';
import { discoverRuleFiles } from './rules/discover.js';
import { clauseSentence, splitRuleFile, unmarkedBlocks, verifyClauseAnchors, type Clause, type SkippedBlock } from './rules/split.js';
import { draftWatchFromClause } from './watch/draft.js';
import { collectPast } from './rehearse/collect.js';
import { rehearse, sayRehearsal } from './rehearse/engine.js';
import { recordFire, recordMisfire, signDecision } from './write.js';
import { checkSubject } from './check/match.js';
import { decideSpeak } from './check/speak.js';
import { markSpoken, readSpoken } from './check/state.js';
import { foldDecisions } from './fold.js';
import type { DecSignedPayload, Unattended } from './types.js';
import { planInjection } from './inject/select.js';
import { sayInjection } from './inject/say.js';
import { markShown, readShown } from './inject/state.js';

function flag(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 && typeof args[index + 1] === 'string' ? args[index + 1]! : null;
}

function argusDirOf(args: readonly string[], command: string): string {
  const dir = flag(args, '--argus-dir');
  if (!dir || !path.isAbsolute(dir)) throw new Error(`${command} requires an absolute --argus-dir`);
  return dir;
}

/** 원장에서 결정 파일을 다시 그린다. 사람이 고친 파일은 손대지 않는다. */
export function runDecSyncCli(args: readonly string[]): void {
  process.stdout.write(JSON.stringify(syncDecisionFiles(argusDirOf(args, 'dec-sync'))) + '\n');
}

/**
 * 파일과 기록이 같다는 것을 증명한다 — 전부 다시 만들어 바이트로 비교.
 * **어긋나면 0 아닌 코드로 끝난다** (나중에 CI 관문으로 그대로 쓰인다).
 */
export function runDecVerifyCli(args: readonly string[]): void {
  const result = verifyDecisionFiles(argusDirOf(args, 'dec-verify'));
  process.stdout.write(JSON.stringify(result) + '\n');
  if (!result.ok) process.exitCode = 1;
}

/**
 * 이미 쓰고 있던 규칙 파일을 읽어 조항으로 갈라 낸다 — 역이식의 앞쪽 절반.
 *
 * **여기서 모델을 부르지 않는다.** 자르기만 하고, 이해하는 일(범위·어긋난 걸
 * 아는 방법의 초안)은 사람이 확인하는 순간에 한 번 부른다.
 *
 * 읽을 과거가 없으면 지어내지 않고 **없다고 말한다** — 자격 거절의 재료다.
 */
export function runDecScanRulesCli(args: readonly string[]): void {
  const repo = flag(args, '--repo');
  if (!repo || !path.isAbsolute(repo)) throw new Error('dec-scan-rules requires an absolute --repo');
  const found = discoverRuleFiles(repo);
  const clauses: Clause[] = [];
  const skipped: SkippedBlock[] = [];
  const anchorsMissing: string[] = [];
  /** 표지가 없어 후보로 안 올린 덩어리의 **원문**. 세기만 하고 감추면
   *  "우리가 못 본 규칙"이 조용한 공백이 된다 — 다음 단계와 사람이 볼 수
   *  있도록 그대로 돌려준다. */
  const unmarked: Array<{ file: string; line_start: number; text: string }> = [];
  for (const file of found.files) {
    const source = fs.readFileSync(file.abs, 'utf8');
    const split = splitRuleFile(file.rel, source);
    clauses.push(...split.clauses);
    skipped.push(...split.skipped);
    anchorsMissing.push(...verifyClauseAnchors(source, split.clauses).missing);
    unmarked.push(...unmarkedBlocks(source, split));
  }
  const skipped_by_reason: Record<string, number> = {};
  for (const s of skipped) skipped_by_reason[s.why] = (skipped_by_reason[s.why] ?? 0) + 1;
  process.stdout.write(JSON.stringify({
    files: found.files.map((f) => ({ rel: f.rel, tool: f.tool, bytes: f.bytes })),
    files_skipped: found.skipped,
    clause_count: clauses.length,
    skipped_by_reason,
    // 원문이 파일에 그대로 있는지 바이트로 다시 본 결과. 비어 있어야 정상이다.
    anchors_missing: anchorsMissing,
    clauses,
    unmarked,
  }) + '\n');
}

/**
 * 시운전 — 아직 아무것도 서명하지 않은 채로 **첫 60초**를 만드는 자리.
 *
 * 이미 쓰고 있던 규칙을 읽어서, 각각을 지난 기록에 대보고, 실제로 부딪힌
 * 것들을 뜨거운 순으로 보여준다. 서명은 그걸 보고 나서 하는 일이다.
 *
 * 못 읽은 것이 있으면 숫자 옆에 같이 말한다 — 분모를 모르면 "5번"은 아무
 * 뜻이 없다.
 */
export function runDecRehearseCli(args: readonly string[]): void {
  const repo = flag(args, '--repo');
  if (!repo || !path.isAbsolute(repo)) throw new Error('dec-rehearse requires an absolute --repo');
  const days = Number(flag(args, '--days') ?? 30);
  const top = Number(flag(args, '--top') ?? 5);
  if (!Number.isFinite(days) || days <= 0) throw new Error('dec-rehearse --days must be a positive number');

  const found = discoverRuleFiles(repo);
  const clauses: Clause[] = [];
  for (const file of found.files) {
    clauses.push(...splitRuleFile(file.rel, fs.readFileSync(file.abs, 'utf8')).clauses);
  }

  // 읽을 과거도 말 걸 표면도 없으면 **지어내지 않고 돌려보낸다**.
  if (clauses.length === 0) {
    process.stdout.write(JSON.stringify({
      rule_files: found.files.map((f) => f.rel),
      clause_count: 0,
      say: ['이 도구가 읽을 규칙이 당신 환경에 없다.'],
    }) + '\n');
    return;
  }

  const collected = collectPast(repo, days);
  const rehearsals = clauses.map((clause) => {
    const draft = draftWatchFromClause(clause);
    const result = rehearse(draft.rule, collected.past, { days, maxScenes: 3 });
    return { clause, rule: draft.rule, result };
  });

  const collided = rehearsals.filter((r) => r.result.hit_count > 0);
  // 뜨거운 순 — 부딪힌 날 수가 먼저다. 한 커밋에서 열 번보다 열흘에 걸쳐
  // 세 번이 더 살아 있는 규칙이다.
  collided.sort((a, b) =>
    b.result.hit_days - a.result.hit_days || b.result.hit_count - a.result.hit_count);

  const say: string[] = [];
  say.push(`이미 쓰고 있던 규칙을 읽었다: ${found.files.map((f) => `${f.rel} ${clauses.filter((c) => c.file === f.rel).length}조`).join(' · ')}`);
  say.push(`지난 ${days}일에 대보니 ${collided.length}건이 실제로 부딪혔다.`);
  if (collected.gaps.length > 0) say.push(`다만 못 읽은 것이 있다: ${collected.gaps.join(' / ')}`);
  say.push('');
  for (const item of collided.slice(0, top)) {
    say.push(`■ ${item.clause.text.replace(/\s+/g, ' ').trim().slice(0, 78)}`);
    for (const line of sayRehearsal(item.result)) say.push(`  ${line}`);
    say.push('');
  }

  process.stdout.write(JSON.stringify({
    rule_files: found.files.map((f) => f.rel),
    clause_count: clauses.length,
    days,
    scanned: { file_changes: collected.past.filter((e) => e.kind === 'file_change').length,
               utterances: collected.past.filter((e) => e.kind === 'utterance').length,
               transcript_files: collected.sources.transcripts, git: collected.sources.git },
    gaps: collected.gaps,
    collided: collided.length,
    not_watchable: rehearsals.filter((r) => r.result.not_watchable).length,
    top: collided.slice(0, top).map((item) => ({
      clause_id: item.clause.clause_id,
      text: item.clause.text,
      section: item.clause.section,
      hit_count: item.result.hit_count,
      hit_days: item.result.hit_days,
      blind_spots: item.rule.blind_spots,
      hits: item.result.hits,
    })),
    say,
  }) + '\n');
}

/** 다음 결정 번호 — 이미 있는 것 중 가장 큰 수 +1. id 는 한 번 붙으면 안 바뀐다. */
function nextDecisionId(argusDir: string): string {
  let max = 0;
  for (const record of foldDecisions(argusDir).records) {
    const n = /^D-(\d+)$/.exec(record.id);
    if (n) max = Math.max(max, Number(n[1]));
  }
  return `D-${String(max + 1).padStart(4, '0')}`;
}

/**
 * 확인 한 타 — 이미 쓰고 있던 조항 하나를 **법으로 만든다.**
 *
 * 사람이 하는 일은 조항을 고르고 날짜를 정하는 것뿐이다. 나머지(문장·출처·
 * 어긋난 걸 아는 방법 초안)는 기계가 조항에서 그대로 가져온다.
 *
 * 규율:
 *  - **문장을 지어내지 않는다.** 결정 문장도 발원 장면도 규칙 파일에 그대로
 *    있는 글자이고, 서명 직전에 **바이트로 다시 대조한다.**
 *  - **이유를 강요하지 않는다.** `--because` 는 선택이다. 안 쓰면 그 자리는
 *    비어 있고, 기계가 대신 채우지 않는다 (가장 지친 사용자가 이탈하면
 *    소유권이 0이 된다 — 불변식은 정직한 출처지 강제 타이핑이 아니다).
 *  - **기계가 못 잡는 조항이면 그렇게 서명된다.** 잡는 척하지 않는다.
 */
export async function runDecSignCli(args: readonly string[]): Promise<void> {
  const argusDir = argusDirOf(args, 'dec-sign');
  const repo = flag(args, '--repo') ?? path.dirname(argusDir);
  const clauseRef = flag(args, '--from-clause');
  if (!clauseRef) throw new Error('dec-sign requires --from-clause <파일#조항id>');
  const author = flag(args, '--author');
  if (!author) throw new Error('dec-sign requires --author (서명자가 누구인지 없이 법이 되지 않는다)');

  const [file] = clauseRef.split('#');
  const target = discoverRuleFiles(repo).files.find((f) => f.rel === file);
  if (!target) throw new Error(`NO_SUCH_RULE_FILE: ${file}`);
  const source = fs.readFileSync(target.abs, 'utf8');
  const clause = splitRuleFile(target.rel, source).clauses.find((c) => c.clause_id === clauseRef);
  if (!clause) throw new Error(`NO_SUCH_CLAUSE: ${clauseRef}`);
  // 서명 직전에 원문을 바이트로 다시 본다 — 읽은 뒤 파일이 바뀌었을 수 있다.
  if (!source.includes(clause.text)) throw new Error(`CLAUSE_MOVED: ${clauseRef} 의 원문이 파일과 다르다`);

  const draft = draftWatchFromClause(clause);
  const review = flag(args, '--review');
  const reviewOnEvent = flag(args, '--review-on-event');
  const unattended = (flag(args, '--unattended') ?? 'park') as Unattended;
  const scope = flag(args, '--scope') ?? 'repo';
  const today = flag(args, '--today') ?? new Date().toISOString().slice(0, 10);
  const because = flag(args, '--because');

  const payload: DecSignedPayload = {
    type: (flag(args, '--type') ?? 'pin') as DecSignedPayload['type'],
    decision: clauseSentence(clause.text),
    scope,
    binds: flag(args, '--binds') ?? author,
    author,
    provenance: 'user', // 문장이 사용자의 규칙 파일에서 그대로 왔다
    adopted: today,
    unattended,
    watch: draft.rule.mode,
    watch_rule: draft.rule,
    origin: { kind: 'rule_file', ref: clauseRef, line_start: clause.line_start, line_end: clause.line_end },
    quote: clause.text,
    ...(review ? { review } : {}),
    ...(reviewOnEvent ? { review_on_event: reviewOnEvent } : {}),
    ...(because ? { because } : {}),
  };

  const id = flag(args, '--id') ?? nextDecisionId(argusDir);
  const result = await signDecision(argusDir, id, payload, new Date().toISOString());
  process.stdout.write(JSON.stringify({
    ...result,
    watch: draft.rule.mode,
    blind_spots: draft.rule.blind_spots,
    file: `decisions/${id}.md`,
    // 사람이 안 쓴 것은 안 썼다고 말한다.
    because_written: Boolean(because),
  }) + '\n');
}

/**
 * 세션이 열릴 때 펴 보일 것 — 단계 6.
 *
 * 회전이라 **매번 다른 것이 나온다.** 오래 안 펴 본 것부터 올라오므로, 조용히
 * 잘 지켜지는 법이 굶어 죽지 않는다. 그리고 모든 슬롯은 지금 있는 자리에
 * 걸리는 것부터 채운다 — 그 한 줄이 없으면 회전이 그대로 누설이 된다.
 *
 * `--dry` 면 펴 봤다는 표시를 안 남긴다 (사람이 그냥 보고 싶을 때).
 */
export function runDecBriefCli(args: readonly string[]): void {
  const argusDir = argusDirOf(args, 'dec-brief');
  const repoRoot = path.dirname(argusDir);
  const cwd = flag(args, '--cwd') ?? repoRoot;
  const cwdRel = path.relative(repoRoot, path.resolve(cwd)).replace(/\\/g, '/');
  const today = flag(args, '--today') ?? new Date().toISOString().slice(0, 10);
  const max = Number(flag(args, '--max') ?? 15);
  const dry = args.includes('--dry');

  const fold = foldDecisions(argusDir);
  const plan = planInjection(fold.records, {
    cwd_rel: cwdRel.startsWith('..') ? '' : cwdRel,
    today, max, last_shown: readShown(argusDir),
  });
  if (!dry && plan.picks.length > 0) {
    markShown(argusDir, plan.picks.map((p) => p.record.id), new Date().toISOString(),
      fold.records.map((r) => r.id));
  }
  process.stdout.write(JSON.stringify({
    shown: plan.picks.map((p) => ({ id: p.record.id, slot: p.slot })),
    omitted: plan.omitted,
    out_of_scope: plan.out_of_scope,
    empty_slots: plan.empty_slots,
    unreadable: fold.unreadable,
    say: sayInjection(plan),
  }) + '\n');
}

/**
 * 지금 하려는 일이 정해 둔 것에 걸리나 — 단계 7.
 *
 * 두 부름을 한 기계가 받는다:
 *  - **미는 쪽** (훅): `--file <경로>` 또는 `--text <말>`. 말할지 말지까지 판정하고,
 *    말하기로 하면 원장에 걸린 기록을 남긴다.
 *  - **당기는 쪽** (에이전트): `--plan <계획>` + `--quiet`. 판정만 하고
 *    아무것도 안 남긴다 — 물어보는 것이 발화가 되면 안 된다.
 */
export async function runDecCheckCli(args: readonly string[]): Promise<void> {
  const argusDir = argusDirOf(args, 'dec-check');
  const file = flag(args, '--file');
  const text = flag(args, '--text') ?? flag(args, '--plan');
  const quiet = args.includes('--quiet') || flag(args, '--plan') !== null;
  const sessionId = flag(args, '--session-id') ?? 'unknown';
  const today = flag(args, '--today') ?? new Date().toISOString().slice(0, 10);
  if (!file && !text) throw new Error('dec-check requires --file <경로> or --text/--plan <말>');

  const fold = foldDecisions(argusDir);
  const result = checkSubject(fold.records, file ? { kind: 'file', path: file } : { kind: 'text', text: text! });
  const misfires = Object.fromEntries(fold.records.map((r) => [r.id, r.misfires]));
  const spoken = readSpoken(argusDir, today);
  const decision = decideSpeak({
    result,
    spoken_this_session: spoken.sessions[sessionId] ?? [],
    misfires,
    spoken_today: spoken.count,
  });

  const spoke = decision.speak && !quiet;
  if (spoke) {
    markSpoken(argusDir, today, sessionId, decision.match.id);
    await recordFire(argusDir, decision.match.id, {
      channel: decision.match.channel,
      matched: decision.match.matched,
      where: file ?? sessionId,
    }, new Date().toISOString());
  }

  process.stdout.write(JSON.stringify({
    matches: result.matches.map((m) => ({ id: m.id, channel: m.channel, matched: m.matched })),
    // "안 걸렸다"가 "괜찮다"가 아니다 — 기계가 못 보는 법이 몇 개인지 같이 말한다.
    unwatchable: result.unwatchable,
    // 말만 오갈 때 자리를 몰라 못 본 법의 수 — "안 걸렸다"가 "괜찮다"가 아니다.
    scope_unknown: result.scope_unknown,
    considered: result.considered,
    /** 게이트의 판정 — 말할 만한 것인가. */
    would_speak: decision.speak,
    /** **실제로 말했나.** 물어보는 것(--plan·--quiet)은 발화가 아니다. */
    spoke,
    why_silent: decision.speak ? (spoke ? null : 'asked_not_told') : decision.why,
    say: spoke ? decision.lines : [],
  }) + '\n');
}

/** 잘못 잡았다 — 법이 아니라 감지기를 고치는 입구. */
export async function runDecMisfireCli(args: readonly string[]): Promise<void> {
  const argusDir = argusDirOf(args, 'dec-misfire');
  const id = flag(args, '--id');
  if (!id) throw new Error('dec-misfire requires --id <결정 번호>');
  const result = await recordMisfire(argusDir, id, {
    matched: flag(args, '--matched') ?? '',
    where: flag(args, '--where') ?? '',
    ...(flag(args, '--note') ? { note: flag(args, '--note')! } : {}),
  }, new Date().toISOString());
  const record = foldDecisions(argusDir).records.find((r) => r.id === id);
  process.stdout.write(JSON.stringify({
    ...result,
    misfires: record?.misfires ?? 0,
    silenced: (record?.misfires ?? 0) >= 3,
  }) + '\n');
}
