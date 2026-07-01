import { describe, it, expect } from 'vitest';
import {
  itemExtractPrompt,
  toDecisionItems,
  ITEM_EXTRACT_PROMPT_KO,
  ITEM_EXTRACT_PROMPT_EN,
} from '../item-extract-core';

const T0 = Date.parse('2026-07-01T00:00:00Z');

describe('itemExtractPrompt', () => {
  it('switches by locale', () => {
    expect(itemExtractPrompt('ko')).toBe(ITEM_EXTRACT_PROMPT_KO);
    expect(itemExtractPrompt('en')).toBe(ITEM_EXTRACT_PROMPT_EN);
    expect(itemExtractPrompt('ko-KR')).toBe(ITEM_EXTRACT_PROMPT_KO);
  });
  it('forbids metaphor in the sentence rule (copy rule DESIGN §2)', () => {
    expect(ITEM_EXTRACT_PROMPT_KO).toContain('비유');
    expect(ITEM_EXTRACT_PROMPT_EN.toLowerCase()).toContain('no metaphor');
  });
});

describe('toDecisionItems', () => {
  it('normalizes rows into AI items with ai_original preserved via current text', () => {
    const raw = {
      items: [
        { type: 'premise', text: 'rates stay flat', external: true, load_bearing: true },
        { type: 'phenomenon', text: 'supply high for 3 years', external: true },
        { type: 'open_question', text: 'rent-out vs live-in' },
      ],
    };
    const items = toDecisionItems(raw, 'dec1', T0);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.source === 'ai')).toBe(true);
    const premise = items.find((i) => i.type === 'premise')!;
    expect(premise.external).toBe(true);
    expect(premise.load_bearing).toBe(true);
    expect(premise.alert.mode).toBe('on_change'); // load-bearing external premise
  });
  it('forces external=false for open_question', () => {
    const items = toDecisionItems({ items: [{ type: 'open_question', text: 'q', external: true }] }, 'd', T0);
    expect(items[0].external).toBe(false);
  });
  it('skips malformed rows and unknown types', () => {
    const raw = { items: [{ type: 'premise', text: '' }, { type: 'bogus', text: 'x' }, { text: 'no type' }, null] };
    expect(toDecisionItems(raw, 'd', T0)).toHaveLength(0);
  });
  it('caps counts per type and dedupes by stable id', () => {
    const raw = {
      items: [
        ...Array.from({ length: 8 }, (_, i) => ({ type: 'premise', text: `p${i}` })),
        { type: 'premise', text: 'p0' }, // duplicate
      ],
    };
    const items = toDecisionItems(raw, 'd', T0);
    expect(items.filter((i) => i.type === 'premise')).toHaveLength(4); // cap
  });
  it('is defensive against non-object input', () => {
    expect(toDecisionItems(null, 'd', T0)).toEqual([]);
    expect(toDecisionItems('nope', 'd', T0)).toEqual([]);
  });
});
