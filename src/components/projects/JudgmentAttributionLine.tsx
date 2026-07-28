import type { JudgmentAttribution } from '@/stores/types';

export function JudgmentAttributionLine({
  attribution,
  locale,
  className = '',
}: {
  attribution?: JudgmentAttribution;
  locale: 'ko' | 'en';
  className?: string;
}) {
  if (!attribution) return null;
  const ko = locale === 'ko';
  // Attribution arrives from remote merges, MCP/plugin imports and older local
  // records — surfaces this component cannot type-check. An unrecognised value
  // used to index to `undefined` and render as a bare "·  ·", i.e. the exact
  // moment we owe the user "unknown" is the moment the line went blank.
  const pick = <T extends string>(map: Record<string, string>, key: T | undefined): string =>
    (key && map[key]) || map.legacy_unknown;
  const wording = {
    user_direct: ko ? '사용자 직접 작성' : 'Written by user',
    user_reworded: ko ? '사용자가 다듬음' : 'Reworded by user',
    ai_surfaced: ko ? 'Argus 제안 문장' : 'Wording surfaced by Argus',
    imported: ko ? '가져온 문장' : 'Imported wording',
    legacy_unknown: ko ? '문장 출처 미확인' : 'Wording source unknown',
  };
  const authorityLabels = {
    user_asserted: ko ? '사용자 확정' : 'Confirmed by user',
    user_adopted: ko ? '사용자 채택' : 'Adopted by user',
    ai_suggested: ko ? 'AI 제안' : 'AI suggestion',
    unconfirmed: ko ? '미확정' : 'Unconfirmed',
    legacy_unknown: ko ? '확정 주체 미확인' : 'Authority unknown',
  };
  const surfaceLabels = {
    web: ko ? '웹' : 'Web',
    mcp: 'MCP',
    plugin: ko ? '플러그인' : 'Plugin',
    telegram: 'Telegram',
    document_import: ko ? '문서 가져오기' : 'Document import',
    legacy_unknown: ko ? '경로 미확인' : 'Surface unknown',
  };
  const wordingLabel = pick(wording, attribution.wording_source);
  const authorityLabel = pick(authorityLabels, attribution.authority);
  const surfaceLabel = pick(surfaceLabels, attribution.surface);
  const recordedAt = typeof attribution.recorded_at === 'string' ? attribution.recorded_at : '';
  const recorded = new Date(recordedAt);
  const time = !recordedAt || Number.isNaN(recorded.getTime())
    ? (ko ? '기록 시각 미확인' : 'Recorded time unknown')
    : new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(recorded);

  // 12px comes from main (readability pass); wordingLabel from this PR — the raw
  // `wording` renders an empty span when the stored value is unknown, blanking
  // the line exactly when it should read "미확인". Independent changes, both kept.
  return (
    <p className={`flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] leading-[1.45] text-[var(--text-tertiary)] ${className}`}>
      <span>{wordingLabel}</span>
      <span aria-hidden>·</span>
      <span>{authorityLabel}</span>
      <span aria-hidden>·</span>
      <span>{surfaceLabel}</span>
      <span aria-hidden>·</span>
      {recordedAt ? <time dateTime={recordedAt}>{time}</time> : <span>{time}</span>}
    </p>
  );
}
