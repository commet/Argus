import { traceLocators } from '@/lib/evidence-trace';
import type { SynthesizeItem } from '@/stores/types';

export interface SynthesisSourceLocation {
  sourceIndex: number;
  sourceName: string;
  lineStart: number;
  lineEnd: number;
  excerpt: string;
  match: 'direct' | 'closest' | 'unresolved';
  locator: string;
}

const normalize = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9가-힣%]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokens = (value: string) => new Set(
  normalize(value).split(' ').filter((token) => token.length >= 2),
);

function sourceIndexFor(item: SynthesizeItem, sourceName: string): number {
  const target = normalize(sourceName);
  const exact = item.sources.findIndex((source) => normalize(source.name) === target);
  if (exact >= 0) return exact;
  const partial = item.sources.findIndex((source) => {
    const candidate = normalize(source.name);
    return Boolean(candidate && target && (candidate.includes(target) || target.includes(candidate)));
  });
  if (partial >= 0) return partial;
  return item.analysis?.sources_summary.findIndex((source) => normalize(source.name) === target) ?? -1;
}

function paragraphBlocks(content: string): Array<{ text: string; lineStart: number; lineEnd: number }> {
  const lines = content.split(/\r?\n/);
  const blocks: Array<{ text: string; lineStart: number; lineEnd: number }> = [];
  let buffer: string[] = [];
  let start = 1;
  const flush = (end: number) => {
    const text = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ text, lineStart: start, lineEnd: end });
    buffer = [];
  };
  lines.forEach((line, index) => {
    if (/^#{1,6}\s+/.test(line.trim())) {
      if (buffer.length) flush(index);
      blocks.push({ text: line, lineStart: index + 1, lineEnd: index + 1 });
      return;
    }
    if (!line.trim()) {
      if (buffer.length) flush(index);
      return;
    }
    if (!buffer.length) start = index + 1;
    buffer.push(line);
  });
  if (buffer.length) flush(lines.length);
  return blocks;
}

export function locateSynthesisSource(
  item: SynthesizeItem,
  sourceName: string,
  position: string,
): SynthesisSourceLocation | null {
  const sourceIndex = sourceIndexFor(item, sourceName);
  const source = item.sources[sourceIndex];
  if (!source) return null;
  const blocks = paragraphBlocks(source.content);
  if (blocks.length === 0) {
    return {
      sourceIndex,
      sourceName: source.name,
      lineStart: 1,
      lineEnd: 1,
      excerpt: '',
      match: 'unresolved',
      locator: traceLocators.synthesizeSource(item.id, sourceIndex, 1),
    };
  }

  const target = normalize(position);
  const targetTokens = tokens(position);
  const scored = blocks.map((block) => {
    const blockNormalized = normalize(block.text);
    const direct = target.length >= 10 && (blockNormalized.includes(target) || target.includes(blockNormalized));
    const blockTokens = tokens(block.text);
    const overlap = [...targetTokens].filter((token) => blockTokens.has(token)).length;
    const score = overlap / Math.max(1, Math.min(targetTokens.size, blockTokens.size));
    return { block, direct, score };
  }).sort((a, b) => Number(b.direct) - Number(a.direct) || b.score - a.score);
  const best = scored[0];
  const match = best.direct ? 'direct' : best.score >= 0.3 ? 'closest' : 'unresolved';
  return {
    sourceIndex,
    sourceName: source.name,
    lineStart: best.block.lineStart,
    lineEnd: best.block.lineEnd,
    excerpt: best.block.text,
    match,
    locator: traceLocators.synthesizeSource(item.id, sourceIndex, best.block.lineStart),
  };
}
