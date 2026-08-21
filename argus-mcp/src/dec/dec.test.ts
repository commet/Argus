import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { signDecision, amendDecision, repealDecision } from './write.js';
import { syncDecisionFiles, verifyDecisionFiles, decisionsDir } from './files.js';
import { foldDecisions } from './fold.js';
import { renderDecisionFile } from './render.js';
import { appendLedger } from '../lib/ledger-append.js';
import { replayLedger } from '../lib/ledger-replay.js';
import type { DecSignedPayload } from './types.js';
import type { WatchRule } from './watch/rule.js';

const WATCH: WatchRule = {
  paths: ['src/app/**'],
  phrases: ['웹 화면'],
  except_paths: ['src/app/**/*.test.tsx'],
  except_phrases: ['예를 들면'],
  blind_spots: ['다른 이름의 화면 틀을 새로 들이는 것은 못 잡는다.'],
  mode: 'machine',
};

let repo: string;
let argusDir: string;
const NOW = '2026-08-21T10:00:00.000Z';

const BASE: DecSignedPayload = {
  type: 'pin',
  decision: '웹 화면은 나중에, 터미널 먼저',
  scope: 'repo',
  binds: '나',
  author: '창업자',
  provenance: 'user',
  adopted: '2026-08-21',
  unattended: 'park',
  watch: 'machine',
  watch_rule: WATCH,
  // 이 픽스처는 **대화에서** 태어난 결정이다 (규칙 파일에서 온 것은 sign.test.ts).
  origin: { kind: 'conversation', ref: 'sess-8f21a0' },
  review: '2026-09-04',
  because: '터미널에서 먼저 손에 익히고 싶어서.',
  quote: '웹 화면은 나중에 하고 터미널부터 하자',
  quote_at: '2026-08-21T09:12:00.000Z',
};

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dec-'));
  argusDir = path.join(repo, '.argus');
  fs.mkdirSync(argusDir, { recursive: true });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

const fileFor = (id: string): string => path.join(decisionsDir(argusDir), `${id}.md`);
const read = (id: string): string => fs.readFileSync(fileFor(id), 'utf8');

describe('서명하면 파일이 태어난다 — 원장이 진실, 파일은 그 얼굴', () => {
  it('원장에만 썼는데 사람이 읽는 파일이 생기고, 문장·이유·그때 한 말이 그 안에 있다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    const text = read('D-0001');
    expect(text).toContain('# 웹 화면은 나중에, 터미널 먼저');
    expect(text).toContain('터미널에서 먼저 손에 익히고 싶어서.');
    expect(text).toContain('> 웹 화면은 나중에 하고 터미널부터 하자');
    // 대화에서 온 것은 대화에서 왔다고 말한다.
    expect(text).toContain('## 그때 한 말');
    expect(text).toContain('대화에서 그대로 옮겼다');
    expect(text).toContain('2026-08-21에 정했고, 지금 지키고 있다.');
    expect(text).toMatch(/<!-- argus:fingerprint sha256:[0-9a-f]{64} -->/);
  });

  it('같은 원장에서 두 번 그리면 바이트가 같다 (재생성 비교가 성립하려면 필수)', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    const first = read('D-0001');
    const record = foldDecisions(argusDir).records[0]!;
    expect(renderDecisionFile(record)).toBe(first);
    expect(syncDecisionFiles(argusDir).unchanged).toEqual(['D-0001']);
    expect(read('D-0001')).toBe(first);
  });

  it('verify 가 원장에서 전부 다시 만들어 일치를 증명한다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    await signDecision(argusDir, 'D-0002', { ...BASE, decision: '수파베이스 승인은 다시 묻지 않는다', type: 'ban' }, NOW);
    const result = verifyDecisionFiles(argusDir);
    expect(result.ok).toBe(true);
    expect(result.files.map((f) => f.verdict)).toEqual(['match', 'match']);
  });
});

describe('어긋난 걸 아는 방법이 결정과 함께 산다 (단계 5)', () => {
  it('서명한 규칙이 파일에 사람 말로 나오고, **못 잡는 것**이 같이 나온다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    const text = read('D-0001');
    expect(text).toContain('이 자리를 건드리면: src/app/**');
    expect(text).toContain('이 말이 나오면: "웹 화면"');
    expect(text).toContain('봐주는 자리: src/app/**/*.test.tsx');
    expect(text).toContain('### 못 잡는 것');
    expect(text).toContain('다른 이름의 화면 틀을 새로 들이는 것은 못 잡는다.');
  });

  it('되읽으면 규칙과 출처가 그대로 돌아온다 (서명이 규칙을 버리지 않는다)', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    const record = foldDecisions(argusDir).records[0]!;
    expect(record.watch_rule).toEqual(WATCH);
    expect(record.origin).toEqual({ kind: 'conversation', ref: 'sess-8f21a0' });
  });

  it('기계가 잡는다면서 방법이 없으면 서명이 안 된다', async () => {
    const { watch_rule: _w, ...noRule } = BASE;
    await expect(signDecision(argusDir, 'D-0002', noRule as DecSignedPayload, NOW))
      .rejects.toThrow(/NO_WATCH_RULE/);
  });

  it('못 잡는 것을 안 적은 규칙으로는 서명이 안 된다', async () => {
    await expect(signDecision(argusDir, 'D-0003', {
      ...BASE, watch_rule: { ...WATCH, blind_spots: [] },
    }, NOW)).rejects.toThrow(/BAD_WATCH_RULE/);
  });

  it('"읽어주기만"이라면서 걸릴 자리를 적으면 서명이 안 된다', async () => {
    await expect(signDecision(argusDir, 'D-0004', {
      ...BASE, watch: 'inject_only', watch_rule: WATCH,
    }, NOW)).rejects.toThrow(/WATCH_MODE_MISMATCH/);
  });

  it('법은 그대로 두고 감지기만 고칠 수 있다 (오탐이 법을 죽이지 않게)', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    await amendDecision(argusDir, 'D-0001', {
      watch_rule: { ...WATCH, except_paths: ['src/app/**/*.test.tsx', 'src/app/legacy/**'] },
      why: '옛 화면 코드에서 자꾸 잘못 걸려서',
    }, '2026-08-25T00:00:00.000Z');
    const record = foldDecisions(argusDir).records[0]!;
    expect(record.decision).toBe(BASE.decision); // 법 문장은 그대로
    expect(record.watch_rule?.except_paths).toContain('src/app/legacy/**');
    expect(read('D-0001')).toContain('src/app/legacy/**');
  });

  it('원장에 망가진 규칙이 직접 쓰이면 그 결정은 태어나지 않는다', async () => {
    await appendLedger(argusDir, [{
      id: 'D-0009', event: 'dec_signed', ts: NOW,
      dec: { ...BASE, watch_rule: { ...WATCH, blind_spots: [] } },
    }], NOW);
    expect(foldDecisions(argusDir).records).toEqual([]);
    expect(foldDecisions(argusDir).dropped).toBe(1);
  });
});

describe('손으로 고치면 알아챈다 — 그리고 덮어쓰지 않는다', () => {
  it('파일을 한 줄 고치면 verify 가 hand_edited 로 잡는다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    fs.writeFileSync(fileFor('D-0001'), read('D-0001').replace('터미널 먼저', '터미널 나중'));
    const result = verifyDecisionFiles(argusDir);
    expect(result.ok).toBe(false);
    expect(result.files[0]?.verdict).toBe('hand_edited');
  });

  it('고친 파일을 다시 그리기가 **덮어쓰지 않는다** — 조용한 무시가 곧 이 구조의 탈락 사유였다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    const edited = read('D-0001') + '\n손으로 덧붙인 줄\n';
    fs.writeFileSync(fileFor('D-0001'), edited);
    const sync = syncDecisionFiles(argusDir);
    expect(sync.hand_edited).toEqual(['D-0001']);
    expect(sync.written).toEqual([]);
    expect(read('D-0001')).toBe(edited);
  });

  it('지문이 통째로 없는 파일도 손댄 것으로 본다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    fs.writeFileSync(fileFor('D-0001'), read('D-0001').replace(/<!-- argus:fingerprint.*-->\n/, ''));
    expect(verifyDecisionFiles(argusDir).files[0]?.verdict).toBe('hand_edited');
  });

  it('사람은 안 고쳤는데 원장이 앞서 가면 stale 로 갈라 본다 (그리는 코드의 표류를 잡는 전선)', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    // 파일을 다시 안 그리고 원장에만 개정을 쌓는다.
    await appendLedger(argusDir, [{
      id: 'D-0001', event: 'dec_amended', ts: '2026-08-25T00:00:00.000Z',
      dec: { decision: '웹 화면은 10월 뒤에', why: '일정이 밀려서' },
    }], '2026-08-25T00:00:00.000Z');
    expect(verifyDecisionFiles(argusDir).files[0]?.verdict).toBe('stale');
    expect(syncDecisionFiles(argusDir).written).toEqual(['D-0001']);
    expect(verifyDecisionFiles(argusDir).ok).toBe(true);
  });

  it('원장에 없는 파일은 조용히 지우지 않고 이름을 돌려준다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    fs.writeFileSync(path.join(decisionsDir(argusDir), 'D-9999.md'), '남의 파일\n');
    expect(syncDecisionFiles(argusDir).orphans).toEqual(['D-9999.md']);
    expect(fs.existsSync(path.join(decisionsDir(argusDir), 'D-9999.md'))).toBe(true);
    expect(verifyDecisionFiles(argusDir).files.map((f) => f.verdict)).toEqual(['match', 'orphan']);
  });
});

describe('개정과 폐지 — 지우지 않고 쌓는다', () => {
  it('개정하면 옛 문장이 사라지지 않고 "바뀐 것"에 남는다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    await amendDecision(argusDir, 'D-0001', { decision: '웹 화면은 10월 뒤에', why: '일정이 밀려서' }, '2026-08-25T00:00:00.000Z');
    const text = read('D-0001');
    expect(text).toContain('# 웹 화면은 10월 뒤에');
    expect(text).toContain('## 바뀐 것');
    expect(text).toContain('문장: 웹 화면은 나중에, 터미널 먼저 → 웹 화면은 10월 뒤에');
    expect(text).toContain('일정이 밀려서');
  });

  it('폐지해도 파일은 남고, 그만뒀다고 적힌다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    await repealDecision(argusDir, 'D-0001', { why: '터미널만으로 충분하지 않았다' }, '2026-09-01T00:00:00.000Z');
    const text = read('D-0001');
    expect(text).toContain('2026-09-01에 그만뒀다. 더는 지키지 않는다.');
    expect(text).toContain('터미널만으로 충분하지 않았다');
    expect(text).toContain('# 웹 화면은 나중에, 터미널 먼저');
  });

  it('두 번 서명·폐지 뒤 개정·이유 없는 개정은 거절한다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    await expect(signDecision(argusDir, 'D-0001', BASE, NOW)).rejects.toThrow(/ALREADY_SIGNED/);
    await expect(amendDecision(argusDir, 'D-0001', { why: '' }, NOW)).rejects.toThrow(/NO_REASON/);
    await repealDecision(argusDir, 'D-0001', { why: '그만' }, NOW);
    await expect(amendDecision(argusDir, 'D-0001', { decision: 'x', why: 'y' }, NOW)).rejects.toThrow(/REPEALED/);
  });

  it('다시 볼 날도 계기도 없으면 서명이 안 된다 · 기계가 못 잡는 규칙은 날짜만 된다', async () => {
    const { review: _r, ...noRecheck } = BASE;
    await expect(signDecision(argusDir, 'D-0002', noRecheck as DecSignedPayload, NOW)).rejects.toThrow(/NO_RECHECK/);
    // 읽어주기만 하는 결정은 걸릴 자리를 갖지 않는다 — 규칙도 같이 뺀다.
    const { watch_rule: _w, ...noRule } = noRecheck;
    await expect(signDecision(argusDir, 'D-0003', {
      ...noRule, watch: 'inject_only', review_on_event: '벤더가 같은 걸 내놓으면',
    } as DecSignedPayload, NOW)).rejects.toThrow(/INJECT_ONLY_NEEDS_CALENDAR/);
  });
});

describe('정직한 공백 — 조용히 메우지 않는다', () => {
  it('필수 칸이 빠진 서명 줄은 기본값으로 메우지 않고 버린다', async () => {
    await appendLedger(argusDir, [{
      id: 'D-0001', event: 'dec_signed', ts: NOW,
      dec: { type: 'pin', decision: '문장은 있는데 나머지가 없다' },
    }], NOW);
    const fold = foldDecisions(argusDir);
    expect(fold.records).toEqual([]);
    expect(fold.dropped).toBe(1);
    expect(verifyDecisionFiles(argusDir).ok).toBe(false);
  });

  it('원장을 못 읽으면 파일을 하나도 안 건드린다 (빈 원장으로 착각하지 않는다)', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    const before = read('D-0001');
    const ledger = path.join(argusDir, 'ledger', 'ledger.jsonl');
    fs.rmSync(ledger);
    fs.mkdirSync(ledger); // 파일 자리에 디렉터리 → EISDIR
    const sync = syncDecisionFiles(argusDir);
    expect(sync.unreadable).toBeTruthy();
    expect(sync.written).toEqual([]);
    expect(read('D-0001')).toBe(before);
  });
});

describe('옛 되읽기와 같이 산다', () => {
  it('결정 사건이 쌓여도 옛 replay 가 "모르는 줄"로 세지 않는다', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    await amendDecision(argusDir, 'D-0001', { decision: 'x', why: 'y' }, NOW);
    const state = replayLedger(argusDir, '2026-08-21');
    expect(state.integrity.skipped_unknown).toBe(0);
    expect(state.integrity.dropped_lines).toBe(0);
    expect(state.ids.size).toBe(0); // 결정은 예측 계약이 아니다
  });
});

describe('발원 원문은 파일에 안 나간다 (§4.6: 저장한다 · 공개하지 않는다)', () => {
  it('`source` 는 기록에 남지만 결정 파일 어디에도 안 나온다', async () => {
    const secret = '2026-08-19 14:02 창업자 발화 전문 — 공개 저장소에 나가면 되돌릴 수 없다';
    await signDecision(argusDir, 'D-0001', { ...BASE, source: secret }, NOW);
    expect(foldDecisions(argusDir).records[0]?.source).toBe(secret);
    expect(read('D-0001')).not.toContain(secret);
    expect(read('D-0001')).not.toContain('source:');
  });
});

describe('화면에 나가는 글 — 설계 낱말이 파일에 새지 않는다', () => {
  it('사용자가 읽는 파일에 우리끼리 쓰는 낱말이 없다 (DESIGN.md 마지막 절)', async () => {
    await signDecision(argusDir, 'D-0001', BASE, NOW);
    await amendDecision(argusDir, 'D-0001', { decision: '웹 화면은 10월 뒤에', why: '일정이 밀려서' }, NOW);
    const body = read('D-0001').split('---').slice(2).join('---'); // YAML 머리 제외
    for (const word of ['주입', '대조', '집행', '승격', '관할', '정산', '감시', '경보', '컴파일', '구속', '발원', '알림']) {
      expect(body, `"${word}" 이 화면 글에 있다`).not.toContain(word);
    }
    // 기계 칸 이름·값도 화면 글이 아니다 (첫 판에서 `decision: … → …` 이 샜다).
    for (const machine of ['decision:', 'scope:', 'binds:', 'unattended:', 'review_on_event:',
                           'inject_only', 'ai_surfaced', 'provenance']) {
      expect(body, `기계 낱말 "${machine}" 이 화면 글에 있다`).not.toContain(machine);
    }
  });
});
