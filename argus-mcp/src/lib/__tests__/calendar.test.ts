import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { body, tmpArgusDir } from '../../test-helpers.js';
import { seal } from '../../tools/seal.js';
import { calendarPath } from '../layout.js';
import { renderReturnCalendarEvent, writeReturnCalendarEvent } from '../calendar.js';

describe('return calendar export', () => {
  it('renders a dependency-free all-day .ics event for the check-by date', () => {
    const ics = renderReturnCalendarEvent({
      id: 'd1',
      predicate: 'conversion stays above 4%, no exceptions',
      check_by: '2026-08-01',
      created_at: '2026-07-07T09:00:00.000Z',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:d1@argus.local');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260801');
    expect(ics).toContain('DTEND;VALUE=DATE:20260802');
    expect(ics).toContain('SUMMARY:Argus return: conversion stays above 4%\\, no exceptions');
    expect(ics).toContain('BEGIN:VALARM');
  });

  it('writes under .argus/calendar with a safe decision id', async () => {
    const dir = tmpArgusDir();
    const file = await writeReturnCalendarEvent(dir, {
      id: 'decision-one',
      predicate: 'ship under five minutes downtime',
      check_by: '2026-08-01',
      created_at: '2026-07-07T09:00:00.000Z',
    });

    expect(file).toBe(calendarPath(dir, 'decision-one'));
    expect(file.startsWith(path.join(dir, 'calendar'))).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toContain('ship under five minutes downtime');
  });

  it('argus_seal creates the calendar file and returns its path', async () => {
    const dir = tmpArgusDir();
    const result = await seal.handler({
      argus_dir: dir,
      id: 'd1',
      predicate: 'ship under five minutes downtime',
      check_by: '2026-08-01',
      predicate_owner: 'user',
      today_override: '2026-07-07',
    });
    const b = body(result);
    const data = b.data as { calendar_path?: string };

    expect(data.calendar_path).toBe(calendarPath(dir, 'd1'));
    expect(fs.existsSync(data.calendar_path!)).toBe(true);
    expect(String(b.surface)).toContain(data.calendar_path);
  });
});
