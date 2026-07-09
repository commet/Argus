'use client';

import React from 'react';
import type { HonestyFlag } from '@/lib/honesty-scan';
import { locateFlag } from '@/lib/honesty-scan';

/**
 * Renders `text`, shading any spans the post-generation honesty scan flagged as
 * unverified world-fact / fabricated specific (loop-17). The shade is a dotted
 * underline + a hairline "확인 필요" marker with a tooltip — NEVER the banned
 * left-accent bar, and deliberately quiet so a legitimate sentence next to it
 * doesn't read as alarmed. If no flag matches, renders the text verbatim (a false
 * shade is worse than a miss — locateFlag returns -1 on any non-exact span).
 *
 * Provenance-honest, not a verdict: it says "이건 확인 안 된 추정이에요", never
 * "this is wrong" — the spine is honest gaps, not judging the content.
 */
export function HonestyShaded({
  text,
  flags,
  locale,
}: {
  text: string;
  flags?: HonestyFlag[] | null;
  locale: 'ko' | 'en';
}) {
  if (!text || !flags || flags.length === 0) return <>{text}</>;

  // Collect non-overlapping match ranges (verbatim only — never a fuzzy shade).
  const ranges: { start: number; end: number; flag: HonestyFlag }[] = [];
  for (const flag of flags) {
    const idx = locateFlag(text, flag.text);
    if (idx < 0) continue;
    const start = idx;
    const end = idx + (text.startsWith(flag.text, idx) ? flag.text.length : flag.text.replace(/[.。!?！？…]+\s*$/u, '').trim().length);
    if (ranges.some((r) => start < r.end && end > r.start)) continue; // skip overlaps
    ranges.push({ start, end, flag });
  }
  if (ranges.length === 0) return <>{text}</>;
  ranges.sort((a, b) => a.start - b.start);

  // Tooltip reads as an IMPERATIVE ("you should check"), never a badge of
  // confirmation. The where-source (loop-17 A) turns "확인 필요" into "실거래가에서
  // 확인하세요" when a source exists.
  const tip = (f: HonestyFlag) => {
    const ko = locale === 'ko';
    const lead = f.where
      ? (ko ? `${f.where}에서 확인해 보세요` : `Check it in ${f.where}`)
      : f.kind === 'world_fact'
        ? (ko ? '아직 확인 안 된 바깥 사실이에요 — 직접 확인해 보세요' : "An outside fact we couldn't verify — check it yourself")
        : (ko ? '입력에 없던 내용을 채운 부분이에요 — 사실인지 확인해 보세요' : 'Filled in beyond what you gave — verify it');
    return lead + (f.why ? ` · ${f.why}` : '');
  };

  const out: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) out.push(<React.Fragment key={`t${i}`}>{text.slice(cursor, r.start)}</React.Fragment>);
    // Quiet dotted underline ONLY — no per-span text tail (that read as a
    // "confirmed" badge and cluttered the line). Meaning is explained once by the
    // legend below the card; detail + source live in the tooltip on hover/tap.
    out.push(
      <span
        key={`f${i}`}
        title={tip(r.flag)}
        className="underline decoration-dotted decoration-[var(--accent)]/50 underline-offset-[3px] cursor-help"
      >
        {text.slice(r.start, r.end)}
      </span>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) out.push(<React.Fragment key="tail">{text.slice(cursor)}</React.Fragment>);
  return <>{out}</>;
}
