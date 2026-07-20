import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { body, tmpArgusDir } from '../../test-helpers.js';
import { seal } from '../../tools/seal.js';
import { calendarPath } from '../layout.js';
import { renderReturnCalendarEvent, writeReturnCalendarEvent } from '../calendar.js';

describe('return calendar export', () => {
  it('folds on UTF-8 octets without splitting a codepoint (emoji + long Korean)', () => {
    // The old length-based fold cut between a surrogate pair (emoji → U+FFFD)
    // and let Korean lines blow the RFC 5545 75-octet cap.
    const ics = renderReturnCalendarEvent({
      id: 'e1',
      predicate: '가'.repeat(50) + '😀 마침내 출시된다',
      check_by: '2026-09-01',
      created_at: '2026-07-01T00:00:00.000Z',
    });
    expect(ics).not.toContain('�'); // no surrogate-split corruption
    for (const line of ics.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
  });

  it("neutralizes a lone CR / control char in the predicate (no raw control byte in the file)", () => {
    const cr = String.fromCharCode(13), lf = String.fromCharCode(10), bel = String.fromCharCode(7);
    const ics = renderReturnCalendarEvent({
      id: "e2",
      predicate: "ship it" + cr + "now" + bel + "and it is done, really",
      check_by: "2026-09-01", created_at: "2026-07-01T00:00:00.000Z",
    });
    // every CR must be part of a CRLF pair (no bare CR leaked from the predicate)
    const chars = Array.from(ics);
    expect(chars.every((ch, i) => ch !== cr || chars[i + 1] === lf)).toBe(true);
    expect(ics).not.toContain(bel); // BEL stripped
  });

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
    expect(ics).toContain('SUMMARY:Argus check-in: conversion stays above 4%\\, no exceptions');
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
