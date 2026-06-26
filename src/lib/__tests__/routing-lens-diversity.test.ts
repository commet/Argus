import { describe, it, expect } from 'vitest';
import { selectAgents } from '../orchestrator-select';
import { lensOf } from '../agent-lens';
import type { InputClassification } from '../orchestrator-classify';
import type { Agent } from '../../stores/agent-types';

const mk = (id: string): Agent =>
  ({ id, name: id, level: 1, archived: false, keywords: [], observations: [] }) as never;

const cls: InputClassification =
  { stakes: 'important', domains: [], decisionType: 'needs_analysis', agentCount: 4 };

describe('agent-lens mapping', () => {
  it('all 15 routable agents map to a lens, covering all 7 lenses', () => {
    const ids = ['hayoon', 'sujin', 'minjae', 'hyeyeon', 'strategy_jr', 'hyunwoo',
      'chief_strategist', 'donghyuk', 'taejun', 'sujin_hr', 'yerin', 'junseo',
      'seoyeon', 'jieun', 'research_director'];
    for (const id of ids) expect(lensOf(id)).not.toBeNull();
    expect(new Set(ids.map(lensOf)).size).toBe(7);
  });

  it('unmapped/custom agents are exempt (lensOf → null)', () => {
    expect(lensOf('some_custom_agent')).toBeNull();
  });
});

describe('selectAgents — one worker per lens (diversity)', () => {
  it('two research-ish steps do NOT both go to Scout (chain-tie dissolved)', () => {
    const agents = ['hayoon', 'sujin', 'minjae', 'donghyuk', 'seoyeon'].map(mk);
    const steps = [
      { task: '시장 조사 및 경쟁사 리서치', output: '시장 보고서' },
      { task: '추가 사례 리서치', output: '벤치마크' },
      { task: '비용 구조 계산', output: '수치' },
    ];
    const map = selectAgents(steps, cls, agents, []);
    const lenses = [...map.values()].map(a => lensOf(a.id)).filter(Boolean);
    // No lens appears twice — distinct lenses across the assigned workers.
    expect(new Set(lenses).size).toBe(lenses.length);
  });
});
