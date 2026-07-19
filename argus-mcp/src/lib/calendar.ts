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
  /** the language the prediction was sealed in — the alarm rings in it. A
   *  Korean user who sealed in Korean used to get an English phone alarm that
   *  told them to "run argus_check_in" (a tool name, not a human instruction). */
  locale?: 'ko' | 'en';
}): string {
  const start = ymdCompact(args.check_by);
  const end = ymdCompact(addOneDay(args.check_by));
  const stamp = args.created_at.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const ko = args.locale === 'ko';
  const summary = ko ? `Argus 확인일: ${args.predicate.slice(0, 80)}` : `Argus return: ${args.predicate.slice(0, 80)}`;
  const description = ko
    ? [
        '예측의 확인일이 됐습니다.',
        `예측: ${args.predicate}`,
        'Claude에서 Argus에게 "지금 확인할 것 있어?"라고 물어보고, 현실이 분명하면 실제 결과를 기록하세요.',
      ].join('\n')
    : [
        'An Argus prediction has reached its check date.',
        `Predicate: ${args.predicate}`,
        'Ask Argus "what\'s due?" in your assistant, then record what actually happened.',
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
    // DTSTART is local midnight of the check-by (an all-day event), so a POSITIVE
    // offset lands on the morning OF the due date. `-PT9H` fired nine hours
    // BEFORE midnight — 15:00 the previous afternoon — while the alarm text said
    // "due today". This .ics is the only thing that brings a sealed bet back
    // without an account, so it has to ring on the right day.
    'TRIGGER;RELATED=START:PT9H',
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
  locale?: 'ko' | 'en';
}): Promise<string> {
  const file = calendarPath(argusDir, args.id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, renderReturnCalendarEvent(args), 'utf8');
  return file;
}
