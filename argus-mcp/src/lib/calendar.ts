import fs from 'fs/promises';
import path from 'path';
import { calendarPath } from './layout.js';

function ymdCompact(ymd: string): string {
  return ymd.replace(/-/g, '');
}

function addOneDay(ymd: string): string {
  const t = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(t)) return ymd;
  return new Date(t + 86_400_000).toISOString().slice(0, 10);
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldLine(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = rest.slice(74);
  }
  chunks.push(rest);
  return chunks.map((chunk, i) => (i === 0 ? chunk : ` ${chunk}`)).join('\r\n');
}

export function renderReturnCalendarEvent(args: {
  id: string;
  predicate: string;
  check_by: string;
  created_at: string;
}): string {
  const start = ymdCompact(args.check_by);
  const end = ymdCompact(addOneDay(args.check_by));
  const stamp = args.created_at.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const summary = `Argus return: ${args.predicate.slice(0, 80)}`;
  const description = [
    'Your sealed Argus decision is due today.',
    `Predicate: ${args.predicate}`,
    'Open your terminal and run argus_check_in, then argus_settle if reality is clear.',
  ].join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Argus//Return Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(args.id)}@argus.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT9H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export async function writeReturnCalendarEvent(argusDir: string, args: {
  id: string;
  predicate: string;
  check_by: string;
  created_at: string;
}): Promise<string> {
  const file = calendarPath(argusDir, args.id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, renderReturnCalendarEvent(args), 'utf8');
  return file;
}
