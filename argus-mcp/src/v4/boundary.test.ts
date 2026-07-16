import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EvidenceArtifactSchema, SEMANTIC_VERSION, V4_SHADOW_ENV } from './types.js';
import { isV4ShadowEnabled } from './shadow.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('K1 namespace and deployment boundary', () => {
  it('is an explicit v4 contract behind one exact shadow flag', () => {
    expect(SEMANTIC_VERSION).toBe(4);
    expect(V4_SHADOW_ENV).toBe('ARGUS_SEMANTIC_V4_SHADOW');
    expect(isV4ShadowEnabled({ ARGUS_SEMANTIC_V4_SHADOW: '1' })).toBe(true);
    expect(isV4ShadowEnabled({ ARGUS_SEMANTIC_V4_SHADOW: 'true' })).toBe(false);
  });

  it('does not import or patch legacy semantic/write namespaces', () => {
    const productionSources = fs.readdirSync(here)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => fs.readFileSync(path.join(here, name), 'utf8'))
      .join('\n');
    expect(productionSources).not.toMatch(/from ['"]\.\.\/v[123]\//);
    expect(productionSources).not.toContain('decision-ledger');
    expect(productionSources).not.toContain('elicit');
  });

  it('does not admit full copied source content into EvidenceArtifact', () => {
    const parsed = EvidenceArtifactSchema.safeParse({
      evidence_id: 'evidence:full-copy',
      kind: 'document',
      access: 'available',
      full_content: 'A copied private document',
    });
    expect(parsed.success).toBe(false);
  });
});
