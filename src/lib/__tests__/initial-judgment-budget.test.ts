import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const engine = readFileSync(new URL('../progressive-engine.ts', import.meta.url), 'utf8');
const simulator = readFileSync(
  new URL('../../../scripts/sim/sim-entry.ts', import.meta.url),
  'utf8',
);

describe('first judgment generation budget', () => {
  it('bounds both first-frame paths without shrinking later deepening', () => {
    const initialRegion = engine.slice(
      engine.indexOf('export async function runInitialAnalysis'),
      engine.indexOf('export async function refineInitialFraming'),
    );
    const refinementRegion = engine.slice(
      engine.indexOf('export async function refineInitialFraming'),
      engine.indexOf('export async function runDeepeningAnalysis'),
    );

    expect(initialRegion.match(/maxTokens: 2048/g)).toHaveLength(2);
    expect(refinementRegion.match(/maxTokens: 2048/g)).toHaveLength(2);
    expect(engine.slice(engine.indexOf('export async function runDeepening')))
      .toContain('maxTokens: 2500');
  });

  it('prices the same first-turn cap in the simulation harness', () => {
    const initialRegion = simulator.slice(
      simulator.indexOf('export async function runHeavyInitial'),
      simulator.indexOf('export async function runHeavyDeepening'),
    );
    expect(initialRegion).toContain('maxTokens: 2048');
    expect(initialRegion).not.toContain('maxTokens: 4096');
  });
});
