import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRepository, readLedger } from './ledger.js';
import { contextFor, type V2Context } from './bridge.js';
import {
  captureTranscriptFile,
  readTranscriptTurns,
  sensitiveCategories,
  stableCandidateIdentity,
  type CandidateExtractorPort,
} from './candidate-capture.js';
import { makeEvidencePointer } from './evidence.js';

let roots: string[] = [];
const NOW = '2026-07-18';

beforeEach(() => { roots = []; });
afterEach(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

function root(prefix: string): string {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(value);
  return value;
}

function environment(label: string): { ctx: V2Context; home: string; repositoryId: string } {
  const home = root(`argus-capture-home-${label}-`);
  const repo = root(`argus-capture-repo-${label}-`);
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const repositoryId = registerRepository(home, path.join(repo, '.git'));
  const ctx = contextFor({
    home,
    gitCommonDir: path.join(repo, '.git'),
    workspaceArgusDir: path.join(repo, '.argus'),
    sessionId: 'session:1',
    producerVersion: 'test',
    today: NOW,
  });
  return { ctx, home, repositoryId };
}

function transcript(lines: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  const file = path.join(root('argus-capture-source-'), 'transcript.jsonl');
  fs.writeFileSync(file, lines.map((line) => JSON.stringify({
    type: line.role,
    message: { role: line.role, content: line.content },
  })).join('\n') + '\n');
  return file;
}

describe('CandidateCapture single brain', () => {
  it('gives foreground and background the same stable identity and writer semantics', async () => {
    const file = transcript([{ role: 'user', content: '세션 저장은 postgres로 가기로 했다.' }]);
    const first = environment('a');
    const second = environment('b');
    const base = {
      transcript_path: file,
      session_id: 'same-session',
      source_origin_id: `claude-code:${file}`,
    };
    const explicit = await captureTranscriptFile({ ...base, ctx: first.ctx, trigger: 'explicit_scan' });
    const background = await captureTranscriptFile({ ...base, ctx: second.ctx, trigger: 'background_queue' });
    expect(explicit.candidates_created).toEqual(background.candidates_created);
    const eventA = readLedger(first.home, first.repositoryId).events[0] as Record<string, unknown>;
    const eventB = readLedger(second.home, second.repositoryId).events[0] as Record<string, unknown>;
    for (const field of ['candidate_id', 'kind', 'quote', 'quote_speaker', 'verification', 'evidence', 'source']) {
      expect(eventA[field]).toEqual(eventB[field]);
    }
  });

  it('does not let extractor name/version change source-span identity', async () => {
    const quote = '캐시는 redis로 가기로 했다.';
    const file = transcript([{ role: 'user', content: quote }]);
    const a = environment('extract-a');
    const b = environment('extract-b');
    const extractor = (name: string): CandidateExtractorPort => ({
      name,
      extract: () => [{ quote, typed_span: 'declarative', sub_index: 0 }],
    });
    const base = {
      transcript_path: file, session_id: 'session', source_origin_id: `claude-code:${file}`,
      trigger: 'explicit_scan' as const,
    };
    const first = await captureTranscriptFile({ ...base, ctx: a.ctx, extractor: extractor('model-v1') });
    const second = await captureTranscriptFile({ ...base, ctx: b.ctx, extractor: extractor('model-v99') });
    expect(first.candidates_created).toEqual(second.candidates_created);
  });

  it('uses byte span and deterministic sub-index to distinguish repeated or multi-decision quotes', () => {
    const raw = Buffer.from('결정한다. 중간 결정한다.');
    const first = makeEvidencePointer(raw, '/source', '결정한다.', 'user')!;
    const second = { ...first, quote_byte_start: first.quote_byte_start + 10, quote_byte_end: first.quote_byte_end + 10 };
    const base = { source_origin_id: 'host', source_session_id: 'session', typed_span: 'declarative' as const };
    expect(stableCandidateIdentity({ ...base, evidence: first, sub_index: 0 }))
      .not.toBe(stableCandidateIdentity({ ...base, evidence: second, sub_index: 0 }));
    expect(stableCandidateIdentity({ ...base, evidence: first, sub_index: 0 }))
      .not.toBe(stableCandidateIdentity({ ...base, evidence: first, sub_index: 1 }));
  });

  it('blocks secret-bearing user text before quote hashing or canonical writing', async () => {
    const secret = 'API key는 sk-proj-abcdefghijklmnopqrstuv 이걸로 가기로 했다.';
    const file = transcript([{ role: 'user', content: secret }]);
    const env = environment('secret');
    const result = await captureTranscriptFile({
      ctx: env.ctx,
      transcript_path: file,
      session_id: 'secret-session',
      source_origin_id: `claude-code:${file}`,
      trigger: 'background_queue',
    });
    expect(result).toMatchObject({ sensitive_blocked: 1, candidates_created: [], no_candidate: true });
    expect(result.sensitive_categories).toContain('provider_token');
    expect(readLedger(env.home, env.repositoryId).events).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('sk-proj-');
  });

  it('excludes assistant-only text, user questions, negation, and routine chatter', async () => {
    const file = transcript([
      { role: 'assistant', content: 'postgres로 가기로 했다.' },
      { role: 'user', content: 'postgres로 가기로 했다?' },
      { role: 'user', content: '아직 결정 못 했다.' },
      { role: 'user', content: '오늘 날씨가 좋다.' },
    ]);
    const env = environment('negative');
    const result = await captureTranscriptFile({
      ctx: env.ctx, transcript_path: file, session_id: 's', source_origin_id: `claude-code:${file}`,
      trigger: 'explicit_scan',
    });
    expect(result).toMatchObject({ utterances_scanned: 3, no_candidate: true, candidates_created: [] });
  });

  it('counts extractor quotes absent from source instead of downgrading provenance', async () => {
    const file = transcript([{ role: 'user', content: '원문 문장' }]);
    const env = environment('missing');
    const extractor: CandidateExtractorPort = {
      name: 'bad-extractor',
      extract: () => [{ quote: '모델이 지어낸 문장', typed_span: 'declarative', sub_index: 0 }],
    };
    const result = await captureTranscriptFile({
      ctx: env.ctx, transcript_path: file, session_id: 's', source_origin_id: `claude-code:${file}`,
      trigger: 'explicit_scan', extractor,
    });
    expect(result).toMatchObject({ quote_not_found: 1, candidates_created: [], no_candidate: true });
  });

  it('parses user text blocks and ignores corrupt, assistant, tool, and host-meta lines', () => {
    const raw = Buffer.from([
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'kept' } }),
      '{broken',
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'ignored' } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', content: 'ignored' },
        { type: 'text', text: 'also kept' },
      ] } }),
      JSON.stringify({ type: 'user', isMeta: true, message: { role: 'user', content: 'metadata ignored' } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: '<system-reminder>ignored</system-reminder>' } }),
    ].join('\n'));
    expect(readTranscriptTurns(raw).map((turn) => turn.content)).toEqual(['kept', 'also kept']);
  });

  it('recognizes high-risk secret categories without returning the secret', () => {
    expect(sensitiveCategories('password = super-secret-value')).toEqual(['assigned_secret']);
    expect(sensitiveCategories('비밀번호는 super-secret-value')).toEqual(['assigned_secret']);
    expect(sensitiveCategories('-----BEGIN PRIVATE KEY-----')).toEqual(['private_key']);
  });
});
