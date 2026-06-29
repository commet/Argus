import type { ReframeItem, SynthesizeItem, RecastItem, HiddenAssumption, ProgressiveSession, WaypointType } from '@/stores/types';
import { getActivePath } from '@/lib/version-tree';

const actorLabels: Record<string, string> = {
  ai: '🤖 AI',
  human: '🧠 사람',
  both: '🤝 협업',
};

/**
 * Render the active branch's ship's log as a markdown section, appended to the
 * exported deliverable so the *decision trail* ships with the document — the
 * product's "the process is the deliverable" promise. Returns '' when empty.
 */
const WP_EXPORT: Record<WaypointType, { ko: string; en: string; glyph: string }> = {
  departure:     { ko: '출항',      en: 'Departure',     glyph: '⚓' },
  course_change: { ko: '항로 변경',  en: 'Course change', glyph: '↻' },
  reef:          { ko: '암초',      en: 'Reef',          glyph: '⚠' },
  sighting:      { ko: '관측',      en: 'Sighting',      glyph: '👁' },
  headwind:      { ko: '역풍',      en: 'Headwind',      glyph: '🜨' },
  helm:          { ko: '선장의 키',  en: 'Helm',          glyph: '🖐' },
  anchorage:     { ko: '정박',      en: 'Anchorage',     glyph: '⚑' },
};

export function voyageLogToMarkdown(session: ProgressiveSession | null | undefined, locale: 'ko' | 'en'): string {
  if (!session) return '';
  const branches = session.branches || [];
  const active = branches.find(b => b.id === session.active_branch_id);
  const headId = active?.head_checkpoint_id ?? session.active_checkpoint_id ?? null;
  const path = getActivePath(session.checkpoints || [], headId);
  const order = new Map(path.map((c, i) => [c.id, i]));
  const wps = (session.waypoints || [])
    .filter(w => order.has(w.checkpoint_id))
    .sort((a, b) => (order.get(a.checkpoint_id)! - order.get(b.checkpoint_id)!));
  if (wps.length === 0) return '';

  const ko = locale === 'ko';
  const out: string[] = [ko ? '## 항해일지 — 사고의 궤적' : "## Ship's log — the decision trail", ''];
  wps.forEach((w, i) => {
    const m = WP_EXPORT[w.type];
    out.push(`${i + 1}. ${m.glyph} **${ko ? m.ko : m.en}** — ${w.headline}`);
    if (w.trigger) out.push(`   - ${ko ? '계기' : 'Trigger'}: ${w.trigger}`);
    if (w.significance) out.push(`   - ${ko ? '의미' : 'Why it matters'}: ${w.significance}`);
    (w.alternatives || []).filter(a => !a.taken).forEach(a => {
      out.push(`   - ${ko ? '가지 않은 길' : 'Road not taken'}: ${a.label}${a.why_abandoned ? ` — ${a.why_abandoned}` : ''}`);
    });
  });
  return out.join('\n');
}

export function reframeToMarkdown(item: ReframeItem): string {
  const analysis = item.analysis;
  if (!analysis) return '';

  const selectedQ = item.selected_question
    || analysis.reframed_question
    || analysis.hypothesis
    || analysis.hidden_questions[0]?.question
    || '';

  // Handle both old (string[]) and new (HiddenAssumption[]) format
  const assumptions = Array.isArray(analysis.hidden_assumptions)
    ? analysis.hidden_assumptions.map((a: HiddenAssumption | string) => {
        if (typeof a === 'string') return `- ${a}`;
        const status = a.verified ? ' ✅' : '';
        return `- ${a.assumption}${status}${a.risk_if_false && !a.verified ? ` → 만약 아니라면: ${a.risk_if_false}` : ''}`;
      }).join('\n')
    : '';

  let md = `## 항로 재설정 | 문제 재정의\n\n`;
  md += `### 표면 과제\n${analysis.surface_task}\n\n`;
  md += `### 재정의된 진짜 질문\n${selectedQ}\n\n`;

  if (analysis.why_reframing_matters) {
    md += `${analysis.why_reframing_matters}\n\n`;
  }

  if (assumptions) {
    md += `### 검증 필요한 전제\n${assumptions}\n\n`;
  }

  if (analysis.ai_limitations.length > 0) {
    md += `### AI 한계\n${analysis.ai_limitations.map((l) => `- ${l}`).join('\n')}`;
  }

  return md;
}

export function synthesizeToMarkdown(item: SynthesizeItem): string {
  const analysis = item.analysis;
  if (!analysis) return '';

  const sources = analysis.sources_summary
    .map((s) => `- **${s.name}**: ${s.core_claim}`)
    .join('\n');

  const agreements = analysis.agreements.map((a) => `- ${a}`).join('\n');

  const conflicts = analysis.conflicts
    .map((c) => {
      const judgment = c.user_judgment ? `\n  - **판단**: ${c.user_judgment}${c.user_reasoning ? ` (${c.user_reasoning})` : ''}` : '';
      return `- **${c.topic}**: ${c.side_a.source} vs ${c.side_b.source}\n  - ${c.side_a.position} vs ${c.side_b.position}${judgment}`;
    })
    .join('\n');

  return `## 조율 결과

### 소스별 핵심 주장
${sources}

### 합의점
${agreements}

### 쟁점 및 판단
${conflicts}

${item.final_synthesis ? `### 종합 결론\n${item.final_synthesis}` : ''}`;
}

export function recastToMarkdown(item: RecastItem): string {
  const steps = item.steps.length > 0 ? item.steps : item.analysis?.steps || [];

  const rows = steps
    .map((step, i) => {
      const cp = step.checkpoint ? `⚑ ${step.checkpoint_reason}` : '-';
      const time = step.estimated_time || '-';
      return `| ${i + 1} | ${actorLabels[step.actor]} | ${step.task} | ${time} | ${cp} |`;
    })
    .join('\n');

  const goal = item.analysis?.goal_summary || item.input_text;

  let md = `## 선원 배치 | 실행 설계\n\n`;

  // Governing idea
  if (item.analysis?.governing_idea) {
    md += `### 핵심 방향\n${item.analysis.governing_idea}\n\n`;
  }

  // Storyline
  if (item.analysis?.storyline) {
    md += `### 스토리라인\n`;
    md += `- **상황**: ${item.analysis.storyline.situation}\n`;
    md += `- **문제**: ${item.analysis.storyline.complication}\n`;
    md += `- **접근**: ${item.analysis.storyline.resolution}\n\n`;
  }

  md += `**최종 목표**: ${goal}\n\n`;

  md += `| Step | 담당 | 할 일 | 예상 시간 | 체크포인트 |\n`;
  md += `|------|------|-------|----------|----------|\n`;
  md += rows + '\n\n';

  // Key assumptions
  if (item.analysis?.key_assumptions && item.analysis.key_assumptions.length > 0) {
    md += `### 핵심 가정\n`;
    for (const ka of item.analysis.key_assumptions) {
      md += `- **[${ka.importance === 'high' ? '높음' : ka.importance === 'medium' ? '중간' : '낮음'}]** ${ka.assumption}`;
      if (ka.if_wrong) md += ` (틀리면: ${ka.if_wrong})`;
      md += '\n';
    }
    md += '\n';
  }

  // AI/Human scope for "both" steps
  const bothSteps = steps.filter(s => s.actor === 'both' && (s.ai_scope || s.human_scope));
  if (bothSteps.length > 0) {
    md += `### 협업 분업\n`;
    for (const step of bothSteps) {
      md += `- **${step.task}**\n`;
      if (step.ai_scope) md += `  - AI: ${step.ai_scope}\n`;
      if (step.human_scope) md += `  - 사람: ${step.human_scope}\n`;
    }
    md += '\n';
  }

  // Judgment points
  const judgmentSteps = steps.filter(s => s.checkpoint || (s.judgment && s.judgment.trim()));
  if (judgmentSteps.length > 0) {
    md += `### 선장의 판단 포인트\n`;
    for (const step of steps) {
      if (step.checkpoint) {
        md += `- ⚑ ${step.task}: ${step.checkpoint_reason}\n`;
      } else if (step.judgment && step.judgment.trim()) {
        md += `- ⚖ ${step.task}: ${step.judgment}\n`;
      }
    }
    md += '\n';
  }

  if (item.analysis) {
    md += `**예상 총 소요시간**: ${item.analysis.total_estimated_time}\n`;
    md += `**AI 비율**: ${item.analysis.ai_ratio}% | **사람 비율**: ${item.analysis.human_ratio}%`;
  }

  return md;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

const MAILTO_BODY_LIMIT = 1800;

export function composeMailtoLink(subject: string, body: string): string {
  const trimmed = body.length > MAILTO_BODY_LIMIT
    ? body.slice(0, MAILTO_BODY_LIMIT) + '\n\n[...전체 내용은 Argus에서 확인]'
    : body;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(trimmed)}`;
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
