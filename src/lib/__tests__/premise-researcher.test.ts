import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../web-research', () => ({ searchRecent: vi.fn() }));
vi.mock('../llm-server', () => ({ callAnthropicJson: vi.fn() }));

import { investigatePremise } from '../premise-researcher';
import { searchRecent } from '../web-research';
import { callAnthropicJson } from '../llm-server';

const mockSearch = vi.mocked(searchRecent);
const mockLLM = vi.mocked(callAnthropicJson);

const ONE_RESULT = [{ title: 't', snippet: 's', url: 'https://x.example', publishedYMD: '2026-06-01' }];

beforeEach(() => { mockSearch.mockReset(); mockLLM.mockReset(); });

describe('investigatePremise — silence by default', () => {
  it('no recent dated source → no_recent_source (silent), no LLM call', async () => {
    mockSearch.mockResolvedValue([]);
    const r = await investigatePremise({ text: 'base rate 3.5%', kind: 'premise', baselineYMD: '2026-05-01', priorValue: 3.5 });
    expect(r.verdict).toBe('no_recent_source');
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it('out-of-list citation collapses to no_recent_source (no fabricated source)', async () => {
    mockSearch.mockResolvedValue(ONE_RESULT);
    mockLLM.mockResolvedValue({ mode: 'numeric', fact: 'x', source_index: 9, current_value: 4, confidence: 'high' });
    const r = await investigatePremise({ text: 'base rate', kind: 'premise', baselineYMD: '2026-05-01', priorValue: 3.5 });
    expect(r.verdict).toBe('no_recent_source');
  });
});

describe('investigatePremise — numeric drift', () => {
  it('alerts material with source+date on a >10% move', async () => {
    mockSearch.mockResolvedValue(ONE_RESULT);
    mockLLM.mockResolvedValue({ mode: 'numeric', fact: '기준금리 4.0%', source_index: 1, current_value: 4.0, confidence: 'high' });
    const r = await investigatePremise({ text: '기준금리 3.5%', kind: 'premise', baselineYMD: '2026-05-01', priorValue: 3.5 });
    expect(r.verdict).toBe('material');
    expect(r.materiality).toBe('material');
    expect(r.source_url).toBe('https://x.example');
    expect(r.source_date).toBe('2026-06-01');
    expect(r.current_value).toBe(4.0);
  });

  it('stays quiet on a sub-threshold move', async () => {
    mockSearch.mockResolvedValue(ONE_RESULT);
    mockLLM.mockResolvedValue({ mode: 'numeric', fact: '기준금리 3.51%', source_index: 1, current_value: 3.51, confidence: 'high' });
    const r = await investigatePremise({ text: '기준금리 3.5%', kind: 'premise', baselineYMD: '2026-05-01', priorValue: 3.5 });
    expect(r.verdict).toBe('quiet');
  });
});

describe('investigatePremise — fact & novelty gates', () => {
  it('fact changed at medium+ confidence alerts; low confidence stays quiet', async () => {
    mockSearch.mockResolvedValue(ONE_RESULT);
    mockLLM.mockResolvedValue({ mode: 'fact', fact: '경쟁사 출시', source_index: 1, changed: true, confidence: 'medium' });
    expect((await investigatePremise({ text: '경쟁사 미출시', kind: 'premise', baselineYMD: '2026-05-01' })).verdict).toBe('material');

    mockLLM.mockResolvedValue({ mode: 'fact', fact: '?', source_index: 1, changed: true, confidence: 'low' });
    expect((await investigatePremise({ text: '경쟁사 미출시', kind: 'premise', baselineYMD: '2026-05-01' })).verdict).toBe('quiet');
  });

  it('novelty requires HIGH confidence to alert (harder gate)', async () => {
    mockSearch.mockResolvedValue(ONE_RESULT);
    mockLLM.mockResolvedValue({ mode: 'novelty', fact: '새 규제 발표', source_index: 1, has_new_info: true, confidence: 'high' });
    expect((await investigatePremise({ text: '규제 어떻게 될까', kind: 'open_question', baselineYMD: '2026-05-01' })).verdict).toBe('material');

    mockLLM.mockResolvedValue({ mode: 'novelty', fact: '?', source_index: 1, has_new_info: true, confidence: 'medium' });
    expect((await investigatePremise({ text: '규제 어떻게 될까', kind: 'open_question', baselineYMD: '2026-05-01' })).verdict).toBe('quiet');
  });
});
