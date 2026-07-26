import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { deriveDecisionKind } = require('./lib/judgment-foundation.js');
const fixture = JSON.parse(readFileSync(
  join(here, '..', '..', 'data', 'contracts', 'judgment-foundation-conformance.json'),
  'utf8',
));

test('plugin kind derivation conforms to the shared Korean/English fixture', () => {
  for (const item of fixture.kind_cases) {
    assert.deepEqual(
      deriveDecisionKind(
        item.statement,
        item.explicit_kind,
        item.record_only === true,
        item.has_return_handle === true,
      ),
      { kind: item.expected_kind, rule: item.expected_rule },
      item.id,
    );
  }
});
