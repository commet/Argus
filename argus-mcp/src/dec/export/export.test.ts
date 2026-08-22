import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BEGIN, END, emitExport, exportPath, inspectExport, readBlock, renderExportBody } from './emit.js';
import { signDecision, repealDecision, amendDecision } from '../write.js';
import { foldDecisions } from '../fold.js';
import { runDecExportCli } from '../dec-cli.js';
import type { DecSignedPayload } from '../types.js';

describe('내보낸 파일 — 무엇이 아닌지를 스스로 말한다', () => {
  const body = renderExportBody([]);

  it('감시되는 법이 아니라고 파일 안에서 밝힌다 (계층 정직)', () => {
    expect(body).toContain('읽히는 법이지 감시되는 법이 아니다');
    expect(body).toContain('어긋나도 알려주지 않는다');
  });

  it('기계 낱말이 안 나온다', () => {
    for (const word of ['provenance', 'watch_rule', 'unattended', 'falsified_if', 'inject_only', 'status']) {
      expect(body).not.toContain(word);
    }
  });
});

describe('방출은 일회 변환이 아니라 동기화다', () => {
  let repo: string;
  let dir: string;
  const sign = (id: string, extra: Partial<DecSignedPayload> = {}): Promise<unknown> =>
    signDecision(dir, id, {
      type: 'pin', decision: `${id} 의 문장`, scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-08-01', unattended: 'park', watch: 'inject_only',
      review: '2026-12-01', ...extra,
    } as DecSignedPayload, '2026-08-21T00:00:00.000Z');
  const read = (): string => fs.readFileSync(exportPath(dir), 'utf8');

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-export-'));
    dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it('서명하면 방출본이 같이 생긴다 — 따로 안 불러도', async () => {
    await sign('D-0001');
    expect(read()).toContain('D-0001');
  });

  it('개정하면 방출본도 새 문장이 된다', async () => {
    await sign('D-0001');
    await amendDecision(dir, 'D-0001', { decision: '바뀐 문장이다', why: '틀렸더라' }, '2026-08-21T01:00:00.000Z');
    const text = read();
    expect(text).toContain('바뀐 문장이다');
    expect(text).not.toContain('D-0001 의 문장');
  });

  it('그만두면 방출본에서 사라진다 (6주 낡은 방출본이 폐기된 법을 집행하지 않게)', async () => {
    await sign('D-0001');
    await sign('D-0002');
    await repealDecision(dir, 'D-0001', { why: '더는 아니다' }, '2026-08-21T01:00:00.000Z');
    const text = read();
    expect(text).not.toContain('D-0001');
    expect(text).toContain('D-0002');
  });

  it('남이 쓴 글은 바이트 그대로 둔다', async () => {
    fs.writeFileSync(exportPath(dir), '# 우리 팀 규칙\n\n커밋은 한글로.\n');
    await sign('D-0001');
    const text = read();
    expect(text).toContain('# 우리 팀 규칙');
    expect(text).toContain('커밋은 한글로.');
    expect(text.indexOf('# 우리 팀 규칙')).toBeLessThan(text.indexOf(BEGIN));
  });

  it('두 번 방출해도 파일이 안 자란다', async () => {
    await sign('D-0001');
    const once = read();
    await sign('D-0002');
    const twice = read();
    expect(twice.split(BEGIN)).toHaveLength(2);
    expect(twice.split(END)).toHaveLength(2);
    expect(once.split(BEGIN)).toHaveLength(2);
  });
});

describe('손으로 고치면 알아채고 멈춘다', () => {
  let repo: string;
  let dir: string;
  const capture = (args: string[]): Record<string, unknown> => {
    const write = process.stdout.write.bind(process.stdout);
    let out = '';
    (process.stdout as { write: unknown }).write = (c: string): boolean => { out += c; return true; };
    try { runDecExportCli(args); } finally { (process.stdout as { write: unknown }).write = write; }
    return JSON.parse(out) as Record<string, unknown>;
  };

  beforeEach(async () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-drift-'));
    dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
    await signDecision(dir, 'D-0001', {
      type: 'pin', decision: '웹 화면은 나중에', scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-08-01', unattended: 'park', watch: 'inject_only',
      review: '2026-12-01',
    } as DecSignedPayload, '2026-08-21T00:00:00.000Z');
  });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  const handEdit = (): void => {
    const file = exportPath(dir);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('웹 화면은 나중에', '웹 화면을 지금 연다'));
  };

  it('지문이 안 맞으면 손댄 것으로 본다', () => {
    handEdit();
    expect(inspectExport(dir, foldDecisions(dir).records).verdict).toBe('hand_edited');
  });

  it('손댄 것을 덮어쓰지 않는다', () => {
    handEdit();
    const result = emitExport(dir, foldDecisions(dir).records);
    expect(result.action).toBe('held');
    expect(fs.readFileSync(exportPath(dir), 'utf8')).toContain('웹 화면을 지금 연다');
  });

  it('원장 쪽 본문을 나란히 내놓는다 — 어느 쪽을 남길지는 사람이 정한다', () => {
    handEdit();
    const result = emitExport(dir, foldDecisions(dir).records);
    expect(result.hand_edit?.on_disk).toContain('웹 화면을 지금 연다');
    expect(result.hand_edit?.from_ledger).toContain('웹 화면은 나중에');
  });

  it('그 뒤로 서명이 와도 손댄 덩어리는 그대로 있다', async () => {
    handEdit();
    const written = await signDecision(dir, 'D-0002', {
      type: 'pin', decision: '두 번째', scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-08-01', unattended: 'park', watch: 'inject_only',
      review: '2026-12-01',
    } as DecSignedPayload, '2026-08-21T02:00:00.000Z');
    expect(written.exported.action).toBe('held');
    expect(fs.readFileSync(exportPath(dir), 'utf8')).toContain('웹 화면을 지금 연다');
  });

  it('무슨 일이 났는지 쉬운 말로 말하고, 고치는 자리를 가리킨다', () => {
    handEdit();
    const result = capture(['--argus-dir', dir]);
    const say = (result['say'] as string[]).join('\n');
    expect(say).toContain('덮어쓰지 않았다');
    expect(say).toContain('dec-amend');
  });

  it('--check 는 아무것도 안 쓴다', () => {
    handEdit();
    const before = fs.readFileSync(exportPath(dir), 'utf8');
    expect(capture(['--argus-dir', dir, '--check'])['verdict']).toBe('hand_edited');
    expect(fs.readFileSync(exportPath(dir), 'utf8')).toBe(before);
  });

  it('안 고쳤으면 조용하다', () => {
    const result = capture(['--argus-dir', dir]);
    expect(result['action']).toBe('unchanged');
    expect(result['say']).toEqual([]);
  });

  it('덩어리를 통째로 지우면 다시 만든다', () => {
    const file = exportPath(dir);
    fs.writeFileSync(file, '# 남은 글\n');
    expect(emitExport(dir, foldDecisions(dir).records).action).toBe('written');
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toContain('# 남은 글');
    expect(readBlock(text)?.body).toContain('D-0001');
  });
});
