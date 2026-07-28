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
  const wording = {
    user_direct: ko ? '사용자 직접 작성' : 'Written by user',
    user_reworded: ko ? '사용자가 다듬음' : 'Reworded by user',
    ai_surfaced: ko ? 'Argus 제안 문장' : 'Wording surfaced by Argus',
    imported: ko ? '가져온 문장' : 'Imported wording',
    legacy_unknown: ko ? '문장 출처 미확인' : 'Wording source unknown',
  }[attribution.wording_source];
  const authority = {
    user_asserted: ko ? '사용자 확정' : 'Confirmed by user',
    user_adopted: ko ? '사용자 채택' : 'Adopted by user',
    ai_suggested: ko ? 'AI 제안' : 'AI suggestion',
    unconfirmed: ko ? '미확정' : 'Unconfirmed',
    legacy_unknown: ko ? '확정 주체 미확인' : 'Authority unknown',
  }[attribution.authority];
  const surface = {
    web: ko ? '웹' : 'Web',
    mcp: 'MCP',
    plugin: ko ? '플러그인' : 'Plugin',
    telegram: 'Telegram',
    document_import: ko ? '문서 가져오기' : 'Document import',
    legacy_unknown: ko ? '경로 미확인' : 'Surface unknown',
  }[attribution.surface];
  const recorded = new Date(attribution.recorded_at);
  const time = Number.isNaN(recorded.getTime())
    ? attribution.recorded_at
    : new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(recorded);

  return (
    <p className={`flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] leading-[1.45] text-[var(--text-tertiary)] ${className}`}>
      <span>{wording}</span>
      <span aria-hidden>·</span>
      <span>{authority}</span>
      <span aria-hidden>·</span>
      <span>{surface}</span>
      <span aria-hidden>·</span>
      <time dateTime={attribution.recorded_at}>{time}</time>
    </p>
  );
}
