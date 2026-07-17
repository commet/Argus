import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COURSE_STATUSES } from '../current-bearing';

/**
 * Re-drift prevention (R-parity): the course-status set is shared product truth.
 * The webapp Current Bearing (current-bearing.ts COURSE_STATUSES) and the plugin
 * bearing schema (argus-plugin-v2/data/schemas/current-bearing.json) must emit
 * the SAME set of statuses, or the two surfaces give the user a different
 * vocabulary for "where you are now." This test fails CI if they drift:
 *   - the JSON schema enum is the plugin's machine-readable source
 *   - the sail SKILL.md status legend is the plugin's human-readable source
 * Change the set in current-bearing.ts, then update BOTH plugin sources in the
 * same change, or this guard goes red.
 */

const PLUGIN_ROOT = join(process.cwd(), 'argus-plugin-v2');

describe('course-status — webapp<->plugin schema parity (drift guard)', () => {
  const schema = JSON.parse(
    readFileSync(join(PLUGIN_ROOT, 'data/schemas/current-bearing.json'), 'utf8'),
  );
  const pluginEnum: string[] = schema.properties.current_course.properties.status.enum;

  it('webapp COURSE_STATUSES === plugin schema enum (same members, same order)', () => {
    expect([...COURSE_STATUSES]).toEqual(pluginEnum);
  });

  it('the set is non-empty (guards an accidental empty enum)', () => {
    expect(COURSE_STATUSES.length).toBeGreaterThan(0);
  });
});

describe('course-status — webapp<->plugin SKILL.md legend parity (drift guard)', () => {
  const skill = readFileSync(
    join(PLUGIN_ROOT, 'skills/review/pipeline.md'),
    'utf8',
  );

  it.each(COURSE_STATUSES)('sail SKILL.md status legend documents "%s"', (status) => {
    // The legend lines read like "- `proceed`: evidence is sufficient ...".
    const legend = new RegExp('`' + status + '`\\s*:');
    expect(legend.test(skill)).toBe(true);
  });
});
