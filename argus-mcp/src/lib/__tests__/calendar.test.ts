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
    // The alarm must ring on the MORNING OF the check-by, not the afternoon
    // before it. DTSTART is local midnight of an all-day event, so the offset has
    // to be positive; `-PT9H` rang at 15:00 the previous day while the alarm text
    // said "due today". With no account token this .ics is the ONLY thing that
    // brings a sealed bet back, so the day it fires is the whole feature.
    expect(ics).toContain('TRIGGER;RELATED=START:PT9H');
    expect(ics).not.toContain('TRIGGER:-PT9H');
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
    // The absolute path lives in data, not the one-line surface (copy find).
    // The surface only mentions that a calendar file exists.
    expect(String(b.surface)).not.toContain(data.calendar_path!);
    expect(String(b.surface)).toContain('.ics');
  });
});
