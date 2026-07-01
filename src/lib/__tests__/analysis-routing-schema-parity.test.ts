import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ANALYSIS_REQUEST_TYPES,
  ANALYSIS_REVERSIBILITIES,
  ANALYSIS_STAKES,
  DECISION_DENSITIES,
  FRAME_STATUSES,
  LEGACY_PLUGIN_REQUEST_TYPES,
} from '../analysis-routing';

const schema = JSON.parse(
  readFileSync(join(process.cwd(), 'argus-plugin-v2/data/schemas/analysis-snapshot.json'), 'utf8'),
);

describe('analysis routing schema parity', () => {
  it('plugin schema accepts every canonical web request_type plus the legacy plugin alias', () => {
    expect(schema.properties.request_type.enum).toEqual([
      ...ANALYSIS_REQUEST_TYPES,
      ...LEGACY_PLUGIN_REQUEST_TYPES,
    ]);
  });

  it('plugin schema uses the same routing axis vocabularies as the webapp', () => {
    expect(schema.properties.frame_status.enum).toEqual([...FRAME_STATUSES]);
    expect(schema.properties.decision_density.enum).toEqual([...DECISION_DENSITIES]);
    expect(schema.properties.stakes.enum).toEqual([...ANALYSIS_STAKES]);
    expect(schema.properties.reversibility.enum).toEqual([...ANALYSIS_REVERSIBILITIES]);
  });
});
